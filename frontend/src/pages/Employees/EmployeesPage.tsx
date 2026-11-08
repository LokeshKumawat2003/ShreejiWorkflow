import { AddIcon, AttachmentIcon } from '@chakra-ui/icons';
import { Box, Button, Heading, HStack, Stack, Text, useDisclosure, useToast } from '@chakra-ui/react';
import { useRef, useState } from 'react';
import { ApiError } from '../../services/api';
import { createAppointmentLetterPdf, downloadAppointmentLetters } from '../../services/appointmentLetterService';
import { listOrganizationLocations } from '../../services/locationService';
import type { Employee, OrganizationLocation, UserRole } from '../../types';
import type { PdfAction } from '../../utils/pdfOutput';
import AppointmentLetterPreviewDialog from './components/AppointmentLetterPreviewDialog';
import AssignEmployeeDialog from './components/AssignEmployeeDialog';
import type { PostSelection } from './components/AssignPostDialog';
import DeleteEmployeeDialog from './components/DeleteEmployeeDialog';
import EmployeeDetailsPage from './components/EmployeeDetailsPage';
import EmployeeFormDialog from './components/EmployeeFormDialog';
import EmployeeImportDialog from './components/EmployeeImportDialog';
import EmployeeTable from './components/EmployeeTable';
import { useAppointmentLetterDelivery } from './hooks/useAppointmentLetterDelivery';
import { useEmployees } from './hooks/useEmployees';
import type { EmployeeInput } from '../../services/employeeService';

type EmployeesPageProps = { role: UserRole; organizationId?: string };
type OrganizationEmployeesPageProps = EmployeesPageProps & { organizationName?: string; currentUserId?: string };
type LetterAction = PdfAction | 'view';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function EmployeesPage({ role, organizationId, organizationName, currentUserId }: OrganizationEmployeesPageProps) {
  const toast = useToast();
  const deliverAppointmentLetters = useAppointmentLetterDelivery();
  const employees = useEmployees(organizationId, role === 'organization' || Boolean(organizationId));
  const formDialog = useDisclosure();
  const assignmentDialog = useDisclosure();
  const importDialog = useDisclosure();
  const deleteDialog = useDisclosure();
  const [formEmployee, setFormEmployee] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [isViewing, setIsViewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [preview, setPreview] = useState<{ employee: Employee; url: string | null } | null>(null);
  const locationsRef = useRef<Promise<OrganizationLocation[]> | null>(null);
  const canUseLetters = role === 'organization' && Boolean(currentUserId);

  function loadOwnLocations() {
    if (!locationsRef.current && currentUserId) {
      locationsRef.current = listOrganizationLocations(currentUserId, { limit: 100 })
        .then((response) => response.locations)
        .catch((error: unknown) => {
          locationsRef.current = null;
          throw error;
        });
    }
    return locationsRef.current ?? Promise.resolve([]);
  }

  async function handleLetter(employee: Employee, action: LetterAction) {
    if (action === 'view') {
      setPreview((current) => {
        if (current?.url) URL.revokeObjectURL(current.url);
        return { employee, url: null };
      });
    }
    try {
      const location = employee.locationId ? (await loadOwnLocations()).find((item) => item.id === employee.locationId) : undefined;
      if (!location) {
        if (action === 'view') setPreview(null);
        toast({ title: `${employee.name} is not placed at a location yet, so no appointment letter is available.`, status: 'warning', position: 'top' });
        return;
      }
      if (action === 'view') {
        const url = URL.createObjectURL(await createAppointmentLetterPdf(employee, location));
        setPreview((current) => {
          if (current?.employee.id !== employee.id || current.url) {
            URL.revokeObjectURL(url);
            return current;
          }
          return { employee, url };
        });
        return;
      }
      await downloadAppointmentLetters([employee], location, action);
    } catch (error) {
      if (action === 'view') setPreview(null);
      toast({ title: getErrorMessage(error, 'Unable to generate the appointment letter.'), status: 'error', position: 'top' });
    }
  }

  function closePreview() {
    setPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  }

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

  async function handleSave(input: EmployeeInput, post: PostSelection | null): Promise<boolean> {
    setIsSaving(true);
    try {
      const previousLocationId = formEmployee?.locationId || '';
      let savedEmployee: Employee;
      if (formEmployee) {
        savedEmployee = await employees.update(formEmployee.id, input);
        setViewingEmployee((current) => current?.id === savedEmployee.id ? savedEmployee : current);
      } else {
        savedEmployee = await employees.create(input);
      }
      const place = post ? [post.organizationName, post.locationName].filter(Boolean).join(' · ') : '';
      const isNewPlacement = Boolean(post?.location) && savedEmployee.locationId === post?.location?.id && previousLocationId !== post?.location?.id;
      toast({
        title: `${formEmployee ? 'Employee updated' : 'Employee added'}${place ? ` and assigned to ${place}` : ''}`,
        description: isNewPlacement ? 'Preparing the appointment letter…' : undefined,
        status: 'success',
        position: 'top',
      });
      if (isNewPlacement && post?.location) void deliverAppointmentLetters([savedEmployee], post.location);
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
      await employees.remove(deletingEmployee.id);
      toast({ title: 'Employee deleted', status: 'success', position: 'top' });
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
          onAppointmentLetter={canUseLetters ? (action) => void handleLetter(viewingEmployee, action) : undefined}
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
                <Button h="40px" px={5} borderRadius="full" fontSize="sm" leftIcon={<AttachmentIcon boxSize={3} />} variant="outline" onClick={importDialog.onOpen}>
                  Import from Excel
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
            deleteLabel="Delete employee"
            onDelete={role === 'admin' ? (employee) => {
              setDeletingEmployee(employee);
              deleteDialog.onOpen();
            } : undefined}
            onViewLetter={canUseLetters ? (employee) => void handleLetter(employee, 'view') : undefined}
            onDownloadLetter={canUseLetters ? (employee) => void handleLetter(employee, 'download') : undefined}
            onPrintLetter={canUseLetters ? (employee) => void handleLetter(employee, 'print') : undefined}
          />
        </Stack>
      )}

      <EmployeeFormDialog
        isOpen={formDialog.isOpen}
        isSaving={isSaving}
        employee={formEmployee}
        allowPostAssignment={role === 'admin' && !organizationId}
        organizationId={organizationId}
        onClose={closeFormDialog}
        onSave={handleSave}
      />
      {role === 'admin' && (
        <EmployeeImportDialog
          isOpen={importDialog.isOpen}
          organizationName={organizationId ? organizationName || 'this organization' : undefined}
          onClose={importDialog.onClose}
          onImport={employees.importFile}
        />
      )}
      {role === 'admin' && organizationId && (
        <AssignEmployeeDialog
          isOpen={assignmentDialog.isOpen}
          isSaving={isAssigning}
          organizationName={organizationName || 'this organization'}
          onClose={assignmentDialog.onClose}
          onAssign={handleAssign}
        />
      )}
      {canUseLetters && (
        <AppointmentLetterPreviewDialog
          isOpen={Boolean(preview)}
          employeeName={preview?.employee.name || ''}
          url={preview?.url ?? null}
          onClose={closePreview}
          onAction={(action) => {
            if (preview) void handleLetter(preview.employee, action);
          }}
        />
      )}
      <DeleteEmployeeDialog
        isOpen={deleteDialog.isOpen}
        employee={deletingEmployee}
        isDeleting={isDeleting}
        action="delete"
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