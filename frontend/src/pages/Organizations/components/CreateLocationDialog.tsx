import { FormControl, FormLabel, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Stack } from '@chakra-ui/react';
import { useEffect, useState, type FormEvent } from 'react';
import { ActionButton, FormInput, FormSelect, FormTextarea, MasterDataSelect } from '../../../components/ui';
import { fieldLabelStyles, fieldStyles } from '../../../components/ui/fieldStyles';
import useMasterDataOptions from '../../../hooks/useMasterDataOptions';
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
	const [designation, setDesignation] = useState('');
	const { options: masterOptions, isLoading: isLoadingMasterData } = useMasterDataOptions(isOpen);
	const [status, setStatus] = useState<OrganizationLocation['status']>('active');

	useEffect(() => {
		if (!isOpen) return;
		setWorkName(location?.workName || '');
		setOpNumber(location?.opNumber || '');
		setAddress(location?.address || location?.name || '');
		setDesignation(location?.designation || '');
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
						<Stack spacing={4}>
							<FormInput label="Work name" isRequired autoFocus maxLength={120} value={workName} onChange={(event) => setWorkName(event.target.value)} placeholder="Kitchen operations" />
							<FormInput label="OP number" maxLength={50} value={opNumber} onChange={(event) => setOpNumber(event.target.value)} placeholder="OP-001" />
							<FormTextarea label="Address" isRequired maxLength={500} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street, city, region, postal code" />
							<FormControl isRequired>
								<FormLabel {...fieldLabelStyles}>Designation</FormLabel>
								<MasterDataSelect
									h="44px"
									{...fieldStyles}
									items={masterOptions.designation}
									valueKey="code"
									placeholder={isLoadingMasterData ? 'Loading…' : 'Select designation'}
									value={designation}
									onChange={setDesignation}
								/>
							</FormControl>
							<FormSelect
								label="Status"
								value={status}
								onChange={(event) => setStatus(event.target.value as OrganizationLocation['status'])}
								options={[{ value: 'active', label: 'Active' }, { value: 'disabled', label: 'Inactive' }]}
							/>
						</Stack>
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
