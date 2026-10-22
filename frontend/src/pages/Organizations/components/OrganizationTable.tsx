import { DeleteIcon, EditIcon, ViewIcon } from '@chakra-ui/icons';
import { HStack, Text } from '@chakra-ui/react';
import {
  BuildingIcon,
  ContentCard,
  DataTable,
  EntityCell,
  FilterBar,
  FilterField,
  FilterSelect,
  IconAction,
  SearchInput,
  StatusBadge,
  TableFooter,
  type DataTableColumn,
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

  const columns: DataTableColumn<User>[] = [
    {
      key: 'organization',
      header: 'Organization',
      render: (organization) => (
        <EntityCell name={organization.organizationName || organization.name || organization.email} subtitle={organization.email} />
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
      render: (organization) => (
        <HStack justify="flex-end" spacing={1.5}>
          <IconAction label={`View ${organization.organizationName}`} icon={<ViewIcon />} tone="primary" onClick={() => onView(organization)} />
          <IconAction label={`Edit ${organization.organizationName}`} icon={<EditIcon />} onClick={() => onEdit(organization)} />
          <IconAction label={`Delete ${organization.organizationName}`} icon={<DeleteIcon />} tone="danger" onClick={() => onDelete(organization)} />
        </HStack>
      ),
    },
  ];

  return (
    <ContentCard
      noPadding
      icon={<BuildingIcon boxSize={5} />}
      title="Organization directory"
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
      <DataTable
        columns={columns}
        rows={organizations}
        rowKey={(organization) => organization.id || organization._id || organization.email}
        isLoading={isLoading}
        error={loadError}
        emptyTitle={isFiltered ? 'No matching organizations' : 'No organizations yet'}
        emptyDescription={isFiltered ? 'Try a different search or status filter.' : undefined}
        footer={(
          <TableFooter
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            noun={total === 1 ? 'organization' : 'organizations'}
            isDisabled={isLoading || Boolean(loadError)}
            onPageChange={onPageChange}
          />
        )}
      />
    </ContentCard>
  );
}

export default OrganizationTable;
