import { StatusBadge } from '../../../components/ui';
import {
	TICKET_PRIORITY_OPTIONS,
	TICKET_STATUS_OPTIONS,
	TICKET_TYPE_OPTIONS,
	type TicketPriority,
	type TicketStatus,
	type TicketType,
} from '../../../services/ticketService';

const statusTones: Record<TicketStatus, 'warning' | 'info' | 'success' | 'neutral'> = {
	open: 'warning',
	in_progress: 'info',
	resolved: 'success',
	closed: 'neutral',
};

const priorityTones: Record<TicketPriority, 'neutral' | 'warning' | 'danger'> = {
	low: 'neutral',
	medium: 'warning',
	high: 'danger',
};

export function ticketTypeLabel(type: TicketType) {
	return TICKET_TYPE_OPTIONS.find((option) => option.value === type)?.label || type;
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
	const label = TICKET_STATUS_OPTIONS.find((option) => option.value === status)?.label || status;
	return <StatusBadge label={label} tone={statusTones[status]} />;
}

export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
	const label = TICKET_PRIORITY_OPTIONS.find((option) => option.value === priority)?.label || priority;
	return <StatusBadge label={label} tone={priorityTones[priority]} />;
}

export function formatTicketDate(value: string | null) {
	if (!value) return '—';
	return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
