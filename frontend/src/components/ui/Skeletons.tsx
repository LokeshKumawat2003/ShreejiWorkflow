import { Box, Flex, HStack, SimpleGrid, Skeleton, SkeletonCircle, Stack } from '@chakra-ui/react';

export function ListSkeleton({ rows = 5, rowHeight = '40px', px = 0, py = 0 }: { rows?: number; rowHeight?: string; px?: number; py?: number }) {
  return (
    <Stack spacing={2} px={px} py={py}>
      {Array.from({ length: rows }, (_, index) => <Skeleton key={index} h={rowHeight} borderRadius="md" />)}
    </Stack>
  );
}

function CardSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <Box bg="white" border="1px solid" borderColor="slate.200" borderRadius="lg" boxShadow="sm" p={5}>
      <HStack spacing={3} mb={5}>
        <Skeleton w="36px" h="36px" borderRadius="10px" />
        <Stack spacing={2} flex={1}>
          <Skeleton h="14px" w="40%" />
          <Skeleton h="10px" w="25%" />
        </Stack>
      </HStack>
      <SimpleGrid columns={2} spacing={4}>
        {Array.from({ length: fields }, (_, index) => (
          <Stack key={index} spacing={2}>
            <Skeleton h="9px" w="45%" />
            <Skeleton h="14px" w="75%" />
          </Stack>
        ))}
      </SimpleGrid>
    </Box>
  );
}

export function DetailsSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={6} alignItems="start">
      {Array.from({ length: cards }, (_, index) => <CardSkeleton key={index} />)}
    </SimpleGrid>
  );
}

export function ChartSkeleton({ height = '260px' }: { height?: string }) {
  return (
    <Flex h={height} align="flex-end" gap={2} px={2}>
      {[45, 70, 55, 85, 60, 75, 40, 65, 80, 50].map((value, index) => (
        <Skeleton key={index} flex={1} h={`${value}%`} borderRadius="md" />
      ))}
    </Flex>
  );
}

export function AppShellSkeleton() {
  return (
    <Flex h="100vh" overflow="hidden" bg="slate.50">
      <Stack display={{ base: 'none', lg: 'flex' }} w="250px" flexShrink={0} bg="white" borderRight="1px solid" borderColor="slate.200" p={4} spacing={3}>
        <HStack spacing={3} mb={6}>
          <Skeleton w="36px" h="36px" borderRadius="10px" />
          <Stack spacing={2} flex={1}>
            <Skeleton h="12px" w="70%" />
            <Skeleton h="9px" w="50%" />
          </Stack>
        </HStack>
        {Array.from({ length: 7 }, (_, index) => <Skeleton key={index} h="34px" borderRadius="md" />)}
      </Stack>
      <Stack flex={1} minW={0} spacing={0}>
        <HStack h="64px" px={6} justify="space-between" bg="white" borderBottom="1px solid" borderColor="slate.200">
          <Skeleton h="18px" w="160px" />
          <HStack spacing={3}>
            <SkeletonCircle size="8" />
            <Skeleton h="12px" w="140px" />
          </HStack>
        </HStack>
        <Stack p={6} spacing={6}>
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} h="96px" borderRadius="lg" />)}
          </SimpleGrid>
          <Skeleton h="320px" borderRadius="lg" />
        </Stack>
      </Stack>
    </Flex>
  );
}
