import { Box, Center, Flex, Grid, Image, SimpleGrid, type BoxProps } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import loginTeam from '../../assets/login-team.png';
import { BrandMark } from './BrandLogo';

type AuthLayoutProps = {
  storyPanel: ReactNode;
  mobileFooter?: ReactNode;
  cornerNote?: ReactNode;
  children: ReactNode;
};

const desktopArtMaxHeight = `${Math.round((52 * 254) / 560)}vw`;

function DotGrid({ columns, rows, ...props }: BoxProps & { columns: number; rows: number }) {
  return (
    <SimpleGrid position="absolute" columns={columns} spacing="10px" pointerEvents="none" aria-hidden="true" {...props}>
      {Array.from({ length: columns * rows }, (_, index) => (
        <Box key={index} boxSize="5px" borderRadius="full" bg="#C9CCF3" />
      ))}
    </SimpleGrid>
  );
}

function BackgroundArt() {
  return (
    <Box position="absolute" inset={0} pointerEvents="none" aria-hidden="true">
      <Box
        position="absolute"
        top={{ base: '-60px', lg: '-90px' }}
        left={{ base: '-80px', lg: '-120px' }}
        boxSize={{ base: '220px', lg: '340px' }}
        borderRadius="full"
        bg="radial-gradient(circle, rgba(221, 224, 251, 0.9) 0%, rgba(221, 224, 251, 0) 70%)"
      />
      <Box
        position="absolute"
        top={{ base: '-120px', lg: '-30vh' }}
        right={{ base: '-90px', lg: '-6vw' }}
        boxSize={{ base: '280px', lg: '52vh' }}
        borderRadius="full"
        bg="linear-gradient(200deg, #C3C7F4 0%, #DCDFFA 70%)"
        opacity={0.85}
      />
      <Box
        display={{ base: 'none', lg: 'block' }}
        position="absolute"
        top="14vh"
        right="2.6vw"
        boxSize="22px"
        borderRadius="full"
        bg="#D6D9F7"
      />
      <Box
        position="absolute"
        bottom={0}
        right={0}
        w={{ base: '100%', lg: '62vw' }}
        h={{ base: '120px', lg: '30vh' }}
      >
        <svg width="100%" height="100%" viewBox="0 0 600 200" preserveAspectRatio="none">
          <path d="M0 200C90 120 190 90 300 110C410 130 500 80 600 20V200Z" fill="#E4E6FB" />
          <path d="M120 200C220 150 320 140 420 150C500 158 560 120 600 90V200Z" fill="#CFD2F6" />
        </svg>
      </Box>
      <DotGrid display={{ base: 'none', lg: 'grid' }} columns={5} rows={4} right="2.4vw" bottom="5vh" />
      <DotGrid display={{ base: 'grid', lg: 'none' }} columns={5} rows={3} right="28px" top="96px" />
      <DotGrid display={{ base: 'grid', lg: 'none' }} columns={5} rows={4} left="24px" bottom="14px" />
    </Box>
  );
}

function AuthLayout({ storyPanel, mobileFooter, cornerNote, children }: AuthLayoutProps) {
  return (
    <Box
      position="relative"
      minH="100dvh"
      overflow="hidden"
      bg="linear-gradient(115deg, #F1F2FD 0%, #F6F6FE 45%, #F3F4FD 100%)"
    >
      <BackgroundArt />
      <Grid
        position="relative"
        zIndex={1}
        minH="100dvh"
        maxW={{ base: '480px', lg: 'none' }}
        mx="auto"
        templateColumns={{ base: '1fr', lg: 'minmax(0, 41fr) minmax(320px, 30.5fr)' }}
        templateRows={{ base: 'auto 1fr auto', lg: '1fr' }}
        columnGap="9vw"
        pl={{ base: 5, sm: 6, lg: '10vw' }}
        pr={{ base: 5, sm: 6, lg: '7.5vw' }}
      >
        <Grid
          templateRows={{ base: 'auto', lg: 'auto minmax(0, 1fr)' }}
          h={{ base: 'auto', lg: '100dvh' }}
          pt={{ base: 'clamp(14px, 2.6dvh, 24px)', lg: '3vh' }}
        >
          {storyPanel}
          <Flex
            display={{ base: 'none', lg: 'flex' }}
            align="flex-end"
            minH={0}
            ml="-10vw"
            pt={4}
          >
            <Image
              src={loginTeam}
              alt=""
              h="100%"
              maxH={desktopArtMaxHeight}
              w="auto"
              maxW="100%"
              objectFit="contain"
              objectPosition="left bottom"
              sx={{
                maskImage: 'linear-gradient(to top, #000 82%, transparent), linear-gradient(to left, transparent, #000 10%)',
                maskComposite: 'intersect',
                WebkitMaskImage: 'linear-gradient(to top, #000 82%, transparent), linear-gradient(to left, transparent, #000 10%)',
                WebkitMaskComposite: 'source-in',
              }}
            />
          </Flex>
        </Grid>
        <Flex
          align="center"
          justify="center"
          pt={{ base: '48px', lg: 10 }}
          pb={{ base: 'clamp(12px, 2dvh, 20px)', lg: 10 }}
        >
          <Box
            position="relative"
            w="full"
            maxW={{ base: 'none', lg: '440px' }}
            bg="white"
            border="1px solid"
            borderColor="#EEF0FB"
            borderRadius={{ base: '26px', lg: '16px' }}
            boxShadow="0 24px 60px -24px rgba(49, 46, 129, 0.22)"
            px={{ base: 5, sm: 6, lg: 'clamp(24px, 2.5vw, 36px)' }}
            pt={{ base: '52px', lg: 'clamp(24px, 2.8vw, 40px)' }}
            pb={{ base: 'clamp(14px, 2.4dvh, 20px)', lg: 'clamp(24px, 2.8vw, 40px)' }}
          >
            <Center
              display={{ base: 'flex', lg: 'none' }}
              position="absolute"
              top="-40px"
              left="50%"
              transform="translateX(-50%)"
              boxSize="88px"
              borderRadius="full"
              bg="white"
              boxShadow="0 -10px 24px -14px rgba(49, 46, 129, 0.25)"
            >
              <Center boxSize="72px" borderRadius="full" bg="#ECEDFC">
                <BrandMark boxSize="40px" />
              </Center>
            </Center>
            {children}
          </Box>
        </Flex>
        {mobileFooter && <Box display={{ base: 'block', lg: 'none' }}>{mobileFooter}</Box>}
        {cornerNote && <Box display={{ base: 'block', lg: 'none' }} pb={4}>{cornerNote}</Box>}
      </Grid>
      {cornerNote && (
        <Box
          display={{ base: 'none', lg: 'block' }}
          position="absolute"
          left={6}
          bottom={4}
          zIndex={2}
          px={3}
          py={1.5}
          borderRadius="full"
          bg="whiteAlpha.800"
          backdropFilter="blur(4px)"
        >
          {cornerNote}
        </Box>
      )}
    </Box>
  );
}

export default AuthLayout;
