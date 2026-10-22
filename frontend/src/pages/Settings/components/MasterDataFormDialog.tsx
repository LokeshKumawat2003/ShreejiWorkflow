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
	Stack,
	Text,
} from '@chakra-ui/react';
import { useEffect, useState, type FormEvent } from 'react';
import { ActionButton, FormInput, FormSelect } from '../../../components/ui';
import { MASTER_DATA_LABELS } from '../../../services/masterDataService';
import type { MasterDataItem, MasterDataType } from '../../../types';

type MasterDataFormDialogProps = {
	isOpen: boolean;
	type: MasterDataType;
	item: MasterDataItem | null;
	isSaving: boolean;
	error: string;
	onClose: () => void;
	onSave: (input: { name: string; status: MasterDataItem['status'] }) => void;
};

const PLACEHOLDERS: Record<MasterDataType, string> = {
	designation: 'e.g. Electrician',
	employmentType: 'e.g. Daily wage',
	skillCategory: 'e.g. Highly skilled',
};

const STATUS_OPTIONS = [
	{ value: 'active', label: 'Active: shown in dropdowns' },
	{ value: 'disabled', label: 'Inactive: hidden from dropdowns' },
];

function MasterDataFormDialog({ isOpen, type, item, isSaving, error, onClose, onSave }: MasterDataFormDialogProps) {
	const [name, setName] = useState('');
	const [status, setStatus] = useState<MasterDataItem['status']>('active');
	const label = MASTER_DATA_LABELS[type];

	useEffect(() => {
		if (!isOpen) return;
		setName(item?.name || '');
		setStatus(item?.status || 'active');
	}, [isOpen, item]);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		onSave({ name: name.trim(), status });
	}

	const usageHint = item?.usageCount
		? `Used by ${item.usageCount} record${item.usageCount === 1 ? '' : 's'}${type === 'employmentType' ? '. Renaming updates the label everywhere.' : ', so only letter case can be changed.'}`
		: undefined;

	return (
		<Modal isOpen={isOpen} onClose={onClose} closeOnEsc={!isSaving} closeOnOverlayClick={!isSaving} isCentered>
			<ModalOverlay bg="blackAlpha.600" backdropFilter="blur(3px)" />
			<ModalContent borderRadius="xl" overflow="hidden" boxShadow="0 24px 64px rgba(15, 23, 42, 0.2)">
				<ModalHeader pb={3} pr={12} borderBottom="1px solid" borderColor="slate.100">
					<Text fontSize="xl" fontWeight="800" color="slate.900">{item ? `Edit ${label.singular}` : `Add ${label.singular}`}</Text>
					<Text mt={0.5} fontSize="sm" fontWeight="400" color="slate.500">{label.description}</Text>
				</ModalHeader>
				<ModalCloseButton top={5} right={5} borderRadius="md" isDisabled={isSaving} />
				<ModalBody py={5}>
					{error ? (
						<Alert status="error" borderRadius="md" mb={4} fontSize="sm">
							<AlertIcon />
							{error}
						</Alert>
					) : null}
					<form id="master-data-form" onSubmit={handleSubmit}>
						<Stack spacing={4}>
							<FormInput
								label="Name"
								isRequired
								autoFocus
								maxLength={100}
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder={PLACEHOLDERS[type]}
								helperText={usageHint}
							/>
							<FormSelect
								label="Status"
								value={status}
								onChange={(event) => setStatus(event.target.value as MasterDataItem['status'])}
								options={STATUS_OPTIONS}
							/>
						</Stack>
					</form>
				</ModalBody>
				<ModalFooter gap={3} px={6} py={4} borderTop="1px solid" borderColor="slate.100" bg="slate.50">
					<ActionButton tone="neutral" onClick={onClose} isDisabled={isSaving}>Cancel</ActionButton>
					<ActionButton type="submit" form="master-data-form" isLoading={isSaving} isDisabled={!name.trim()}>
						{item ? 'Save changes' : `Add ${label.singular}`}
					</ActionButton>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

export default MasterDataFormDialog;
