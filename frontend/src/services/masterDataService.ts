import api from './api';
import type { MasterDataItem, MasterDataType } from '../types';

export type MasterDataInput = {
	type: MasterDataType;
	name: string;
	status: MasterDataItem['status'];
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
		description: 'Skill levels used in the attendance register and payroll.',
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
