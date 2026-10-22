import { DownloadIcon } from '@chakra-ui/icons';
import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Input,
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
import { ApiError } from '../../../services/api';
import { getPayroll, type PayrollResponse } from '../../../services/attendanceService';
import ActionButton from '../../../components/ui/ActionButton';

type OrganizationPayrollPageProps = {
  organizationId?: string;
  locationId?: string;
};

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function getExportFilename(fromDate: string, toDate: string) {
  return `payroll-${fromDate}-to-${toDate}`;
}

function OrganizationPayrollPage({ organizationId, locationId }: OrganizationPayrollPageProps) {
  const today = new Date();
  const [fromDate, setFromDate] = useState(localDateString(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [toDate, setToDate] = useState(localDateString(today));
  const [payroll, setPayroll] = useState<PayrollResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const invalidRange = fromDate > toDate;

  async function exportPdf() {
    if (!payroll) return;

    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const document = new jsPDF({ orientation: 'landscape' });
    document.setFontSize(16);
    document.text('Payroll report', 14, 16);
    document.setFontSize(10);
    document.text(`Period: ${fromDate} to ${toDate}`, 14, 23);
    autoTable(document, {
      startY: 29,
      head: [['Employee', 'Email', 'Daily salary', 'Present', 'Absent', 'Paid days', 'Pay']],
      body: payroll.lines.map((line) => [
        line.employeeName,
        line.employeeEmail,
        formatAmount(line.dailySalary, line.currency),
        line.presentDays,
        line.absentDays,
        line.paidDays,
        formatAmount(line.grossPay, line.currency),
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [79, 70, 229] },
      theme: 'grid',
    });

    const finalY = (document as InstanceType<typeof jsPDF> & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 30;
    autoTable(document, {
      startY: finalY + 7,
      head: [['Currency', 'Total payroll']],
      body: payroll.totals.map(({ currency, total }) => [currency, formatAmount(total, currency)]),
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [79, 70, 229] },
      theme: 'grid',
      tableWidth: 90,
    });
    document.save(`${getExportFilename(fromDate, toDate)}.pdf`);
  }

  async function exportExcel() {
    if (!payroll) return;

    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    const detailRows = payroll.lines.map((line) => ({
      Employee: line.employeeName,
      Email: line.employeeEmail,
      Department: line.department,
      'Job title': line.jobTitle,
      Currency: line.currency,
      'Daily salary': line.dailySalary,
      Present: line.presentDays,
      Absent: line.absentDays,
      'Paid days': line.paidDays,
      'Gross pay': line.grossPay,
    }));
    const detailsSheet = XLSX.utils.json_to_sheet(detailRows);
    detailsSheet['!cols'] = [
      { wch: 24 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 16 },
      { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(workbook, detailsSheet, 'Payroll');

    const totalsSheet = XLSX.utils.aoa_to_sheet([
      ['Payroll totals'],
      [`Period: ${fromDate} to ${toDate}`],
      [],
      ['Currency', 'Total payroll'],
      ...payroll.totals.map(({ currency, total }) => [currency, total]),
    ]);
    totalsSheet['!cols'] = [{ wch: 18 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, totalsSheet, 'Totals');
    XLSX.writeFile(workbook, `${getExportFilename(fromDate, toDate)}.xlsx`);
  }

  useEffect(() => {
    if (invalidRange) {
      setPayroll(null);
      setIsLoading(false);
      setLoadError('The start date must be on or before the end date.');
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setLoadError('');
    void getPayroll({ fromDate, toDate, organizationId, locationId }, controller.signal)
      .then(setPayroll)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof ApiError ? error.message : 'Unable to load payroll.');
        setPayroll(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [fromDate, toDate, organizationId, locationId, invalidRange]);

  return (
    <Box bg="white" border="1px solid" borderColor="slate.200" borderRadius="8px" overflow="hidden">
      <HStack align="center" justify="space-between" flexWrap="wrap" gap={4} px={{ base: 3, md: 4 }} py={4} borderBottom="1px solid" borderColor="slate.100">
        <Box>
          <Text fontSize="md" fontWeight="700" color="slate.900">Payroll</Text>
          <Text fontSize="sm" color="slate.500">
            {payroll ? `${payroll.lines.length} employees · ${fromDate} to ${toDate}` : 'Calculated from attendance'}
          </Text>
        </Box>
        <HStack flexWrap="wrap" spacing={2}>
          <ActionButton
            tone="neutral"
            size="sm"
            leftIcon={<DownloadIcon />}
            isDisabled={!payroll || payroll.lines.length === 0 || isLoading || Boolean(loadError)}
            onClick={exportPdf}
          >
            Export PDF
          </ActionButton>
          <ActionButton
            tone="neutral"
            size="sm"
            leftIcon={<DownloadIcon />}
            isDisabled={!payroll || payroll.lines.length === 0 || isLoading || Boolean(loadError)}
            onClick={exportExcel}
          >
            Export Excel
          </ActionButton>
        </HStack>
      </HStack>

      <Flex px={{ base: 3, md: 4 }} py={4} gap={4} align="flex-end" justify="space-between" flexWrap="wrap" borderBottom="1px solid" borderColor="slate.100">
        <HStack align="flex-end" spacing={3} flexWrap="wrap">
          <FormControl w={{ base: '100%', sm: '180px' }}>
            <FormLabel mb={1} ml={1} fontSize="xs" color="slate.500">From</FormLabel>
            <Input aria-label="Payroll start date" h="40px" fontSize="sm" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </FormControl>
          <FormControl w={{ base: '100%', sm: '180px' }}>
            <FormLabel mb={1} ml={1} fontSize="xs" color="slate.500">Through</FormLabel>
            <Input aria-label="Payroll end date" h="40px" fontSize="sm" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </FormControl>
        </HStack>
        <HStack spacing={6} flexWrap="wrap">
          {payroll?.totals.map(({ currency, total }) => (
            <Box key={currency} pl={3} borderLeft="3px solid" borderColor="brand.500">
              <Text fontSize="xs" fontWeight="700" color="slate.500">TOTAL PAYROLL · {currency}</Text>
              <Text fontSize="lg" fontWeight="700" color="slate.900">{formatAmount(total, currency)}</Text>
            </Box>
          ))}
        </HStack>
      </Flex>

      {loadError && <Alert status="error" borderRadius={0}>{loadError}</Alert>}
      <TableContainer>
        <Table variant="simple" size="md" fontSize="sm" minW="880px">
          <Thead bg="slate.50">
            <Tr>
              <Th fontSize="xs">Employee</Th>
              <Th fontSize="xs" isNumeric whiteSpace="nowrap">Daily salary</Th>
              <Th fontSize="xs" isNumeric>Present</Th>
              <Th fontSize="xs" isNumeric>Absent</Th>
              <Th fontSize="xs" isNumeric whiteSpace="nowrap">Paid days</Th>
              <Th fontSize="xs" isNumeric>Pay</Th>
            </Tr>
          </Thead>
          <Tbody>
            {isLoading ? (
              <Tr><Td colSpan={6} textAlign="center" py={10}><Spinner color="brand.500" /></Td></Tr>
            ) : loadError ? (
              <Tr><Td colSpan={6} textAlign="center" py={8} color="slate.500">Payroll could not be loaded.</Td></Tr>
            ) : payroll && payroll.lines.length > 0 ? payroll.lines.map((line) => (
              <Tr key={line.employeeId} _hover={{ bg: 'slate.50' }}>
                <Td>
                  <Text fontWeight="600" color="slate.900">{line.employeeName}</Text>
                  <Text fontSize="xs" color="slate.500">{line.employeeEmail}</Text>
                </Td>
                <Td isNumeric whiteSpace="nowrap">{formatAmount(line.dailySalary, line.currency)}</Td>
                <Td isNumeric>{line.presentDays}</Td>
                <Td isNumeric>{line.absentDays}</Td>
                <Td isNumeric fontWeight="600">{line.paidDays}</Td>
                <Td isNumeric whiteSpace="nowrap" fontWeight="700" color="slate.900">{formatAmount(line.grossPay, line.currency)}</Td>
              </Tr>
            )) : (
              <Tr><Td colSpan={6} textAlign="center" py={10} color="slate.500">No employees or attendance records for this period.</Td></Tr>
            )}
          </Tbody>
        </Table>
      </TableContainer>
      <HStack justify="space-between" flexWrap="wrap" gap={2} px={{ base: 3, md: 4 }} py={3} borderTop="1px solid" borderColor="slate.100">
        <Text fontSize="sm" color="slate.500">Daily salary × present days</Text>
        <Text fontSize="sm" color="slate.500">Absent and unmarked days are unpaid</Text>
      </HStack>
    </Box>
  );
}

export default OrganizationPayrollPage;
