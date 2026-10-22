export type AttendancePoint = {
  label: string;
  present: number;
  absent: number;
};

export type DistributionItem = {
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
  '#8B5CF6',
  '#0EA5E9',
  '#64748B',
];

export const panelStyle = {
  p: { base: 4, md: 5 },
  border: '1px solid',
  borderColor: 'slate.200',
  borderRadius: 'lg',
  bg: 'white',
  boxShadow: 'sm',
  minW: 0,
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
