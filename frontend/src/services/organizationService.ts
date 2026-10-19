import api from './api';
import type { User } from '../types';

export type CreateOrganizationInput = {
  name: string;
  organizationName: string;
  email: string;
  password: string;
  status: 'active' | 'disabled';
  phone?: string;
  address?: string;
  about?: string;
  website?: string;
  industry?: string;
};

export type UpdateOrganizationInput = {
  name: string;
  organizationName: string;
  email: string;
  status: 'active' | 'disabled';
  phone?: string;
  address?: string;
  about?: string;
  website?: string;
  industry?: string;
};

type OrganizationListResponse = {
  organizations: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    total: number;
    active: number;
    pending: number;
    inactive: number;
  };
};

export type OrganizationListParams = {
  search: string;
  status: 'all' | 'active' | 'disabled';
  sort: 'name-asc' | 'name-desc' | 'newest' | 'oldest';
  page: number;
  limit: number;
};

type OrganizationResponse = {
  organization: User;
};

export async function listOrganizations(params: OrganizationListParams, signal?: AbortSignal) {
  const { data } = await api.get<OrganizationListResponse>('/organizations', {
    params,
    signal,
  });
  return data;
}

export async function createOrganization(input: CreateOrganizationInput) {
  const { data } = await api.post<OrganizationResponse>('/organizations', input);
  return data.organization;
}

export async function getOrganization(id: string) {
  const { data } = await api.get<OrganizationResponse>(`/organizations/${id}`);
  return data.organization;
}

export async function updateOrganization(id: string, input: UpdateOrganizationInput) {
  const { data } = await api.patch<OrganizationResponse>(`/organizations/${id}`, input);
  return data.organization;
}

export async function deleteOrganization(id: string) {
  await api.delete(`/organizations/${id}`);
}