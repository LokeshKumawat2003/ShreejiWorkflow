import api from './api';
import type { MasterDataItem, MasterDataType, SkillRate } from '../types';

export type MasterDataInput = {
	type: MasterDataType;
	name: string;
	status: MasterDataItem['status'];
	designations?: string[];
	rates?: SkillRate[];
	effectiveFrom?: string;
	effectiveTo?: string;
	timeZone?: string;
};

export type MasterDataListParams = {
	type?: MasterDataType;
	status?: 'all' | MasterDataItem['status'];
	search?: string;
	includeUsage?: boolean;
};

export const MASTER_DATA_LABELS: Record<MasterDataType, { title: string; singular: string; description: string }> = {
	designation: {
		title: 'Designation',
		singular: 'designation',
		description: 'Job roles used for employees and locations.',
	},
	employmentType: {
		title: 'Type of employment',
		singular: 'type of employment',
		description: 'Employment terms shown on the employee form and appointment letters.',
	},
	skillCategory: {
		title: 'Category of skill',
		singular: 'category of skill',
		description: 'Skill levels with a fixed daily basic pay for each government type and area. Employees get the rate of their organization\'s government type and area.',
	},
	governmentType: {
		title: 'Government type',
		singular: 'government type',
		description: 'Wage schedules such as State or Central. Each organization picks one, together with an area.',
	},
	area: {
		title: 'Area',
		singular: 'area',
		description: 'Where the organization works: A inside city, B mid city, C out of city. Each category of skill has a rate per government type and area.',
	},
	workName: {
		title: 'Work name',
		singular: 'work name',
		description: 'Types of work with the designations under each. Organizations pick their posts from these.',
	},
};

export async function listMasterData(params: MasterDataListParams = {}, signal?: AbortSignal) {
	const { data } = await api.get<{ items: MasterDataItem[] }>('/master-data', {
		params: {
			...(params.type ? { type: params.type } : {}),
			...(params.status && params.status !== 'all' ? { status: params.status } : {}),
			...(params.search ? { search: params.search } : {}),
			...(params.includeUsage ? { includeUsage: 'true' } : {}),
		},
		signal,
	});
	return data.items;
}

export type MasterDataPage = {
	items: MasterDataItem[];
	pagination: { page: number; limit: number; total: number; totalPages: number };
};

export async function listMasterDataPage(params: MasterDataListParams & { page: number; limit?: number }, signal?: AbortSignal) {
	const { data } = await api.get<MasterDataPage>('/master-data', {
		params: {
			...(params.type ? { type: params.type } : {}),
			...(params.status && params.status !== 'all' ? { status: params.status } : {}),
			...(params.search ? { search: params.search } : {}),
			...(params.includeUsage ? { includeUsage: 'true' } : {}),
			page: params.page,
			...(params.limit ? { limit: params.limit } : {}),
		},
		signal,
	});
	return data;
}

export async function createMasterData(input: MasterDataInput) {
	const { data } = await api.post<{ item: MasterDataItem }>('/master-data', input);
	return data.item;
}

export async function updateMasterData(id: string, input: Partial<Omit<MasterDataInput, 'type'>>) {
	const { data } = await api.patch<{ item: MasterDataItem }>(`/master-data/${id}`, input);
	return data.item;
}

export async function deleteMasterData(id: string) {
	await api.delete(`/master-data/${id}`);
}
