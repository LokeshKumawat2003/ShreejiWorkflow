import api from './api';

export type AttendanceStatus = 'present' | 'absent';

export type AttendanceEntry = {
  employeeId: string;
  name: string;
  email: string;
  jobTitle: string;
  department: string;
  employeeStatus: 'active' | 'disabled';
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
  department: string;
  jobTitle: string;
  currency: string;
  dailySalary: number;
  presentDays: number;
  absentDays: number;
  paidDays: number;
  grossPay: number;
};

export type PayrollResponse = {
  fromDate: string;
  toDate: string;
  paidStatuses: AttendanceStatus[];
  lines: PayrollLine[];
  totals: { currency: string; total: number }[];
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
    loaReference: string;
    opNumber: string;
  };
  rates: { bonusRate: number; epfRate: number; epfWageCeiling: number; esiRate: number };
  rows: WageRegisterRow[];
  totals: Omit<WageRegisterRow, 'serial' | 'employeeId' | 'employeeName' | 'parentName' | 'showParentName' | 'post' | 'dailyWage'> & { employees: number };
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export async function getWageRegister(
  params: { organizationId: string; locationId: string; month: string; page?: number; limit?: number },
  signal?: AbortSignal,
) {
  const { data } = await api.get<WageRegisterResponse>('/attendance/wage-register', { params, signal });
  return data;
}

export type AttendanceRegisterMark = 'P' | 'A' | '';

export type AttendanceRegisterRow = {
  serial: number;
  employeeId: string;
  name: string;
  parentName: string;
  skillCategory: string;
  days: AttendanceRegisterMark[];
  totalPresent: number;
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
  summary: { employees: number; present: number; absent: number; unmarked: number };
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
  marks: (AttendanceStatus | null)[];
  existing: (AttendanceStatus | null)[];
};

export type AttendanceMonthParseResponse = {
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
  entries: { employeeId: string; status: AttendanceStatus; date?: string; replace?: boolean }[];
}) {
  const { data } = await api.post<AttendanceBulkResponse>('/attendance/bulk', input);
  return data;
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
    input,
  );
  return data.attendance;
}