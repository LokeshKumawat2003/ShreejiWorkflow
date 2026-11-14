import { CalendarIcon, CheckIcon, CopyIcon, EditIcon, EmailIcon, ExternalLinkIcon, InfoOutlineIcon, LinkIcon, PhoneIcon } from '@chakra-ui/icons';
import {
	Box,
	Flex,
	HStack,
	IconButton,
	Link,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	SimpleGrid,
	Stack,
	Text,
	useClipboard,
} from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { ActionButton, BuildingIcon, headerButton, MapPinIcon, PeopleIcon, StatusBadge } from '../../../components/ui';
import type { User } from '../../../types';

type OrganizationInfoDialogProps = {
	isOpen: boolean;
	organization: User;
	onClose: () => void;
	onEdit: () => void;
};

function formatCreatedAt(value?: string) {
	if (!value) return '';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function initials(name: string) {
	const words = name.trim().split(/\s+/).filter(Boolean);
	if (!words.length) return '?';
	return (words.length === 1 ? words[0].slice(0, 2) : `${words[0][0]}${words[1][0]}`).toUpperCase();
}

function websiteHref(value: string) {
	return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<Box>
			<Text mb={2} fontSize="xs" fontWeight="600" color="slate.500">{title}</Text>
			<Box border="1px solid" borderColor="slate.200" borderRadius="lg" bg="white">
				{children}
			</Box>
		</Box>
	);
}

