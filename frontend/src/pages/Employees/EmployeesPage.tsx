import { AddIcon } from '@chakra-ui/icons';
import { Box, Button, Heading, HStack, Stack, Text, useDisclosure, useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { ApiError } from '../../services/api';
import type { Employee, UserRole } from '../../types';
import AssignEmployeeDialog from './components/AssignEmployeeDialog';
import DeleteEmployeeDialog from './components/DeleteEmployeeDialog';
import EmployeeDetailsPage from './components/EmployeeDetailsPage';
import EmployeeFormDialog from './components/EmployeeFormDialog';
import EmployeeTable from './components/EmployeeTable';
import { useEmployees } from './hooks/useEmployees';
import type { EmployeeInput } from '../../services/employeeService';

type EmployeesPageProps = { role: UserRole; organizationId?: string };
type OrganizationEmployeesPageProps = EmployeesPageProps & { organizationName?: string };

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function EmployeesPage({ role, organizationId, organizationName }: OrganizationEmployeesPageProps) {
  const toast = useToast();
  const employees = useEmployees(organizationId, role === 'organization' || Boolean(organizationId));
  const formDialog = useDisclosure();
  const assignmentDialog = useDisclosure();
  const deleteDialog = useDisclosure();
  const [formEmployee, setFormEmployee] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [isViewing, setIsViewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  function openCreateDialog() {
    setFormEmployee(null);
    formDialog.onOpen();
  }

  function openEditDialog(employee: Employee) {
    setFormEmployee(employee);
    formDialog.onOpen();
  }

  function closeFormDialog() {
    formDialog.onClose();
    setFormEmployee(null);
  }

  async function handleSave(input: EmployeeInput): Promise<boolean> {
    setIsSaving(true);
    try {
      if (formEmployee) {
        const updatedEmployee = await employees.update(formEmployee.id, input);
        setViewingEmployee((current) => current?.id === updatedEmployee.id ? updatedEmployee : current);
        toast({ title: 'Employee updated', status: 'success', position: 'top' });
      } else {
        await employees.create(input);
        toast({ title: 'Employee added', status: 'success', position: 'top' });
      }
      return true;
    } catch (error) {
      toast({ title: getErrorMessage(error, 'Unable to save employee.'), status: 'error', position: 'top' });
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleView(employee: Employee) {
    setViewingEmployee(employee);
    setIsViewing(true);
    try {
      setViewingEmployee(await employees.getDetails(employee.id));
    } catch (error) {
      setViewingEmployee(null);
      toast({ title: getErrorMessage(error, 'Unable to load employee details.'), status: 'error', position: 'top' });
    } finally {
      setIsViewing(false);
    }
  }

  async function handleAssign(employeeIds: string[]): Promise<boolean> {
    if (!organizationId) return false;
    setIsAssigning(true);
    try {
      await employees.assignMany(employeeIds, organizationId);
      toast({ title: `${employeeIds.length} employee${employeeIds.length === 1 ? '' : 's'} added to organization`, status: 'success', position: 'top' });
      return true;
    } catch (error) {
      toast({ title: getErrorMessage(error, 'Unable to assign employee.'), status: 'error', position: 'top' });
      return false;
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleDelete() {
    if (!deletingEmployee) return;
    setIsDeleting(true);
    try {
      if (role === 'organization') {
        await employees.unassignMany([deletingEmployee.id], organizationId);
        toast({ title: 'Employee removed from your organization; record kept', status: 'success', position: 'top' });
      } else {
        await employees.remove(deletingEmployee.id);
        toast({ title: 'Employee deleted', status: 'success', position: 'top' });
      }
    } catch (error) {
      toast({ title: getErrorMessage(error, 'Unable to delete employee.'), status: 'error', position: 'top' });
    } finally {
      setIsDeleting(false);
      setDeletingEmployee(null);
      deleteDialog.onClose();
    }
  }

  return (
    <>
      {viewingEmployee ? (
        <EmployeeDetailsPage
          employee={viewingEmployee}
          isLoading={isViewing}
          role={role}
          onBack={() => setViewingEmployee(null)}
          onEdit={() => openEditDialog(viewingEmployee)}
        />
      ) : (
        <Stack spacing={6}>
          <HStack justify="space-between" align="center" flexWrap="wrap" gap={4}>
            <Box>
              <Heading size="lg" color="slate.900" lineHeight="1.15">Employees</Heading>
              <Text mt={1} fontSize="sm" color="slate.500">Manage employee records and contact details</Text>
            </Box>
            <HStack flexWrap="wrap" gap={3}>
              {role === 'admin' && organizationId && (
                <Button h="40px" px={5} borderRadius="full" fontSize="sm" leftIcon={<AddIcon boxSize={2.5} />} variant="outline" onClick={assignmentDialog.onOpen}>
                  Assign existing employee
                </Button>
              )}
              {role === 'admin' && (
                <Button h="40px" px={5} borderRadius="full" fontSize="sm" leftIcon={<AddIcon boxSize={2.5} />} colorScheme="brand" onClick={openCreateDialog}>
                  Add Employee
                </Button>
              )}
            </HStack>
          </HStack>

          <EmployeeTable
            employees={employees.employees}
            role={role}
            page={employees.page}
            pageSize={employees.pageSize}
            total={employees.total}
            totalPages={employees.totalPages}
            summary={employees.summary}
            scopeLabel={role === 'organization' ? 'In this organization' : 'All employee records'}
            showStatusFilter={role === 'admin'}
            search={employees.search}
            status={employees.status}
            sort={employees.sort}
            isLoading={employees.isLoading}
            loadError={employees.loadError}
            onSearchChange={employees.setSearch}
            onStatusChange={employees.setStatus}
            onSortChange={employees.setSort}
            onPageChange={employees.setPage}
            onView={(employee) => void handleView(employee)}
            onEdit={openEditDialog}
            deleteLabel={role === 'organization' ? 'Remove from organization' : 'Delete employee'}
            onDelete={(employee) => {
              setDeletingEmployee(employee);
              deleteDialog.onOpen();
            }}
          />
        </Stack>
      )}

      <EmployeeFormDialog
        isOpen={formDialog.isOpen}
        isSaving={isSaving}
        employee={formEmployee}
        onClose={closeFormDialog}
        onSave={handleSave}
      />
      {role === 'admin' && organizationId && (
        <AssignEmployeeDialog
          isOpen={assignmentDialog.isOpen}
          isSaving={isAssigning}
          organizationName={organizationName || 'this organization'}
          onClose={assignmentDialog.onClose}
          onAssign={handleAssign}
        />
      )}
      <DeleteEmployeeDialog
        isOpen={deleteDialog.isOpen}
        employee={deletingEmployee}
        isDeleting={isDeleting}
        action={role === 'organization' ? 'remove' : 'delete'}
        onClose={() => {
          setDeletingEmployee(null);
          deleteDialog.onClose();
        }}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}

export default EmployeesPage;