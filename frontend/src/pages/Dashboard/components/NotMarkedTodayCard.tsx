import { CheckCircleIcon, TimeIcon } from '@chakra-ui/icons';
import { Avatar, Box, Flex, HStack, Skeleton, Stack, Text } from '@chakra-ui/react';
import { ContentCard } from '../../../components/ui';
import type { DashboardSummary } from '../../../services/dashboardService';

type NotMarkedTodayCardProps = {
	employees: NonNullable<DashboardSummary['notMarkedToday']>;
	total: number;
	isSunday: boolean;
	isLoading: boolean;
};

function NotMarkedTodayCard({ employees, total, isSunday, isLoading }: NotMarkedTodayCardProps) {
	const remaining = total - employees.length;

	return (
		<ContentCard
			title="Not marked today"
			subtitle={isSunday ? 'Sunday is a weekly off' : `${total} active employee${total === 1 ? '' : 's'} without a mark`}
			icon={<TimeIcon />}
			h="100%"
		>
			{isLoading ? (
				<Stack spacing={3}>
					{[0, 1, 2].map((index) => <Skeleton key={index} h="44px" borderRadius="md" />)}
				</Stack>
			) : employees.length === 0 ? (
				<Flex direction="column" align="center" justify="center" py={8} gap={2} textAlign="center">
					<Flex w="44px" h="44px" align="center" justify="center" borderRadius="full" bg="green.50" color="green.500">
						<CheckCircleIcon />
					</Flex>
					<Text fontSize="sm" fontWeight="600" color="slate.800">{isSunday ? 'Nothing to mark today' : 'Everyone is marked'}</Text>
					<Text fontSize="xs" color="slate.500">{isSunday ? 'Attendance resumes on Monday.' : "Today's attendance is complete."}</Text>
				</Flex>
			) : (
				<Stack spacing={2}>
					{employees.map((employee) => (
						<HStack key={employee.id} spacing={3} px={3} py={2} borderRadius="md" border="1px solid" borderColor="slate.100">
							<Avatar size="sm" name={employee.name} bg="orange.100" color="orange.700" />
							<Box minW={0} flex="1">
								<Text fontSize="sm" fontWeight="600" color="slate.900" noOfLines={1}>{employee.name}</Text>
								<Text fontSize="xs" color="slate.500" noOfLines={1}>{[employee.designation, employee.locationName].filter(Boolean).join(' · ')}</Text>
							</Box>
						</HStack>
					))}
					{remaining > 0 ? <Text fontSize="xs" color="slate.500" textAlign="center" pt={1}>and {remaining} more</Text> : null}
				</Stack>
			)}
		</ContentCard>
	);
}

export default NotMarkedTodayCard;
