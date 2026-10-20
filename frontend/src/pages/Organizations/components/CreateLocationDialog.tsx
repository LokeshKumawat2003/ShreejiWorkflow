import { FormControl, FormLabel, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, Textarea } from '@chakra-ui/react';
import { useEffect, useState, type FormEvent } from 'react';
import ActionButton from '../../../components/common/ActionButton';
import type { CreateLocationInput } from '../../../services/locationService';
import type { OrganizationLocation } from '../../../types';

type CreateLocationDialogProps = {
	isOpen: boolean;
	isSaving: boolean;
	location: OrganizationLocation | null;
	onClose: () => void;
	onSave: (input: CreateLocationInput) => Promise<boolean>;
};

function CreateLocationDialog({ isOpen, isSaving, location, onClose, onSave }: CreateLocationDialogProps) {
	const [workName, setWorkName] = useState('');
	const [opNumber, setOpNumber] = useState('');
	const [address, setAddress] = useState('');
	const [designation, setDesignation] = useState<OrganizationLocation['designation']>('cook');
	const [status, setStatus] = useState<OrganizationLocation['status']>('active');

	useEffect(() => {
		if (!isOpen) return;
		setWorkName(location?.workName || '');
		setOpNumber(location?.opNumber || '');
		setAddress(location?.address || location?.name || '');
		setDesignation(location?.designation || 'cook');
		setStatus(location?.status || 'active');
	}, [isOpen, location]);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (await onSave({
			workName: workName.trim(),
			opNumber: opNumber.trim(),
			name: address.trim(),
			address: address.trim(),
			designation,
			status,
		})) onClose();
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="lg" closeOnEsc={!isSaving} closeOnOverlayClick={!isSaving}>
			<ModalOverlay bg="blackAlpha.600" backdropFilter="blur(3px)" />
			<ModalContent borderRadius="8px">
				<ModalHeader color="slate.900">{location ? 'Edit location' : 'Add location'}</ModalHeader>
				<ModalCloseButton isDisabled={isSaving} />
				<ModalBody>
					<form id="location-form" onSubmit={(event) => void handleSubmit(event)}>
						<FormControl isRequired mb={4}>
							<FormLabel fontSize="sm" fontWeight="600">Work name</FormLabel>
							<Input autoFocus maxLength={120} value={workName} onChange={(event) => setWorkName(event.target.value)} placeholder="Kitchen operations" />
						</FormControl>
						<FormControl mb={4}>
							<FormLabel fontSize="sm" fontWeight="600">OP number</FormLabel>
							<Input maxLength={50} value={opNumber} onChange={(event) => setOpNumber(event.target.value)} placeholder="OP-001" />
						</FormControl>
						<FormControl isRequired mb={4}>
							<FormLabel fontSize="sm" fontWeight="600">Address</FormLabel>
							<Textarea autoFocus maxLength={500} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street, city, region, postal code" />
						</FormControl>
						<FormControl isRequired mb={4}>
							<FormLabel fontSize="sm" fontWeight="600">Designation</FormLabel>
							<Select value={designation} onChange={(event) => setDesignation(event.target.value as OrganizationLocation['designation'])}>
								<option value="cook">Cook</option>
								<option value="event">Event</option>
								<option value="plumber">Plumber</option>
							</Select>
						</FormControl>
						<FormControl>
							<FormLabel fontSize="sm" fontWeight="600">Status</FormLabel>
							<Select value={status} onChange={(event) => setStatus(event.target.value as OrganizationLocation['status'])}>
								<option value="active">Active</option>
								<option value="disabled">Inactive</option>
							</Select>
						</FormControl>
					</form>
				</ModalBody>
				<ModalFooter gap={3} borderTop="1px solid" borderColor="slate.100" bg="slate.50">
						<ActionButton tone="neutral" onClick={onClose} isDisabled={isSaving}>Cancel</ActionButton>
						<ActionButton type="submit" form="location-form" isLoading={isSaving}>{location ? 'Save changes' : 'Add location'}</ActionButton>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

export default CreateLocationDialog;
