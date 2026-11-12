import { ArrowBackIcon } from '@chakra-ui/icons';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  Stack,
  Text,
  useBreakpointValue,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { ListSkeleton } from '../../../components/ui/Skeletons';
import { ApiError } from '../../../services/api';
import { listOrganizationLocations } from '../../../services/locationService';
import { listOrganizations } from '../../../services/organizationService';
import type { OrganizationLocation, User } from '../../../types';

export type PostSelection = {
  organizationId: string;
  organizationName: string;
  governmentType: string;
  area: string;
  locationId: string;
  locationName: string;
  workName: string;
  location: OrganizationLocation | null;
};

type AssignPostDialogProps = {
  isOpen: boolean;
  designation: string;
  onClose: () => void;
  onSelect: (selection: PostSelection) => void;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function matchingWorkNames(organization: User, designation: string) {
  const normalized = designation.toLowerCase();
  return (organization.posts || [])
    .filter((post) => post.designations.some((item) => item.toLowerCase() === normalized))
    .map((post) => post.workName);
}

function AssignPostDialog({ isOpen, designation, onClose, onSelect }: AssignPostDialogProps) {
  const modalSize = useBreakpointValue({ base: 'full', md: '2xl', lg: '3xl' }) ?? '3xl';
  const [search, setSearch] = useState('');
  const [organizations, setOrganizations] = useState<User[]>([]);
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false);
  const [organizationError, setOrganizationError] = useState('');
  const [organization, setOrganization] = useState<User | null>(null);
  const [locations, setLocations] = useState<OrganizationLocation[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    setOrganization(null);
    setSelectedLocation('');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || organization) return undefined;
    const controller = new AbortController();
    setIsLoadingOrganizations(true);
    setOrganizationError('');
    void listOrganizations({
      search,
      status: 'active',
      sort: 'name-asc',
      page: 1,
      limit: 100,
      designation,
    }, controller.signal)
      .then((result) => setOrganizations(result.organizations))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setOrganizationError(errorMessage(error, 'Unable to load organizations.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingOrganizations(false);
      });
    return () => controller.abort();
  }, [designation, isOpen, organization, search]);

  useEffect(() => {
    const organizationId = organization?.id || organization?._id;
    if (!isOpen || !organizationId) return undefined;
    const controller = new AbortController();
    setIsLoadingLocations(true);
    setLocationError('');
    setLocations([]);
    void listOrganizationLocations(organizationId, { designation, status: 'active', limit: 100 }, controller.signal)
      .then((result) => {
        setLocations(result.locations);
        if (result.locations.length === 1) setSelectedLocation(result.locations[0].id);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLocationError(errorMessage(error, 'Unable to load locations.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingLocations(false);
      });
    return () => controller.abort();
  }, [designation, isOpen, organization]);

  const locationGroups = useMemo(() => {
    const groups = new Map<string, OrganizationLocation[]>();
    for (const location of locations) {
      const key = location.workName || 'Other';
      groups.set(key, [...(groups.get(key) || []), location]);
    }
    return [...groups.entries()].sort(([first], [second]) => first.localeCompare(second));
  }, [locations]);

  function chooseOrganization(item: User) {
    setOrganization(item);
    setSelectedLocation('');
  }

  function confirm() {
    const location = locations.find(({ id }) => id === selectedLocation);
    if (!organization || !location) return;
    onSelect({
      organizationId: organization.id || organization._id || '',
      organizationName: organization.organizationName || organization.name || '',
      governmentType: organization.governmentType || '',
      area: organization.area || '',
      locationId: location.id,
      locationName: location.name,
      workName: location.workName || '',
      location,
    });
    onClose();
  }

  const organizationWorkNames = organization ? matchingWorkNames(organization, designation) : [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size={modalSize} scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(3px)" />
      <ModalContent borderRadius={{ base: 0, md: 'xl' }} overflow="hidden" boxShadow="0 24px 64px rgba(15, 23, 42, 0.2)">
        <ModalHeader pb={1} pr={12}>
          <Text fontSize="xl" fontWeight="800" color="slate.900">Assign post</Text>
          <Text mt={0.5} fontSize="sm" fontWeight="400" color="slate.500">
            {organization
              ? `Choose a ${designation} location at ${organization.organizationName}.`
              : `Only organizations with a ${designation} location are listed.`}
          </Text>
        </ModalHeader>
        <ModalCloseButton top={5} right={5} borderRadius="md" />
        <ModalBody pt={3} pb={6} px={{ base: 4, md: 6 }}>
          {!organization ? (
            <Stack spacing={4}>
              <Input
                aria-label="Search organizations"
                placeholder="Search organizations"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {organizationError ? (
                <Alert status="error" borderRadius="md"><AlertIcon />{organizationError}</Alert>
              ) : isLoadingOrganizations ? (
                <ListSkeleton rows={4} rowHeight="56px" />
              ) : organizations.length === 0 ? (
                <Text py={3} fontSize="sm" color="slate.500">
                  {search
                    ? `No active organization with a ${designation} location matches this search.`
                    : `No active organization has a ${designation} location yet. Add a ${designation} location to an organization first.`}
                </Text>
              ) : (
                <Stack spacing={2}>
                  {organizations.map((item) => {
                    const workNames = matchingWorkNames(item, designation);
                    return (
                      <Box
                        as="button"
                        type="button"
                        key={item.id || item._id}
                        textAlign="left"
                        px={4}
                        py={3}
                        border="1px solid"
                        borderColor="slate.200"
                        borderRadius="md"
                        bg="white"
                        _hover={{ borderColor: 'brand.300', bg: 'brand.50' }}
                        onClick={() => chooseOrganization(item)}
                      >
                        <HStack spacing={2} flexWrap="wrap">
                          <Text fontSize="sm" fontWeight="600" color="slate.900">{item.organizationName}</Text>
                          <Badge colorScheme={item.governmentType && item.area ? 'purple' : 'orange'} variant="subtle" textTransform="none">
                            {item.governmentType && item.area ? `${item.governmentType} · ${item.area}` : 'Government type / area not set'}
                          </Badge>
                        </HStack>
                        <HStack mt={1} spacing={1.5} flexWrap="wrap">
                          {workNames.length > 0
                            ? workNames.map((workName) => <Badge key={workName} colorScheme="brand" textTransform="none">{workName}</Badge>)
                            : <Text fontSize="xs" color="slate.500">No post for {designation}</Text>}
                        </HStack>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Stack>
          ) : (
            <Stack spacing={4}>
              <HStack justify="space-between" flexWrap="wrap" gap={2}>
                <Box>
                  <Text fontSize="sm" fontWeight="700" color="slate.900">{organization.organizationName}</Text>
                  <HStack mt={1} spacing={1.5} flexWrap="wrap">
                    {organizationWorkNames.map((workName) => <Badge key={workName} colorScheme="brand" textTransform="none">{workName}</Badge>)}
                  </HStack>
                </Box>
                <Button size="sm" variant="ghost" leftIcon={<ArrowBackIcon />} onClick={() => setOrganization(null)}>
                  Change organization
                </Button>
              </HStack>
              {locationError ? (
                <Alert status="error" borderRadius="md"><AlertIcon />{locationError}</Alert>
              ) : isLoadingLocations ? (
                <ListSkeleton rows={3} rowHeight="48px" />
              ) : (
                <RadioGroup value={selectedLocation} onChange={setSelectedLocation}>
                  <Stack spacing={3}>
                    {locationGroups.map(([workName, items]) => (
                      <Box key={workName}>
                        <Text mb={2} fontSize="xs" fontWeight="700" color="slate.500" textTransform="uppercase" letterSpacing="0.04em">{workName}</Text>
                        <Stack spacing={2}>
                          {items.map((location) => (
                            <Box key={location.id} px={3} py={2.5} border="1px solid" borderColor={selectedLocation === location.id ? 'brand.300' : 'slate.200'} borderRadius="md" bg={selectedLocation === location.id ? 'brand.50' : 'white'}>
                              <Radio value={location.id} colorScheme="brand" w="100%">
                                <Text fontSize="sm" fontWeight="600" color="slate.900">{location.name}</Text>
                                {location.address || location.opNumber ? (
                                  <Text fontSize="xs" color="slate.500">{[location.opNumber && `OP ${location.opNumber}`, location.address].filter(Boolean).join(' · ')}</Text>
                                ) : null}
                              </Radio>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    ))}
                    {locations.length === 0 ? (
                      <Text fontSize="sm" color="slate.500">
                        This organization has no active {designation} location any more. Choose another organization.
                      </Text>
                    ) : null}
                  </Stack>
                </RadioGroup>
              )}
            </Stack>
          )}
        </ModalBody>
        <ModalFooter gap={3} px={{ base: 4, md: 6 }} py={4} borderTop="1px solid" borderColor="slate.100" bg="slate.50">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button colorScheme="brand" isDisabled={!organization || isLoadingLocations || Boolean(locationError) || !locations.some(({ id }) => id === selectedLocation)} onClick={confirm}>
            Assign post
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default AssignPostDialog;
