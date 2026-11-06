import { Box, HStack, Icon, Text, type IconProps } from '@chakra-ui/react';

type BrandLogoProps = {
  compact?: boolean;
  isDark?: boolean;
  size?: 'sm' | 'md';
};

export function BrandMark(props: IconProps) {
  return (
    <Icon viewBox="0 0 56 48" color="brand.500" aria-hidden="true" {...props}>
      <circle cx="28" cy="10" r="8" fill="currentColor" />
      <circle cx="10" cy="19" r="6" fill="currentColor" />
      <circle cx="46" cy="19" r="6" fill="currentColor" />
      <path d="M13 37c0-9 6-16 15-16s15 7 15 16c0 4-3 7-7 7H20c-4 0-7-3-7-7Z" fill="currentColor" />
      <path d="M1 37c0-7 4-12 10-12 2 0 4 1 5 2-3 3-5 7-5 12v4H7c-4 0-6-2-6-6Zm54 0c0-7-4-12-10-12-2 0-4 1-5 2 3 3 5 7 5 12v4h4c4 0 6-2 6-6Z" fill="currentColor" />
    </Icon>
  );
}

function BrandLogo({ compact = false, isDark = false, size = 'md' }: BrandLogoProps) {
  const isSmall = size === 'sm';

  return (
    <HStack spacing={isSmall ? 2.5 : 3} align="center" color={isDark ? 'white' : 'slate.900'}>
      <BrandMark boxSize={isSmall ? 9 : compact ? 12 : 11} />
      <Box>
        <Text
          fontFamily="heading"
          fontSize={isSmall ? 'lg' : compact ? '2xl' : 'xl'}
          fontWeight="800"
          lineHeight="1.15"
          letterSpacing="-0.01em"
        >
          Shreeji Caretaker
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
