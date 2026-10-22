import { Alert, Box, Grid, HStack, Skeleton, Stack, Text, type BoxProps } from '@chakra-ui/react';
import type { FormEvent, ReactNode } from 'react';
import { ActionButton, ContentCard } from '../../../components/ui';

type DocumentSettingsLayoutProps = {
	icon: ReactNode;
	title: string;
	subtitle: string;
	isLoading: boolean;
	isSaving: boolean;
	isDirty: boolean;
	loadError: string;
	formError: string;
	updatedAt: string | null;
	onSubmit: (event: FormEvent) => void;
	onDiscard: () => void;
	onRestoreDefaults: () => void;
	preview: ReactNode;
	children: ReactNode;
};

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
	return (
		<Stack spacing={4}>
			<Text fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="slate.400">{title}</Text>
			{children}
		</Stack>
	);
}

export function PaperPreview({ label, children, ...boxProps }: BoxProps & { label: string }) {
	return (
		<Box position={{ xl: 'sticky' }} top={{ xl: 4 }}>
			<Text mb={2} fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="slate.400">{label}</Text>
			<Box
				bg="white"
				border="1px solid"
				borderColor="slate.200"
				borderRadius="md"
				boxShadow="0 10px 30px rgba(15, 23, 42, 0.08)"
				px={5}
				py={6}
				color="#1a1a1a"
				fontFamily="'Times New Roman', Times, serif"
				{...boxProps}
			>
				{children}
			</Box>
		</Box>
	);
}

function formatUpdatedAt(value: string | null) {
	if (!value) return 'Using default text — not saved yet';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return `Last saved ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)}`;
}

function DocumentSettingsLayout({
	icon,
	title,
	subtitle,
	isLoading,
	isSaving,
	isDirty,
	loadError,
	formError,
	updatedAt,
	onSubmit,
	onDiscard,
	onRestoreDefaults,
	preview,
	children,
}: DocumentSettingsLayoutProps) {
	return (
		<ContentCard icon={icon} title={title} subtitle={subtitle}>
			{loadError ? (
				<Alert status="error" borderRadius="md">{loadError}</Alert>
			) : isLoading ? (
				<Grid templateColumns={{ base: '1fr', xl: 'minmax(0, 1.1fr) minmax(0, 1fr)' }} gap={6}>
					<Stack spacing={4}>
						{[0, 1, 2, 3].map((row) => <Skeleton key={row} h="64px" borderRadius="md" />)}
					</Stack>
					<Skeleton h="360px" borderRadius="md" />
				</Grid>
			) : (
				<Box as="form" onSubmit={onSubmit}>
					<Grid templateColumns={{ base: '1fr', xl: 'minmax(0, 1.1fr) minmax(0, 1fr)' }} gap={8} alignItems="start">
						<Stack spacing={7}>{children}</Stack>
						{preview}
					</Grid>

					{formError ? <Alert mt={5} status="error" borderRadius="md">{formError}</Alert> : null}

					<HStack mt={6} pt={5} borderTop="1px solid" borderColor="slate.100" justify="space-between" flexWrap="wrap" gap={3}>
						<Text fontSize="xs" color="slate.500">{isDirty ? 'You have unsaved changes' : formatUpdatedAt(updatedAt)}</Text>
						<HStack spacing={2} flexWrap="wrap">
							<ActionButton tone="neutral" size="sm" onClick={onRestoreDefaults} isDisabled={isSaving}>
								Restore defaults
							</ActionButton>
							<ActionButton tone="neutral" size="sm" onClick={onDiscard} isDisabled={!isDirty || isSaving}>
								Discard
							</ActionButton>
							<ActionButton type="submit" size="sm" isLoading={isSaving} loadingText="Saving" isDisabled={!isDirty}>
								Save changes
							</ActionButton>
						</HStack>
					</HStack>
				</Box>
			)}
		</ContentCard>
	);
}

export default DocumentSettingsLayout;
