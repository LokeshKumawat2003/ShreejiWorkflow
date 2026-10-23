import { Box, Flex, Image, SimpleGrid, Text } from '@chakra-ui/react';
import { FormInput, FormTextarea } from '../../../components/ui';
import { bankLetterSubject } from '../../BankInvoice/utils/bankLetterExport';
import useDocumentSettings from '../hooks/useDocumentSettings';
import DocumentSettingsLayout, { FormSection, PaperPreview } from './DocumentSettingsLayout';
import SignatureUploadField from './SignatureUploadField';

const previewRows = [
	['1', 'NEHPAL SINGH', '03770110094938', 'UCBA0000377', 'UCO BANK', '25721'],
	['2', 'PAWAN KUMAR', '37582693485', 'SBIN0011411', 'STATE BANK OF INDIA', '25721'],
];

function BankLetterSettingsPanel() {
	const settings = useDocumentSettings('bank-letter', 'Bank letter settings saved');
	const { values, setField } = settings;

	return (
		<DocumentSettingsLayout
			icon={<Text as="span" fontSize="sm" fontWeight="800" lineHeight="1">🏦</Text>}
			title="Bank payment letter"
			subtitle="NEFT request letter printed from Bank invoice. Employee accounts and amounts come from employees and payroll."
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
					<Text textAlign="center" fontWeight="800" fontSize="md">{values.companyName || 'Company name'}</Text>
					<Text textAlign="center" fontWeight="700" fontSize="9px" whiteSpace="pre-line">
						{values.address}{values.phone ? ` Mob:-${values.phone}` : ''}
					</Text>
					{values.email ? <Text textAlign="center" fontSize="8.5px">Mail to -{values.email}</Text> : null}
					<Box mt={1} borderTop="2px dashed" borderColor="#1a1a1a" />
					<Flex mt={2} justify="space-between" fontSize="8.5px" fontWeight="700">
						<Text>Ref:- {values.refPrefix}/ SEP-2026/ 01</Text>
						<Text textDecoration="underline">Date-13-10-2026</Text>
					</Flex>
					<Text mt={1} fontSize="8.5px" fontWeight="700" whiteSpace="pre-line">To,{'\n'}{values.recipient}</Text>
					<Text mt={1} fontSize="8.5px" fontWeight="700">Sub :- {bankLetterSubject(values)}</Text>
					<Box mt={1} border="1px solid" borderColor="#1a1a1a" fontSize="7.5px">
						{previewRows.map((row, rowIndex) => (
							<SimpleGrid key={row[0]} columns={6} templateColumns="18px 1.6fr 1.4fr 1.2fr 1.5fr 0.8fr" borderTop={rowIndex ? '1px solid' : undefined} borderColor="#1a1a1a">
								{row.map((cell, index) => (
									<Text key={`${cell}-${index}`} px={1} py={0.5} borderLeft={index ? '1px solid' : undefined} borderColor="#1a1a1a" textAlign={index === 5 ? 'right' : index === 0 ? 'center' : 'left'} noOfLines={1}>{cell}</Text>
								))}
							</SimpleGrid>
						))}
					</Box>
					<Text mt={2} fontSize="8.5px" fontWeight="700">CH. NO-628374</Text>
					{values.requestLine ? <Text fontSize="8.5px">{values.requestLine}</Text> : null}
					{values.closing ? <Text mt={1} fontSize="8.5px">{values.closing}</Text> : null}
					<Box mt={1} h="30px" display="flex" alignItems="flex-end">
						{values.signatureImage ? <Image src={values.signatureImage} alt="Signature" maxH="30px" maxW="100px" objectFit="contain" /> : null}
					</Box>
					<Box fontSize="8.5px" fontWeight="700">
						{values.signatoryName ? <Text>( {values.signatoryName} )</Text> : null}
						{values.signatoryCompany ? <Text>{values.signatoryCompany}</Text> : null}
						{values.signatoryTitle ? <Text>{values.signatoryTitle}</Text> : null}
						{values.signatoryPhone ? <Text>Mob.{values.signatoryPhone}</Text> : null}
					</Box>
				</PaperPreview>
			)}
		>
			<FormSection title="Letterhead">
				<FormInput label="Company name" isRequired maxLength={120} value={values.companyName} onChange={(event) => setField('companyName', event.target.value)} />
				<FormTextarea label="Address" rows={2} maxLength={300} value={values.address} onChange={(event) => setField('address', event.target.value)} />
				<SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
					<FormInput label="Mobile" maxLength={30} value={values.phone} onChange={(event) => setField('phone', event.target.value)} />
					<FormInput label="Email" type="email" maxLength={254} value={values.email} onChange={(event) => setField('email', event.target.value)} />
				</SimpleGrid>
			</FormSection>
			<FormSection title="Bank">
				<FormTextarea label="Bank address (To,)" isRequired rows={4} maxLength={400} value={values.recipient} onChange={(event) => setField('recipient', event.target.value)} />
				<SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
					<FormInput label="Current account number" isRequired maxLength={34} value={values.accountNumber} onChange={(event) => setField('accountNumber', event.target.value)} />
					<FormInput label="Reference prefix" isRequired maxLength={60} value={values.refPrefix} helperText="Month and number are added, e.g. /SEP-2026/ 01" onChange={(event) => setField('refPrefix', event.target.value)} />
				</SimpleGrid>
				<FormTextarea label="Subject" isRequired rows={2} maxLength={300} value={values.subject} helperText="{account} is replaced with the current account number." onChange={(event) => setField('subject', event.target.value)} />
				<FormInput label="Request line" maxLength={200} value={values.requestLine} onChange={(event) => setField('requestLine', event.target.value)} />
				<FormInput label="Closing" maxLength={60} value={values.closing} onChange={(event) => setField('closing', event.target.value)} />
			</FormSection>
			<FormSection title="Signature">
				<SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
					<FormInput label="Signatory name" maxLength={100} value={values.signatoryName} onChange={(event) => setField('signatoryName', event.target.value)} />
					<FormInput label="Signatory title" maxLength={60} value={values.signatoryTitle} onChange={(event) => setField('signatoryTitle', event.target.value)} />
					<FormInput label="Company line" maxLength={120} value={values.signatoryCompany} onChange={(event) => setField('signatoryCompany', event.target.value)} />
					<FormInput label="Signatory mobile" maxLength={30} value={values.signatoryPhone} onChange={(event) => setField('signatoryPhone', event.target.value)} />
				</SimpleGrid>
				<SignatureUploadField value={values.signatureImage} onChange={(url) => setField('signatureImage', url)} />
			</FormSection>
		</DocumentSettingsLayout>
	);
}

export default BankLetterSettingsPanel;
