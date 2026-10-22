import { EditIcon, SearchIcon } from '@chakra-ui/icons';
import {
  Alert,
  Badge,
  Box,
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Input,
  InputGroup,
  InputLeftElement,
  Link,
  ModalBody,
  ModalFooter,
  Select,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ActionButton from '../../../components/ui/ActionButton';
import Pagination from '../../../components/ui/Pagination';
import { ApiError } from '../../../services/api';
import {
  bulkMarkAttendance,
  parseAttendanceMonth,
  type AttendanceMonthParseResponse,
  type AttendanceMonthParseRow,
  type AttendanceParseEmployee,
  type AttendanceStatus,
} from '../../../services/attendanceService';

type MonthRow = AttendanceMonthParseRow & { key: number; overrides: (AttendanceStatus | null)[] };
type MonthFilter = 'all' | 'attention' | 'matched' | 'fuzzy' | 'unmatched' | 'saved' | 'edited';

type AttendanceMonthUploadProps = {
  initialMonth: string;
  organizationId: string;
  locationId: string;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
  onSaved: (result: { saved: number; updated: number; skippedDuplicates: number; skippedInvalid: number }) => void;
};

const PAGE_SIZE = 10;

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber) return month;
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(year, monthNumber - 1, 1));
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

function newMarkCount(row: MonthRow) {
  return row.marks.filter((mark, index) => mark && !row.existing[index]).length;
}

function editedCount(row: MonthRow) {
  return row.overrides.filter((override, index) => override && override !== row.existing[index]).length;
}

function rowMatchesFilter(row: MonthRow, filter: MonthFilter) {
  if (filter === 'all') return true;
  if (filter === 'edited') return editedCount(row) > 0;
  if (filter === 'saved') return row.existing.some(Boolean);
  if (filter === 'unmatched') return !row.employeeId;
  if (filter === 'attention') return !row.employeeId || row.match !== 'exact';
  if (filter === 'fuzzy') return Boolean(row.employeeId) && (row.match === 'fuzzy' || row.match === 'ambiguous');
  return Boolean(row.employeeId) && row.match === 'exact';
}

function nextMark(mark: AttendanceStatus | null): AttendanceStatus | null {
  if (mark === 'present') return 'absent';
  if (mark === 'absent') return null;
  return 'present';
}

function flagFor(row: MonthRow) {
  if (!row.employeeId) return { label: 'Unmatched', color: 'red' };
  if (row.match === 'fuzzy' || row.match === 'ambiguous') return { label: 'Needs review', color: 'yellow' };
  return { label: 'Matched', color: 'green' };
}

