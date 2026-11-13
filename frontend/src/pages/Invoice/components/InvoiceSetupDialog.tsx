import { AddIcon, ArrowDownIcon, ArrowUpIcon, DeleteIcon } from '@chakra-ui/icons';
import {
	Alert,
	AlertIcon,
	Box,
	Checkbox,
	Flex,
	HStack,
	IconButton,
	Input,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Select,
	SimpleGrid,
	Stack,
	Switch,
	Tab,
	TabList,
	TabPanel,
	TabPanels,
	Tabs,
	Text,
	Textarea,
} from '@chakra-ui/react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ActionButton, FormInput } from '../../../components/ui';
import { ApiError } from '../../../services/api';
import {
	LABOUR_QTY_OPTIONS,
	saveInvoiceSetup,
	type InvoiceItem,
	type InvoiceSetup,
	type InvoiceSetupInput,
	type BillingFrequency,
	type InvoiceSetupItem,
	type LabourQtySource,
	type QtySource,
	type RateSource,
} from '../../../services/invoiceService';

type InvoiceSetupDialogProps = {
	isOpen: boolean;
	organizationId: string;
	locationId: string;
	setup: InvoiceSetup;
	skillCategories: string[];
	autoLabourLines: InvoiceItem[];
	monthDays: string;
	onClose: () => void;
	onSaved: (setup: InvoiceSetup) => void;
	initialTab: number;
	monthTab: {
		label: string;
		content: ReactNode;
		saveLabel: string;
		canSave: boolean;
		isSaving: boolean;
		onSave: () => void;
	};
};

const QTY_SOURCES: { value: QtySource; label: string }[] = [
	{ value: 'mandays', label: 'Man-days from attendance' },
	{ value: 'manmonths', label: 'Man-months (man-days ÷ paid days in a month)' },
	{ value: 'persons', label: 'Persons (1 per person for the month)' },
	{ value: 'manual', label: 'Fixed / typed quantity' },
];

const RATE_SOURCES: { value: RateSource; label: string }[] = [
	{ value: 'auto', label: 'Rate: auto from wages + statutory' },
	{ value: 'relieving', label: 'Rate: relieving % of auto rate' },
	{ value: 'fixed', label: 'Rate: fixed amount (supply only)' },
];

const EMPTY_ITEM: InvoiceSetupItem = { description: '', unit: 'MND', rateSource: 'auto', explain: true, rate: 0, qtySource: 'mandays', skillCategory: '', defaultQty: 0, section: 'service', frequency: 'monthly', billMonth: '' };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function billingPatch(frequency: BillingFrequency): Partial<InvoiceSetupItem> {
	const thisMonth = new Date().toISOString().slice(0, 7);
	return { frequency, billMonth: frequency === 'yearly' ? thisMonth.slice(5) : frequency === 'once' ? thisMonth : '' };
}

function toInput(setup: InvoiceSetup): InvoiceSetupInput {
	return {
		workTitle: setup.workTitle,
		vendorCode: setup.vendorCode,
		loaNumber: setup.loaNumber,
		loaDate: setup.loaDate,
		sapPo: setup.sapPo,
		billToNote: setup.billToNote,
		gstLabel: setup.gstLabel,
		gstRate: setup.gstRate,
		firstRaBillNo: setup.firstRaBillNo,
		autoLabour: setup.autoLabour,
		rateBreakup: setup.rateBreakup !== false,
		labourQtyType: setup.labourQtyType ?? '',
		items: setup.items.map((item) => ({ ...item, frequency: item.frequency ?? 'monthly', billMonth: item.billMonth ?? '', rateSource: item.rateSource === 'fixed' && item.section !== 'supply' ? 'auto' : item.rateSource })),
	};
}

const smallField = { size: 'sm', bg: 'white', borderColor: 'slate.200', borderRadius: '8px' } as const;

function isAutoLabour(item: InvoiceSetupItem) {
	return item.section !== 'supply' && item.rateSource === 'auto';
}

/** With auto labour on, extra labour lines are relieving charges and supply lines carry a typed rate. */
function extraRateSource(section: InvoiceSetupItem['section']): RateSource {
	return section === 'supply' ? 'fixed' : 'relieving';
}

