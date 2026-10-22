import {
	Alert,
	FormControl,
	FormHelperText,
	FormLabel,
	Input,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Select,
} from '@chakra-ui/react';
import { useEffect, useState, type FormEvent } from 'react';
import ActionButton from '../../../components/common/ActionButton';
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

	return (
		<Modal isOpen={isOpen} onClose={onClose} closeOnEsc={!isSaving} closeOnOverlayClick={!isSaving} isCentered>
			<ModalOverlay bg="blackAlpha.600" backdropFilter="blur(3px)" />
			<ModalContent borderRadius="lg">
				<ModalHeader color="slate.900">{item ? `Edit ${label.singular}` : `Add ${label.singular}`}</ModalHeader>
				<ModalCloseButton isDisabled={isSaving} />
				<ModalBody>
					{error ? <Alert status="error" borderRadius="md" mb={4} fontSize="sm">{error}</Alert> : null}
					<form id="master-data-form" onSubmit={handleSubmit}>
						<FormControl isRequired mb={4}>
							<FormLabel fontSize="sm" fontWeight="600">Name</FormLabel>
							<Input
								autoFocus
								maxLength={100}
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder={type === 'designation' ? 'e.g. Electrician' : type === 'employmentType' ? 'e.g. Daily wage' : 'e.g. Highly skilled'}
							/>
							{item?.usageCount ? (
								<FormHelperText fontSize="xs">
									Used by {item.usageCount} record{item.usageCount === 1 ? '' : 's'}
									{type === 'employmentType' ? '. Renaming updates the label everywhere.' : ', so only letter case can be changed.'}
								</FormHelperText>
							) : null}
						</FormControl>
						<FormControl>
							<FormLabel fontSize="sm" fontWeight="600">Status</FormLabel>
							<Select value={status} onChange={(event) => setStatus(event.target.value as MasterDataItem['status'])}>
								<option value="active">Active: shown in dropdowns</option>
								<option value="disabled">Inactive: hidden from dropdowns</option>
							</Select>
						</FormControl>
					</form>
				</ModalBody>
				<ModalFooter gap={3} borderTop="1px solid" borderColor="slate.100" bg="slate.50" borderBottomRadius="lg">
					<ActionButton tone="neutral" onClick={onClose} isDisabled={isSaving}>Cancel</ActionButton>
					<ActionButton type="submit" form="master-data-form" isLoading={isSaving} isDisabled={!name.trim()}>
						{item ? 'Save changes' : 'Add'}
					</ActionButton>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

export default MasterDataFormDialog;
