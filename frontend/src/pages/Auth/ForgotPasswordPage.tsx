import { EmailIcon } from '@chakra-ui/icons';
import {
  Alert,
  AlertIcon,
  Button,
  Flex,
  FormControl,
  Heading,
  Input,
  InputGroup,
  InputLeftElement,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../../components/layout/BrandLogo';
import AuthLayout from '../../components/layout/AuthLayout';
import api, { ApiError } from '../../services/api';
import AuthStoryPanel from './components/AuthStoryPanel';

function ForgotPasswordPage() {
    const toast = useToast();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sentMessage, setSentMessage] = useState('');

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSubmitting(true);

        try {
            const { data } = await api.post<{ message: string }>('/auth/forgot-password', { email });
            setSentMessage(data.message);
        } catch (error) {
            toast({
                title: error instanceof ApiError ? error.message : 'Unable to send the reset email right now.',
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
                <Heading as="h1" fontSize="2xl" fontWeight="800">Forgot your password?</Heading>
                <Text mt={2} color="slate.500" fontSize="md">
                    Enter your account email and we will send you a reset link
                </Text>

                <form onSubmit={handleSubmit}>
                    <Stack spacing={4} mt={9} textAlign="left">
                        {sentMessage && (
                            <Alert status="success" borderRadius="md">
                                <AlertIcon />
                                {sentMessage}
                            </Alert>
                        )}
                        <FormControl isRequired>
                            <InputGroup size="lg">
                                <InputLeftElement h="full" pointerEvents="none" color="slate.400">
                                    <EmailIcon />
                                </InputLeftElement>
                                <Input
                                    autoComplete="email"
                                    name="email"
                                    type="email"
                                    placeholder="Email address"
                                    aria-label="Email address"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    bg="white"
                                    color="slate.900"
                                    borderColor="slate.200"
                                    _hover={{ borderColor: 'brand.400' }}
                                    _focusVisible={{ borderColor: 'brand.500', boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)' }}
                                />
                            </InputGroup>
                        </FormControl>

                        <Button
                            type="submit"
                            colorScheme="brand"
                            size="lg"
                            isLoading={isSubmitting}
                            loadingText="Sending"
                            boxShadow="md"
                        >
                            {sentMessage ? 'Resend reset link' : 'Send reset link'}
                        </Button>

                        <Button variant="link" color="brand.500" size="sm" type="button" onClick={() => navigate('/login')}>
                            Back to sign in
                        </Button>
                    </Stack>
                </form>
            </Stack>
        </AuthLayout>
    );
}

export default ForgotPasswordPage;
