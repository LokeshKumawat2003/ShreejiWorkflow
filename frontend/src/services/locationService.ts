import api from './api';
import type { OrganizationLocation } from '../types';

export type CreateLocationInput = Pick<OrganizationLocation, 'workName' | 'opNumber' | 'name' | 'address' | 'designation' | 'status'>;

type LocationsResponse = {
	locations: OrganizationLocation[];
};

type LocationResponse = {
	location: OrganizationLocation;
};

export async function listOrganizationLocations(organizationId: string, signal?: AbortSignal) {
	const { data } = await api.get<LocationsResponse>(`/organizations/${organizationId}/locations`, { signal });
	return data.locations;
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
