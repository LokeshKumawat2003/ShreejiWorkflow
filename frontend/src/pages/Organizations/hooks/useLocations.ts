import { useEffect, useState } from 'react';
import { ApiError } from '../../../services/api';
import {
	createOrganizationLocation,
	deleteOrganizationLocation,
	listOrganizationLocations,
	updateOrganizationLocation,
	type CreateLocationInput,
	type LocationListResponse,
} from '../../../services/locationService';
import type { OrganizationLocation } from '../../../types';

export const LOCATION_PAGE_SIZE = 10;

export type LocationStatusFilter = 'all' | OrganizationLocation['status'];

const EMPTY_SUMMARY: LocationListResponse['summary'] = { total: 0, active: 0, inactive: 0 };

function errorMessage(error: unknown, fallback: string) {
	return error instanceof ApiError ? error.message : fallback;
}

export function useLocations(organizationId?: string) {
	const [locations, setLocations] = useState<OrganizationLocation[]>([]);
	const [summary, setSummary] = useState(EMPTY_SUMMARY);
	const [designations, setDesignations] = useState<string[]>([]);
	const [total, setTotal] = useState(0);
	const [totalPages, setTotalPages] = useState(1);
	const [page, setPage] = useState(1);
	const [search, setSearchValue] = useState('');
	const [debouncedSearch, setDebouncedSearch] = useState('');
	const [status, setStatusValue] = useState<LocationStatusFilter>('all');
	const [designation, setDesignationValue] = useState('all');
	const [refreshToken, setRefreshToken] = useState(0);
	const [isLoading, setIsLoading] = useState(false);
	const [loadError, setLoadError] = useState('');

	useEffect(() => {
		const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
		return () => window.clearTimeout(timer);
	}, [search]);

	useEffect(() => {
		setPage(1);
		setSearchValue('');
		setDebouncedSearch('');
		setStatusValue('all');
		setDesignationValue('all');
	}, [organizationId]);

	useEffect(() => {
		let isActive = true;
		const controller = new AbortController();
		if (!organizationId) {
			setLocations([]);
			setSummary(EMPTY_SUMMARY);
			setDesignations([]);
			setTotal(0);
			setTotalPages(1);
			setLoadError('');
			setIsLoading(false);
			return () => controller.abort();
		}

		setIsLoading(true);
		setLoadError('');
		void listOrganizationLocations(
			organizationId,
			{ search: debouncedSearch, status, designation, page, limit: LOCATION_PAGE_SIZE },
			controller.signal,
		)
			.then((result) => {
				if (!isActive) return;
				setLocations(result.locations);
				setSummary(result.summary);
				setDesignations(result.designations);
				setTotal(result.pagination.total);
				setTotalPages(result.pagination.totalPages);
				if (result.pagination.page !== page) setPage(result.pagination.page);
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
	}, [debouncedSearch, designation, organizationId, page, refreshToken, status]);

	function refresh() {
		setRefreshToken((current) => current + 1);
	}

	function setSearch(value: string) {
		setSearchValue(value);
		setPage(1);
	}

	function setStatus(value: LocationStatusFilter) {
		setStatusValue(value);
		setPage(1);
	}

	function setDesignation(value: string) {
		setDesignationValue(value);
		setPage(1);
	}

	function clearFilters() {
		setSearchValue('');
		setDebouncedSearch('');
		setStatusValue('all');
		setDesignationValue('all');
		setPage(1);
	}

	async function create(input: CreateLocationInput) {
		if (!organizationId) throw new Error('Select an organization before adding a location.');
		const location = await createOrganizationLocation(organizationId, input);
		refresh();
		return location;
	}

	async function update(locationId: string, input: CreateLocationInput) {
		if (!organizationId) throw new Error('Select an organization before updating a location.');
		const location = await updateOrganizationLocation(organizationId, locationId, input);
		refresh();
		return location;
	}

	async function remove(locationId: string) {
		if (!organizationId) throw new Error('Select an organization before deleting a location.');
		await deleteOrganizationLocation(organizationId, locationId);
		refresh();
	}

	return {
		locations,
		summary,
		designations,
		total,
		totalPages,
		page,
		pageSize: LOCATION_PAGE_SIZE,
		search,
		status,
		designation,
		isFiltered: Boolean(search.trim()) || status !== 'all' || designation !== 'all',
		isLoading,
		loadError,
		setPage,
		setSearch,
		setStatus,
		setDesignation,
		clearFilters,
		create,
		update,
		remove,
	};
}
