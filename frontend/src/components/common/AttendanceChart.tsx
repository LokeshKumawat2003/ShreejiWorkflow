import { Box } from '@chakra-ui/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  panelStyle,
  axisStyle,
  tooltipStyle,
  type AttendancePoint,
  type ChartState,
} from './chartShared';
import { ChartHeader, ChartLegend, ChartMessage } from './ChartPrimitives';

type AttendanceChartProps = ChartState & {
  data: AttendancePoint[];
};

function AttendanceChart({ data, isLoading, hasError }: AttendanceChartProps) {
  const hasData = data.some(({ present, absent }) => present + absent > 0);

  return (
    <Box {...panelStyle}>
      <ChartHeader
        title="Attendance Overview"
        subtitle="Monthly attendance records"
        label="ATTENDANCE"
      />
      {isLoading ? (
        <ChartMessage>Loading attendance data...</ChartMessage>
      ) : hasError ? (
        <ChartMessage>Sign in and reload to view attendance data.</ChartMessage>
      ) : hasData ? (
        <>
          <Box h="260px" w="100%">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                barGap={5}
                barCategoryGap="25%"
                margin={{ top: 8, right: 4, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="#F1F5F9"
                  vertical={false}
                  strokeDasharray="4 4"
                />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={axisStyle}
                  dy={8}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={axisStyle}
                  width={36}
                />
                <Tooltip
                  cursor={{ fill: '#F8FAFC' }}
                  contentStyle={tooltipStyle}
                  labelStyle={{
                    color: '#0F172A',
                    fontWeight: 700,
                    marginBottom: 5,
                  }}
                />
                <Bar
                  dataKey="present"
                  name="Present"
                  fill="#4F46E5"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={24}
                />
                <Bar
                  dataKey="absent"
                  name="Absent"
                  fill="#F87171"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
          <ChartLegend
            items={[
              { label: 'Present', color: '#4F46E5' },
              { label: 'Absent', color: '#F87171' },
            ]}
          />
        </>
      ) : (
        <ChartMessage>No attendance records available yet.</ChartMessage>
      )}
    </Box>
  );
}

export default AttendanceChart;