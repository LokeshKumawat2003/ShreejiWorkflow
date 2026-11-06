import { ArrowForwardIcon, EmailIcon, LockIcon, ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import {
  Box,
  Button,
  Center,
  Checkbox,
  Divider,
  FormControl,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Stack,
  Text,
  useBreakpointValue,
  useToast,
} from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { ApiError, setAccessToken } from '../../../services/api';
import type { User } from '../../../types';
import { getDashboardPath } from '../../../app/authorization';

type LoginResponse = {
  token: string;
  user: User;
};

function LoginForm() {
  const toast = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isDesktop = useBreakpointValue({ base: false, lg: true }, { ssr: false });
  const inputStyles = {
    h: { base: 'clamp(44px, 6dvh, 50px)', lg: 'clamp(42px, 3.6vw, 52px)' },
    pl: 12,
    bg: 'white',
    color: 'slate.900',
    fontSize: 'md',
    borderColor: '#E3E5F0',
    borderRadius: { base: '13px', lg: '10px' },
    _placeholder: { color: 'slate.500' },
    _hover: { borderColor: '#C7CAF3' },
    _focusVisible: { borderColor: 'brand.500', boxShadow: '0 0 0 3px rgba(79, 70, 229, 0.15)' },
  };
  const inputIconStyles = {
    h: 'full',
    w: 12,
    pointerEvents: 'none' as const,
    color: '#6B7083',
    fontSize: { base: 'lg', lg: 'md' },
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
      setAccessToken(data.token, rememberMe);
      navigate(getDashboardPath(data.user.role), {
        replace: true,
        state: { user: data.user },
      });
      toast({
        title: 'Signed in successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'top',
      });
    } catch (error) {
      toast({
        title: error instanceof ApiError ? error.message : 'Unable to sign in right now.',
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
    <form onSubmit={handleSubmit}>
      <Stack spacing={{ base: 'clamp(8px, 1.4dvh, 12px)', lg: 3.5 }} mt={{ base: 'clamp(14px, 2.4dvh, 20px)', lg: 6 }} textAlign="left">
        <FormControl isRequired>
          <InputGroup>
            <InputLeftElement {...inputIconStyles}>
              <EmailIcon />
            </InputLeftElement>
            <Input
              {...inputStyles}
              autoComplete="email"
              name="email"
              type="email"
              placeholder="Email address"
              aria-label="Email address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </InputGroup>
        </FormControl>

        <FormControl isRequired>
          <InputGroup>
            <InputLeftElement {...inputIconStyles}>
              <LockIcon />
            </InputLeftElement>
            <Input
              {...inputStyles}
              pr={12}
              autoComplete="current-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              aria-label="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <InputRightElement h="full" w={12}>
              <IconButton
                variant="ghost"
                size="sm"
                color="#6B7083"
                fontSize={{ base: 'lg', lg: 'md' }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                onClick={() => setShowPassword((visible) => !visible)}
              />
            </InputRightElement>
          </InputGroup>
        </FormControl>

        <HStack justify="space-between" align="center" flexWrap="wrap" spacing={2} pt={{ base: 0, lg: 0.5 }}>
          <Checkbox
            colorScheme="brand"
            size={{ base: 'lg', lg: 'md' }}
            isChecked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            sx={{ '.chakra-checkbox__control': { borderRadius: '4px' } }}
          >
            <Text as="span" fontSize={{ base: 'md', lg: 'sm' }} color="slate.700">Remember me</Text>
          </Checkbox>
          <Button
            variant="link"
            color="brand.500"
            fontSize={{ base: 'md', lg: 'sm' }}
            fontWeight="600"
            type="button"
            onClick={() => navigate('/forgot-password')}
          >
            Forgot password?
          </Button>
        </HStack>

        <Button
          type="submit"
          h={{ base: 'clamp(46px, 6.2dvh, 52px)', lg: 'clamp(42px, 3.6vw, 52px)' }}
          mt={{ base: 1, lg: 1.5 }}
          borderRadius={{ base: '16px', lg: '10px' }}
          bg="linear-gradient(90deg, #5B4BE0 0%, #4F46E5 100%)"
          color="white"
          fontSize={{ base: 'lg', lg: 'md' }}
          fontWeight="600"
          boxShadow="0 12px 24px -10px rgba(79, 70, 229, 0.6)"
          _hover={{ bg: 'linear-gradient(90deg, #5143D4 0%, #4338CA 100%)' }}
          _active={{ bg: '#4338CA' }}
          leftIcon={
            isDesktop ? undefined : (
              <Center boxSize="28px" borderRadius="full" bg="white" color="brand.500">
                <ArrowForwardIcon boxSize={4} />
              </Center>
            )
          }
          rightIcon={isDesktop ? <ArrowForwardIcon /> : undefined}
          iconSpacing={isDesktop ? 2 : 3}
          isLoading={isSubmitting}
          loadingText="Signing in"
        >
          Sign In
        </Button>

        <HStack spacing={3} mt={{ base: 1, lg: 3 }}>
          <Divider borderColor="#E3E5F0" />
          <Box flexShrink={0}>
            <Text as="span" color="slate.600" fontSize={{ base: 'sm', lg: 'clamp(0.7rem, 0.95vw, 0.8125rem)' }}>
              Don’t have an account?{' '}
            </Text>
            <Button
              variant="link"
              color="brand.500"
              fontSize={{ base: 'sm', lg: 'clamp(0.7rem, 0.95vw, 0.8125rem)' }}
              fontWeight="600"
              type="button"
              onClick={() => navigate('/signup')}
            >
              Create an account
            </Button>
          </Box>
          <Divider borderColor="#E3E5F0" />
        </HStack>
      </Stack>
    </form>
  );
}

export default LoginForm;
