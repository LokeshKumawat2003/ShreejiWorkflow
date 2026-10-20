import { AddIcon } from '@chakra-ui/icons';
import { Box, Button, Heading, HStack, Stack, Text, useDisclosure, useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { ApiError } from '../../../services/api';
import { downloadAppointmentLetters } from '../../../services/appointmentLetterService';
import type { OrganizationLocation } from '../../../types';
import type { Employee } from '../../../types';
import type { EmployeeInput } from '../../../services/employeeService';
import AssignEmployeeDialog from '../../Employees/components/AssignEmployeeDialog';
import EmployeeDetailsPage from '../../Employees/components/EmployeeDetailsPage';
import EmployeeFormDialog from '../../Employees/components/EmployeeFormDialog';
import { useEmployees } from '../../Employees/hooks/useEmployees';
import RemoveOrganizationEmployeeDialog from './RemoveOrganizationEmployeeDialog';
import OrganizationEmployeeTable from './OrganizationEmployeeTable';

type OrganizationEmployeesPageProps = {
  organizationId: string;
  organizationName: string;
  location: OrganizationLocation;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function OrganizationEmployeesPage({ organizationId, organizationName, location }: OrganizationEmployeesPageProps) {
  const toast = useToast();
  const employees = useEmployees(organizationId, true, location.id);
  const formDialog = useDisclosure();
  const assignmentDialog = useDisclosure();
  const removeDialog = useDisclosure();
  const [formEmployee, setFormEmployee] = useState<Employee | null>(null);
  const [removingEmployee, setRemovingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  function openCreateDialog() {
    setFormEmployee(null);
    formDialog.onOpen();
  }

  function openEditDialog(employee: Employee) {
    setFormEmployee(employee);
    formDialog.onOpen();
  }

  async function handleSave(input: EmployeeInput): Promise<boolean> {
    setIsSaving(true);
    try {
      if (formEmployee) {
        const updatedEmployee = await employees.update(formEmployee.id, input);
        setViewingEmployee((current) => current?.id === updatedEmployee.id ? updatedEmployee : current);
        toast({ title: 'Employee updated', status: 'success', position: 'top' });
      } else {
        const createdEmployee = await employees.create(input);
        toast({ title: 'Employee added to location', status: 'success', position: 'top' });
        try {
          await downloadAppointmentLetters([createdEmployee], location);
        } catch (error) {
          toast({ title: getErrorMessage(error, 'Employee was added, but the appointment letter could not be generated.'), status: 'error', position: 'top' });
        }
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
    try {
      setViewingEmployee(await employees.getDetails(employee.id));
    } catch (error) {
      setViewingEmployee(null);
      toast({ title: getErrorMessage(error, 'Unable to load employee details.'), status: 'error', position: 'top' });
    }
  }

  async function handleAssign(employeeIds: string[]): Promise<boolean> {
    setIsAssigning(true);
    try {
        const assignedEmployees = await employees.assignMany(employeeIds, organizationId, location.id);
      toast({ title: `${employeeIds.length} employee${employeeIds.length === 1 ? '' : 's'} added to ${organizationName}`, status: 'success', position: 'top' });
        try {
          await downloadAppointmentLetters(assignedEmployees, location);
        } catch (error) {
          toast({ title: getErrorMessage(error, 'Employees were assigned, but appointment letters could not be generated.'), status: 'error', position: 'top' });
        }
      return true;
    } catch (error) {
      toast({ title: getErrorMessage(error, 'Unable to assign employees.'), status: 'error', position: 'top' });
      return false;
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleRemove() {
    if (!removingEmployee) return;
    setIsRemoving(true);
    try {
      await employees.unassignMany([removingEmployee.id], organizationId, location.id);
      toast({ title: 'Employee removed from location; record kept', status: 'success', position: 'top' });
    } catch (error) {
      toast({ title: getErrorMessage(error, 'Unable to remove employee from organization.'), status: 'error', position: 'top' });
    } finally {
      setIsRemoving(false);
      setRemovingEmployee(null);
      removeDialog.onClose();
    }
  }

  return (
    <>
      {viewingEmployee ? (
        <EmployeeDetailsPage
          employee={viewingEmployee}
          isLoading={false}
          role="admin"
          onBack={() => setViewingEmployee(null)}
          onEdit={() => openEditDialog(viewingEmployee)}
        />
      ) : (
        <Stack spacing={5}>
          <HStack justify="space-between" align="center" flexWrap="wrap" gap={4}>
            <Box>
              <Heading size="md" color="slate.900">Employees</Heading>
              <Text mt={1} fontSize="sm" color="slate.500">Employee roster for {organizationName}</Text>
            </Box>
            <HStack flexWrap="wrap" gap={3}>
              <Button h="40px" px={4} fontSize="sm" leftIcon={<AddIcon />} variant="outline" onClick={assignmentDialog.onOpen}>
                Assign existing
              </Button>
              <Button h="40px" px={4} fontSize="sm" leftIcon={<AddIcon />} colorScheme="brand" onClick={openCreateDialog}>
                Add employee
              </Button>
            </HStack>
          </HStack>

          <OrganizationEmployeeTable
            employees={employees.employees}
            page={employees.page}
            pageSize={employees.pageSize}
            total={employees.total}
            totalPages={employees.totalPages}
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
            onRemove={(employee) => {
              setRemovingEmployee(employee);
              removeDialog.onOpen();
            }}
          />
        </Stack>
      )}

      <EmployeeFormDialog
        isOpen={formDialog.isOpen}
        isSaving={isSaving}
        employee={formEmployee}
        requiredDesignation={!formEmployee ? location.designation : undefined}
        onClose={() => {
          formDialog.onClose();
          setFormEmployee(null);
        }}
        onSave={handleSave}
      />
      <AssignEmployeeDialog
        isOpen={assignmentDialog.isOpen}
        isSaving={isAssigning}
        organizationName={organizationName}
        organizationId={organizationId}
        locationId={location.id}
        locationDesignation={location.designation}
        onClose={assignmentDialog.onClose}
        onAssign={handleAssign}
      />
      <RemoveOrganizationEmployeeDialog
        isOpen={removeDialog.isOpen}
        employee={removingEmployee}
        organizationName={organizationName}
        isRemoving={isRemoving}
        onClose={() => {
          setRemovingEmployee(null);
          removeDialog.onClose();
        }}
        onConfirm={() => void handleRemove()}
      />
    </>
  );
}

export default OrganizationEmployeesPage;