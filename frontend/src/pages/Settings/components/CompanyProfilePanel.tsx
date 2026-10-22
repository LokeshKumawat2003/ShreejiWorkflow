import { Alert, Box, SimpleGrid, Skeleton, Stack, Text, useToast } from '@chakra-ui/react';
import { useEffect, useState, type FormEvent } from 'react';
import { ActionButton, ContentCard, FormInput, FormTextarea } from '../../../components/ui';
import { ApiError } from '../../../services/api';
import { getCompanyProfile, updateCompanyProfile, type CompanyProfileInput } from '../../../services/settingsService';

const emptyProfile: CompanyProfileInput = { name: '', address: '', registeredAddress: '', phone: '', email: '' };

function CompanyProfilePanel() {
	const toast = useToast();
	const [form, setForm] = useState<CompanyProfileInput>(emptyProfile);
	const [saved, setSaved] = useState<CompanyProfileInput>(emptyProfile);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState('');
	const [formError, setFormError] = useState('');
	const [isSaving, setIsSaving] = useState(false);
	const isDirty = (Object.keys(form) as (keyof CompanyProfileInput)[]).some((key) => form[key] !== saved[key]);

	function applyProfile(company: CompanyProfileInput) {
		const next = {
			name: company.name,
			address: company.address,
			registeredAddress: company.registeredAddress,
			phone: company.phone,
			email: company.email,
		};
		setForm(next);
		setSaved(next);
	}

	function setField<K extends keyof CompanyProfileInput>(key: K, value: CompanyProfileInput[K]) {
		setForm((current) => ({ ...current, [key]: value }));
	}

	useEffect(() => {
		const controller = new AbortController();
		void getCompanyProfile(controller.signal)
			.then(applyProfile)
			.catch((error: unknown) => {
				if (!controller.signal.aborted) setLoadError(error instanceof ApiError ? error.message : 'Unable to load the company profile.');
			})
			.finally(() => {
				if (!controller.signal.aborted) setIsLoading(false);
			});
		return () => controller.abort();
	}, []);

	async function handleSubmit(event: FormEvent) {
		event.preventDefault();
		if (!form.name.trim()) {
			setFormError('Company name is required.');
			return;
		}
		setIsSaving(true);
		setFormError('');
		try {
			applyProfile(await updateCompanyProfile(form));
			toast({ title: 'Company profile saved', status: 'success', position: 'top' });
		} catch (error) {
			setFormError(error instanceof ApiError ? error.message : 'Unable to save the company profile.');
		} finally {
			setIsSaving(false);
		}
	}

	const letterLines = form.registeredAddress.split('\n').map((line) => line.trim()).filter(Boolean);

	return (
		<ContentCard title="Company profile" subtitle="Printed on salary slips and appointment letters.">
			{loadError ? (
				<Alert status="error" borderRadius="md">{loadError}</Alert>
			) : isLoading ? (
				<Stack spacing={4}>
					<Skeleton h="70px" borderRadius="md" />
					<Skeleton h="100px" borderRadius="md" />
				</Stack>
			) : (
				<Stack as="form" spacing={5} onSubmit={(event) => void handleSubmit(event)}>
					<FormInput
						label="Company name"
						isRequired
						maxLength={120}
						value={form.name}
						error={formError === 'Company name is required.' ? formError : undefined}
						onChange={(event) => setField('name', event.target.value)}
					/>
					<FormTextarea
						label="Salary slip address"
						maxLength={250}
						rows={2}
						value={form.address}
						helperText="Shown on one line under the company name on salary slips."
						onChange={(event) => setField('address', event.target.value)}
					/>
					<FormTextarea
						label="Registered address (appointment letter)"
						maxLength={300}
						rows={3}
						value={form.registeredAddress}
						helperText="Each line prints as its own line in the letter header."
						onChange={(event) => setField('registeredAddress', event.target.value)}
					/>
					<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
						<FormInput label="Mobile number" maxLength={40} value={form.phone} onChange={(event) => setField('phone', event.target.value)} />
						<FormInput label="Company email" type="email" maxLength={120} value={form.email} onChange={(event) => setField('email', event.target.value)} />
					</SimpleGrid>
					{formError && formError !== 'Company name is required.' ? <Alert status="error" borderRadius="md">{formError}</Alert> : null}

					<SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
						<Box border="1px dashed" borderColor="slate.300" borderRadius="md" px={4} py={4} textAlign="center" bg="slate.50">
							<Text fontSize="xs" fontWeight="700" color="slate.400" letterSpacing="1px" mb={2}>SALARY SLIP PREVIEW</Text>
							<Text fontFamily="'Times New Roman', serif" fontWeight="700" fontSize="xl" color="slate.900">{form.name.trim() || 'Company name'}</Text>
							{form.address.trim() ? <Text fontSize="xs" color="slate.700" mt={1}>{form.address.replace(/\s*\n\s*/g, ' ').trim()}</Text> : null}
							<Text fontSize="sm" fontWeight="700" color="slate.900" mt={1}>Salary Slip</Text>
						</Box>
						<Box border="1px dashed" borderColor="slate.300" borderRadius="md" px={4} py={4} textAlign="center" bg="slate.50" fontFamily="'Times New Roman', serif">
							<Text fontFamily="body" fontSize="xs" fontWeight="700" color="slate.400" letterSpacing="1px" mb={2}>APPOINTMENT LETTER PREVIEW</Text>
							<Text fontWeight="700" fontSize="xl" color="slate.900">{form.name.trim() || 'Company name'}</Text>
							{letterLines.map((line, index) => (
								<Text key={`${line}-${index}`} fontSize="xs" color="slate.700">
									{index === 0 ? `Registered address:-${line}` : line}
									{index === letterLines.length - 1 && form.phone.trim() ? ` Mob-${form.phone.trim()}` : ''}
								</Text>
							))}
							{form.email.trim() ? <Text fontSize="xs" color="slate.700">Mail to:- {form.email.trim()}</Text> : null}
							<Box mt={2} borderTop="1px solid" borderColor="slate.400" />
						</Box>
					</SimpleGrid>

					<Box>
						<ActionButton type="submit" isLoading={isSaving} loadingText="Saving" isDisabled={!isDirty}>
							Save company profile
						</ActionButton>
					</Box>
				</Stack>
			)}
		</ContentCard>
	);
}

export default CompanyProfilePanel;
