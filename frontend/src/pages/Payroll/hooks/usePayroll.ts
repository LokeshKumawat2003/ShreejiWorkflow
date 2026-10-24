import { useEffect, useState } from 'react';
import { ApiError } from '../../../services/api';
import { getPayroll, type PayrollParams, type PayrollResponse } from '../../../services/attendanceService';

export const PAYROLL_PAGE_SIZE = 10;

export type PayrollQuery = Omit<PayrollParams, 'page' | 'limit'>;

export function usePayroll(query: PayrollQuery | null, refreshKey = 0) {
	const queryKey = query ? JSON.stringify(query) : '';
	const [page, setPage] = useState(1);
	const [payroll, setPayroll] = useState<PayrollResponse | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		setPage(1);
		setPayroll(null);
	}, [queryKey, refreshKey]);

	useEffect(() => {
		if (!queryKey) {
			setPayroll(null);
			setIsLoading(false);
			setError('');
			return undefined;
		}

		const controller = new AbortController();
		setIsLoading(true);
		setError('');
		void getPayroll({ ...(JSON.parse(queryKey) as PayrollQuery), page, limit: PAYROLL_PAGE_SIZE }, controller.signal)
			.then((result) => {
				if (controller.signal.aborted) return;
				setPayroll(result);
				if (result.pagination && result.pagination.page !== page) setPage(result.pagination.page);
			})
			.catch((loadError: unknown) => {
				if (controller.signal.aborted) return;
				setPayroll(null);
				setError(loadError instanceof ApiError ? loadError.message : 'Unable to load payroll.');
			})
			.finally(() => {
				if (!controller.signal.aborted) setIsLoading(false);
			});
		return () => controller.abort();
	}, [page, queryKey, refreshKey]);

	async function fetchAll() {
		if (!queryKey) throw new Error('Generate payroll first.');
		return getPayroll(JSON.parse(queryKey) as PayrollQuery);
	}

	return { payroll, page, setPage, pageSize: PAYROLL_PAGE_SIZE, isLoading, error, fetchAll };
}
