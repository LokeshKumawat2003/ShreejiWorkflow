import { useToast } from '@chakra-ui/react';
import { useCallback } from 'react';
import { ApiError } from '../../../services/api';
import { createAppointmentLetterPdf, createCombinedAppointmentLettersPdf } from '../../../services/appointmentLetterService';
import { emailAppointmentLetter, emailOrganizationAppointmentLetters } from '../../../services/employeeService';
import type { Employee, OrganizationLocation } from '../../../types';

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

/** Generates appointment letters for employees just placed at a location and emails them to each employee and the organization. */
export function useAppointmentLetterDelivery() {
  const toast = useToast();

  return useCallback(async (employees: Employee[], location: OrganizationLocation) => {
    if (employees.length === 0) return;
    const [emailResults, organizationResult] = await Promise.all([
      sendAppointmentLetters(employees, location),
      sendOrganizationAppointmentLetters(employees, location).then(() => undefined, (error: unknown) => ({ error })),
    ]);
    const organizationEmailError = organizationResult?.error;
    const failedEmails = emailResults.filter((result) => result.status === 'rejected');
    if (failedEmails.length === 0 && !organizationEmailError) {
      toast({
        title: employees.length === 1 ? 'Appointment letter emailed to employee and organization' : 'Appointment letters emailed to employees and organization',
        status: 'success',
        position: 'top',
      });
      return;
    }
    if (failedEmails.length > 0) {
      const message = getErrorMessage(failedEmails[0].reason, 'Appointment letters could not be emailed.');
      toast({ title: failedEmails.length === employees.length ? message : `${failedEmails.length} appointment letter${failedEmails.length === 1 ? '' : 's'} could not be emailed: ${message}`, status: 'error', position: 'top' });
    }
    if (organizationEmailError) {
      toast({ title: getErrorMessage(organizationEmailError, 'Appointment letters could not be emailed to the organization.'), status: 'error', position: 'top' });
    }
  }, [toast]);
}
