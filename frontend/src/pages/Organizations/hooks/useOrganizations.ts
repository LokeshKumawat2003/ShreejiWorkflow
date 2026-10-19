import { useEffect, useState } from 'react';
import { ApiError } from '../../../services/api';
import {
  createOrganization,
  deleteOrganization,
  getOrganization,
  listOrganizations,
  updateOrganization,
  type CreateOrganizationInput,
  type OrganizationListParams,
  type UpdateOrganizationInput,
} from '../../../services/organizationService';
import type { User } from '../../../types';

const PAGE_SIZE = 10;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function useOrganizations() {
  const [organizations, setOrganizations] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [sortOrder, setSortOrder] = useState<'name-asc' | 'name-desc' | 'newest' | 'oldest'>('name-asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0, inactive: 0 });
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();
    const params: OrganizationListParams = {
      search,
      status: statusFilter,
      sort: sortOrder,
      page,
      limit: PAGE_SIZE,
    };
    setIsLoading(true);
    setLoadError('');
    void listOrganizations(params, controller.signal)
      .then((result) => {
        if (!isActive) return;
        setOrganizations(result.organizations);
        setPage(result.pagination.page);
        setPageSize(result.pagination.limit);
        setTotal(result.pagination.total);
        setTotalPages(result.pagination.totalPages);
        setStats(result.stats);
      })
      .catch((error: unknown) => {
        if (isActive && !controller.signal.aborted) {
          setLoadError(errorMessage(error, 'Unable to load organizations.'));
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [page, refreshVersion, search, sortOrder, statusFilter]);

  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function changeStatusFilter(value: 'all' | 'active' | 'disabled') {
    setStatusFilter(value);
    setPage(1);
  }

  function changeSortOrder(value: 'name-asc' | 'name-desc' | 'newest' | 'oldest') {
    setSortOrder(value);
    setPage(1);
  }

  function changePage(value: number) {
    setPage(Math.max(1, Math.min(totalPages, value)));
  }

  async function create(input: CreateOrganizationInput) {
    const organization = await createOrganization(input);
    setPage(1);
    setRefreshVersion((current) => current + 1);
    return organization;
  }

  async function getDetails(id: string) {
    return getOrganization(id);
  }

  async function update(id: string, input: UpdateOrganizationInput) {
    const organization = await updateOrganization(id, input);
    setRefreshVersion((current) => current + 1);
    return organization;
  }

  async function remove(id: string) {
    await deleteOrganization(id);
    setRefreshVersion((current) => current + 1);
  }

  return {
    organizations,
    page,
    pageSize,
    total,
    totalPages,
    search,
    setSearch: changeSearch,
    statusFilter,
    setStatusFilter: changeStatusFilter,
    sortOrder,
    setSortOrder: changeSortOrder,
    setPage: changePage,
    stats,
    isLoading,
    loadError,
    create,
    getDetails,
    update,
    remove,
  };
}