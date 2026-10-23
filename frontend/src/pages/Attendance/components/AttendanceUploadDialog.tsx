import {
  Alert,
  Badge,
  Box,
  Button,
  ButtonGroup,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
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
import { SearchIcon } from '@chakra-ui/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import ActionButton from '../../../components/ui/ActionButton';
import Pagination from '../../../components/ui/Pagination';
import AttendanceMonthUpload from './AttendanceMonthUpload';
import { downloadDayUploadSheet } from '../utils/attendanceUploadSheet';
import { ApiError } from '../../../services/api';
import {
  bulkMarkAttendance,
  parseAttendanceSheet,
  type AttendanceParseEmployee,
  type AttendanceParseRow,
  type AttendanceStatus,
} from '../../../services/attendanceService';

type PreviewRow = AttendanceParseRow & { key: number };
type MatchFilter = 'all' | 'attention' | 'matched' | 'fuzzy' | 'unmatched' | 'marked';
type StatusFilter = 'all' | AttendanceStatus | 'unread';

const PREVIEW_PAGE_SIZE = 10;

function rowMatchesFilter(row: PreviewRow, filter: MatchFilter) {
  if (filter === 'all') return true;
  if (filter === 'marked') return row.alreadyMarked;
  if (filter === 'unmatched') return !row.employeeId;
  if (filter === 'attention') return !row.alreadyMarked && (!row.employeeId || !row.status || row.match !== 'exact');
  if (filter === 'fuzzy') return Boolean(row.employeeId) && (row.match === 'fuzzy' || row.match === 'ambiguous');
  return Boolean(row.employeeId) && row.match === 'exact' && !row.alreadyMarked;
}

function rowMatchesStatus(row: PreviewRow, filter: StatusFilter) {
  if (filter === 'all') return true;
  if (filter === 'unread') return !row.status;
  return row.status === filter;
}

function rowMatchesSearch(row: PreviewRow, query: string) {
  if (!query) return true;
  return [row.extractedName, row.extractedParentName, row.employeeName, row.parentName]
    .some((value) => (value || '').toLowerCase().includes(query));
}

type AttendanceUploadDialogProps = {
  isOpen: boolean;
  date: string;
  organizationId: string;
  locationId: string;
  onClose: () => void;
  onSaved: (result: { date: string; saved: number; updated?: number; skippedDuplicates: number; skippedInvalid: number }) => void;
};

function todayLocalDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function employeeLabel(employee: Pick<AttendanceParseEmployee, 'employeeName' | 'parentName'>) {
  return employee.parentName ? `${employee.employeeName} — ${employee.parentName}` : employee.employeeName;
}

function describeSelectedDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const monthLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, day));
  return { day, monthLabel };
}

function matchLabel(match: PreviewRow['match'], alreadyMarked: boolean) {
  if (alreadyMarked) return 'Already marked';
  if (match === 'exact') return 'Matched';
  if (match === 'fuzzy') return 'Fuzzy match';
  if (match === 'ambiguous') return 'Needs review';
  return 'Unmatched';
}

