import { RepeatIcon } from '@chakra-ui/icons';
import { Box, Flex, Input, SimpleGrid, Stack, Text, Textarea } from '@chakra-ui/react';
import { ActionButton, FormInput } from '../../../components/ui';
import { COMPONENT_LABELS, type InvoiceItem } from '../../../services/invoiceService';
import { money } from '../utils/invoiceDocument';

export type InvoiceDraft = {
	invoiceNumber: string;
	invoiceDate: string;
	raBillNo: number | '';
	items: InvoiceItem[];
};

type InvoiceMonthEditorProps = {
	periodLabel: string;
	draft: InvoiceDraft;
	isSaved: boolean;
	onChange: (draft: InvoiceDraft) => void;
	onItemChange: (index: number, patch: Partial<InvoiceItem>) => void;
	onRefill: () => void;
};

export function isFixedRate(item: InvoiceItem) {
	return item.rateSource === 'fixed' && item.section === 'supply';
}

function isBreakupRow(item: InvoiceItem) {
	return Boolean(item.component);
}

const cellField = { size: 'sm', bg: 'white', borderColor: 'slate.200', borderRadius: '8px' } as const;

function InvoiceMonthEditor({ periodLabel, draft, isSaved, onChange, onItemChange, onRefill }: InvoiceMonthEditorProps) {
	return (
		<Stack spacing={5}>
			<SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
				<FormInput
					label="Invoice no."
					maxLength={60}
					value={draft.invoiceNumber}
					helperText={isSaved ? 'Saved number' : 'Next number — changes only if you edit it'}
					onChange={(event) => onChange({ ...draft, invoiceNumber: event.target.value })}
				/>
				<FormInput label="Dated" type="date" value={draft.invoiceDate} onChange={(event) => onChange({ ...draft, invoiceDate: event.target.value })} />
				<FormInput
					label="RA bill no."
					type="number"
					min={0}
					value={draft.raBillNo}
					onChange={(event) => onChange({ ...draft, raBillNo: event.target.value === '' ? '' : Number(event.target.value) })}
				/>
			</SimpleGrid>

			<Box>
				<Flex justify="space-between" align="center" mb={3} gap={3} flexWrap="wrap">
					<Box>
						<Text fontWeight="700" color="slate.900">Lines for {periodLabel}</Text>
						<Text fontSize="xs" color="slate.500">Labour rates are calculated from employee wages and Settings → Invoice and cannot be typed. Wages, EPF, ESIC, bonus, overhead and service charge rows take their quantity from attendance.</Text>
					</Box>
					<ActionButton size="sm" tone="neutral" leftIcon={<RepeatIcon />} onClick={onRefill}>
						Refill from attendance
					</ActionButton>
				</Flex>
				<SimpleGrid display={{ base: 'none', md: 'grid' }} columns={12} spacing={2} px={2} pb={1} fontSize="11px" fontWeight="700" color="slate.400" textTransform="uppercase" letterSpacing="0.06em">
					<Text gridColumn="span 5">Description</Text>
					<Text gridColumn="span 2">Type</Text>
					<Text>Unit</Text>
					<Text>Qty</Text>
					<Text textAlign="right">Rate</Text>
					<Text gridColumn="span 2" textAlign="right">Amount</Text>
				</SimpleGrid>
				<Stack spacing={2}>
					{draft.items.map((item, index) => (
						<SimpleGrid
							key={index}
							columns={{ base: 2, md: 12 }}
							spacing={2}
							alignItems="center"
							p={2}
							borderRadius="md"
							bg={item.section === 'supply' ? 'orange.50' : 'slate.50'}
						>
							<Box gridColumn={{ base: 'span 2', md: 'span 5' }}>
								{isBreakupRow(item) ? (
									<Text px={3} py={2} fontSize="sm" fontWeight="500" color="slate.800" whiteSpace="pre-wrap">{item.description}</Text>
								) : (
								<Textarea
									{...cellField}
									rows={Math.min(5, Math.max(2, item.description.split('\n').reduce((count, part) => count + Math.ceil(Math.max(1, part.length) / 48), 0)))}
									resize="vertical"
									maxLength={300}
									value={item.description}
									onChange={(event) => onItemChange(index, { description: event.target.value })}
								/>
								)}
							</Box>
							<Text gridColumn={{ md: 'span 2' }} fontSize="xs" fontWeight="700" color={item.section === 'supply' ? 'orange.600' : 'brand.600'} textTransform="uppercase" letterSpacing="0.05em">
								{item.section === 'supply' ? 'Supply item' : item.component ? COMPONENT_LABELS[item.component] : 'Labour'}
							</Text>
							{isBreakupRow(item) ? (
								<Text textAlign="center" fontSize="sm" color="slate.700">{item.unit}</Text>
							) : (
								<Input {...cellField} aria-label="Unit" maxLength={20} value={item.unit} onChange={(event) => onItemChange(index, { unit: event.target.value })} />
							)}
							{item.component ? (
								<Text textAlign="center" fontSize="sm" fontWeight="600" color="slate.700" title="From attendance — press Refill from attendance to update">{item.qty}</Text>
							) : (
								<Input {...cellField} aria-label="Quantity" type="number" min={0} step="0.001" value={item.qty} onChange={(event) => onItemChange(index, { qty: Number(event.target.value) || 0 })} />
							)}
							{isFixedRate(item) ? (
								<Input {...cellField} aria-label="Rate" type="number" min={0} step="0.01" value={item.rate} onChange={(event) => onItemChange(index, { rate: Number(event.target.value) || 0 })} />
							) : (
								<Text textAlign="right" fontSize="sm" fontWeight="600" color="slate.700" title="Calculated from wages — cannot be typed">{money(item.rate)}</Text>
							)}
							<Text gridColumn={{ md: 'span 2' }} textAlign="right" fontWeight="700" color="slate.900" fontSize="sm">₹{money(item.amount)}</Text>
							{item.rateDetail ? (
								<Text gridColumn={{ base: 'span 2', md: 'span 12' }} fontSize="xs" color={item.rate === 0 && item.section === 'service' ? 'orange.600' : 'slate.500'}>
									{item.component && item.component !== 'wage' ? `Amount ₹${money(item.amount)} = ${item.rateDetail}` : `Rate ${money(item.rate)} = ${item.rateDetail}`}
								</Text>
							) : null}
						</SimpleGrid>
					))}
				</Stack>
			</Box>
		</Stack>
	);
}

export default InvoiceMonthEditor;
