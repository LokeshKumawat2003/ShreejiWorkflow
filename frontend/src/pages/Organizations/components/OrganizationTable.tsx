import { DeleteIcon, EditIcon, ViewIcon } from '@chakra-ui/icons';
import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import {
  DataTable,
  EntityCell,
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
      render: (organization) => <Text color="slate.600">{organization.name || '—'}</Text>,
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
        <HStack justify="flex-end" spacing={0.5}>
          <IconAction label={`View ${organization.organizationName}`} icon={<ViewIcon />} onClick={() => onView(organization)} />
          <IconAction label={`Edit ${organization.organizationName}`} icon={<EditIcon />} onClick={() => onEdit(organization)} />
          <IconAction label={`Delete ${organization.organizationName}`} icon={<DeleteIcon />} tone="danger" onClick={() => onDelete(organization)} />
        </HStack>
      ),
    },
  ];

  return (
    <Stack spacing={4}>
      <Flex gap={3} direction={{ base: 'column', md: 'row' }} align={{ base: 'stretch', md: 'center' }}>
        <SearchInput
          isPill
          flex="1"
          maxW="none"
          size="lg"
          value={search}
          onChange={onSearchChange}
          placeholder="Search organization, holder or email..."
          label="Search organizations"
        />
        <FilterSelect<StatusFilter>
          label="Filter organizations by status"
          size="lg"
          borderRadius="full"
          minW="170px"
          value={statusFilter}
          options={STATUS_OPTIONS}
          onChange={onStatusChange}
        />
      </Flex>

      <HStack spacing={4} align="center">
        <Text fontSize="sm" fontWeight="600" color="slate.700" whiteSpace="nowrap">Organization directory</Text>
        <FilterSelect<SortOrder>
          label="Sort organizations"
          borderRadius="full"
          flex="1"
          value={sortOrder}
          options={SORT_OPTIONS}
          onChange={onSortChange}
        />
      </HStack>

      <Box bg="white" border="1px solid" borderColor="slate.200" borderRadius="lg" boxShadow="sm" overflow="hidden">
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
      </Box>
    </Stack>
  );
}

export default OrganizationTable;
