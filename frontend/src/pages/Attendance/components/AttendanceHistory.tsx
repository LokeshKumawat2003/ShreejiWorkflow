import { DownloadIcon } from '@chakra-ui/icons';
import { Alert, Box, HStack, Text } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import {
  ActionButton,
  DataTable,
  EntityCell,
  FilterBar,
  FilterField,
  FilterInput,
  FilterSelect,
  SearchInput,
  TableFooter,
  type DataTableColumn,
} from '../../../components/ui';
import { ApiError } from '../../../services/api';
import {
  getAttendanceRegister,
  listAttendanceHistory,
  type AttendanceHistoryEntry,
  type AttendanceStatus,
} from '../../../services/attendanceService';
import { exportRegisterExcel, exportRegisterPdf } from '../utils/attendanceRegisterExport';

type AttendanceHistoryProps = {
  organizationId?: string;
  locationId?: string;
};

const PAGE_SIZE = 10;

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Unable to load attendance history.';
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}

function formatWeekday(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone: 'UTC' }).format(date);
}

function formatDateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function StatusPill({ status }: { status: AttendanceStatus }) {
  const isPresent = status === 'present';
  return (
    <HStack
      as="span"
      display="inline-flex"
      spacing={1.5}
      px={2.5}
      py={0.5}
      borderRadius="full"
      bg={isPresent ? 'green.50' : 'red.50'}
      color={isPresent ? 'green.700' : 'red.600'}
      fontSize="xs"
      fontWeight="700"
    >
      <Box w="6px" h="6px" borderRadius="full" bg={isPresent ? 'green.500' : 'red.400'} />
      <Text as="span">{isPresent ? 'Present' : 'Absent'}</Text>
    </HStack>
  );
}

const historyColumns: DataTableColumn<AttendanceHistoryEntry>[] = [
  {
    key: 'date',
    header: 'Date',
    render: (record) => (
      <Box whiteSpace="nowrap">
        <Text fontWeight="600" color="slate.900">{formatDate(record.date)}</Text>
        <Text fontSize="xs" color="slate.500">{formatWeekday(record.date)}</Text>
      </Box>
    ),
  },
  {
    key: 'employee',
    header: 'Employee',
    render: (record) => <EntityCell name={record.employeeName} subtitle={record.employeeEmail || undefined} minW="200px" />,
  },
  {
    key: 'role',
    header: 'Department / job',
    hideBelow: 'md',
    render: (record) => (
      <Box>
        <Text color="slate.800" fontWeight="500">{record.jobTitle || '—'}</Text>
        {record.department ? <Text fontSize="xs" color="slate.500">{record.department}</Text> : null}
      </Box>
    ),
  },
  { key: 'status', header: 'Attendance', render: (record) => <StatusPill status={record.status} /> },
  {
    key: 'updated',
    header: 'Last updated',
    align: 'right',
    hideBelow: 'lg',
    render: (record) => <Text fontSize="xs" color="slate.500" whiteSpace="nowrap">{formatDateTime(record.updatedAt)}</Text>,
  },
];

