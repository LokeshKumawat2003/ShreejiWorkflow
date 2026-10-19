import { useEffect, useState } from 'react';
import { ApiError } from '../../../services/api';
import {
  assignEmployeesToOrganization,
  createEmployee,
  deleteEmployee,
  getEmployee,
  listEmployees,
  removeEmployeesFromOrganization,
  updateEmployee,
  type EmployeeListParams,
  type EmployeeInput,
} from '../../../services/employeeService';
import type { Employee, EmployeeStatus } from '../../../types';

const PAGE_SIZE = 10;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function useEmployees(organizationId?: string, activeOnly = false) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | EmployeeStatus>('all');
  const [sort, setSort] = useState<EmployeeListParams['sort']>('name-asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError('');
    void listEmployees({
      search,
      status,
      sort,
      page,
      limit: PAGE_SIZE,
      ...(organizationId ? { organizationId } : {}),
      ...(activeOnly ? { activeOnly: true } : {}),
    }, controller.signal)
      .then((result) => {
        if (!isActive) return;
        setEmployees(result.employees);
        setPage(result.pagination.page);
        setPageSize(result.pagination.limit);
        setTotal(result.pagination.total);
        setTotalPages(result.pagination.totalPages);
      })
      .catch((error: unknown) => {
        if (isActive && !controller.signal.aborted) {
          setLoadError(errorMessage(error, 'Unable to load employees.'));
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [activeOnly, organizationId, page, refreshVersion, search, sort, status]);

  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function changeStatus(value: 'all' | EmployeeStatus) {
    setStatus(value);
    setPage(1);
  }

  function changeSort(value: EmployeeListParams['sort']) {
    setSort(value);
    setPage(1);
  }

  function changePage(value: number) {
    setPage(Math.max(1, Math.min(totalPages, value)));
  }

  async function create(input: EmployeeInput) {
    const employee = await createEmployee({
      ...input,
      ...(organizationId ? { organizationId } : {}),
    });
    setPage(1);
    setRefreshVersion((current) => current + 1);
    return employee;
  }

  async function getDetails(id: string) {
    return getEmployee(id);
  }

  async function update(id: string, input: EmployeeInput) {
    const employee = await updateEmployee(id, input);
    setRefreshVersion((current) => current + 1);
    return employee;
  }

  async function assignMany(ids: string[], targetOrganizationId: string) {
    const assignedEmployees = await assignEmployeesToOrganization(ids, targetOrganizationId);
    setRefreshVersion((current) => current + 1);
    return assignedEmployees;
  }

  async function unassignMany(ids: string[], targetOrganizationId?: string) {
    const unassignedEmployees = await removeEmployeesFromOrganization(ids, targetOrganizationId);
    setRefreshVersion((current) => current + 1);
    return unassignedEmployees;
  }

  async function remove(id: string) {
    const employee = await deleteEmployee(id);
    setRefreshVersion((current) => current + 1);
    return employee;
  }

  return {
    employees,
    page,
    pageSize,
    total,
    totalPages,
    search,
    status,
    sort,
    isLoading,
    loadError,
    setSearch: changeSearch,
    setStatus: changeStatus,
    setSort: changeSort,
    setPage: changePage,
    create,
    getDetails,
    update,
    assignMany,
    unassignMany,
    remove,
  };
}