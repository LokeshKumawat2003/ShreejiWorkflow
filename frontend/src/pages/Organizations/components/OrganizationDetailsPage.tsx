import { AddIcon, DeleteIcon, EditIcon, EmailIcon, PhoneIcon, ViewIcon } from '@chakra-ui/icons';
import { Box, Button, Flex, HStack, SimpleGrid, Skeleton, Stack, Text, useDisclosure } from '@chakra-ui/react';
import { useState, type ReactNode } from 'react';
import {
  ActionButton,
  ContentCard,
  DataTable,
  EntityCell,
  FilterBar,
  FilterField,
  FilterSelect,
  FolderIcon,
  HeaderBreadcrumb,
  HeaderCard,
  HeaderDetail,
  headerButton,
  IconAction,
  MapPinIcon,
  PeopleIcon,
  SearchInput,
  SiteArt,
  StatusBadge,
  TableFooter,
  ViewToggle,
  type DataTableColumn,
  type TableView,
} from '../../../components/ui';
import type { OrganizationLocation, User } from '../../../types';
import type { LocationStatusFilter, useLocations } from '../hooks/useLocations';
import OrganizationInfoDialog from './OrganizationInfoDialog';

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

function locationTitle(location: OrganizationLocation) {
  return location.workName || location.name;
}

function locationSubtitle(location: OrganizationLocation) {
  return location.workName && location.workName !== location.name ? location.name : undefined;
}

