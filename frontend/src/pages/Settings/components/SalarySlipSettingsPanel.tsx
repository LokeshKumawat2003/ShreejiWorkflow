import { Box, HStack, SimpleGrid, Text } from '@chakra-ui/react';
import { FormInput, FormTextarea } from '../../../components/ui';
import useDocumentSettings from '../hooks/useDocumentSettings';
import DocumentSettingsLayout, { FormSection, PaperPreview } from './DocumentSettingsLayout';

const previewRows = [
	['Basic & DA', '20306.00', 'Provident Fund@12%', '2437.00'],
	['Bonus @8.33%', '1691.49', 'E.S.I.@0.75%', '152.30'],
	['Total Addition', '21997.49', 'Total Deduction', '2589.30'],
];

function SalarySlipSettingsPanel() {
	const settings = useDocumentSettings('salary-slip', 'Salary slip settings saved');
	const { values, setField } = settings;

	return (
		<DocumentSettingsLayout
			icon={<Text as="span" fontSize="lg" fontWeight="800" lineHeight="1">₹</Text>}
			title="Salary slip"
			subtitle="Header and signature printed on every salary slip. Amounts come from payroll."
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
				<PaperPreview label="Live preview" fontFamily="body">
					<Box border="1.5px solid" borderColor="#1a1a1a" px={4} py={4}>
						<Text textAlign="center" fontFamily="'Times New Roman', Times, serif" fontWeight="700" fontSize="lg" lineHeight="1.2">
							{values.companyName || 'Company name'}
						</Text>
						{values.address.trim() ? (
							<Text mt={1} textAlign="center" fontSize="10px" noOfLines={2}>{values.address.replace(/\s*\n\s*/g, ' ')}</Text>
						) : null}
						<Text mt={1} textAlign="center" fontWeight="700" fontSize="sm">{values.title || 'Salary Slip'}</Text>
						<Box mt={3} fontSize="10px" lineHeight="1.7">
							<Text>Employee Name:- SH. PRALAD CHETTRI</Text>
							<Text>Designation:- MALI</Text>
							<Text>Month &amp; Year:- SEPTEMBER-2026</Text>
						</Box>
						<Box mt={2} border="1px solid" borderColor="#1a1a1a" fontSize="9.5px">
							<SimpleGrid columns={4} fontWeight="700" borderBottom="1px solid" borderColor="#1a1a1a">
								{['Earnings', 'Amount', 'Deductions', 'Amount'].map((head, index) => (
									<Text key={`${head}-${index}`} px={1.5} py={1} textAlign={index % 2 ? 'right' : 'left'} borderLeft={index ? '1px solid' : undefined} borderColor="#1a1a1a">{head}</Text>
								))}
							</SimpleGrid>
							{previewRows.map((row, rowIndex) => (
								<SimpleGrid key={row[0]} columns={4} borderTop={rowIndex ? '1px solid' : undefined} borderColor="#1a1a1a" fontWeight={rowIndex === 2 ? 700 : 400}>
									{row.map((cell, index) => (
										<Text key={`${cell}-${index}`} px={1.5} py={1} textAlign={index % 2 ? 'right' : 'left'} borderLeft={index ? '1px solid' : undefined} borderColor="#1a1a1a">{cell}</Text>
									))}
								</SimpleGrid>
							))}
						</Box>
						<HStack mt={6} justify="flex-end" spacing={1} fontSize="10px">
							{values.signatoryLabel.trim() ? <Text>{values.signatoryLabel}</Text> : null}
							<Box w="90px" borderBottom="1px solid" borderColor="#1a1a1a" />
						</HStack>
					</Box>
				</PaperPreview>
			)}
		>
			<FormSection title="Header">
				<FormInput
					label="Company name"
					isRequired
					maxLength={120}
					value={values.companyName}
					onChange={(event) => setField('companyName', event.target.value)}
				/>
				<FormTextarea
					label="Address"
					maxLength={250}
					rows={2}
					value={values.address}
					helperText="Printed under the company name (up to two lines)."
					onChange={(event) => setField('address', event.target.value)}
				/>
				<FormInput
					label="Slip title"
					isRequired
					maxLength={60}
					value={values.title}
					onChange={(event) => setField('title', event.target.value)}
				/>
			</FormSection>
			<FormSection title="Signature">
				<FormInput
					label="Signatory label"
					maxLength={60}
					value={values.signatoryLabel}
					helperText="Shown before the signature line, e.g. Proprietor/Manager:"
					onChange={(event) => setField('signatoryLabel', event.target.value)}
				/>
			</FormSection>
		</DocumentSettingsLayout>
	);
}

export default SalarySlipSettingsPanel;
