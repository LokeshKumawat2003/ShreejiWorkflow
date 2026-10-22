import { Box, Flex, HStack, SimpleGrid, Skeleton, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

export type StatStripItem = {
	label: string;
	value: number | string | null | undefined;
	helper?: string;
	color?: string;
	icon?: ReactNode;
	share?: number | null;
};

type StatStripProps = {
	items: StatStripItem[];
};

function formatValue(value: number) {
	return value < 10 && value >= 0 ? String(value).padStart(2, '0') : value.toLocaleString();
}

function tint(color: string, shade: number) {
	const [scheme] = color.split('.');
	return `${scheme}.${shade}`;
}

function StatStrip({ items }: StatStripProps) {
	return (
		<SimpleGrid columns={{ base: 1, sm: 2, lg: items.length }} spacing={4}>
			{items.map((item) => {
				const color = item.color || 'slate.700';
				const share = typeof item.share === 'number' && Number.isFinite(item.share) ? Math.min(Math.max(item.share, 0), 1) : null;
				return (
					<Box
						key={item.label}
						position="relative"
						overflow="hidden"
						bg="white"
						border="1px solid"
						borderColor="slate.200"
						borderRadius="lg"
						boxShadow="sm"
						px={5}
						py={4}
						transition="box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease"
						_hover={{ boxShadow: 'md', transform: 'translateY(-2px)', borderColor: tint(color, 200) }}
					>
						<Box position="absolute" top="-28px" right="-28px" w="96px" h="96px" borderRadius="full" bg={tint(color, 50)} opacity={0.9} />
						<HStack position="relative" justify="space-between" align="flex-start" spacing={3}>
							<Box minW={0}>
								<Text fontSize="xs" fontWeight="700" color="slate.500" letterSpacing="0.06em" textTransform="uppercase">
									{item.label}
								</Text>
								{typeof item.value === 'number' || typeof item.value === 'string' ? (
									<Text
										mt={2}
										fontSize={typeof item.value === 'string' && item.value.length > 9 ? '2xl' : '3xl'}
										lineHeight="1"
										fontWeight="800"
										color="slate.900"
										letterSpacing="-0.02em"
										whiteSpace="nowrap"
									>
										{typeof item.value === 'number' ? formatValue(item.value) : item.value}
									</Text>
								) : (
									<Skeleton mt={2} h="30px" w="56px" borderRadius="sm" />
								)}
							</Box>
							{item.icon ? (
								<Flex flexShrink={0} w="44px" h="44px" align="center" justify="center" borderRadius="12px" bg={tint(color, 100)} color={color}>
									{item.icon}
								</Flex>
							) : null}
						</HStack>

						<Box position="relative" mt={4}>
							{share !== null ? (
								<Box h="6px" bg="slate.100" borderRadius="full" overflow="hidden" mb={2}>
									<Box h="100%" w={`${share * 100}%`} bg={color} borderRadius="full" transition="width 0.4s ease" />
								</Box>
							) : null}
							{item.helper ? (
								<Text fontSize="xs" color="slate.500">
									{item.helper}
									{share !== null ? <Text as="span" fontWeight="700" color="slate.700">{` · ${Math.round(share * 100)}%`}</Text> : null}
								</Text>
							) : null}
						</Box>
					</Box>
				);
			})}
		</SimpleGrid>
	);
}

export default StatStrip;