function AttendanceMonthUpload({
  initialMonth,
  organizationId,
  locationId,
  onClose,
  onBusyChange,
  onSaved,
}: AttendanceMonthUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const parseRequestRef = useRef(0);
  const [month, setMonth] = useState(initialMonth);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AttendanceMonthParseResponse | null>(null);
  const [rows, setRows] = useState<MonthRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MonthFilter>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    onBusyChange(isParsing || isSaving);
  }, [isParsing, isSaving, onBusyChange]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => rowMatchesFilter(row, filter) && (!query || [
      row.extractedName,
      row.extractedParentName,
      row.employeeName,
      row.parentName,
    ].some((value) => (value || '').toLowerCase().includes(query))));
  }, [rows, search, filter]);
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
      matched: count('matched'),
      fuzzy: count('fuzzy'),
      unmatched: count('unmatched'),
      saved: count('saved'),
      edited: count('edited'),
    };
  }, [rows]);
  const newCount = useMemo(
    () => rows.reduce((sum, row) => sum + (row.employeeId ? newMarkCount(row) : 0), 0),
    [rows],
  );
  const updateCount = useMemo(
    () => rows.reduce((sum, row) => sum + (row.employeeId ? editedCount(row) : 0), 0),
    [rows],
  );
  const saveableCount = newCount + updateCount;
  const alreadySavedCount = useMemo(
    () => rows.reduce((sum, row) => sum + row.existing.filter(Boolean).length, 0),
    [rows],
  );
  const days = result ? Array.from({ length: result.lastImportableDay }, (_, index) => index + 1) : [];
  const hasActiveFilters = Boolean(search.trim()) || filter !== 'all';

  async function readSheet(sheet: File, sheetMonth: string) {
    const requestId = parseRequestRef.current + 1;
    parseRequestRef.current = requestId;
    setIsParsing(true);
    setError('');
    setResult(null);
    setRows([]);
    setPage(1);
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

  function updateRow(key: number, patch: Partial<MonthRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function toggleMark(row: MonthRow, dayIndex: number) {
    const marks = [...row.marks];
    marks[dayIndex] = nextMark(marks[dayIndex]);
    updateRow(row.key, { marks });
  }

  function toggleSaved(row: MonthRow, dayIndex: number) {
    const saved = row.existing[dayIndex];
    if (!saved) return;
    const current = row.overrides[dayIndex] || saved;
    const next: AttendanceStatus = current === 'present' ? 'absent' : 'present';
    const overrides = [...row.overrides];
    overrides[dayIndex] = next === saved ? null : next;
    updateRow(row.key, { overrides });
  }

  function setRowMarks(row: MonthRow, status: AttendanceStatus | null) {
    updateRow(row.key, {
      marks: row.marks.map((mark, index) => (row.existing[index] ? mark : status)),
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

  function clearFilters() {
    setSearch('');
    setFilter('all');
    setPage(1);
  }

  async function saveRows() {
    if (!result) return;
    const dateFor = (index: number) => `${result.month}-${String(index + 1).padStart(2, '0')}`;
    const entries = rows.flatMap((row) => {
      if (!row.employeeId) return [];
      const employeeId = row.employeeId;
      return row.marks.flatMap((mark, index) => {
        const saved = row.existing[index];
        const override = row.overrides[index];
        if (saved) {
          return override && override !== saved
            ? [{ employeeId, status: override, date: dateFor(index), replace: true }]
            : [];
        }
        return mark ? [{ employeeId, status: mark, date: dateFor(index) }] : [];
      });
    });
    if (entries.length === 0) return;
    setIsSaving(true);
    setError('');
    try {
      const saved = await bulkMarkAttendance({ organizationId, locationId, entries });
      onSaved(saved);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to save attendance from this sheet.');
      setIsSaving(false);
    }
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
              Days after today are skipped. Days already saved are kept and not overwritten.
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
          <Text fontSize="xs" color="slate.500">Excel or CSV monthly register with day columns 1-31</Text>
          <Link
            href="/examples/sample-attendance.xlsx"
            download="sample-attendance.xlsx"
            fontSize="sm"
            fontWeight="600"
            color="brand.600"
          >
            Download sample Excel
          </Link>
        </HStack>
        <Input
          ref={fileInputRef}
          aria-label="Monthly attendance sheet file"
          type="file"
          accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp"
          h="40px"
          pt="6px"
          fontSize="sm"
          isDisabled={isParsing || isSaving}
          onChange={(event) => handleFileChange(event.target.files?.[0])}
        />
        {file ? (
          <Text mt={2} fontSize="xs" color="slate.500">
            {file.name}
            {result?.sheetPeriod ? ` · Sheet period: ${result.sheetPeriod.label}` : ''}
            {result ? ` · Day columns found: ${formatDayList(result.sheetDays)}` : ''}
          </Text>
        ) : null}
        {result?.warning ? <Alert mt={4} status="warning">{result.warning}</Alert> : null}
        {result && result.skippedFutureDays.length > 0 ? (
          <Alert mt={4} status="info">
            {`Days ${formatDayList(result.skippedFutureDays)} are after today and were skipped. Upload again after those days to import them.`}
          </Alert>
        ) : null}
        {error ? <Alert mt={4} status="error">{error}</Alert> : null}

        {isParsing ? (
          <Box py={10} textAlign="center"><Spinner color="brand.500" /></Box>
        ) : result && rows.length > 0 ? (
          <>
            <HStack mt={4} spacing={4} flexWrap="wrap">
              <Badge colorScheme="green" px={2} py={1}>{`${newCount} new marks`}</Badge>
              <Badge colorScheme="purple" px={2} py={1}>{`${updateCount} edits to saved days`}</Badge>
              <Badge colorScheme="orange" px={2} py={1}>{`${alreadySavedCount} already saved`}</Badge>
              <Text fontSize="xs" color="slate.500">
                Click a day to edit: new days cycle P, A, blank; saved days (orange) switch P/A and are updated on save.
              </Text>
            </HStack>
            <HStack mt={3} mb={3} spacing={3} flexWrap="wrap" align="flex-end">
              <InputGroup flex="1" minW="220px" maxW="320px">
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
                  }}
                />
              </InputGroup>
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
                <option value="matched">{`Matched (${filterCounts.matched})`}</option>
                <option value="fuzzy">{`Fuzzy / review (${filterCounts.fuzzy})`}</option>
                <option value="unmatched">{`Unmatched (${filterCounts.unmatched})`}</option>
                <option value="saved">{`Has saved days (${filterCounts.saved})`}</option>
                <option value="edited">{`Edited saved days (${filterCounts.edited})`}</option>
              </Select>
              {hasActiveFilters ? (
                <ActionButton tone="neutral" size="sm" h="36px" onClick={clearFilters}>Clear filters</ActionButton>
              ) : null}
            </HStack>
            <TableContainer border="1px solid" borderColor="slate.100" borderRadius="md" overflowX="auto">
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th fontSize="xs" minW="170px">Extracted name</Th>
                    <Th fontSize="xs" minW="220px">Matched employee</Th>
                    {days.map((day) => (
                      <Th key={day} fontSize="xs" px={0} textAlign="center" minW="26px">{day}</Th>
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
                          const index = day - 1;
                          const saved = row.existing[index];
                          const mark = row.marks[index];
                          if (saved) {
                            const override = row.overrides[index];
                            const changed = Boolean(override && override !== saved);
                            const shown = override || saved;
                            return (
                              <Td key={day} px={0} textAlign="center" bg="orange.50">
                                <Box
                                  as="button"
                                  type="button"
                                  aria-label={`Day ${day} for ${row.extractedName}: saved ${saved}${changed ? `, will change to ${shown}` : ''}`}
                                  title={changed ? `Saved as ${saved}. Will be updated to ${shown}.` : `Already saved: ${saved}. Click to change.`}
                                  w="22px"
                                  h="22px"
                                  borderRadius="4px"
                                  fontSize="xs"
                                  fontWeight="700"
                                  border={changed ? '2px solid' : '1px dashed'}
                                  borderColor={changed ? 'purple.500' : 'orange.200'}
                                  bg={changed ? 'purple.50' : 'transparent'}
                                  color={changed ? (shown === 'present' ? 'green.700' : 'red.600') : 'slate.400'}
                                  onClick={() => toggleSaved(row, index)}
                                >
                                  {shown === 'present' ? 'P' : 'A'}
                                </Box>
                              </Td>
                            );
                          }
                          return (
                            <Td key={day} px={0} textAlign="center">
                              <Box
                                as="button"
                                type="button"
                                aria-label={`Day ${day} for ${row.extractedName}: ${mark || 'blank'}`}
                                w="22px"
                                h="22px"
                                borderRadius="4px"
                                fontSize="xs"
                                fontWeight="700"
                                border="1px solid"
                                borderColor={mark ? 'transparent' : 'slate.200'}
                                bg={mark === 'present' ? 'green.50' : mark === 'absent' ? 'red.50' : 'white'}
                                color={mark === 'present' ? 'green.700' : mark === 'absent' ? 'red.600' : 'slate.300'}
                                onClick={() => toggleMark(row, index)}
                              >
                                {mark === 'present' ? 'P' : mark === 'absent' ? 'A' : '·'}
                              </Box>
                            </Td>
                          );
                        })}
                        <Td textAlign="center" fontWeight="600">{newMarkCount(row) + editedCount(row)}</Td>
                        <Td><Badge colorScheme={flag.color}>{flag.label}</Badge></Td>
                        <Td textAlign="right">
                          <Menu placement="bottom-end">
                            <MenuButton
                              as={IconButton}
                              aria-label={`Edit options for ${row.extractedName}`}
                              title="Edit row"
                              icon={<EditIcon />}
                              size="sm"
                              variant="ghost"
                            />
                            <MenuList fontSize="sm">
                              <MenuItem onClick={() => setRowMarks(row, 'present')}>Mark all days Present</MenuItem>
                              <MenuItem onClick={() => setRowMarks(row, 'absent')}>Mark all days Absent</MenuItem>
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
        ) : null}
      </ModalBody>
      <ModalFooter gap={3}>
        <ActionButton tone="neutral" onClick={onClose} isDisabled={isParsing || isSaving}>Cancel</ActionButton>
        <ActionButton onClick={() => void saveRows()} isLoading={isSaving} isDisabled={isParsing || saveableCount === 0}>
          {`Save ${saveableCount} ${saveableCount === 1 ? 'change' : 'changes'}`}
        </ActionButton>
      </ModalFooter>
    </>
  );
}

export default AttendanceMonthUpload;
