import { Box, Flex, HStack, Text } from '@chakra-ui/react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  chartColors,
  formatCurrency,
  panelStyle,
  tooltipStyle,
  type ChartState,
  type ExpenseCategory,
} from './chartShared';
import { ChartHeader, ChartMessage } from './ChartPrimitives';

type ExpenseBreakdownChartProps = ChartState & {
  data: ExpenseCategory[];
};

function ExpenseBreakdownChart({
  data,
  isLoading,
  hasError,
}: ExpenseBreakdownChartProps) {
  const hasData = data.some((item) => item.value > 0);
  const total = data.reduce(
    (sum, item) => sum + Math.max(0, item.value),
    0,
  );
  const positiveData = data.filter((item) => item.value > 0);

  return (
    <Box {...panelStyle}>
      <ChartHeader
        title="Expenses by Category"
        subtitle="Breakdown of submitted expenses"
        label="BREAKDOWN"
      />
      {isLoading ? (
        <ChartMessage>Loading expense categories...</ChartMessage>
      ) : hasError ? (
        <ChartMessage>Sign in and reload to view expense categories.</ChartMessage>
      ) : hasData ? (
        <>
          <Box position="relative" h="260px" w="100%">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={positiveData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="47%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={4}
                  cornerRadius={5}
                  stroke="none"
                >
                  {positiveData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={chartColors[index % chartColors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={tooltipStyle}
                />
              </PieChart>
            </ResponsiveContainer>
            <Flex
              position="absolute"
              top="47%"
              left="50%"
              transform="translate(-50%, -50%)"
              direction="column"
              align="center"
              justify="center"
              pointerEvents="none"
              w="130px"
            >
              <Text fontSize="xs" color="#94A3B8" fontWeight="500">
                Total Expenses
              </Text>
              <Text
                fontSize={{ base: 'lg', md: 'xl' }}
                fontWeight="800"
                color="#0F172A"
                textAlign="center"
              >
                {formatCurrency(total)}
              </Text>
            </Flex>
          </Box>
          <Flex wrap="wrap" gap={3} mt={2}>
            {positiveData.map((item, index) => {
              const percentage = Math.round((item.value / total) * 100);
              const color = chartColors[index % chartColors.length];

              return (
                <Flex
                  key={item.name}
                  w={{ base: '100%', sm: 'calc(50% - 8px)' }}
                  minW={0}
                  align="center"
                  justify="space-between"
                  gap={2}
                >
                  <HStack spacing={2} minW={0}>
                    <Box
                      w="9px"
                      h="9px"
                      borderRadius="full"
                      bg={color}
                      flexShrink={0}
                    />
                    <Text fontSize="xs" color="#64748B" noOfLines={1}>
                      {item.name}
                    </Text>
                  </HStack>
                  <Text
                    fontSize="xs"
                    color="#334155"
                    fontWeight="600"
                    whiteSpace="nowrap"
                  >
                    {percentage}%
                  </Text>
                </Flex>
              );
            })}
          </Flex>
        </>
      ) : (
        <ChartMessage>No expense categories available yet.</ChartMessage>
      )}
    </Box>
  );
}

export default ExpenseBreakdownChart;