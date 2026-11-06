import { Flex, Heading, Stack, Text } from '@chakra-ui/react';
import BrandLogo from '../../components/layout/BrandLogo';
import AuthStoryPanel, { AuthMobileFeatures } from './components/AuthStoryPanel';
import SignupForm from './components/SignupForm';
import AuthLayout from '../../components/layout/AuthLayout';

function SignupPage() {
    return (
        <AuthLayout storyPanel={<AuthStoryPanel />} mobileFooter={<AuthMobileFeatures />}>
            <Stack align="stretch" spacing={0} textAlign="center" color="slate.900">
                <Flex display={{ base: 'none', lg: 'flex' }} justify="center" mb={7}>
                    <BrandLogo compact />
                </Flex>
                <Heading as="h1" fontSize="2xl" fontWeight="800">Create your account</Heading>
                <Text mt={2} color="slate.500" fontSize="md">
                    Register an organization or an administrator
                </Text>
                <SignupForm />
            </Stack>
        </AuthLayout>
    );
}

export default SignupPage;
