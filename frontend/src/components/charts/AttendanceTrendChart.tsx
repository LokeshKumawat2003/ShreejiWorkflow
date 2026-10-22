import { Box } from '@chakra-ui/react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisStyle, panelStyle, tooltipStyle, type AttendancePoint, type ChartState } from './chartShared';
import { ChartHeader, ChartLegend, ChartMessage } from './ChartPrimitives';

type AttendanceTrendChartProps = ChartState & {
  data: AttendancePoint[];
  title?: string;
  subtitle?: string;
};

const PRESENT_COLOR = '#22C55E';
const ABSENT_COLOR = '#F87171';

function AttendanceTrendChart({
  data,
  isLoading,
  hasError,
  title = 'Attendance trend',
  subtitle = 'Present and absent marks per day',
}: AttendanceTrendChartProps) {
  const hasData = data.some(({ present, absent }) => present + absent > 0);

  return (
    <Box {...panelStyle}>
      <ChartHeader title={title} subtitle={subtitle} label="ATTENDANCE" />
      {isLoading ? (
        <ChartMessage>Loading attendance data...</ChartMessage>
      ) : hasError ? (
        <ChartMessage>Unable to load attendance data.</ChartMessage>
      ) : hasData ? (
        <>
          <Box h="260px" w="100%">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} barGap={4} barCategoryGap="25%" margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#F1F5F9" vertical={false} strokeDasharray="4 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisStyle} dy={8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={axisStyle} width={36} />
                <Tooltip cursor={{ fill: '#F8FAFC' }} contentStyle={tooltipStyle} labelStyle={{ color: '#0F172A', fontWeight: 700, marginBottom: 5 }} />
                <Bar dataKey="present" name="Present" fill={PRESENT_COLOR} radius={[5, 5, 0, 0]} maxBarSize={24} />
                <Bar dataKey="absent" name="Absent" fill={ABSENT_COLOR} radius={[5, 5, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
          <ChartLegend items={[{ label: 'Present', color: PRESENT_COLOR }, { label: 'Absent', color: ABSENT_COLOR }]} />
        </>
      ) : (
        <ChartMessage>No attendance marked in this period.</ChartMessage>
      )}
    </Box>
  );
}

export default AttendanceTrendChart;
