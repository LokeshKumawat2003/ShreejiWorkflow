export type AttendancePoint = {
  month: string;
  present: number;
  absent: number;
};

export type FinancialPoint = {
  month: string;
  expenses: number;
  payroll: number;
};

export type ExpenseCategory = {
  name: string;
  value: number;
};

export type ChartState = {
  isLoading: boolean;
  hasError: boolean;
};

export const chartColors = [
  '#4F46E5',
  '#0F9F94',
  '#F59E0B',
  '#EF6B6B',
  '#64748B',
  '#8B5CF6',
];

export const panelStyle = {
  p: { base: 4, md: 5 },
  border: '1px solid',
  borderColor: '#E8EDF5',
  borderRadius: '16px',
  bg: 'white',
  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.025)',
  minW: 0,
  transition: 'box-shadow 0.2s ease',
  _hover: {
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
  },
} as const;

export const axisStyle = {
  fill: '#94A3B8',
  fontSize: 11,
  fontWeight: 500,
};

export const tooltipStyle = {
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  borderRadius: '12px',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
  fontSize: 12,
  padding: '10px 14px',
};

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

export const formatCurrencyTick = (value: number) =>
  value >= 1000
    ? `$${Number((value / 1000).toFixed(1))}k`
    : `$${value}`;
