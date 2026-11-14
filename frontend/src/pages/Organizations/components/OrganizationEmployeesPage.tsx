import { AddIcon } from '@chakra-ui/icons';
import { useDisclosure, useToast } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { ActionButton } from '../../../components/ui';
import { ApiError } from '../../../services/api';
import { downloadAppointmentLetters } from '../../../services/appointmentLetterService';
import { useDataChanged } from '../../../utils/dataSync';
import type { PdfAction } from '../../../utils/pdfOutput';
import type { OrganizationLocation } from '../../../types';
import type { Employee } from '../../../types';
import type { EmployeeInput } from '../../../services/employeeService';
import AssignEmployeeDialog from '../../Employees/components/AssignEmployeeDialog';
import EmployeeDetailsPage from '../../Employees/components/EmployeeDetailsPage';
import EmployeeFormDialog from '../../Employees/components/EmployeeFormDialog';
import { useAppointmentLetterDelivery } from '../../Employees/hooks/useAppointmentLetterDelivery';
import { useEmployees } from '../../Employees/hooks/useEmployees';
import MoveEmployeeDialog from './MoveEmployeeDialog';
import RemoveOrganizationEmployeeDialog from './RemoveOrganizationEmployeeDialog';
import OrganizationEmployeeTable from './OrganizationEmployeeTable';

type OrganizationEmployeesPageProps = {
  organizationId: string;
  organizationName: string;
  location: OrganizationLocation;
  onViewingChange?: (isViewing: boolean) => void;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function OrganizationEmployeesPage({ organizationId, organizationName, location, onViewingChange }: OrganizationEmployeesPageProps) {
  const toast = useToast();
  const deliverAppointmentLetters = useAppointmentLetterDelivery();
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
  const [movingEmployee, setMovingEmployee] = useState<Employee | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const isViewing = viewingEmployee !== null;

  useEffect(() => {
    onViewingChange?.(isViewing);
    if (isViewing) window.scrollTo({ top: 0 });
  }, [isViewing, onViewingChange]);

  useEffect(() => () => onViewingChange?.(false), [onViewingChange]);

  const viewingEmployeeId = viewingEmployee?.id;
  useDataChanged(['masterData', 'organizations'], () => {
    if (!viewingEmployeeId) return;
    void employees.getDetails(viewingEmployeeId)
      .then((employee) => setViewingEmployee((current) => current?.id === employee.id ? employee : current))
      .catch(() => undefined);
  });

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
        void deliverAppointmentLetters([createdEmployee], location);
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

  async function handleAssign(employeeIds: string[], joiningDate?: string): Promise<boolean> {
    setIsAssigning(true);
    try {
      const assignedEmployees = await employees.assignMany(employeeIds, organizationId, location.id, joiningDate);
      toast({ title: `${employeeIds.length} employee${employeeIds.length === 1 ? '' : 's'} added to ${organizationName}`, status: 'success', position: 'top' });
      void deliverAppointmentLetters(assignedEmployees, location);
      return true;
    } catch (error) {
      toast({ title: getErrorMessage(error, 'Unable to assign employees.'), status: 'error', position: 'top' });
      return false;
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleDownloadLetter(employee: Employee, action: PdfAction = 'download') {
    try {
      await downloadAppointmentLetters([employee], location, action);
    } catch (error) {
      toast({ title: getErrorMessage(error, 'Unable to generate the appointment letter.'), status: 'error', position: 'top' });
    }
  }

  async function handleMove(targetOrganizationId: string, targetLocation: OrganizationLocation, targetOrganizationName: string, joiningDate: string) {
    if (!movingEmployee) return;
    setIsMoving(true);
    try {
      const movedEmployees = await employees.transferMany([movingEmployee.id], targetOrganizationId, targetLocation.id, joiningDate);
      const place = [targetOrganizationId !== organizationId ? targetOrganizationName : '', targetLocation.workName || targetLocation.name].filter(Boolean).join(' · ');
      toast({ title: `${movingEmployee.name} moved to ${place}`, description: 'Preparing the new appointment letter…', status: 'success', position: 'top' });
      setMovingEmployee(null);
      void deliverAppointmentLetters(movedEmployees, targetLocation);
    } catch (error) {
      toast({ title: getErrorMessage(error, 'Unable to move the employee.'), status: 'error', position: 'top' });
    } finally {
      setIsMoving(false);
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
          <OrganizationEmployeeTable
            title={`Employee roster · ${organizationName}`}
            actions={(
              <>
                <ActionButton
                  tone="neutral"
                  size="sm"
                  h="38px"
                  px={4}
                  bg="white"
                  color="slate.800"
                  boxShadow="0 1px 3px rgba(15, 23, 42, 0.06)"
                  leftIcon={<AddIcon boxSize={2.5} />}
                  onClick={assignmentDialog.onOpen}
                >
                  Assign existing
                </ActionButton>
                <ActionButton
                  size="sm"
                  h="38px"
                  px={4}
                  bgGradient="linear(to-r, brand.400, brand.600)"
                  boxShadow="0 6px 14px rgba(79, 70, 229, 0.28)"
                  _hover={{ bgGradient: 'linear(to-r, brand.500, brand.700)' }}
                  leftIcon={<AddIcon boxSize={2.5} />}
                  onClick={openCreateDialog}
                >
                  Add employee
                </ActionButton>
              </>
            )}
            employees={employees.employees}
            page={employees.page}
            pageSize={employees.pageSize}
            total={employees.total}
            totalPages={employees.totalPages}
            summary={employees.summary}
            showStatusFilter={false}
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
            onDownloadLetter={(employee) => void handleDownloadLetter(employee)}
            onPrintLetter={(employee) => void handleDownloadLetter(employee, 'print')}
            onMove={setMovingEmployee}
            onRemove={(employee) => {
              setRemovingEmployee(employee);
              removeDialog.onOpen();
            }}
          />
      )}

      <EmployeeFormDialog
        isOpen={formDialog.isOpen}
        isSaving={isSaving}
        employee={formEmployee}
        requiredDesignation={!formEmployee ? location.designation : undefined}
        organizationId={organizationId}
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
      <MoveEmployeeDialog
        isOpen={Boolean(movingEmployee)}
        employee={movingEmployee}
        currentOrganizationId={organizationId}
        currentLocation={location}
        isSaving={isMoving}
        onClose={() => {
          if (!isMoving) setMovingEmployee(null);
        }}
        onMove={(targetOrganizationId, targetLocation, targetOrganizationName, joiningDate) => void handleMove(targetOrganizationId, targetLocation, targetOrganizationName, joiningDate)}
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