import api from './api';
import type { EmployeeStatus } from '../types';

/** Leave covers every leave type; off covers weekly offs and holidays. */
export type DashboardStatusCounts = {
	present: number;
	absent: number;
	halfDay: number;
	leave: number;
	off: number;
};

export type DashboardLocation = {
	id: string;
	name: string;
	place: string;
	designation: string;
	status: 'active' | 'disabled';
	employees: number;
	today: DashboardStatusCounts & { notMarked: number };
	periodRate: number | null;
};

export type DashboardPeriod = {
	fromDate: string;
	toDate: string;
};

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
	today: DashboardStatusCounts & { notMarked: number; isSunday: boolean };
	trend: (DashboardStatusCounts & { date: string })[];
	period: DashboardStatusCounts & DashboardPeriod & {
		attendanceRate: number | null;
		/** Salary figures are only sent to admins. */
		paidDays: number | null;
		wages: { currency: string; total: number }[] | null;
	};
	locations: DashboardLocation[] | null;
	notMarkedToday: { id: string; name: string; designation: string; locationName: string }[] | null;
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

export async function getDashboardSummary(period: DashboardPeriod, signal?: AbortSignal) {
	const { data } = await api.get<DashboardSummary>('/dashboard/summary', {
		params: { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, ...period },
		signal,
	});
	return data;
}
