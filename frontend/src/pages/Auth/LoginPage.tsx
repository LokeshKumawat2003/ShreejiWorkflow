import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flex, Heading, Spinner, Stack, Text } from '@chakra-ui/react';
import BrandLogo from '../../components/layout/BrandLogo';
import AuthStoryPanel, { AuthMobileFeatures } from './components/AuthStoryPanel';
import LoginForm from './components/LoginForm';
import AuthLayout from '../../components/layout/AuthLayout';
import { getDashboardPath } from '../../app/authorization';
import { getSessionUser } from '../../services/api';

function LoginPage() {
    const navigate = useNavigate();
    const [isCheckingSession, setIsCheckingSession] = useState(true);

    useEffect(() => {
        let isActive = true;

        void getSessionUser().then((user) => {
            if (!isActive) return;
            if (user) navigate(getDashboardPath(user.role), { replace: true });
            else setIsCheckingSession(false);
        });

        return () => {
            isActive = false;
        };
    }, [navigate]);

    if (isCheckingSession) {
        return (
            <Flex minH="100vh" align="center" justify="center" bg="slate.50">
                <Spinner color="brand.500" size="lg" />
            </Flex>
        );
    }

    return (
        <AuthLayout storyPanel={<AuthStoryPanel />} mobileFooter={<AuthMobileFeatures />}>
            <Stack align="stretch" spacing={0} textAlign="center" color="slate.900">
                <Flex display={{ base: 'none', lg: 'flex', xl: 'none' }} justify="center" mb={5}>
                    <BrandLogo compact size="sm" />
                </Flex>
                <Flex display={{ base: 'none', xl: 'flex' }} justify="center" mb={8}>
                    <BrandLogo compact />
                </Flex>
                <Heading as="h1" fontSize={{ base: '24px', sm: '26px', lg: 'clamp(1.125rem, 1.7vw, 1.5rem)' }} fontWeight={{ base: '800', lg: '700' }}>
                    Welcome Back!
                </Heading>
                <Text mt={{ base: 1, lg: 1.5 }} color="slate.500" fontSize={{ base: 'sm', lg: 'clamp(0.8125rem, 1.1vw, 1rem)' }}>
                    Sign in to continue to your account
                </Text>
                <LoginForm />
            </Stack>
        </AuthLayout>
    );
}

export default LoginPage;
