import { AddIcon, DeleteIcon, EditIcon, EmailIcon, PhoneIcon, ViewIcon } from '@chakra-ui/icons';
import { HStack, Stack, Text, useDisclosure } from '@chakra-ui/react';
import {
  ActionButton,
  BuildingIcon,
  ContentCard,
  DataTable,
  EntityCell,
  FilterBar,
  FilterField,
  FilterSelect,
  HeaderBreadcrumb,
  HeaderCard,
  HeaderDetail,
  headerButton,
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

function OrganizationDetailsPage({ organization, isLoading, onBack, onEdit, locationList, onAddLocation, onViewLocation, onEditLocation, onDeleteLocation }: OrganizationDetailsPageProps) {
  const isActive = organization.status !== 'disabled';
  const informationDialog = useDisclosure();
  const { summary, total: matchingTotal, isFiltered: isLocationFiltered, isLoading: isLoadingLocations, loadError: locationsError } = locationList;
  const hasLoadedSummary = summary.total > 0 || !isLoadingLocations;

  const locationColumns: DataTableColumn<OrganizationLocation>[] = [
    {
      key: 'work',
      header: 'Work name',
      render: (location) => (
        <EntityCell
          name={location.workName || location.name}
          subtitle={location.workName && location.workName !== location.name ? location.name : undefined}
        />
      ),
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
      render: (location) => (
        <HStack justify="flex-end" spacing={1.5}>
          <IconAction label={`Edit ${location.name}`} icon={<EditIcon />} onClick={() => onEditLocation(location)} />
          <IconAction label={`Delete ${location.name}`} icon={<DeleteIcon />} tone="danger" onClick={() => onDeleteLocation(location)} />
        </HStack>
      ),
    },
  ];

  return (
    <Stack spacing={5}>
      <HeaderBreadcrumb parent="Organizations" current={organization.organizationName || 'Organization'} onBack={onBack} />

      <HeaderCard
        name={organization.organizationName || 'Organization'}
        status={isActive ? 'active' : 'disabled'}
        subtitle={`${organization.industry ? `${organization.industry}  •  ` : ''}Managed by ${organization.name || 'Not available'}`}
        actions={(
          <>
            <ActionButton
              {...headerButton}
              tone="neutral"
              bg="white"
              color="slate.700"
              leftIcon={<ViewIcon boxSize={3.5} />}
              _hover={{ bg: 'slate.50', borderColor: 'slate.300', color: 'slate.900' }}
              onClick={informationDialog.onOpen}
            >
              Full details
            </ActionButton>
            <ActionButton {...headerButton} leftIcon={<EditIcon boxSize={3.5} />} onClick={onEdit}>
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

export default OrganizationDetailsPage;
