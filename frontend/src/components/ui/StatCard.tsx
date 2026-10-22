import { ArrowForwardIcon } from '@chakra-ui/icons';
import { Box, Flex, HStack, Skeleton, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

type StatCardProps = {
	label: string;
	value: ReactNode;
	color?: string;
	icon?: ReactNode;
	helper?: ReactNode;
	share?: number | null;
	isLoading?: boolean;
	isActive?: boolean;
	onClick?: () => void;
};

function tint(color: string, shade: number) {
	const [scheme] = color.split('.');
	return `${scheme}.${shade}`;
}

function StatCard({ label, value, color = 'brand.500', icon, helper, share, isLoading = false, isActive = false, onClick }: StatCardProps) {
	const isClickable = Boolean(onClick);
	const ratio = typeof share === 'number' && Number.isFinite(share) ? Math.min(Math.max(share, 0), 1) : null;

	return (
		<Box
			{...(isClickable ? { as: 'button' as const, type: 'button' as const, onClick } : {})}
			role="group"
			position="relative"
			overflow="hidden"
			textAlign="left"
			w="100%"
			px={5}
			py={4}
			bg="white"
			border="1px solid"
			borderColor={isActive ? tint(color, 300) : 'slate.200'}
			borderRadius="lg"
			boxShadow={isActive ? 'md' : 'sm'}
			transition="box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease"
			_hover={{ boxShadow: 'md', transform: 'translateY(-2px)', borderColor: tint(color, 200) }}
			_focusVisible={{ outline: 'none', boxShadow: `0 0 0 3px var(--chakra-colors-${tint(color, 100).replace('.', '-')})` }}
		>
			<Box position="absolute" top="-28px" right="-28px" w="96px" h="96px" borderRadius="full" bg={tint(color, 50)} />
			<Flex position="relative" justify="space-between" align="flex-start" gap={3}>
				<Box minW={0}>
					<Text fontSize="xs" fontWeight="700" color="slate.500" textTransform="uppercase" letterSpacing="0.06em" noOfLines={1}>
						{label}
					</Text>
					{isLoading ? (
						<Skeleton mt={2} h="30px" w="64px" borderRadius="sm" />
					) : (
						<Text mt={2} fontSize="3xl" fontWeight="800" color="slate.900" lineHeight="1" letterSpacing="-0.02em">{value}</Text>
					)}
				</Box>
				{icon ? (
					<Flex w="44px" h="44px" flexShrink={0} borderRadius="12px" bg={tint(color, 100)} color={color} align="center" justify="center" fontSize="lg">
						{icon}
					</Flex>
				) : null}
			</Flex>

			{ratio !== null || helper || isClickable ? (
				<Box position="relative" mt={4}>
					{ratio !== null ? (
						<Box h="6px" bg="slate.100" borderRadius="full" overflow="hidden" mb={2}>
							<Box h="100%" w={isLoading ? '0%' : `${ratio * 100}%`} bg={color} borderRadius="full" transition="width 0.4s ease" />
						</Box>
					) : null}
					<HStack justify="space-between" spacing={2}>
						<HStack fontSize="xs" color="slate.500" spacing={1} minW={0}>
							{typeof helper === 'string' ? <Text noOfLines={1}>{helper}</Text> : helper}
							{ratio !== null && !isLoading ? <Text as="span" fontWeight="700" color="slate.700">· {Math.round(ratio * 100)}%</Text> : null}
						</HStack>
						{isClickable ? (
							<ArrowForwardIcon
								boxSize={3.5}
								color="slate.400"
								transition="transform 0.2s ease, color 0.2s ease"
								_groupHover={{ color, transform: 'translateX(3px)' }}
							/>
						) : null}
					</HStack>
				</Box>
			) : null}
		</Box>
	);
}

export default StatCard;