function OrganizationDetailsPage({ organization, isLoading, onBack, onEdit, locationList, onAddLocation, onViewLocation, onEditLocation, onDeleteLocation }: OrganizationDetailsPageProps) {
  const isActive = organization.status !== 'disabled';
  const informationDialog = useDisclosure();
  const { summary, total: matchingTotal, isFiltered: isLocationFiltered, isLoading: isLoadingLocations, loadError: locationsError } = locationList;
  const hasLoadedSummary = summary.total > 0 || !isLoadingLocations;
  const [view, setView] = useState<TableView>('list');

  const locationColumns: DataTableColumn<OrganizationLocation>[] = [
    {
      key: 'work',
      header: 'Work name',
      render: (location) => <EntityCell shape="circle" name={locationTitle(location)} subtitle={locationSubtitle(location)} />,
    },
    {
      key: 'designation',
      header: 'Designation',
      render: (location) => <Text color="slate.700" textTransform="capitalize">{location.designation}</Text>,
    },
    {
      key: 'po',
      header: 'PO number',
      hideBelow: 'md',
      render: (location) => (location.opNumber
        ? <Text color="slate.800" fontWeight="500" fontFamily="mono" whiteSpace="nowrap">{location.opNumber}</Text>
        : <Text color="slate.400">Not added</Text>),
    },
    { key: 'status', header: 'Status', render: (location) => <StatusBadge status={location.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (location) => rowActions(location),
    },
  ];

  function rowActions(location: OrganizationLocation) {
    return (
      <HStack justify="flex-end" spacing={2}>
        <IconAction label={`Edit ${location.name}`} icon={<EditIcon />} tone="primary" w="34px" minW="34px" h="34px" onClick={(event) => { event.stopPropagation(); onEditLocation(location); }} />
        <IconAction label={`Delete ${location.name}`} icon={<DeleteIcon />} tone="danger" w="34px" minW="34px" h="34px" onClick={(event) => { event.stopPropagation(); onDeleteLocation(location); }} />
      </HStack>
    );
  }

  const emptyTitle = isLocationFiltered ? 'No matching locations' : 'No locations yet';
  const emptyDescription = isLocationFiltered ? 'Try a different search or filter.' : 'Add a location to get started.';
  const footer = matchingTotal > 0 && !locationsError ? (
    <TableFooter
      page={locationList.page}
      pageSize={locationList.pageSize}
      total={matchingTotal}
      totalPages={locationList.totalPages}
      noun={matchingTotal === 1 ? 'location' : 'locations'}
      isDisabled={isLoadingLocations}
      onPageChange={locationList.setPage}
    />
  ) : undefined;

  let gridBody: ReactNode = null;
  if (view === 'grid') {
    if (locationsError) {
      gridBody = <Text px={5} py={8} color="red.600" fontSize="sm">{locationsError}</Text>;
    } else if (isLoadingLocations && locationList.locations.length === 0) {
      gridBody = (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4} p={{ base: 4, md: 5 }}>
          {[0, 1, 2].map((index) => <Skeleton key={index} h="150px" borderRadius="14px" />)}
        </SimpleGrid>
      );
    } else if (locationList.locations.length === 0) {
      gridBody = (
        <Box px={5} py={10} textAlign="center">
          <Text fontWeight="600" color="slate.800">{emptyTitle}</Text>
          <Text mt={1} fontSize="sm" color="slate.500">{emptyDescription}</Text>
        </Box>
      );
    } else {
      gridBody = (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4} p={{ base: 4, md: 5 }} opacity={isLoadingLocations ? 0.6 : 1}>
          {locationList.locations.map((location) => (
            <Box
              key={location.id}
              role="button"
              tabIndex={0}
              p={4}
              bg="white"
              border="1px solid"
              borderColor="slate.200"
              borderRadius="14px"
              cursor="pointer"
              transition="box-shadow 0.15s, border-color 0.15s"
              _hover={{ borderColor: 'brand.200', boxShadow: '0 6px 16px rgba(15, 23, 42, 0.07)' }}
              onClick={() => onViewLocation(location)}
              onKeyDown={(event) => { if (event.key === 'Enter') onViewLocation(location); }}
            >
              <EntityCell shape="circle" minW="0" name={locationTitle(location)} subtitle={locationSubtitle(location)} />
              <Flex mt={4} pt={3} borderTop="1px solid" borderColor="slate.100" justify="space-between" align="center" gap={3}>
                <Box minW={0}>
                  <Text fontSize="xs" color="slate.500">Designation · PO number</Text>
                  <Text fontSize="sm" fontWeight="600" color="slate.800" noOfLines={1} textTransform="capitalize">
                    {location.designation || '—'}
                    <Text as="span" color={location.opNumber ? 'slate.800' : 'slate.400'} fontFamily={location.opNumber ? 'mono' : undefined} textTransform="none">
                      {'  ·  '}{location.opNumber || 'No PO'}
                    </Text>
                  </Text>
                </Box>
                <StatusBadge status={location.status} />
              </Flex>
              <Box mt={3}>{rowActions(location)}</Box>
            </Box>
          ))}
        </SimpleGrid>
      );
    }
  }

  return (
    <Stack spacing={5}>
      <HeaderBreadcrumb parent="Organizations" current={organization.organizationName || 'Organization'} onBack={onBack} />

      <HeaderCard
        name={organization.organizationName || 'Organization'}
        status={isActive ? 'active' : 'disabled'}
        subtitle={`${organization.industry ? `${organization.industry}  •  ` : ''}Managed by ${organization.name || 'Not available'}`}
        art={<SiteArt width={260} />}
        actions={(
          <>
            <ActionButton
              {...headerButton}
              h="40px"
              px={4}
              tone="neutral"
              bg="white"
              color="slate.800"
              borderColor="slate.200"
              boxShadow="0 1px 3px rgba(15, 23, 42, 0.06)"
              leftIcon={<ViewIcon boxSize={4} />}
              _hover={{ bg: 'slate.50', borderColor: 'slate.300', color: 'slate.900' }}
              onClick={informationDialog.onOpen}
            >
              Full details
            </ActionButton>
            <ActionButton {...headerButton} h="40px" px={4} boxShadow="0 4px 12px rgba(91, 74, 230, 0.25)" leftIcon={<EditIcon boxSize={3.5} />} onClick={onEdit}>
              Edit organization
            </ActionButton>
          </>
        )}
        details={(
          <>
            <HeaderDetail isLoading={isLoading} icon={<PeopleIcon boxSize={3.5} />} label="Account holder" value={organization.name} />
            <HeaderDetail isLoading={isLoading} icon={<EmailIcon boxSize={3} />} label="Login email" value={organization.email} />
            <HeaderDetail isLoading={isLoading} icon={<PhoneIcon boxSize={3} />} label="Phone" value={organization.phone} />
            <HeaderDetail
              isLoading={isLoading || !hasLoadedSummary}
              icon={<MapPinIcon boxSize={3.5} />}
              label="Locations"
              value={`${summary.total} ${summary.total === 1 ? 'site' : 'sites'}  •  ${summary.active} active`}
            />
          </>
        )}
      />

      <OrganizationInfoDialog isOpen={informationDialog.isOpen} organization={organization} onClose={informationDialog.onClose} onEdit={onEdit} />

      <ContentCard
        noPadding
        icon={<FolderIcon boxSize={5} />}
        title="Locations"
        subtitle={!hasLoadedSummary
          ? 'Loading locations…'
          : isLocationFiltered
            ? `${matchingTotal} of ${summary.total} locations match your filters`
            : `${summary.total} ${summary.total === 1 ? 'site' : 'sites'} for this organization`}
        actions={(
          <HStack spacing={2.5}>
            <ViewToggle value={view} onChange={setView} />
            <Button
              h="36px"
              px={4}
              fontSize="sm"
              fontWeight="600"
              color="white"
              bgGradient="linear(to-r, brand.500, brand.600)"
              boxShadow="0 6px 16px rgba(79, 70, 229, 0.3)"
              leftIcon={<AddIcon boxSize={2.5} />}
              _hover={{ bgGradient: 'linear(to-r, brand.600, brand.700)' }}
              _active={{ bgGradient: 'linear(to-r, brand.600, brand.700)' }}
              onClick={onAddLocation}
            >
              Add location
            </Button>
          </HStack>
        )}
        toolbar={(
          <FilterBar
            variant="inset"
            canClear={isLocationFiltered}
            onClear={locationList.clearFilters}
          >
            <FilterField label="Search" flex={{ base: '1 1 100%', md: '1 1 260px' }} maxW={{ md: '420px' }}>
              <SearchInput value={locationList.search} onChange={locationList.setSearch} placeholder="Work name, PO number or address..." label="Search locations" />
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
        {view === 'grid' ? (
          <>
            {gridBody}
            {footer}
          </>
        ) : (
          <DataTable
            columns={locationColumns}
            rows={locationList.locations}
            rowKey={(location) => location.id}
            onRowClick={onViewLocation}
            footer={footer}
            isLoading={isLoadingLocations}
            error={locationsError}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
          />
        )}
      </ContentCard>
    </Stack>
  );
}

export default OrganizationDetailsPage;
