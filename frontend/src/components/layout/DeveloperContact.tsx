import { Box, Text, type TextProps } from '@chakra-ui/react';

function DeveloperContact(props: TextProps) {
  return (
    <Text textAlign="center" fontSize="11px" color="slate.400" {...props}>
      Developer:{' '}
      <Box as="a" href="tel:+919549809524" color="brand.500" fontWeight="600" _hover={{ textDecoration: 'underline' }}>
        +91 95498 09524
      </Box>
    </Text>
  );
}

export default DeveloperContact;
