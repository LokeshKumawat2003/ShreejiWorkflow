const { httpError } = require('../utils/httpError');

const PARENT_LABEL = /\b(?:S\/O|D\/O|W\/O|C\/O|S\.O\.|SON OF|DAUGHTER OF|WIFE OF)\s*:?\s*/i;

const BUILT_IN_MARKS = {
  present: ['P', 'PR', 'PRESENT', '1', 'Y', 'YES', '✓', '✔', '√', '☑', '✅', '🗸', '(✓)', '(✔)', '(√)', '(V)', 'Ⓥ', 'Ⓟ'],
  absent: ['A', 'AB', 'ABS', 'ABSENT', '0', 'N', 'NO', 'X', '✗', '✘', '×', '✕', '✖', '☒', '❎', '⊗', 'Ⓧ', 'ⓧ', '(X)', '(✗)', 'Ⓐ'],
  half_day: ['HD', 'H/D', 'HALF', 'HALFDAY', 'HALF DAY', 'HALF-DAY', '½', '1/2', 'P/2'],
  leave: ['L', 'LV', 'LEAVE'],
  casual_leave: ['CL', 'CASUAL LEAVE'],
  sick_leave: ['SL', 'SICK LEAVE', 'ML'],
  paid_leave: ['PL', 'EL', 'PAID LEAVE'],
  weekly_off: ['WO', 'W/O', 'OFF', 'WEEKLY OFF', 'WOFF'],
  holiday: ['H', 'HOL', 'HOLIDAY', 'PH', 'NH'],
};
const MARK_TOKENS = new Map(Object.entries(BUILT_IN_MARKS).flatMap(([status, tokens]) => tokens.map((token) => [token, status])));
// What OCR tends to return for hand-drawn ticks and crosses; never trusted at high confidence.
const LOOKALIKE_MARKS = new Map([
  ['V', 'present'], ['VV', 'present'], ['\\/', 'present'], ['J', 'present'], ['(V', 'present'], ['V)', 'present'],
  ['+', 'absent'], ['XX', 'absent'], ['(X', 'absent'], ['X)', 'absent'],
]);
// Circles, scribbles and similar shapes OCR returns for circled or struck-out marks.
const UNCLEAR_MARKS = new Set(['O', 'Q', 'Ø', '@', '©', '®', '#', '%', '&', '*', '~']);
const MARK_SYMBOLS = '✓✔√☑✅🗸✗✘×✕✖☒❎⊗½ⓍⓧⓋⓅⒶ';

function cellText(value) {
  if (value == null) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return String(value).replace(/\r\n/g, '\n').trim();
}

