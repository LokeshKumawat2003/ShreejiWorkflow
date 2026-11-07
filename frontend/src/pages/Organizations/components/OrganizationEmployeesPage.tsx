import { AddIcon } from '@chakra-ui/icons';
import { useDisclosure, useToast } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { ActionButton } from '../../../components/ui';
import { ApiError } from '../../../services/api';
import { createAppointmentLetterPdf, createCombinedAppointmentLettersPdf, downloadAppointmentLetters } from '../../../services/appointmentLetterService';
import { emailAppointmentLetter, emailOrganizationAppointmentLetters } from '../../../services/employeeService';
import type { PdfAction } from '../../../utils/pdfOutput';
import type { OrganizationLocation } from '../../../types';
import type { Employee } from '../../../types';
import type { EmployeeInput } from '../../../services/employeeService';
import AssignEmployeeDialog from '../../Employees/components/AssignEmployeeDialog';
import EmployeeDetailsPage from '../../Employees/components/EmployeeDetailsPage';
import EmployeeFormDialog from '../../Employees/components/EmployeeFormDialog';
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

async function sendAppointmentLetters(employees: Employee[], location: OrganizationLocation) {
  return Promise.allSettled(employees.map(async (employee) => {
    const pdf = await createAppointmentLetterPdf(employee, location);
    await emailAppointmentLetter(employee.id, location.id, pdf);
  }));
}

async function sendOrganizationAppointmentLetters(employees: Employee[], location: OrganizationLocation) {
  const pdf = await createCombinedAppointmentLettersPdf(employees, location);
  if (pdf) await emailOrganizationAppointmentLetters(location.id, pdf);
}

function OrganizationEmployeesPage({ organizationId, organizationName, location, onViewingChange }: OrganizationEmployeesPageProps) {
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
  const [movingEmployee, setMovingEmployee] = useState<Employee | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const isViewing = viewingEmployee !== null;

  useEffect(() => {
    onViewingChange?.(isViewing);
    if (isViewing) window.scrollTo({ top: 0 });
  }, [isViewing, onViewingChange]);

  useEffect(() => () => onViewingChange?.(false), [onViewingChange]);

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

  async function deliverAppointmentLetters(letterEmployees: Employee[], letterLocation: OrganizationLocation) {
    const [emailResults, organizationResult] = await Promise.all([
      sendAppointmentLetters(letterEmployees, letterLocation),
      sendOrganizationAppointmentLetters(letterEmployees, letterLocation).then(() => undefined, (error: unknown) => ({ error })),
    ]);
    const organizationEmailError = organizationResult?.error;
    const failedEmails = emailResults.filter((result) => result.status === 'rejected');
    if (failedEmails.length === 0 && !organizationEmailError) {
      toast({
        title: letterEmployees.length === 1 ? 'Appointment letter emailed to employee and organization' : 'Appointment letters emailed to employees and organization',
        status: 'success',
        position: 'top',
      });
      return;
    }
    if (failedEmails.length > 0) {
      const message = getErrorMessage(failedEmails[0].reason, 'Appointment letters could not be emailed.');
      toast({ title: failedEmails.length === letterEmployees.length ? message : `${failedEmails.length} appointment letter${failedEmails.length === 1 ? '' : 's'} could not be emailed: ${message}`, status: 'error', position: 'top' });
    }
    if (organizationEmailError) {
      toast({ title: getErrorMessage(organizationEmailError, 'Appointment letters could not be emailed to the organization.'), status: 'error', position: 'top' });
    }
  }

  async function handleAssign(employeeIds: string[]): Promise<boolean> {
    setIsAssigning(true);
    try {
      const assignedEmployees = await employees.assignMany(employeeIds, organizationId, location.id);
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

  async function handleMove(targetOrganizationId: string, targetLocation: OrganizationLocation, targetOrganizationName: string) {
    if (!movingEmployee) return;
    setIsMoving(true);
    try {
      const movedEmployees = await employees.transferMany([movingEmployee.id], targetOrganizationId, targetLocation.id);
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
                <ActionButton tone="neutral" size="sm" leftIcon={<AddIcon boxSize={2.5} />} onClick={assignmentDialog.onOpen}>
                  Assign existing
                </ActionButton>
                <ActionButton size="sm" leftIcon={<AddIcon boxSize={2.5} />} onClick={openCreateDialog}>
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
        onMove={(targetOrganizationId, targetLocation, targetOrganizationName) => void handleMove(targetOrganizationId, targetLocation, targetOrganizationName)}
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