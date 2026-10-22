import { AddIcon, ChevronLeftIcon, DeleteIcon, EditIcon, EmailIcon, PhoneIcon, ViewIcon } from '@chakra-ui/icons';
import {
  Avatar,
  Box,
  Button,
  Heading,
  HStack,
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
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import type { ReactNode } from 'react';
import {
  ActionButton,
  BuildingIcon,
  ContentCard,
  DataTable,
  EntityCell,
  FilterBar,
  FilterField,
  FilterSelect,
  IconAction,
  MapPinIcon,
  PeopleIcon,
  SearchInput,
  StatusBadge,
  TableFooter,
  type DataTableColumn,
} from '../../../components/ui';
import type { OrganizationLocation, User } from '../../../types';
import type { LocationStatusFilter, useLocations } from '../hooks/useLocations';

type OrganizationDetailsPageProps = {
  organization: User;
  isLoading: boolean;
  onBack: () => void;
  onEdit: () => void;
  locationList: ReturnType<typeof useLocations>;
  onAddLocation: () => void;
  onViewLocation: (location: OrganizationLocation) => void;
  onEditLocation: (location: OrganizationLocation) => void;
  onDeleteLocation: (location: OrganizationLocation) => void;
};

function formatCreatedAt(value?: string) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function OrganizationDetailsPage({ organization, isLoading, onBack, onEdit, locationList, onAddLocation, onViewLocation, onEditLocation, onDeleteLocation }: OrganizationDetailsPageProps) {
  const isActive = organization.status !== 'disabled';
  const organizationId = organization.id || organization._id;
  const informationDialog = useDisclosure();
  const { summary, total: matchingTotal, isFiltered: isLocationFiltered, isLoading: isLoadingLocations, loadError: locationsError } = locationList;
  const hasLoadedSummary = summary.total > 0 || !isLoadingLocations;

  const locationColumns: DataTableColumn<OrganizationLocation>[] = [
    {
      key: 'work',
      header: 'Work name',
      render: (location) => <EntityCell name={location.workName || location.name} subtitle={location.opNumber ? `OP ${location.opNumber}` : 'No OP number'} />,
    },
    {
      key: 'designation',
      header: 'Designation',
      render: (location) => <Text color="slate.700" textTransform="capitalize">{location.designation}</Text>,
    },
    {
      key: 'address',
      header: 'Address',
      hideBelow: 'md',
      render: (location) => (
        <Text color="slate.600" maxW="380px" noOfLines={2}>
          {location.address || location.name}
        </Text>
      ),
    },
    { key: 'status', header: 'Status', render: (location) => <StatusBadge status={location.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (location) => (
        <HStack justify="flex-end" spacing={1.5}>
          <IconAction label={`Edit ${location.name}`} icon={<EditIcon />} onClick={() => onEditLocation(location)} />
          <IconAction label={`Delete ${location.name}`} icon={<DeleteIcon />} tone="danger" onClick={() => onDeleteLocation(location)} />
        </HStack>
      ),
    },
  ];

  return (
    <Stack spacing={6}>
      <Button
        alignSelf="flex-start"
        h="34px"
        px={3}
        variant="ghost"
        borderRadius="full"
        fontSize="sm"
        fontWeight="600"
        color="slate.600"
        leftIcon={<ChevronLeftIcon boxSize={4} />}
        _hover={{ bg: 'white', color: 'slate.900', boxShadow: 'sm' }}
        onClick={onBack}
      >
        Back to organizations
      </Button>

      <Box bg="white" border="1px solid" borderColor="slate.200" borderRadius="lg" boxShadow="sm" overflow="hidden">
        <Box
          position="relative"
          h={{ base: '84px', md: '104px' }}
          bgGradient="linear(120deg, brand.600 0%, brand.500 45%, purple.400 100%)"
          overflow="hidden"
        >
          <Box position="absolute" top="-60px" right="-30px" w="220px" h="220px" borderRadius="full" bg="whiteAlpha.200" />
          <Box position="absolute" bottom="-90px" right="180px" w="180px" h="180px" borderRadius="full" bg="whiteAlpha.100" />
          <Box position="absolute" top="-40px" left="35%" w="120px" h="120px" borderRadius="full" bg="whiteAlpha.100" />
        </Box>

        <Box position="relative" px={{ base: 4, md: 6 }} pb={{ base: 5, md: 6 }}>
          <Stack
            direction={{ base: 'column', md: 'row' }}
            justify="space-between"
            align={{ base: 'flex-start', md: 'flex-end' }}
            spacing={4}
          >
            <Box minW={0}>
              <Avatar
                mt={{ base: '-36px', md: '-44px' }}
                boxSize={{ base: '72px', md: '88px' }}
                fontSize={{ base: '2xl', md: '3xl' }}
                name={organization.organizationName}
                bg="brand.50"
                color="brand.700"
                border="4px solid white"
                boxShadow="md"
              />
              <HStack mt={3} spacing={3} flexWrap="wrap">
                <Heading fontSize={{ base: '20px', md: '24px' }} lineHeight="1.25" fontWeight="800" color="slate.900" noOfLines={2}>
                  {organization.organizationName || 'Organization'}
                </Heading>
                <StatusBadge status={isActive ? 'active' : 'disabled'} />
              </HStack>
              <Text mt={1} fontSize="sm" color="slate.500" noOfLines={1}>
                {[organization.industry, `Managed by ${organization.name || 'Not available'}`].filter(Boolean).join(' · ')}
              </Text>
            </Box>

            <HStack spacing={2} flexShrink={0}>
              <Button
                h="40px"
                px={4}
                variant="outline"
                borderRadius="full"
                fontSize="sm"
                bg="white"
                borderColor="slate.200"
                color="slate.700"
                leftIcon={<ViewIcon />}
                _hover={{ bg: 'slate.50', borderColor: 'slate.300' }}
                onClick={informationDialog.onOpen}
              >
                Full details
              </Button>
              <ActionButton borderRadius="full" leftIcon={<EditIcon />} onClick={onEdit}>
                Edit organization
              </ActionButton>
            </HStack>
          </Stack>

          {isLoading ? (
            <HStack justify="center" pt={8} pb={2}><Spinner color="brand.500" /></HStack>
          ) : (
            <SimpleGrid mt={6} columns={{ base: 1, sm: 2, xl: 4 }} spacing={3}>
              <InfoTile icon={<PeopleIcon boxSize={4} />} color="brand" label="Account holder" value={organization.name} />
              <InfoTile icon={<EmailIcon boxSize={4} />} color="blue" label="Login email" value={organization.email} />
              <InfoTile icon={<PhoneIcon boxSize={3.5} />} color="green" label="Phone" value={organization.phone} />
              <InfoTile
                icon={<MapPinIcon boxSize={4} />}
                color="orange"
                label="Locations"
                value={!hasLoadedSummary
                  ? 'Loading…'
                  : `${summary.total} ${summary.total === 1 ? 'site' : 'sites'} · ${summary.active} active`}
              />
            </SimpleGrid>
          )}
        </Box>
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
                <StatusBadge status={isActive ? 'active' : 'disabled'} />
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

      <ContentCard
        noPadding
        icon={<BuildingIcon boxSize={5} />}
        title="Locations"
        subtitle={!hasLoadedSummary
          ? 'Loading locations…'
          : isLocationFiltered
            ? `${matchingTotal} of ${summary.total} locations match your filters`
            : `${summary.total} ${summary.total === 1 ? 'site' : 'sites'} for this organization`}
        actions={(
          <ActionButton size="sm" leftIcon={<AddIcon boxSize={2.5} />} onClick={onAddLocation}>
            Add location
          </ActionButton>
        )}
        toolbar={(
          <FilterBar
            variant="inset"
            canClear={isLocationFiltered}
            onClear={locationList.clearFilters}
          >
            <FilterField label="Search" flex={{ base: '1 1 100%', md: '1 1 260px' }} maxW={{ md: '420px' }}>
              <SearchInput value={locationList.search} onChange={locationList.setSearch} placeholder="Work name, OP number or address..." label="Search locations" />
            </FilterField>
            <FilterField label="Designation">
              <FilterSelect
                label="Filter locations by designation"
                value={locationList.designation}
                onChange={locationList.setDesignation}
                options={[{ value: 'all', label: 'All designations' }, ...locationList.designations.map((value) => ({ value, label: value }))]}
                textTransform="capitalize"
              />
            </FilterField>
            <FilterField label="Status">
              <FilterSelect<LocationStatusFilter>
                label="Filter locations by status"
                value={locationList.status}
                onChange={locationList.setStatus}
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'active', label: 'Active' },
                  { value: 'disabled', label: 'Inactive' },
                ]}
              />
            </FilterField>
          </FilterBar>
        )}
      >
        <DataTable
          columns={locationColumns}
          rows={locationList.locations}
          rowKey={(location) => location.id}
          onRowClick={onViewLocation}
          footer={matchingTotal > 0 && !locationsError ? (
            <TableFooter
              page={locationList.page}
              pageSize={locationList.pageSize}
              total={matchingTotal}
              totalPages={locationList.totalPages}
              noun={matchingTotal === 1 ? 'location' : 'locations'}
              isDisabled={isLoadingLocations}
              onPageChange={locationList.setPage}
            />
          ) : undefined}
          isLoading={isLoadingLocations}
          error={locationsError}
          emptyTitle={isLocationFiltered ? 'No matching locations' : 'No locations yet'}
          emptyDescription={isLocationFiltered ? 'Try a different search or filter.' : 'Add a location to get started.'}
        />
      </ContentCard>
    </Stack>
  );
}

function InfoTile({ icon, color, label, value }: { icon: ReactNode; color: string; label: string; value?: string }) {
  return (
    <HStack
      spacing={3}
      p={3}
      minW={0}
      bg="slate.50"
      border="1px solid"
      borderColor="slate.100"
      borderRadius="md"
      transition="all 0.15s ease"
      _hover={{ bg: 'white', borderColor: 'slate.200', boxShadow: 'sm' }}
    >
      <Box
        display="grid"
        placeItems="center"
        flexShrink={0}
        w="38px"
        h="38px"
        borderRadius="10px"
        bg={`${color}.100`}
        color={`${color}.600`}
      >
        {icon}
      </Box>
      <Box minW={0}>
        <Text fontSize="11px" fontWeight="700" letterSpacing="0.06em" textTransform="uppercase" color="slate.400">
          {label}
        </Text>
        <Text fontSize="sm" fontWeight="600" color={value ? 'slate.900' : 'slate.400'} noOfLines={1} title={value}>
          {value || 'Not available'}
        </Text>
      </Box>
    </HStack>
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