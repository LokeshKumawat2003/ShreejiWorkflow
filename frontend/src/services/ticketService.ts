import api from './api';

export type TicketType = 'attendance' | 'payroll' | 'employee' | 'location' | 'account' | 'technical' | 'other';
export type TicketPriority = 'low' | 'medium' | 'high';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type Ticket = {
	id: string;
	ticketNumber: string;
	organizationId: string;
	organizationName: string;
	type: TicketType;
	priority: TicketPriority;
	subject: string;
	message: string;
	status: TicketStatus;
	adminResponse: string;
	respondedAt: string | null;
	resolvedAt: string | null;
	createdAt: string;
	updatedAt: string;
};

export const TICKET_TYPE_OPTIONS: { value: TicketType; label: string }[] = [
	{ value: 'attendance', label: 'Attendance' },
	{ value: 'payroll', label: 'Payroll / salary' },
	{ value: 'employee', label: 'Employee details' },
	{ value: 'location', label: 'Location / work site' },
	{ value: 'account', label: 'Account / login' },
	{ value: 'technical', label: 'Technical problem' },
	{ value: 'other', label: 'Other' },
];

export const TICKET_PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
	{ value: 'low', label: 'Low' },
	{ value: 'medium', label: 'Medium' },
	{ value: 'high', label: 'High' },
];

export const TICKET_STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
	{ value: 'open', label: 'Open' },
	{ value: 'in_progress', label: 'In progress' },
	{ value: 'resolved', label: 'Resolved' },
	{ value: 'closed', label: 'Closed' },
];

export type CreateTicketInput = Pick<Ticket, 'type' | 'priority' | 'subject' | 'message'>;
export type UpdateTicketInput = Partial<Pick<Ticket, 'status' | 'adminResponse'>>;

export type TicketListParams = {
	search?: string;
	status?: 'all' | TicketStatus;
	type?: 'all' | TicketType;
	organizationId?: string;
	page?: number;
	limit?: number;
};

export type TicketListResponse = {
	tickets: Ticket[];
	pagination: { page: number; limit: number; total: number; totalPages: number };
	summary: Record<'total' | TicketStatus, number>;
};

export async function listTickets(params: TicketListParams = {}, signal?: AbortSignal) {
	const { data } = await api.get<TicketListResponse>('/tickets', {
		params: {
			...(params.search ? { search: params.search } : {}),
			...(params.status && params.status !== 'all' ? { status: params.status } : {}),
			...(params.type && params.type !== 'all' ? { type: params.type } : {}),
			...(params.organizationId ? { organizationId: params.organizationId } : {}),
			...(params.page ? { page: params.page } : {}),
			...(params.limit ? { limit: params.limit } : {}),
		},
		signal,
	});
	return data;
}

export async function createTicket(input: CreateTicketInput) {
	const { data } = await api.post<{ ticket: Ticket }>('/tickets', input);
	return data.ticket;
}

export async function updateTicket(ticketId: string, input: UpdateTicketInput) {
	const { data } = await api.patch<{ ticket: Ticket }>(`/tickets/${ticketId}`, input);
	return data.ticket;
}
