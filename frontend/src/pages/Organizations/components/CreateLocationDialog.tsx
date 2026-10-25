import {
	Alert,
	AlertIcon,
	FormControl,
	FormHelperText,
	FormLabel,
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
import { useEffect, useState, type FormEvent } from 'react';
import { ActionButton, FormInput, FormSection, FormSelect, FormTextarea, MasterDataSelect } from '../../../components/ui';
import { fieldLabelStyles, fieldStyles } from '../../../components/ui/fieldStyles';
import useMasterDataOptions, { findMasterItem } from '../../../hooks/useMasterDataOptions';
import type { CreateLocationInput } from '../../../services/locationService';
import type { OrganizationLocation } from '../../../types';

type CreateLocationDialogProps = {
	isOpen: boolean;
	isSaving: boolean;
	location: OrganizationLocation | null;
	onClose: () => void;
	onSave: (input: CreateLocationInput) => Promise<boolean>;
};

const STATUS_OPTIONS = [
	{ value: 'active', label: 'Active' },
	{ value: 'disabled', label: 'Inactive' },
];

function CreateLocationDialog({ isOpen, isSaving, location, onClose, onSave }: CreateLocationDialogProps) {
	const [workName, setWorkName] = useState('');
	const [opNumber, setOpNumber] = useState('');
	const [address, setAddress] = useState('');
	const [designation, setDesignation] = useState('');
	const [status, setStatus] = useState<OrganizationLocation['status']>('active');
	const [formError, setFormError] = useState('');
	const { options: masterOptions, isLoading: isLoadingMasterData, isLoaded: hasLoadedMasterData, error: masterDataError } = useMasterDataOptions(isOpen);
	const hasNoDesignations = hasLoadedMasterData && !isLoadingMasterData && masterOptions.designation.length === 0;
	const isEditing = location !== null;

	useEffect(() => {
		if (!isOpen) return;
		setWorkName(location?.workName || '');
		setOpNumber(location?.opNumber || '');
		setAddress(location?.address || location?.name || '');
		setDesignation(location?.designation || '');
		setStatus(location?.status || 'active');
		setFormError('');
	}, [isOpen, location]);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!workName.trim()) {
			setFormError('Work name is required.');
			return;
		}
		if (!address.trim()) {
			setFormError('Address is required.');
			return;
		}
		if (!designation) {
			setFormError('Select the designation employees at this location will have.');
			return;
		}
		if (!isLoadingMasterData && !findMasterItem(masterOptions.designation, designation)) {
			setFormError('Choose a designation from the list. Designations are managed in Settings → Master data.');
			return;
		}
		setFormError('');
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
		<Modal isOpen={isOpen} onClose={onClose} size="2xl" closeOnEsc={!isSaving} closeOnOverlayClick={!isSaving} scrollBehavior="inside">
			<ModalOverlay bg="blackAlpha.600" backdropFilter="blur(3px)" />
			<ModalContent borderRadius="xl" overflow="hidden" boxShadow="0 24px 64px rgba(15, 23, 42, 0.2)">
				<ModalHeader pb={3} pr={12} borderBottom="1px solid" borderColor="slate.100">
					<Text fontSize="xl" fontWeight="800" color="slate.900">{isEditing ? 'Edit location' : 'Add location'}</Text>
					<Text mt={0.5} fontSize="sm" fontWeight="400" color="slate.500">
						A work site where employees with one designation are placed.
					</Text>
				</ModalHeader>
				<ModalCloseButton top={5} right={5} borderRadius="md" isDisabled={isSaving} />
				<ModalBody py={5} bg="slate.50">
					<form id="location-form" onSubmit={(event) => void handleSubmit(event)}>
						<Stack spacing={5}>
							{formError ? (
								<Alert status="error" borderRadius="md">
									<AlertIcon />
									{formError}
								</Alert>
							) : null}

							<FormSection title="Site details">
								<Stack spacing={4}>
									<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
										<FormInput label="Work name" isRequired autoFocus maxLength={120} value={workName} onChange={(event) => setWorkName(event.target.value)} placeholder="Kitchen operations" />
										<FormInput
											label="PO number"
											maxLength={50}
											value={opNumber}
											onChange={(event) => setOpNumber(event.target.value)}
											placeholder="5200076637"
											helperText="Printed on the wage register (FORM XVII)."
										/>
									</SimpleGrid>
									<FormTextarea
										label="Address"
										isRequired
										rows={3}
										resize="vertical"
										maxLength={500}
										value={address}
										onChange={(event) => setAddress(event.target.value)}
										placeholder="400/220 KV, RANGPO S/S, Powergrid, SIKKIM"
										helperText="Shown after the work name on the wage register."
									/>
								</Stack>
							</FormSection>

							<FormSection title="Staffing">
								<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
									<FormControl isRequired isInvalid={hasNoDesignations || Boolean(masterDataError)}>
										<FormLabel {...fieldLabelStyles}>Designation</FormLabel>
										<MasterDataSelect
											h="44px"
											{...fieldStyles}
											items={masterOptions.designation}
											valueKey="name"
											placeholder={isLoadingMasterData ? 'Loading…' : 'Select designation'}
											value={designation}
											onChange={setDesignation}
										/>
										<FormHelperText fontSize="xs" color={hasNoDesignations || masterDataError ? 'red.500' : 'slate.500'}>
											{masterDataError
												? masterDataError
												: hasNoDesignations
													? 'No designations yet. Add one in Settings → Master data.'
													: 'Only employees with this designation can be placed here.'}
										</FormHelperText>
									</FormControl>
									<FormSelect
										label="Status"
										value={status}
										onChange={(event) => setStatus(event.target.value as OrganizationLocation['status'])}
										options={STATUS_OPTIONS}
									/>
								</SimpleGrid>
							</FormSection>
						</Stack>
					</form>
				</ModalBody>
				<ModalFooter px={6} py={4} borderTop="1px solid" borderColor="slate.100" bg="white">
					<HStack spacing={3}>
						<ActionButton tone="neutral" onClick={onClose} isDisabled={isSaving}>Cancel</ActionButton>
						<ActionButton type="submit" form="location-form" isLoading={isSaving}>{isEditing ? 'Save changes' : 'Add location'}</ActionButton>
					</HStack>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

export default CreateLocationDialog;
