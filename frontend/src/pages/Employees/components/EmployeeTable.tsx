import { DeleteIcon, EditIcon, ViewIcon } from '@chakra-ui/icons';
import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import {
  DataTable,
  EntityCell,
  FilterSelect,
  IconAction,
  SearchInput,
  StatStrip,
  StatusBadge,
  TableFooter,
  type DataTableColumn,
} from '../../../components/ui';
import type { EmployeeSummary } from '../../../services/employeeService';
import type { Employee, EmployeeStatus, UserRole } from '../../../types';

type SortOrder = 'name-asc' | 'name-desc' | 'newest' | 'oldest';
type StatusFilter = 'all' | EmployeeStatus;

type EmployeeTableProps = {
  employees: Employee[];
  role: UserRole;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary?: EmployeeSummary | null;
  scopeLabel?: string;
  search: string;
  status: StatusFilter;
  sort: SortOrder;
  isLoading: boolean;
  loadError: string;
  showStatusFilter?: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: StatusFilter) => void;
  onSortChange: (value: SortOrder) => void;
  onPageChange: (page: number) => void;
  onView: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  deleteLabel: string;
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

function EmployeeTable({
  employees,
  role,
  page,
  pageSize,
  total,
  totalPages,
  summary,
  scopeLabel = 'All employee records',
  search,
  status,
  sort,
  isLoading,
  loadError,
  showStatusFilter = true,
  onSearchChange,
  onStatusChange,
  onSortChange,
  onPageChange,
  onView,
  onEdit,
  onDelete,
  deleteLabel,
}: EmployeeTableProps) {
  const isFiltered = Boolean(search.trim()) || status !== 'all';

  const columns: DataTableColumn<Employee>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (employee) => <EntityCell name={employee.name} subtitle={employee.email} />,
    },
    {
      key: 'phone',
      header: 'Phone',
      hideBelow: 'md',
      render: (employee) => <Text color="slate.600" whiteSpace="nowrap">{employee.phone || '—'}</Text>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (employee) => <StatusBadge status={employee.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (employee) => (
        <HStack justify="flex-end" spacing={0.5}>
          <IconAction label={`View ${employee.name}`} icon={<ViewIcon />} onClick={() => onView(employee)} />
          {role === 'admin' && (
            <IconAction label={`Edit ${employee.name}`} icon={<EditIcon />} onClick={() => onEdit(employee)} />
          )}
          <IconAction label={`${deleteLabel}: ${employee.name}`} icon={<DeleteIcon />} tone="danger" onClick={() => onDelete(employee)} />
        </HStack>
      ),
    },
  ];

  return (
    <Stack spacing={4}>
      <StatStrip
        items={[
          { label: 'Total Employees', value: summary?.total, helper: scopeLabel, color: 'brand.500' },
          { label: 'Active', value: summary?.active, helper: 'Currently assigned', color: 'green.500' },
          { label: 'Inactive', value: summary?.inactive, helper: 'Not active' },
        ]}
      />

      <Flex gap={3} direction={{ base: 'column', md: 'row' }} align={{ base: 'stretch', md: 'center' }}>
        <SearchInput
          isPill
          flex="1"
          maxW="none"
          size="lg"
          value={search}
          onChange={onSearchChange}
          placeholder="Search name or email..."
          label="Search employees"
        />
        {showStatusFilter && (
          <FilterSelect<StatusFilter>
            label="Filter employees by status"
            size="lg"
            borderRadius="full"
            minW="170px"
            value={status}
            options={STATUS_OPTIONS}
            onChange={onStatusChange}
          />
        )}
      </Flex>

      <HStack spacing={4} align="center">
        <Text fontSize="sm" fontWeight="600" color="slate.700" whiteSpace="nowrap">Employee directory</Text>
        <FilterSelect<SortOrder>
          label="Sort employees"
          borderRadius="full"
          flex="1"
          value={sort}
          options={SORT_OPTIONS}
          onChange={onSortChange}
        />
      </HStack>

      <Box bg="white" border="1px solid" borderColor="slate.200" borderRadius="lg" boxShadow="sm" overflow="hidden">
        <DataTable
          columns={columns}
          rows={employees}
          rowKey={(employee) => employee.id}
          isLoading={isLoading}
          error={loadError}
          emptyTitle={isFiltered ? 'No matching employees' : 'No employees yet'}
          emptyDescription={isFiltered ? 'Try a different search or status filter.' : undefined}
          footer={(
            <TableFooter
              page={page}
              pageSize={pageSize}
              total={total}
              totalPages={totalPages}
              noun={total === 1 ? 'employee' : 'employees'}
              isDisabled={isLoading || Boolean(loadError)}
              onPageChange={onPageChange}
            />
          )}
        />
      </Box>
    </Stack>
  );
}

export default EmployeeTable;
