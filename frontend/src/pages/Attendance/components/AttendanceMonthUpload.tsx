import { ChevronDownIcon, EditIcon, SearchIcon } from '@chakra-ui/icons';
import {
  Alert,
  Badge,
  Box,
  Button,
  ButtonGroup,
  HStack,
  IconButton,
  Image,
  Menu,
  MenuButton,
  MenuDivider,
  MenuGroup,
  MenuItem,
  MenuList,
  Input,
  InputGroup,
  InputLeftElement,
  ModalBody,
  ModalFooter,
  Select,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
} from '@chakra-ui/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ActionButton from '../../../components/ui/ActionButton';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import FileDropzone from '../../../components/ui/FileDropzone';
import Pagination from '../../../components/ui/Pagination';
import { ListSkeleton } from '../../../components/ui/Skeletons';
import { ApiError } from '../../../services/api';
import {
  bulkMarkAttendance,
  parseAttendanceMonth,
  type AttendanceMarkDetail,
  type AttendanceMonthParseResponse,
  type AttendanceMonthParseRow,
  type AttendanceParseEmployee,
  type AttendanceStatus,
  type UploadMarkStatus,
} from '../../../services/attendanceService';
import {
  ATTENDANCE_STATUS_META,
  ATTENDANCE_STATUS_OPTIONS,
  ATTENDANCE_STATUSES,
  CONFIDENCE_META,
  statusCode,
  statusLabel,
  statusStyle,
} from '../utils/attendanceStatus';
import { downloadMonthUploadSheet } from '../utils/attendanceUploadSheet';

type MonthRow = AttendanceMonthParseRow & { key: number; overrides: (AttendanceStatus | null)[] };
type MonthFilter = 'all' | 'attention' | 'review' | 'matched' | 'fuzzy' | 'unmatched' | 'saved' | 'edited';
type Brush = 'cycle' | AttendanceStatus | 'clear';
type ViewMode = 'grid' | 'list';
type ListFilter = 'review' | 'uncertain' | 'all';
type Entry = { row: MonthRow; index: number; mark: UploadMarkStatus | null; detail: AttendanceMarkDetail | null };

type AttendanceMonthUploadProps = {
  initialMonth: string;
  organizationId: string;
  locationId: string;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
  onSaved: (result: { saved: number; updated: number; skippedDuplicates: number; skippedInvalid: number; skippedBlocked?: number }) => void;
};

const PAGE_SIZE = 10;
const LIST_PAGE_SIZE = 15;

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber) return month;
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(year, monthNumber - 1, 1));
}

function dayLabel(month: string, day: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date(year, monthNumber - 1, day));
}

function isSundayOf(month: string, day: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber - 1, day).getDay() === 0;
}

function formatDayList(days: number[]) {
  if (days.length === 0) return '';
  const ranges: string[] = [];
  let start = days[0];
  let previous = days[0];
  for (const day of [...days.slice(1), Number.NaN]) {
    if (day === previous + 1) {
      previous = day;
      continue;
    }
    ranges.push(start === previous ? String(start) : `${start}-${previous}`);
    start = day;
    previous = day;
  }
  return ranges.join(', ');
}

function employeeLabel(employee: Pick<AttendanceParseEmployee, 'employeeName' | 'parentName'>) {
  return employee.parentName ? `${employee.employeeName} — ${employee.parentName}` : employee.employeeName;
}

function isSaveable(mark: UploadMarkStatus | null): mark is AttendanceStatus {
  return Boolean(mark) && mark !== 'needs_review';
}

function newMarkCount(row: MonthRow) {
  return row.marks.filter((mark, index) => isSaveable(mark) && !row.existing[index]).length;
}

function reviewCount(row: MonthRow) {
  return row.marks.filter((mark, index) => mark === 'needs_review' && !row.existing[index]).length;
}

function editedCount(row: MonthRow) {
  return row.overrides.filter((override, index) => override && override !== row.existing[index]).length;
}

function rowMatchesFilter(row: MonthRow, filter: MonthFilter) {
  if (filter === 'all') return true;
  if (filter === 'edited') return editedCount(row) > 0;
  if (filter === 'saved') return row.existing.some(Boolean);
  if (filter === 'review') return reviewCount(row) > 0;
  if (filter === 'unmatched') return !row.employeeId;
  if (filter === 'attention') return !row.employeeId || row.match !== 'exact' || reviewCount(row) > 0;
  if (filter === 'fuzzy') return Boolean(row.employeeId) && (row.match === 'fuzzy' || row.match === 'ambiguous');
  return Boolean(row.employeeId) && row.match === 'exact';
}

function rowMatchesSearch(row: MonthRow, query: string) {
  return !query || [
    row.extractedName,
    row.extractedParentName,
    row.employeeName,
    row.parentName,
  ].some((value) => (value || '').toLowerCase().includes(query));
}

