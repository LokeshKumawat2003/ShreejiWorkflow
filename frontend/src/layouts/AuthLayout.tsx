import { Box, Flex, Grid } from '@chakra-ui/react';
import type { ReactNode } from 'react';

type AuthLayoutProps = {
  storyPanel: ReactNode;
  children: ReactNode;
};

function AuthLayout({ storyPanel, children }: AuthLayoutProps) {
  return (
    <Grid
      minH="100vh"
      templateColumns={{ base: '1fr', lg: 'minmax(0, 1fr) minmax(440px, 0.9fr)' }}
      bg="white"
    >
      <Flex
        display={{ base: 'none', lg: 'flex' }}
        position="relative"
        overflow="hidden"
        bg="blue.50"
        px={{ lg: 10, xl: 16 }}
        py={10}
      >
        {storyPanel}
      </Flex>
      <Flex align="center" justify="center" px={{ base: 5, md: 10 }} py={{ base: 8, lg: 12 }}>
        <Box w="full" maxW="440px">
          {children}
        </Box>
      </Flex>
    </Grid>
  );
}

export default AuthLayout;