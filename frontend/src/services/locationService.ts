import api from './api';
import type { OrganizationLocation } from '../types';

export type CreateLocationInput = Pick<OrganizationLocation, 'workName' | 'opNumber' | 'name' | 'address' | 'loaReference' | 'designation' | 'status'>;

export type LocationListParams = {
	search?: string;
	status?: 'all' | OrganizationLocation['status'];
	designation?: string;
	page?: number;
	limit?: number;
};

export type LocationListResponse = {
	locations: OrganizationLocation[];
	pagination: { page: number; limit: number; total: number; totalPages: number };
	summary: { total: number; active: number; inactive: number };
	designations: string[];
};

type LocationResponse = {
	location: OrganizationLocation;
};

export async function listOrganizationLocations(organizationId: string, params: LocationListParams = {}, signal?: AbortSignal) {
	const { data } = await api.get<LocationListResponse>(`/organizations/${organizationId}/locations`, {
		params: {
			...(params.search ? { search: params.search } : {}),
			...(params.status && params.status !== 'all' ? { status: params.status } : {}),
			...(params.designation && params.designation !== 'all' ? { designation: params.designation } : {}),
			...(params.page ? { page: params.page } : {}),
			...(params.limit ? { limit: params.limit } : {}),
		},
		signal,
	});
	return data;
}

export async function createOrganizationLocation(organizationId: string, input: CreateLocationInput) {
	const { data } = await api.post<LocationResponse>(`/organizations/${organizationId}/locations`, input);
	return data.location;
}

export async function updateOrganizationLocation(organizationId: string, locationId: string, input: CreateLocationInput) {
	const { data } = await api.patch<LocationResponse>(`/organizations/${organizationId}/locations/${locationId}`, input);
	return data.location;
}

export async function deleteOrganizationLocation(organizationId: string, locationId: string) {
	await api.delete(`/organizations/${organizationId}/locations/${locationId}`);
}
