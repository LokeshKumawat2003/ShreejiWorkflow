import { Box, Image, SimpleGrid, Text } from '@chakra-ui/react';
import { FormInput, FormTextarea } from '../../../components/ui';
import useDocumentSettings from '../hooks/useDocumentSettings';
import DocumentSettingsLayout, { FormSection, PaperPreview } from './DocumentSettingsLayout';
import SignatureUploadField from './SignatureUploadField';

const previewHeadings = ['S.no.', 'Name', 'Post', 'Days', 'Wages', 'Wages', 'Bonus', 'Total', 'EPF', 'ESI', 'Gross'];
const previewRow = ['1', 'PRALAD CHETTRI', 'Skilled', '26', '781', '20306', '1691.49', '21997.49', '1800', '152', '20045'];

function WageRegisterSettingsPanel() {
	const settings = useDocumentSettings('wage-register', 'Wage register settings saved');
	const { values, setField } = settings;

	return (
		<DocumentSettingsLayout
			icon={<Text as="span" fontSize="sm" fontWeight="800" lineHeight="1">XVII</Text>}
			title="Wage register"
			subtitle="FORM XVII printed from a location's payroll tab. Work name, address and PO number come from the location."
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
				<PaperPreview label="Live preview" fontFamily="'Times New Roman', Times, serif">
					<Text textAlign="center" fontWeight="700" fontSize="md" textDecoration="underline">{values.title || 'Register of wages'}</Text>
					{values.formTitle.trim() ? <Text textAlign="center" fontWeight="700" fontSize="xs">{values.formTitle}</Text> : null}
					<Text mt={1} textAlign="center" fontWeight="700" fontSize="9px" textDecoration="underline">WORK NAME at LOCATION ADDRESS</Text>
					<SimpleGrid mt={2} columns={2} fontSize="9px" fontWeight="700">
						<Text noOfLines={2}>Name of Contractor :- {values.contractorName}</Text>
						<Text textAlign="right">Period- AUGUST-2026</Text>
					</SimpleGrid>
					<Box mt={2} border="1px solid" borderColor="#1a1a1a" fontSize="7.5px">
						<SimpleGrid columns={11} fontWeight="700" borderBottom="1px solid" borderColor="#1a1a1a">
							{previewHeadings.map((heading, index) => (
								<Text key={`${heading}-${index}`} px={0.5} py={1} textAlign="center" borderLeft={index ? '1px solid' : undefined} borderColor="#1a1a1a">
									{index === 6 ? `Bonus@${values.bonusRate || 0}%` : index === 8 ? `EPF${values.epfRate || 0}%` : index === 9 ? `ESI@${values.esiRate || 0}%` : heading}
								</Text>
							))}
						</SimpleGrid>
						<SimpleGrid columns={11}>
							{previewRow.map((cell, index) => (
								<Text key={`${cell}-${index}`} px={0.5} py={1} textAlign="center" borderLeft={index ? '1px solid' : undefined} borderColor="#1a1a1a" noOfLines={1}>{cell}</Text>
							))}
						</SimpleGrid>
					</Box>
					{values.note.trim() ? <Text mt={2} fontSize="8.5px">Note:-{values.note}</Text> : null}
					<Box mt={3} ml="8%" w="fit-content" textAlign="center" fontSize="8.5px" fontWeight="700">
						<Box h="34px" display="flex" alignItems="flex-end" justifyContent="center">
							{values.signatureImage ? <Image src={values.signatureImage} alt="Signature" maxH="34px" maxW="110px" objectFit="contain" /> : null}
						</Box>
						{values.signatoryCompany.trim() ? <Text>{values.signatoryCompany}</Text> : null}
						{values.signatoryTitle.trim() ? <Text fontWeight="600">{values.signatoryTitle}</Text> : null}
					</Box>
				</PaperPreview>
			)}
		>
			<FormSection title="Header">
				<FormInput label="Register title" isRequired maxLength={80} value={values.title} onChange={(event) => setField('title', event.target.value)} />
				<FormInput label="Form reference" maxLength={120} value={values.formTitle} onChange={(event) => setField('formTitle', event.target.value)} />
				<FormInput label="Name of contractor" isRequired maxLength={200} value={values.contractorName} onChange={(event) => setField('contractorName', event.target.value)} />
				<FormTextarea label="Footer note" rows={2} maxLength={300} value={values.note} onChange={(event) => setField('note', event.target.value)} />
			</FormSection>
			<FormSection title="Rates">
				<SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
					<FormInput label="Bonus rate (%)" isRequired inputMode="decimal" maxLength={10} value={values.bonusRate} helperText="Column H = Wages × rate" onChange={(event) => setField('bonusRate', event.target.value)} />
					<FormInput label="ESI rate (%)" isRequired inputMode="decimal" maxLength={10} value={values.esiRate} helperText="Column L, for ESIC applicable employees" onChange={(event) => setField('esiRate', event.target.value)} />
					<FormInput label="EPF rate (%)" isRequired inputMode="decimal" maxLength={10} value={values.epfRate} helperText="Column K, for EPFO applicable employees" onChange={(event) => setField('epfRate', event.target.value)} />
					<FormInput label="EPF wage ceiling" inputMode="numeric" maxLength={12} value={values.epfWageCeiling} helperText="EPF is charged on wages up to this amount. Leave blank for no limit." onChange={(event) => setField('epfWageCeiling', event.target.value)} />
				</SimpleGrid>
			</FormSection>
			<FormSection title="Signature">
				<FormInput label="Company line" maxLength={120} value={values.signatoryCompany} helperText="Printed under the signature, e.g. FOR:-SHREEJI CARETAKER COMPANY" onChange={(event) => setField('signatoryCompany', event.target.value)} />
				<FormInput label="Signatory title" maxLength={60} value={values.signatoryTitle} onChange={(event) => setField('signatoryTitle', event.target.value)} />
				<SignatureUploadField value={values.signatureImage} onChange={(url) => setField('signatureImage', url)} />
			</FormSection>
		</DocumentSettingsLayout>
	);
}

export default WageRegisterSettingsPanel;
