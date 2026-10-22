import { Box, Flex, HStack, Text } from '@chakra-ui/react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { chartColors, panelStyle, tooltipStyle, type ChartState, type DistributionItem } from './chartShared';
import { ChartHeader, ChartMessage } from './ChartPrimitives';

type DistributionChartProps = ChartState & {
  data: DistributionItem[];
  title: string;
  subtitle: string;
  label?: string;
  centerLabel?: string;
  emptyMessage?: string;
};

function DistributionChart({
  data,
  isLoading,
  hasError,
  title,
  subtitle,
  label,
  centerLabel = 'Total',
  emptyMessage = 'No data available yet.',
}: DistributionChartProps) {
  const positiveData = data.filter((item) => item.value > 0);
  const total = positiveData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Box {...panelStyle}>
      <ChartHeader title={title} subtitle={subtitle} label={label} />
      {isLoading ? (
        <ChartMessage>Loading...</ChartMessage>
      ) : hasError ? (
        <ChartMessage>Unable to load this chart.</ChartMessage>
      ) : total > 0 ? (
        <>
          <Box position="relative" h="220px" w="100%">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={positiveData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={62} outerRadius={90} paddingAngle={3} cornerRadius={4} stroke="none">
                  {positiveData.map((entry, index) => (
                    <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <Flex position="absolute" inset={0} direction="column" align="center" justify="center" pointerEvents="none">
              <Text fontSize="xs" color="slate.400" fontWeight="500">{centerLabel}</Text>
              <Text fontSize="xl" fontWeight="800" color="slate.900">{total}</Text>
            </Flex>
          </Box>
          <Flex wrap="wrap" gap={2} mt={3}>
            {positiveData.map((item, index) => (
              <Flex key={item.name} w={{ base: '100%', sm: 'calc(50% - 4px)' }} minW={0} align="center" justify="space-between" gap={2}>
                <HStack spacing={2} minW={0}>
                  <Box w="9px" h="9px" borderRadius="full" bg={chartColors[index % chartColors.length]} flexShrink={0} />
                  <Text fontSize="xs" color="slate.500" noOfLines={1}>{item.name}</Text>
                </HStack>
                <Text fontSize="xs" color="slate.700" fontWeight="600" whiteSpace="nowrap">
                  {item.value} · {Math.round((item.value / total) * 100)}%
                </Text>
              </Flex>
            ))}
          </Flex>
        </>
      ) : (
        <ChartMessage>{emptyMessage}</ChartMessage>
      )}
    </Box>
  );
}

export default DistributionChart;
