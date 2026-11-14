import { DeleteIcon, EditIcon } from '@chakra-ui/icons';
import { Box, Flex, HStack, SimpleGrid, Skeleton, Text } from '@chakra-ui/react';
import { useState, type ReactNode } from 'react';
import {
  ContentCard,
  DataTable,
  EntityCell,
  FilterBar,
  FilterField,
  FilterSelect,
  FolderIcon,
  IconAction,
  SearchInput,
  StatusBadge,
  TableFooter,
  ViewToggle,
  type DataTableColumn,
  type TableView,
} from '../../../components/ui';
import type { User } from '../../../types';

type StatusFilter = 'all' | 'active' | 'disabled';
type SortOrder = 'name-asc' | 'name-desc' | 'newest' | 'oldest';

type OrganizationTableProps = {
  organizations: User[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  search: string;
  isLoading: boolean;
  loadError: string;
  statusFilter: StatusFilter;
  sortOrder: SortOrder;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: StatusFilter) => void;
  onSortChange: (value: SortOrder) => void;
  onPageChange: (value: number) => void;
  onView: (organization: User) => void;
  onEdit: (organization: User) => void;
  onDelete: (organization: User) => void;
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Inactive' },
];

const SORT_OPTIONS = [
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
];

function OrganizationTable({
  organizations,
  page,
  pageSize,
  total,
  totalPages,
  search,
  isLoading,
  loadError,
  statusFilter,
  sortOrder,
  onSearchChange,
  onStatusChange,
  onSortChange,
  onPageChange,
  onView,
  onEdit,
  onDelete,
}: OrganizationTableProps) {
  const isFiltered = Boolean(search.trim()) || statusFilter !== 'all';
  const [view, setView] = useState<TableView>('list');

  const columns: DataTableColumn<User>[] = [
    {
      key: 'organization',
      header: 'Organization',
      render: (organization) => (
        <EntityCell shape="circle" name={organization.organizationName || organization.name || organization.email} subtitle={organization.email} />
      ),
    },
    {
      key: 'holder',
      header: 'Account holder',
      hideBelow: 'md',
      render: (organization) => (organization.name
        ? <Text color="slate.700" fontWeight="500">{organization.name}</Text>
        : <Text fontSize="xs" color="slate.400" fontStyle="italic">Not added</Text>),
    },
    {
      key: 'status',
      header: 'Status',
      render: (organization) => <StatusBadge status={organization.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (organization) => rowActions(organization),
    },
  ];

  function rowActions(organization: User) {
    return (
      <HStack justify="flex-end" spacing={2}>
        <IconAction label={`Edit ${organization.organizationName}`} icon={<EditIcon />} tone="primary" w="34px" minW="34px" h="34px" onClick={(event) => { event.stopPropagation(); onEdit(organization); }} />
        <IconAction label={`Delete ${organization.organizationName}`} icon={<DeleteIcon />} tone="danger" w="34px" minW="34px" h="34px" onClick={(event) => { event.stopPropagation(); onDelete(organization); }} />
      </HStack>
    );
  }

  const footer = (
    <TableFooter
      page={page}
      pageSize={pageSize}
      total={total}
      totalPages={totalPages}
      noun={total === 1 ? 'organization' : 'organizations'}
      isDisabled={isLoading || Boolean(loadError)}
      onPageChange={onPageChange}
    />
  );

  let gridBody: ReactNode = null;
  if (view === 'grid') {
    if (loadError) {
      gridBody = <Text px={5} py={8} color="red.600" fontSize="sm">{loadError}</Text>;
    } else if (isLoading && organizations.length === 0) {
      gridBody = (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4} p={{ base: 4, md: 5 }}>
          {[0, 1, 2].map((index) => <Skeleton key={index} h="132px" borderRadius="14px" />)}
        </SimpleGrid>
      );
    } else if (organizations.length === 0) {
      gridBody = (
        <Box px={5} py={10} textAlign="center">
          <Text fontWeight="600" color="slate.800">{isFiltered ? 'No matching organizations' : 'No organizations yet'}</Text>
          {isFiltered ? <Text mt={1} fontSize="sm" color="slate.500">Try a different search or status filter.</Text> : null}
        </Box>
      );
    } else {
      gridBody = (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4} p={{ base: 4, md: 5 }} opacity={isLoading ? 0.6 : 1}>
          {organizations.map((organization) => (
            <Box
              key={organization.id || organization._id || organization.email}
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
              onClick={() => onView(organization)}
              onKeyDown={(event) => { if (event.key === 'Enter') onView(organization); }}
            >
              <EntityCell shape="circle" minW="0" name={organization.organizationName || organization.name || organization.email} subtitle={organization.email} />
              <Flex mt={4} pt={3} borderTop="1px solid" borderColor="slate.100" justify="space-between" align="center" gap={3}>
                <Box minW={0}>
                  <Text fontSize="xs" color="slate.500">Account holder</Text>
                  <Text fontSize="sm" fontWeight="600" color={organization.name ? 'slate.800' : 'slate.400'} noOfLines={1}>{organization.name || 'Not added'}</Text>
                </Box>
                <StatusBadge status={organization.status} />
              </Flex>
              <Box mt={3}>{rowActions(organization)}</Box>
            </Box>
          ))}
        </SimpleGrid>
      );
    }
  }

  return (
    <ContentCard
      noPadding
      icon={<FolderIcon boxSize={5} />}
      title="Organization directory"
      actions={<ViewToggle value={view} onChange={setView} />}
      subtitle={isLoading && total === 0 ? 'Loading organizations…' : `${total} ${total === 1 ? 'organization' : 'organizations'}${isFiltered ? ' match your filters' : ''}`}
      toolbar={(
        <FilterBar
          variant="inset"
          canClear={isFiltered || sortOrder !== 'name-asc'}
          onClear={() => {
            onSearchChange('');
            onStatusChange('all');
            onSortChange('name-asc');
          }}
        >
          <FilterField label="Search" flex={{ base: '1 1 100%', md: '1 1 280px' }} maxW={{ md: '440px' }}>
            <SearchInput value={search} onChange={onSearchChange} placeholder="Search organization, holder or email..." label="Search organizations" />
          </FilterField>
          <FilterField label="Status">
            <FilterSelect<StatusFilter> label="Filter organizations by status" value={statusFilter} options={STATUS_OPTIONS} onChange={onStatusChange} />
          </FilterField>
          <FilterField label="Sort by">
            <FilterSelect<SortOrder> label="Sort organizations" value={sortOrder} options={SORT_OPTIONS} onChange={onSortChange} />
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
          columns={columns}
          rows={organizations}
          rowKey={(organization) => organization.id || organization._id || organization.email}
          onRowClick={onView}
          isLoading={isLoading}
          error={loadError}
          emptyTitle={isFiltered ? 'No matching organizations' : 'No organizations yet'}
          emptyDescription={isFiltered ? 'Try a different search or status filter.' : undefined}
          footer={footer}
        />
      )}
    </ContentCard>
  );
}

export default OrganizationTable;
