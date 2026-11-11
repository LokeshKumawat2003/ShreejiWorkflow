import { DownloadIcon } from '@chakra-ui/icons';
import { Alert, Box, Button, HStack, Stack, Text, useToast } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import {
  ActionButton,
  ContentCard,
  FilterBar,
  FilterField,
  FilterInput,
  MapPinIcon,
  PageHeader,
  PeopleIcon,
  PrintIcon,
  WalletIcon,
} from '../../components/ui';
import { ApiError } from '../../services/api';
import {
  cancelPayrollRun,
  createPayrollRun,
  getLocationsPayroll,
  getPayrollRun,
  getPayrollRunLocations,
  listPayrollRuns,
  logPayrollRunActivity,
  type BankInvoiceBatch,
  type BankInvoiceLocationsResponse,
  type LocationsPayrollResponse,
} from '../../services/attendanceService';
import { addRowsSheet, addTableSheet, createWorkbook, downloadWorkbook } from '../../utils/excelOutput';
import LocationPicker, { isSelectable } from '../BankInvoice/components/LocationPicker';
import PrintedHistory from '../BankInvoice/components/PrintedHistory';
import { PayrollSummary, PayrollTable, type PayrollSelection } from './components/PayrollShared';
import { PAYROLL_PAGE_SIZE } from './hooks/usePayroll';
import { downloadSalarySlipsPdf } from './utils/salarySlipPdf';

type ExportKind = 'pdf' | 'excel' | 'print';

type EmployeeScope = 'all' | 'selected';

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

function monthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

async function exportExcel(payroll: LocationsPayrollResponse, reference: string) {
  const workbook = await createWorkbook();
  const payPeriod = `${payroll.fromDate} to ${payroll.toDate}`;
  addTableSheet(workbook, 'Payroll', [
    { header: 'Employee', width: 24, value: (line) => line.employeeName },
    { header: 'Organization', width: 24, value: (line) => line.organizationName },
    { header: 'Location', width: 24, value: (line) => line.locationName || '' },
    { header: 'Designation', width: 18, value: (line) => line.designation || '' },
    { header: 'Bank name', width: 20, value: (line) => line.bankName },
    { header: 'Branch', width: 18, value: (line) => line.bankBranch },
    { header: 'Account holder', width: 24, value: (line) => line.bankAccountHolder },
    { header: 'Account number', width: 20, value: (line) => line.bankAccountNumber },
    { header: 'IFSC', width: 16, value: (line) => line.bankRoutingCode },
    { header: 'Daily wage', width: 14, value: (line) => line.dailyWage ?? line.dailySalary },
    { header: 'Present', width: 10, value: (line) => line.presentDays },
    { header: 'Half days', width: 10, value: (line) => line.halfDays ?? 0 },
    { header: 'Absent', width: 10, value: (line) => line.absentDays },
    { header: 'Paid days', width: 12, value: (line) => line.paidDays },
    { header: 'Wages', width: 14, value: (line) => line.wages ?? line.grossPay },
    { header: 'Bonus', width: 12, value: (line) => line.bonus ?? 0 },
    { header: 'Total wages', width: 14, value: (line) => line.totalWages ?? line.grossPay },
    { header: 'EPF', width: 10, value: (line) => line.epf ?? 0 },
    { header: 'ESI', width: 10, value: (line) => line.esi ?? 0 },
    { header: 'Net payable', width: 16, value: (line) => line.netPay ?? line.grossPay },
  ], payroll.lines);

  addRowsSheet(workbook, 'Totals', [
    ['Reference', reference],
    ['Pay period', payPeriod],
    ['Employees', payroll.summary.employees],
    [],
    ['Currency', 'Total payable'],
    ...(payroll.netTotals ?? payroll.totals).map(({ currency, total }) => [currency, total]),
  ], [24, 30]);
  await downloadWorkbook(workbook, `payroll-${payroll.month}.xlsx`);
}

async function makeExport(kind: ExportKind, payroll: LocationsPayrollResponse, reference: string) {
  if (kind === 'excel') await exportExcel(payroll, reference);
  else await downloadSalarySlipsPdf(payroll.lines, payroll.fromDate, payroll.toDate, kind === 'print' ? 'print' : 'download');
}