function AttendanceHistory({ organizationId, locationId }: AttendanceHistoryProps) {
  const [records, setRecords] = useState<AttendanceHistoryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | AttendanceStatus>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [registerMonth, setRegisterMonth] = useState(currentMonth);
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'excel' | null>(null);
  const [exportError, setExportError] = useState('');
  const canExportRegister = Boolean(organizationId && locationId);
  const hasFilters = Boolean(search) || status !== 'all' || Boolean(fromDate) || Boolean(toDate);

  async function exportRegister(format: 'pdf' | 'excel') {
    if (!organizationId || !locationId || !registerMonth) return;
    setExportingFormat(format);
    setExportError('');
    try {
      const register = await getAttendanceRegister({ organizationId, locationId, month: registerMonth });
      if (format === 'pdf') await exportRegisterPdf(register);
      else await exportRegisterExcel(register);
    } catch (error) {
      setExportError(error instanceof ApiError ? error.message : 'Unable to export the attendance register.');
    } finally {
      setExportingFormat(null);
    }
  }

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError('');
    void listAttendanceHistory({
      ...(organizationId ? { organizationId } : {}),
      ...(locationId ? { locationId } : {}),
      page,
      limit: PAGE_SIZE,
      search,
      status,
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
    }, controller.signal)
      .then((result) => {
        if (!isActive) return;
        setRecords(result.records);
        setPage(result.pagination.page);
        setTotal(result.pagination.total);
        setTotalPages(result.pagination.totalPages);
      })
      .catch((error: unknown) => {
        if (isActive && !controller.signal.aborted) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [fromDate, locationId, organizationId, page, search, status, toDate]);

  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function changeStatus(value: 'all' | AttendanceStatus) {
    setStatus(value);
    setPage(1);
  }

  function changeDateRange(start: string, end: string) {
    setFromDate(start);
    setToDate(end);
    setPage(1);
  }

  return (
    <Box bg="white" border="1px solid" borderColor="slate.200" borderRadius="xl" overflow="hidden" boxShadow="sm">
      <FilterBar
        variant="inset"
        bg="white"
        canClear={hasFilters}
        onClear={() => {
          changeSearch('');
          changeStatus('all');
          changeDateRange('', '');
        }}
      >
        <FilterField label="Search" flex={{ base: '1 1 100%', md: '1 1 240px' }} maxW={{ md: '360px' }}>
          <SearchInput value={search} onChange={changeSearch} placeholder="Search employees..." label="Search attendance history" />
        </FilterField>
        <FilterField label="Status" flex={{ base: '1 1 100%', md: '0 0 160px' }}>
          <FilterSelect<'all' | AttendanceStatus>
            label="Filter attendance history by status"
            value={status}
            onChange={changeStatus}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'present', label: 'Present' },
              { value: 'absent', label: 'Absent' },
            ]}
          />
        </FilterField>
        <FilterField label="From" flex={{ base: '1 1 45%', md: '0 0 165px' }}>
          <FilterInput aria-label="Attendance history start date" type="date" value={fromDate} max={toDate || undefined} onChange={(event) => changeDateRange(event.target.value, toDate)} />
        </FilterField>
        <FilterField label="To" flex={{ base: '1 1 45%', md: '0 0 165px' }}>
          <FilterInput aria-label="Attendance history end date" type="date" value={toDate} min={fromDate || undefined} onChange={(event) => changeDateRange(fromDate, event.target.value)} />
        </FilterField>
      </FilterBar>

      {canExportRegister && (
        <HStack
          justify="space-between"
          align="flex-end"
          flexWrap="wrap"
          gap={3}
          px={{ base: 3, md: 5 }}
          py={3}
          bg="slate.50"
          borderBottom="1px solid"
          borderColor="slate.100"
        >
          <Box>
            <Text fontSize="sm" fontWeight="600" color="slate.800">Form XVI attendance register</Text>
            <Text fontSize="xs" color="slate.500">Monthly register with day-wise P/A, total present, and total mandays.</Text>
          </Box>
          <HStack flexWrap="wrap" spacing={3} align="flex-end">
            <FilterField label="Month" flex="0 0 170px">
              <FilterInput
                aria-label="Attendance register month"
                type="month"
                value={registerMonth}
                max={currentMonth()}
                onChange={(event) => setRegisterMonth(event.target.value)}
              />
            </FilterField>
            <ActionButton
              tone="neutral"
              leftIcon={<DownloadIcon />}
              isLoading={exportingFormat === 'pdf'}
              isDisabled={!registerMonth || exportingFormat !== null}
              onClick={() => void exportRegister('pdf')}
            >
              Register PDF
            </ActionButton>
            <ActionButton
              tone="neutral"
              leftIcon={<DownloadIcon />}
              isLoading={exportingFormat === 'excel'}
              isDisabled={!registerMonth || exportingFormat !== null}
              onClick={() => void exportRegister('excel')}
            >
              Register Excel
            </ActionButton>
          </HStack>
        </HStack>
      )}
      {exportError && <Alert status="error">{exportError}</Alert>}

      <DataTable
        columns={historyColumns}
        rows={records}
        rowKey={(record) => record.id}
        size="sm"
        isLoading={isLoading}
        error={loadError}
        emptyTitle={hasFilters ? 'No matching attendance' : 'No attendance history yet'}
        emptyDescription={hasFilters ? 'Try a different search, status or date range.' : 'Attendance marked for employees will appear here.'}
        footer={total > 0 && !loadError ? (
          <TableFooter
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            totalPages={totalPages}
            noun="records"
            isDisabled={isLoading}
            onPageChange={setPage}
          />
        ) : null}
      />
    </Box>
  );
}

export default AttendanceHistory;
