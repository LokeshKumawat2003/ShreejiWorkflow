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
  type: AssistantDocumentType | 'mark_attendance' | 'edit_attendance' | 'salary_amount' | 'employee_attendance' | 'cancel' | string;
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
  pendingActionId?: string;
};

export type AssistantChoice = { label: string; plan: AssistantPlan };

export type AssistantExecution = {
  status?: string;
  verified?: boolean;
};

export type AssistantPendingAction = {
  id: string;
  toolName?: string;
  summary?: string;
  expiresAt?: string;
  status?: string;
};

export type AssistantResponse = {
  success?: boolean;
  reply: string;
  source: 'ai' | 'rules' | 'plan' | 'data' | 'tool' | 'validation' | 'pending_action';
  document?: AssistantDocument;
  choices?: AssistantChoice[];
  sessionId: string;
  intent?: string;
  pendingAction?: AssistantPendingAction | null;
  execution?: AssistantExecution;
  data?: unknown;
  error?: { code?: string; message?: string; retryable?: boolean };
};

export type AssistantSessionMessage = { role: 'user' | 'assistant'; content: string; document?: AssistantDocument };

export type AssistantFeedbackType =
  | 'correct_answer'
  | 'incorrect_answer'
  | 'wrong_intent'
  | 'missing_details'
  | 'wrong_calculation'
  | 'failed_action'
  | 'irrelevant_response'
  | 'language_issue';

export type AssistantFeedbackSummary = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  repeatedErrors: Array<{ type: string; count: number }>;
};

export async function askAssistant(
  input: {
    message?: string;
    plan?: AssistantPlan;
    label?: string;
    sessionId?: string | null;
    language?: string;
    confirmPendingActionId?: string;
    cancel?: boolean;
  },
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

export async function submitAssistantFeedback(input: {
  type: AssistantFeedbackType;
  sessionId?: string | null;
  originalRequest?: string;
  assistantResponse?: string;
  detectedIntent?: string;
  toolName?: string;
  correction?: string;
  expectedBehaviour?: string;
}) {
  const { data } = await api.post('/assistant/feedback', input);
  return data as { success: boolean; feedback: { id: string; type: string; status: string } };
}

export async function listAssistantFeedback(status?: string) {
  const { data } = await api.get('/assistant/feedback', { params: status ? { status } : undefined });
  return data as {
    success: boolean;
    summary: AssistantFeedbackSummary;
    items: Array<{
      id: string;
      type: string;
      status: string;
      originalRequest: string;
      assistantResponse: string;
      correction: string;
      expectedBehaviour: string;
      createdAt: string;
    }>;
  };
}

export async function reviewAssistantFeedback(id: string, body: { status: 'approved' | 'rejected'; reviewNote?: string }) {
  const { data } = await api.post(`/assistant/feedback/${id}/review`, body);
  return data;
}
