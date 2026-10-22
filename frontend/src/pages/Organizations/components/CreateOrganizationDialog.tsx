import {
  FormControl,
  FormLabel,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Select,
  Textarea,
  Text,
} from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import ActionButton from '../../../components/ui/ActionButton';
import FormInput from '../../../components/ui/FormInput';
import type { CreateOrganizationInput } from '../../../services/organizationService';

type CreateOrganizationDialogProps = {
  isOpen: boolean;
  isCreating: boolean;
  onClose: () => void;
  onCreate: (input: CreateOrganizationInput) => Promise<boolean>;
};

function CreateOrganizationDialog({ isOpen, isCreating, onClose, onCreate }: CreateOrganizationDialogProps) {
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [about, setAbout] = useState('');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [status, setStatus] = useState<'active' | 'disabled'>('active');

  function resetFields() {
    setName('');
    setOrganizationName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setAddress('');
    setAbout('');
    setWebsite('');
    setIndustry('');
    setStatus('active');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onCreate({ name, organizationName, email, password, status, phone, address, about, website, industry })) {
      resetFields();
    }
  }

  function handleClose() {
    resetFields();
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="4xl"
      closeOnEsc={!isCreating}
      closeOnOverlayClick={!isCreating}
      scrollBehavior="inside"
    >
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(3px)" />
      <ModalContent borderRadius="xl" overflow="hidden" boxShadow="0 24px 64px rgba(15, 23, 42, 0.2)">
        <ModalHeader pb={1} pr={12} fontSize="xl" color="slate.900">Create organization</ModalHeader>
        <ModalCloseButton top={5} right={5} borderRadius="md" isDisabled={isCreating} />
        <ModalBody pt={0} pb={6}>
          <Text mb={5} fontSize="sm" color="slate.500">New organization account</Text>
          <form id="create-organization-form" onSubmit={handleSubmit}>
            <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={5}>
              <FormInput label="Account holder name" isRequired autoFocus autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
              <FormInput label="Organization name" isRequired autoComplete="organization" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} />
              <FormInput label="Login email" isRequired type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              <FormInput label="Temporary password" isRequired type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
              <FormInput label="Phone number" type="tel" autoComplete="tel" maxLength={30} pattern="\\+?[0-9(). -]{7,30}" placeholder="+1 555 123 4567" value={phone} onChange={(event) => setPhone(event.target.value)} />
              <FormInput label="Industry" maxLength={100} placeholder="Technology, retail, healthcare..." value={industry} onChange={(event) => setIndustry(event.target.value)} />
              <FormInput label="Website" type="url" autoComplete="url" maxLength={200} placeholder="https://example.com" value={website} onChange={(event) => setWebsite(event.target.value)} />
              <FormControl isRequired>
                <FormLabel mb={2} fontSize="sm" fontWeight="600" color="slate.700">Account status</FormLabel>
                <Select h="44px" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
                  <option value="active">Active</option>
                  <option value="disabled">Inactive</option>
                </Select>
              </FormControl>
            </SimpleGrid>
            <FormControl mt={5}>
              <FormLabel mb={2} fontSize="sm" fontWeight="600" color="slate.700">Address</FormLabel>
              <Textarea
                value={address}
                maxLength={500}
                minH="88px"
                resize="vertical"
                placeholder="Street, city, region, postal code, country"
                onChange={(event) => setAddress(event.target.value)}
              />
            </FormControl>
            <FormControl mt={5}>
              <FormLabel mb={2} fontSize="sm" fontWeight="600" color="slate.700">About the organization</FormLabel>
              <Textarea
                value={about}
                maxLength={1000}
                minH="110px"
                resize="vertical"
                placeholder="A short description of the organization"
                onChange={(event) => setAbout(event.target.value)}
              />
            </FormControl>
          </form>
        </ModalBody>
        <ModalFooter gap={3} px={6} py={4} borderTop="1px solid" borderColor="slate.100" bg="slate.50">
          <ActionButton tone="neutral" onClick={handleClose} isDisabled={isCreating}>Cancel</ActionButton>
          <ActionButton type="submit" form="create-organization-form" isLoading={isCreating}>Create</ActionButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default CreateOrganizationDialog;