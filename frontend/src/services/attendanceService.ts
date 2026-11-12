import api from './api';
import type { BankLetterSettings } from './settingsService';

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'half_day'
  | 'leave'
  | 'paid_leave'
  | 'casual_leave'
  | 'sick_leave'
  | 'weekly_off'
  | 'holiday';

/** A day in an upload preview: a saveable status, or a mark the admin still has to check. */
export type UploadMarkStatus = AttendanceStatus | 'needs_review';

export type MarkConfidence = 'high' | 'medium' | 'low';

export type AttendanceMarkDetail = {
  mark: string;
  confidence: MarkConfidence;
  suggested: AttendanceStatus | null;
  reason: string;
  crop: string;
};

export type AttendanceSymbol = { symbol: string; status: AttendanceStatus };

export type AttendanceEntry = {
  employeeId: string;
  name: string;
  email: string;
  jobTitle: string;
  department: string;
  employeeStatus: 'active' | 'disabled';
  canMark: boolean;
  status: AttendanceStatus | null;
  updatedAt: string | null;
};

export type AttendanceHistoryEntry = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeePhone: string;
  employeeCreatedAt: string | null;
  bankName: string;
  bankBranch: string;
  bankAccountHolder: string;
  bankAccountNumber: string;
  bankRoutingCode: string;
  organizationName: string;
  organizationPhone: string;
  organizationAddress: string;
  organizationWebsite: string;
  department: string;
  jobTitle: string;
  date: string;
  status: AttendanceStatus;
  source?: 'manual' | 'upload';
  sourceMark?: string;
  updatedAt: string;
};

type AttendanceListResponse = {
  date: string;
  attendance: AttendanceEntry[];
};

