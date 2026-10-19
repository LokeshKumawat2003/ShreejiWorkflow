import { AddIcon, CheckCircleIcon, NotAllowedIcon, TimeIcon } from '@chakra-ui/icons';
import { Box, HStack, SimpleGrid, Text } from '@chakra-ui/react';

type OrganizationStatsProps = {
  total: number;
  active: number;
  pending: number;
  inactive: number;
};

const metrics = [
  { key: 'total', label: 'Total organizations', icon: AddIcon, color: 'brand.500', bg: 'brand.50' },
  { key: 'active', label: 'Active', icon: CheckCircleIcon, color: 'green.500', bg: 'green.50' },
  { key: 'pending', label: 'Pending', icon: TimeIcon, color: 'orange.500', bg: 'orange.50' },
  { key: 'inactive', label: 'Inactive', icon: NotAllowedIcon, color: 'slate.500', bg: 'slate.100' },
] as const;

function OrganizationStats({ total, active, pending, inactive }: OrganizationStatsProps) {
  const values = { total, active, pending, inactive };

  return (
    <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={4}>
      {metrics.map(({ key, label, icon: MetricIcon, color, bg }) => (
        <HStack
          key={key}
          minH="96px"
          align="center"
          spacing={4}
          px={5}
          bg="white"
          border="1px solid"
          borderColor="slate.200"
          borderRadius="8px"
        >
          <Box
            w="44px"
            h="44px"
            display="grid"
            placeItems="center"
            borderRadius="full"
            color={color}
            bg={bg}
            fontSize="lg"
          >
            <MetricIcon />
          </Box>
          <Box>
            <Text fontSize="xs" color="slate.500">{label}</Text>
            <Text mt={1} fontSize="2xl" lineHeight="1" fontWeight="700" color="slate.900">
              {values[key]}
            </Text>
          </Box>
        </HStack>
      ))}
    </SimpleGrid>
  );
}

export default OrganizationStats;