function Field({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
	return (
		<HStack align="flex-start" spacing={3} px={4} py={3.5} minW={0}>
			<Flex mt="1px" boxSize="28px" flexShrink={0} align="center" justify="center" borderRadius="md" bg="brand.50" color="brand.500">
				{icon}
			</Flex>
			<Box minW={0} flex="1">
				<Text fontSize="xs" color="slate.500">{label}</Text>
				<Box mt={0.5} fontSize="sm" fontWeight="600" color="slate.900" overflowWrap="anywhere">
					{children}
				</Box>
			</Box>
		</HStack>
	);
}

function Value({ value }: { value?: string }) {
	return value ? <>{value}</> : <Text as="span" fontWeight="500" color="slate.400">Not added</Text>;
}

const fieldGrid = {
	columns: { base: 1, md: 2 },
	sx: {
		'& > *': { borderColor: 'slate.100', borderStyle: 'solid', borderWidth: 0 },
		'& > *:not(:last-of-type)': { borderBottomWidth: '1px' },
		'@media (min-width: 48em)': {
			'& > *:nth-of-type(odd)': { borderRightWidth: '1px' },
			'& > *:nth-last-of-type(-n+2)': { borderBottomWidth: 0 },
		},
	},
} as const;

function OrganizationInfoDialog({ isOpen, organization, onClose, onEdit }: OrganizationInfoDialogProps) {
	const organizationId = organization.id || organization._id || '';
	const { hasCopied, onCopy } = useClipboard(organizationId);
	const name = organization.organizationName || 'Organization';
	const isActive = organization.status !== 'disabled';

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
			<ModalOverlay bg="blackAlpha.500" backdropFilter="blur(3px)" />
			<ModalContent borderRadius="xl" overflow="hidden">
				<ModalHeader px={6} pt={5} pb={4} borderBottom="1px solid" borderColor="slate.100">
					<HStack spacing={3.5} pr={8}>
						<Flex boxSize="44px" flexShrink={0} align="center" justify="center" borderRadius="full" bg="brand.50" color="brand.600" fontSize="md" fontWeight="700">
							{initials(name)}
						</Flex>
						<Box minW={0}>
							<HStack spacing={2.5} flexWrap="wrap">
								<Text fontSize="lg" fontWeight="700" color="slate.900" noOfLines={1}>{name}</Text>
								<StatusBadge status={isActive ? 'active' : 'disabled'} />
							</HStack>
							<Text fontSize="sm" fontWeight="400" color="slate.500">Organization information</Text>
						</Box>
					</HStack>
				</ModalHeader>
				<ModalCloseButton top={5} right={5} borderRadius="lg" />

				<ModalBody px={6} py={5} bg="slate.50">
					<Stack spacing={5}>
						<Section title="Contact">
							<SimpleGrid {...fieldGrid}>
								<Field icon={<PeopleIcon boxSize={3.5} />} label="Account holder"><Value value={organization.name} /></Field>
								<Field icon={<PhoneIcon boxSize={3} />} label="Phone number"><Value value={organization.phone} /></Field>
								<Field icon={<EmailIcon boxSize={3} />} label="Login email"><Value value={organization.email} /></Field>
								<Field icon={<LinkIcon boxSize={3} />} label="Website">
									{organization.website ? (
										<Link href={websiteHref(organization.website)} isExternal color="brand.600" _hover={{ textDecoration: 'underline' }}>
											{organization.website} <ExternalLinkIcon boxSize={3} mb="2px" />
										</Link>
									) : <Value />}
								</Field>
							</SimpleGrid>
						</Section>

						<Section title="Organization profile">
							<SimpleGrid {...fieldGrid}>
								<Field icon={<BuildingIcon boxSize={3.5} />} label="Industry"><Value value={organization.industry} /></Field>
								<Field icon={<InfoOutlineIcon boxSize={3} />} label="Government type"><Value value={organization.governmentType} /></Field>
								<Field icon={<MapPinIcon boxSize={3.5} />} label="Area"><Value value={organization.area} /></Field>
								<Field icon={<MapPinIcon boxSize={3.5} />} label="Address"><Value value={organization.address} /></Field>
							</SimpleGrid>
							<Box px={4} py={3.5} borderTop="1px solid" borderColor="slate.100">
								<Text fontSize="xs" color="slate.500">About the organization</Text>
								<Text mt={1} fontSize="sm" color={organization.about ? 'slate.700' : 'slate.400'} whiteSpace="pre-wrap" lineHeight="1.6">
									{organization.about || 'No description added yet.'}
								</Text>
							</Box>
						</Section>

						<Section title="Account">
							<SimpleGrid {...fieldGrid}>
								<Field icon={<CheckIcon boxSize={2.5} />} label="Account status">
									<Box mt={0.5}><StatusBadge status={isActive ? 'active' : 'disabled'} /></Box>
								</Field>
								<Field icon={<CalendarIcon boxSize={3} />} label="Created"><Value value={formatCreatedAt(organization.createdAt)} /></Field>
							</SimpleGrid>
							<HStack px={4} py={3} spacing={3} borderTop="1px solid" borderColor="slate.100">
								<Box minW={0} flex="1">
									<Text fontSize="xs" color="slate.500">Organization ID</Text>
									<Text mt={0.5} fontFamily="mono" fontSize="sm" color="slate.700" noOfLines={1}>{organizationId || 'Not available'}</Text>
								</Box>
								{organizationId ? (
									<IconButton
										aria-label={hasCopied ? 'Copied' : 'Copy organization ID'}
										title={hasCopied ? 'Copied' : 'Copy ID'}
										icon={hasCopied ? <CheckIcon boxSize={3} /> : <CopyIcon boxSize={3.5} />}
										size="sm"
										variant="outline"
										borderColor="slate.200"
										color={hasCopied ? 'green.600' : 'slate.600'}
										onClick={onCopy}
									/>
								) : null}
							</HStack>
						</Section>
					</Stack>
				</ModalBody>

				<ModalFooter px={6} py={4} gap={2} borderTop="1px solid" borderColor="slate.100">
					<ActionButton {...headerButton} tone="neutral" bg="white" color="slate.700" onClick={onClose}>Close</ActionButton>
					<ActionButton
						{...headerButton}
						leftIcon={<EditIcon boxSize={3.5} />}
						onClick={() => {
							onClose();
							onEdit();
						}}
					>
						Edit organization
					</ActionButton>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

export default OrganizationInfoDialog;