function AttendanceUploadDialog({
  isOpen,
  date,
  organizationId,
  locationId,
  onClose,
  onSaved,
}: AttendanceUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const parseRequestRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [markDate, setMarkDate] = useState(date);
  const [fileName, setFileName] = useState('');
  const [employees, setEmployees] = useState<AttendanceParseEmployee[]>([]);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [sheetPeriodLabel, setSheetPeriodLabel] = useState('');
  const [search, setSearch] = useState('');
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<'month' | 'day'>('month');
  const [monthBusy, setMonthBusy] = useState(false);
  const isBusy = isParsing || isSaving || monthBusy;
  const selected = describeSelectedDate(markDate);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => (
      rowMatchesFilter(row, matchFilter)
      && rowMatchesStatus(row, statusFilter)
      && rowMatchesSearch(row, query)
    ));
  }, [rows, search, matchFilter, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PREVIEW_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((currentPage - 1) * PREVIEW_PAGE_SIZE, currentPage * PREVIEW_PAGE_SIZE);
  const firstShown = filteredRows.length === 0 ? 0 : (currentPage - 1) * PREVIEW_PAGE_SIZE + 1;
  const lastShown = Math.min(currentPage * PREVIEW_PAGE_SIZE, filteredRows.length);
  const filterCounts = useMemo(() => {
    const count = (filter: MatchFilter) => rows.filter((row) => rowMatchesFilter(row, filter)).length;
    return {
      all: rows.length,
      attention: count('attention'),
      matched: count('matched'),
      fuzzy: count('fuzzy'),
      unmatched: count('unmatched'),
      marked: count('marked'),
    };
  }, [rows]);
  const hasActiveFilters = Boolean(search.trim()) || matchFilter !== 'all' || statusFilter !== 'all';

  function clearFilters() {
    setSearch('');
    setMatchFilter('all');
    setStatusFilter('all');
    setPage(1);
  }

  useEffect(() => {
    if (isOpen) setMarkDate(date);
  }, [isOpen, date]);

  const saveableCount = useMemo(
    () => rows.filter((row) => row.employeeId && row.status && !row.alreadyMarked).length,
    [rows],
  );

  function resetState() {
    parseRequestRef.current += 1;
    setFile(null);
    setFileName('');
    setEmployees([]);
    setRows([]);
    setIsParsing(false);
    setIsSaving(false);
    setError('');
    setWarning('');
    setSheetPeriodLabel('');
    clearFilters();
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function closeDialog() {
    if (isBusy) return;
    setMonthBusy(false);
    resetState();
    onClose();
  }

  async function readSheet(sheet: File, sheetDate: string) {
    const requestId = parseRequestRef.current + 1;
    parseRequestRef.current = requestId;
    setIsParsing(true);
    setError('');
    setWarning('');
    setSheetPeriodLabel('');
    setRows([]);
    setPage(1);
    try {
      const result = await parseAttendanceSheet(sheet, { date: sheetDate, organizationId, locationId });
      if (requestId !== parseRequestRef.current) return;
      setWarning(result.warning);
      setSheetPeriodLabel(result.sheetPeriod?.label || '');
      setEmployees(result.employees);
      setRows(result.rows.map((row, index) => ({ ...row, key: index })));
      if (result.rows.length === 0) {
        setError('No employee rows were found for this date. Check the sheet and try again.');
      }
    } catch (caught) {
      if (requestId !== parseRequestRef.current) return;
      setError(errorMessage(caught, 'Unable to read the attendance sheet.'));
    } finally {
      if (requestId === parseRequestRef.current) setIsParsing(false);
    }
  }

  function handleFileChange(sheet?: File) {
    if (!sheet) return;
    setFile(sheet);
    setFileName(sheet.name);
    void readSheet(sheet, markDate);
  }

  function handleDateChange(nextDate: string) {
    if (!nextDate) return;
    setMarkDate(nextDate);
    if (file) void readSheet(file, nextDate);
  }

  async function downloadSheet() {
    setIsDownloading(true);
    setError('');
    try {
      await downloadDayUploadSheet({ organizationId, locationId }, markDate);
    } catch (caught) {
      setError(errorMessage(caught, 'Unable to download the attendance sheet for this location.'));
    } finally {
      setIsDownloading(false);
    }
  }

  function updateRow(key: number, patch: Partial<PreviewRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  async function saveRows() {
    const entries = rows.flatMap((row) => (
      row.employeeId && row.status && !row.alreadyMarked
        ? [{ employeeId: row.employeeId, status: row.status }]
        : []
    ));
    if (entries.length === 0) return;
    setIsSaving(true);
    setError('');
    try {
      const result = await bulkMarkAttendance({ date: markDate, organizationId, locationId, entries });
      resetState();
      onSaved({ ...result, date: markDate });
      onClose();
    } catch (caught) {
      setError(errorMessage(caught, 'Unable to save attendance from this sheet.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={closeDialog} size="6xl">
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(3px)" />
      <ModalContent borderRadius="xl" maxW="1100px">
        <ModalHeader>
          <Text>Upload attendance</Text>
          <ButtonGroup mt={3} size="sm" isAttached variant="outline" isDisabled={isBusy}>
            <Button
              colorScheme={mode === 'month' ? 'brand' : undefined}
              variant={mode === 'month' ? 'solid' : 'outline'}
              onClick={() => setMode('month')}
            >
              Whole month
            </Button>
            <Button
              colorScheme={mode === 'day' ? 'brand' : undefined}
              variant={mode === 'day' ? 'solid' : 'outline'}
              onClick={() => setMode('day')}
            >
              Single day
            </Button>
          </ButtonGroup>
        </ModalHeader>
        <ModalCloseButton isDisabled={isBusy} />
        {mode === 'month' ? (
          <AttendanceMonthUpload
            initialMonth={markDate.slice(0, 7)}
            organizationId={organizationId}
            locationId={locationId}
            onBusyChange={setMonthBusy}
            onClose={closeDialog}
            onSaved={(result) => {
              setMonthBusy(false);
              resetState();
              onSaved({ ...result, date });
              onClose();
            }}
          />
        ) : (
        <>
        <ModalBody>
          <Text mb={3} fontSize="sm" color="slate.600">
            Unmatched names stay highlighted and already marked employees are skipped.
          </Text>
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
                Reading day column <Text as="span" fontWeight="700">{selected.day}</Text> for{' '}
                <Text as="span" fontWeight="700">{selected.monthLabel}</Text>
              </Text>
              <Text mt={1} fontSize="xs" color="slate.500">
                Pick the date to mark. Changing it re-reads the uploaded sheet for that day.
              </Text>
            </Box>
            <Input
              aria-label="Mark attendance for date"
              type="date"
              value={markDate}
              max={todayLocalDate()}
              h="40px"
              maxW="190px"
              fontSize="sm"
              bg="white"
              isDisabled={isParsing || isSaving}
              onChange={(event) => handleDateChange(event.target.value)}
            />
          </HStack>
          <HStack mb={2} justify="space-between" flexWrap="wrap" gap={2}>
            <Text fontSize="xs" color="slate.500">PDF, Excel, CSV, or image</Text>
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
          <Input
            ref={fileInputRef}
            aria-label="Attendance sheet file"
            type="file"
            accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp"
            h="40px"
            pt="6px"
            fontSize="sm"
            isDisabled={isParsing || isSaving}
            onChange={(event) => handleFileChange(event.target.files?.[0])}
          />
          {fileName ? (
            <Text mt={2} fontSize="xs" color="slate.500">
              {fileName}
              {sheetPeriodLabel ? ` · Sheet period: ${sheetPeriodLabel}` : ''}
            </Text>
          ) : null}
          {warning ? <Alert mt={4} status="warning">{warning}</Alert> : null}
          {error ? <Alert mt={4} status="error">{error}</Alert> : null}
          {isParsing ? (
            <Box py={10} textAlign="center"><Spinner color="brand.500" /></Box>
          ) : rows.length > 0 ? (
            <>
            <HStack mt={5} mb={3} spacing={3} flexWrap="wrap" align="flex-end">
              <InputGroup flex="1" minW="220px" maxW="320px">
                <InputLeftElement pointerEvents="none" color="slate.400" h="36px"><SearchIcon /></InputLeftElement>
                <Input
                  aria-label="Search preview rows"
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
                aria-label="Filter preview rows by match"
                h="36px"
                w="210px"
                fontSize="sm"
                value={matchFilter}
                onChange={(event) => {
                  setMatchFilter(event.target.value as MatchFilter);
                  setPage(1);
                }}
              >
                <option value="all">{`All rows (${filterCounts.all})`}</option>
                <option value="attention">{`Needs attention (${filterCounts.attention})`}</option>
                <option value="matched">{`Matched (${filterCounts.matched})`}</option>
                <option value="fuzzy">{`Fuzzy / review (${filterCounts.fuzzy})`}</option>
                <option value="unmatched">{`Unmatched (${filterCounts.unmatched})`}</option>
                <option value="marked">{`Already marked (${filterCounts.marked})`}</option>
              </Select>
              <Select
                aria-label="Filter preview rows by status"
                h="36px"
                w="160px"
                fontSize="sm"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as StatusFilter);
                  setPage(1);
                }}
              >
                <option value="all">All statuses</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="unread">Not read</option>
              </Select>
              {hasActiveFilters ? (
                <ActionButton tone="neutral" size="sm" h="36px" onClick={clearFilters}>Clear filters</ActionButton>
              ) : null}
            </HStack>
            <TableContainer border="1px solid" borderColor="slate.100" borderRadius="md">
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th fontSize="xs">Extracted name</Th>
                    <Th fontSize="xs">Matched employee</Th>
                    <Th fontSize="xs">Status</Th>
                    <Th fontSize="xs">Flag</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {pageRows.length === 0 ? (
                    <Tr>
                      <Td colSpan={4} textAlign="center" py={8} color="slate.500">No rows match these filters.</Td>
                    </Tr>
                  ) : null}
                  {pageRows.map((row) => {
                    const unmatched = !row.employeeId;
                    return (
                      <Tr key={row.key} bg={unmatched ? 'red.50' : row.alreadyMarked ? 'orange.50' : undefined}>
                        <Td>
                          <Text fontWeight="600">{row.extractedName || '—'}</Text>
                          <Text fontSize="xs" color="slate.500">{row.extractedParentName || 'Father name not found'}</Text>
                        </Td>
                        <Td>
                          <Select
                            aria-label={`Match employee for ${row.extractedName || 'extracted row'}`}
                            size="sm"
                            value={row.employeeId || ''}
                            borderColor={unmatched ? 'red.300' : undefined}
                            onChange={(event) => {
                              const employee = employees.find((item) => item.employeeId === event.target.value);
                              updateRow(row.key, {
                                employeeId: employee?.employeeId || null,
                                employeeName: employee?.employeeName || '',
                                parentName: employee?.parentName || '',
                                match: employee ? 'exact' : 'unmatched',
                              });
                            }}
                          >
                            <option value="">Select employee</option>
                            {employees.map((employee) => (
                              <option key={employee.employeeId} value={employee.employeeId}>
                                {employeeLabel(employee)}
                              </option>
                            ))}
                          </Select>
                        </Td>
                        <Td>
                          <Select
                            aria-label={`Attendance status for ${row.extractedName || 'extracted row'}`}
                            size="sm"
                            value={row.status || ''}
                            onChange={(event) => updateRow(row.key, {
                              status: (event.target.value || null) as AttendanceStatus | null,
                            })}
                          >
                            <option value="">Not read</option>
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                          </Select>
                        </Td>
                        <Td>
                          <Badge colorScheme={unmatched ? 'red' : row.alreadyMarked ? 'orange' : row.match === 'fuzzy' || row.match === 'ambiguous' ? 'yellow' : 'green'}>
                            {matchLabel(row.match, row.alreadyMarked)}
                          </Badge>
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
          <ActionButton tone="neutral" onClick={closeDialog} isDisabled={isParsing || isSaving}>Cancel</ActionButton>
          <ActionButton onClick={() => void saveRows()} isLoading={isSaving} isDisabled={isParsing || saveableCount === 0}>
            {`Save ${saveableCount} ${saveableCount === 1 ? 'record' : 'records'}`}
          </ActionButton>
        </ModalFooter>
        </>
        )}
      </ModalContent>
    </Modal>
  );
}

export default AttendanceUploadDialog;
