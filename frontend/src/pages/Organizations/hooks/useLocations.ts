import { useEffect, useState } from 'react';
import { ApiError } from '../../../services/api';
import { createOrganizationLocation, deleteOrganizationLocation, listOrganizationLocations, updateOrganizationLocation, type CreateLocationInput } from '../../../services/locationService';
import type { OrganizationLocation } from '../../../types';

function errorMessage(error: unknown, fallback: string) {
	return error instanceof ApiError ? error.message : fallback;
}

export function useLocations(organizationId?: string) {
	const [locations, setLocations] = useState<OrganizationLocation[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [loadError, setLoadError] = useState('');

	useEffect(() => {
		let isActive = true;
		const controller = new AbortController();
		if (!organizationId) {
			setLocations([]);
			setLoadError('');
			setIsLoading(false);
			return () => controller.abort();
		}

		setIsLoading(true);
		setLoadError('');
		void listOrganizationLocations(organizationId, controller.signal)
			.then((result) => {
				if (isActive) setLocations(result);
			})
			.catch((error: unknown) => {
				if (isActive && !controller.signal.aborted) {
					setLoadError(errorMessage(error, 'Unable to load locations.'));
				}
			})
			.finally(() => {
				if (isActive) setIsLoading(false);
			});

		return () => {
			isActive = false;
			controller.abort();
		};
	}, [organizationId]);

	async function create(input: CreateLocationInput) {
		if (!organizationId) throw new Error('Select an organization before adding a location.');
		const location = await createOrganizationLocation(organizationId, input);
		setLocations((current) => [...current, location].sort((left, right) => left.name.localeCompare(right.name)));
		return location;
	}

	async function update(locationId: string, input: CreateLocationInput) {
		if (!organizationId) throw new Error('Select an organization before updating a location.');
		const location = await updateOrganizationLocation(organizationId, locationId, input);
		setLocations((current) => current.map((item) => item.id === locationId ? location : item).sort((left, right) => left.name.localeCompare(right.name)));
		return location;
	}

	async function remove(locationId: string) {
		if (!organizationId) throw new Error('Select an organization before deleting a location.');
		await deleteOrganizationLocation(organizationId, locationId);
		setLocations((current) => current.filter((location) => location.id !== locationId));
	}

	return { locations, isLoading, loadError, create, update, remove };
}