function normalizePersonName(value) {
  return cellText(value)
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function extractNameAndParent(rawName, rawParent = '') {
  const text = cellText(rawName);
  const parentFromColumn = normalizePersonName(rawParent);
  const match = text.match(new RegExp(`^(.*)${PARENT_LABEL.source}(.+)$`, 'is'));
  if (match) {
    return {
      name: normalizePersonName(match[1]),
      parentName: parentFromColumn || normalizePersonName(match[2]),
    };
  }
  return {
    name: normalizePersonName(text),
    parentName: parentFromColumn,
  };
}

function normalizeMarkToken(value) {
  return cellText(value)
    .replace(/[.]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .replace(/^([PA])\1{1,2}$/, '$1');
}

/** Looks a single mark up: admin symbols first, then the built-in marks, then OCR look-alikes. */
function lookupMark(value, symbols) {
  const token = normalizeMarkToken(value);
  if (!token) return null;
  const compact = token.replace(/[\s-]/g, '');
  const custom = symbols?.get(token) || symbols?.get(compact);
  if (custom) return { status: custom, strength: 'exact' };
  const builtIn = MARK_TOKENS.get(token) || MARK_TOKENS.get(compact);
  if (builtIn) return { status: builtIn, strength: 'exact' };
  const lookalike = LOOKALIKE_MARKS.get(compact);
  if (lookalike) return { status: lookalike, strength: 'lookalike' };
  if (UNCLEAR_MARKS.has(compact)) return { status: null, strength: 'unclear' };
  return null;
}

function parseStatusToken(value, symbols) {
  const found = lookupMark(value, symbols);
  return found?.strength === 'exact' ? found.status : null;
}

function readingConfidence(strength, ocrConfidence) {
  if (ocrConfidence === null || ocrConfidence === undefined) return strength === 'exact' ? 'high' : 'medium';
  if (strength === 'exact') return ocrConfidence >= 75 ? 'high' : ocrConfidence >= 50 ? 'medium' : 'low';
  return ocrConfidence >= 60 ? 'medium' : 'low';
}

/**
 * Reads one register cell. Returns null for a blank cell; anything that cannot be read with confidence
 * (unknown text, conflicting or overwritten marks, low OCR confidence) comes back as `needs_review`
 * with the best guess in `suggested`.
 */
function interpretMark(value, { symbols, ocrConfidence = null } = {}) {
  const mark = cellText(value).slice(0, 40);
  if (!mark) return null;
  const parts = mark.split(/\s*\n\s*/).filter(Boolean);
  const found = parts.map((part) => lookupMark(part, symbols));
  const statuses = [...new Set(found.filter((item) => item?.status).map((item) => item.status))];
  const review = (reason, suggested = null) => ({ status: 'needs_review', confidence: 'low', mark, suggested, reason });

  if (found.some((item) => !item)) return review('Unrecognised mark', statuses[0] || null);
  if (found.some((item) => item.strength === 'unclear')) return review('Unclear or circled mark', statuses[0] || null);
  if (statuses.length > 1) return review('Conflicting or overwritten marks', null);
  const strength = found.every((item) => item.strength === 'exact') ? 'exact' : 'lookalike';
  const confidence = readingConfidence(strength, ocrConfidence);
  if (confidence === 'low') return review('Low confidence reading', statuses[0]);
  return { status: statuses[0], confidence, mark };
}

function levenshtein(left, right) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  const rows = Array.from({ length: left.length + 1 }, (_, index) => index);
  for (let column = 1; column <= right.length; column += 1) {
    let previous = column;
    for (let row = 1; row <= left.length; row += 1) {
      const current = left[row - 1] === right[column - 1]
        ? rows[row - 1]
        : Math.min(rows[row - 1], rows[row], previous) + 1;
      rows[row - 1] = previous;
      previous = current;
    }
    rows[left.length] = previous;
  }
  return rows[left.length];
}

function namesSimilar(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;
  if (Math.min(left.length, right.length) < 4) return false;
  const distance = levenshtein(left, right);
  const longest = Math.max(left.length, right.length);
  return distance <= Math.max(1, Math.floor(longest * 0.2));
}

function matchExtractedEmployee(extracted, employees) {
  const extractedName = extracted.name || '';
  const extractedParent = extracted.parentName || '';
  if (!extractedName) return { employee: null, match: 'unmatched' };

  const exactName = employees.filter((employee) => normalizePersonName(employee.name) === extractedName);
  if (exactName.length === 1) return { employee: exactName[0], match: 'exact' };
  if (exactName.length > 1) {
    if (!extractedParent) return { employee: null, match: 'ambiguous' };
    const exactParent = exactName.filter((employee) => normalizePersonName(employee.parentName) === extractedParent);
    if (exactParent.length === 1) return { employee: exactParent[0], match: 'exact' };
    const similarParent = exactName.filter((employee) => namesSimilar(normalizePersonName(employee.parentName), extractedParent));
    if (similarParent.length === 1) return { employee: similarParent[0], match: 'fuzzy' };
    return { employee: null, match: 'ambiguous' };
  }

  const fuzzyName = employees.filter((employee) => namesSimilar(normalizePersonName(employee.name), extractedName));
  if (fuzzyName.length === 1) return { employee: fuzzyName[0], match: 'fuzzy' };
  if (fuzzyName.length > 1) {
    if (extractedParent) {
      const byParent = fuzzyName.filter((employee) => namesSimilar(normalizePersonName(employee.parentName), extractedParent));
      if (byParent.length === 1) return { employee: byParent[0], match: 'fuzzy' };
    }
    return { employee: null, match: 'ambiguous' };
  }
  return { employee: null, match: 'unmatched' };
}

function headerKey(value) {
  return cellText(value).toLowerCase().replace(/\s+/g, ' ');
}

function parseLooseDate(value) {
  const text = cellText(value);
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    const date = `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
    return date;
  }
  const dmy = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return '';
}

function classifyHeader(value) {
  const key = headerKey(value);
  if (!key) return null;
  if (/^(s\.?\s*no|sr\.?\s*no|serial|sl\.?\s*no)$/.test(key)) return { type: 'sno' };
  if (/father|parent|s\/o|d\/o|w\/o/.test(key)) return { type: 'parent' };
  if (/name of employee|employee name|^name$|name of employees/.test(key)) return { type: 'name' };
  if ((/status|attendance|present\/absent/.test(key)) && !/total/.test(key)) return { type: 'status' };
  if (/^date$/.test(key)) return { type: 'date' };
  const day = key.match(/^(?:day\s*)?(\d{1,2})$/);
  if (day) {
    const number = Number(day[1]);
    if (number >= 1 && number <= 31) return { type: 'day', day: number };
  }
  const date = parseLooseDate(key);
  if (date) return { type: 'dateday', date };
  return null;
}

function findHeaderRow(matrix) {
  let best = { score: 0, index: -1, columns: [] };
  for (let index = 0; index < Math.min(matrix.length, 20); index += 1) {
    const columns = (matrix[index] || []).map(classifyHeader);
    const hasName = columns.some((column) => column?.type === 'name');
    const dayCount = columns.filter((column) => column?.type === 'day' || column?.type === 'dateday').length;
    const score = columns.filter(Boolean).length + (hasName ? 6 : 0) + (dayCount >= 5 ? 4 : 0);
    if (score > best.score) best = { score, index, columns };
  }
  return best.index >= 0 && best.score >= 3 ? best : null;
}

function looksLikeName(value) {
  const name = extractNameAndParent(value).name;
  if (!name || name.length < 3) return false;
  if (/^(S NO|NAME|TOTAL|CATEGORY|SKILLED|UNSKILLED|REGISTER|ATTENDANCE)$/.test(name)) return false;
  return /[A-Z]/.test(name);
}

function inferNameColumn(matrix, headerIndex) {
  const sample = matrix.slice(headerIndex + 1, headerIndex + 8);
  let best = { index: 1, score: 0 };
  const width = Math.max(...sample.map((row) => (row || []).length), 2);
  for (let index = 0; index < Math.min(width, 6); index += 1) {
    const score = sample.filter((row) => looksLikeName((row || [])[index])).length;
    if (score > best.score) best = { index, score };
  }
  return best.score > 0 ? best.index : 1;
}

function parseSheetMatrix(matrix, date) {
  const rows = [];
  const header = findHeaderRow(matrix);
  const selectedDay = Number(date.slice(8, 10));
  let nameIndex = 1;
  let parentIndex = -1;
  let statusIndex = -1;
  let dateIndex = -1;
  let dayIndex = -1;
  let startIndex = 0;

  if (header) {
    startIndex = header.index + 1;
    header.columns.forEach((column, index) => {
      if (!column) return;
      if (column.type === 'name') nameIndex = index;
      if (column.type === 'parent') parentIndex = index;
      if (column.type === 'status') statusIndex = index;
      if (column.type === 'date') dateIndex = index;
      if (column.type === 'day' && column.day === selectedDay) dayIndex = index;
      if (column.type === 'dateday' && column.date === date) dayIndex = index;
    });
    if (nameIndex === 1 && !header.columns.some((column) => column?.type === 'name')) {
      nameIndex = inferNameColumn(matrix, header.index);
    }
  } else {
    nameIndex = inferNameColumn(matrix, -1);
  }

  for (const row of matrix.slice(startIndex)) {
    const cells = row || [];
    if (dateIndex >= 0) {
      const rowDate = parseLooseDate(cells[dateIndex]);
      if (rowDate && rowDate !== date) continue;
    }
    const extracted = extractNameAndParent(cells[nameIndex], parentIndex >= 0 ? cells[parentIndex] : '');
    if (!extracted.name || /^(TOTAL|GRAND TOTAL|TOTAL MANDAYS)$/.test(extracted.name)) continue;

    let status = null;
    if (dayIndex >= 0) status = parseStatusToken(cells[dayIndex]);
    if (!status && statusIndex >= 0) status = parseStatusToken(cells[statusIndex]);
    if (!status && dayIndex < 0 && statusIndex < 0) {
      const trailing = cells.slice(nameIndex + 1).map((cell) => parseStatusToken(cell)).filter(Boolean);
      if (trailing.length === 1) status = trailing[0];
    }

    rows.push({ extractedName: extracted.name, extractedParentName: extracted.parentName, status });
  }

  return rows;
}

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

function periodFromParts(month, year) {
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) return null;
  const label = `${MONTH_NAMES[month - 1][0].toUpperCase()}${MONTH_NAMES[month - 1].slice(1)} ${year}`;
  return { month, year, label };
}

function detectSheetPeriod(text) {
  const source = String(text || '').toLowerCase();
  const named = source.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?[\s,/-]*(\d{4})\b/);
  if (named) {
    const month = MONTH_NAMES.findIndex((name) => name.startsWith(named[1].slice(0, 3))) + 1;
    return periodFromParts(month, Number(named[2]));
  }
  const labelled = source.match(/\b(?:period|month)\b[^0-9\n]{0,12}(\d{1,2})[/-](\d{4})\b/);
  if (labelled) return periodFromParts(Number(labelled[1]), Number(labelled[2]));
  const isoMonth = source.match(/\b(?:period|month)\b[^0-9\n]{0,12}(\d{4})-(\d{1,2})\b/);
  if (isoMonth) return periodFromParts(Number(isoMonth[2]), Number(isoMonth[1]));
  return null;
}

function matrixPreambleText(matrix) {
  const header = findHeaderRow(matrix);
  const end = header ? header.index : Math.min(matrix.length, 8);
  return matrix.slice(0, end).map((row) => (row || []).map(cellText).join(' ')).join('\n');
}

function textToMatrix(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\t+|\s{2,}/).map((cell) => cell.trim()));
}

function parseLooseEmployeeLines(text, date) {
  const rows = [];
  const linePattern = /^(?:\d+\.?\s+)?(.+?)(?:\s+(?:skilled|un-skilled|unskilled|semi-skilled|semi skilled))?\s+(P|A|PR|AB|PRESENT|ABSENT)\s*$/i;
  for (const line of String(text || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = trimmed.match(linePattern);
    if (!match) continue;
    const extracted = extractNameAndParent(match[1]);
    if (!extracted.name) continue;
    rows.push({
      extractedName: extracted.name,
      extractedParentName: extracted.parentName,
      status: parseStatusToken(match[2]),
    });
  }
  return rows.length ? rows : parseSheetMatrix(textToMatrix(text), date);
}

function fileKind(file) {
  const name = String(file.originalname || '').toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')
    || mime.includes('spreadsheet') || mime.includes('excel') || mime === 'text/csv') {
    return 'spreadsheet';
  }
  if (name.endsWith('.pdf') || mime === 'application/pdf') return 'pdf';
  if (/\.(png|jpe?g|webp)$/.test(name) || mime.startsWith('image/')) return 'image';
  return null;
}

async function extractSpreadsheetMatrix(buffer) {
  const XLSX = require('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw httpError(400, 'The attendance sheet is empty.');
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
}

function groupPdfLines(items, unit = 1) {
  const lines = [];
  for (const item of [...items].sort((left, right) => right.y - left.y || left.x - right.x)) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 1.5 * unit);
    if (line) line.items.push(item);
    else lines.push({ y: item.y, items: [item] });
  }
  for (const line of lines) line.items.sort((left, right) => left.x - right.x);
  return lines.sort((left, right) => right.y - left.y);
}

function nearestPdfColumn(columns, center) {
  let bestIndex = -1;
  let bestDistance = Infinity;
  columns.forEach((column, index) => {
    const distance = Math.abs(column.center - center);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  if (bestIndex === columns.length - 1 && columns.length > 1) {
    const gap = columns[bestIndex].center - columns[bestIndex - 1].center;
    if (bestDistance > gap / 2) return -1;
  }
  return bestIndex;
}

// OCR misreads some day numbers (8 as "a", 29 as "28"); when the header holds exactly one cell per day, number them by position.
function numberDayColumns(columns) {
  const dayIndexes = columns.map((column, index) => (column.type === 'day' ? index : -1)).filter((index) => index >= 0);
  if (dayIndexes.length < 2) return;
  const first = dayIndexes[0];
  const last = dayIndexes[dayIndexes.length - 1];
  const firstDay = classifyHeader(columns[first].text).day;
  const lastDay = classifyHeader(columns[last].text).day;
  if (last - first !== lastDay - firstDay) return;
  for (let index = first; index <= last; index += 1) {
    columns[index].type = 'day';
    columns[index].text = String(firstDay + index - first);
  }
}

// PDF text extraction and OCR lose table borders, so cells are rebuilt from each text item's position:
// the line holding the day numbers defines the columns, and every row is anchored on the line holding its marks.
// `unit` scales the distance tolerances: 1 for PDF points, larger for OCR pixels.
// The returned matrix carries `geometry`: per matrix row, where its cells sit on the page and the lowest OCR confidence of each cell.
function pdfPagesToMatrix(pages, { unit = 1 } = {}) {
  let columns = null;
  let headerRow = null;
  const rows = [];
  const geometry = [];

  for (const items of pages) {
    const lines = groupPdfLines(items, unit);
    const headerIndex = lines.findIndex((line) => (
      line.items.filter((item) => classifyHeader(item.str)?.type === 'day').length >= 5
    ));
    let body = lines;
    if (headerIndex >= 0) {
      columns = lines[headerIndex].items.map((item) => ({ text: item.str, center: item.x + item.width / 2 }));
      columns.forEach((column) => { column.type = classifyHeader(column.text)?.type || null; });
      numberDayColumns(columns);
      headerRow = headerRow || columns.map((column) => column.text);
      body = lines.slice(headerIndex + 1);
    }
    if (!columns) continue;

    // OCR can read the marks of neighbouring days as one word ("PPA"); spread such a word over the days it covers.
    const dayCenters = columns.filter((column) => column.type === 'day').map((column) => column.center);
    const daySpacing = dayCenters.length > 1 ? (dayCenters[dayCenters.length - 1] - dayCenters[0]) / (dayCenters.length - 1) : Infinity;
    body = body.map((line) => ({
      ...line,
      items: line.items.flatMap((item) => {
        const letters = item.str.replace(/\s+/g, '');
        if (!/^[PA]{2,}$/i.test(letters) || item.width < daySpacing * 0.75) return [item];
        const letterWidth = Math.min(item.width / letters.length, daySpacing * 0.4);
        const step = (item.width - letterWidth) / (letters.length - 1);
        return [...letters].map((letter, index) => ({ ...item, str: letter, x: item.x + index * step, width: letterWidth }));
      }),
    }));

    const isDayMark = (item) => {
      const index = nearestPdfColumn(columns, item.x + item.width / 2);
      return index >= 0 && columns[index].type === 'day' && Boolean(lookupMark(item.str));
    };
    const anchors = body.filter((line) => line.items.some(isDayMark));
    if (anchors.length === 0) continue;
    const gaps = anchors.slice(1).map((anchor, index) => anchors[index].y - anchor.y);
    const reach = gaps.length ? Math.min(...gaps) / 2 : 12 * unit;
    const pageRows = anchors.map((anchor) => ({ anchor, extras: [] }));
    for (const line of body) {
      if (anchors.includes(line)) continue;
      let best = null;
      for (const row of pageRows) {
        const distance = Math.abs(row.anchor.y - line.y);
        if (distance < reach && (!best || distance < best.distance)) best = { row, distance };
      }
      if (best) best.row.extras.push(line);
    }

    for (const { anchor, extras } of pageRows) {
      const items = [anchor, ...extras]
        .sort((left, right) => right.y - left.y)
        .flatMap((line) => line.items.map((item) => ({ ...item, fromAnchor: line === anchor })));
      // Lines of one left-aligned cell (name, then "S/o ...") share a left edge; place them by the widest line.
      const stacks = [];
      for (const item of items) {
        const stack = stacks.find((candidate) => Math.abs(candidate.x - item.x) <= unit);
        if (stack) stack.items.push(item);
        else stacks.push({ x: item.x, items: [item] });
      }
      const cells = columns.map(() => []);
      for (const stack of stacks) {
        const widest = stack.items.reduce((best, item) => (item.width > best.width ? item : best));
        const stackColumn = nearestPdfColumn(columns, widest.x + widest.width / 2);
        for (const item of stack.items) {
          const index = stack.items.length > 1 && columns[stackColumn]?.type !== 'day'
            ? stackColumn
            : nearestPdfColumn(columns, item.x + item.width / 2);
          if (index < 0 || (columns[index].type === 'day' && !item.fromAnchor)) continue;
          cells[index].push({ y: item.y, str: item.str, confidence: item.confidence });
        }
      }
      rows.push(cells.map((values) => values.sort((left, right) => right.y - left.y).map((value) => value.str).join('\n')));
      const markCenters = anchor.items.filter((item) => isDayMark(item) && item.height).map((item) => -item.y + item.height / 2);
      geometry.push({
        centerY: markCenters.length ? markCenters.reduce((sum, value) => sum + value, 0) / markCenters.length : -anchor.y,
        halfHeight: reach,
        columnCenters: columns.map((column) => column.center),
        daySpacing,
        confidence: cells.map((values) => values.reduce(
          (lowest, value) => (Number.isFinite(value.confidence) ? Math.min(lowest, value.confidence) : lowest),
          Infinity,
        )),
      });
    }
  }

  if (!headerRow) return null;
  const matrix = [headerRow, ...rows];
  matrix.geometry = [null, ...geometry];
  return matrix;
}

async function extractPdfSource(buffer) {
  const pdfParse = require('pdf-parse');
  const pages = [];
  await pdfParse(buffer, {
    pagerender: async (page) => {
      const content = await page.getTextContent();
      const items = content.items
        .map((item) => ({ str: String(item.str || '').trim(), x: item.transform[4], y: item.transform[5], width: item.width || 0 }))
        .filter((item) => item.str);
      pages.push(items);
      return '';
    },
  });
  const text = pages
    .map((items) => groupPdfLines(items).map((line) => line.items.map((item) => item.str).join('  ')).join('\n'))
    .join('\n')
    .trim();
  return { text, matrix: pdfPagesToMatrix(pages) };
}

const OCR_TARGET_WIDTH = 3000;

// Runs of dark pixels, bridging gaps of up to `maxGap` light pixels (scanned lines are often broken).
function darkRuns(length, isDark, maxGap = 2) {
  const runs = [];
  let start = -1;
  let lastDark = -1;
  for (let index = 0; index <= length; index += 1) {
    if (index < length && isDark(index)) {
      if (start < 0) start = index;
      lastDark = index;
    } else if (start >= 0 && (index === length || index - lastDark > maxGap)) {
      runs.push([start, lastDark + 1]);
      start = -1;
    }
  }
  return runs;
}

// Small register text and table borders defeat OCR, so the image is enlarged, binarised and its ruled lines erased.
async function prepareImageForOcr(buffer) {
  const sharp = require('sharp');
  const metadata = await sharp(buffer).metadata();
  const sourceWidth = (metadata.orientation || 1) >= 5 ? metadata.height : metadata.width;
  const scale = Math.min(4, Math.max(1, OCR_TARGET_WIDTH / (sourceWidth || OCR_TARGET_WIDTH)));
  const { data, info } = await sharp(buffer)
    .rotate()
    .grayscale()
    .resize({ width: Math.round((sourceWidth || OCR_TARGET_WIDTH) * scale), kernel: 'lanczos3' })
    .normalise()
    .threshold(170)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const ruled = await sharp(Buffer.from(data), { raw: { width, height, channels: 1 } }).png().toBuffer();
  const isDark = (x, y) => data[y * width + x] < 128;

  const erase = [];
  const ruledRows = [];
  let lastRuledY = -Infinity;
  for (let y = 0; y < height; y += 1) {
    let ruled = false;
    for (const [start, end] of darkRuns(width, (x) => isDark(x, y))) {
      if (end - start >= width * 0.05) {
        erase.push({ horizontal: true, fixed: y, start, end });
        ruled = true;
      }
    }
    // A thick border spans several pixel rows; it counts as one ruled line.
    if (ruled) {
      if (y - lastRuledY > 3) ruledRows.push(y);
      lastRuledY = y;
    }
  }
  const spacings = ruledRows.slice(1).map((y, index) => y - ruledRows[index]).sort((left, right) => left - right);
  const cellHeight = spacings.length ? spacings[Math.floor(spacings.length / 2)] : height * 0.05;
  const minVertical = Math.max(10, cellHeight * 0.6);
  for (let x = 0; x < width; x += 1) {
    for (const [start, end] of darkRuns(height, (y) => isDark(x, y))) {
      if (end - start >= minVertical) erase.push({ horizontal: false, fixed: x, start, end });
    }
  }
  const lineHalo = Math.max(1, Math.round(scale));
  for (const { horizontal, fixed, start, end } of erase) {
    for (let offset = -lineHalo; offset <= lineHalo; offset += 1) {
      const line = fixed + offset;
      if (line < 0 || line >= (horizontal ? height : width)) continue;
      for (let index = start; index < end; index += 1) data[horizontal ? line * width + index : index * width + line] = 255;
    }
  }
  const unruled = await sharp(data, { raw: { width, height, channels: 1 } }).png().toBuffer();
  return { ruled, unruled, binary: data, width, height };
}

function ocrItems(data) {
  const lines = [];
  for (const block of data.blocks || []) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        const words = (line.words || [])
          .map((word) => ({
            str: String(word.text || '').trim().replace(/^([S$5][/1Il|][O0]|[S$][O0])$/i, 'S/O'),
            confidence: Number(word.confidence),
            ...word.bbox,
          }))
          .filter((word) => /[\p{L}\p{N}]/u.test(word.str) || [...word.str].some((char) => MARK_SYMBOLS.includes(char)))
          .sort((left, right) => left.x0 - right.x0);
        if (words.length) lines.push(words);
      }
    }
  }
  const heights = lines.flat().map((word) => word.y1 - word.y0).sort((left, right) => left - right);
  const textHeight = heights.length ? heights[Math.floor(heights.length / 2)] : 1;

  // OCR returns single words; words closer than about one text height belong to the same cell ("Name of Employee").
  // Day numbers and P/A marks are always cells of their own.
  const isCellToken = (str) => /^(\d{1,2}|[PA]{1,3}|CL|SL|PL|EL|WO|HD|AB|PR)$/i.test(str)
    || [...str].some((char) => MARK_SYMBOLS.includes(char));
  const items = [];
  for (const words of lines) {
    let phrase = null;
    for (const word of words) {
      if (phrase && word.x0 - phrase.x1 <= textHeight * 0.9 && !isCellToken(word.str) && !isCellToken(phrase.str)) {
        phrase.str += ` ${word.str}`;
        phrase.x1 = word.x1;
        phrase.y0 = Math.min(phrase.y0, word.y0);
        phrase.y1 = Math.max(phrase.y1, word.y1);
        phrase.confidence = Math.min(phrase.confidence, word.confidence);
      } else {
        if (phrase) items.push(phrase);
        phrase = { ...word };
      }
    }
    items.push(phrase);
  }
  return {
    items: items.map((item) => ({
      str: item.str,
      x: item.x0,
      y: -item.y0,
      width: item.x1 - item.x0,
      height: item.y1 - item.y0,
      confidence: item.confidence,
    })),
    textHeight,
  };
}

// Two OCR passes: with the ruled lines erased, day numbers and P/A marks read cleanly; with the lines kept,
// the cell borders keep stacked name / "S/O" lines apart, so names and categories are taken from that pass.
async function extractImageSource(buffer) {
  let prepared;
  try {
    prepared = await prepareImageForOcr(buffer);
  } catch {
    throw httpError(400, 'Could not open this image. Upload a PNG, JPG or WEBP photo of the sheet.');
  }
  const { createWorker } = require('tesseract.js');
  const worker = await createWorker('eng');
  let marksData;
  let textData;
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '6' });
    ({ data: marksData } = await worker.recognize(prepared.unruled, {}, { text: true, blocks: true }));
    await worker.setParameters({ tessedit_pageseg_mode: '4' });
    ({ data: textData } = await worker.recognize(prepared.ruled, {}, { blocks: true }));
  } finally {
    await worker.terminate();
  }

  const marks = ocrItems(marksData);
  const text = ocrItems(textData);
  const unit = Math.max(1, marks.textHeight * 0.35);
  const imageInfo = { buffer, binary: prepared.binary, width: prepared.width, height: prepared.height };
  const header = groupPdfLines(marks.items, unit).find((line) => (
    line.items.filter((item) => classifyHeader(item.str)?.type === 'day').length >= 5
  ));
  let items = marks.items;
  if (header) {
    const dayItems = header.items.filter((item) => classifyHeader(item.str)?.type === 'day');
    const spacing = (dayItems[dayItems.length - 1].x - dayItems[0].x) / Math.max(1, dayItems.length - 1);
    const textAreaEnd = dayItems[0].x - spacing / 2;
    const belowHeader = (item) => item.y < header.y - 1.5 * unit;
    const textItems = text.items.filter((item) => belowHeader(item) && item.x + item.width <= textAreaEnd);
    const markTextItems = marks.items.filter((item) => belowHeader(item) && item.x + item.width <= textAreaEnd);
    // Heavy borders can garble the bordered pass; then the names read better from the unruled pass.
    if (meanConfidence(markTextItems) > meanConfidence(textItems) + 10) {
      return { text: String(marksData.text || '').trim(), matrix: pdfPagesToMatrix([marks.items], { unit }), image: imageInfo };
    }
    const parentLines = marks.items.filter((item) => (
      belowHeader(item)
      && item.x + item.width <= textAreaEnd
      && /^S\/O\s+\S/.test(item.str)
      && !textItems.some((other) => Math.abs(other.y - item.y) <= 1.5 * unit)
    ));
    items = [
      ...marks.items.filter((item) => !belowHeader(item) || item.x + item.width / 2 >= textAreaEnd),
      ...textItems,
      ...parentLines,
    ];
  }
  return {
    text: String(marksData.text || '').trim(),
    matrix: items.length ? pdfPagesToMatrix([items], { unit }) : null,
    image: imageInfo,
  };
}

function meanConfidence(items) {
  const values = items.map((item) => item.confidence).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

const INK_RATIO = 0.02;
const MIN_INK_PIXELS = 12;
const CROP_HEIGHT = 56;
const MAX_CROPS = 500;

function cellBox(geometry, columnIndex, image, inset) {
  const centerX = geometry.columnCenters[columnIndex];
  const halfWidth = (Number.isFinite(geometry.daySpacing) ? geometry.daySpacing : geometry.halfHeight * 2) / 2;
  const halfHeight = Math.min(geometry.halfHeight, halfWidth * 2);
  const left = Math.max(0, Math.round(centerX - halfWidth * (1 - inset)));
  const right = Math.min(image.width, Math.round(centerX + halfWidth * (1 - inset)));
  const top = Math.max(0, Math.round(geometry.centerY - halfHeight * (1 - inset)));
  const bottom = Math.min(image.height, Math.round(geometry.centerY + halfHeight * (1 - inset)));
  return right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : null;
}

function hasInk(image, box) {
  let dark = 0;
  for (let y = box.top; y < box.top + box.height; y += 1) {
    for (let x = box.left; x < box.left + box.width; x += 1) {
      if (image.binary[y * image.width + x] < 128) dark += 1;
    }
  }
  return dark >= MIN_INK_PIXELS && dark / (box.width * box.height) >= INK_RATIO;
}

async function cropCell(sharp, gray, box) {
  const pixels = Buffer.alloc(box.width * box.height);
  for (let row = 0; row < box.height; row += 1) {
    const start = (box.top + row) * gray.width + box.left;
    gray.data.copy(pixels, row * box.width, start, start + box.width);
  }
  const png = await sharp(pixels, { raw: { width: box.width, height: box.height, channels: 1 } })
    .resize({ height: CROP_HEIGHT, withoutEnlargement: true })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

/**
 * For photographed registers: a blank OCR cell that still holds ink becomes `needs_review`, and every
 * reading that is not high confidence gets a crop of the original cell so the admin can check it.
 */
async function inspectImageCells(source, parsed) {
  const geometryRows = source.matrix?.geometry;
  if (!source.image || !geometryRows) return;
  const sharp = require('sharp');
  const { image } = source;
  const { data } = await sharp(image.buffer)
    .rotate()
    .grayscale()
    .resize({ width: image.width, height: image.height, fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const gray = { data, width: image.width };
  let crops = 0;

  for (const row of parsed.rows) {
    const geometry = geometryRows[row.matrixRow];
    if (!geometry) continue;
    for (const { index, day } of parsed.dayColumnIndexes) {
      let reading = row.days[day];
      if (!reading) {
        const inner = cellBox(geometry, index, image, 0.25);
        if (!inner || !hasInk(image, inner)) continue;
        reading = { status: 'needs_review', confidence: 'low', mark: '', suggested: null, reason: 'Mark could not be read' };
        row.days[day] = reading;
      }
      if (reading.confidence === 'high' || crops >= MAX_CROPS) continue;
      const outer = cellBox(geometry, index, image, -0.1);
      if (!outer) continue;
      reading.crop = await cropCell(sharp, gray, outer);
      crops += 1;
    }
  }
}

async function extractSheetSource(file) {
  const kind = fileKind(file);
  if (!kind) throw httpError(400, 'Upload a PDF, Excel, CSV, or image attendance sheet.');
  if (kind === 'spreadsheet') {
    const matrix = await extractSpreadsheetMatrix(file.buffer);
    return { kind, matrix, text: '', period: detectSheetPeriod(matrixPreambleText(matrix)) };
  }

  if (kind === 'pdf') {
    let pdf;
    try {
      pdf = await extractPdfSource(file.buffer);
    } catch {
      throw httpError(400, 'Could not open this PDF. Make sure it is not password protected or damaged.');
    }
    if (pdf.text.length < 20) {
      throw httpError(400, 'Could not read text from this PDF. It may be a scanned image; upload an Excel file or a clear photo of the sheet.');
    }
    return { kind, matrix: pdf.matrix || textToMatrix(pdf.text), hasTable: Boolean(pdf.matrix), text: pdf.text, period: detectSheetPeriod(pdf.text) };
  }

  const image = await extractImageSource(file.buffer);
  if (!image.text) throw httpError(400, 'Could not read text from this photo. Upload a clearer, well-lit photo taken straight on.');
  return {
    kind,
    matrix: image.matrix || textToMatrix(image.text),
    hasTable: Boolean(image.matrix),
    text: image.text,
    period: detectSheetPeriod(image.text),
    image: image.matrix ? image.image : null,
  };
}

async function extractRowsFromFile(file, date) {
  const source = await extractSheetSource(file);
  const isTable = source.kind === 'spreadsheet' || source.hasTable;
  return {
    rows: isTable ? parseSheetMatrix(source.matrix, date) : parseLooseEmployeeLines(source.text, date),
    period: source.period,
  };
}

function parseSheetMatrixMonth(matrix, month, daysInMonth, { symbols } = {}) {
  const header = findHeaderRow(matrix);
  if (!header) return { rows: [], dayColumns: [], dayColumnIndexes: [] };
  let nameIndex = -1;
  let parentIndex = -1;
  const dayColumns = [];
  header.columns.forEach((column, index) => {
    if (!column) return;
    if (column.type === 'name') nameIndex = index;
    if (column.type === 'parent') parentIndex = index;
    if (column.type === 'day' && column.day <= daysInMonth) dayColumns.push({ index, day: column.day });
    if (column.type === 'dateday' && column.date.startsWith(`${month}-`)) {
      const day = Number(column.date.slice(8, 10));
      if (day <= daysInMonth) dayColumns.push({ index, day });
    }
  });
  if (nameIndex < 0) nameIndex = inferNameColumn(matrix, header.index);

  const geometry = matrix.geometry || [];
  const rows = [];
  for (let matrixRow = header.index + 1; matrixRow < matrix.length; matrixRow += 1) {
    const cells = matrix[matrixRow] || [];
    const extracted = extractNameAndParent(cells[nameIndex], parentIndex >= 0 ? cells[parentIndex] : '');
    if (!extracted.name || /^(TOTAL|GRAND TOTAL|TOTAL MANDAYS)$/.test(extracted.name)) continue;
    const days = {};
    for (const { index, day } of dayColumns) {
      const confidence = geometry[matrixRow]?.confidence?.[index];
      const reading = interpretMark(cells[index], { symbols, ocrConfidence: Number.isFinite(confidence) ? confidence : null });
      if (reading) days[day] = reading;
    }
    rows.push({ extractedName: extracted.name, extractedParentName: extracted.parentName, days, matrixRow });
  }
  return {
    rows,
    dayColumns: [...new Set(dayColumns.map(({ day }) => day))].sort((a, b) => a - b),
    dayColumnIndexes: dayColumns,
  };
}

async function readMonthRegister(source, { month, daysInMonth, symbols }) {
  const parsed = parseSheetMatrixMonth(source.matrix, month, daysInMonth, { symbols });
  if (parsed.dayColumns.length > 0) await inspectImageCells(source, parsed);
  return parsed;
}

module.exports = {
  detectSheetPeriod,
  extractNameAndParent,
  extractRowsFromFile,
  extractSheetSource,
  interpretMark,
  normalizeMarkToken,
  parseSheetMatrixMonth,
  pdfPagesToMatrix,
  fileKind,
  periodFromParts,
  matchExtractedEmployee,
  normalizePersonName,
  parseSheetMatrix,
  parseStatusToken,
  readMonthRegister,
};
