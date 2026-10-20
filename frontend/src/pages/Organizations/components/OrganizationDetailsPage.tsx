import { AddIcon, ChevronLeftIcon, DeleteIcon, EditIcon, ViewIcon } from '@chakra-ui/icons';
import {
  Avatar,
  Alert,
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Spinner,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tooltip,
  Tr,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import type { OrganizationLocation, User } from '../../../types';

type OrganizationDetailsPageProps = {
  organization: User;
  isLoading: boolean;
  onBack: () => void;
  onEdit: () => void;
  locations: OrganizationLocation[];
  onAddLocation: () => void;
  onViewLocation: (location: OrganizationLocation) => void;
  onEditLocation: (location: OrganizationLocation) => void;
  onDeleteLocation: (location: OrganizationLocation) => void;
  isLoadingLocations: boolean;
  locationsError: string;
};

function formatCreatedAt(value?: string) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function OrganizationDetailsPage({ organization, isLoading, onBack, onEdit, locations, onAddLocation, onViewLocation, onEditLocation, onDeleteLocation, isLoadingLocations, locationsError }: OrganizationDetailsPageProps) {
  const isActive = organization.status !== 'disabled';
  const organizationId = organization.id || organization._id;
  const informationDialog = useDisclosure();

  return (
    <Stack spacing={6}>
      <Button
        alignSelf="flex-start"
        h="36px"
        px={2}
        variant="ghost"
        fontSize="sm"
        color="slate.600"
        leftIcon={<ChevronLeftIcon />}
        _hover={{ bg: 'slate.100', color: 'slate.900' }}
        onClick={onBack}
      >
        Back to organizations
      </Button>

      <HStack justify="space-between" align="center" flexWrap="wrap" gap={4}>
        <HStack spacing={4} minW={0}>
          <Avatar size="lg" name={organization.organizationName} />
          <Box minW={0}>
            <Heading fontSize="26px" lineHeight="1.2" fontWeight="700" color="slate.900" noOfLines={2}>
              {organization.organizationName || 'Organization'}
            </Heading>
            <Text mt={1} fontSize="14px" color="slate.500">
              Account holder: {organization.name || 'Not available'}
            </Text>
          </Box>
        </HStack>
        <Button h="40px" fontSize="sm" leftIcon={<EditIcon />} colorScheme="brand" onClick={onEdit}>
          Edit organization
        </Button>
      </HStack>

      <Box bg="white" border="1px solid" borderColor="slate.200" borderRadius="8px" overflow="hidden">
        <Heading as="h2" fontSize="16px" fontWeight="700" color="slate.900" px={{ base: 4, md: 6 }} py={4} borderBottom="1px solid" borderColor="slate.100">
          Organization information
        </Heading>
        {isLoading ? (
          <HStack justify="center" py={8}><Spinner color="brand.500" /></HStack>
        ) : (
          <HStack justify="space-between" align="center" flexWrap="wrap" gap={5} p={{ base: 4, md: 6 }}>
            <SimpleGrid flex="1" minW="240px" columns={{ base: 1, sm: 3 }} spacingX={8} spacingY={4}>
              <Detail label="Organization name" value={organization.organizationName} />
              <Detail label="Account holder" value={organization.name} />
              <Box>
                <Text mb={1} fontSize="13px" fontWeight="600" color="slate.500">Account status</Text>
                <Badge px={3} py={1} borderRadius="full" color={isActive ? 'green.600' : 'slate.500'} bg={isActive ? 'green.50' : 'slate.100'} fontSize="xs" fontWeight="600">
                  {isActive ? 'ACTIVE' : 'INACTIVE'}
                </Badge>
              </Box>
            </SimpleGrid>
            <Button flexShrink={0} variant="outline" leftIcon={<ViewIcon />} onClick={informationDialog.onOpen}>
              View organization details
            </Button>
          </HStack>
        )}
      </Box>

      <Modal isOpen={informationDialog.isOpen} onClose={informationDialog.onClose} size="3xl" scrollBehavior="inside">
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(3px)" />
        <ModalContent borderRadius="8px">
          <ModalHeader color="slate.900">Organization information</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={10} spacingY={6}>
              <Detail label="Organization name" value={organization.organizationName} />
              <Detail label="Account holder" value={organization.name} />
              <Detail label="Login email" value={organization.email} />
              <Detail label="Phone number" value={organization.phone} />
              <Detail label="Industry" value={organization.industry} />
              <Detail label="Website" value={organization.website} />
              <Detail label="Address" value={organization.address} multiline />
              <Detail label="About the organization" value={organization.about} multiline />
              <Box>
                <Text mb={1} fontSize="13px" fontWeight="600" color="slate.500">Account status</Text>
                <Badge px={3} py={1} borderRadius="full" color={isActive ? 'green.600' : 'slate.500'} bg={isActive ? 'green.50' : 'slate.100'} fontSize="xs" fontWeight="600">
                  {isActive ? 'ACTIVE' : 'INACTIVE'}
                </Badge>
              </Box>
              <Detail label="Created" value={formatCreatedAt(organization.createdAt)} />
              <Detail label="Organization ID" value={organizationId} />
            </SimpleGrid>
          </ModalBody>
          <ModalFooter borderTop="1px solid" borderColor="slate.100" bg="slate.50">
            <Button variant="outline" onClick={informationDialog.onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Stack spacing={4}>
        <HStack justify="space-between" align="center" flexWrap="wrap" gap={4}>
          <Box>
            <Heading as="h2" size="md" color="slate.900">Locations</Heading>
            <Text mt={1} fontSize="sm" color="slate.500">Sites and offices for this organization</Text>
          </Box>
          <Button h="40px" px={4} fontSize="sm" leftIcon={<AddIcon />} colorScheme="brand" onClick={onAddLocation}>
            Add location
          </Button>
        </HStack>
        <Box bg="white" border="1px solid" borderColor="slate.200" borderRadius="8px" overflow="hidden">
          {locationsError ? <Alert status="error" borderRadius={0}>{locationsError}</Alert> : null}
          <TableContainer>
            <Table variant="simple" size="md" fontSize="sm">
              <Thead><Tr><Th fontSize="xs">Work name</Th><Th fontSize="xs">OP number</Th><Th fontSize="xs">Designation</Th><Th fontSize="xs">Address</Th><Th fontSize="xs">Status</Th><Th fontSize="xs" textAlign="right">Actions</Th></Tr></Thead>
              <Tbody>
                {isLoadingLocations ? (
                  <Tr><Td colSpan={6} textAlign="center" py={10}><Spinner color="brand.500" /></Td></Tr>
                ) : locations.length === 0 && !locationsError ? (
                  <Tr><Td colSpan={6} textAlign="center" py={10} color="slate.500">No locations yet. Add a location to get started.</Td></Tr>
                ) : locations.map((location) => (
                  <Tr key={location.id} _hover={{ bg: 'slate.50' }}>
                    <Td>{location.workName}</Td>
                    <Td>{location.opNumber || '—'}</Td>
                    <Td textTransform="capitalize">{location.designation}</Td>
                    <Td maxW="420px" whiteSpace="normal"><Button variant="link" color="brand.600" fontWeight="600" whiteSpace="normal" onClick={() => onViewLocation(location)}>{location.address || location.name}</Button></Td>
                    <Td><Badge px={3} py={1} borderRadius="full" color={location.status === 'active' ? 'green.600' : 'slate.500'} bg={location.status === 'active' ? 'green.50' : 'slate.100'} fontSize="xs">{location.status === 'active' ? 'ACTIVE' : 'INACTIVE'}</Badge></Td>
                    <Td textAlign="right">
                      <HStack justify="flex-end" spacing={1}>
                        <Tooltip label="Open location"><IconButton aria-label={`Open ${location.name}`} icon={<ViewIcon />} variant="ghost" color="slate.500" onClick={() => onViewLocation(location)} /></Tooltip>
                        <Tooltip label="Edit location"><IconButton aria-label={`Edit ${location.name}`} icon={<EditIcon />} variant="ghost" color="slate.500" onClick={() => onEditLocation(location)} /></Tooltip>
                        <Tooltip label="Delete location"><IconButton aria-label={`Delete ${location.name}`} icon={<DeleteIcon />} variant="ghost" color="red.600" onClick={() => onDeleteLocation(location)} /></Tooltip>
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </Box>
      </Stack>
    </Stack>
  );
}

function Detail({ label, value, multiline = false }: { label: string; value?: string; multiline?: boolean }) {
  return (
    <Box minW={0}>
      <Text mb={1} fontSize="13px" fontWeight="600" color="slate.500">{label}</Text>
      <Text maxW="100%" fontSize="16px" lineHeight="1.5" fontWeight="600" color="slate.900" overflowWrap="anywhere" wordBreak="break-all" whiteSpace={multiline ? 'pre-wrap' : undefined}>
        {value || 'Not available'}
      </Text>
    </Box>
  );
}

export default OrganizationDetailsPage;