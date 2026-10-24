import { CheckCircleIcon, InfoOutlineIcon } from '@chakra-ui/icons';
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Skeleton,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { MapPinIcon } from '../../../components/ui';
import { fieldLabelStyles, fieldStyles } from '../../../components/ui/fieldStyles';
import { ApiError } from '../../../services/api';
import { listOrganizationLocations } from '../../../services/locationService';
import { listOrganizations } from '../../../services/organizationService';
import type { Employee, OrganizationLocation, User } from '../../../types';

type MoveEmployeeDialogProps = {
  isOpen: boolean;
  employee: Employee | null;
  currentOrganizationId: string;
  currentLocation: OrganizationLocation;
  isSaving: boolean;
  onClose: () => void;
  onMove: (organizationId: string, location: OrganizationLocation, organizationName: string) => void;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function organizationLabel(organization: User) {
  return organization.organizationName || organization.name || organization.email;
}

function MoveEmployeeDialog({
  isOpen,
  employee,
  currentOrganizationId,
  currentLocation,
  isSaving,
  onClose,
  onMove,
}: MoveEmployeeDialogProps) {
  const designation = (employee?.designation || currentLocation.designation || '').trim().toLowerCase();
  const [organizations, setOrganizations] = useState<User[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [locations, setLocations] = useState<OrganizationLocation[]>([]);
  const [locationId, setLocationId] = useState('');
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;
    const controller = new AbortController();
    setOrganizationId(currentOrganizationId);
    setLocationId('');
    setError('');
    setIsLoadingOrganizations(true);
    void listOrganizations({ search: '', status: 'active', sort: 'name-asc', page: 1, limit: 100 }, controller.signal)
      .then((result) => {
        const active = result.organizations.filter((organization) => organization.id);
        setOrganizations(active);
        if (!active.some((organization) => organization.id === currentOrganizationId)) setOrganizationId('');
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(caught, 'Unable to load organizations.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingOrganizations(false);
      });
    return () => controller.abort();
  }, [isOpen, currentOrganizationId]);

  useEffect(() => {
    if (!isOpen || !organizationId) {
      setLocations([]);
      return undefined;
    }
    const controller = new AbortController();
    setLocationId('');
    setIsLoadingLocations(true);
    void listOrganizationLocations(organizationId, { designation, status: 'active', limit: 100 }, controller.signal)
      .then((result) => setLocations(result.locations.filter((location) => location.id !== currentLocation.id)))
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(caught, 'Unable to load locations.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingLocations(false);
      });
    return () => controller.abort();
  }, [isOpen, organizationId, designation, currentLocation.id]);

  const selectedOrganization = organizations.find((organization) => organization.id === organizationId);
  const selectedLocation = locations.find((location) => location.id === locationId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" closeOnEsc={!isSaving} closeOnOverlayClick={!isSaving} scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(3px)" />
      <ModalContent borderRadius="xl" overflow="hidden">
        <ModalHeader pb={1} pr={12} fontSize="xl" color="slate.900">Move employee</ModalHeader>
        <ModalCloseButton top={5} right={5} borderRadius="md" isDisabled={isSaving} />
        <ModalBody pt={0} pb={6}>
          <Text mb={5} fontSize="sm" color="slate.500">
            Move <Text as="span" fontWeight="700" color="slate.800">{employee?.name}</Text> from{' '}
            <Text as="span" fontWeight="600" color="slate.700">{currentLocation.workName || currentLocation.name}</Text>.
            Only active locations with the designation{' '}
            <Text as="span" fontWeight="700" color="slate.800" textTransform="capitalize">{designation || '—'}</Text> are shown.
          </Text>

          <Stack spacing={5}>
            <FormControl isRequired>
              <FormLabel {...fieldLabelStyles}>Organization</FormLabel>
              {isLoadingOrganizations ? (
                <Skeleton h="44px" borderRadius="md" />
              ) : (
                <Select
                  aria-label="Organization to move to"
                  h="44px"
                  {...fieldStyles}
                  value={organizationId}
                  isDisabled={isSaving}
                  onChange={(event) => setOrganizationId(event.target.value)}
                >
                  <option value="" disabled>Choose an organization</option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organizationLabel(organization)}{organization.id === currentOrganizationId ? ' (current)' : ''}
                    </option>
                  ))}
                </Select>
              )}
            </FormControl>

            <FormControl isRequired>
              <FormLabel {...fieldLabelStyles} as="div">Location</FormLabel>
              {isLoadingLocations ? (
                <Stack spacing={2}>
                  {[0, 1].map((item) => <Skeleton key={item} h="58px" borderRadius="md" />)}
                </Stack>
              ) : !organizationId ? (
                <Text fontSize="sm" color="slate.500">Choose an organization first.</Text>
              ) : locations.length === 0 ? (
                <HStack p={3} spacing={3} bg="slate.50" border="1px dashed" borderColor="slate.200" borderRadius="md" color="slate.600">
                  <InfoOutlineIcon color="slate.400" />
                  <Text fontSize="sm">
                    {selectedOrganization ? organizationLabel(selectedOrganization) : 'This organization'} has no other active location for{' '}
                    <Text as="span" fontWeight="600" textTransform="capitalize">{designation}</Text>.
                  </Text>
                </HStack>
              ) : (
                <Stack spacing={2} role="radiogroup" aria-label="Location to move to">
                  {locations.map((location) => {
                    const isSelected = location.id === locationId;
                    return (
                      <Box
                        key={location.id}
                        as="button"
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        textAlign="left"
                        px={3}
                        py={2.5}
                        border="1px solid"
                        borderColor={isSelected ? 'brand.300' : 'slate.200'}
                        bg={isSelected ? 'brand.50' : 'white'}
                        borderRadius="md"
                        transition="all 0.15s ease"
                        _hover={{ borderColor: 'brand.300' }}
                        disabled={isSaving}
                        onClick={() => setLocationId(location.id)}
                      >
                        <HStack spacing={3}>
                          <Box display="grid" placeItems="center" flexShrink={0} w="34px" h="34px" borderRadius="8px" bg={isSelected ? 'brand.100' : 'slate.100'} color={isSelected ? 'brand.600' : 'slate.500'}>
                            {isSelected ? <CheckCircleIcon boxSize={4} /> : <MapPinIcon boxSize={4} />}
                          </Box>
                          <Box minW={0}>
                            <Text fontSize="sm" fontWeight="600" color="slate.900" noOfLines={1}>{location.workName || location.name}</Text>
                            <Text fontSize="xs" color="slate.500" noOfLines={1}>
                              {[location.name !== location.workName ? location.name : '', location.opNumber ? `OP ${location.opNumber}` : ''].filter(Boolean).join(' · ') || location.address || '—'}
                            </Text>
                          </Box>
                        </HStack>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </FormControl>

            {organizationId && organizationId !== currentOrganizationId ? (
              <Alert status="info" borderRadius="md" fontSize="sm">
                <AlertIcon />
                The employee will also move to this organization. Attendance already saved is kept.
              </Alert>
            ) : null}
            {error ? <Alert status="error" borderRadius="md" fontSize="sm">{error}</Alert> : null}
          </Stack>
        </ModalBody>
        <ModalFooter gap={3} px={6} py={4} borderTop="1px solid" borderColor="slate.100" bg="slate.50">
          <Button variant="outline" onClick={onClose} isDisabled={isSaving}>Cancel</Button>
          <Button
            colorScheme="brand"
            isLoading={isSaving}
            isDisabled={!selectedLocation}
            onClick={() => selectedLocation && onMove(organizationId, selectedLocation, selectedOrganization ? organizationLabel(selectedOrganization) : '')}
          >
            Move employee
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default MoveEmployeeDialog;
