import { Box, Flex, FormControl, FormHelperText, FormLabel, Image, Select, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { FormInput } from '../../../components/ui';
import { LABOUR_QTY_OPTIONS } from '../../../services/invoiceService';
import useDocumentSettings from '../hooks/useDocumentSettings';
import DocumentSettingsLayout, { FormSection, PaperPreview } from './DocumentSettingsLayout';
import SignatureUploadField from './SignatureUploadField';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabel(month: string) {
	const [year, number] = month.split('-').map(Number);
	return year && number ? `${MONTHS[number - 1]} ${year}` : month;
}

function previousMonth(month: string) {
	const [year, number] = month.split('-').map(Number);
	if (!year || !number) return month;
	return number === 1 ? `${year - 1}-12` : `${year}-${String(number - 1).padStart(2, '0')}`;
}

function InvoiceSettingsPanel() {
	const settings = useDocumentSettings('invoice', 'Invoice settings saved');
	const { values, setField } = settings;

	return (
		<DocumentSettingsLayout
			icon={<Text as="span" fontSize="sm" fontWeight="800" lineHeight="1">🧾</Text>}
			title="Invoice breakup"
			subtitle="Client invoice made from each location's Invoice tab. Contract details and rates are set per location."
			isLoading={settings.isLoading}
			isSaving={settings.isSaving}
			isDirty={settings.isDirty}
			loadError={settings.loadError}
			formError={settings.formError}
			updatedAt={settings.updatedAt}
			onSubmit={(event) => void settings.submit(event)}
			onDiscard={settings.discard}
			onRestoreDefaults={settings.restoreDefaults}
			preview={(
				<PaperPreview label="Live preview" fontFamily="Arial, Helvetica, sans-serif">
					<Text textAlign="center" fontWeight="800" fontSize="sm" textDecoration="underline">{values.title || 'INVOICE BREAKUP'}</Text>
					<Text mt={1} textAlign="center" fontWeight="700" fontSize="8.5px" textDecoration="underline">
						Invoice No. {values.invoicePrefix}/26-27/{values.startNumber || '1'} Dated-16-10-2026 ( RA BILL NO.- 12 )
					</Text>
					<Text mt={2} fontWeight="700" fontSize="8.5px">
						Name of Party :- {values.partyName}{values.vendorCode ? ` Vendor Code:- ${values.vendorCode}` : ''}
					</Text>
					<Text mt={1} fontWeight="700" fontSize="8.5px">NAME OF WORK :- AMC Contract for Horticulture work at …</Text>
					<Box mt={2} h="60px" border="1px solid" borderColor="#1a1a1a" display="grid" placeItems="center" fontSize="8px" color="slate.500">
						Lines and totals from the location
					</Box>
					<Flex mt={2} justify="flex-end">
						<Box textAlign="right" fontSize="8.5px">
							<Text>{values.signatoryCompany}</Text>
							<Flex h="34px" justify="flex-end" align="center">
								{values.signatureImage ? <Image src={values.signatureImage} alt="Signature" maxH="32px" maxW="90px" objectFit="contain" /> : null}
							</Flex>
							<Text>{values.signatoryTitle}</Text>
						</Box>
					</Flex>
				</PaperPreview>
			)}
		>
			<FormSection title="Header">
				<FormInput label="Invoice title" isRequired maxLength={60} value={values.title} onChange={(event) => setField('title', event.target.value)} />
				<FormInput label="Name of party" isRequired maxLength={200} value={values.partyName} onChange={(event) => setField('partyName', event.target.value)} />
				<SimpleGrid columns={{ base: 1, sm: 3 }} spacing={4}>
					<FormInput label="Vendor code" maxLength={40} value={values.vendorCode} helperText="A location can override it." onChange={(event) => setField('vendorCode', event.target.value)} />
					<FormInput label="Invoice prefix" isRequired maxLength={30} value={values.invoicePrefix} helperText="e.g. AMC → AMC/26-27/465" onChange={(event) => setField('invoicePrefix', event.target.value)} />
					<FormInput label="First number of the year" type="number" min={1} maxLength={8} value={values.startNumber} helperText="Used when a financial year has no invoice yet." onChange={(event) => setField('startNumber', event.target.value)} />
				</SimpleGrid>
			</FormSection>
			<FormSection title="Rate calculation">
				<Text fontSize="xs" color="slate.500">
					Auto rate per man-day = daily wage × (1 + EPF + ESIC + bonus) × (1 + service charge). Month lines use daily wage × paid days in a month.
				</Text>
				<SimpleGrid columns={{ base: 1, sm: 3 }} spacing={4}>
					<FormInput label="EPF (%)" type="number" min={0} max={100} step="0.01" value={values.epfRate} onChange={(event) => setField('epfRate', event.target.value)} />
					<FormInput label="ESIC (%)" type="number" min={0} max={100} step="0.01" value={values.esicRate} onChange={(event) => setField('esicRate', event.target.value)} />
					<FormInput label="Bonus (%)" type="number" min={0} max={100} step="0.01" value={values.bonusRate} onChange={(event) => setField('bonusRate', event.target.value)} />
					<FormInput label="Service charge (%)" type="number" min={0} max={100} step="0.01" value={values.serviceChargeRate} onChange={(event) => setField('serviceChargeRate', event.target.value)} />
					<FormInput label="Relieving charge (% of rate)" type="number" min={0} max={100} step="0.0001" value={values.relievingRate} helperText="16.6667 = one sixth" onChange={(event) => setField('relievingRate', event.target.value)} />
					<FormInput label="Paid days in a month" type="number" min={1} max={31} value={values.monthDays} onChange={(event) => setField('monthDays', event.target.value)} />
				</SimpleGrid>
				<FormControl>
					<FormLabel fontSize="sm">Default labour quantity type</FormLabel>
					<Select bg="white" value={values.labourQtyType} onChange={(event) => setField('labourQtyType', event.target.value)}>
						{LABOUR_QTY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
					</Select>
					<FormHelperText>
						{LABOUR_QTY_OPTIONS.find((option) => option.value === values.labourQtyType)?.hint(values.monthDays || '26')} Each location can choose its own in Invoice setup.
					</FormHelperText>
				</FormControl>
				<FormInput
					label="Rates effective from (month)"
					type="month"
					value={values.ratesEffectiveFrom}
					helperText="When you change the % or paid days above, invoices from this month on use the new values. Older months keep the values that were valid then. Leave as is to start from the current month."
					onChange={(event) => setField('ratesEffectiveFrom', event.target.value)}
				/>
				{settings.rateHistory.length ? (
					<Box>
						<Text fontSize="sm" fontWeight="600" color="slate.800" mb={1}>Earlier rates (used for older months)</Text>
						<Stack spacing={1}>
							{[...settings.rateHistory].reverse().map((period) => (
								<Text key={`${period.fromMonth}-${period.toMonth}-${period.changedAt}`} fontSize="xs" color="slate.600" px={2} py={1.5} bg="slate.50" borderRadius="md">
									<Text as="span" fontWeight="600">{period.fromMonth ? monthLabel(period.fromMonth) : 'Start'} to {monthLabel(previousMonth(period.toMonth))}</Text>
									{' · '}EPF {period.values.epfRate}% · ESIC {period.values.esicRate}% · Bonus {period.values.bonusRate}% · Service {period.values.serviceChargeRate}% · Relieving {period.values.relievingRate}% · {period.values.monthDays} days
								</Text>
							))}
						</Stack>
					</Box>
				) : null}
			</FormSection>
			<FormSection title="Signature">
				<SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
					<FormInput label="Company line" maxLength={120} value={values.signatoryCompany} onChange={(event) => setField('signatoryCompany', event.target.value)} />
					<FormInput label="Signatory title" maxLength={60} value={values.signatoryTitle} onChange={(event) => setField('signatoryTitle', event.target.value)} />
				</SimpleGrid>
				<SignatureUploadField value={values.signatureImage} onChange={(url) => setField('signatureImage', url)} />
			</FormSection>
		</DocumentSettingsLayout>
	);
}

export default InvoiceSettingsPanel;
