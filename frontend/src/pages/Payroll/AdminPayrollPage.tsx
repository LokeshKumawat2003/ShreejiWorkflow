import { CheckIcon, DownloadIcon, InfoOutlineIcon } from '@chakra-ui/icons';
import { Alert, Box, Button, Flex, HStack, SimpleGrid, Skeleton, Stack, Text, useToast } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import {
  ActionButton,
  ContentCard,
  EmptyState,
  FilterBar,
  FilterField,
  PageHeader,
  PeopleIcon,
  SearchInput,
  TableFooter,
  WalletIcon,
} from '../../components/ui';
import { ApiError } from '../../services/api';
import type { PayrollResponse } from '../../services/attendanceService';
import { listEmployees } from '../../services/employeeService';
import type { Employee } from '../../types';
import { PayrollSummary, PayrollTable, PeriodFields, periodLabel, thisMonthRange } from './components/PayrollShared';
import { usePayroll, type PayrollQuery } from './hooks/usePayroll';
import { downloadSalarySlipsPdf } from './utils/salarySlipPdf';

const EMPLOYEE_PAGE_SIZE = 9;

type EmployeeScope = 'all' | 'selected';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || ''}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase() || '?';
}

function ScopeToggle({ scope, onChange }: { scope: EmployeeScope; onChange: (scope: EmployeeScope) => void }) {
  return (
    <HStack spacing={1} p={1} h="40px" bg="white" border="1px solid" borderColor="slate.200" borderRadius="10px">
      {([['all', 'All employees'], ['selected', 'Choose employees']] as const).map(([value, label]) => {
        const isActive = scope === value;
        return (
          <Button
            key={value}
            size="xs"
            h="30px"
            px={3}
            flex="1"
            borderRadius="8px"
            fontWeight="600"
            variant="ghost"
            bg={isActive ? 'brand.500' : 'transparent'}
            color={isActive ? 'white' : 'slate.600'}
            _hover={{ bg: isActive ? 'brand.600' : 'slate.100' }}
            onClick={() => onChange(value)}
          >
            {label}
          </Button>
        );
      })}
    </HStack>
  );
}

function EmployeeChoice({ employee, isSelected, onToggle }: { employee: Employee; isSelected: boolean; onToggle: () => void }) {
  return (
    <HStack
      as="button"
      type="button"
      onClick={onToggle}
      aria-pressed={isSelected}
      spacing={3}
      w="100%"
      p={3}
      textAlign="left"
      bg={isSelected ? 'brand.50' : 'white'}
      border="1px solid"
      borderColor={isSelected ? 'brand.300' : 'slate.200'}
      borderRadius="12px"
      boxShadow={isSelected ? '0 0 0 3px rgba(79, 70, 229, 0.12)' : 'none'}
      transition="all 0.15s ease"
      _hover={{ borderColor: isSelected ? 'brand.400' : 'slate.300', boxShadow: isSelected ? '0 0 0 3px rgba(79, 70, 229, 0.18)' : 'sm' }}
      _focusVisible={{ outline: 'none', boxShadow: '0 0 0 3px rgba(79, 70, 229, 0.3)' }}
    >
      <Box
        display="grid"
        placeItems="center"
        flexShrink={0}
        w="38px"
        h="38px"
        borderRadius="10px"
        bg={isSelected ? 'brand.500' : 'slate.100'}
        color={isSelected ? 'white' : 'slate.600'}
        fontSize="12px"
        fontWeight="800"
        transition="all 0.15s ease"
      >
        {isSelected ? <CheckIcon boxSize={3.5} /> : initialsOf(employee.name)}
      </Box>
      <Box minW={0} flex="1">
        <Text fontSize="sm" fontWeight="700" color="slate.900" noOfLines={1}>{employee.name}</Text>
        <Text fontSize="xs" color="slate.500" noOfLines={1}>
          {[employee.designation, employee.organizationName].filter(Boolean).join(' · ') || employee.email}
        </Text>
      </Box>
    </HStack>
  );
}

function AdminPayrollPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeePage, setEmployeePage] = useState(1);
  const [employeeTotal, setEmployeeTotal] = useState(0);
  const [employeeTotalPages, setEmployeeTotalPages] = useState(1);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [employeeError, setEmployeeError] = useState('');
  const [scope, setScope] = useState<EmployeeScope>('all');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const toast = useToast();
  const [{ fromDate, toDate }, setRange] = useState(thisMonthRange);
  const [runQuery, setRunQuery] = useState<PayrollQuery | null>(null);
  const [runCount, setRunCount] = useState(0);
  const [payrollScope, setPayrollScope] = useState<EmployeeScope>('all');
  const [isExporting, setIsExporting] = useState<'slips' | 'excel' | null>(null);
  const payrollState = usePayroll(runQuery, runCount);
  const { payroll } = payrollState;
  const isGenerating = payrollState.isLoading && !payroll;
  const generationError = payrollState.error;
  const invalidDateRange = fromDate > toDate;
  const canGenerate = !invalidDateRange && !isLoadingEmployees && (scope === 'all' || selectedEmployeeIds.length > 0);

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

  function changeScope(next: EmployeeScope) {
    setScope(next);
    setRunQuery(null);
  }

  function toggleEmployee(employeeId: string) {
    setSelectedEmployeeIds((current) => (
      current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId]
    ));
    setRunQuery(null);
  }

  const allOnPageSelected = employees.length > 0 && employees.every((employee) => selectedEmployeeIds.includes(employee.id));

  function togglePage() {
    const pageIds = employees.map((employee) => employee.id);
    setSelectedEmployeeIds((current) => (
      allOnPageSelected
        ? current.filter((id) => !pageIds.includes(id))
        : [...new Set([...current, ...pageIds])]
    ));
    setRunQuery(null);
  }

  function generatePayroll() {
    if (!canGenerate) return;
    setRunQuery({ fromDate, toDate, ...(scope === 'selected' ? { employeeIds: selectedEmployeeIds } : {}) });
    setRunCount((current) => current + 1);
    setPayrollScope(scope);
  }

  async function runExport(kind: 'slips' | 'excel') {
    setIsExporting(kind);
    try {
      const fullPayroll = await payrollState.fetchAll();
      if (kind === 'slips') await downloadSalarySlipsPdf(fullPayroll.lines, fullPayroll.fromDate, fullPayroll.toDate);
      else await exportExcel(fullPayroll);
    } catch (error) {
      toast({ title: errorMessage(error, 'Unable to export payroll.'), status: 'error', position: 'top' });
    } finally {
      setIsExporting(null);
    }
  }

  async function exportExcel(payroll: PayrollResponse) {
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
      ['Employee scope', payrollScope === 'all' ? 'All employees' : `${payroll.summary.employees} selected employees`],
      [],
      ['Currency', 'Total payable'],
      ...payroll.totals.map(({ currency, total }) => [currency, total]),
    ]);
    totalsSheet['!cols'] = [{ wch: 24 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, totalsSheet, 'Totals');
    XLSX.writeFile(workbook, `payroll-${payroll.fromDate}-to-${payroll.toDate}.xlsx`);
  }

  const runSummary = scope === 'all'
    ? `All ${employeeTotal} assigned employees · ${periodLabel(fromDate, toDate)}`
    : `${selectedEmployeeIds.length} selected employee${selectedEmployeeIds.length === 1 ? '' : 's'} · ${periodLabel(fromDate, toDate)}`;

  return (
    <Stack spacing={6}>
      <PageHeader
        eyebrow="Finance"
        title="Payroll"
        description="Run attendance-based payroll for any period and download salary slips."
      />

      <ContentCard
        noPadding
        icon={<WalletIcon boxSize={5} />}
        title="Run payroll"
        subtitle="Pick a pay period and who to include, then generate."
        toolbar={(
          <FilterBar variant="inset">
            <PeriodFields
              fromDate={fromDate}
              toDate={toDate}
              onChange={(range) => {
                setRange(range);
                setRunQuery(null);
              }}
            />
            <FilterField label="Employees" flex={{ base: '1 1 100%', md: '0 0 280px' }}>
              <ScopeToggle scope={scope} onChange={changeScope} />
            </FilterField>
          </FilterBar>
        )}
        footer={(
          <Flex justify="space-between" align="center" gap={3} flexWrap="wrap">
            <HStack spacing={2} color="slate.600" fontSize="sm" minW={0}>
              <InfoOutlineIcon color="brand.500" />
              <Text noOfLines={1}>{runSummary}</Text>
            </HStack>
            <ActionButton
              borderRadius="full"
              px={6}
              leftIcon={<WalletIcon boxSize={4} />}
              isLoading={isGenerating}
              loadingText="Generating"
              isDisabled={!canGenerate}
              onClick={generatePayroll}
            >
              Generate payroll
            </ActionButton>
          </Flex>
        )}
      >
        {invalidDateRange ? (
          <Box p={4}><Alert status="error" borderRadius="md">The start date must be on or before the end date.</Alert></Box>
        ) : scope === 'all' ? (
          <HStack spacing={4} px={{ base: 4, md: 5 }} py={5}>
            <Box display="grid" placeItems="center" flexShrink={0} w="44px" h="44px" borderRadius="12px" bg="brand.50" color="brand.600">
              <PeopleIcon boxSize={5} />
            </Box>
            <Box>
              <Text fontWeight="700" color="slate.900">
                {isLoadingEmployees && employeeTotal === 0 ? 'Counting employees…' : `${employeeTotal} assigned employee${employeeTotal === 1 ? '' : 's'} will be included`}
              </Text>
              <Text fontSize="sm" color="slate.500">Across every organization and location. Switch to “Choose employees” to pick specific people.</Text>
            </Box>
          </HStack>
        ) : (
          <Box>
            <Flex px={{ base: 4, md: 5 }} pt={4} gap={3} justify="space-between" align="center" flexWrap="wrap">
              <SearchInput
                maxW={{ md: '360px' }}
                flex="1"
                value={employeeSearch}
                onChange={(value) => { setEmployeeSearch(value); setEmployeePage(1); }}
                placeholder="Search employees..."
                label="Search employees for payroll"
              />
              <HStack spacing={2}>
                <Box px={3} py={1} borderRadius="full" bg={selectedEmployeeIds.length ? 'brand.500' : 'slate.100'} color={selectedEmployeeIds.length ? 'white' : 'slate.500'} fontSize="xs" fontWeight="700">
                  {selectedEmployeeIds.length} selected
                </Box>
                <Button size="sm" variant="outline" borderRadius="full" borderColor="slate.200" color="slate.700" isDisabled={employees.length === 0 || isLoadingEmployees} onClick={togglePage}>
                  {allOnPageSelected ? 'Unselect page' : 'Select page'}
                </Button>
                <Button size="sm" variant="ghost" borderRadius="full" color="slate.600" isDisabled={selectedEmployeeIds.length === 0} onClick={() => { setSelectedEmployeeIds([]); setRunQuery(null); }}>
                  Clear
                </Button>
              </HStack>
            </Flex>

            <Box px={{ base: 4, md: 5 }} py={4}>
              {employeeError ? (
                <Alert status="error" borderRadius="md">{employeeError}</Alert>
              ) : isLoadingEmployees && employees.length === 0 ? (
                <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={3}>
                  {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} h="64px" borderRadius="12px" />)}
                </SimpleGrid>
              ) : employees.length > 0 ? (
                <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={3} opacity={isLoadingEmployees ? 0.6 : 1}>
                  {employees.map((employee) => (
                    <EmployeeChoice
                      key={employee.id}
                      employee={employee}
                      isSelected={selectedEmployeeIds.includes(employee.id)}
                      onToggle={() => toggleEmployee(employee.id)}
                    />
                  ))}
                </SimpleGrid>
              ) : (
                <EmptyState title={employeeSearch ? 'No matching employees' : 'No assigned employees'} description={employeeSearch ? 'Try a different name.' : 'Assign employees to a location first.'} />
              )}
            </Box>

            {employeeTotal > 0 ? (
              <TableFooter
                page={employeePage}
                pageSize={EMPLOYEE_PAGE_SIZE}
                total={employeeTotal}
                totalPages={Math.max(employeeTotalPages, 1)}
                noun="employees"
                isDisabled={isLoadingEmployees}
                onPageChange={setEmployeePage}
              />
            ) : null}
          </Box>
        )}
      </ContentCard>

      {generationError ? <Alert status="error" borderRadius="md">{generationError}</Alert> : null}

      {payroll ? (
        <Stack spacing={5}>
          <PayrollSummary payroll={payroll} />
          <ContentCard
            noPadding
            icon={<PeopleIcon boxSize={5} />}
            title="Payroll results"
            subtitle={`${periodLabel(payroll.fromDate, payroll.toDate)} · ${payrollScope === 'all' ? 'All employees' : `${payroll.summary.employees} selected`}`}
            actions={(
              <>
                <ActionButton size="sm" borderRadius="full" leftIcon={<DownloadIcon />} isDisabled={payroll.summary.employees === 0 || Boolean(isExporting)} isLoading={isExporting === 'slips'} onClick={() => void runExport('slips')}>
                  Salary slips
                </ActionButton>
                <ActionButton tone="neutral" size="sm" borderRadius="full" leftIcon={<DownloadIcon />} isDisabled={payroll.summary.employees === 0 || Boolean(isExporting)} isLoading={isExporting === 'excel'} onClick={() => void runExport('excel')}>
                  Excel
                </ActionButton>
              </>
            )}
          >
            <PayrollTable
              payroll={payroll}
              pageSize={payrollState.pageSize}
              onPageChange={payrollState.setPage}
              isLoading={payrollState.isLoading}
              emptyTitle="No payroll lines"
              emptyDescription="None of the chosen employees have attendance in this period."
            />
          </ContentCard>
        </Stack>
      ) : !isGenerating ? (
        <Box bg="white" border="1px dashed" borderColor="slate.300" borderRadius="lg">
          <EmptyState
            icon={<WalletIcon boxSize={5} />}
            title="No payroll generated yet"
            description="Choose a period above and click “Generate payroll” to see totals, attendance and salary slips."
          />
        </Box>
      ) : null}
    </Stack>
  );
}

export default AdminPayrollPage;
