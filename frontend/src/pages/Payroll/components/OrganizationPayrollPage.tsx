import { DownloadIcon } from '@chakra-ui/icons';
import { Stack, useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { ActionButton, ContentCard, FilterBar, WalletIcon } from '../../../components/ui';
import { ApiError } from '../../../services/api';
import type { PayrollResponse } from '../../../services/attendanceService';
import { usePayroll } from '../hooks/usePayroll';
import { downloadSalarySlipsPdf } from '../utils/salarySlipPdf';
import { formatAmount, PayrollSummary, PayrollTable, PeriodFields, periodLabel, thisMonthRange } from './PayrollShared';

type ExportKind = 'slips' | 'pdf' | 'excel';

type OrganizationPayrollPageProps = {
  organizationId?: string;
  locationId?: string;
};

function getExportFilename(fromDate: string, toDate: string) {
  return `payroll-${fromDate}-to-${toDate}`;
}

function OrganizationPayrollPage({ organizationId, locationId }: OrganizationPayrollPageProps) {
  const toast = useToast();
  const [{ fromDate, toDate }, setRange] = useState(thisMonthRange);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const invalidRange = fromDate > toDate;
  const payrollState = usePayroll(invalidRange ? null : { fromDate, toDate, organizationId, locationId });
  const { payroll, isLoading } = payrollState;
  const loadError = invalidRange ? 'The start date must be on or before the end date.' : payrollState.error;
  const canExport = Boolean(payroll && payroll.summary.employees > 0 && !isLoading && !loadError && !exporting);

  async function runExport(kind: ExportKind) {
    setExporting(kind);
    try {
      const fullPayroll = await payrollState.fetchAll();
      if (kind === 'slips') await downloadSalarySlipsPdf(fullPayroll.lines, fromDate, toDate);
      else if (kind === 'pdf') await exportPdf(fullPayroll);
      else await exportExcel(fullPayroll);
    } catch (error) {
      toast({ title: error instanceof ApiError ? error.message : 'Unable to export payroll.', status: 'error', position: 'top' });
    } finally {
      setExporting(null);
    }
  }

  async function exportPdf(payroll: PayrollResponse) {
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

  async function exportExcel(payroll: PayrollResponse) {
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

  return (
    <Stack spacing={5}>
      <PayrollSummary payroll={payroll} />

      <ContentCard
        noPadding
        icon={<WalletIcon boxSize={5} />}
        title="Payroll"
        subtitle={`${periodLabel(fromDate, toDate)} · calculated from attendance`}
        actions={(
          <>
            <ActionButton size="sm" borderRadius="full" leftIcon={<DownloadIcon />} isDisabled={!canExport} isLoading={exporting === 'slips'} onClick={() => void runExport('slips')}>
              Salary slips
            </ActionButton>
            <ActionButton tone="neutral" size="sm" borderRadius="full" leftIcon={<DownloadIcon />} isDisabled={!canExport} isLoading={exporting === 'pdf'} onClick={() => void runExport('pdf')}>
              PDF
            </ActionButton>
            <ActionButton tone="neutral" size="sm" borderRadius="full" leftIcon={<DownloadIcon />} isDisabled={!canExport} isLoading={exporting === 'excel'} onClick={() => void runExport('excel')}>
              Excel
            </ActionButton>
          </>
        )}
        toolbar={(
          <FilterBar variant="inset">
            <PeriodFields fromDate={fromDate} toDate={toDate} onChange={setRange} />
          </FilterBar>
        )}
      >
        <PayrollTable
          payroll={payroll}
          pageSize={payrollState.pageSize}
          onPageChange={payrollState.setPage}
          isLoading={isLoading}
          error={loadError}
          emptyTitle="No payroll for this period"
          emptyDescription="No employees or attendance records were found between these dates."
        />
      </ContentCard>
    </Stack>
  );
}

export default OrganizationPayrollPage;
