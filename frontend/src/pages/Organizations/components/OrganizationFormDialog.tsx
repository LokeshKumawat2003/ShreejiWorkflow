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
import MasterDataSelect from '../../../components/ui/MasterDataSelect';
import { fieldLabelStyles, fieldStyles } from '../../../components/ui/fieldStyles';
import useMasterDataOptions from '../../../hooks/useMasterDataOptions';
import type { CreateOrganizationInput } from '../../../services/organizationService';
import type { OrganizationPost, User } from '../../../types';
import { isValidEmail, isValidPhone, normalizeWebsite } from '../../../utils/formValidation';
import OrganizationPostsEditor from './OrganizationPostsEditor';

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
  const [governmentType, setGovernmentType] = useState('');
  const [area, setArea] = useState('');
  const [status, setStatus] = useState<OrganizationStatus>('active');
  const [posts, setPosts] = useState<OrganizationPost[]>([]);
  const [formError, setFormError] = useState('');
  const { options: masterOptions, isLoading: isLoadingMasterData } = useMasterDataOptions(isOpen);

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
    setGovernmentType(organization?.governmentType || '');
    setArea(organization?.area || '');
    setStatus(organization?.status === 'disabled' ? 'disabled' : 'active');
    setPosts((organization?.posts || []).map((post) => ({ workName: post.workName, designations: [...post.designations] })));
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
    if ((!isEditing || password) && password.length < 8) {
      showError(isEditing ? 'The new password must be at least 8 characters.' : 'The temporary password must be at least 8 characters.');
      return;
    }
    if (!isValidPhone(phone)) {
      showError('Enter a valid phone number with at least 7 digits.');
      return;
    }
    const websiteUrl = normalizeWebsite(website);
    if (websiteUrl === null) {
      showError('Enter a valid website, for example example.com, or leave it blank.');
      return;
    }
    if (!governmentType) {
      showError('Select the government type. Employee salaries are calculated from it.');
      return;
    }
    if (!area) {
      showError(`Select the area under ${governmentType}. Employee salaries are calculated from it.`);
      return;
    }
    const emptyPost = posts.find((post) => post.designations.length === 0);
    if (emptyPost) {
      showError(`Select at least one designation for "${emptyPost.workName}", or untick it.`);
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
      governmentType,
      area,
      posts,
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
                  <FormControl isRequired={!isEditing}>
                    <FormLabel {...fieldLabelStyles}>{isEditing ? 'New password' : 'Temporary password'}</FormLabel>
                    <InputGroup>
                      <Input
                        h="44px"
                        {...fieldStyles}
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={128}
                        placeholder={isEditing ? 'Leave blank to keep the current password' : undefined}
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
                      {isEditing
                        ? 'Optional. At least 8 characters. The organization is signed out and must use the new password.'
                        : 'At least 8 characters. Share it with the organization securely.'}
                    </FormHelperText>
                  </FormControl>
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
                  <FormControl isRequired>
                    <FormLabel {...fieldLabelStyles}>Government type</FormLabel>
                    <MasterDataSelect
                      h="44px"
                      {...fieldStyles}
                      items={masterOptions.governmentType}
                      valueKey="name"
                      placeholder={isLoadingMasterData ? 'Loading…' : 'Select government type'}
                      value={governmentType}
                      onChange={setGovernmentType}
                    />
                    <FormHelperText fontSize="xs">State or Central wage schedule.</FormHelperText>
                  </FormControl>
                  {governmentType ? (
                    <FormControl isRequired>
                      <FormLabel {...fieldLabelStyles}>Area under {governmentType}</FormLabel>
                      <MasterDataSelect
                        h="44px"
                        {...fieldStyles}
                        items={masterOptions.area}
                        valueKey="name"
                        placeholder={isLoadingMasterData ? 'Loading…' : 'Select area'}
                        value={area}
                        onChange={setArea}
                      />
                      <FormHelperText fontSize="xs">Employees here get the skill category rate for {governmentType} in this area (Settings → Master data).</FormHelperText>
                    </FormControl>
                  ) : null}
                  <FormInput label="Phone number" type="tel" autoComplete="tel" maxLength={30} placeholder="+91 98765 43210" value={phone} onChange={(event) => setPhone(event.target.value)} />
                  <FormInput
                    label="Website (optional)"
                    inputMode="url"
                    autoComplete="url"
                    maxLength={200}
                    placeholder="example.com"
                    value={website}
                    helperText="Leave blank if the organization has no website. https:// is added automatically."
                    onChange={(event) => setWebsite(event.target.value)}
                  />
                </SimpleGrid>
                <Stack mt={4} spacing={4}>
                  <FormTextarea label="Address" rows={3} resize="vertical" maxLength={500} placeholder="Street, city, district, postal code" value={address} onChange={(event) => setAddress(event.target.value)} />
                  <FormTextarea label="About the organization" rows={3} resize="vertical" maxLength={1000} placeholder="A short description of the organization" value={about} onChange={(event) => setAbout(event.target.value)} />
                </Stack>
              </FormSection>

              <FormSection title="Posts" description="Work names this organization needs and the designations it hires under each. Employees are matched to these posts by designation.">
                <OrganizationPostsEditor
                  posts={posts}
                  workNames={masterOptions.workName}
                  isLoading={isLoadingMasterData}
                  onChange={setPosts}
                />
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
