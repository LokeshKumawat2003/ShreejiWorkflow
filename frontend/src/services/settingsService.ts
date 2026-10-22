import api from './api';

export type SalarySlipSettings = {
	companyName: string;
	address: string;
	title: string;
	signatoryLabel: string;
};

export type AppointmentLetterSettings = {
	companyName: string;
	registeredAddress: string;
	phone: string;
	email: string;
	refPrefix: string;
	title: string;
	shortName: string;
	salaryText: string;
	workingHours: string;
	leavePolicy: string;
	terms: string;
	closing: string;
	signatoryTitle: string;
};

export type DocumentSettingsMap = {
	'salary-slip': SalarySlipSettings;
	'appointment-letter': AppointmentLetterSettings;
};

export type DocumentType = keyof DocumentSettingsMap;

export const SALARY_SLIP_DEFAULTS: SalarySlipSettings = {
	companyName: 'M/S. SHREEJI CARETAKER COMPANY',
	address: '[Ragistt. Add.- N-33 , Govind Nager , R.H.B. Colony , Kankroli , Distt-Rajsamand ( Raj.)',
	title: 'Salary Slip',
	signatoryLabel: 'Propritior/Manager:',
};

export const APPOINTMENT_LETTER_DEFAULTS: AppointmentLetterSettings = {
	companyName: 'M/s. SHREEJI CARETAKER COMPANY',
	registeredAddress: 'N-33, GOVIND NAGAR, R.H.B. COLONY, KANKROLI\nDistt :-Rajsamand , Pin :-313342 ( Rajasthan )',
	phone: '9784785808',
	email: 'shreejicaretaker2007@gmail.com',
	refPrefix: 'SCC/Appointment/',
	title: 'APPOINTMENT LETTER',
	shortName: 'Shreeji Caretaker Company',
	salaryText: 'As per Central Govt. minimum Wage Act. ("C" Class City)',
	workingHours: '8 Hrs. as per requirement',
	leavePolicy: 'Weekly off & Govt. Holidays',
	terms: [
		'Please sign the duly copy of the appointment letter signifying your acceptance.',
		'We welcome you to your and look forward to fruitful collaboration.',
		'This appointment letter is valid on Consent of terms & condition by employer.',
	].join('\n'),
	closing: 'With best Wishes,',
	signatoryTitle: 'Authorized signatory',
};

export const DOCUMENT_DEFAULTS: DocumentSettingsMap = {
	'salary-slip': SALARY_SLIP_DEFAULTS,
	'appointment-letter': APPOINTMENT_LETTER_DEFAULTS,
};

type Saved<T extends DocumentType> = DocumentSettingsMap[T] & { updatedAt: string | null };

export async function getDocumentSettings<T extends DocumentType>(type: T, signal?: AbortSignal) {
	const { data } = await api.get<{ settings: Saved<T> }>(`/settings/documents/${type}`, { signal });
	return data.settings;
}

export async function updateDocumentSettings<T extends DocumentType>(type: T, input: DocumentSettingsMap[T]) {
	const { data } = await api.put<{ settings: Saved<T> }>(`/settings/documents/${type}`, input);
	return data.settings;
}

/** Loads a document's settings for PDF generation, falling back to the defaults if the request fails. */
export async function loadDocumentSettings<T extends DocumentType>(type: T): Promise<DocumentSettingsMap[T]> {
	try {
		return { ...DOCUMENT_DEFAULTS[type], ...(await getDocumentSettings(type)) };
	} catch {
		return DOCUMENT_DEFAULTS[type];
	}
}
