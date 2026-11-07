import { Box, Flex, HStack, Text, Tooltip } from '@chakra-ui/react';
import { ActionButton, ContentCard, DataTable, MapPinIcon, StatusBadge, type DataTableColumn } from '../../../components/ui';
import type { DashboardLocation } from '../../../services/dashboardService';

type LocationAttendanceCardProps = {
	locations: DashboardLocation[];
	isSunday: boolean;
	isLoading: boolean;
	onOpenAttendance: () => void;
};

const todaySegments = [
	{ key: 'present', label: 'Present', color: 'green.500' },
	{ key: 'halfDay', label: 'Half day', color: 'yellow.400' },
	{ key: 'leave', label: 'Leave', color: 'blue.400' },
	{ key: 'absent', label: 'Absent', color: 'red.400' },
	{ key: 'off', label: 'Off / holiday', color: 'purple.400' },
	{ key: 'notMarked', label: 'Not marked', color: 'slate.300' },
] as const;

function rateColor(rate: number) {
	if (rate >= 90) return 'green.600';
	if (rate >= 75) return 'orange.500';
	return 'red.500';
}

function LocationAttendanceCard({ locations, isSunday, isLoading, onOpenAttendance }: LocationAttendanceCardProps) {
	const columns: DataTableColumn<DashboardLocation>[] = [
		{
			key: 'site',
			header: 'Location',
			render: (site) => (
				<Box minW={0}>
					<HStack spacing={2}>
						<Text fontWeight="600" color="slate.900" noOfLines={1}>{site.name}</Text>
						{site.status === 'disabled' ? <StatusBadge status="disabled" /> : null}
					</HStack>
					<Text fontSize="xs" color="slate.500" noOfLines={1}>{[site.designation, site.place].filter(Boolean).join(' · ')}</Text>
				</Box>
			),
		},
		{ key: 'employees', header: 'Staff', align: 'right', render: (site) => <Text fontWeight="600">{site.employees}</Text> },
		{
			key: 'today',
			header: isSunday ? 'Today (Sunday off)' : 'Today',
			hideBelow: 'md',
			render: (site) => {
				const total = todaySegments.reduce((sum, segment) => sum + site.today[segment.key], 0);
				const summary = todaySegments.filter((segment) => site.today[segment.key] > 0).map((segment) => `${segment.label}: ${site.today[segment.key]}`).join(' · ');
				return total ? (
					<Tooltip label={summary} hasArrow>
						<Box minW="140px">
							<Flex h="8px" borderRadius="full" overflow="hidden" bg="slate.100">
								{todaySegments.map((segment) => (
									<Box key={segment.key} w={`${(site.today[segment.key] / total) * 100}%`} bg={segment.color} />
								))}
							</Flex>
							<Text mt={1} fontSize="xs" color="slate.500">
								{site.today.present + site.today.halfDay} in · {site.today.absent} absent{site.today.notMarked ? ` · ${site.today.notMarked} pending` : ''}
							</Text>
						</Box>
					</Tooltip>
				) : <Text fontSize="xs" color="slate.400">No staff placed</Text>;
			},
		},
		{
			key: 'month',
			header: 'Month rate',
			align: 'right',
			render: (site) => (site.monthRate === null
				? <Text fontSize="xs" color="slate.400">—</Text>
				: <Text fontWeight="700" color={rateColor(site.monthRate)}>{site.monthRate}%</Text>),
		},
	];

	return (
		<ContentCard
			title="Attendance by location"
			subtitle="Today's marks and this month's attendance rate per site"
			icon={<MapPinIcon boxSize={5} />}
			noPadding
			actions={<ActionButton tone="neutral" size="sm" onClick={onOpenAttendance}>Open attendance</ActionButton>}
		>
			<DataTable
				columns={columns}
				rows={locations}
				rowKey={(site) => site.id}
				onRowClick={onOpenAttendance}
				isLoading={isLoading}
				emptyTitle="No locations yet"
				emptyDescription="Locations added for your organization will show up here."
			/>
		</ContentCard>
	);
}

export default LocationAttendanceCard;
