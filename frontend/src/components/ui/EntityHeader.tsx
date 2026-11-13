import { ChevronRightIcon } from '@chakra-ui/icons';
import { Box, Flex, Heading, HStack, Icon, SimpleGrid, Skeleton, Text, type ResponsiveValue } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import StatusBadge from './StatusBadge';

function HomeIcon() {
	return (
		<Icon viewBox="0 0 24 24" boxSize={3.5}>
			<path fill="currentColor" d="M11.3 3.3a1 1 0 0 1 1.4 0l8 7.5A1 1 0 0 1 20 12.5h-1V20a1 1 0 0 1-1 1h-4v-6h-4v6H6a1 1 0 0 1-1-1v-7.5H4a1 1 0 0 1-.7-1.7l8-7.5Z" />
		</Icon>
	);
}

type BreadcrumbProps = {
	parent: string;
	current: string;
	onBack: () => void;
	display?: ResponsiveValue<string>;
};

export function HeaderBreadcrumb({ parent, current, onBack, display = 'inline-flex' }: BreadcrumbProps) {
	return (
		<HStack
			display={display}
			alignSelf="flex-start"
			maxW="full"
			spacing={2.5}
			p={1}
			pr={4}
			bg="white"
			border="1px solid"
			borderColor="slate.200"
			borderRadius="full"
			fontSize="sm"
			minW={0}
		>
			<Flex
				as="button"
				type="button"
				aria-label={`Back to ${parent.toLowerCase()}`}
				title={`Back to ${parent.toLowerCase()}`}
				align="center"
				justify="center"
				flexShrink={0}
				boxSize="28px"
				borderRadius="full"
				bg="slate.100"
				color="slate.600"
				transition="background 0.15s, color 0.15s"
				_hover={{ bg: 'brand.50', color: 'brand.600' }}
				onClick={onBack}
			>
				<HomeIcon />
			</Flex>
			<Text
				as="button"
				type="button"
				flexShrink={0}
				fontWeight="500"
				color="slate.500"
				_hover={{ color: 'slate.900' }}
				onClick={onBack}
			>
				{parent}
			</Text>
			<ChevronRightIcon boxSize={3.5} color="slate.400" flexShrink={0} />
			<Text fontWeight="600" color="slate.900" noOfLines={1}>{current}</Text>
		</HStack>
	);
}

function initials(name: string) {
	const words = name.trim().split(/\s+/).filter(Boolean);
	if (!words.length) return '?';
	return (words.length === 1 ? words[0].slice(0, 2) : `${words[0][0]}${words[1][0]}`).toUpperCase();
}

type HeaderCardProps = {
	name: string;
	status: string;
	subtitle: ReactNode;
	actions?: ReactNode;
	details: ReactNode;
	footer?: ReactNode;
	display?: ResponsiveValue<string>;
};

export function HeaderCard({ name, status, subtitle, actions, details, footer, display }: HeaderCardProps) {
	return (
		<Box display={display} bg="white" border="1px solid" borderColor="slate.200" borderRadius="xl" boxShadow="0 1px 3px rgba(15, 23, 42, 0.05)">
			<Flex
				px={{ base: 4, md: 6 }}
				py={{ base: 4, md: 5 }}
				direction={{ base: 'column', md: 'row' }}
				align={{ base: 'flex-start', md: 'center' }}
				justify="space-between"
				gap={4}
			>
				<Flex align="center" gap={4} minW={0}>
					<Flex
						align="center"
						justify="center"
						flexShrink={0}
						boxSize={{ base: '48px', md: '56px' }}
						borderRadius="full"
						bg="brand.50"
						color="brand.600"
						fontSize={{ base: 'md', md: 'lg' }}
						fontWeight="700"
					>
						{initials(name)}
					</Flex>
					<Box minW={0}>
						<HStack spacing={2.5} flexWrap="wrap">
							<Heading as="h1" fontSize={{ base: '18px', md: '20px' }} lineHeight="1.3" fontWeight="700" color="slate.900" noOfLines={1}>
								{name}
							</Heading>
							<StatusBadge status={status} />
						</HStack>
						<Text mt={0.5} fontSize="sm" color="slate.500" noOfLines={1}>{subtitle}</Text>
					</Box>
				</Flex>
				{actions ? <HStack spacing={2} flexShrink={0} flexWrap="wrap" rowGap={2}>{actions}</HStack> : null}
			</Flex>

			<SimpleGrid
				columns={{ base: 1, sm: 2, xl: 4 }}
				mx={{ base: 4, md: 6 }}
				py={4}
				spacingY={4}
				borderTop="1px solid"
				borderColor="slate.100"
				sx={{
					'@media (min-width: 80em)': {
						'& > *:not(:first-of-type)': { borderLeft: '1px solid', borderColor: 'slate.100', pl: 6 },
					},
				}}
			>
				{details}
			</SimpleGrid>

			{footer}
		</Box>
	);
}

type HeaderDetailProps = {
	icon: ReactNode;
	label: string;
	value?: string;
	isLoading?: boolean;
	capitalize?: boolean;
};

export function HeaderDetail({ icon, label, value, isLoading = false, capitalize = false }: HeaderDetailProps) {
	return (
		<Box minW={0} pr={4}>
			<HStack spacing={2.5}>
				<Flex w="16px" justify="center" color="brand.500" flexShrink={0}>{icon}</Flex>
				<Text fontSize="xs" color="slate.500">{label}</Text>
			</HStack>
			<Box pl="26px" mt={1}>
				{isLoading ? (
					<Skeleton h="16px" w="70%" borderRadius="sm" />
				) : (
					<Text fontSize="sm" fontWeight="600" color={value ? 'slate.900' : 'slate.400'} noOfLines={1} title={value} textTransform={capitalize ? 'capitalize' : undefined}>
						{value || 'Not added'}
					</Text>
				)}
			</Box>
		</Box>
	);
}

export const headerButton = {
	size: 'sm',
	h: '36px',
	px: 3.5,
	borderRadius: 'lg',
	fontSize: 'sm',
	fontWeight: '600',
	iconSpacing: 2,
} as const;
