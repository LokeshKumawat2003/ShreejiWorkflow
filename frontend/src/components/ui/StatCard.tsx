import { Box, Flex, HStack, Skeleton, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

type StatCardProps = {
	label: string;
	value: ReactNode;
	color?: string;
	icon?: ReactNode;
	helper?: ReactNode;
	isLoading?: boolean;
	isActive?: boolean;
	onClick?: () => void;
};

function StatCard({ label, value, color = 'brand.500', icon, helper, isLoading = false, isActive = false, onClick }: StatCardProps) {
	if (isLoading) return <Skeleton h="92px" borderRadius="lg" />;
	const isClickable = Boolean(onClick);

	return (
		<Box
			{...(isClickable ? { as: 'button' as const, type: 'button' as const, onClick } : {})}
			textAlign="left"
			w="100%"
			p={4}
			bg="white"
			border="1px solid"
			borderColor={isActive ? color : 'slate.200'}
			borderTop="3px solid"
			borderTopColor={color}
			borderRadius="lg"
			boxShadow={isActive ? 'md' : 'sm'}
			transition="all 0.15s ease"
			_hover={isClickable ? { boxShadow: 'md', transform: 'translateY(-1px)' } : undefined}
		>
			<Flex justify="space-between" align="flex-start" gap={3}>
				<Box minW={0}>
					<Text fontSize="xs" fontWeight="600" color="slate.500" textTransform="uppercase" letterSpacing="0.04em" noOfLines={1}>
						{label}
					</Text>
					<Text fontSize="2xl" fontWeight="700" color="slate.900" mt={0.5} lineHeight="1.2">{value}</Text>
				</Box>
				{icon ? (
					<Flex w="36px" h="36px" flexShrink={0} borderRadius="md" bg="slate.50" color={color} align="center" justify="center">
						{icon}
					</Flex>
				) : null}
			</Flex>
			{helper ? (
				<HStack mt={1.5} fontSize="xs" color="slate.500" spacing={1}>
					{typeof helper === 'string' ? <Text>{helper}</Text> : helper}
				</HStack>
			) : null}
		</Box>
	);
}

export default StatCard;
