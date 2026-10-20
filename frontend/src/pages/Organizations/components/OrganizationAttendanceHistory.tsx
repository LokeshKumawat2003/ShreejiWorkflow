import { DownloadIcon, EditIcon, SearchIcon } from '@chakra-ui/icons';
import {
  Alert,
  Badge,
  Box,
  FormControl,
  FormLabel,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
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
import { useEffect, useState } from 'react';
import Pagination from '../../../components/common/Pagination';
import { ApiError } from '../../../services/api';
import {
  getAttendanceRegister,
  listAttendanceHistory,
  markAttendance,
  type AttendanceHistoryEntry,
  type AttendanceStatus,
} from '../../../services/attendanceService';
import ActionButton from '../../../components/common/ActionButton';
import { exportRegisterExcel, exportRegisterPdf } from './attendanceRegisterExport';

type OrganizationAttendanceHistoryProps = {
  organizationId?: string;
  locationId?: string;
  canEdit?: boolean;
};

const PAGE_SIZE = 10;

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Unable to load attendance history.';
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
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

function OrganizationAttendanceHistory({ organizationId, locationId, canEdit = false }: OrganizationAttendanceHistoryProps) {
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
  const [editingRecord, setEditingRecord] = useState<AttendanceHistoryEntry | null>(null);
  const [editingStatus, setEditingStatus] = useState<AttendanceStatus>('present');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [registerMonth, setRegisterMonth] = useState(currentMonth);
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'excel' | null>(null);
  const [exportError, setExportError] = useState('');
  const canExportRegister = Boolean(organizationId && locationId);

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

  function openEdit(record: AttendanceHistoryEntry) {
    setEditingRecord(record);
    setEditingStatus(record.status);
    setSaveError('');
    setIsEditOpen(true);
  }

  async function saveAttendance() {
    if (!editingRecord) return;
    setIsSaving(true);
    setSaveError('');
    try {
      const updated = await markAttendance({
        employeeId: editingRecord.employeeId,
        date: editingRecord.date,
        status: editingStatus,
        ...(organizationId ? { organizationId } : {}),
        ...(locationId ? { locationId } : {}),
      });
      setRecords((current) => current.map((record) => (
        record.id === editingRecord.id
          ? { ...record, status: updated.status, updatedAt: updated.updatedAt || record.updatedAt }
          : record
      )));
      setIsEditOpen(false);
      setEditingRecord(null);
    } catch (error) {
      setSaveError(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  const firstRecord = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRecord = Math.min(page * PAGE_SIZE, total);
  const columnCount = canEdit ? 7 : 6;

  return (
    <Box bg="white" border="1px solid" borderColor="slate.200" borderRadius="8px" overflow="hidden">
      <HStack align="center" justify="space-between" flexWrap="wrap" gap={4} px={{ base: 3, md: 4 }} py={4} borderBottom="1px solid" borderColor="slate.100">
        <InputGroup flex="1" minW="220px" maxW="320px">
          <InputLeftElement pointerEvents="none" color="slate.400"><SearchIcon /></InputLeftElement>
          <Input
            aria-label="Search attendance history"
            placeholder="Search employees..."
            h="40px"
            fontSize="sm"
            value={search}
            onChange={(event) => changeSearch(event.target.value)}
          />
        </InputGroup>
        <HStack flexWrap="wrap" spacing={3}>
          <Box minW="145px">
            <Text mb={1} ml={2} fontSize="xs" color="slate.500">Status</Text>
            <Select aria-label="Filter attendance history by status" h="40px" fontSize="sm" value={status} onChange={(event) => changeStatus(event.target.value as typeof status)}>
              <option value="all">All statuses</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
            </Select>
          </Box>
          <Box>
            <Text mb={1} ml={2} fontSize="xs" color="slate.500">From</Text>
            <Input aria-label="Attendance history start date" type="date" h="40px" w="160px" fontSize="sm" value={fromDate} onChange={(event) => changeDateRange(event.target.value, toDate)} />
          </Box>
          <Box>
            <Text mb={1} ml={2} fontSize="xs" color="slate.500">To</Text>
            <Input aria-label="Attendance history end date" type="date" h="40px" w="160px" fontSize="sm" value={toDate} onChange={(event) => changeDateRange(fromDate, event.target.value)} />
          </Box>
        </HStack>
      </HStack>

      {canExportRegister && (
        <HStack
          justify="space-between"
          align="flex-end"
          flexWrap="wrap"
          gap={3}
          px={{ base: 3, md: 4 }}
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
            <Box>
              <Text mb={1} ml={2} fontSize="xs" color="slate.500">Month</Text>
              <Input
                aria-label="Attendance register month"
                type="month"
                h="40px"
                w="170px"
                fontSize="sm"
                bg="white"
                value={registerMonth}
                max={currentMonth()}
                onChange={(event) => setRegisterMonth(event.target.value)}
              />
            </Box>
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

      {loadError ? (
        <Alert status="error">{loadError}</Alert>
      ) : (
        <TableContainer>
          <Table variant="simple" size="md" fontSize="sm">
            <Thead>
              <Tr>
                <Th fontSize="xs">Date</Th>
                <Th fontSize="xs">Employee</Th>
                <Th fontSize="xs">Department</Th>
                <Th fontSize="xs">Job title</Th>
                <Th fontSize="xs">Attendance</Th>
                <Th fontSize="xs">Last updated</Th>
                {canEdit && <Th fontSize="xs" textAlign="right">Actions</Th>}
              </Tr>
            </Thead>
            <Tbody>
              {isLoading ? (
                <Tr><Td colSpan={columnCount} textAlign="center" py={10}><Spinner color="brand.500" /></Td></Tr>
              ) : records.length === 0 ? (
                <Tr><Td colSpan={columnCount} textAlign="center" py={10} color="slate.500">No attendance history found.</Td></Tr>
              ) : records.map((record) => (
                <Tr key={record.id}>
                  <Td whiteSpace="nowrap">{formatDate(record.date)}</Td>
                  <Td>
                    <Text fontWeight="600" color="slate.900">{record.employeeName}</Text>
                    {record.employeeEmail && <Text fontSize="xs" color="slate.500">{record.employeeEmail}</Text>}
                  </Td>
                  <Td>{record.department || '—'}</Td>
                  <Td>{record.jobTitle || '—'}</Td>
                  <Td>
                    <Badge
                      px={3}
                      py={1}
                      borderRadius="full"
                      color={record.status === 'present' ? 'green.600' : 'red.600'}
                      bg={record.status === 'present' ? 'green.50' : 'red.50'}
                      fontSize="xs"
                      fontWeight="600"
                    >
                      {record.status.toUpperCase()}
                    </Badge>
                  </Td>
                  <Td whiteSpace="nowrap">{formatDateTime(record.updatedAt)}</Td>
                  {canEdit && (
                    <Td textAlign="right">
                      <Menu>
                        <MenuButton
                          as={IconButton}
                          aria-label={`Attendance actions for ${record.employeeName} on ${formatDate(record.date)}`}
                          title="Attendance actions"
                          icon={<Text fontSize="xl" lineHeight="1">⋮</Text>}
                          size="sm"
                          variant="ghost"
                        />
                        <MenuList>
                          <MenuItem icon={<EditIcon />} onClick={() => openEdit(record)}>Edit attendance</MenuItem>
                        </MenuList>
                      </Menu>
                    </Td>
                  )}
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}
      <HStack justify="space-between" flexWrap="wrap" gap={3} px={{ base: 3, md: 4 }} py={3} borderTop="1px solid" borderColor="slate.100">
        <Text fontSize="sm" color="slate.500">Showing {firstRecord}-{lastRecord} of {total}</Text>
        <Pagination currentPage={page} totalPages={totalPages} isDisabled={isLoading || Boolean(loadError)} onPageChange={setPage} />
      </HStack>

      {canEdit && (
        <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} size="md">
          <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(3px)" />
          <ModalContent borderRadius="xl">
            <ModalHeader>Edit attendance</ModalHeader>
            <ModalCloseButton isDisabled={isSaving} />
            <ModalBody>
              <Text mb={4} fontSize="sm" color="slate.600">
                {editingRecord?.employeeName} · {editingRecord ? formatDate(editingRecord.date) : ''}
              </Text>
              <FormControl>
                <FormLabel>Status</FormLabel>
                <Select value={editingStatus} onChange={(event) => setEditingStatus(event.target.value as AttendanceStatus)}>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                </Select>
              </FormControl>
              {saveError && <Alert mt={4} status="error">{saveError}</Alert>}
            </ModalBody>
            <ModalFooter gap={3}>
              <ActionButton tone="neutral" onClick={() => setIsEditOpen(false)} isDisabled={isSaving}>Cancel</ActionButton>
              <ActionButton onClick={() => void saveAttendance()} isLoading={isSaving}>Save changes</ActionButton>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </Box>
  );
}

export default OrganizationAttendanceHistory;