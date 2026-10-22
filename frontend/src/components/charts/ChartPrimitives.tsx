import { Box, Flex, HStack, Text } from '@chakra-ui/react';

export function ChartHeader({
  title,
  subtitle,
  label,
}: {
  title: string;
  subtitle: string;
  label?: string;
}) {
  return (
    <Flex justify="space-between" align="flex-start" gap={3} mb={5}>
      <Box minW={0}>
        <Text fontSize="md" fontWeight="700" color="#0F172A">{title}</Text>
        <Text mt={1} fontSize="xs" color="#94A3B8">{subtitle}</Text>
      </Box>
      {label && (
        <Box px={2.5} py={1} bg="#EEF2FF" color="#4F46E5" borderRadius="full" flexShrink={0}>
          <Text fontSize="10px" fontWeight="700">{label}</Text>
        </Box>
      )}
    </Flex>
  );
}

export function ChartMessage({ children }: { children: string }) {
  return (
    <Flex h="260px" align="center" justify="center" direction="column" gap={2}>
      <Box
        w="44px"
        h="44px"
        display="flex"
        alignItems="center"
        justifyContent="center"
        borderRadius="xl"
        bg="#F1F5F9"
        color="#94A3B8"
        fontSize="xl"
      >
        ↗
      </Box>
      <Text color="#64748B" fontSize="sm" textAlign="center" maxW="260px">{children}</Text>
    </Flex>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <HStack spacing={4} wrap="wrap" mt={4}>
      {items.map((item) => (
        <HStack key={item.label} spacing={2}>
          <Box w="8px" h="8px" borderRadius="full" bg={item.color} />
          <Text fontSize="xs" color="#64748B">{item.label}</Text>
        </HStack>
      ))}
    </HStack>
  );
}