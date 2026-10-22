import { DownloadIcon } from '@chakra-ui/icons';
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  SimpleGrid,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { ActionButton, Pagination, SearchInput } from '../../components/ui';
import { ApiError } from '../../services/api';
import { getPayroll, type PayrollLine, type PayrollResponse } from '../../services/attendanceService';
import { listEmployees } from '../../services/employeeService';
import type { Employee } from '../../types';
import { downloadSalarySlipsPdf } from './utils/salarySlipPdf';

const EMPLOYEE_PAGE_SIZE = 10;

type EmployeeScope = 'all' | 'selected';

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

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function totalByCurrency(lines: PayrollLine[]) {
  const totals = new Map<string, number>();
  for (const line of lines) {
    totals.set(line.currency, (totals.get(line.currency) || 0) + line.grossPay);
  }
  return [...totals.entries()].map(([currency, total]) => ({
    currency,
    total: Math.round((total + Number.EPSILON) * 100) / 100,
  }));
}

function AdminPayrollPage() {
  const today = new Date();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeePage, setEmployeePage] = useState(1);
  const [employeeTotal, setEmployeeTotal] = useState(0);
  const [employeeTotalPages, setEmployeeTotalPages] = useState(1);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [employeeError, setEmployeeError] = useState('');
  const [scope, setScope] = useState<EmployeeScope>('all');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState(localDateString(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [toDate, setToDate] = useState(localDateString(today));
  const [payroll, setPayroll] = useState<PayrollResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const invalidDateRange = fromDate > toDate;
  const employeePageFirst = employeeTotal === 0 ? 0 : (employeePage - 1) * EMPLOYEE_PAGE_SIZE + 1;
  const employeePageLast = Math.min(employeePage * EMPLOYEE_PAGE_SIZE, employeeTotal);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingEmployees(true);
    setEmployeeError('');
    void listEmployees({
      search: employeeSearch,
      status: 'all',
      sort: 'name-asc',
      page: employeePage,
      limit: EMPLOYEE_PAGE_SIZE,
      assignedOnly: true,
    }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setEmployees(result.employees);
        setEmployeeTotal(result.pagination.total);
        setEmployeeTotalPages(result.pagination.totalPages);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setEmployeeError(errorMessage(error, 'Unable to load employees.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingEmployees(false);
      });
    return () => controller.abort();
  }, [employeeSearch, employeePage]);

  function toggleEmployee(employeeId: string, isSelected: boolean) {
    setSelectedEmployeeIds((current) => (
      isSelected
        ? current.includes(employeeId) ? current : [...current, employeeId]
        : current.filter((id) => id !== employeeId)
    ));
    setPayroll(null);
  }

  async function generatePayroll() {
    if (invalidDateRange || (scope === 'selected' && selectedEmployeeIds.length === 0)) return;

    setIsGenerating(true);
    setGenerationError('');
    setPayroll(null);
    try {
      const result = await getPayroll({ fromDate, toDate });
      const lines = scope === 'all'
        ? result.lines
        : result.lines.filter((line) => selectedEmployeeIds.includes(line.employeeId));
      setPayroll({ ...result, lines, totals: totalByCurrency(lines) });
    } catch (error) {
      setGenerationError(errorMessage(error, 'Unable to generate payroll.'));
    } finally {
      setIsGenerating(false);
    }
  }

  async function exportExcel() {
    if (!payroll) return;

    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    const detailRows = payroll.lines.map((line) => ({
      Employee: line.employeeName,
      Email: line.employeeEmail,
      Organization: line.organizationName || 'All organizations',
      Currency: line.currency,
      'Bank name': line.bankName,
      Branch: line.bankBranch,
      'Account holder': line.bankAccountHolder,
      'Account number': line.bankAccountNumber,
      'Routing / IFSC': line.bankRoutingCode,
      'Daily salary': line.dailySalary,
      Present: line.presentDays,
      Absent: line.absentDays,
      'Paid days': line.paidDays,
      'Gross pay': line.grossPay,
      'Pay period': `${payroll.fromDate} to ${payroll.toDate}`,
    }));
    const detailSheet = XLSX.utils.json_to_sheet(detailRows);
    detailSheet['!cols'] = [
      { wch: 24 }, { wch: 30 }, { wch: 24 }, { wch: 12 }, { wch: 20 },
      { wch: 18 }, { wch: 24 }, { wch: 20 }, { wch: 18 }, { wch: 16 },
      { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 26 },
    ];
    XLSX.utils.book_append_sheet(workbook, detailSheet, 'Payroll');

    const totalsSheet = XLSX.utils.aoa_to_sheet([
      ['Organization scope', 'All organizations'],
      ['Pay period', `${payroll.fromDate} to ${payroll.toDate}`],
      ['Employee scope', scope === 'all' ? 'All employees' : `${payroll.lines.length} selected employees`],
      [],
      ['Currency', 'Total payable'],
      ...payroll.totals.map(({ currency, total }) => [currency, total]),
    ]);
    totalsSheet['!cols'] = [{ wch: 24 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, totalsSheet, 'Totals');
    XLSX.writeFile(workbook, `payroll-${payroll.fromDate}-to-${payroll.toDate}.xlsx`);
  }

  return (
    <VStack align="stretch" spacing={6}>
      <Box>
        <Heading size="lg" color="slate.900">Payroll</Heading>
        <Text mt={1} fontSize="sm" color="slate.500">Generate attendance-based payroll and employee salary slips.</Text>
      </Box>

      <Box bg="white" border="1px solid" borderColor="slate.200" borderRadius="8px" overflow="hidden">
        <Box px={{ base: 4, md: 6 }} py={4} borderBottom="1px solid" borderColor="slate.100">
          <Text fontSize="md" fontWeight="700" color="slate.900">Payroll setup</Text>
          <Text mt={1} fontSize="sm" color="slate.500">Choose an organization, pay period, and employee group.</Text>
        </Box>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} p={{ base: 4, md: 6 }} alignItems="end">
          <FormControl isRequired isInvalid={invalidDateRange}>
            <FormLabel mb={1} fontSize="sm" fontWeight="600">From date</FormLabel>
            <Input aria-label="Payroll start date" h="42px" type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPayroll(null); }} />
          </FormControl>
          <FormControl isRequired isInvalid={invalidDateRange}>
            <FormLabel mb={1} fontSize="sm" fontWeight="600">To date</FormLabel>
            <Input aria-label="Payroll end date" h="42px" type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPayroll(null); }} />
          </FormControl>
        </SimpleGrid>
        {invalidDateRange && <Alert status="error" borderRadius={0}>The start date must be on or before the end date.</Alert>}

        <Flex px={{ base: 4, md: 6 }} py={4} borderTop="1px solid" borderColor="slate.100" align="center" justify="space-between" gap={4} flexWrap="wrap">
          <Box>
            <Text fontSize="sm" fontWeight="600" color="slate.700">Employees</Text>
            <Text fontSize="xs" color="slate.500">
              {`${employeeTotal} assigned employees across all organizations`}
            </Text>
          </Box>
          <ButtonGroup isAttached size="sm" variant="outline">
            <Button
              colorScheme={scope === 'all' ? 'brand' : undefined}
              variant={scope === 'all' ? 'solid' : 'outline'}
              onClick={() => { setScope('all'); setPayroll(null); }}
            >
              All employees
            </Button>
            <Button
              colorScheme={scope === 'selected' ? 'brand' : undefined}
              variant={scope === 'selected' ? 'solid' : 'outline'}
              onClick={() => { setScope('selected'); setPayroll(null); }}
            >
              Select employees
            </Button>
          </ButtonGroup>
        </Flex>

        {scope === 'selected' && (
          <Box px={{ base: 4, md: 6 }} pb={5}>
            <HStack justify="space-between" flexWrap="wrap" gap={3} mb={3}>
              <SearchInput
                maxW="360px"
                value={employeeSearch}
                onChange={(value) => { setEmployeeSearch(value); setEmployeePage(1); }}
                placeholder="Search employees..."
                label="Search employees for payroll"
              />
              <HStack>
                <Badge colorScheme="brand" px={3} py={1} borderRadius="full">{selectedEmployeeIds.length} selected</Badge>
                <Button size="sm" variant="ghost" color="slate.600" isDisabled={selectedEmployeeIds.length === 0} onClick={() => { setSelectedEmployeeIds([]); setPayroll(null); }}>
                  Clear selection
                </Button>
              </HStack>
            </HStack>
            {employeeError && <Alert mb={3} status="error">{employeeError}</Alert>}
            {isLoadingEmployees ? (
              <HStack justify="center" py={8}><Spinner color="brand.500" /></HStack>
            ) : employees.length > 0 ? (
              <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={3}>
                {employees.map((employee) => {
                  const isSelected = selectedEmployeeIds.includes(employee.id);
                  return (
                    <Box key={employee.id} minH="76px" display="flex" alignItems="center" px={3} py={2} border="1px solid" borderColor={isSelected ? 'brand.200' : 'slate.200'} borderRadius="md" bg={isSelected ? 'brand.50' : 'white'}>
                      <Checkbox w="100%" colorScheme="brand" isChecked={isSelected} onChange={(event) => toggleEmployee(employee.id, event.target.checked)}>
                        <HStack spacing={3} ml={2} minW={0}>
                          <Avatar size="sm" name={employee.name} />
                          <Box minW={0}>
                            <Text fontSize="sm" fontWeight="600" color="slate.900" noOfLines={1}>{employee.name}</Text>
                            <Text fontSize="xs" color="slate.500" noOfLines={1}>{employee.email} · {employee.organizationName}</Text>
                          </Box>
                        </HStack>
                      </Checkbox>
                    </Box>
                  );
                })}
              </SimpleGrid>
            ) : (
              <Text py={6} textAlign="center" color="slate.500">{employeeSearch ? 'No employees match this search.' : 'No employees in this organization.'}</Text>
            )}
            {employeeTotalPages > 1 && (
              <HStack justify="space-between" mt={4}>
                <Text fontSize="sm" color="slate.500">Showing {employeePageFirst}-{employeePageLast} of {employeeTotal}</Text>
                <Pagination currentPage={employeePage} totalPages={employeeTotalPages} isDisabled={isLoadingEmployees} onPageChange={setEmployeePage} />
              </HStack>
            )}
          </Box>
        )}

        <Flex justify="flex-end" px={{ base: 4, md: 6 }} py={4} borderTop="1px solid" borderColor="slate.100">
          <ActionButton
            isLoading={isGenerating}
            loadingText="Generating payroll"
            isDisabled={invalidDateRange || isLoadingEmployees || (scope === 'selected' && selectedEmployeeIds.length === 0)}
            onClick={() => void generatePayroll()}
          >
            Generate payroll
          </ActionButton>
        </Flex>
      </Box>

      {generationError && <Alert status="error">{generationError}</Alert>}

      {payroll && (
        <Box bg="white" border="1px solid" borderColor="slate.200" borderRadius="8px" overflow="hidden">
          <Flex px={{ base: 4, md: 6 }} py={4} justify="space-between" align="center" flexWrap="wrap" gap={4} borderBottom="1px solid" borderColor="slate.100">
            <Box>
              <Heading size="md" color="slate.900">Payroll results</Heading>
              <Text mt={1} fontSize="sm" color="slate.500">
                All organizations · {payroll.fromDate} to {payroll.toDate} · {scope === 'all' ? 'All employees' : `${payroll.lines.length} selected`}
              </Text>
            </Box>
            <HStack flexWrap="wrap" spacing={2}>
              <ActionButton tone="neutral" size="sm" leftIcon={<DownloadIcon />} isDisabled={payroll.lines.length === 0} onClick={() => void downloadSalarySlipsPdf(payroll.lines, payroll.fromDate, payroll.toDate)}>
                Download salary slips
              </ActionButton>
              <ActionButton tone="neutral" size="sm" leftIcon={<DownloadIcon />} isDisabled={payroll.lines.length === 0} onClick={() => void exportExcel()}>
                Export Excel
              </ActionButton>
            </HStack>
          </Flex>
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={4} p={{ base: 4, md: 6 }}>
            {payroll.totals.map(({ currency, total }) => (
              <Box key={currency} pl={3} borderLeft="3px solid" borderColor="brand.500">
                <Text fontSize="xs" fontWeight="700" color="slate.500">TOTAL PAYROLL · {currency}</Text>
                <Text mt={1} fontSize="xl" fontWeight="700" color="slate.900">{formatAmount(total, currency)}</Text>
              </Box>
            ))}
          </SimpleGrid>
          <TableContainer>
            <Table variant="simple" size="md" fontSize="sm" minW="760px">
              <Thead bg="slate.50">
                <Tr>
                  <Th fontSize="xs">Employee</Th>
                  <Th fontSize="xs" isNumeric>Daily salary</Th>
                  <Th fontSize="xs" isNumeric>Present</Th>
                  <Th fontSize="xs" isNumeric>Absent</Th>
                  <Th fontSize="xs" isNumeric>Paid days</Th>
                  <Th fontSize="xs" isNumeric>Payable</Th>
                </Tr>
              </Thead>
              <Tbody>
                {payroll.lines.length === 0 ? (
                  <Tr><Td colSpan={6} py={8} textAlign="center" color="slate.500">No payroll lines for this selection.</Td></Tr>
                ) : payroll.lines.map((line) => (
                  <Tr key={line.employeeId}>
                    <Td>
                      <Text fontWeight="600" color="slate.900">{line.employeeName}</Text>
                      <Text fontSize="xs" color="slate.500">{line.employeeEmail}</Text>
                    </Td>
                    <Td isNumeric whiteSpace="nowrap">{formatAmount(line.dailySalary, line.currency)}</Td>
                    <Td isNumeric>{line.presentDays}</Td>
                    <Td isNumeric>{line.absentDays}</Td>
                    <Td isNumeric fontWeight="600">{line.paidDays}</Td>
                    <Td isNumeric whiteSpace="nowrap" fontWeight="700">{formatAmount(line.grossPay, line.currency)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
          <HStack justify="space-between" flexWrap="wrap" gap={2} px={{ base: 4, md: 6 }} py={3} borderTop="1px solid" borderColor="slate.100">
            <Text fontSize="sm" color="slate.500">Daily salary × present days</Text>
            <Text fontSize="sm" color="slate.500">Absent and unmarked days are unpaid</Text>
          </HStack>
        </Box>
      )}
    </VStack>
  );
}

export default AdminPayrollPage;
