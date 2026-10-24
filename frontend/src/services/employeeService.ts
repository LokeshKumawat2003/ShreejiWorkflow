import api from './api';
import type { Employee, EmployeeStatus } from '../types';

export type EmployeeInput = {
  name: string;
  email: string;
  dateOfBirth: string;
  parentName: string;
  aadhaarNumber: string;
  aadhaarConsent: boolean;
  establishmentLin: string;
  uan: string;
  esicNumber: string;
  designation: string;
  employmentType: string;
  skillCategory: string;
  dateOfJoining: string;
  dailySalary?: number;
  currency?: string;
  basicPay: number;
  dearnessAllowance: number;
  otherAllowances: string;
  epfoApplicable: boolean;
  esicApplicable: boolean;
  duties: string;
  maternityBenefits: string;
  otherInformation: string;
  phone: string;
  address?: string;
  bankName: string;
  bankBranch: string;
  bankAccountHolder: string;
  bankAccountNumber: string;
  bankRoutingCode: string;
  status: EmployeeStatus;
  organizationId?: string;
  locationId?: string;
};

export type EmployeeListParams = {
  search: string;
  status: 'all' | EmployeeStatus;
  sort: 'name-asc' | 'name-desc' | 'newest' | 'oldest';
  page: number;
  limit: number;
  organizationId?: string;
  locationId?: string;
  unassigned?: boolean;
  assignedOnly?: boolean;
  activeOnly?: boolean;
  designation?: string;
  availableForLocationId?: string;
};

type EmployeeListResponse = {
  employees: Employee[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary?: EmployeeSummary;
};

export type EmployeeSummary = { total: number; active: number; inactive: number };

type EmployeeResponse = { employee: Employee };

export async function listEmployees(params: EmployeeListParams, signal?: AbortSignal) {
  const { data } = await api.get<EmployeeListResponse>('/employees', { params, signal });
  return data;
}

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export async function createEmployee(input: EmployeeInput) {
  const { data } = await api.post<EmployeeResponse>('/employees', { ...input, timeZone: timeZone() });
  return data.employee;
}

export async function getEmployee(id: string) {
  const { data } = await api.get<EmployeeResponse>(`/employees/${id}`);
  return data.employee;
}

export async function updateEmployee(id: string, input: EmployeeInput) {
  const { data } = await api.patch<EmployeeResponse>(`/employees/${id}`, { ...input, timeZone: timeZone() });
  return data.employee;
}

export async function deleteEmployee(id: string) {
  const { data } = await api.delete<EmployeeResponse>(`/employees/${id}`);
  return data.employee;
}

export async function emailAppointmentLetter(employeeId: string, locationId: string, pdf: Blob) {
  const formData = new FormData();
  formData.append('locationId', locationId);
  formData.append('letter', pdf, `appointment-letter-${employeeId}.pdf`);
  await api.post(`/employees/${employeeId}/appointment-letter`, formData);
}

export async function emailOrganizationAppointmentLetters(locationId: string, pdf: Blob) {
  const formData = new FormData();
  formData.append('locationId', locationId);
  formData.append('letter', pdf, `appointment-letters-${locationId}.pdf`);
  await api.post('/employees/appointment-letters/organization', formData);
}

export async function transferEmployees(employeeIds: string[], organizationId: string, locationId: string) {
  const { data } = await api.post<{ employees: Employee[] }>('/employees/transfer', { employeeIds, organizationId, locationId });
  return data.employees;
}

export async function assignEmployeesToOrganization(employeeIds: string[], organizationId: string, locationId?: string) {
  const { data } = await api.post<{ employees: Employee[] }>('/employees/assign', {
    employeeIds,
    organizationId,
    ...(locationId ? { locationId } : {}),
  });
  return data.employees;
}

export async function removeEmployeesFromOrganization(employeeIds: string[], organizationId?: string, locationId?: string) {
  const { data } = await api.post<{ employees: Employee[] }>('/employees/unassign', {
    employeeIds,
    ...(organizationId ? { organizationId } : {}),
    ...(locationId ? { locationId } : {}),
  });
  return data.employees;
}