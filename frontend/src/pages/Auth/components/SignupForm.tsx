import { ArrowForwardIcon, EmailIcon, LockIcon, ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import {
  Button,
  ButtonGroup,
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
  type InputProps,
} from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { ApiError, setAccessToken } from '../../../services/api';
import type { User, UserRole } from '../../../types';
import { getDashboardPath } from '../../../app/authorization';

type SignupResponse = {
  token: string;
  user: User;
};

const inputStyles: InputProps = {
  bg: 'white',
  color: 'slate.900',
  borderColor: 'slate.200',
  _hover: { borderColor: 'brand.400' },
  _focusVisible: { borderColor: 'brand.500', boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)' },
};

function SignupForm() {
  const toast = useToast();
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>('organization');
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isAdmin = role === 'admin';

  function showError(title: string) {
    toast({ title, status: 'error', duration: 4000, isClosable: true, position: 'top' });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      showError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      showError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = isAdmin
        ? { role, name, email, password }
        : { role, name, organizationName, email, password };
      const { data } = await api.post<SignupResponse>('/auth/register', payload);
      setAccessToken(data.token, true);
      navigate(getDashboardPath(data.user.role), {
        replace: true,
        state: { user: data.user },
      });
      toast({
        title: 'Account created successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'top',
      });
    } catch (error) {
      showError(error instanceof ApiError ? error.message : 'Unable to create your account right now.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack spacing={4} mt={8} textAlign="left">
        <ButtonGroup isAttached w="full" size="md" role="radiogroup" aria-label="Account type">
          {(['organization', 'admin'] as const).map((option) => (
            <Button
              key={option}
              flex="1"
              type="button"
              role="radio"
              aria-checked={role === option}
              colorScheme="brand"
              variant={role === option ? 'solid' : 'outline'}
              onClick={() => setRole(option)}
            >
              {option === 'organization' ? 'Organization' : 'Admin'}
            </Button>
          ))}
        </ButtonGroup>

        <FormControl isRequired>
          <Input
            size="lg"
            autoComplete="name"
            name="name"
            placeholder={isAdmin ? 'Full name' : 'Contact person name'}
            aria-label={isAdmin ? 'Full name' : 'Contact person name'}
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            {...inputStyles}
          />
        </FormControl>

        {!isAdmin && (
          <FormControl isRequired>
            <Input
              size="lg"
              autoComplete="organization"
              name="organizationName"
              placeholder="Organization name"
              aria-label="Organization name"
              maxLength={150}
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              {...inputStyles}
            />
          </FormControl>
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
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              {...inputStyles}
            />
          </InputGroup>
        </FormControl>

        <FormControl isRequired>
          <InputGroup size="lg">
            <InputLeftElement h="full" pointerEvents="none" color="slate.400">
              <LockIcon />
            </InputLeftElement>
            <Input
              autoComplete="new-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password (min. 8 characters)"
              aria-label="Password"
              minLength={8}
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
        </FormControl>

        <FormControl isRequired>
          <InputGroup size="lg">
            <InputLeftElement h="full" pointerEvents="none" color="slate.400">
              <LockIcon />
            </InputLeftElement>
            <Input
              autoComplete="new-password"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm password"
              aria-label="Confirm password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              {...inputStyles}
            />
          </InputGroup>
        </FormControl>

        <Button
          type="submit"
          colorScheme="brand"
          size="lg"
          rightIcon={<ArrowForwardIcon />}
          isLoading={isSubmitting}
          loadingText="Creating account"
          boxShadow="md"
        >
          {isAdmin ? 'Register Admin' : 'Register Organization'}
        </Button>

        <HStack justify="center" flexWrap="wrap" spacing={1} mt={3}>
          <Text color="slate.500" fontSize="sm">
            Already have an account?
          </Text>
          <Button variant="link" color="brand.500" size="sm" type="button" onClick={() => navigate('/login')}>
            Sign in
          </Button>
        </HStack>
      </Stack>
    </form>
  );
}

export default SignupForm;
