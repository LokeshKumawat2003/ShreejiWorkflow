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
	art?: ReactNode;
	display?: ResponsiveValue<string>;
};

export function HeaderCard({ name, status, subtitle, actions, details, footer, art, display }: HeaderCardProps) {
	return (
		<Box display={display} bg="white" border="1px solid" borderColor="slate.200" borderRadius="xl" boxShadow="0 1px 3px rgba(15, 23, 42, 0.05)">
			<Flex
				position="relative"
				overflow="hidden"
				borderTopRadius="xl"
				bgGradient={art ? 'linear(to-r, #fdfcff 35%, brand.50)' : undefined}
				_before={art ? { content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, w: '3px', bg: 'brand.500' } : undefined}
				px={{ base: 4, md: 6 }}
				py={{ base: 4, md: art ? 6 : 5 }}
				direction={{ base: 'column', md: 'row' }}
				align={{ base: 'flex-start', md: 'center' }}
				justify="space-between"
				gap={4}
			>
				<Flex position="relative" align="center" gap={4} minW={0}>
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
					{art ? null : <Box w="1px" h="44px" bg="slate.200" flexShrink={0} />}
					<Box minW={0}>
						<HStack spacing={3} flexWrap="wrap">
							<Heading as="h1" fontSize={{ base: '18px', md: art ? '22px' : '20px' }} lineHeight="1.3" fontWeight="700" color="slate.900" noOfLines={1}>
								{name}
							</Heading>
							<StatusBadge status={status} />
						</HStack>
						<Text mt={0.5} fontSize="sm" color="slate.500" noOfLines={1}>{subtitle}</Text>
					</Box>
				</Flex>
				{art ? (
					<Box
						ml="auto"
						alignSelf="flex-end"
						mb={{ md: -6 }}
						mr={actions ? 2 : 6}
						display={{ base: 'none', lg: 'block' }}
						color="brand.400"
						opacity={0.8}
						pointerEvents="none"
						flexShrink={1}
						minW={0}
						overflow="hidden"
					>
						{art}
					</Box>
				) : null}
				{actions ? <HStack position="relative" spacing={2} flexShrink={0} flexWrap="wrap" rowGap={2}>{actions}</HStack> : null}
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
		<Flex minW={0} pr={4} gap={3} align="flex-start">
			<Flex w="20px" h="20px" mt="1px" align="center" justify="center" color="brand.500" flexShrink={0} fontSize="md" sx={{ '& svg': { boxSize: '18px' } }}>{icon}</Flex>
			<Box minW={0}>
				<Text fontSize="xs" color="slate.500">{label}</Text>
				{isLoading ? (
					<Skeleton mt={1} h="16px" w="120px" borderRadius="sm" />
				) : (
					<Text mt={0.5} fontSize="sm" fontWeight="600" color={value ? 'slate.900' : 'slate.400'} noOfLines={1} title={value} textTransform={capitalize ? 'capitalize' : undefined}>
						{value || 'Not added'}
					</Text>
				)}
			</Box>
		</Flex>
	);
}

export const headerButton = {
	size: 'sm',
	h: '36px',
	px: 3.5,
	borderRadius: '10px',
	fontSize: 'sm',
	fontWeight: '600',
	iconSpacing: 2,
} as const;
