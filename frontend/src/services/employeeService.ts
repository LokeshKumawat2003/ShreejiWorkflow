import api from './api';
import type { Employee, EmployeeStatus } from '../types';

export type EmployeeInput = {
  name: string;
  email: string;
  department: string;
  jobTitle: string;
  phone: string;
  address: string;
  dailySalary: number;
  currency: string;
  bankName: string;
  bankBranch: string;
  bankAccountHolder: string;
  bankAccountNumber: string;
  bankRoutingCode: string;
  status: EmployeeStatus;
  organizationId?: string;
};

export type EmployeeListParams = {
  search: string;
  status: 'all' | EmployeeStatus;
  sort: 'name-asc' | 'name-desc' | 'newest' | 'oldest';
  page: number;
  limit: number;
  organizationId?: string;
  unassigned?: boolean;
  assignedOnly?: boolean;
  activeOnly?: boolean;
};

type EmployeeListResponse = {
  employees: Employee[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type EmployeeResponse = { employee: Employee };

export async function listEmployees(params: EmployeeListParams, signal?: AbortSignal) {
  const { data } = await api.get<EmployeeListResponse>('/employees', { params, signal });
  return data;
}

export async function createEmployee(input: EmployeeInput) {
  const { data } = await api.post<EmployeeResponse>('/employees', input);
  return data.employee;
}

export async function getEmployee(id: string) {
  const { data } = await api.get<EmployeeResponse>(`/employees/${id}`);
  return data.employee;
}

export async function updateEmployee(id: string, input: EmployeeInput) {
  const { data } = await api.patch<EmployeeResponse>(`/employees/${id}`, input);
  return data.employee;
}

export async function deleteEmployee(id: string) {
  const { data } = await api.delete<EmployeeResponse>(`/employees/${id}`);
  return data.employee;
}

export async function assignEmployeesToOrganization(employeeIds: string[], organizationId: string) {
  const { data } = await api.post<{ employees: Employee[] }>('/employees/assign', {
    employeeIds,
    organizationId,
  });
  return data.employees;
}

export async function removeEmployeesFromOrganization(employeeIds: string[], organizationId?: string) {
  const { data } = await api.post<{ employees: Employee[] }>('/employees/unassign', {
    employeeIds,
    ...(organizationId ? { organizationId } : {}),
  });
  return data.employees;
}