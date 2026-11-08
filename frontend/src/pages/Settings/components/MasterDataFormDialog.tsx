import {
	Alert,
	AlertIcon,
	Box,
	Checkbox,
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
import { ActionButton, FormInput, FormSelect } from '../../../components/ui';
import useMasterDataOptions from '../../../hooks/useMasterDataOptions';
import { MASTER_DATA_LABELS } from '../../../services/masterDataService';
import type { MasterDataItem, MasterDataType } from '../../../types';

export type MasterDataFormInput = { name: string; status: MasterDataItem['status']; designations?: string[] };

type MasterDataFormDialogProps = {
	isOpen: boolean;
	type: MasterDataType;
	item: MasterDataItem | null;
	isSaving: boolean;
	error: string;
	onClose: () => void;
	onSave: (input: MasterDataFormInput) => void;
};

const PLACEHOLDERS: Record<MasterDataType, string> = {
	designation: 'e.g. Electrician',
	employmentType: 'e.g. Daily wage',
	skillCategory: 'e.g. Highly skilled',
	workName: 'e.g. Electrical work',
};

const STATUS_OPTIONS = [
	{ value: 'active', label: 'Active: shown in dropdowns' },
	{ value: 'disabled', label: 'Inactive: hidden from dropdowns' },
];

function includesName(list: string[], name: string) {
	return list.some((item) => item.toLowerCase() === name.toLowerCase());
}

function MasterDataFormDialog({ isOpen, type, item, isSaving, error, onClose, onSave }: MasterDataFormDialogProps) {
	const [name, setName] = useState('');
	const [status, setStatus] = useState<MasterDataItem['status']>('active');
	const [designations, setDesignations] = useState<string[]>([]);
	const isWorkName = type === 'workName';
	const { options, isLoading: isLoadingDesignations } = useMasterDataOptions(isOpen && isWorkName);
	const label = MASTER_DATA_LABELS[type];
	const activeDesignations = options.designation;
	const inactiveSelected = designations.filter((value) => !activeDesignations.some((entry) => entry.name.toLowerCase() === value.toLowerCase()));
	const allSelected = activeDesignations.length > 0 && activeDesignations.every((entry) => includesName(designations, entry.name));

	useEffect(() => {
		if (!isOpen) return;
		setName(item?.name || '');
		setStatus(item?.status || 'active');
		setDesignations([...(item?.designations || [])]);
	}, [isOpen, item]);

	function toggleDesignation(value: string, isChecked: boolean) {
		setDesignations((current) => (
			isChecked
				? includesName(current, value) ? current : [...current, value]
				: current.filter((entry) => entry.toLowerCase() !== value.toLowerCase())
		));
	}

	function toggleAll(isChecked: boolean) {
		setDesignations(isChecked ? [...inactiveSelected, ...activeDesignations.map((entry) => entry.name)] : inactiveSelected);
	}

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		onSave({ name: name.trim(), status, ...(isWorkName ? { designations } : {}) });
	}

	const usageHint = item?.usageCount
		? `Used by ${item.usageCount} record${item.usageCount === 1 ? '' : 's'}${type === 'employmentType' ? '. Renaming updates the label everywhere.' : ', so only letter case can be changed.'}`
		: undefined;

	return (
		<Modal isOpen={isOpen} onClose={onClose} closeOnEsc={!isSaving} closeOnOverlayClick={!isSaving} isCentered size={isWorkName ? 'xl' : 'md'} scrollBehavior="inside">
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
							{isWorkName ? (
								<Box>
									<HStack mb={2} justify="space-between">
										<Text fontSize="sm" fontWeight="600" color="slate.700">
											Designations <Text as="span" color="red.500">*</Text>
											<Text as="span" ml={2} fontWeight="400" color="slate.500">{designations.length} selected</Text>
										</Text>
										{activeDesignations.length > 0 ? (
											<Checkbox size="sm" colorScheme="brand" isChecked={allSelected} onChange={(event) => toggleAll(event.target.checked)}>
												Select all
											</Checkbox>
										) : null}
									</HStack>
									{isLoadingDesignations ? (
										<Text fontSize="sm" color="slate.500">Loading designations…</Text>
									) : activeDesignations.length === 0 && inactiveSelected.length === 0 ? (
										<Text fontSize="sm" color="slate.500">Add designations in the Designation tab first.</Text>
									) : (
										<SimpleGrid columns={{ base: 1, sm: 2 }} spacing={2} maxH="260px" overflowY="auto" p={3} border="1px solid" borderColor="slate.200" borderRadius="md" bg="slate.50">
											{activeDesignations.map((entry) => (
												<Checkbox
													key={entry.id}
													colorScheme="brand"
													isChecked={includesName(designations, entry.name)}
													onChange={(event) => toggleDesignation(entry.name, event.target.checked)}
												>
													<Text fontSize="sm">{entry.name}</Text>
												</Checkbox>
											))}
											{inactiveSelected.map((value) => (
												<Checkbox key={value} colorScheme="brand" isChecked onChange={() => toggleDesignation(value, false)}>
													<Text fontSize="sm" color="slate.500">{value} (inactive)</Text>
												</Checkbox>
											))}
										</SimpleGrid>
									)}
								</Box>
							) : null}
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
					<ActionButton
						type="submit"
						form="master-data-form"
						isLoading={isSaving}
						isDisabled={!name.trim() || (isWorkName && designations.length === 0)}
					>
						{item ? 'Save changes' : `Add ${label.singular}`}
					</ActionButton>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

export default MasterDataFormDialog;
