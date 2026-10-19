import { Box, Center, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

type FeatureTileProps = {
  icon: ReactNode;
  label: string;
  tone: 'blue' | 'green' | 'violet' | 'amber' | 'cyan';
  isDark?: boolean;
};

function FeatureTile({ icon, label, tone, isDark = false }: FeatureTileProps) {
  const toneColors = {
    blue: 'blue.500',
    green: 'green.500',
    violet: 'purple.500',
    amber: 'orange.400',
    cyan: 'cyan.500',
  };

  return (
    <Center
      w="70px"
      h="70px"
      flexDirection="column"
      gap={1}
      border="1px solid"
      borderColor={isDark ? 'whiteAlpha.200' : 'whiteAlpha.700'}
      borderRadius="md"
      bg={isDark ? 'whiteAlpha.100' : 'whiteAlpha.800'}
      boxShadow="sm"
    >
      <Box color={toneColors[tone]} fontSize="2xl" aria-hidden="true">
        {icon}
      </Box>
      <Text color={isDark ? 'white' : 'slate.900'} fontSize="xs" fontWeight="700">
        {label}
      </Text>
    </Center>
  );
}

export default FeatureTile;
