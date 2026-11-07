import { useEffect, useState } from 'react';
import { ApiError } from '../../../services/api';
import { listOrganizationLocations } from '../../../services/locationService';
import type { OrganizationLocation } from '../../../types';

/** Loads an organization's locations and picks the first active one. */
export function useOwnLocations(organizationId: string) {
	const [locations, setLocations] = useState<OrganizationLocation[] | null>(null);
	const [locationId, setLocationId] = useState('');
	const [error, setError] = useState('');

	useEffect(() => {
		const controller = new AbortController();
		listOrganizationLocations(organizationId, { limit: 100 }, controller.signal)
			.then((response) => {
				setLocations(response.locations);
				const firstActive = response.locations.find((location) => location.status === 'active') || response.locations[0];
				setLocationId((current) => current || firstActive?.id || '');
			})
			.catch((loadError: unknown) => {
				if (controller.signal.aborted) return;
				setLocations([]);
				setError(loadError instanceof ApiError ? loadError.message : 'Unable to load your locations.');
			});
		return () => controller.abort();
	}, [organizationId]);

	return { locations, locationId, setLocationId, error };
}

export function locationLabel(location: OrganizationLocation) {
	return [location.workName, location.designation, location.status === 'disabled' ? '(inactive)' : ''].filter(Boolean).join(' · ');
}
