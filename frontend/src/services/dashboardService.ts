import api from './api';
import type { EmployeeStatus } from '../types';

export type DashboardSummary = {
	date: string;
	totals: {
		organizations: number | null;
		locations: number;
		activeLocations: number;
		employees: number;
		activeEmployees: number;
		unassignedEmployees: number | null;
	};
	today: { present: number; absent: number; notMarked: number };
	trend: { date: string; present: number; absent: number }[];
	byDesignation: { name: string; value: number }[];
	bySkillCategory: { name: string; value: number }[];
	recentEmployees: {
		id: string;
		name: string;
		designation: string;
		skillCategory: string;
		status: EmployeeStatus;
		organizationName: string;
		createdAt: string;
	}[];
};

export async function getDashboardSummary(signal?: AbortSignal) {
	const { data } = await api.get<DashboardSummary>('/dashboard/summary', {
		params: { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
		signal,
	});
	return data;
}
