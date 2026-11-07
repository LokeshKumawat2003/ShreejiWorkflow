import {
	Alert,
	AlertIcon,
	Box,
	HStack,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	SimpleGrid,
	Stack,
	Text,
} from '@chakra-ui/react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ActionButton, ConfirmDialog, FormSelect, FormTextarea } from '../../../components/ui';
import { TICKET_STATUS_OPTIONS, type Ticket, type TicketStatus, type UpdateTicketInput } from '../../../services/ticketService';
import type { UserRole } from '../../../types';
import { formatTicketDate, TicketPriorityBadge, TicketStatusBadge, ticketTypeLabel } from './TicketBadges';

type TicketDetailsDialogProps = {
	ticket: Ticket | null;
	role: UserRole;
	isSaving: boolean;
	error: string;
	onClose: () => void;
	onSave: (input: UpdateTicketInput) => void;
};

function Detail({ label, children }: { label: string; children: ReactNode }) {
	return (
		<Box>
			<Text fontSize="xs" fontWeight="700" color="slate.500" textTransform="uppercase" letterSpacing="0.06em">{label}</Text>
			<Box mt={1} fontSize="sm" color="slate.800">{children}</Box>
		</Box>
	);
}

function TicketDetailsDialog({ ticket, role, isSaving, error, onClose, onSave }: TicketDetailsDialogProps) {
	const [status, setStatus] = useState<TicketStatus>('open');
	const [response, setResponse] = useState('');
	const [pendingClose, setPendingClose] = useState<UpdateTicketInput | null>(null);
	const isAdmin = role === 'admin';

	useEffect(() => {
		setPendingClose(null);
		if (!ticket) return;
		setStatus(ticket.status);
		setResponse(ticket.adminResponse);
	}, [ticket]);

	const isDirty = Boolean(ticket) && (status !== ticket?.status || response.trim() !== ticket?.adminResponse);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const input = { status, adminResponse: response.trim() };
		if (status === 'closed' && ticket?.status !== 'closed') {
			setPendingClose(input);
			return;
		}
		onSave(input);
	}

	function confirmClose() {
		if (!pendingClose) return;
		const input = pendingClose;
		setPendingClose(null);
		onSave(input);
	}

	return (
		<Modal isOpen={Boolean(ticket)} onClose={onClose} closeOnEsc={!isSaving} closeOnOverlayClick={!isSaving} isCentered size="xl" scrollBehavior="inside">
			<ModalOverlay bg="blackAlpha.600" backdropFilter="blur(3px)" />
			<ModalContent borderRadius="xl" overflow="hidden" boxShadow="0 24px 64px rgba(15, 23, 42, 0.2)">
				{ticket ? (
					<>
						<ModalHeader pb={3} pr={12} borderBottom="1px solid" borderColor="slate.100">
							<HStack spacing={2} mb={1}>
								<Text fontSize="xs" fontFamily="mono" fontWeight="700" color="brand.600">{ticket.ticketNumber}</Text>
								<TicketStatusBadge status={ticket.status} />
							</HStack>
							<Text fontSize="xl" fontWeight="800" color="slate.900">{ticket.subject}</Text>
						</ModalHeader>
						<ModalCloseButton top={5} right={5} borderRadius="md" isDisabled={isSaving} />
						<ModalBody py={5}>
							{error ? (
								<Alert status="error" borderRadius="md" mb={4} fontSize="sm">
									<AlertIcon />
									{error}
								</Alert>
							) : null}
							<Stack spacing={5}>
								<SimpleGrid columns={{ base: 2, md: isAdmin ? 4 : 3 }} spacing={4}>
									{isAdmin ? <Detail label="Organization">{ticket.organizationName || '—'}</Detail> : null}
									<Detail label="Issue type">{ticketTypeLabel(ticket.type)}</Detail>
									<Detail label="Priority"><TicketPriorityBadge priority={ticket.priority} /></Detail>
									<Detail label="Reported">{formatTicketDate(ticket.createdAt)}</Detail>
								</SimpleGrid>

								<Detail label="Message">
									<Box p={3} bg="slate.50" border="1px solid" borderColor="slate.100" borderRadius="md" whiteSpace="pre-wrap">
										{ticket.message}
									</Box>
								</Detail>

								{isAdmin ? (
									<form id="ticket-update-form" onSubmit={handleSubmit}>
										<Stack spacing={4}>
											<FormSelect
												label="Status"
												value={status}
												onChange={(event) => setStatus(event.target.value as TicketStatus)}
												options={TICKET_STATUS_OPTIONS}
											/>
											<FormTextarea
												label="Reply to organization"
												rows={4}
												maxLength={2000}
												value={response}
												onChange={(event) => setResponse(event.target.value)}
												placeholder="Explain what was done or what the organization should do next."
											/>
										</Stack>
									</form>
								) : (
									<Detail label="Admin reply">
										{ticket.adminResponse ? (
											<Box p={3} bg="brand.50" border="1px solid" borderColor="brand.100" borderRadius="md" whiteSpace="pre-wrap">
												{ticket.adminResponse}
												<Text mt={2} fontSize="xs" color="slate.500">{formatTicketDate(ticket.respondedAt)}</Text>
											</Box>
										) : (
											<Text color="slate.500">No reply yet. The admin team will respond here.</Text>
										)}
									</Detail>
								)}
							</Stack>
						</ModalBody>
						<ModalFooter gap={3} px={6} py={4} borderTop="1px solid" borderColor="slate.100" bg="slate.50">
							<ActionButton tone="neutral" onClick={onClose} isDisabled={isSaving}>Close</ActionButton>
							{isAdmin ? (
								<ActionButton type="submit" form="ticket-update-form" isLoading={isSaving} isDisabled={!isDirty}>
									Save changes
								</ActionButton>
							) : ticket.status !== 'closed' ? (
								<ActionButton tone="danger" isLoading={isSaving} onClick={() => setPendingClose({ status: 'closed' })}>
									Close ticket
								</ActionButton>
							) : null}
						</ModalFooter>
					</>
				) : null}
			</ModalContent>
			<ConfirmDialog
				isOpen={Boolean(pendingClose)}
				title="Close this ticket?"
				description={`${ticket?.ticketNumber || 'This ticket'} will be marked as closed. Are you sure the issue no longer needs attention?`}
				confirmLabel="Yes, close ticket"
				onClose={() => setPendingClose(null)}
				onConfirm={confirmClose}
			/>
		</Modal>
	);
}

export default TicketDetailsDialog;