function entryMatchesFilter(entry: Entry, filter: ListFilter) {
  if (filter === 'all') return true;
  if (entry.mark === 'needs_review') return true;
  return filter === 'uncertain' && Boolean(entry.detail && entry.detail.confidence !== 'high');
}

function applyBrush(brush: Brush, mark: UploadMarkStatus | null): AttendanceStatus | null {
  if (brush === 'clear') return null;
  if (brush !== 'cycle') return brush;
  if (mark === 'present') return 'absent';
  if (mark === 'absent') return null;
  return 'present';
}

function flagFor(row: MonthRow) {
  if (!row.employeeId) return { label: 'Unmatched', color: 'red' };
  if (row.match === 'fuzzy' || row.match === 'ambiguous') return { label: 'Check name', color: 'yellow' };
  if (reviewCount(row) > 0) return { label: `${reviewCount(row)} to review`, color: 'orange' };
  return { label: 'Matched', color: 'green' };
}

function MarkDetailTooltip({ detail, mark }: { detail: AttendanceMarkDetail | null; mark: UploadMarkStatus | null }) {
  return (
    <Stack spacing={1} fontSize="xs" py={1}>
      {detail?.crop ? (
        <Box bg="white" p={1} borderRadius="md" alignSelf="flex-start">
          <Image src={detail.crop} alt="Original cell from the uploaded register" maxH="56px" />
        </Box>
      ) : null}
      <Text>{`Read as: ${detail?.mark ? `"${detail.mark}"` : detail ? 'unreadable mark' : 'blank'}`}</Text>
      <Text>{`Status: ${statusLabel(mark)}`}</Text>
      {detail ? <Text>{`Confidence: ${CONFIDENCE_META[detail.confidence].label}`}</Text> : null}
      {detail?.reason ? <Text>{detail.reason}</Text> : null}
      {detail?.suggested && mark === 'needs_review' ? <Text>{`Suggested: ${statusLabel(detail.suggested)}`}</Text> : null}
    </Stack>
  );
}

