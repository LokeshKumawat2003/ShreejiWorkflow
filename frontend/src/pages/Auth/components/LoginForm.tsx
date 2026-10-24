import { ArrowForwardIcon, EmailIcon, LockIcon, ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import {
  Button,
  Checkbox,
  FormControl,
  HStack,
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
  const inputBg = 'white';
  const inputColor = 'slate.900';
  const inputBorder = 'slate.200';

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

  function showSetupNotice(title: string) {
    toast({
      title,
      status: 'info',
      duration: 4500,
      isClosable: true,
      position: 'top',
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack spacing={4} mt={9} textAlign="left">
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
            bg={inputBg}
            color={inputColor}
            borderColor={inputBorder}
            _hover={{ borderColor: 'brand.400' }}
            _focusVisible={{ borderColor: 'brand.500', boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)' }}
          />
          </InputGroup>
        </FormControl>

        <FormControl isRequired>
          <InputGroup size="lg">
            <InputLeftElement h="full" pointerEvents="none" color="slate.400">
              <LockIcon />
            </InputLeftElement>
            <Input
            autoComplete="current-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            aria-label="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            bg={inputBg}
            color={inputColor}
            borderColor={inputBorder}
            _hover={{ borderColor: 'brand.400' }}
            _focusVisible={{ borderColor: 'brand.500', boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)' }}
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
        </FormControl>

        <HStack justify="space-between" align="center" flexWrap="wrap" spacing={2}>
            <Checkbox
              colorScheme="brand"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            >Remember me</Checkbox>
          <Button
            variant="link"
            color="brand.500"
            size="sm"
            type="button"
            onClick={() => showSetupNotice('Please contact your HR administrator to reset your password.')}
          >
            Forgot password?
          </Button>
        </HStack>

        <Button
          type="submit"
          colorScheme="brand"
          size="lg"
          rightIcon={<ArrowForwardIcon />}
          isLoading={isSubmitting}
          loadingText="Signing in"
          boxShadow="md"
        >
          Sign In
        </Button>

        <HStack justify="center" flexWrap="wrap" spacing={1} mt={3}>
          <Text color="slate.500" fontSize="sm">
            Don’t have an account?
          </Text>
          <Button
            variant="link"
            color="brand.500"
            size="sm"
            type="button"
            onClick={() => navigate('/signup')}
          >
            Create an account
          </Button>
        </HStack>
      </Stack>
    </form>
  );
}

export default LoginForm;
