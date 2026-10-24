import { CheckCircleIcon, DeleteIcon, DownloadIcon, EditIcon, NotAllowedIcon, PhoneIcon, RepeatIcon } from '@chakra-ui/icons';
import { Box, HStack, Stack, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import {
  ContentCard,
  DataTable,
  EntityCell,
  FilterBar,
  FilterField,
  FilterSelect,
  IconAction,
  PeopleIcon,
  PrintIcon,
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
  onDownloadLetter?: (employee: Employee) => void;
  onPrintLetter?: (employee: Employee) => void;
  onMove?: (employee: Employee) => void;
  deleteLabel: string;
  title?: string;
  actions?: ReactNode;
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
  onDownloadLetter,
  onPrintLetter,
  onMove,
  deleteLabel,
  title = 'Employee directory',
  actions,
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
      render: (employee) => (employee.phone ? (
        <HStack spacing={2} color="slate.700" whiteSpace="nowrap">
          <PhoneIcon boxSize={3} color="slate.400" />
          <Text fontWeight="500">{employee.phone}</Text>
        </HStack>
      ) : (
        <Text fontSize="xs" color="slate.400" fontStyle="italic">Not added</Text>
      )),
    },
    {
      key: 'status',
      header: 'Status',
      render: (employee) => (
        <Box>
          <StatusBadge status={employee.status} />
          {employee.status === 'disabled' && employee.disabledOn ? (
            <Text mt={1} fontSize="xs" color="slate.500">{`Blocked from ${employee.disabledOn}`}</Text>
          ) : null}
        </Box>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (employee) => (
        <HStack justify="flex-end" spacing={1.5}>
          {role === 'admin' && (
            <IconAction label={`Edit ${employee.name}`} icon={<EditIcon />} onClick={() => onEdit(employee)} />
          )}
          {onDownloadLetter && (
            <IconAction label={`Appointment letter: ${employee.name}`} icon={<DownloadIcon />} tone="primary" onClick={() => onDownloadLetter(employee)} />
          )}
          {onPrintLetter && (
            <IconAction label={`Print appointment letter: ${employee.name}`} icon={<PrintIcon />} onClick={() => onPrintLetter(employee)} />
          )}
          {onMove && (
            <IconAction label={`Move ${employee.name} to another location`} icon={<RepeatIcon />} onClick={() => onMove(employee)} />
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
          { label: 'Total Employees', value: summary?.total, helper: scopeLabel, color: 'brand.500', icon: <PeopleIcon boxSize={5} /> },
          {
            label: 'Active',
            value: summary?.active,
            helper: 'Currently assigned',
            color: 'green.500',
            icon: <CheckCircleIcon boxSize={5} />,
            share: summary?.total ? summary.active / summary.total : null,
          },
          {
            label: 'Inactive',
            value: summary?.inactive,
            helper: 'Not active',
            color: 'red.400',
            icon: <NotAllowedIcon boxSize={5} />,
            share: summary?.total ? summary.inactive / summary.total : null,
          },
        ]}
      />

      <ContentCard
        noPadding
        icon={<PeopleIcon boxSize={5} />}
        title={title}
        actions={actions}
        subtitle={isLoading && total === 0 ? 'Loading employees…' : `${total} ${total === 1 ? 'employee' : 'employees'}${isFiltered ? ' match your filters' : ''}`}
        toolbar={(
          <FilterBar
            variant="inset"
            canClear={isFiltered || sort !== 'name-asc'}
            onClear={() => {
              onSearchChange('');
              if (showStatusFilter) onStatusChange('all');
              onSortChange('name-asc');
            }}
          >
            <FilterField label="Search" flex={{ base: '1 1 100%', md: '1 1 280px' }} maxW={{ md: '440px' }}>
              <SearchInput value={search} onChange={onSearchChange} placeholder="Search name or email..." label="Search employees" />
            </FilterField>
            {showStatusFilter && (
              <FilterField label="Status">
                <FilterSelect<StatusFilter> label="Filter employees by status" value={status} options={STATUS_OPTIONS} onChange={onStatusChange} />
              </FilterField>
            )}
            <FilterField label="Sort by">
              <FilterSelect<SortOrder> label="Sort employees" value={sort} options={SORT_OPTIONS} onChange={onSortChange} />
            </FilterField>
          </FilterBar>
        )}
      >
        <DataTable
          columns={columns}
          rows={employees}
          rowKey={(employee) => employee.id}
          onRowClick={onView}
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
      </ContentCard>
    </Stack>
  );
}

export default EmployeeTable;
