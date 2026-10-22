import { Box, SimpleGrid, Skeleton, Text } from '@chakra-ui/react';

export type StatStripItem = {
	label: string;
	value: number | null | undefined;
	helper?: string;
	color?: string;
};

type StatStripProps = {
	items: StatStripItem[];
};

function formatValue(value: number) {
	return value < 10 && value >= 0 ? String(value).padStart(2, '0') : value.toLocaleString();
}

function StatStrip({ items }: StatStripProps) {
	return (
		<SimpleGrid
			columns={{ base: 1, sm: Math.min(items.length, 3), lg: items.length }}
			spacing={0}
			bg="white"
			border="1px solid"
			borderColor="slate.200"
			borderRadius="lg"
			boxShadow="sm"
			overflow="hidden"
		>
			{items.map((item, index) => (
				<Box
					key={item.label}
					px={5}
					py={4}
					borderLeft={{ base: 'none', sm: index === 0 ? 'none' : '1px solid' }}
					borderTop={{ base: index === 0 ? 'none' : '1px solid', sm: 'none' }}
					borderColor="slate.100"
				>
					<Text fontSize="sm" color="slate.600">{item.label}</Text>
					{typeof item.value === 'number' ? (
						<Text mt={1.5} fontSize="2xl" lineHeight="1.1" fontWeight="700" color={item.color || 'slate.900'}>
							{formatValue(item.value)}
						</Text>
					) : (
						<Skeleton mt={1.5} h="26px" w="44px" borderRadius="sm" />
					)}
					{item.helper ? <Text mt={1.5} fontSize="xs" color="slate.500">{item.helper}</Text> : null}
				</Box>
			))}
		</SimpleGrid>
	);
}

export default StatStrip;
