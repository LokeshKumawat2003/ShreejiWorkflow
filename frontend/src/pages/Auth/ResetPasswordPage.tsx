import { LockIcon, ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import {
  Alert,
  AlertIcon,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  Heading,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BrandLogo from '../../components/layout/BrandLogo';
import AuthLayout from '../../components/layout/AuthLayout';
import api, { ApiError } from '../../services/api';
import AuthStoryPanel from './components/AuthStoryPanel';

const inputStyles = {
    bg: 'white',
    color: 'slate.900',
    borderColor: 'slate.200',
    _hover: { borderColor: 'brand.400' },
    _focusVisible: { borderColor: 'brand.500', boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)' },
};

function ResetPasswordPage() {
    const toast = useToast();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') ?? '';
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const passwordTooShort = password.length > 0 && password.length < 8;
    const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (password.length < 8 || password !== confirmPassword) return;
        setIsSubmitting(true);

        try {
            const { data } = await api.post<{ message: string }>('/auth/reset-password', { token, password });
            toast({ title: data.message, status: 'success', duration: 4000, isClosable: true, position: 'top' });
            navigate('/login', { replace: true });
        } catch (error) {
            toast({
                title: error instanceof ApiError ? error.message : 'Unable to reset your password right now.',
                status: 'error',
                duration: 4000,
                isClosable: true,
                position: 'top',
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <AuthLayout storyPanel={<AuthStoryPanel />}>
            <Flex display={{ base: 'flex', lg: 'none' }} justify="center" mb={8}>
                <BrandLogo compact />
            </Flex>
            <Stack align="stretch" spacing={0} textAlign="center" color="slate.900">
                <Flex display={{ base: 'none', lg: 'flex' }} justify="center" mb={7}>
                    <BrandLogo compact />
                </Flex>
                <Heading as="h1" fontSize="2xl" fontWeight="800">Set a new password</Heading>
                <Text mt={2} color="slate.500" fontSize="md">
                    Choose a new password for your account
                </Text>

                {!token ? (
                    <Stack spacing={4} mt={9} textAlign="left">
                        <Alert status="error" borderRadius="md">
                            <AlertIcon />
                            This reset link is invalid. Please request a new one.
                        </Alert>
                        <Button colorScheme="brand" size="lg" onClick={() => navigate('/forgot-password')}>
                            Request a new link
                        </Button>
                    </Stack>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <Stack spacing={4} mt={9} textAlign="left">
                            <FormControl isRequired isInvalid={passwordTooShort}>
                                <InputGroup size="lg">
                                    <InputLeftElement h="full" pointerEvents="none" color="slate.400">
                                        <LockIcon />
                                    </InputLeftElement>
                                    <Input
                                        autoComplete="new-password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="New password"
                                        aria-label="New password"
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        {...inputStyles}
                                    />
                                    <InputRightElement h="full">
                                        <IconButton
                                            variant="ghost"
                                            size="sm"
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                                            onClick={() => setShowPassword((visible) => !visible)}
                                        />
                                    </InputRightElement>
                                </InputGroup>
                                <FormErrorMessage>Password must be at least 8 characters long.</FormErrorMessage>
                            </FormControl>

                            <FormControl isRequired isInvalid={passwordsMismatch}>
                                <InputGroup size="lg">
                                    <InputLeftElement h="full" pointerEvents="none" color="slate.400">
                                        <LockIcon />
                                    </InputLeftElement>
                                    <Input
                                        autoComplete="new-password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Confirm new password"
                                        aria-label="Confirm new password"
                                        value={confirmPassword}
                                        onChange={(event) => setConfirmPassword(event.target.value)}
                                        {...inputStyles}
                                    />
                                </InputGroup>
                                <FormErrorMessage>Passwords do not match.</FormErrorMessage>
                            </FormControl>

                            <Button
                                type="submit"
                                colorScheme="brand"
                                size="lg"
                                isLoading={isSubmitting}
                                loadingText="Saving"
                                boxShadow="md"
                                isDisabled={password.length < 8 || password !== confirmPassword}
                            >
                                Reset password
                            </Button>

                            <Button variant="link" color="brand.500" size="sm" type="button" onClick={() => navigate('/login')}>
                                Back to sign in
                            </Button>
                        </Stack>
                    </form>
                )}
            </Stack>
        </AuthLayout>
    );
}

export default ResetPasswordPage;
