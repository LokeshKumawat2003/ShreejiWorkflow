import { Box, HStack, Icon, Text } from '@chakra-ui/react';

type BrandLogoProps = {
  compact?: boolean;
  isDark?: boolean;
};

function BrandLogo({ compact = false, isDark = false }: BrandLogoProps) {
  return (
    <HStack spacing={3} align="center" color={isDark ? 'white' : 'slate.900'}>
      <Icon
        viewBox="0 0 56 48"
        boxSize={compact ? 12 : 11}
        color="brand.500"
        aria-hidden="true"
      >
        <circle cx="28" cy="10" r="8" fill="currentColor" />
        <circle cx="10" cy="19" r="6" fill="currentColor" />
        <circle cx="46" cy="19" r="6" fill="currentColor" />
        <path d="M13 37c0-9 6-16 15-16s15 7 15 16c0 4-3 7-7 7H20c-4 0-7-3-7-7Z" fill="currentColor" />
        <path d="M1 37c0-7 4-12 10-12 2 0 4 1 5 2-3 3-5 7-5 12v4H7c-4 0-6-2-6-6Zm54 0c0-7-4-12-10-12-2 0-4 1-5 2 3 3 5 7 5 12v4h4c4 0 6-2 6-6Z" fill="currentColor" />
      </Icon>
      <Box>
        <Text fontFamily="heading" fontSize={compact ? '2xl' : 'xl'} fontWeight="800" lineHeight="1.15">
          Shreeji workflow
        </Text>
        {!compact && (
          <Text mt={1} color={isDark ? 'slate.200' : 'slate.500'} fontSize="xs">
            Manage People&nbsp; · &nbsp;Track Progress&nbsp; · &nbsp;Build Tomorrow
          </Text>
        )}
      </Box>
    </HStack>
  );
}

export default BrandLogo;
