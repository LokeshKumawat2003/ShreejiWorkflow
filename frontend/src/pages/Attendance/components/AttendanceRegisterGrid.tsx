import { AttachmentIcon, CalendarIcon, CheckCircleIcon, CheckIcon, DownloadIcon, EditIcon, NotAllowedIcon, TimeIcon } from '@chakra-ui/icons';
import {
  Alert,
  Box,
  Button,
  Flex,
  HStack,
  Select,
  SimpleGrid,
  Skeleton,
  Spinner,
  Stack,
  Text,
  Tooltip,
  useToast,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { ActionButton, FilterBar, FilterField, FilterInput, FilterSelect, Pagination, PeopleIcon, SearchInput, StatCard } from '../../../components/ui';
import { ApiError } from '../../../services/api';
import {
  getAttendanceRegister,
  markAttendance,
  type AttendanceRegister,
  type AttendanceRegisterFilter,
  type AttendanceRegisterMark,
  type AttendanceStatus,
} from '../../../services/attendanceService';
import { exportRegisterExcel, exportRegisterPdf } from '../utils/attendanceRegisterExport';
import AttendanceUploadDialog from './AttendanceUploadDialog';

type AttendanceRegisterGridProps = {
  organizationId: string;
  locationId: string;
};

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const CELL_SIZE = '30px';
const STICKY_SERIAL_WIDTH = 52;
const STICKY_NAME_WIDTH = 210;

function currentLocalDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function dayDate(month: string, day: number) {
  return `${month}-${String(day).padStart(2, '0')}`;
}

const markStyles: Record<AttendanceRegisterMark, { bg: string; color: string; border: string; hover: string }> = {
  P: { bg: 'green.50', color: 'green.700', border: 'green.200', hover: 'green.100' },
  A: { bg: 'red.50', color: 'red.600', border: 'red.200', hover: 'red.100' },
  '': { bg: 'white', color: 'slate.400', border: 'slate.200', hover: 'slate.100' },
};

function AttendanceRegisterGrid({ organizationId, locationId }: AttendanceRegisterGridProps) {
  const toast = useToast();
  const today = currentLocalDate();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [register, setRegister] = useState<AttendanceRegister | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [rowFilter, setRowFilter] = useState<AttendanceRegisterFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [savingCells, setSavingCells] = useState<Set<string>>(() => new Set());
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'excel' | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, category, rowFilter, month, pageSize]);

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError('');
    void getAttendanceRegister({
      organizationId,
      locationId,
      month,
      page,
      limit: pageSize,
      search: debouncedSearch,
      category,
      filter: rowFilter,
    }, controller.signal)
      .then((result) => {
        if (!isActive) return;
        setRegister(result);
        if (result.pagination && result.pagination.page !== page) setPage(result.pagination.page);
      })
      .catch((error: unknown) => {
        if (isActive && !controller.signal.aborted) setLoadError(errorMessage(error, 'Unable to load the attendance register.'));
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    return () => {
      isActive = false;
      controller.abort();
    };
  }, [category, debouncedSearch, locationId, month, organizationId, page, pageSize, refreshToken, rowFilter]);

  const lastEditableDay = register?.elapsedDays ?? 0;
  const visibleRows = register?.rows || [];
  const pagination = register?.pagination;
  const summary = register?.summary;
  const attendanceRate = summary && summary.present + summary.absent
    ? `${Math.round((summary.present / (summary.present + summary.absent)) * 100)}%`
    : '—';
  const totalMarks = summary ? summary.present + summary.absent + summary.unmarked : 0;
  const markShare = (value?: number) => (totalMarks ? (value ?? 0) / totalMarks : null);

  const dayHeaders = useMemo(() => {
    if (!register) return [];
    const [year, monthNumber] = month.split('-').map(Number);
    return Array.from({ length: register.daysInMonth }, (_, index) => {
      const date = new Date(year, monthNumber - 1, index + 1);
      return {
        day: index + 1,
        weekday: new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(date),
        isSunday: date.getDay() === 0,
        isToday: dayDate(month, index + 1) === today,
      };
    });
  }, [month, register, today]);

  function setRowMark(employeeId: string, dayIndex: number, mark: AttendanceRegisterMark, previous: AttendanceRegisterMark) {
    const count = (value: AttendanceRegisterMark, target: AttendanceRegisterMark) => (value === target ? 1 : 0);
    setRegister((current) => current && {
      ...current,
      summary: {
        ...current.summary,
        present: current.summary.present + count(mark, 'P') - count(previous, 'P'),
        absent: current.summary.absent + count(mark, 'A') - count(previous, 'A'),
        unmarked: current.summary.unmarked - (previous === '' && mark !== '' ? 1 : 0) + (previous !== '' && mark === '' ? 1 : 0),
      },
      rows: current.rows.map((row) => {
        if (row.employeeId !== employeeId) return row;
        const days = [...row.days];
        days[dayIndex] = mark;
        return { ...row, days, totalPresent: days.filter((value) => value === 'P').length };
      }),
    });
  }

  async function toggleCell(employeeId: string, dayIndex: number, currentMark: AttendanceRegisterMark) {
    const key = `${employeeId}|${dayIndex}`;
    if (savingCells.has(key)) return;
    const nextStatus: AttendanceStatus = currentMark === 'P' ? 'absent' : 'present';
    const nextMark: AttendanceRegisterMark = nextStatus === 'present' ? 'P' : 'A';
    setRowMark(employeeId, dayIndex, nextMark, currentMark);
    setSavingCells((current) => new Set(current).add(key));
    try {
      await markAttendance({ employeeId, date: dayDate(month, dayIndex + 1), status: nextStatus, organizationId, locationId });
    } catch (error) {
      setRowMark(employeeId, dayIndex, currentMark, nextMark);
      toast({ title: errorMessage(error, 'Unable to save attendance.'), status: 'error', position: 'top' });
    } finally {
      setSavingCells((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  async function exportRegister(format: 'pdf' | 'excel') {
    setExportingFormat(format);
    try {
      const fullRegister = await getAttendanceRegister({ organizationId, locationId, month });
      if (format === 'pdf') await exportRegisterPdf(fullRegister);
      else await exportRegisterExcel(fullRegister);
    } catch (error) {
      toast({ title: errorMessage(error, 'Unable to export the attendance register.'), status: 'error', position: 'top' });
    } finally {
      setExportingFormat(null);
    }
  }

  const stickyCell = (left: number, width: number) => ({
    position: 'sticky' as const,
    left: `${left}px`,
    minW: `${width}px`,
    maxW: `${width}px`,
    zIndex: 2,
    bg: 'inherit',
  });

  return (
    <Stack spacing={4}>
      <SimpleGrid columns={{ base: 2, md: 5 }} spacing={3}>
        <StatCard label="Employees" value={summary?.employees ?? 0} color="brand.500" icon={<PeopleIcon boxSize={5} />} helper="On this register" isLoading={!summary} />
        <StatCard label="Present marks" value={summary?.present ?? 0} color="green.500" icon={<CheckCircleIcon />} helper="Of all days" share={markShare(summary?.present)} isLoading={!summary} />
        <StatCard label="Absent marks" value={summary?.absent ?? 0} color="red.500" icon={<NotAllowedIcon />} helper="Of all days" share={markShare(summary?.absent)} isLoading={!summary} />
        <StatCard label="Not marked" value={summary?.unmarked ?? 0} color="orange.400" icon={<TimeIcon />} helper="Still pending" share={markShare(summary?.unmarked)} isLoading={!summary} />
        <StatCard label="Attendance rate" value={attendanceRate} color="blue.500" icon={<CalendarIcon />} helper="Present ÷ marked days" isLoading={!summary} />
      </SimpleGrid>

      <Box bg="white" border="1px solid" borderColor="slate.200" borderRadius="lg" boxShadow="sm" overflow="hidden">
        <Flex
          direction={{ base: 'column', lg: 'row' }}
          justify="space-between"
          align={{ base: 'stretch', lg: 'center' }}
          gap={3}
          px={{ base: 3, md: 4 }}
          py={4}
          borderBottom="1px solid"
          borderColor="slate.100"
        >
          <HStack spacing={3}>
            <Flex w="40px" h="40px" borderRadius="md" bg="brand.50" color="brand.500" align="center" justify="center">
              <CalendarIcon />
            </Flex>
            <Box>
              <Text fontWeight="700" color="slate.900">Register of Attendance</Text>
              <Text fontSize="xs" color="slate.500">
                {register?.periodLabel || 'Monthly register'}
                {register?.location.name ? ` · ${register.location.name}` : ''}
              </Text>
            </Box>
          </HStack>
          <HStack flexWrap="wrap" spacing={2}>
            <Button
              size="sm"
              h="32px"
              leftIcon={isEditing ? <CheckIcon boxSize={3} /> : <EditIcon />}
              variant={isEditing ? 'solid' : 'outline'}
              isDisabled={!summary?.employees}
              onClick={() => setIsEditing((current) => !current)}
            >
              {isEditing ? 'Done editing' : 'Edit attendance'}
            </Button>
            <ActionButton tone="neutral" size="sm" leftIcon={<AttachmentIcon />} onClick={() => setIsUploadOpen(true)}>
              Upload
            </ActionButton>
            <ActionButton
              tone="neutral"
              size="sm"
              leftIcon={<DownloadIcon />}
              isLoading={exportingFormat === 'pdf'}
              isDisabled={!summary?.employees || Boolean(exportingFormat)}
              onClick={() => void exportRegister('pdf')}
            >
              PDF
            </ActionButton>
            <ActionButton
              tone="neutral"
              size="sm"
              leftIcon={<DownloadIcon />}
              isLoading={exportingFormat === 'excel'}
              isDisabled={!summary?.employees || Boolean(exportingFormat)}
              onClick={() => void exportRegister('excel')}
            >
              Excel
            </ActionButton>
          </HStack>
        </Flex>

        <FilterBar
          variant="inset"
          canClear={Boolean(search) || category !== 'all' || rowFilter !== 'all'}
          onClear={() => {
            setSearch('');
            setCategory('all');
            setRowFilter('all');
          }}
        >
          <FilterField label="Month" flex={{ base: '1 1 100%', md: '0 0 170px' }}>
            <FilterInput
              aria-label="Register month"
              type="month"
              value={month}
              max={today.slice(0, 7)}
              onChange={(event) => {
                if (!event.target.value) return;
                setMonth(event.target.value);
                setIsEditing(false);
              }}
            />
          </FilterField>
          <FilterField label="Search" flex={{ base: '1 1 100%', md: '1 1 240px' }} maxW={{ md: '380px' }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Employee or parent name..." label="Search employees" />
          </FilterField>
          <FilterField label="Category">
            <FilterSelect
              label="Filter by category"
              value={category}
              onChange={setCategory}
              options={[{ value: 'all', label: 'All categories' }, ...(register?.categories || []).map((value) => ({ value, label: value }))]}
            />
          </FilterField>
          <FilterField label="Attendance">
            <FilterSelect<AttendanceRegisterFilter>
              label="Filter by attendance"
              value={rowFilter}
              onChange={setRowFilter}
              options={[
                { value: 'all', label: 'All employees' },
                { value: 'absent', label: 'Has absences' },
                { value: 'full', label: 'Fully present' },
                { value: 'unmarked', label: 'Has unmarked days' },
              ]}
            />
          </FilterField>
        </FilterBar>

        <HStack justify="space-between" flexWrap="wrap" px={{ base: 3, md: 4 }} py={2.5} fontSize="xs" color="slate.500">
          <Text>
            {pagination?.total ?? visibleRows.length} of {summary?.employees ?? 0} employees · {isEditing
              ? 'Click a cell to switch Present / Absent'
              : 'Click "Edit attendance" to make changes'}
          </Text>
          <HStack spacing={3}>
            {(['P', 'A', ''] as const).map((mark) => (
              <HStack key={mark || 'empty'} spacing={1.5}>
                <Box w="14px" h="14px" borderRadius="4px" bg={markStyles[mark].bg} border="1px solid" borderColor={markStyles[mark].border} />
                <Text>{mark === 'P' ? 'Present' : mark === 'A' ? 'Absent' : 'Not marked'}</Text>
              </HStack>
            ))}
          </HStack>
        </HStack>

        {loadError ? (
          <Alert status="error">{loadError}</Alert>
        ) : isLoading && !register ? (
          <Stack p={4} spacing={2}>
            {[0, 1, 2, 3, 4].map((item) => <Skeleton key={item} h="40px" borderRadius="md" />)}
          </Stack>
        ) : !summary?.employees ? (
          <Box py={12} textAlign="center">
            <Text fontWeight="600" color="slate.900">No employees at this site</Text>
            <Text fontSize="sm" color="slate.500">Add employees to this location to start the register.</Text>
          </Box>
        ) : visibleRows.length === 0 ? (
          <Box py={12} textAlign="center">
            <Text fontWeight="600" color="slate.900">No matching employees</Text>
            <Text fontSize="sm" color="slate.500">Try a different search or filter.</Text>
          </Box>
        ) : (
          <Box position="relative" overflowX="auto" opacity={isLoading ? 0.6 : 1} transition="opacity 0.15s">
            {isLoading ? <Spinner position="absolute" top="40%" left="50%" color="brand.500" zIndex={5} /> : null}
            <Box as="table" w="max-content" minW="100%" fontSize="sm" sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <Box as="thead">
                <Box as="tr" bg="slate.50" position="sticky" top={0} zIndex={3}>
                  <Box as="th" {...stickyCell(0, STICKY_SERIAL_WIDTH)} zIndex={4} px={3} py={2} textAlign="left" fontSize="xs" color="slate.500" borderBottom="1px solid" borderColor="slate.200">
                    S.No
                  </Box>
                  <Box as="th" {...stickyCell(STICKY_SERIAL_WIDTH, STICKY_NAME_WIDTH)} zIndex={4} px={3} py={2} textAlign="left" fontSize="xs" color="slate.500" borderBottom="1px solid" borderRight="1px solid" borderColor="slate.200">
                    Employee Name
                  </Box>
                  <Box as="th" px={3} py={2} textAlign="left" fontSize="xs" color="slate.500" minW="110px" borderBottom="1px solid" borderColor="slate.200">
                    Category
                  </Box>
                  {dayHeaders.map((header) => (
                    <Box
                      as="th"
                      key={header.day}
                      px={0.5}
                      py={1.5}
                      minW="36px"
                      textAlign="center"
                      borderBottom="1px solid"
                      borderColor="slate.200"
                      bg={header.isToday ? 'brand.50' : header.isSunday ? 'orange.50' : undefined}
                    >
                      <Text fontSize="xs" fontWeight="700" color={header.isToday ? 'brand.600' : 'slate.900'}>{header.day}</Text>
                      <Text fontSize="10px" color={header.isSunday ? 'orange.500' : 'slate.400'}>{header.weekday}</Text>
                    </Box>
                  ))}
                  <Box as="th" px={3} py={2} textAlign="center" fontSize="xs" color="green.700" minW="56px" borderBottom="1px solid" borderLeft="1px solid" borderColor="slate.200">
                    P
                  </Box>
                  <Box as="th" px={3} py={2} textAlign="center" fontSize="xs" color="red.600" minW="56px" borderBottom="1px solid" borderColor="slate.200">
                    A
                  </Box>
                </Box>
              </Box>
              <Box as="tbody">
                {visibleRows.map((row) => {
                  const absent = row.days.filter((mark) => mark === 'A').length;
                  return (
                    <Box as="tr" key={row.employeeId} bg="white" _hover={{ bg: 'slate.50' }}>
                      <Box as="td" {...stickyCell(0, STICKY_SERIAL_WIDTH)} px={3} py={1.5} color="slate.500" borderBottom="1px solid" borderColor="slate.100">
                        {row.serial}
                      </Box>
                      <Box as="td" {...stickyCell(STICKY_SERIAL_WIDTH, STICKY_NAME_WIDTH)} px={3} py={1.5} borderBottom="1px solid" borderRight="1px solid" borderColor="slate.100">
                        <Text fontWeight="700" color="slate.900" fontSize="xs" textTransform="uppercase" noOfLines={1} title={row.name}>{row.name}</Text>
                        {row.parentName ? <Text fontSize="10px" color="slate.400" noOfLines={1}>S/o {row.parentName}</Text> : null}
                      </Box>
                      <Box as="td" px={3} py={1.5} fontSize="xs" color="slate.500" borderBottom="1px solid" borderColor="slate.100" whiteSpace="nowrap">
                        {row.skillCategory || '—'}
                      </Box>
                      {row.days.map((mark, dayIndex) => {
                        const isElapsed = dayIndex < lastEditableDay;
                        const isEditable = isEditing && isElapsed;
                        const isSaving = savingCells.has(`${row.employeeId}|${dayIndex}`);
                        const style = markStyles[mark];
                        return (
                          <Box as="td" key={dayIndex} px={0.5} py={1.5} textAlign="center" borderBottom="1px solid" borderColor="slate.100">
                            <Tooltip
                              label={!isElapsed
                                ? 'Future date'
                                : isEditing
                                  ? `${row.name} · ${dayDate(month, dayIndex + 1)} · click to mark ${mark === 'P' ? 'absent' : 'present'}`
                                  : `${row.name} · ${dayDate(month, dayIndex + 1)}`}
                              openDelay={400}
                              hasArrow
                              fontSize="xs"
                            >
                              <Box
                                as="button"
                                type="button"
                                aria-label={`${row.name} day ${dayIndex + 1}: ${mark === 'P' ? 'present' : mark === 'A' ? 'absent' : 'not marked'}`}
                                disabled={!isEditable || isSaving}
                                onClick={() => void toggleCell(row.employeeId, dayIndex, mark)}
                                w={CELL_SIZE}
                                h={CELL_SIZE}
                                display="inline-flex"
                                alignItems="center"
                                justifyContent="center"
                                borderRadius="6px"
                                border="1px solid"
                                borderColor={style.border}
                                bg={style.bg}
                                color={style.color}
                                fontSize="xs"
                                fontWeight="700"
                                cursor={isEditable ? 'pointer' : isElapsed ? 'default' : 'not-allowed'}
                                opacity={isElapsed ? (isSaving ? 0.5 : 1) : 0.35}
                                outline={isEditable ? '1px dashed' : undefined}
                                outlineColor="brand.100"
                                outlineOffset="1px"
                                transition="all 0.12s ease"
                                _hover={isEditable ? { bg: style.hover, transform: 'scale(1.08)' } : undefined}
                              >
                                {mark || (isElapsed ? '·' : '')}
                              </Box>
                            </Tooltip>
                          </Box>
                        );
                      })}
                      <Box as="td" px={3} textAlign="center" fontWeight="700" color="green.700" borderBottom="1px solid" borderLeft="1px solid" borderColor="slate.100">
                        {row.totalPresent}
                      </Box>
                      <Box as="td" px={3} textAlign="center" fontWeight="700" color="red.600" borderBottom="1px solid" borderColor="slate.100">
                        {absent}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>
        )}

        {pagination && pagination.total > 0 && !loadError ? (
          <Flex
            direction={{ base: 'column', md: 'row' }}
            justify="space-between"
            align={{ base: 'stretch', md: 'center' }}
            gap={3}
            px={{ base: 3, md: 4 }}
            py={3}
            borderTop="1px solid"
            borderColor="slate.100"
          >
            <HStack spacing={3} fontSize="xs" color="slate.500">
              <Text>
                Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </Text>
              <Select
                aria-label="Rows per page"
                size="sm"
                w="auto"
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                fontSize="xs"
                borderRadius="md"
              >
                {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} / page</option>)}
              </Select>
            </HStack>
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
              isDisabled={isLoading}
            />
          </Flex>
        ) : null}
      </Box>

      <AttendanceUploadDialog
        isOpen={isUploadOpen}
        date={month === today.slice(0, 7) ? today : `${month}-01`}
        organizationId={organizationId}
        locationId={locationId}
        onClose={() => setIsUploadOpen(false)}
        onSaved={(result) => {
          setMonth(result.date.slice(0, 7));
          setRefreshToken((current) => current + 1);
          toast({
            title: `${result.saved} attendance record${result.saved === 1 ? '' : 's'} saved`,
            description: result.updated ? `${result.updated} updated.` : undefined,
            status: 'success',
            position: 'top',
          });
        }}
      />
    </Stack>
  );
}

export default AttendanceRegisterGrid;
