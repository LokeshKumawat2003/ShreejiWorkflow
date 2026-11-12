import type {
  AttendanceRegisterMark,
  AttendanceStatus,
  MarkConfidence,
  UploadMarkStatus,
} from '../../../services/attendanceService';

type MarkStyle = { label: string; code: string; bg: string; color: string; border: string; hover: string };
type StatusStyle = MarkStyle & { code: Exclude<AttendanceRegisterMark, ''> };

export const ATTENDANCE_STATUS_META: Record<AttendanceStatus, StatusStyle> = {
  present: { label: 'Present', code: 'P', bg: 'green.50', color: 'green.700', border: 'green.200', hover: 'green.100' },
  absent: { label: 'Absent', code: 'A', bg: 'red.50', color: 'red.600', border: 'red.200', hover: 'red.100' },
  half_day: { label: 'Half Day', code: 'HD', bg: 'teal.50', color: 'teal.700', border: 'teal.200', hover: 'teal.100' },
  leave: { label: 'Leave', code: 'L', bg: 'purple.50', color: 'purple.700', border: 'purple.200', hover: 'purple.100' },
  paid_leave: { label: 'Paid Leave', code: 'PL', bg: 'blue.50', color: 'blue.700', border: 'blue.200', hover: 'blue.100' },
  casual_leave: { label: 'Casual Leave', code: 'CL', bg: 'purple.50', color: 'purple.700', border: 'purple.200', hover: 'purple.100' },
  sick_leave: { label: 'Sick Leave', code: 'SL', bg: 'pink.50', color: 'pink.700', border: 'pink.200', hover: 'pink.100' },
  weekly_off: { label: 'Weekly Off', code: 'WO', bg: 'gray.100', color: 'gray.600', border: 'gray.300', hover: 'gray.200' },
  holiday: { label: 'Holiday', code: 'H', bg: 'cyan.50', color: 'cyan.700', border: 'cyan.200', hover: 'cyan.100' },
};

export const ATTENDANCE_STATUSES = Object.keys(ATTENDANCE_STATUS_META) as AttendanceStatus[];

export const ATTENDANCE_STATUS_OPTIONS = ATTENDANCE_STATUSES.map((value) => ({
  value,
  label: `${ATTENDANCE_STATUS_META[value].label} (${ATTENDANCE_STATUS_META[value].code})`,
}));

export const NEEDS_REVIEW_META: MarkStyle = { label: 'Needs Review', code: '?', bg: 'yellow.100', color: 'yellow.800', border: 'yellow.400', hover: 'yellow.200' };

const NOT_MARKED_META: MarkStyle = { label: 'Not marked', code: '', bg: 'white', color: 'slate.400', border: 'slate.200', hover: 'slate.100' };

export const REGISTER_MARK_META = Object.fromEntries([
  ...ATTENDANCE_STATUSES.map((status) => [ATTENDANCE_STATUS_META[status].code, ATTENDANCE_STATUS_META[status]]),
  ['', NOT_MARKED_META],
]) as Record<AttendanceRegisterMark, MarkStyle>;

// A month counts at most 26 working days, even when it has 27 days other than Sundays.
export const MAX_MONTH_WORKING_DAYS = 26;

/** Register "Total" column: present days plus half of the half days, capped at 26. */
export function presentTotal(days: readonly string[]) {
	const total = days.reduce((sum, mark) => sum + (mark === 'P' ? 1 : mark === 'HD' ? 0.5 : 0), 0);
	return Math.min(MAX_MONTH_WORKING_DAYS, total);
}

export function statusLabel(status: UploadMarkStatus | null) {
  if (!status) return 'Not marked';
  if (status === 'needs_review') return NEEDS_REVIEW_META.label;
  return ATTENDANCE_STATUS_META[status].label;
}

export function statusCode(status: UploadMarkStatus | null) {
  if (!status) return '';
  if (status === 'needs_review') return NEEDS_REVIEW_META.code;
  return ATTENDANCE_STATUS_META[status].code;
}

export function statusStyle(status: UploadMarkStatus | null): MarkStyle {
  if (!status) return NOT_MARKED_META;
  if (status === 'needs_review') return NEEDS_REVIEW_META;
  return ATTENDANCE_STATUS_META[status];
}

export const CONFIDENCE_META: Record<MarkConfidence, { label: string; colorScheme: string }> = {
  high: { label: 'High', colorScheme: 'green' },
  medium: { label: 'Medium', colorScheme: 'yellow' },
  low: { label: 'Low', colorScheme: 'red' },
};
