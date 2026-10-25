import { AttachmentIcon, CalendarIcon, DownloadIcon } from '@chakra-ui/icons';
import {
  Alert,
  Badge,
  Box,
  Button,
  HStack,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { ActionButton, FilterInput, PrintIcon } from '../../../components/ui';
import { addTableSheet, createWorkbook, downloadWorkbook } from '../../../utils/excelOutput';
import { finishPdf, type PdfAction } from '../../../utils/pdfOutput';
import { ApiError } from '../../../services/api';
import { listAttendance, markAttendance, type AttendanceEntry, type AttendanceStatus } from '../../../services/attendanceService';
import type { UserRole } from '../../../types';
import AttendanceUploadDialog from './AttendanceUploadDialog';

type AttendancePageProps = {
  role: UserRole;
  organizationId?: string;
  locationId?: string;
};

function currentLocalDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatAttendanceDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
    .format(new Date(year, month - 1, day));
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function AttendancePage({ role, organizationId, locationId }: AttendancePageProps) {
  const toast = useToast();
  const [date, setDate] = useState(currentLocalDate);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState<{ employeeId: string; status: AttendanceStatus } | null>(null);
  const isOrganizationUser = role === 'organization';
  const canMarkAttendance = isOrganizationUser || Boolean(organizationId);
  const canUploadAttendance = role === 'admin' && Boolean(organizationId) && Boolean(locationId);

  useEffect(() => {
    if (!isOrganizationUser) return undefined;
    const timer = window.setInterval(() => setDate(currentLocalDate()), 60_000);
    return () => window.clearInterval(timer);
  }, [isOrganizationUser]);

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError('');
    void listAttendance(date, organizationId, controller.signal, locationId)
      .then((result) => {
        if (isActive) setEntries(result.attendance);
      })
      .catch((error: unknown) => {
        if (isActive && !controller.signal.aborted) {
          setLoadError(errorMessage(error, 'Unable to load attendance.'));
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    return () => {
      isActive = false;
      controller.abort();
    };
  }, [date, locationId, organizationId, refreshToken]);

  async function exportPdf(action: PdfAction = 'download') {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const document = new jsPDF({ orientation: 'landscape', format: 'a4' });
    document.setFontSize(16);
    document.text('Attendance report', 14, 16);
    document.setFontSize(10);
    document.text(`Date: ${date}`, 14, 23);
    autoTable(document, {
      startY: 29,
      head: [['Employee', 'Email', 'Department', 'Job title', 'Status']],
      body: entries.map((entry) => [
        entry.name,
        entry.email,
        entry.department || '—',
        entry.jobTitle || '—',
        entry.status ? entry.status.toUpperCase() : 'NOT MARKED',
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [79, 70, 229] },
      theme: 'grid',
    });
    finishPdf(document, `attendance-${date}.pdf`, action);
  }

  async function exportExcel() {
    const workbook = await createWorkbook();
    addTableSheet(workbook, 'Attendance', [
      { header: 'Employee', width: 24, value: (entry) => entry.name },
      { header: 'Email', width: 30, value: (entry) => entry.email },
      { header: 'Department', width: 20, value: (entry) => entry.department || '' },
      { header: 'Job title', width: 20, value: (entry) => entry.jobTitle || '' },
      { header: 'Status', width: 14, value: (entry) => (entry.status ? entry.status.toUpperCase() : 'NOT MARKED') },
    ], entries);
    await downloadWorkbook(workbook, `attendance-${date}.xlsx`);
  }

  async function updateAttendance(employeeId: string, status: AttendanceStatus) {
    setSavingAttendance({ employeeId, status });
    try {
      const record = await markAttendance({
        employeeId,
        date,
        status,
        organizationId,
        locationId,
        ...(isOrganizationUser ? { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } : {}),
      });
      setEntries((current) => current.map((entry) => (
        entry.employeeId === employeeId
          ? { ...entry, status: record.status, updatedAt: record.updatedAt }
          : entry
      )));
      toast({ title: 'Attendance saved', status: 'success', position: 'top' });
    } catch (error) {
      toast({ title: errorMessage(error, 'Unable to save attendance.'), status: 'error', position: 'top' });
    } finally {
      setSavingAttendance(null);
    }
  }

  return (
    <Box bg="white" border="1px solid" borderColor="slate.200" borderRadius="8px" overflow="hidden">
      <HStack justify="space-between" flexWrap="wrap" gap={4} px={{ base: 3, md: 4 }} py={4} borderBottom="1px solid" borderColor="slate.100">
        <HStack spacing={2} color="slate.600">
          <CalendarIcon />
          <Text fontSize="sm" fontWeight="600">Daily attendance</Text>
        </HStack>
        <HStack flexWrap="wrap" spacing={2}>
          {canUploadAttendance ? (
            <>
              <ActionButton tone="neutral" size="sm" leftIcon={<AttachmentIcon />} onClick={() => setIsUploadOpen(true)}>
                Upload attendance
              </ActionButton>
              <ActionButton
                tone="neutral"
                size="sm"
                leftIcon={<DownloadIcon />}
                isDisabled={isLoading || Boolean(loadError) || entries.length === 0}
                onClick={() => void exportPdf()}
              >
                Export PDF
              </ActionButton>
              <ActionButton
                tone="neutral"
                size="sm"
                leftIcon={<DownloadIcon />}
                isDisabled={isLoading || Boolean(loadError) || entries.length === 0}
                onClick={() => void exportExcel()}
              >
                Export Excel
              </ActionButton>
              <ActionButton
                tone="neutral"
                size="sm"
                leftIcon={<PrintIcon boxSize={4} />}
                isDisabled={isLoading || Boolean(loadError) || entries.length === 0}
                onClick={() => void exportPdf('print')}
              >
                Print
              </ActionButton>
            </>
          ) : null}
          {isOrganizationUser ? (
            <Text fontSize="sm" fontWeight="600" color="slate.700">{formatAttendanceDate(date)}</Text>
          ) : (
            <FilterInput
              aria-label="Attendance date"
              type="date"
              value={date}
              max={currentLocalDate()}
              maxW="190px"
              onChange={(event) => setDate(event.target.value)}
            />
          )}
        </HStack>
      </HStack>

      {loadError ? (
        <Alert status="error">{loadError}</Alert>
      ) : (
        <TableContainer>
          <Table variant="simple" size="md" fontSize="sm">
            <Thead>
              <Tr>
                <Th fontSize="xs">Employee</Th>
                <Th fontSize="xs">Department</Th>
                <Th fontSize="xs">Job title</Th>
                <Th fontSize="xs">Attendance</Th>
              </Tr>
            </Thead>
            <Tbody>
              {isLoading ? (
                <Tr><Td colSpan={4} textAlign="center" py={10}><Spinner color="brand.500" /></Td></Tr>
              ) : entries.length === 0 ? (
                <Tr><Td colSpan={4} textAlign="center" py={10} color="slate.500">No employees assigned to this organization.</Td></Tr>
              ) : entries.map((entry) => {
                const isSaving = savingAttendance?.employeeId === entry.employeeId;
                return (
                <Tr key={entry.employeeId}>
                  <Td>
                    <Text fontWeight="600" color="slate.900">{entry.name}</Text>
                    <Text fontSize="xs" color="slate.500">{entry.email}</Text>
                  </Td>
                  <Td>{entry.department || '—'}</Td>
                  <Td>{entry.jobTitle || '—'}</Td>
                  <Td>
                    {canMarkAttendance && entry.canMark ? (
                      <HStack spacing={2} flexWrap="wrap">
                        <Button
                          aria-pressed={entry.status === 'present'}
                          aria-label={`Mark ${entry.name} present`}
                          size="sm"
                          h="34px"
                          minW="82px"
                          fontSize="xs"
                          colorScheme="green"
                          variant={entry.status === 'present' ? 'solid' : 'outline'}
                          isDisabled={isSaving}
                          isLoading={isSaving && savingAttendance?.status === 'present'}
                          onClick={() => updateAttendance(entry.employeeId, 'present')}
                        >
                          Present
                        </Button>
                        <Button
                          aria-pressed={entry.status === 'absent'}
                          aria-label={`Mark ${entry.name} absent`}
                          size="sm"
                          h="34px"
                          minW="78px"
                          fontSize="xs"
                          colorScheme="red"
                          variant={entry.status === 'absent' ? 'solid' : 'outline'}
                          isDisabled={isSaving}
                          isLoading={isSaving && savingAttendance?.status === 'absent'}
                          onClick={() => updateAttendance(entry.employeeId, 'absent')}
                        >
                          Absent
                        </Button>
                      </HStack>
                    ) : (
                      <Badge
                        px={3}
                        py={1}
                        borderRadius="full"
                        color={entry.status === 'present' ? 'green.600' : entry.status ? 'orange.600' : 'slate.500'}
                        bg={entry.status === 'present' ? 'green.50' : entry.status ? 'orange.50' : 'slate.100'}
                        fontSize="xs"
                        fontWeight="600"
                      >
                        {entry.status ? entry.status.toUpperCase() : 'NOT MARKED'}
                      </Badge>
                    )}
                  </Td>
                </Tr>
                );
              })}
            </Tbody>
          </Table>
        </TableContainer>
      )}
      {canMarkAttendance && !loadError && (
        <Text px={4} py={3} fontSize="xs" color="slate.500" borderTop="1px solid" borderColor="slate.100">
          Attendance is saved as each employee is marked.
        </Text>
      )}
      {canUploadAttendance && organizationId && locationId ? (
        <AttendanceUploadDialog
          isOpen={isUploadOpen}
          date={date}
          organizationId={organizationId}
          locationId={locationId}
          onClose={() => setIsUploadOpen(false)}
          onSaved={(result) => {
            setDate(result.date);
            setRefreshToken((current) => current + 1);
            const updated = result.updated || 0;
            const details = [
              updated ? `${updated} saved record${updated === 1 ? '' : 's'} updated` : '',
              result.skippedDuplicates ? `${result.skippedDuplicates} duplicate${result.skippedDuplicates === 1 ? '' : 's'} skipped` : '',
              result.skippedInvalid ? `${result.skippedInvalid} invalid` : '',
              result.skippedBlocked ? `${result.skippedBlocked} skipped for blocked employees` : '',
            ].filter(Boolean);
            toast({
              title: `${result.saved} attendance record${result.saved === 1 ? '' : 's'} saved`,
              description: details.length ? `${details.join(', ')}.` : undefined,
              status: 'success',
              position: 'top',
            });
          }}
        />
      ) : null}
    </Box>
  );
}

export default AttendancePage;