import api from './api';

export type CompanyProfile = {
	name: string;
	address: string;
	registeredAddress: string;
	phone: string;
	email: string;
	updatedAt: string | null;
};

export type CompanyProfileInput = Omit<CompanyProfile, 'updatedAt'>;

export async function getCompanyProfile(signal?: AbortSignal) {
	const { data } = await api.get<{ company: CompanyProfile }>('/settings/company', { signal });
	return data.company;
}

export async function updateCompanyProfile(input: CompanyProfileInput) {
	const { data } = await api.put<{ company: CompanyProfile }>('/settings/company', input);
	return data.company;
}
