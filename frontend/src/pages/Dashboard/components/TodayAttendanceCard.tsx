import { CheckCircleIcon } from '@chakra-ui/icons';
import { Alert, Box, Flex, HStack, Skeleton, Stack, Text } from '@chakra-ui/react';
import { ContentCard } from '../../../components/ui';
import type { DashboardSummary } from '../../../services/dashboardService';

type TodayAttendanceCardProps = {
	counts: DashboardSummary['today'] | null;
	dateLabel: string;
	isLoading: boolean;
};

const segments = [
	{ key: 'present', label: 'Present', color: 'green.500', bg: 'green.50' },
	{ key: 'halfDay', label: 'Half day', color: 'yellow.400', bg: 'yellow.50' },
	{ key: 'leave', label: 'On leave', color: 'blue.400', bg: 'blue.50' },
	{ key: 'absent', label: 'Absent', color: 'red.400', bg: 'red.50' },
	{ key: 'off', label: 'Weekly off / holiday', color: 'purple.400', bg: 'purple.50' },
	{ key: 'notMarked', label: 'Not marked', color: 'slate.300', bg: 'slate.100' },
] as const;

function TodayAttendanceCard({ counts, dateLabel, isLoading }: TodayAttendanceCardProps) {
	const total = counts ? segments.reduce((sum, segment) => sum + counts[segment.key], 0) : 0;
	const marked = counts ? total - counts.notMarked : 0;
	const markedPercent = total ? Math.round((marked / total) * 100) : 0;
	const visible = segments.filter((segment) => ['present', 'absent', 'notMarked'].includes(segment.key) || (counts?.[segment.key] ?? 0) > 0);

	return (
		<ContentCard title="Today's attendance" subtitle={dateLabel} icon={<CheckCircleIcon />} h="100%">
			{isLoading || !counts ? (
				<Stack spacing={3}>
					<Skeleton h="56px" borderRadius="md" />
					<Skeleton h="12px" borderRadius="full" />
					<Skeleton h="80px" borderRadius="md" />
				</Stack>
			) : (
				<Stack spacing={5}>
					{counts.isSunday ? (
						<Alert status="info" borderRadius="md" fontSize="sm">Sunday is a weekly off — no attendance needs marking today.</Alert>
					) : (
						<Flex align="baseline" justify="space-between">
							<Box>
								<Text fontSize="3xl" fontWeight="800" color="slate.900" lineHeight="1">{markedPercent}%</Text>
								<Text fontSize="xs" color="slate.500" mt={1}>of active employees marked</Text>
							</Box>
							<Text fontSize="sm" fontWeight="600" color="slate.500">{marked}/{total}</Text>
						</Flex>
					)}
					<Flex h="10px" borderRadius="full" overflow="hidden" bg="slate.100">
						{segments.map((segment) => (
							<Box key={segment.key} w={total ? `${(counts[segment.key] / total) * 100}%` : 0} bg={segment.color} transition="width 0.3s ease" />
						))}
					</Flex>
					<Stack spacing={2}>
						{visible.map((segment) => (
							<HStack key={segment.key} justify="space-between" px={3} py={2} borderRadius="md" bg={segment.bg}>
								<HStack spacing={2}>
									<Box w="8px" h="8px" borderRadius="full" bg={segment.color} />
									<Text fontSize="sm" color="slate.700">{segment.label}</Text>
								</HStack>
								<Text fontSize="sm" fontWeight="700" color="slate.900">{counts[segment.key]}</Text>
							</HStack>
						))}
					</Stack>
				</Stack>
			)}
		</ContentCard>
	);
}

export default TodayAttendanceCard;