type AttendanceHistoryResponse = {
  records: AttendanceHistoryEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type AttendanceHistoryParams = {
  organizationId?: string;
  locationId?: string;
  page: number;
  limit: number;
  search: string;
  status: 'all' | AttendanceStatus;
  fromDate?: string;
  toDate?: string;
};

export type PayrollLine = {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeePhone: string;
  employeeCreatedAt: string | null;
  bankName: string;
  bankBranch: string;
  bankAccountHolder: string;
  bankAccountNumber: string;
  bankRoutingCode: string;
  organizationName: string;
  organizationPhone: string;
  organizationAddress: string;
  organizationWebsite: string;
  designation?: string;
  skillCategory?: string;
  department: string;
  jobTitle: string;
  basicPay?: number;
  dearnessAllowance?: number;
  epfoApplicable?: boolean;
  esicApplicable?: boolean;
  currency: string;
  dailySalary: number;
  presentDays: number;
  absentDays: number;
  halfDays?: number;
  paidLeaveDays?: number;
  otherLeaveDays?: number;
  paidDays: number;
  grossPay: number;
  dailyWage?: number;
  wages?: number;
  /** Overtime hours entered on the wage register for the period. */
  overtimeHours?: number;
  overtimeRate?: number;
  overtimeWages?: number;
  bonus?: number;
  totalWages?: number;
  epf?: number;
  esi?: number;
  netPay?: number;
  locationId?: string;
  locationName?: string;
};

export type WageRates = {
  bonusRate: number;
  epfRate: number;
  epfWageCeiling: number;
  esiRate: number;
  esiWageCeiling: number;
  overtimeHoursPerDay: number;
  overtimeRateMultiplier: number;
};

export type PayrollResponse = {
  fromDate: string;
  toDate: string;
  paidStatuses: AttendanceStatus[];
  lines: PayrollLine[];
  totals: { currency: string; total: number }[];
  netTotals?: { currency: string; total: number }[];
  rates?: WageRates;
  summary: { employees: number; presentDays: number; absentDays: number; paidDays: number };
  pagination?: { page: number; limit: number; total: number; totalPages: number };
};

export type PayrollParams = {
  fromDate: string;
  toDate: string;
  organizationId?: string;
  locationId?: string;
  employeeIds?: string[];
  page?: number;
  limit?: number;
};

export async function listAttendanceHistory(params: AttendanceHistoryParams, signal?: AbortSignal) {
  const { data } = await api.get<AttendanceHistoryResponse>('/attendance/history', { params, signal });
  return data;
}

export async function listAttendance(date: string, organizationId?: string, signal?: AbortSignal, locationId?: string) {
  const { data } = await api.get<AttendanceListResponse>('/attendance', {
    params: { date, ...(organizationId ? { organizationId } : {}), ...(locationId ? { locationId } : {}) },
    signal,
  });
  return data;
}

export async function getPayroll({ employeeIds, ...params }: PayrollParams, signal?: AbortSignal) {
  const { data } = await api.get<PayrollResponse>('/attendance/payroll', {
    params: {
      ...params,
      ...(employeeIds ? { employeeIds: employeeIds.join(',') } : {}),
    },
    signal,
  });
  return data;
}

export type WageRegisterRow = {
  serial: number;
  employeeId: string;
  employeeName: string;
  parentName: string;
  showParentName: boolean;
  post: string;
  workingDays: number;
  dailyWage: number;
  wages: number;
  overtimeHours: number;
  overtimeRate: number;
  overtimeWages: number;
  bonus: number;
  totalWages: number;
  epf: number;
  esi: number;
  grossPayment: number;
};

export type WageRegisterResponse = {
  month: string;
  fromDate: string;
  toDate: string;
  periodLabel: string;
  header: {
    title: string;
    formTitle: string;
    contractorName: string;
    note: string;
    signatoryCompany: string;
    signatoryTitle: string;
    signatureImage: string;
    organizationName: string;
    workName: string;
    address: string;
    opNumber: string;
  };
  rates: WageRates;
  rows: WageRegisterRow[];
  /** Overtime totals are only sent when someone on the register has overtime. */
  totals: Omit<WageRegisterRow, 'serial' | 'employeeId' | 'employeeName' | 'parentName' | 'showParentName' | 'post' | 'dailyWage' | 'overtimeHours' | 'overtimeRate' | 'overtimeWages'>
    & { employees: number; overtimeHours?: number; overtimeWages?: number };
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export async function getWageRegister(
  params: { organizationId: string; locationId: string; month: string; page?: number; limit?: number },
  signal?: AbortSignal,
) {
  const { data } = await api.get<WageRegisterResponse>('/attendance/wage-register', { params, signal });
  return data;
}

/** Saves an employee's overtime hours for a month on a location's wage register; 0 removes them. */
export async function setOvertimeHours(input: { organizationId: string; locationId: string; employeeId: string; month: string; hours: string }) {
  const { data } = await api.put<{ overtime: { employeeId: string; month: string; hours: number } }>('/attendance/overtime', {
    ...input,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  return data.overtime;
}

export type BankPaymentRow = {
  serial: number;
  employeeId: string;
  employeeName: string;
  organizationId: string;
  locationId: string;
  organizationName: string;
  locationName: string;
  designation: string;
  workingDays: number;
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  bankBranch: string;
  amount: number;
  missingBankDetails: boolean;
};

export type BankPaymentsResponse = {
  month: string;
  fromDate: string;
  toDate: string;
  periodLabel: string;
  referencePrefix: string;
  letter: BankLetterSettings;
  rows: BankPaymentRow[];
  summary: { employees: number; total: number; missingBankDetails: number; banks: number };
  pagination?: { page: number; limit: number; total: number; totalPages: number };
};

export type BankPaymentsParams = {
  month: string;
  organizationId?: string;
  locationId?: string;
  locationIds?: string[];
  search?: string;
  page?: number;
  limit?: number;
};

export async function getBankPayments(params: BankPaymentsParams, signal?: AbortSignal) {
  const { locationIds, ...rest } = params;
  const { data } = await api.get<BankPaymentsResponse>('/attendance/bank-payments', {
    params: Object.fromEntries(Object.entries({ ...rest, locationIds: locationIds?.join(',') })
      .filter(([, value]) => value !== undefined && value !== '')),
    signal,
  });
  return data;
}

export type BankInvoiceLocation = {
  locationId: string;
  locationName: string;
  locationStatus: 'active' | 'disabled';
  employees: number;
  total: number;
  missingBankDetails: number;
  status: 'pending' | 'printed';
  batchId: string | null;
  reference: string;
  printedAt: string | null;
};

export type BankInvoiceOrganization = {
  organizationId: string;
  organizationName: string;
  locations: BankInvoiceLocation[];
};

export type BankInvoiceLocationsResponse = {
  month: string;
  periodLabel: string;
  referencePrefix: string;
  nextReference: string;
  organizations: BankInvoiceOrganization[];
  summary: { locations: number; printed: number; pending: number };
};

export type BankInvoiceBatch = {
  id: string;
  kind: 'bank' | 'payroll';
  month: string;
  reference: string;
  referenceNumber: string;
  letterDate: string;
  chequeNumber: string;
  skipMissing: boolean;
  format: 'pdf' | 'excel' | 'print';
  status: 'printed' | 'cancelled';
  partial?: boolean;
  employees: number;
  total: number;
  locations: {
    organizationId: string;
    locationId: string;
    organizationName: string;
    locationName: string;
    employees: number;
    total: number;
    status: 'printed' | 'cancelled';
    cancelledAt: string | null;
  }[];
  createdAt: string;
  cancelledAt: string | null;
  activity: BankInvoiceActivity[];
};

export type BankInvoiceActivity = {
  action: 'pdf' | 'excel' | 'print' | 'cancel';
  reprint: boolean;
  locationName: string;
  byName: string;
  at: string;
};

export type BankInvoiceBatchResponse = BankPaymentsResponse & { batch: BankInvoiceBatch };

export type CreateBankInvoicePayload = {
  month: string;
  locationIds: string[];
  letterDate: string;
  referenceNumber: string;
  chequeNumber: string;
  skipMissing: boolean;
  format: 'pdf' | 'excel' | 'print';
};

export async function getBankInvoiceLocations(month: string, signal?: AbortSignal) {
  const { data } = await api.get<BankInvoiceLocationsResponse>('/attendance/bank-invoice/locations', { params: { month }, signal });
  return data;
}

export async function listBankInvoiceBatches(month: string, signal?: AbortSignal) {
  const { data } = await api.get<{ batches: BankInvoiceBatch[] }>('/attendance/bank-invoice/batches', { params: { month }, signal });
  return data.batches;
}

export async function createBankInvoiceBatch(payload: CreateBankInvoicePayload) {
  const { data } = await api.post<BankInvoiceBatchResponse>('/attendance/bank-invoice/batches', payload);
  return data;
}

export async function getBankInvoiceBatch(id: string) {
  const { data } = await api.get<BankInvoiceBatchResponse>(`/attendance/bank-invoice/batches/${id}`);
  return data;
}

export async function logBankInvoiceActivity(id: string, action: 'pdf' | 'excel' | 'print') {
  const { data } = await api.post<{ batch: BankInvoiceBatch }>(`/attendance/bank-invoice/batches/${id}/activity`, { action });
  return data.batch;
}

export async function cancelBankInvoiceBatch(id: string, locationId?: string) {
  const { data } = await api.post<{ batch: BankInvoiceBatch }>(`/attendance/bank-invoice/batches/${id}/cancel`, locationId ? { locationId } : {});
  return data.batch;
}

export type LocationsPayrollResponse = PayrollResponse & { month: string; periodLabel: string };

export type PayrollRunResponse = { batch: BankInvoiceBatch; payroll: LocationsPayrollResponse };

export async function getPayrollRunLocations(month: string, signal?: AbortSignal) {
  const { data } = await api.get<BankInvoiceLocationsResponse>('/attendance/payroll-runs/locations', { params: { month }, signal });
  return data;
}

export async function getLocationsPayroll(params: { month: string; locationIds: string[]; page?: number; limit?: number }, signal?: AbortSignal) {
  const { data } = await api.get<LocationsPayrollResponse>('/attendance/payroll-runs/preview', {
    params: { ...params, locationIds: params.locationIds.join(',') },
    signal,
  });
  return data;
}

export async function listPayrollRuns(month: string, signal?: AbortSignal) {
  const { data } = await api.get<{ batches: BankInvoiceBatch[] }>('/attendance/payroll-runs/batches', { params: { month }, signal });
  return data.batches;
}

export async function createPayrollRun(payload: { month: string; locationIds: string[]; employeeIds?: string[]; format: 'pdf' | 'excel' | 'print' }) {
  const { data } = await api.post<PayrollRunResponse>('/attendance/payroll-runs/batches', payload);
  return data;
}

export async function getPayrollRun(id: string) {
  const { data } = await api.get<PayrollRunResponse>(`/attendance/payroll-runs/batches/${id}`);
  return data;
}

export async function logPayrollRunActivity(id: string, action: 'pdf' | 'excel' | 'print') {
  const { data } = await api.post<{ batch: BankInvoiceBatch }>(`/attendance/payroll-runs/batches/${id}/activity`, { action });
  return data.batch;
}

export async function cancelPayrollRun(id: string, locationId?: string) {
  const { data } = await api.post<{ batch: BankInvoiceBatch }>(`/attendance/payroll-runs/batches/${id}/cancel`, locationId ? { locationId } : {});
  return data.batch;
}

export type AttendanceRegisterMark = 'P' | 'A' | 'HD' | 'L' | 'PL' | 'CL' | 'SL' | 'WO' | 'H' | '';

export type AttendanceStats = {
  workingDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  paidLeaves: number;
  otherLeaves: number;
  casualLeaves: number;
  sickLeaves: number;
  weeklyOffs: number;
  holidays: number;
  paidDays: number;
  attendancePercentage: number;
};

export type AttendanceRegisterRow = {
  serial: number;
  employeeId: string;
  name: string;
  parentName: string;
  skillCategory: string;
  employeeStatus?: 'active' | 'disabled';
  disabledOn?: string;
  days: AttendanceRegisterMark[];
  totalPresent: number;
  stats?: AttendanceStats;
};

export type AttendanceRegister = {
  month: string;
  periodLabel: string;
  daysInMonth: number;
  contractor: { name: string; address: string; signatory: string };
  organizationName: string;
  location: { workName: string; name: string; address: string; opNumber: string };
  rows: AttendanceRegisterRow[];
  totalMandays: number;
  elapsedDays: number;
  summary: {
    employees: number;
    present: number;
    absent: number;
    unmarked: number;
    halfDays?: number;
    paidLeaves?: number;
    otherLeaves?: number;
    weeklyOffs?: number;
    holidays?: number;
    workingDays?: number;
    attendancePercentage?: number;
  };
  categories: string[];
  pagination: { page: number; limit: number; total: number; totalPages: number } | null;
};

export type AttendanceRegisterFilter = 'all' | 'absent' | 'full' | 'unmarked';

export async function getAttendanceRegister(
  params: {
    organizationId: string;
    locationId: string;
    month: string;
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    filter?: AttendanceRegisterFilter;
  },
  signal?: AbortSignal,
) {
  const { data } = await api.get<AttendanceRegister>('/attendance/register', {
    params: { ...params, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    signal,
  });
  return data;
}

export type AttendanceSheetScope = {
  organizationId: string;
  locationId: string;
  month: string;
};

export type AttendanceSheetMarks = Record<string, AttendanceRegisterMark[]>;

export type AttendanceSheetDraft = AttendanceSheetScope & {
  marks: AttendanceSheetMarks;
  updatedAt: string | null;
};

export async function getAttendanceSheetDraft(scope: AttendanceSheetScope, signal?: AbortSignal) {
  const { data } = await api.get<AttendanceSheetDraft>('/attendance/sheet', { params: scope, signal });
  return data;
}

export async function saveAttendanceSheetDraft(scope: AttendanceSheetScope, marks: AttendanceSheetMarks) {
  const { data } = await api.put<AttendanceSheetDraft>('/attendance/sheet', { ...scope, marks });
  return data;
}

export async function clearAttendanceSheetDraft(scope: AttendanceSheetScope) {
  await api.delete('/attendance/sheet', { params: scope });
}

export type AttendanceMatch = 'exact' | 'fuzzy' | 'ambiguous' | 'unmatched';

export type AttendanceParseEmployee = {
  employeeId: string;
  employeeName: string;
  parentName: string;
};

export type AttendanceParseRow = {
  extractedName: string;
  extractedParentName: string;
  employeeId: string | null;
  employeeName: string;
  parentName: string;
  status: AttendanceStatus | null;
  blocked?: boolean;
  match: AttendanceMatch;
  alreadyMarked: boolean;
  existingStatus: AttendanceStatus | null;
};

export type AttendancePeriod = {
  month: number;
  year: number;
  label: string;
};

export type AttendanceParseResponse = {
  date: string;
  dayColumn: number;
  selectedPeriod: AttendancePeriod;
  sheetPeriod: AttendancePeriod | null;
  warning: string;
  employees: AttendanceParseEmployee[];
  rows: AttendanceParseRow[];
};

export type AttendanceBulkResponse = {
  saved: number;
  updated: number;
  skippedDuplicates: number;
  skippedInvalid: number;
  skippedBlocked?: number;
  /** Days left blank because the employee already had 26 paid days in that month. */
  skippedOverLimit?: number;
};

export async function parseAttendanceSheet(
  file: File,
  input: { date: string; organizationId: string; locationId: string },
) {
  const body = new FormData();
  body.append('file', file);
  body.append('date', input.date);
  body.append('organizationId', input.organizationId);
  body.append('locationId', input.locationId);
  const { data } = await api.post<AttendanceParseResponse>('/attendance/parse', body);
  return data;
}

export type AttendanceMonthParseRow = {
  extractedName: string;
  extractedParentName: string;
  employeeId: string | null;
  employeeName: string;
  parentName: string;
  match: AttendanceMatch;
  marks: (UploadMarkStatus | null)[];
  details: (AttendanceMarkDetail | null)[];
  existing: (AttendanceStatus | null)[];
};

export type AttendanceMonthParseResponse = {
  uploadId: string | null;
  month: string;
  periodLabel: string;
  daysInMonth: number;
  lastImportableDay: number;
  sheetDays: number[];
  skippedFutureDays: number[];
  sheetPeriod: AttendancePeriod | null;
  warning: string;
  employees: AttendanceParseEmployee[];
  rows: AttendanceMonthParseRow[];
};

export async function parseAttendanceMonth(
  file: File,
  input: { month: string; organizationId: string; locationId: string },
) {
  const body = new FormData();
  body.append('file', file);
  body.append('month', input.month);
  body.append('organizationId', input.organizationId);
  body.append('locationId', input.locationId);
  body.append('timeZone', Intl.DateTimeFormat().resolvedOptions().timeZone);
  const { data } = await api.post<AttendanceMonthParseResponse>('/attendance/parse-month', body);
  return data;
}

export async function bulkMarkAttendance(input: {
  date?: string;
  organizationId: string;
  locationId: string;
  uploadId?: string;
  entries: { employeeId: string; status: AttendanceStatus; date?: string; replace?: boolean; mark?: string }[];
}) {
  const { data } = await api.post<AttendanceBulkResponse>('/attendance/bulk', {
    ...input,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  return data;
}

export async function getAttendanceSymbols() {
  const { data } = await api.get<{ symbols: AttendanceSymbol[] }>('/attendance/symbols');
  return data.symbols;
}

export async function saveAttendanceSymbols(symbols: AttendanceSymbol[]) {
  const { data } = await api.put<{ symbols: AttendanceSymbol[] }>('/attendance/symbols', { symbols });
  return data.symbols;
}

export async function markAttendance(input: {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  organizationId?: string;
  locationId?: string;
  timeZone?: string;
}) {
  const { data } = await api.put<{
    attendance: {
      employeeId: string;
      status: AttendanceStatus;
      updatedAt: string | null;
      date: string;
    };
  }>(
    '/attendance',
    { ...input, timeZone: input.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone },
  );
  return data.attendance;
}