import { InfoOutlineIcon, ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import {
  Alert,
  AlertIcon,
  HStack,
  IconButton,
  InputGroup,
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Stack,
  Text,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
} from '@chakra-ui/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ActionButton, FormInput, FormSection, FormSelect, FormTextarea } from '../../../components/ui';
import { fieldLabelStyles, fieldStyles } from '../../../components/ui/fieldStyles';
import type { CreateOrganizationInput } from '../../../services/organizationService';
import type { User } from '../../../types';
import { isValidEmail, isValidPhone, normalizeWebsite } from '../../../utils/formValidation';

type OrganizationStatus = 'active' | 'disabled';

type OrganizationFormDialogProps = {
  isOpen: boolean;
  isSaving: boolean;
  organization: User | null;
  onClose: () => void;
  onSubmit: (input: CreateOrganizationInput) => Promise<boolean>;
};

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active: can sign in' },
  { value: 'disabled', label: 'Inactive: sign-in blocked' },
];

function OrganizationFormDialog({ isOpen, isSaving, organization, onClose, onSubmit }: OrganizationFormDialogProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const isEditing = organization !== null;
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [about, setAbout] = useState('');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [status, setStatus] = useState<OrganizationStatus>('active');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setName(organization?.name || '');
    setOrganizationName(organization?.organizationName || '');
    setEmail(organization?.email || '');
    setPassword('');
    setShowPassword(false);
    setPhone(organization?.phone || '');
    setAddress(organization?.address || '');
    setAbout(organization?.about || '');
    setWebsite(organization?.website || '');
    setIndustry(organization?.industry || '');
    setStatus(organization?.status === 'disabled' ? 'disabled' : 'active');
    setFormError('');
  }, [isOpen, organization]);

  function showError(message: string) {
    setFormError(message);
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !organizationName.trim() || !email.trim()) {
      showError('Account holder, organization name and login email are required.');
      return;
    }
    if (!isValidEmail(email)) {
      showError('Enter a valid login email address.');
      return;
    }
    if (!isEditing && password.length < 8) {
      showError('The temporary password must be at least 8 characters.');
      return;
    }
    if (!isValidPhone(phone)) {
      showError('Enter a valid phone number with at least 7 digits.');
      return;
    }
    const websiteUrl = normalizeWebsite(website);
    if (websiteUrl === null) {
      showError('Enter a valid website, for example example.com.');
      return;
    }
    setFormError('');
    if (websiteUrl !== website) setWebsite(websiteUrl);

    await onSubmit({
      name: name.trim(),
      organizationName: organizationName.trim(),
      email: email.trim(),
      password,
      status,
      phone: phone.trim(),
      address: address.trim(),
      about: about.trim(),
      website: websiteUrl,
      industry: industry.trim(),
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" closeOnEsc={!isSaving} closeOnOverlayClick={!isSaving} scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(3px)" />
      <ModalContent borderRadius="xl" overflow="hidden" boxShadow="0 24px 64px rgba(15, 23, 42, 0.2)">
        <ModalHeader pb={3} pr={12} borderBottom="1px solid" borderColor="slate.100">
          <Text fontSize="xl" fontWeight="800" color="slate.900">{isEditing ? 'Edit organization' : 'Create organization'}</Text>
          <Text mt={0.5} fontSize="sm" fontWeight="400" color="slate.500">
            {isEditing ? 'Update the organization account. Fields marked * are required.' : 'Set up a new organization account. Fields marked * are required.'}
          </Text>
        </ModalHeader>
        <ModalCloseButton top={5} right={5} borderRadius="md" isDisabled={isSaving} />
        <ModalBody ref={bodyRef} py={5} bg="slate.50">
          <form id="organization-form" onSubmit={(event) => void handleSubmit(event)}>
            <Stack spacing={5}>
              {formError ? (
                <Alert status="error" borderRadius="md">
                  <AlertIcon />
                  {formError}
                </Alert>
              ) : null}

              <FormSection title="Login account" description="The person who signs in for this organization.">
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormInput label="Account holder name" isRequired autoFocus autoComplete="name" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
                  <FormInput label="Login email" isRequired type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
                  {isEditing ? null : (
                    <FormControl isRequired>
                      <FormLabel {...fieldLabelStyles}>Temporary password</FormLabel>
                      <InputGroup>
                        <Input
                          h="44px"
                          {...fieldStyles}
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          minLength={8}
                          maxLength={128}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                        />
                        <InputRightElement h="44px">
                          <IconButton
                            size="sm"
                            variant="ghost"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                            onClick={() => setShowPassword((current) => !current)}
                          />
                        </InputRightElement>
                      </InputGroup>
                      <FormHelperText fontSize="xs" color={password && password.length < 8 ? 'red.500' : 'slate.500'}>
                        At least 8 characters. Share it with the organization securely.
                      </FormHelperText>
                    </FormControl>
                  )}
                  <FormSelect
                    label="Account status"
                    isRequired
                    value={status}
                    onChange={(event) => setStatus(event.target.value as OrganizationStatus)}
                    options={STATUS_OPTIONS}
                  />
                </SimpleGrid>
              </FormSection>

              <FormSection title="Organization profile" description="Shown on the organization page, salary slips and appointment letters.">
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormInput label="Organization name" isRequired autoComplete="organization" maxLength={120} value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} />
                  <FormInput label="Industry" maxLength={100} placeholder="Hospitality, facility services..." value={industry} onChange={(event) => setIndustry(event.target.value)} />
                  <FormInput label="Phone number" type="tel" autoComplete="tel" maxLength={30} placeholder="+91 98765 43210" value={phone} onChange={(event) => setPhone(event.target.value)} />
                  <FormInput
                    label="Website"
                    inputMode="url"
                    autoComplete="url"
                    maxLength={200}
                    placeholder="example.com"
                    value={website}
                    helperText="https:// is added automatically."
                    onChange={(event) => setWebsite(event.target.value)}
                  />
                </SimpleGrid>
                <Stack mt={4} spacing={4}>
                  <FormTextarea label="Address" rows={3} resize="vertical" maxLength={500} placeholder="Street, city, district, postal code" value={address} onChange={(event) => setAddress(event.target.value)} />
                  <FormTextarea label="About the organization" rows={3} resize="vertical" maxLength={1000} placeholder="A short description of the organization" value={about} onChange={(event) => setAbout(event.target.value)} />
                </Stack>
              </FormSection>
            </Stack>
          </form>
        </ModalBody>
        <ModalFooter gap={3} px={6} py={4} borderTop="1px solid" borderColor="slate.100" bg="white" justifyContent="space-between">
          <HStack spacing={2} fontSize="xs" color="slate.500" display={{ base: 'none', md: 'flex' }}>
            <InfoOutlineIcon />
            <Text>{isEditing ? 'Changes apply as soon as you save.' : 'The organization signs in with the login email.'}</Text>
          </HStack>
          <HStack spacing={3}>
            <ActionButton tone="neutral" onClick={onClose} isDisabled={isSaving}>Cancel</ActionButton>
            <ActionButton type="submit" form="organization-form" isLoading={isSaving}>
              {isEditing ? 'Save changes' : 'Create organization'}
            </ActionButton>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default OrganizationFormDialog;