function AttendanceMonthUpload({
  initialMonth,
  organizationId,
  locationId,
  onClose,
  onBusyChange,
  onSaved,
}: AttendanceMonthUploadProps) {
  const parseRequestRef = useRef(0);
  const [month, setMonth] = useState(initialMonth);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AttendanceMonthParseResponse | null>(null);
  const [rows, setRows] = useState<MonthRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MonthFilter>('all');
  const [page, setPage] = useState(1);
  const [brush, setBrush] = useState<Brush>('cycle');
  const [view, setView] = useState<ViewMode>('grid');
  const [listFilter, setListFilter] = useState<ListFilter>('review');
  const [listPage, setListPage] = useState(1);
  const [confirmBlankAbsent, setConfirmBlankAbsent] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);

  useEffect(() => {
    onBusyChange(isParsing || isSaving);
  }, [isParsing, isSaving, onBusyChange]);

  const query = search.trim().toLowerCase();
  const filteredRows = useMemo(
    () => rows.filter((row) => rowMatchesFilter(row, filter) && rowMatchesSearch(row, query)),
    [rows, query, filter],
  );
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstShown = filteredRows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(currentPage * PAGE_SIZE, filteredRows.length);
  const filterCounts = useMemo(() => {
    const count = (value: MonthFilter) => rows.filter((row) => rowMatchesFilter(row, value)).length;
    return {
      all: rows.length,
      attention: count('attention'),
      review: count('review'),
      matched: count('matched'),
      fuzzy: count('fuzzy'),
      unmatched: count('unmatched'),
      saved: count('saved'),
      edited: count('edited'),
    };
  }, [rows]);

  const entries = useMemo<Entry[]>(() => rows.flatMap((row) => row.marks.flatMap((mark, index) => (
    !row.existing[index] && (mark || row.details[index]) ? [{ row, index, mark, detail: row.details[index] }] : []
  ))), [rows]);
  const listEntries = useMemo(
    () => entries.filter((entry) => entryMatchesFilter(entry, listFilter) && rowMatchesSearch(entry.row, query)),
    [entries, listFilter, query],
  );
  const listTotalPages = Math.max(1, Math.ceil(listEntries.length / LIST_PAGE_SIZE));
  const currentListPage = Math.min(listPage, listTotalPages);
  const listPageEntries = listEntries.slice((currentListPage - 1) * LIST_PAGE_SIZE, currentListPage * LIST_PAGE_SIZE);

  const matchedRows = useMemo(() => rows.filter((row) => row.employeeId), [rows]);
  const newCount = matchedRows.reduce((sum, row) => sum + newMarkCount(row), 0);
  const updateCount = matchedRows.reduce((sum, row) => sum + editedCount(row), 0);
  const needsReviewCount = matchedRows.reduce((sum, row) => sum + reviewCount(row), 0);
  const uncertainCount = entries.filter((entry) => entry.row.employeeId && entry.mark !== 'needs_review' && entry.detail && entry.detail.confidence !== 'high').length;
  const saveableCount = newCount + updateCount;
  const alreadySavedCount = useMemo(
    () => rows.reduce((sum, row) => sum + row.existing.filter(Boolean).length, 0),
    [rows],
  );
  const days = result ? Array.from({ length: result.lastImportableDay }, (_, index) => index + 1) : [];
  const sheetDays = useMemo(() => new Set(result?.sheetDays || []), [result]);
  const isBlankCell = (row: MonthRow, index: number) => (
    sheetDays.has(index + 1)
    && !isSundayOf(month, index + 1)
    && !row.marks[index]
    && !row.details[index]
    && !row.existing[index]
  );
  const blankCount = matchedRows.reduce((sum, row) => sum + row.marks.filter((_, index) => isBlankCell(row, index)).length, 0);
  const hasActiveFilters = Boolean(search.trim()) || filter !== 'all';

  async function readSheet(sheet: File, sheetMonth: string) {
    const requestId = parseRequestRef.current + 1;
    parseRequestRef.current = requestId;
    setIsParsing(true);
    setError('');
    setResult(null);
    setRows([]);
    setPage(1);
    setListPage(1);
    try {
      const parsed = await parseAttendanceMonth(sheet, { month: sheetMonth, organizationId, locationId });
      if (requestId !== parseRequestRef.current) return;
      setResult(parsed);
      setRows(parsed.rows.map((row, index) => ({ ...row, key: index, overrides: row.existing.map(() => null) })));
      if (parsed.rows.length === 0) setError('No employee rows were found in this sheet.');
    } catch (caught) {
      if (requestId !== parseRequestRef.current) return;
      setError(caught instanceof ApiError ? caught.message : 'Unable to read the attendance sheet.');
    } finally {
      if (requestId === parseRequestRef.current) setIsParsing(false);
    }
  }

  function handleFileChange(sheet?: File) {
    if (!sheet) return;
    setFile(sheet);
    void readSheet(sheet, month);
  }

  function handleMonthChange(nextMonth: string) {
    if (!nextMonth) return;
    setMonth(nextMonth);
    if (file) void readSheet(file, nextMonth);
  }

  async function downloadSheet() {
    setIsDownloading(true);
    setError('');
    try {
      await downloadMonthUploadSheet({ organizationId, locationId }, month);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to download the attendance sheet for this location.');
    } finally {
      setIsDownloading(false);
    }
  }

  function updateRow(key: number, patch: Partial<MonthRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function setMark(row: MonthRow, dayIndex: number, mark: UploadMarkStatus | null) {
    const marks = [...row.marks];
    marks[dayIndex] = mark;
    updateRow(row.key, { marks });
  }

  function paintSaved(row: MonthRow, dayIndex: number) {
    const saved = row.existing[dayIndex];
    if (!saved || brush === 'clear') return;
    const current = row.overrides[dayIndex] || saved;
    const next: AttendanceStatus = brush === 'cycle' ? (current === 'present' ? 'absent' : 'present') : brush;
    const overrides = [...row.overrides];
    overrides[dayIndex] = next === saved ? null : next;
    updateRow(row.key, { overrides });
  }

  function setRowMarks(row: MonthRow, status: AttendanceStatus | null) {
    updateRow(row.key, {
      marks: row.marks.map((mark, index) => (row.existing[index] || isSundayOf(month, index + 1) ? mark : status)),
      overrides: row.existing.map((saved) => (saved && status && status !== saved ? status : null)),
    });
  }

  function resetRow(row: MonthRow) {
    const original = result?.rows[row.key];
    if (!original) return;
    updateRow(row.key, {
      marks: [...original.marks],
      overrides: row.existing.map(() => null),
    });
  }

  function mapAllMarks(transform: (row: MonthRow, mark: UploadMarkStatus | null, index: number) => UploadMarkStatus | null) {
    setRows((current) => current.map((row) => ({
      ...row,
      marks: row.marks.map((mark, index) => (row.existing[index] ? mark : transform(row, mark, index))),
    })));
  }

  function resolveReviews(status: AttendanceStatus | null | 'suggested') {
    mapAllMarks((row, mark, index) => {
      if (mark !== 'needs_review') return mark;
      if (status === 'suggested') return row.details[index]?.suggested || mark;
      return status;
    });
  }

  function markBlanksAbsent() {
    mapAllMarks((row, mark, index) => (row.employeeId && isBlankCell(row, index) ? 'absent' : mark));
    setConfirmBlankAbsent(false);
  }

  function clearFilters() {
    setSearch('');
    setFilter('all');
    setPage(1);
    setListPage(1);
  }

  function buildEntries() {
    if (!result) return [];
    const dateFor = (index: number) => `${result.month}-${String(index + 1).padStart(2, '0')}`;
    return rows.flatMap((row) => {
      if (!row.employeeId) return [];
      const employeeId = row.employeeId;
      return row.marks.flatMap((mark, index) => {
        const saved = row.existing[index];
        const override = row.overrides[index];
        const sourceMark = row.details[index]?.mark || undefined;
        if (saved) {
          return override && override !== saved
            ? [{ employeeId, status: override, date: dateFor(index), replace: true, mark: sourceMark }]
            : [];
        }
        return isSaveable(mark) ? [{ employeeId, status: mark, date: dateFor(index), mark: sourceMark }] : [];
      });
    });
  }

  function summarizeEntries() {
    const counts = new Map<AttendanceStatus, number>();
    for (const entry of buildEntries()) counts.set(entry.status, (counts.get(entry.status) || 0) + 1);
    return ATTENDANCE_STATUSES.filter((status) => counts.has(status)).map((status) => ({ status, count: counts.get(status) || 0 }));
  }

  async function saveRows() {
    const entries = buildEntries();
    if (!result || entries.length === 0) return;
    setIsSaving(true);
    setError('');
    try {
      const saved = await bulkMarkAttendance({
        organizationId,
        locationId,
        entries,
        ...(result.uploadId ? { uploadId: result.uploadId } : {}),
      });
      setConfirmSave(false);
      onSaved(saved);
    } catch (caught) {
      setConfirmSave(false);
      setError(caught instanceof ApiError ? caught.message : 'Unable to save attendance from this sheet.');
      setIsSaving(false);
    }
  }

  function renderNewCell(row: MonthRow, day: number) {
    const index = day - 1;
    const mark = row.marks[index];
    const detail = row.details[index];
    const style = statusStyle(mark);
    const uncertain = Boolean(detail && detail.confidence !== 'high' && mark !== 'needs_review');
    const edited = mark !== (result?.rows[row.key]?.marks[index] ?? null);
    const cell = (
      <Box
        as="button"
        type="button"
        aria-label={`Day ${day} for ${row.extractedName}: ${statusLabel(mark)}`}
        minW="24px"
        h="24px"
        px={0.5}
        borderRadius="4px"
        fontSize="10px"
        fontWeight="700"
        border={mark === 'needs_review' ? '2px solid' : uncertain ? '1px dashed' : '1px solid'}
        borderColor={mark === 'needs_review' ? style.border : uncertain ? 'yellow.500' : mark ? 'transparent' : 'slate.200'}
        bg={style.bg}
        color={mark ? style.color : 'slate.300'}
        outline={edited ? '1px solid' : undefined}
        outlineColor="purple.400"
        _hover={{ bg: style.hover }}
        onClick={() => setMark(row, index, applyBrush(brush, mark))}
      >
        {statusCode(mark) || '·'}
      </Box>
    );
    return (
      <Td key={day} px={0} textAlign="center" bg={mark === 'needs_review' ? 'yellow.50' : undefined}>
        {detail || mark ? (
          <Tooltip label={<MarkDetailTooltip detail={detail} mark={mark} />} openDelay={250} hasArrow placement="top">
            {cell}
          </Tooltip>
        ) : cell}
      </Td>
    );
  }

  function renderSavedCell(row: MonthRow, day: number, saved: AttendanceStatus) {
    const index = day - 1;
    const override = row.overrides[index];
    const changed = Boolean(override && override !== saved);
    const shown = override || saved;
    return (
      <Td key={day} px={0} textAlign="center" bg="orange.50">
        <Box
          as="button"
          type="button"
          aria-label={`Day ${day} for ${row.extractedName}: saved ${statusLabel(saved)}${changed ? `, will change to ${statusLabel(shown)}` : ''}`}
          title={changed ? `Saved as ${statusLabel(saved)}. Will be updated to ${statusLabel(shown)}.` : `Already saved: ${statusLabel(saved)}. Click to change.`}
          minW="24px"
          h="24px"
          px={0.5}
          borderRadius="4px"
          fontSize="10px"
          fontWeight="700"
          border={changed ? '2px solid' : '1px dashed'}
          borderColor={changed ? 'purple.500' : 'orange.200'}
          bg={changed ? 'purple.50' : 'transparent'}
          color={changed ? ATTENDANCE_STATUS_META[shown].color : 'slate.400'}
          onClick={() => paintSaved(row, index)}
        >
          {ATTENDANCE_STATUS_META[shown].code}
        </Box>
      </Td>
    );
  }

  function renderGrid() {
    if (!result) return null;
    return (
      <>
        <TableContainer border="1px solid" borderColor="slate.100" borderRadius="md" overflowX="auto">
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th fontSize="xs" minW="170px">Extracted name</Th>
                <Th fontSize="xs" minW="220px">Matched employee</Th>
                {days.map((day) => (
                  <Th key={day} fontSize="xs" px={0} textAlign="center" minW="28px" color={isSundayOf(month, day) ? 'orange.500' : undefined}>{day}</Th>
                ))}
                <Th fontSize="xs" textAlign="center">Changes</Th>
                <Th fontSize="xs">Flag</Th>
                <Th fontSize="xs" textAlign="right">Edit</Th>
              </Tr>
            </Thead>
            <Tbody>
              {pageRows.length === 0 ? (
                <Tr>
                  <Td colSpan={days.length + 5} textAlign="center" py={8} color="slate.500">No rows match these filters.</Td>
                </Tr>
              ) : null}
              {pageRows.map((row) => {
                const flag = flagFor(row);
                return (
                  <Tr key={row.key} bg={row.employeeId ? undefined : 'red.50'}>
                    <Td>
                      <Text fontWeight="600" fontSize="sm">{row.extractedName || '—'}</Text>
                      <Text fontSize="xs" color="slate.500">{row.extractedParentName || 'Father name not found'}</Text>
                    </Td>
                    <Td>
                      <Select
                        aria-label={`Match employee for ${row.extractedName || 'extracted row'}`}
                        size="sm"
                        value={row.employeeId || ''}
                        borderColor={row.employeeId ? undefined : 'red.300'}
                        onChange={(event) => {
                          const employee = result.employees.find((item) => item.employeeId === event.target.value);
                          updateRow(row.key, {
                            employeeId: employee?.employeeId || null,
                            employeeName: employee?.employeeName || '',
                            parentName: employee?.parentName || '',
                            match: employee ? 'exact' : 'unmatched',
                            existing: row.employeeId === employee?.employeeId
                              ? row.existing
                              : row.existing.map(() => null),
                            overrides: row.existing.map(() => null),
                          });
                        }}
                      >
                        <option value="">Select employee</option>
                        {result.employees.map((employee) => (
                          <option key={employee.employeeId} value={employee.employeeId}>
                            {employeeLabel(employee)}
                          </option>
                        ))}
                      </Select>
                    </Td>
                    {days.map((day) => {
                      if (isSundayOf(month, day)) {
                        return <Td key={day} px={0} bg="orange.50" title="Sunday · weekly off" />;
                      }
                      const saved = row.existing[day - 1];
                      return saved ? renderSavedCell(row, day, saved) : renderNewCell(row, day);
                    })}
                    <Td textAlign="center" fontWeight="600">{newMarkCount(row) + editedCount(row)}</Td>
                    <Td><Badge colorScheme={flag.color}>{flag.label}</Badge></Td>
                    <Td textAlign="right">
                      <Menu placement="bottom-end" isLazy>
                        <MenuButton
                          as={IconButton}
                          aria-label={`Edit options for ${row.extractedName}`}
                          title="Edit row"
                          icon={<EditIcon />}
                          size="sm"
                          variant="ghost"
                        />
                        <MenuList fontSize="sm" maxH="320px" overflowY="auto">
                          {ATTENDANCE_STATUSES.map((status) => (
                            <MenuItem key={status} onClick={() => setRowMarks(row, status)}>
                              {`Mark all days ${ATTENDANCE_STATUS_META[status].label}`}
                            </MenuItem>
                          ))}
                          <MenuDivider />
                          <MenuItem onClick={() => setRowMarks(row, null)}>Clear new days</MenuItem>
                          <MenuItem onClick={() => resetRow(row)}>Reset to sheet values</MenuItem>
                        </MenuList>
                      </Menu>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </TableContainer>
        <HStack mt={3} justify="space-between" flexWrap="wrap" gap={3}>
          <Text fontSize="sm" color="slate.500">
            {`Showing ${firstShown}-${lastShown} of ${filteredRows.length}`}
            {filteredRows.length !== rows.length ? ` (filtered from ${rows.length})` : ''}
          </Text>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} isDisabled={isSaving} />
        </HStack>
      </>
    );
  }

  function renderList() {
    if (!result) return null;
    return (
      <>
        <TableContainer border="1px solid" borderColor="slate.100" borderRadius="md" overflowX="auto">
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th fontSize="xs">Employee</Th>
                <Th fontSize="xs">Date</Th>
                <Th fontSize="xs">Original mark</Th>
                <Th fontSize="xs" minW="190px">Detected status</Th>
                <Th fontSize="xs">Confidence</Th>
              </Tr>
            </Thead>
            <Tbody>
              {listPageEntries.length === 0 ? (
                <Tr>
                  <Td colSpan={5} textAlign="center" py={8} color="slate.500">
                    {listFilter === 'review' ? 'Nothing left to review.' : 'No entries match these filters.'}
                  </Td>
                </Tr>
              ) : null}
              {listPageEntries.map(({ row, index, mark, detail }) => {
                const original = result.rows[row.key]?.marks[index] ?? null;
                return (
                  <Tr key={`${row.key}-${index}`} bg={mark === 'needs_review' ? 'yellow.50' : !row.employeeId ? 'red.50' : undefined}>
                    <Td>
                      <Text fontWeight="600" fontSize="sm">{row.employeeName || row.extractedName}</Text>
                      {!row.employeeId ? <Text fontSize="xs" color="red.500">Not matched to an employee — not saved</Text> : null}
                    </Td>
                    <Td whiteSpace="nowrap">{dayLabel(month, index + 1)}</Td>
                    <Td>
                      <HStack spacing={2}>
                        {detail?.crop ? (
                          <Box border="1px solid" borderColor="slate.200" borderRadius="md" p={0.5} bg="white">
                            <Image src={detail.crop} alt={`Original mark for ${row.extractedName} on day ${index + 1}`} maxH="44px" />
                          </Box>
                        ) : null}
                        <Text fontSize="sm" fontFamily="mono">{detail?.mark || (detail ? 'Handwritten mark' : '—')}</Text>
                      </HStack>
                      {detail?.reason ? <Text fontSize="xs" color="slate.500">{detail.reason}</Text> : null}
                    </Td>
                    <Td>
                      <Select
                        aria-label={`Status for ${row.extractedName} on day ${index + 1}`}
                        size="sm"
                        value={mark || ''}
                        borderColor={mark === 'needs_review' ? 'yellow.500' : undefined}
                        onChange={(event) => setMark(row, index, (event.target.value || null) as UploadMarkStatus | null)}
                      >
                        <option value="">Not marked (skip)</option>
                        <option value="needs_review" disabled={mark !== 'needs_review'}>Needs Review</option>
                        {ATTENDANCE_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                      {mark === 'needs_review' && detail?.suggested ? (
                        <Button size="xs" variant="link" colorScheme="brand" mt={1} onClick={() => setMark(row, index, detail.suggested)}>
                          {`Use suggestion: ${statusLabel(detail.suggested)}`}
                        </Button>
                      ) : null}
                      {mark !== original ? <Text fontSize="xs" color="purple.600" mt={1}>{`Corrected from ${statusLabel(original)}`}</Text> : null}
                    </Td>
                    <Td>
                      {detail ? (
                        <Badge colorScheme={CONFIDENCE_META[detail.confidence].colorScheme}>{CONFIDENCE_META[detail.confidence].label}</Badge>
                      ) : <Text fontSize="xs" color="slate.400">Manual</Text>}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </TableContainer>
        <HStack mt={3} justify="space-between" flexWrap="wrap" gap={3}>
          <Text fontSize="sm" color="slate.500">
            {`${listEntries.length} ${listEntries.length === 1 ? 'entry' : 'entries'} · days already saved are not listed`}
          </Text>
          <Pagination currentPage={currentListPage} totalPages={listTotalPages} onPageChange={setListPage} isDisabled={isSaving} />
        </HStack>
      </>
    );
  }

  return (
    <>
      <ModalBody>
        <HStack
          mb={4}
          px={3}
          py={2}
          borderRadius="md"
          bg="brand.50"
          border="1px solid"
          borderColor="brand.100"
          justify="space-between"
          align="center"
          flexWrap="wrap"
          gap={3}
        >
          <Box>
            <Text fontSize="sm" color="slate.800">
              Importing every filled day of <Text as="span" fontWeight="700">{monthLabel(month)}</Text>
            </Text>
            <Text mt={1} fontSize="xs" color="slate.500">
              Days after today are skipped. Days already saved are kept and not overwritten. Blank cells stay not marked.
            </Text>
          </Box>
          <Input
            aria-label="Import attendance for month"
            type="month"
            value={month}
            max={currentMonth()}
            h="40px"
            maxW="190px"
            fontSize="sm"
            bg="white"
            isDisabled={isParsing || isSaving}
            onChange={(event) => handleMonthChange(event.target.value)}
          />
        </HStack>
        <HStack mb={2} justify="space-between" flexWrap="wrap" gap={2}>
          <Text fontSize="xs" color="slate.500">
            Monthly register with day columns 1-31: Excel, CSV, PDF or a photo of a printed or handwritten register
          </Text>
          <Button
            variant="link"
            size="sm"
            colorScheme="brand"
            isLoading={isDownloading}
            loadingText="Preparing..."
            isDisabled={isParsing || isSaving}
            onClick={() => void downloadSheet()}
          >
            Download this location's Excel
          </Button>
        </HStack>
        <FileDropzone
          label="Monthly attendance sheet file"
          accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp"
          hint="Photo (JPG, PNG, WEBP), PDF, Excel or CSV"
          file={file}
          isDisabled={isParsing || isSaving}
          onFileSelect={handleFileChange}
          details={[
            isParsing ? 'Reading sheet... photos can take up to a minute' : '',
            result?.sheetPeriod ? `Sheet period: ${result.sheetPeriod.label}` : '',
            result ? `Day columns found: ${formatDayList(result.sheetDays)}` : '',
          ].filter(Boolean).join(' · ')}
        />
        {result?.warning ? <Alert mt={4} status="warning">{result.warning}</Alert> : null}
        {result && result.skippedFutureDays.length > 0 ? (
          <Alert mt={4} status="info">
            {`Days ${formatDayList(result.skippedFutureDays)} are after today and were skipped. Upload again after those days to import them.`}
          </Alert>
        ) : null}
        {needsReviewCount > 0 ? (
          <Alert mt={4} status="warning">
            {`${needsReviewCount} ${needsReviewCount === 1 ? 'mark needs' : 'marks need'} review: unclear, overwritten or unrecognised marks are never guessed. Open "Review list" to compare each with its original cell, or use Bulk corrections. Unresolved marks are not saved.`}
          </Alert>
        ) : null}
        {error ? <Alert mt={4} status="error">{error}</Alert> : null}

        {isParsing ? (
          <ListSkeleton rows={6} rowHeight="36px" py={5} />
        ) : result && rows.length > 0 ? (
          <>
            <HStack mt={4} spacing={3} flexWrap="wrap">
              <Badge colorScheme="green" px={2} py={1}>{`${newCount} new marks`}</Badge>
              <Badge colorScheme="yellow" px={2} py={1}>{`${needsReviewCount} need review`}</Badge>
              <Badge colorScheme="gray" px={2} py={1}>{`${uncertainCount} medium confidence`}</Badge>
              <Badge colorScheme="purple" px={2} py={1}>{`${updateCount} edits to saved days`}</Badge>
              <Badge colorScheme="orange" px={2} py={1}>{`${alreadySavedCount} already saved`}</Badge>
              <Badge colorScheme="gray" variant="outline" px={2} py={1}>{`${blankCount} blank cells`}</Badge>
            </HStack>
            <HStack mt={3} mb={3} spacing={3} flexWrap="wrap" align="flex-end">
              <ButtonGroup size="sm" isAttached variant="outline">
                <Button h="36px" variant={view === 'grid' ? 'solid' : 'outline'} colorScheme={view === 'grid' ? 'brand' : undefined} onClick={() => setView('grid')}>
                  Register grid
                </Button>
                <Button h="36px" variant={view === 'list' ? 'solid' : 'outline'} colorScheme={view === 'list' ? 'brand' : undefined} onClick={() => setView('list')}>
                  {`Review list${needsReviewCount ? ` (${needsReviewCount})` : ''}`}
                </Button>
              </ButtonGroup>
              <InputGroup flex="1" minW="200px" maxW="300px">
                <InputLeftElement pointerEvents="none" color="slate.400" h="36px"><SearchIcon /></InputLeftElement>
                <Input
                  aria-label="Search monthly preview rows"
                  placeholder="Search name or father's name..."
                  h="36px"
                  fontSize="sm"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                    setListPage(1);
                  }}
                />
              </InputGroup>
              {view === 'grid' ? (
                <Select
                  aria-label="Filter monthly preview rows"
                  h="36px"
                  w="220px"
                  fontSize="sm"
                  value={filter}
                  onChange={(event) => {
                    setFilter(event.target.value as MonthFilter);
                    setPage(1);
                  }}
                >
                  <option value="all">{`All rows (${filterCounts.all})`}</option>
                  <option value="attention">{`Needs attention (${filterCounts.attention})`}</option>
                  <option value="review">{`Has marks to review (${filterCounts.review})`}</option>
                  <option value="matched">{`Matched (${filterCounts.matched})`}</option>
                  <option value="fuzzy">{`Name to check (${filterCounts.fuzzy})`}</option>
                  <option value="unmatched">{`Unmatched (${filterCounts.unmatched})`}</option>
                  <option value="saved">{`Has saved days (${filterCounts.saved})`}</option>
                  <option value="edited">{`Edited saved days (${filterCounts.edited})`}</option>
                </Select>
              ) : (
                <Select
                  aria-label="Filter review entries"
                  h="36px"
                  w="220px"
                  fontSize="sm"
                  value={listFilter}
                  onChange={(event) => {
                    setListFilter(event.target.value as ListFilter);
                    setListPage(1);
                  }}
                >
                  <option value="review">Needs review only</option>
                  <option value="uncertain">Needs review + medium confidence</option>
                  <option value="all">All detected marks</option>
                </Select>
              )}
              {view === 'grid' ? (
                <Select
                  aria-label="Status applied when clicking a day"
                  h="36px"
                  w="210px"
                  fontSize="sm"
                  value={brush}
                  onChange={(event) => setBrush(event.target.value as Brush)}
                >
                  <option value="cycle">Click cycles P → A → blank</option>
                  {ATTENDANCE_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{`Click sets ${option.label}`}</option>
                  ))}
                  <option value="clear">Click clears the day</option>
                </Select>
              ) : null}
              <Menu placement="bottom-end" isLazy>
                <MenuButton as={Button} size="sm" h="36px" variant="outline" rightIcon={<ChevronDownIcon />}>
                  Bulk corrections
                </MenuButton>
                <MenuList fontSize="sm" maxH="360px" overflowY="auto">
                  <MenuGroup title="Marks that need review">
                    <MenuItem isDisabled={needsReviewCount === 0} onClick={() => resolveReviews('suggested')}>Accept suggested status where available</MenuItem>
                    {ATTENDANCE_STATUSES.map((status) => (
                      <MenuItem key={status} isDisabled={needsReviewCount === 0} onClick={() => resolveReviews(status)}>
                        {`Set all to ${ATTENDANCE_STATUS_META[status].label}`}
                      </MenuItem>
                    ))}
                    <MenuItem isDisabled={needsReviewCount === 0} onClick={() => resolveReviews(null)}>Skip all (leave not marked)</MenuItem>
                  </MenuGroup>
                  <MenuDivider />
                  <MenuGroup title="Blank cells">
                    <MenuItem isDisabled={blankCount === 0} onClick={() => setConfirmBlankAbsent(true)}>Treat blank cells as Absent…</MenuItem>
                  </MenuGroup>
                </MenuList>
              </Menu>
              {hasActiveFilters ? (
                <ActionButton tone="neutral" size="sm" h="36px" onClick={clearFilters}>Clear filters</ActionButton>
              ) : null}
            </HStack>
            {view === 'grid' ? (
              <Text mb={2} fontSize="xs" color="slate.500">
                Hover a day to see the original mark and confidence. Yellow “?” cells need review; dashed borders are medium confidence; orange cells are already saved.
              </Text>
            ) : null}
            {view === 'grid' ? renderGrid() : renderList()}
          </>
        ) : null}
      </ModalBody>
      <ModalFooter gap={3}>
        <ActionButton tone="neutral" onClick={onClose} isDisabled={isParsing || isSaving}>Cancel</ActionButton>
        <ActionButton onClick={() => setConfirmSave(true)} isLoading={isSaving} isDisabled={isParsing || saveableCount === 0}>
          {`Review & save ${saveableCount} ${saveableCount === 1 ? 'change' : 'changes'}`}
        </ActionButton>
      </ModalFooter>

      <ConfirmDialog
        isOpen={confirmBlankAbsent}
        title="Treat blank cells as Absent?"
        description={`${blankCount} blank ${blankCount === 1 ? 'cell' : 'cells'} on this register will be marked Absent for matched employees. Blank cells are normally left not marked; only do this if a blank means absent on this register. Sundays and days already saved are not changed.`}
        confirmLabel="Mark blanks Absent"
        tone="primary"
        onClose={() => setConfirmBlankAbsent(false)}
        onConfirm={markBlanksAbsent}
      />
      <ConfirmDialog
        isOpen={confirmSave}
        title="Save attendance from this register?"
        description={(
          <Stack spacing={2}>
            <Text>{`${newCount} new ${newCount === 1 ? 'day' : 'days'} and ${updateCount} ${updateCount === 1 ? 'update' : 'updates'} to saved days will be saved:`}</Text>
            <HStack spacing={2} flexWrap="wrap">
              {(confirmSave ? summarizeEntries() : []).map(({ status, count }) => (
                <Badge key={status} bg={ATTENDANCE_STATUS_META[status].bg} color={ATTENDANCE_STATUS_META[status].color} px={2} py={0.5}>
                  {`${ATTENDANCE_STATUS_META[status].label}: ${count}`}
                </Badge>
              ))}
            </HStack>
            {needsReviewCount > 0 ? (
              <Text color="orange.600">{`${needsReviewCount} ${needsReviewCount === 1 ? 'mark still needs' : 'marks still need'} review and will not be saved.`}</Text>
            ) : null}
            {filterCounts.unmatched > 0 ? (
              <Text color="red.500">{`${filterCounts.unmatched} unmatched ${filterCounts.unmatched === 1 ? 'row is' : 'rows are'} skipped.`}</Text>
            ) : null}
            {result?.uploadId ? <Text>The uploaded file is kept with these records for verification.</Text> : null}
          </Stack>
        )}
        confirmLabel="Save attendance"
        tone="primary"
        isLoading={isSaving}
        onClose={() => setConfirmSave(false)}
        onConfirm={() => void saveRows()}
      />
    </>
  );
}

export default AttendanceMonthUpload;
