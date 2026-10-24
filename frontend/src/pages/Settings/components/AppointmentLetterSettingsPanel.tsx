import { Box, Image, SimpleGrid, Text } from '@chakra-ui/react';
import { FormInput, FormTextarea } from '../../../components/ui';
import useDocumentSettings from '../hooks/useDocumentSettings';
import DocumentSettingsLayout, { FormSection, PaperPreview } from './DocumentSettingsLayout';
import SignatureUploadField from './SignatureUploadField';

const LetterIcon = (
	<Box as="svg" viewBox="0 0 24 24" w={5} h={5} fill="currentColor" aria-hidden="true">
		<path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm8 1.5V8h4.5L14 3.5ZM7 12h10v1.5H7V12Zm0 3.5h10V17H7v-1.5Zm0-7h5V10H7V8.5Z" />
	</Box>
);

function PreviewRow({ label, value }: { label: string; value: string }) {
	if (!value.trim()) return null;
	return (
		<Text>
			<Text as="span" fontWeight="700">{label}:-</Text> {value}
		</Text>
	);
}

function AppointmentLetterSettingsPanel() {
	const settings = useDocumentSettings('appointment-letter', 'Appointment letter settings saved');
	const { values, setField } = settings;
	const addressLines = values.registeredAddress.split('\n').map((line) => line.trim()).filter(Boolean);
	const terms = values.terms.split('\n').map((term) => term.trim()).filter(Boolean);
	const shortName = values.shortName.trim();

	return (
		<DocumentSettingsLayout
			icon={LetterIcon}
			title="Appointment letter"
			subtitle="Letterhead and standard wording. Employee, joining date and job location are filled in automatically."
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
				<PaperPreview label="Live preview" fontSize="11px" lineHeight="1.55">
					<Text textAlign="center" fontWeight="700" fontSize="lg" lineHeight="1.2">{values.companyName || 'Company name'}</Text>
					<Box textAlign="center" fontSize="10px" mt={1}>
						{addressLines.map((line, index) => (
							<Text key={`${line}-${index}`}>
								{index === 0 ? `Registered address:-${line}` : line}
								{index === addressLines.length - 1 && values.phone.trim() ? ` Mob-${values.phone.trim()}` : ''}
							</Text>
						))}
						{addressLines.length === 0 && values.phone.trim() ? <Text>Mob-{values.phone.trim()}</Text> : null}
						{values.email.trim() ? <Text fontSize="11px">Mail to:- {values.email.trim()}</Text> : null}
					</Box>
					<Box mt={1.5} borderTop="2px solid" borderColor="#1a1a1a" />
					<Box mt="1px" borderTop="1px solid" borderColor="#1a1a1a" />
					<Box display="flex" justifyContent="space-between" mt={1.5} fontSize="9.5px">
						<Text>Ref: {values.refPrefix}PGCIL/KNK/04</Text>
						<Text>Date: 31-07-2026</Text>
					</Box>
					<Text mt={3} textAlign="center" fontWeight="700" textDecoration="underline">{values.title || 'APPOINTMENT LETTER'}</Text>

					<Box mt={3}>
						<Text>To,</Text>
						<Text>Sh. <b>SURAJ SINGH CHUNDAWAT</b></Text>
						<Text color="slate.500" fontStyle="italic">Employee's home address</Text>
					</Box>
					<Text mt={2}>Subject:- Appointment for <b>Waiter / Helper ( Un-Skilled )</b></Text>
					<Text mt={2}>
						We are pleased to offer you the position of <b>Waiter / Helper ( Un-Skilled )</b>
						{shortName ? ` with ${shortName}` : ''} on the following terms and conditions.
					</Text>

					<Box mt={2}>
						<PreviewRow label="Date of Joining" value="01-08-2026" />
						<PreviewRow label="Job Title" value="Waiter / Helper ( Un-Skilled )" />
						<PreviewRow label="Salary" value={values.salaryText} />
						<PreviewRow label="Job Location" value="Client organization, site address" />
						<PreviewRow label="Working Hours" value={values.workingHours} />
						<PreviewRow label="Leave Policy" value={values.leavePolicy} />
					</Box>

					{terms.length > 0 ? (
						<Box mt={2}>
							<Text>Terms and Conditions</Text>
							{terms.map((term, index) => (
								<Text key={`${term}-${index}`} pl={4}>{index + 1}. {term}</Text>
							))}
						</Box>
					) : null}

					<Box mt={4}>
						{values.closing.trim() ? <Text>{values.closing}</Text> : null}
						{shortName ? <Text mt={1}>For:- {shortName}</Text> : null}
						{values.signatureImage ? <Image mt={1} src={values.signatureImage} alt="Signature" maxH="34px" maxW="110px" objectFit="contain" /> : null}
						{values.signatoryTitle.trim() ? <Text mt={values.signatureImage ? 0 : 5}>{values.signatoryTitle}</Text> : null}
					</Box>
				</PaperPreview>
			)}
		>
			<FormSection title="Letterhead">
				<FormInput
					label="Company name"
					isRequired
					maxLength={120}
					value={values.companyName}
					onChange={(event) => setField('companyName', event.target.value)}
				/>
				<FormTextarea
					label="Registered address"
					maxLength={300}
					rows={3}
					value={values.registeredAddress}
					helperText="Each line prints as its own line. The mobile number is added to the last line."
					onChange={(event) => setField('registeredAddress', event.target.value)}
				/>
				<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
					<FormInput label="Mobile number" maxLength={40} value={values.phone} onChange={(event) => setField('phone', event.target.value)} />
					<FormInput label="Company email" type="email" maxLength={120} value={values.email} onChange={(event) => setField('email', event.target.value)} />
				</SimpleGrid>
			</FormSection>

			<FormSection title="Letter details">
				<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
					<FormInput
						label="Reference prefix"
						maxLength={60}
						value={values.refPrefix}
						helperText="The location's OP number is added after it."
						onChange={(event) => setField('refPrefix', event.target.value)}
					/>
					<FormInput label="Letter title" isRequired maxLength={60} value={values.title} onChange={(event) => setField('title', event.target.value)} />
				</SimpleGrid>
				<FormInput
					label="Company name in letter body"
					isRequired
					maxLength={120}
					value={values.shortName}
					helperText={'Used in "…position of X with <name>" and "For:- <name>".'}
					onChange={(event) => setField('shortName', event.target.value)}
				/>
			</FormSection>

			<FormSection title="Terms of employment">
				<FormInput
					label="Salary text"
					maxLength={200}
					value={values.salaryText}
					helperText="Printed as the Salary line on every appointment letter."
					onChange={(event) => setField('salaryText', event.target.value)}
				/>
				<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
					<FormInput label="Working hours" maxLength={120} value={values.workingHours} onChange={(event) => setField('workingHours', event.target.value)} />
					<FormInput label="Leave policy" maxLength={120} value={values.leavePolicy} onChange={(event) => setField('leavePolicy', event.target.value)} />
				</SimpleGrid>
				<FormTextarea
					label="Terms and conditions"
					maxLength={1500}
					rows={4}
					value={values.terms}
					helperText="One term per line; they are numbered automatically. Leave empty to hide the section."
					onChange={(event) => setField('terms', event.target.value)}
				/>
			</FormSection>

			<FormSection title="Signature">
				<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
					<FormInput label="Closing line" maxLength={60} value={values.closing} onChange={(event) => setField('closing', event.target.value)} />
					<FormInput label="Signatory title" maxLength={60} value={values.signatoryTitle} onChange={(event) => setField('signatoryTitle', event.target.value)} />
				</SimpleGrid>
				<SignatureUploadField value={values.signatureImage} onChange={(url) => setField('signatureImage', url)} />
			</FormSection>
		</DocumentSettingsLayout>
	);
}

export default AppointmentLetterSettingsPanel;
