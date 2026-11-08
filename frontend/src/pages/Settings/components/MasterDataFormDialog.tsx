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
	Tag,
	Text,
	Wrap,
} from '@chakra-ui/react';
import { useEffect, useState, type FormEvent } from 'react';
import { ActionButton, FormInput, FormSelect } from '../../../components/ui';
import useMasterDataOptions from '../../../hooks/useMasterDataOptions';
import { MASTER_DATA_LABELS } from '../../../services/masterDataService';
import type { MasterDataItem, MasterDataType, SkillRate } from '../../../types';

export type MasterDataFormInput = {
	name: string;
	status: MasterDataItem['status'];
	designations?: string[];
	rates?: SkillRate[];
	effectiveFrom?: string;
	effectiveTo?: string;
};

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
	governmentType: 'e.g. Municipal',
	area: 'e.g. D - Remote area',
};

const RATE_KEY_SEPARATOR = '|';

function todayDate() {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function displayDate(value?: string) {
	return value ? value.split('-').reverse().join('-') : '';
}

function rateKey(governmentType: string, area: string) {
	return `${governmentType}${RATE_KEY_SEPARATOR}${area}`;
}

function mergeNames(active: MasterDataItem[], saved: string[]) {
	const names = active.map((entry) => entry.name);
	for (const name of saved) {
		if (!names.some((entry) => entry.toLowerCase() === name.toLowerCase())) names.push(name);
	}
	return names;
}

function isValidSalary(value: string) {
	const amount = Number(value);
	return value.trim() !== '' && Number.isFinite(amount) && amount >= 0 && Math.abs(Math.round(amount * 100) / 100 - amount) <= 1e-8;
}

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
	const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
	const [effectiveFrom, setEffectiveFrom] = useState('');
	const [effectiveTo, setEffectiveTo] = useState('');
	const isDateRangeValid = !effectiveFrom || !effectiveTo || effectiveTo >= effectiveFrom;
	const isWorkName = type === 'workName';
	const isSkillCategory = type === 'skillCategory';
	const { options, isLoading: isLoadingDesignations } = useMasterDataOptions(isOpen && (isWorkName || isSkillCategory));
	const governmentTypes = mergeNames(options.governmentType, (item?.rates || []).map((rate) => rate.governmentType));
	const areas = mergeNames(options.area, (item?.rates || []).map((rate) => rate.area));
	const filledRates = governmentTypes.flatMap((governmentType) => areas
		.filter((area) => (rateInputs[rateKey(governmentType, area)] || '').trim() !== '')
		.map((area) => ({ governmentType, area, key: rateKey(governmentType, area) })));
	const areRatesValid = filledRates.length > 0 && filledRates.every(({ key }) => isValidSalary(rateInputs[key]));
	const label = MASTER_DATA_LABELS[type];
	const activeDesignations = options.designation;
	const inactiveSelected = designations.filter((value) => !activeDesignations.some((entry) => entry.name.toLowerCase() === value.toLowerCase()));
	const allSelected = activeDesignations.length > 0 && activeDesignations.every((entry) => includesName(designations, entry.name));

	useEffect(() => {
		if (!isOpen) return;
		setName(item?.name || '');
		setStatus(item?.status || 'active');
		setDesignations([...(item?.designations || [])]);
		setRateInputs(Object.fromEntries((item?.rates || []).map((rate) => [rateKey(rate.governmentType, rate.area), String(rate.salary)])));
		setEffectiveFrom(item ? item.effectiveFrom || '' : todayDate());
		setEffectiveTo(item?.effectiveTo || '');
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
		onSave({
			name: name.trim(),
			status,
			...(isWorkName ? { designations } : {}),
			...(isSkillCategory
				? {
					rates: filledRates.map(({ governmentType, area, key }) => ({ governmentType, area, salary: Number(rateInputs[key]) })),
					effectiveFrom,
					effectiveTo,
				}
				: {}),
		});
	}

	const usageHint = item?.usageCount
		? `Used by ${item.usageCount} record${item.usageCount === 1 ? '' : 's'}${type === 'employmentType' ? '. Renaming updates the label everywhere.' : ', so only letter case can be changed.'}`
		: undefined;

	return (
		<Modal isOpen={isOpen} onClose={onClose} closeOnEsc={!isSaving} closeOnOverlayClick={!isSaving} isCentered size={isWorkName || isSkillCategory ? 'xl' : 'md'} scrollBehavior="inside">
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
							{isSkillCategory ? (
								<SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
									<FormInput
										label="Valid from"
										type="date"
										value={effectiveFrom}
										max={effectiveTo || undefined}
										helperText={item ? 'Set to today automatically when you change the salaries.' : 'Optional. Leave blank for no start date.'}
										onChange={(event) => setEffectiveFrom(event.target.value)}
									/>
									<FormInput
										label="Valid to"
										type="date"
										value={effectiveTo}
										min={effectiveFrom || undefined}
										isInvalid={!isDateRangeValid}
										helperText={isDateRangeValid ? 'Optional. Leave blank if it has no end date.' : 'Must be on or after Valid from.'}
										onChange={(event) => setEffectiveTo(event.target.value)}
									/>
								</SimpleGrid>
							) : null}
							{isSkillCategory ? (
								<Box>
									<Text mb={1} fontSize="sm" fontWeight="600" color="slate.700">
										Fixed salary per government type and area (daily basic pay) <Text as="span" color="red.500">*</Text>
									</Text>
									<Text mb={3} fontSize="xs" color="slate.500">
										Leave a box blank if this skill has no rate there.
										{item ? ' When you change a salary, the current rates are kept in the history with today as their end date, and the new rates start today.' : ''}
										{item?.usageCount ? ' Employees with this skill are updated to the new rates.' : ''}
									</Text>
									{isLoadingDesignations ? (
										<Text fontSize="sm" color="slate.500">Loading government types and areas…</Text>
									) : governmentTypes.length === 0 || areas.length === 0 ? (
										<Text fontSize="sm" color="slate.500">Add government types and areas in their tabs first.</Text>
									) : (
										<Stack spacing={3}>
											{governmentTypes.map((governmentType) => (
												<Box key={governmentType} p={3} border="1px solid" borderColor="slate.200" borderRadius="md" bg="slate.50">
													<Text mb={2} fontSize="sm" fontWeight="700" color="slate.800">{governmentType}</Text>
													<SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3}>
														{areas.map((area) => {
															const key = rateKey(governmentType, area);
															const value = rateInputs[key] || '';
															return (
																<FormInput
																	key={key}
																	label={area}
																	type="number"
																	inputMode="decimal"
																	min={0}
																	step="0.01"
																	placeholder="e.g. 650"
																	bg="white"
																	value={value}
																	isInvalid={value.trim() !== '' && !isValidSalary(value)}
																	onChange={(event) => setRateInputs((current) => ({ ...current, [key]: event.target.value }))}
																/>
															);
														})}
													</SimpleGrid>
												</Box>
											))}
										</Stack>
									)}
								</Box>
							) : null}
							{isSkillCategory && item?.rateHistory?.length ? (
								<Box>
									<Text mb={2} fontSize="sm" fontWeight="600" color="slate.700">Previous rates</Text>
									<Stack spacing={2} maxH="220px" overflowY="auto">
										{[...item.rateHistory].reverse().map((entry) => (
											<Box key={`${entry.changedAt}-${entry.effectiveTo}`} p={3} border="1px solid" borderColor="slate.200" borderRadius="md">
												<Text fontSize="xs" fontWeight="700" color="slate.600">
													{displayDate(entry.effectiveFrom) || 'Any time'} – {displayDate(entry.effectiveTo) || 'No end'}
												</Text>
												<Wrap mt={1.5} spacing={1.5}>
													{entry.rates.map((rate) => (
														<Tag key={`${rate.governmentType}|${rate.area}`} size="sm" borderRadius="full">
															{rate.governmentType} · {rate.area.split(' - ')[0]}: ₹{rate.salary.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
														</Tag>
													))}
												</Wrap>
											</Box>
										))}
									</Stack>
								</Box>
							) : null}
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
						isDisabled={!name.trim() || (isWorkName && designations.length === 0) || (isSkillCategory && (!areRatesValid || !isDateRangeValid))}
					>
						{item ? 'Save changes' : `Add ${label.singular}`}
					</ActionButton>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

export default MasterDataFormDialog;
