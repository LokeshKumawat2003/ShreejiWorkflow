import {
	Alert,
	AlertIcon,
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
import { useEffect, useState, type FormEvent } from 'react';
import { ActionButton, FormInput, FormSelect, FormTextarea } from '../../../components/ui';
import {
	TICKET_PRIORITY_OPTIONS,
	TICKET_TYPE_OPTIONS,
	type CreateTicketInput,
	type TicketPriority,
	type TicketType,
} from '../../../services/ticketService';

type CreateTicketDialogProps = {
	isOpen: boolean;
	isSaving: boolean;
	error: string;
	onClose: () => void;
	onSave: (input: CreateTicketInput) => void;
};

const MESSAGE_LIMIT = 2000;

function CreateTicketDialog({ isOpen, isSaving, error, onClose, onSave }: CreateTicketDialogProps) {
	const [type, setType] = useState<TicketType | ''>('');
	const [priority, setPriority] = useState<TicketPriority>('medium');
	const [subject, setSubject] = useState('');
	const [message, setMessage] = useState('');

	useEffect(() => {
		if (!isOpen) return;
		setType('');
		setPriority('medium');
		setSubject('');
		setMessage('');
	}, [isOpen]);

	const canSubmit = Boolean(type && subject.trim() && message.trim());

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!type || !canSubmit) return;
		onSave({ type, priority, subject: subject.trim(), message: message.trim() });
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose} closeOnEsc={!isSaving} closeOnOverlayClick={!isSaving} isCentered size="lg">
			<ModalOverlay bg="blackAlpha.600" backdropFilter="blur(3px)" />
			<ModalContent borderRadius="xl" overflow="hidden" boxShadow="0 24px 64px rgba(15, 23, 42, 0.2)">
				<ModalHeader pb={3} pr={12} borderBottom="1px solid" borderColor="slate.100">
					<Text fontSize="xl" fontWeight="800" color="slate.900">Report an issue</Text>
					<Text mt={0.5} fontSize="sm" fontWeight="400" color="slate.500">Tell the admin team what went wrong. You will see their reply here.</Text>
				</ModalHeader>
				<ModalCloseButton top={5} right={5} borderRadius="md" isDisabled={isSaving} />
				<ModalBody py={5}>
					{error ? (
						<Alert status="error" borderRadius="md" mb={4} fontSize="sm">
							<AlertIcon />
							{error}
						</Alert>
					) : null}
					<form id="create-ticket-form" onSubmit={handleSubmit}>
						<Stack spacing={4}>
							<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
								<FormSelect
									label="Issue type"
									isRequired
									placeholder="Select issue type"
									value={type}
									onChange={(event) => setType(event.target.value as TicketType | '')}
									options={TICKET_TYPE_OPTIONS}
								/>
								<FormSelect
									label="Priority"
									value={priority}
									onChange={(event) => setPriority(event.target.value as TicketPriority)}
									options={TICKET_PRIORITY_OPTIONS}
								/>
							</SimpleGrid>
							<FormInput
								label="Subject"
								isRequired
								maxLength={150}
								value={subject}
								onChange={(event) => setSubject(event.target.value)}
								placeholder="e.g. Attendance not saving for March"
							/>
							<FormTextarea
								label="Message"
								isRequired
								rows={6}
								maxLength={MESSAGE_LIMIT}
								value={message}
								onChange={(event) => setMessage(event.target.value)}
								placeholder="Describe the issue: what you did, what happened, and which employee or location it affects."
								helperText={`${message.length} / ${MESSAGE_LIMIT}`}
							/>
						</Stack>
					</form>
				</ModalBody>
				<ModalFooter gap={3} px={6} py={4} borderTop="1px solid" borderColor="slate.100" bg="slate.50">
					<ActionButton tone="neutral" onClick={onClose} isDisabled={isSaving}>Cancel</ActionButton>
					<ActionButton type="submit" form="create-ticket-form" isLoading={isSaving} isDisabled={!canSubmit}>
						Submit report
					</ActionButton>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

export default CreateTicketDialog;
