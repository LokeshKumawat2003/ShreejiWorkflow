import type { ComponentProps } from 'react';
import EmployeeTable from '../../Employees/components/EmployeeTable';
import type { Employee } from '../../../types';

type OrganizationEmployeeTableProps = Omit<
  ComponentProps<typeof EmployeeTable>,
  'role' | 'onDelete' | 'deleteLabel' | 'scopeLabel'
> & {
  onRemove: (employee: Employee) => void;
};

function OrganizationEmployeeTable({ onRemove, ...tableProps }: OrganizationEmployeeTableProps) {
  return (
    <EmployeeTable
      {...tableProps}
      role="admin"
      scopeLabel="At this location"
      deleteLabel="Remove from location"
      onDelete={onRemove}
    />
  );
}

export default OrganizationEmployeeTable;