function AdminPayrollPage() {
  const toast = useToast();
  const [month, setMonth] = useState(() => monthValue(new Date()));
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [payroll, setPayroll] = useState<LocationsPayrollResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [locationsData, setLocationsData] = useState<BankInvoiceLocationsResponse | null>(null);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState('');
  const [batches, setBatches] = useState<BankInvoiceBatch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [batchesError, setBatchesError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [busyBatch, setBusyBatch] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [employeeScope, setEmployeeScope] = useState<EmployeeScope>('all');
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSelected([]);
  }, [month]);

  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(month)) return undefined;
    const controller = new AbortController();
    setLocationsLoading(true);
    setLocationsError('');
    setBatchesLoading(true);
    setBatchesError('');
    void getPayrollRunLocations(month, controller.signal)
      .then((result) => {
        setLocationsData(result);
        const selectable = new Set(result.organizations.flatMap((organization) => organization.locations).filter(isSelectable).map((location) => location.locationId));
        setSelected((current) => {
          const kept = current.filter((id) => selectable.has(id));
          return kept.length === current.length ? current : kept;
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLocationsData(null);
        setLocationsError(errorMessage(error, 'Unable to load locations.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLocationsLoading(false);
      });
    void listPayrollRuns(month, controller.signal)
      .then(setBatches)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setBatches([]);
        setBatchesError(errorMessage(error, 'Unable to load payroll history.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setBatchesLoading(false);
      });
    return () => controller.abort();
  }, [month, refreshKey]);

  const selectionKey = useMemo(() => [...selected].sort().join(','), [selected]);

  useEffect(() => {
    setPage(1);
    setSelectedEmployees(new Set());
  }, [selectionKey, month]);

  const selection: PayrollSelection = {
    selectedIds: selectedEmployees,
    onToggle: (employeeId) => setSelectedEmployees((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    }),
    onTogglePage: (employeeIds, checked) => setSelectedEmployees((current) => {
      const next = new Set(current);
      for (const id of employeeIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    }),
  };
  const choosing = employeeScope === 'selected';

  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(month) || !selectionKey) {
      setPayroll(null);
      setLoadError('');
      setIsLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError('');
    void getLocationsPayroll({ month, locationIds: selectionKey.split(','), page, limit: PAYROLL_PAGE_SIZE }, controller.signal)
      .then((result) => {
        setPayroll(result);
        if (result.pagination && result.pagination.page !== page) setPage(result.pagination.page);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setPayroll(null);
        setLoadError(errorMessage(error, 'Unable to load payroll.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [month, page, selectionKey]);

  const canExport = selected.length > 0 && Boolean(payroll) && (payroll?.summary.employees ?? 0) > 0 && !isLoading && !exporting
    && (!choosing || selectedEmployees.size > 0);

  async function runExport(kind: ExportKind) {
    setExporting(kind);
    try {
      const result = await createPayrollRun({
        month,
        locationIds: selected,
        format: kind,
        ...(choosing ? { employeeIds: [...selectedEmployees] } : {}),
      });
      setSelected([]);
      setRefreshKey((key) => key + 1);
      toast({
        title: `${result.batch.reference} saved`,
        description: result.batch.partial
          ? `${result.batch.employees} selected employee${result.batch.employees === 1 ? '' : 's'} exported. Their locations stay pending because not everyone was included.`
          : `${result.batch.locations.length} location${result.batch.locations.length === 1 ? '' : 's'} marked as printed for ${result.payroll.periodLabel}.`,
        status: 'success',
        position: 'top',
      });
      await makeExport(kind, result.payroll, result.batch.reference);
    } catch (error) {
      toast({ title: errorMessage(error, 'Unable to export payroll.'), status: 'error', position: 'top' });
      if (error instanceof ApiError && error.status === 409) setRefreshKey((key) => key + 1);
    } finally {
      setExporting(null);
    }
  }

  async function reprint(batch: BankInvoiceBatch, kind: ExportKind) {
    setBusyBatch(`${batch.id}:${kind}`);
    try {
      const result = await getPayrollRun(batch.id);
      await makeExport(kind, result.payroll, result.batch.reference);
      const updated = await logPayrollRunActivity(batch.id, kind);
      setBatches((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      toast({ title: errorMessage(error, 'Unable to export payroll again.'), status: 'error', position: 'top' });
    } finally {
      setBusyBatch(null);
    }
  }

  async function cancelBatch(batch: BankInvoiceBatch, location: BankInvoiceBatch['locations'][number]) {
    try {
      await cancelPayrollRun(batch.id, location.locationId);
      setRefreshKey((key) => key + 1);
      toast({ title: `${location.locationName} cancelled`, description: `It is pending again. Other locations on ${batch.reference} stay printed.`, status: 'success', position: 'top' });
    } catch (error) {
      toast({ title: errorMessage(error, 'Unable to cancel the payroll run.'), status: 'error', position: 'top' });
    }
  }

  return (
    <Stack spacing={6}>
      <PageHeader
        eyebrow="Finance"
        title="Payroll"
        description="Pick locations from any organizations, then download salary slips, Excel or print. Exported locations are marked as printed for the month, so only pending ones are left to do."
      />

      {selected.length > 0 ? <PayrollSummary payroll={payroll} /> : null}

      <ContentCard
        icon={<MapPinIcon boxSize={5} />}
        title="Locations"
        subtitle={locationsData ? `${locationsData.periodLabel} · tick locations from one or more organizations to run payroll for them together` : 'Choose a month'}
        actions={(
          <HStack spacing={3} align="flex-end">
            <ActionButton
              tone={showHistory ? 'primary' : 'neutral'}
              h="40px"
              leftIcon={showHistory ? <WalletIcon boxSize={4} /> : <PrintIcon boxSize={4} />}
              onClick={() => setShowHistory((value) => !value)}
            >
              {showHistory ? 'Payroll results' : `Printed history${batchesLoading ? '' : ` (${batches.length})`}`}
            </ActionButton>
            <FilterField label="Month" flex="0 0 180px">
              <FilterInput aria-label="Payroll month" type="month" value={month} max={monthValue(new Date())} onChange={(event) => event.target.value && setMonth(event.target.value)} />
            </FilterField>
          </HStack>
        )}
      >
        <LocationPicker
          data={locationsData}
          isLoading={locationsLoading}
          error={locationsError}
          selected={selected}
          onChange={(locationIds) => {
            setSelected(locationIds);
            if (locationIds.length > 0) setShowHistory(false);
          }}
        />
      </ContentCard>

      {showHistory ? (
        <ContentCard
          noPadding
          icon={<PrintIcon boxSize={5} />}
          title="Printed history"
          subtitle={locationsData ? `Payroll exported for ${locationsData.periodLabel}. Cancel an entry to make its locations pending again.` : 'Payroll exported this month'}
          actions={(
            <ActionButton tone="neutral" size="sm" borderRadius="full" leftIcon={<WalletIcon boxSize={4} />} onClick={() => setShowHistory(false)}>
              Back to payroll results
            </ActionButton>
          )}
        >
          <PrintedHistory
            variant="payroll"
            batches={batches}
            isLoading={batchesLoading}
            error={batchesError}
            busyId={busyBatch}
            onReprint={(batch, kind) => void reprint(batch, kind)}
            onCancel={cancelBatch}
          />
        </ContentCard>
      ) : (
        <ContentCard
          noPadding
          icon={<PeopleIcon boxSize={5} />}
          title="Payroll results"
          subtitle={selected.length === 0
            ? 'Select locations above to see their payroll'
            : !payroll ? 'Loading…'
              : choosing
                ? `${payroll.periodLabel} · ${selectedEmployees.size} of ${payroll.summary.employees} employees chosen · locations stay pending unless everyone is chosen`
                : `${payroll.periodLabel} · all ${payroll.summary.employees} employees · exporting marks the selected locations as printed`}
          toolbar={selected.length > 0 ? (
            <FilterBar variant="inset">
              <FilterField label="Employees" flex={{ base: '1 1 100%', md: '0 0 300px' }}>
                <ScopeToggle
                  scope={employeeScope}
                  onChange={(scope) => {
                    setEmployeeScope(scope);
                    setSelectedEmployees(new Set());
                  }}
                />
              </FilterField>
              {choosing ? (
                <HStack spacing={2} alignSelf="flex-end" h="40px">
                  <Box px={3} py={1} borderRadius="full" bg={selectedEmployees.size ? 'brand.500' : 'slate.100'} color={selectedEmployees.size ? 'white' : 'slate.500'} fontSize="xs" fontWeight="700">
                    {selectedEmployees.size} selected
                  </Box>
                  <Button size="sm" variant="ghost" borderRadius="full" color="slate.600" isDisabled={selectedEmployees.size === 0} onClick={() => setSelectedEmployees(new Set())}>
                    Clear
                  </Button>
                  <Text fontSize="xs" color="slate.500">Tick employees below; selections are kept across pages.</Text>
                </HStack>
              ) : null}
            </FilterBar>
          ) : undefined}
          actions={(
            <>
              <ActionButton size="sm" borderRadius="full" leftIcon={<DownloadIcon />} isDisabled={!canExport} isLoading={exporting === 'pdf'} onClick={() => void runExport('pdf')}>
                Salary slips
              </ActionButton>
              <ActionButton tone="neutral" size="sm" borderRadius="full" leftIcon={<DownloadIcon />} isDisabled={!canExport} isLoading={exporting === 'excel'} onClick={() => void runExport('excel')}>
                Excel
              </ActionButton>
              <ActionButton tone="neutral" size="sm" borderRadius="full" leftIcon={<PrintIcon boxSize={4} />} isDisabled={!canExport} isLoading={exporting === 'print'} onClick={() => void runExport('print')}>
                Print
              </ActionButton>
            </>
          )}
        >
          {loadError ? <Alert status="error" borderRadius="md" m={4} w="auto">{loadError}</Alert> : null}
          <PayrollTable
            payroll={selected.length > 0 ? payroll : null}
            pageSize={PAYROLL_PAGE_SIZE}
            onPageChange={setPage}
            isLoading={isLoading}
            selection={choosing ? selection : undefined}
            emptyTitle={selected.length === 0 ? 'Select locations to run payroll' : 'No payroll lines'}
            emptyDescription={selected.length === 0
              ? 'Tick pending locations above. You can mix locations from different organizations in one run.'
              : 'None of the employees at these locations have attendance this month.'}
          />
        </ContentCard>
      )}
    </Stack>
  );
}

export default AdminPayrollPage;
