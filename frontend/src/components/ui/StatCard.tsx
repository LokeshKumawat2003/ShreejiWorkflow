import { Box, Flex, HStack, Skeleton, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

type StatCardProps = {
	label: string;
	value: ReactNode;
	color?: string;
	icon?: ReactNode;
	helper?: ReactNode;
	helperIcon?: ReactNode;
	share?: number | null;
	art?: ReactNode;
	artOpacity?: number;
	isLoading?: boolean;
	isActive?: boolean;
	onClick?: () => void;
};

function formatValue(value: ReactNode) {
	if (typeof value === 'number') return value < 10 && value >= 0 ? String(value).padStart(2, '0') : value.toLocaleString();
	return value;
}

function StatCard({ label, value, color = 'brand.500', icon, helper, helperIcon, share, art, artOpacity = 1, isLoading = false, isActive = false, onClick }: StatCardProps) {
	const [scheme] = color.split('.');
	const isClickable = Boolean(onClick);
	const ratio = typeof share === 'number' && Number.isFinite(share) ? Math.min(Math.max(share, 0), 1) : null;
	const length = typeof value === 'string' ? value.length : 0;
	const valueSize = length > 13 ? '20px' : length > 7 ? '26px' : '32px';

	return (
		<Box
			{...(isClickable ? { as: 'button' as const, type: 'button' as const, onClick } : {})}
			position="relative"
			overflow="hidden"
			textAlign="left"
			w="100%"
			minH="118px"
			pl={5}
			pr={4}
			py={3.5}
			bg="white"
			bgGradient={`linear(135deg, white 35%, ${scheme}.50)`}
			border="1px solid"
			borderColor={isActive ? `${scheme}.300` : 'slate.200'}
			borderRadius="16px"
			boxShadow={isActive ? '0 6px 16px rgba(15, 23, 42, 0.08)' : '0 1px 3px rgba(15, 23, 42, 0.05)'}
			transition="box-shadow 0.15s, border-color 0.15s"
			_hover={{ boxShadow: '0 6px 16px rgba(15, 23, 42, 0.08)', borderColor: `${scheme}.200` }}
			_focusVisible={{ outline: 'none', boxShadow: `0 0 0 3px var(--chakra-colors-${scheme}-100)` }}
			_before={{ content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, w: '3px', bg: color }}
		>
			<Box as="svg" viewBox="0 0 200 80" position="absolute" right={0} bottom={0} w="75%" color={`${scheme}.200`} opacity={0.45} aria-hidden="true">
				<path d="M0 80C40 50 80 70 120 44S180 20 200 10V80Z" fill="currentColor" />
			</Box>
			{art ? (
				<Box position="absolute" right={3} top="50%" transform="translateY(-50%)" boxSize="68px" opacity={artOpacity} pointerEvents="none">
					{art}
				</Box>
			) : null}

			<Box position="relative">
				<HStack spacing={2.5} maxW={art ? 'calc(100% - 64px)' : 'full'}>
					{icon ? (
						<Flex boxSize="32px" flexShrink={0} align="center" justify="center" borderRadius="8px" bg={`${scheme}.100`} color={`${scheme}.600`} sx={{ '& svg': { boxSize: '16px' } }}>
							{icon}
						</Flex>
					) : null}
					<Text fontSize="sm" fontWeight="600" color="slate.800" noOfLines={1}>{label}</Text>
				</HStack>
				{isLoading || value === null || value === undefined ? (
					<Skeleton mt={2.5} h="28px" w="72px" borderRadius="sm" />
				) : (
					<Text mt={2} fontSize={valueSize} fontWeight="800" lineHeight="1" color="slate.900" letterSpacing="-0.02em" whiteSpace="nowrap">
						{formatValue(value)}
					</Text>
				)}
				{helper || ratio !== null ? (
					<HStack
						display="inline-flex"
						mt={2.5}
						maxW={art ? 'calc(100% - 56px)' : 'full'}
						spacing={1.5}
						px={2.5}
						py={0.5}
						borderRadius="full"
						bg={`${scheme}.100`}
						color={`${scheme}.700`}
						fontSize="xs"
						fontWeight="600"
					>
						{helperIcon ? <Flex flexShrink={0}>{helperIcon}</Flex> : null}
						{typeof helper === 'string' ? <Text noOfLines={1} title={helper}>{helper}</Text> : helper}
						{ratio !== null && !isLoading ? <Text as="span" flexShrink={0}>· {Math.round(ratio * 100)}%</Text> : null}
					</HStack>
				) : null}
			</Box>
		</Box>
	);
}

export default StatCard;
