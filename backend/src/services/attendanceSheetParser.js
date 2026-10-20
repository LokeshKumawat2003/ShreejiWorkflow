const { httpError } = require('../utils/httpError');

const PARENT_LABEL = /\b(?:S\/O|D\/O|W\/O|C\/O|S\.O\.|SON OF|DAUGHTER OF|WIFE OF)\s*:?\s*/i;
const PRESENT_TOKENS = new Set(['P', 'PR', 'PRESENT', '1', 'Y', 'YES']);
const ABSENT_TOKENS = new Set(['A', 'AB', 'ABS', 'ABSENT', '0', 'N', 'NO']);

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

function parseStatusToken(value) {
  const token = cellText(value).replace(/[.]/g, '').toUpperCase();
  if (!token) return null;
  if (PRESENT_TOKENS.has(token)) return 'present';
  if (ABSENT_TOKENS.has(token)) return 'absent';
  return null;
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
      const trailing = cells.slice(nameIndex + 1).map(parseStatusToken).filter(Boolean);
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

async function extractPdfText(buffer) {
  const pdfParse = require('pdf-parse');
  const result = await pdfParse(buffer);
  return String(result.text || '').trim();
}

async function extractImageText(buffer) {
  const { createWorker } = require('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(buffer);
    return String(result.data?.text || '').trim();
  } finally {
    await worker.terminate();
  }
}

async function extractSheetSource(file) {
  const kind = fileKind(file);
  if (!kind) throw httpError(400, 'Upload a PDF, Excel, CSV, or image attendance sheet.');
  if (kind === 'spreadsheet') {
    const matrix = await extractSpreadsheetMatrix(file.buffer);
    return { kind, matrix, text: '', period: detectSheetPeriod(matrixPreambleText(matrix)) };
  }

  const text = kind === 'pdf' ? await extractPdfText(file.buffer) : await extractImageText(file.buffer);
  if (kind === 'pdf' && text.length < 20) {
    throw httpError(400, 'Could not read text from this PDF. Upload an Excel file or a clear photo of the sheet.');
  }
  if (!text) throw httpError(400, 'Could not read text from this attendance sheet.');
  return { kind, matrix: textToMatrix(text), text, period: detectSheetPeriod(text) };
}

async function extractRowsFromFile(file, date) {
  const source = await extractSheetSource(file);
  return {
    rows: source.kind === 'spreadsheet' ? parseSheetMatrix(source.matrix, date) : parseLooseEmployeeLines(source.text, date),
    period: source.period,
  };
}

function parseSheetMatrixMonth(matrix, month, daysInMonth) {
  const header = findHeaderRow(matrix);
  if (!header) return { rows: [], dayColumns: [] };
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

  const rows = [];
  for (const row of matrix.slice(header.index + 1)) {
    const cells = row || [];
    const extracted = extractNameAndParent(cells[nameIndex], parentIndex >= 0 ? cells[parentIndex] : '');
    if (!extracted.name || /^(TOTAL|GRAND TOTAL|TOTAL MANDAYS)$/.test(extracted.name)) continue;
    const days = {};
    for (const { index, day } of dayColumns) {
      const status = parseStatusToken(cells[index]);
      if (status) days[day] = status;
    }
    rows.push({ extractedName: extracted.name, extractedParentName: extracted.parentName, days });
  }
  return { rows, dayColumns: [...new Set(dayColumns.map(({ day }) => day))].sort((a, b) => a - b) };
}

module.exports = {
  detectSheetPeriod,
  extractNameAndParent,
  extractRowsFromFile,
  extractSheetSource,
  parseSheetMatrixMonth,
  fileKind,
  periodFromParts,
  matchExtractedEmployee,
  normalizePersonName,
  parseSheetMatrix,
  parseStatusToken,
};
