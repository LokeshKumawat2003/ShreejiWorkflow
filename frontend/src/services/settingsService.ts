import api from './api';

export type SalarySlipSettings = {
	companyName: string;
	address: string;
	title: string;
	formNumber: string;
	ruleReference: string;
	signatoryLabel: string;
	signatureImage: string;
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
	signatureImage: string;
};

export type WageRegisterSettings = {
	title: string;
	formTitle: string;
	contractorName: string;
	note: string;
	bonusRate: string;
	epfRate: string;
	epfWageCeiling: string;
	esiRate: string;
	signatoryCompany: string;
	signatoryTitle: string;
	signatureImage: string;
};

export type BankLetterSettings = {
	companyName: string;
	address: string;
	phone: string;
	email: string;
	refPrefix: string;
	recipient: string;
	accountNumber: string;
	subject: string;
	requestLine: string;
	closing: string;
	signatoryName: string;
	signatoryCompany: string;
	signatoryTitle: string;
	signatoryPhone: string;
	signatureImage: string;
};

export type DocumentSettingsMap = {
	'salary-slip': SalarySlipSettings;
	'appointment-letter': AppointmentLetterSettings;
	'wage-register': WageRegisterSettings;
	'bank-letter': BankLetterSettings;
};

export type DocumentType = keyof DocumentSettingsMap;

export const SALARY_SLIP_DEFAULTS: SalarySlipSettings = {
	companyName: 'M/S. SHREEJI CARETAKER COMPANY',
	address: '[Ragistt. Add.- N-33 , Govind Nager , R.H.B. Colony , Kankroli , Distt-Rajsamand ( Raj.)]',
	title: 'Salary Slip',
	formNumber: 'FORM - VIII-C',
	ruleReference: '(See rule 156)',
	signatoryLabel: 'Propritior/Manager:',
	signatureImage: '',
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
	signatureImage: '',
};

export const WAGE_REGISTER_DEFAULTS: WageRegisterSettings = {
	title: 'Register of wages',
	formTitle: '1(rule 78 (1) (a) (i) ) FORM XVII',
	contractorName: 'M/s.Shreeji Caretaker Company , kankroli , Distt- Rajsamand',
	note: 'Payment will be made as per central Govt. Minimum wages act. W.e.f-01-04-2026 ( "C" Class City )',
	bonusRate: '8.33',
	epfRate: '12',
	epfWageCeiling: '15000',
	esiRate: '0.75',
	signatoryCompany: 'FOR:-SHREEJI CARETAKER COMPANY',
	signatoryTitle: 'Proprietor / Manager',
	signatureImage: '',
};

export const BANK_LETTER_DEFAULTS: BankLetterSettings = {
	companyName: 'M/s. SHREEJI CARETAKER COMPANY',
	address: 'Address:-N-33 , GOVIND NAGAR , R.H.B. COLONY, KANKROLI ,\nDISTT. RAJSAMAND ( RAJ. ) Pin:-313342',
	phone: '9784785808',
	email: 'shreejicaretaker2007@gmail.com',
	refPrefix: 'SCC/PNB-NEFT',
	recipient: 'The Branch Manager\nPanjab National Bank\nJ.K. Made , Kankroli\nDistt-Rajsamand ( Raj )',
	accountNumber: '409100C100000077',
	subject: 'Request for making Payment to our Employees by debiting to our Current Account No. {account} at Your Branch',
	requestLine: 'You are Requested to make a Payment an earliest please',
	closing: 'Thanking You ,',
	signatoryName: 'Prahlad Singh Solanki',
	signatoryCompany: 'M/S. Shreeji Caretaker Co.',
	signatoryTitle: 'Proprietor',
	signatoryPhone: '9784785808',
	signatureImage: '',
};

export const DOCUMENT_DEFAULTS: DocumentSettingsMap = {
	'salary-slip': SALARY_SLIP_DEFAULTS,
	'appointment-letter': APPOINTMENT_LETTER_DEFAULTS,
	'wage-register': WAGE_REGISTER_DEFAULTS,
	'bank-letter': BANK_LETTER_DEFAULTS,
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

export async function uploadSignatureImage(image: Blob, fileName: string) {
	const formData = new FormData();
	formData.append('signature', image, fileName);
	const { data } = await api.post<{ image: { url: string; width: number; height: number } }>('/settings/signature', formData);
	return data.image;
}

/** Loads a document's settings for PDF generation, falling back to the defaults if the request fails. */
export async function loadDocumentSettings<T extends DocumentType>(type: T): Promise<DocumentSettingsMap[T]> {
	try {
		return { ...DOCUMENT_DEFAULTS[type], ...(await getDocumentSettings(type)) };
	} catch {
		return DOCUMENT_DEFAULTS[type];
	}
}
