import { Box } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisStyle, panelStyle, tooltipStyle, type AttendancePoint, type ChartState } from './chartShared';
import { ChartHeader, ChartLegend, ChartMessage } from './ChartPrimitives';
import { ChartSkeleton } from '../ui/Skeletons';

type AttendanceTrendChartProps = ChartState & {
  data: AttendancePoint[];
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
};

const SERIES = [
  { key: 'present', label: 'Present', color: '#22C55E' },
  { key: 'halfDay', label: 'Half day', color: '#FACC15' },
  { key: 'leave', label: 'Leave', color: '#60A5FA' },
  { key: 'absent', label: 'Absent', color: '#F87171' },
] as const;

function AttendanceTrendChart({
  data,
  isLoading,
  hasError,
  title = 'Attendance trend',
  subtitle = 'Attendance marks per day',
  actions,
}: AttendanceTrendChartProps) {
  const hasData = data.some((point) => SERIES.some(({ key }) => (point[key] ?? 0) > 0));
  const series = SERIES.filter(({ key }) => key === 'present' || key === 'absent' || data.some((point) => (point[key] ?? 0) > 0));

  return (
    <Box {...panelStyle}>
      <ChartHeader title={title} subtitle={subtitle} label="ATTENDANCE" actions={actions} />
      {isLoading ? (
        <ChartSkeleton />
      ) : hasError ? (
        <ChartMessage>Unable to load attendance data.</ChartMessage>
      ) : hasData ? (
        <>
          <Box h="260px" w="100%">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} barCategoryGap="25%" margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#F1F5F9" vertical={false} strokeDasharray="4 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisStyle} dy={8} minTickGap={8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={axisStyle} width={36} />
                <Tooltip cursor={{ fill: '#F8FAFC' }} contentStyle={tooltipStyle} labelStyle={{ color: '#0F172A', fontWeight: 700, marginBottom: 5 }} />
                {series.map((item, index) => (
                  <Bar
                    key={item.key}
                    dataKey={item.key}
                    name={item.label}
                    stackId="marks"
                    fill={item.color}
                    radius={index === series.length - 1 ? [5, 5, 0, 0] : 0}
                    maxBarSize={28}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Box>
          <ChartLegend items={series.map(({ label, color }) => ({ label, color }))} />
        </>
      ) : (
        <ChartMessage>No attendance marked in this period.</ChartMessage>
      )}
    </Box>
  );
}

export default AttendanceTrendChart;
