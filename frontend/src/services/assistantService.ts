import api from './api';

export type AssistantDocumentType = 'salary_slip' | 'payroll' | 'wage_register' | 'attendance_register' | 'bank_invoice' | 'payroll_run' | 'client_invoice';
export type AssistantFormat = 'pdf' | 'excel';

export type AssistantDocument = {
  type: AssistantDocumentType;
  format: AssistantFormat;
  month: string;
  organizationId: string | null;
  locationId: string | null;
  employeeIds: string[] | null;
  batchId?: string | null;
  reprint?: boolean;
  title: string;
};

export type AssistantPlan = {
	type: AssistantDocumentType | 'mark_attendance' | 'edit_attendance' | 'salary_amount' | 'employee_attendance' | 'cancel';
  format?: AssistantFormat;
  month?: string;
  organizationId?: string | null;
  locationId?: string | null;
  locationIds?: string[];
  batchId?: string | null;
  employeeId?: string | null;
	status?: string | null;
	restStatus?: string | null;
  dates?: string[];
  count?: number | null;
	confirm?: boolean;
	latest?: boolean;
	full?: boolean;
};

export type AssistantChoice = { label: string; plan: AssistantPlan };

export type AssistantResponse = {
  reply: string;
  source: 'ai' | 'rules' | 'plan' | 'data';
  document?: AssistantDocument;
	choices?: AssistantChoice[];
	sessionId: string;
};

export type AssistantSessionMessage = { role: 'user' | 'assistant'; content: string; document?: AssistantDocument };

export async function askAssistant(
  input: { message?: string; plan?: AssistantPlan; label?: string; sessionId?: string | null; language?: string },
  signal?: AbortSignal,
) {
  const { data } = await api.post<AssistantResponse>('/assistant/chat', {
    ...input,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }, { signal, timeout: 60_000 });
  return data;
}

export async function getAssistantSession(sessionId: string) {
  const { data } = await api.get<{ sessionId: string; messages: AssistantSessionMessage[] }>(`/assistant/session/${sessionId}`);
  return data;
}

export async function deleteAssistantSession(sessionId: string) {
  await api.delete(`/assistant/session/${sessionId}`);
}