function autoHelp(value: string, fallback: string, source: string) {
	if (value.trim()) return 'Typed here — clear it to use the automatic value.';
	return fallback ? `Auto from ${source}: ${fallback}` : `Auto from ${source} — not added there yet.`;
}

function InvoiceSetupDialog({ isOpen, organizationId, locationId, setup, skillCategories, autoLabourLines, monthDays, onClose, onSaved, initialTab, monthTab }: InvoiceSetupDialogProps) {
	const [values, setValues] = useState<InvoiceSetupInput>(() => toInput(setup));
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState('');
	const [tab, setTab] = useState(initialTab);

	useEffect(() => {
		if (isOpen) {
			setValues(toInput(setup));
			setError('');
		}
	}, [isOpen, setup]);

	useEffect(() => {
		if (isOpen) setTab(initialTab);
	}, [initialTab, isOpen]);

	function setField<K extends keyof InvoiceSetupInput>(key: K, value: InvoiceSetupInput[K]) {
		setValues((current) => ({ ...current, [key]: value }));
	}

	function setItem(index: number, patch: Partial<InvoiceSetupItem>) {
		setValues((current) => ({ ...current, items: current.items.map((item, position) => (position === index ? { ...item, ...patch } : item)) }));
	}

	function moveItem(index: number, offset: number) {
		setValues((current) => {
			const items = [...current.items];
			const target = index + offset;
			if (target < 0 || target >= items.length) return current;
			[items[index], items[target]] = [items[target], items[index]];
			return { ...current, items };
		});
	}

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (tab !== 1) return;
		setIsSaving(true);
		setError('');
		try {
			const items = values.autoLabour
				? values.items.map((item) => (isAutoLabour(item) ? item : { ...item, qtySource: 'manual' as QtySource, skillCategory: '', rateSource: extraRateSource(item.section) }))
				: values.items;
			onSaved(await saveInvoiceSetup(organizationId, locationId, { ...values, items }));
		} catch (saveError) {
			setError(saveError instanceof ApiError ? saveError.message : 'Unable to save the invoice setup.');
		} finally {
			setIsSaving(false);
		}
	}

	const categories = [...new Set(['Skilled', 'Semi-Skilled', 'Un-skilled', ...skillCategories.filter((category) => category !== 'Not set')])];

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
			<ModalOverlay />
			<ModalContent as="form" onSubmit={(event) => void submit(event as unknown as FormEvent)}>
				<ModalHeader>
					Invoice setup
					<Text fontSize="sm" fontWeight="400" color="slate.500">This month's invoice lines, plus the contract details and rate card every month is built from.</Text>
				</ModalHeader>
				<ModalCloseButton />
				<ModalBody>
					<Tabs index={tab} onChange={setTab} variant="soft-rounded" colorScheme="brand" size="sm" isLazy>
						<TabList gap={2} mb={4}>
							<Tab border="1px solid" borderColor="slate.200">{monthTab.label}</Tab>
							<Tab border="1px solid" borderColor="slate.200">Contract & rates</Tab>
						</TabList>
						<TabPanels>
							<TabPanel p={0}>{monthTab.content}</TabPanel>
							<TabPanel p={0}>
					<Stack spacing={5}>
						{error ? <Alert status="error" borderRadius="md"><AlertIcon />{error}</Alert> : null}
						<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
							<Box gridColumn={{ md: 'span 2' }}>
								<FormInput label="Name of work" maxLength={300} placeholder={setup.defaultWorkTitle} value={values.workTitle} helperText={autoHelp(values.workTitle, setup.defaultWorkTitle, 'location work name')} onChange={(event) => setField('workTitle', event.target.value)} />
							</Box>
							<FormInput label="LOA / GeM contract number" maxLength={120} placeholder={setup.defaultLoaNumber || 'GEMC-511687787412439'} value={values.loaNumber} helperText={autoHelp(values.loaNumber, setup.defaultLoaNumber, "location's LOA reference")} onChange={(event) => setField('loaNumber', event.target.value)} />
							<FormInput label="LOA date" type="date" value={values.loaDate} onChange={(event) => setField('loaDate', event.target.value)} />
							<FormInput label="SAP PO" maxLength={60} placeholder={setup.defaultSapPo || '5200076637'} value={values.sapPo} helperText={autoHelp(values.sapPo, setup.defaultSapPo, "location's PO number")} onChange={(event) => setField('sapPo', event.target.value)} />
							<FormInput label="Vendor code" maxLength={40} placeholder={setup.defaultVendorCode} value={values.vendorCode} helperText={autoHelp(values.vendorCode, setup.defaultVendorCode, 'Settings → Invoice')} onChange={(event) => setField('vendorCode', event.target.value)} />
							<FormInput label="Footer note (left bottom)" maxLength={200} placeholder="Bill to -60070438" value={values.billToNote} onChange={(event) => setField('billToNote', event.target.value)} />
							<SimpleGrid columns={3} spacing={3}>
								<FormInput label="Tax" maxLength={20} value={values.gstLabel} onChange={(event) => setField('gstLabel', event.target.value)} />
								<FormInput label="Tax %" type="number" min={0} max={100} step="0.01" value={values.gstRate} onChange={(event) => setField('gstRate', Number(event.target.value))} />
								<FormInput label="First RA bill no." type="number" min={1} value={values.firstRaBillNo} onChange={(event) => setField('firstRaBillNo', Number(event.target.value))} />
							</SimpleGrid>
						</SimpleGrid>

						<Flex p={3} justify="space-between" align="center" gap={3} border="1px solid" borderColor="slate.200" borderRadius="md">
							<Box>
								<Text fontWeight="700" color="slate.900">Itemised rate breakup</Text>
								<Text fontSize="xs" color="slate.600">
									Each labour line prints as separate rows: wages, EPF / EDLI, ESIC, bonus, overhead and service charge (rows with 0% are left out).
									Turn off to print one all-inclusive rate per line.
								</Text>
							</Box>
							<Switch colorScheme="brand" isChecked={values.rateBreakup} onChange={(event) => setField('rateBreakup', event.target.checked)} />
						</Flex>

						<Box p={3} border="1px solid" borderColor="brand.100" bg="brand.50" borderRadius="md">
							<Flex justify="space-between" align="center" gap={3}>
								<Box>
									<Text fontWeight="700" color="slate.900">Labour lines automatically from employees</Text>
									<Text fontSize="xs" color="slate.600">One line per skill category working this month, with man-days from attendance and rate from wages.</Text>
								</Box>
								<Switch colorScheme="brand" isChecked={values.autoLabour} onChange={(event) => setField('autoLabour', event.target.checked)} />
							</Flex>
							{values.autoLabour ? (
								<Stack mt={3} spacing={1.5}>
									<Flex direction={{ base: 'column', md: 'row' }} align={{ md: 'center' }} gap={3} px={3} py={2} bg="white" borderRadius="md">
										<Box flex="1" minW={0}>
											<Text fontSize="sm" fontWeight="600" color="slate.800">Quantity type for this location</Text>
											<Text fontSize="xs" color="slate.600">
												{LABOUR_QTY_OPTIONS.find((option) => option.value === (values.labourQtyType || setup.defaultLabourQty))?.hint(monthDays)}
											</Text>
										</Box>
										<Select {...smallField} flexShrink={0} w={{ base: 'full', md: '260px' }} aria-label="Quantity type for this location" value={values.labourQtyType} onChange={(event) => setField('labourQtyType', event.target.value as LabourQtySource | '')}>
											<option value="">Default ({LABOUR_QTY_OPTIONS.find((option) => option.value === setup.defaultLabourQty)?.label})</option>
											{LABOUR_QTY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
										</Select>
									</Flex>
									{autoLabourLines.length ? autoLabourLines.map((line, index) => (
										<Flex key={index} justify="space-between" gap={3} px={3} py={2} bg="white" borderRadius="md" fontSize="sm">
											<Text color="slate.800" whiteSpace="pre-line" noOfLines={2}>{line.description}</Text>
											<Text flexShrink={0} color="slate.600">{line.qty} {line.unit} × ₹{line.rate.toFixed(2)}</Text>
										</Flex>
									)) : <Text fontSize="xs" color="slate.500">No employees with attendance this month yet.</Text>}
									<Text fontSize="xs" color="slate.500">Changing the quantity type applies to every labour line here. Save setup to recalculate.</Text>
								</Stack>
							) : null}
						</Box>

						<Box>
							<Flex justify="space-between" align="center" mb={2}>
								<Box>
									<Text fontWeight="700" color="slate.900">{values.autoLabour ? 'Extra lines (relieving charge, supply items)' : 'Invoice lines'}</Text>
									<Text fontSize="xs" color="slate.500">Service lines are taxed and totalled as the service part. Supply lines (reimbursements, uniforms) come after it.</Text>
									<Text fontSize="xs" color="slate.500">
										Auto rate = employees' daily wage (× paid days for Month lines) + EPF, ESIC, bonus and service charge from Settings → Invoice.
										In the description, {'{count}'} {'{category}'} {'{designation}'} {'{wage}'} {'{days}'} {'{mandays}'} {'{monthly}'} {'{statutory}'} are filled from data,
										e.g. "{'{count}'} no. {'{category}'} manpower @{'{wage}'} X {'{days}'} days".
									</Text>
								</Box>
								<ActionButton size="sm" tone="neutral" leftIcon={<AddIcon boxSize={2.5} />} onClick={() => setField('items', [...values.items, values.autoLabour ? { ...EMPTY_ITEM, unit: 'No', section: 'supply', rateSource: 'fixed', qtySource: 'manual', explain: false } : { ...EMPTY_ITEM }])}>
									Add line
								</ActionButton>
							</Flex>
							<Stack spacing={3}>
								{values.items.map((item, index) => (isAutoLabour(item) && values.autoLabour ? null : (
									<Box key={index} p={3} border="1px solid" borderColor="slate.200" borderRadius="md" bg="slate.50">
										<Flex gap={3} align="flex-start">
											<Text mt={1.5} w="22px" fontWeight="700" color="slate.500" fontSize="sm">{index + 1}</Text>
											<Stack flex="1" spacing={2} minW={0}>
												<Textarea
													{...smallField}
													rows={2}
													maxLength={300}
													placeholder={'1 no. Skilled Manpower ( MALI@781.00 Per days )\nIncluding all total Statutory Wages'}
													value={item.description}
													onChange={(event) => setItem(index, { description: event.target.value })}
												/>
												<SimpleGrid columns={{ base: 2, md: 6 }} spacing={2}>
													<Select
														{...smallField}
														aria-label="Section"
														value={item.section}
														onChange={(event) => {
															const section = event.target.value as InvoiceSetupItem['section'];
															if (values.autoLabour) setItem(index, { section, rateSource: extraRateSource(section), explain: false });
															else setItem(index, { section, ...(section === 'service' && item.rateSource === 'fixed' ? { rateSource: 'auto' as RateSource } : {}) });
														}}
													>
														<option value="service">{values.autoLabour ? 'Labour (relieving charge)' : 'Labour (service part)'}</option>
														<option value="supply">Supply item</option>
													</Select>
													<Input {...smallField} aria-label="Unit" placeholder="Unit (MND, Month, No)" maxLength={20} value={item.unit} onChange={(event) => setItem(index, { unit: event.target.value })} />
													{values.autoLabour ? null : (
														<Select {...smallField} aria-label="Rate from" value={item.rateSource} onChange={(event) => setItem(index, { rateSource: event.target.value as RateSource })}>
															{RATE_SOURCES.filter((source) => source.value !== 'fixed' || item.section === 'supply').map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
														</Select>
													)}
													{(values.autoLabour ? item.section === 'supply' : item.rateSource === 'fixed' && item.section === 'supply') ? (
														<Input {...smallField} aria-label="Rate" type="number" min={0} step="0.01" placeholder="Rate" value={item.rate || ''} onChange={(event) => setItem(index, { rate: Number(event.target.value) })} />
													) : values.autoLabour ? (
														<Text alignSelf="center" fontSize="xs" color="slate.600">Rate: relieving % of labour rate</Text>
													) : null}
													{values.autoLabour ? null : (
														<Box gridColumn={{ base: 'span 2', md: 'span 2' }}>
															<Select {...smallField} aria-label="Quantity from" value={item.qtySource} onChange={(event) => setItem(index, { qtySource: event.target.value as QtySource })}>
																{QTY_SOURCES.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
															</Select>
														</Box>
													)}
													{values.autoLabour || item.qtySource === 'manual' ? (
														<Input {...smallField} aria-label="Quantity" type="number" min={0} step="0.001" placeholder="Qty" value={item.defaultQty || ''} onChange={(event) => setItem(index, { defaultQty: Number(event.target.value) })} />
													) : (
														<Select {...smallField} aria-label="Skill category" value={item.skillCategory} onChange={(event) => setItem(index, { skillCategory: event.target.value })}>
															<option value="">All employees</option>
															{categories.map((category) => <option key={category} value={category}>{category}</option>)}
														</Select>
													)}
												</SimpleGrid>
												<HStack spacing={2} flexWrap="wrap">
													<Select {...smallField} w={{ base: 'full', md: '220px' }} aria-label="How often" value={item.frequency} onChange={(event) => setItem(index, billingPatch(event.target.value as BillingFrequency))}>
														<option value="monthly">Every month</option>
														<option value="yearly">Yearly (once every year)</option>
														<option value="once">One time only</option>
													</Select>
													{item.frequency === 'yearly' ? (
														<Select {...smallField} w={{ base: 'full', md: '180px' }} aria-label="Billed every year in" value={item.billMonth} onChange={(event) => setItem(index, { billMonth: event.target.value })}>
															{MONTHS.map((name, position) => <option key={name} value={String(position + 1).padStart(2, '0')}>Every {name}</option>)}
														</Select>
													) : null}
													{item.frequency === 'once' ? (
														<Input {...smallField} w={{ base: 'full', md: '180px' }} type="month" aria-label="Billed once in" value={item.billMonth} onChange={(event) => setItem(index, { billMonth: event.target.value })} />
													) : null}
													{item.frequency !== 'monthly' ? (
														<Text fontSize="xs" color="slate.500">
															{item.frequency === 'yearly' ? 'Added to the invoice only in this month, every year.' : 'Added to the invoice only in this one month.'}
														</Text>
													) : null}
												</HStack>
												{item.rateSource === 'auto' ? (
													<Checkbox size="sm" colorScheme="brand" isChecked={item.explain} onChange={(event) => setItem(index, { explain: event.target.checked })}>
														<Text fontSize="xs" color="slate.600">Explain the rate in the table, e.g. (Supervisor @781.00= 20306/- PM, EPF@13%, ESIC@3.25%, Bonus@8.33%)</Text>
													</Checkbox>
												) : null}
											</Stack>
											<HStack spacing={1}>
												<IconButton aria-label="Move up" size="sm" variant="ghost" icon={<ArrowUpIcon />} isDisabled={index === 0} onClick={() => moveItem(index, -1)} />
												<IconButton aria-label="Move down" size="sm" variant="ghost" icon={<ArrowDownIcon />} isDisabled={index === values.items.length - 1} onClick={() => moveItem(index, 1)} />
												<IconButton aria-label="Remove line" size="sm" variant="ghost" colorScheme="red" icon={<DeleteIcon />} isDisabled={!values.autoLabour && values.items.length === 1} onClick={() => setField('items', values.items.filter((_, position) => position !== index))} />
											</HStack>
										</Flex>
									</Box>
								)))}
							</Stack>
						</Box>
					</Stack>
							</TabPanel>
						</TabPanels>
					</Tabs>
				</ModalBody>
				<ModalFooter gap={2}>
					<ActionButton tone="neutral" onClick={onClose}>Close</ActionButton>
					{tab === 0 ? (
						<ActionButton isLoading={monthTab.isSaving} isDisabled={!monthTab.canSave} onClick={monthTab.onSave}>{monthTab.saveLabel}</ActionButton>
					) : (
						<ActionButton type="submit" isLoading={isSaving}>Save setup</ActionButton>
					)}
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

export default InvoiceSetupDialog;
