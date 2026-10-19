import { Box } from '@chakra-ui/react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  formatCurrency,
  formatCurrencyTick,
  panelStyle,
  axisStyle,
  tooltipStyle,
  type ChartState,
  type FinancialPoint,
} from './chartShared';
import { ChartHeader, ChartLegend, ChartMessage } from './ChartPrimitives';

type FinancialChartProps = ChartState & {
  data: FinancialPoint[];
};

function FinancialChart({ data, isLoading, hasError }: FinancialChartProps) {
  const hasData = data.some(
    ({ expenses, payroll }) => expenses + payroll > 0,
  );

  return (
    <Box {...panelStyle}>
      <ChartHeader
        title="Expenses & Payroll"
        subtitle="Monthly financial trends in USD"
        label="FINANCIAL"
      />
      {isLoading ? (
        <ChartMessage>Loading financial data...</ChartMessage>
      ) : hasError ? (
        <ChartMessage>Sign in and reload to view financial data.</ChartMessage>
      ) : hasData ? (
        <>
          <Box h="260px" w="100%">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
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
                  tickFormatter={formatCurrencyTick}
                  tickLine={false}
                  axisLine={false}
                  tick={axisStyle}
                  width={52}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={tooltipStyle}
                  labelStyle={{
                    color: '#0F172A',
                    fontWeight: 700,
                    marginBottom: 5,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="payroll"
                  name="Payroll"
                  stroke="#4F46E5"
                  strokeWidth={3}
                  dot={{
                    r: 3,
                    fill: '#FFFFFF',
                    stroke: '#4F46E5',
                    strokeWidth: 2,
                  }}
                  activeDot={{
                    r: 6,
                    fill: '#4F46E5',
                    stroke: '#FFFFFF',
                    strokeWidth: 2,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  name="Expenses"
                  stroke="#0F9F94"
                  strokeWidth={3}
                  dot={{
                    r: 3,
                    fill: '#FFFFFF',
                    stroke: '#0F9F94',
                    strokeWidth: 2,
                  }}
                  activeDot={{
                    r: 6,
                    fill: '#0F9F94',
                    stroke: '#FFFFFF',
                    strokeWidth: 2,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
          <ChartLegend
            items={[
              { label: 'Payroll', color: '#4F46E5' },
              { label: 'Expenses', color: '#0F9F94' },
            ]}
          />
        </>
      ) : (
        <ChartMessage>No payroll or expense records available yet.</ChartMessage>
      )}
    </Box>
  );
}

export default FinancialChart;