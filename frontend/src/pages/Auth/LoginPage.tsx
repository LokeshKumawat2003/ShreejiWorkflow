import { Flex, Heading, Stack, Text } from '@chakra-ui/react';
import BrandLogo from '../../components/layout/BrandLogo';
import AuthStoryPanel from './components/AuthStoryPanel';
import LoginForm from './components/LoginForm';
import AuthLayout from '../../components/layout/AuthLayout';

function LoginPage() {
    return (
        <AuthLayout storyPanel={<AuthStoryPanel />}>
            <Flex display={{ base: 'flex', lg: 'none' }} justify="center" mb={8}>
                <BrandLogo compact />
            </Flex>
            <Stack align="stretch" spacing={0} textAlign="center" color="slate.900">
                <Flex display={{ base: 'none', lg: 'flex' }} justify="center" mb={7}>
                    <BrandLogo compact />
                </Flex>
                <Heading as="h1" fontSize="2xl" fontWeight="800">Sign in to Shreeji workflow</Heading>
                <Text mt={2} color="slate.500" fontSize="md">
                    Access your account to continue
                </Text>
                <LoginForm />
            </Stack>
        </AuthLayout>
    );
}

export default LoginPage;
