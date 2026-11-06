import { Box, Flex, Text, type FlexProps } from '@chakra-ui/react';
import type { ReactNode } from 'react';

type FeatureTileProps = Omit<FlexProps, 'children'> & {
  icon: ReactNode;
  label: string;
};

function FeatureTile({ icon, label, ...props }: FeatureTileProps) {
  return (
    <Flex
      direction={{ base: 'column', lg: 'row' }}
      align="center"
      justify={{ base: 'center', lg: 'flex-start' }}
      flex={{ base: 'none', lg: '1 1 0' }}
      gap={{ base: 1.5, lg: 'clamp(5px, 0.7vw, 10px)' }}
      w={{ base: '68px', sm: '72px', lg: 'auto' }}
      minW={0}
      minH={{ base: '56px', lg: 'auto' }}
      px={{ base: 1, lg: 'clamp(7px, 0.8vw, 12px)' }}
      py={{ base: 2, lg: 'min(1.5vh, 12px)' }}
      bg="whiteAlpha.900"
      border="1px solid"
      borderColor="white"
      borderRadius="10px"
      boxShadow="0 6px 18px -10px rgba(49, 46, 129, 0.25)"
      {...props}
    >
      <Box color="brand.500" fontSize={{ base: 'lg', lg: 'clamp(1.05rem, 1.65vw, 1.5rem)' }} lineHeight={0} aria-hidden="true">
        {icon}
      </Box>
      <Text
        color="slate.800"
        fontSize={{ base: '10px', lg: 'clamp(0.65rem, 0.95vw, 0.875rem)' }}
        fontWeight="500"
        lineHeight="1.3"
        textAlign={{ base: 'center', lg: 'left' }}
        whiteSpace="pre-line"
      >
        {label}
      </Text>
    </Flex>
  );
}

export default FeatureTile;
