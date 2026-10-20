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

export async function getPayroll(
  params: { fromDate: string; toDate: string; organizationId?: string; locationId?: string },
  signal?: AbortSignal,
) {
  const { data } = await api.get<PayrollResponse>('/attendance/payroll', { params, signal });
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