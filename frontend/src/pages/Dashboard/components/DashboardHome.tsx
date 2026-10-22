import { AddIcon, AtSignIcon, CalendarIcon, CheckCircleIcon, RepeatIcon, SettingsIcon, TimeIcon, WarningIcon } from '@chakra-ui/icons';
import { Alert, Avatar, Box, Grid, HStack, IconButton, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import AttendanceTrendChart from '../../../components/charts/AttendanceTrendChart';
import DistributionChart from '../../../components/charts/DistributionChart';
import {
	ActionButton,
	ContentCard,
	DataTable,
	PageHeader,
	StatCard,
	StatusBadge,
	type DataTableColumn,
} from '../../../components/ui';
import { ApiError } from '../../../services/api';
import { getDashboardSummary, type DashboardSummary } from '../../../services/dashboardService';
import type { User, UserRole } from '../../../types';
import TodayAttendanceCard from './TodayAttendanceCard';

type DashboardHomeProps = {
	user: User;
	role: UserRole;
	onNavigate: (tab: string) => void;
};

type RecentEmployee = DashboardSummary['recentEmployees'][number];

function formatDay(date: string, options: Intl.DateTimeFormatOptions) {
	const [year, month, day] = date.split('-').map(Number);
	return new Intl.DateTimeFormat(undefined, options).format(new Date(year, month - 1, day));
}

function formatCreated(value: string) {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function greeting() {
	const hour = new Date().getHours();
	if (hour < 12) return 'Good morning';
	if (hour < 17) return 'Good afternoon';
	return 'Good evening';
}

function DashboardHome({ user, role, onNavigate }: DashboardHomeProps) {
	const isAdmin = role === 'admin';
	const [summary, setSummary] = useState<DashboardSummary | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');
	const [refreshToken, setRefreshToken] = useState(0);

	useEffect(() => {
		const controller = new AbortController();
		setIsLoading(true);
		setError('');
		void getDashboardSummary(controller.signal)
			.then(setSummary)
			.catch((loadError: unknown) => {
				if (!controller.signal.aborted) {
					setError(loadError instanceof ApiError ? loadError.message : 'Unable to load the dashboard.');
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) setIsLoading(false);
			});
		return () => controller.abort();
	}, [refreshToken]);

	const trend = useMemo(
		() => (summary?.trend || []).map((point) => ({
			...point,
			label: formatDay(point.date, { weekday: 'short', day: 'numeric' }),
		})),
		[summary],
	);

	const totals = summary?.totals;
	const todayLabel = summary ? formatDay(summary.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';

	const statCards = isAdmin
		? [
			{ label: 'Organizations', value: totals?.organizations ?? 0, color: 'brand.500', icon: <AddIcon />, helper: 'Client organizations', tab: 'Organizations' },
			{ label: 'Locations', value: totals?.locations ?? 0, color: 'blue.500', icon: <CalendarIcon />, helper: `${totals?.activeLocations ?? 0} active sites`, tab: 'Organizations' },
			{ label: 'Active employees', value: totals?.activeEmployees ?? 0, color: 'green.500', icon: <AtSignIcon />, helper: `${totals?.employees ?? 0} total records`, tab: 'Employees' },
			{ label: 'Unassigned', value: totals?.unassignedEmployees ?? 0, color: 'orange.400', icon: <WarningIcon />, helper: 'Not placed at an organization', tab: 'Employees' },
		]
		: [
			{ label: 'Active employees', value: totals?.activeEmployees ?? 0, color: 'brand.500', icon: <AtSignIcon />, helper: `${totals?.employees ?? 0} total records`, tab: 'Employees' },
			{ label: 'Locations', value: totals?.locations ?? 0, color: 'blue.500', icon: <CalendarIcon />, helper: `${totals?.activeLocations ?? 0} active sites`, tab: 'Attendance' },
			{ label: 'Present today', value: summary?.today.present ?? 0, color: 'green.500', icon: <CheckCircleIcon />, helper: 'Marked present', tab: 'Attendance' },
			{ label: 'Absent today', value: summary?.today.absent ?? 0, color: 'red.500', icon: <WarningIcon />, helper: `${summary?.today.notMarked ?? 0} not marked yet`, tab: 'Attendance' },
		];

	const quickActions = isAdmin
		? [
			{ label: 'Organizations', description: 'Clients, locations and attendance', icon: <AddIcon />, tab: 'Organizations' },
			{ label: 'Employees', description: 'Add, edit and assign staff', icon: <AtSignIcon />, tab: 'Employees' },
			{ label: 'Payroll', description: 'Wages for a date range', icon: <TimeIcon />, tab: 'Payroll' },
			{ label: 'Settings', description: 'Designations and master data', icon: <SettingsIcon />, tab: 'Settings' },
		]
		: [
			{ label: 'Attendance', description: "Mark today's attendance", icon: <CheckCircleIcon />, tab: 'Attendance' },
			{ label: 'Employees', description: 'View your employees', icon: <AtSignIcon />, tab: 'Employees' },
		];

	const recentColumns: DataTableColumn<RecentEmployee>[] = [
		{
			key: 'name',
			header: 'Employee',
			render: (employee) => (
				<HStack spacing={3}>
					<Avatar size="sm" name={employee.name} bg="brand.100" color="brand.700" />
					<Box minW={0}>
						<Text fontWeight="600" color="slate.900" noOfLines={1}>{employee.name}</Text>
						<Text fontSize="xs" color="slate.500" noOfLines={1}>{employee.designation || 'No designation'}</Text>
					</Box>
				</HStack>
			),
		},
		...(isAdmin
			? [{
				key: 'organization',
				header: 'Organization',
				hideBelow: 'md' as const,
				render: (employee: RecentEmployee) => <Text color="slate.500">{employee.organizationName || 'Unassigned'}</Text>,
			}]
			: []),
		{ key: 'skill', header: 'Category', hideBelow: 'lg', render: (employee) => <Text color="slate.500">{employee.skillCategory || '—'}</Text> },
		{ key: 'status', header: 'Status', render: (employee) => <StatusBadge status={employee.status} /> },
		{ key: 'created', header: 'Added', align: 'right', hideBelow: 'md', render: (employee) => <Text color="slate.500" fontSize="xs">{formatCreated(employee.createdAt)}</Text> },
	];

	return (
		<Stack spacing={6}>
			<PageHeader
				eyebrow={isAdmin ? 'Administrator' : user.organizationName || 'Organization'}
				title={`${greeting()}, ${user.name?.split(' ')[0] || 'there'}`}
				description={todayLabel ? `Here's what's happening today, ${todayLabel}.` : 'Loading your overview…'}
				actions={(
					<IconButton
						aria-label="Refresh dashboard"
						title="Refresh"
						icon={<RepeatIcon />}
						variant="outline"
						borderColor="slate.200"
						bg="white"
						isLoading={isLoading && Boolean(summary)}
						onClick={() => setRefreshToken((current) => current + 1)}
					/>
				)}
			/>

			{error ? <Alert status="error" borderRadius="md">{error}</Alert> : null}

			<SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={4}>
				{statCards.map((card) => (
					<StatCard
						key={card.label}
						label={card.label}
						value={card.value}
						color={card.color}
						icon={card.icon}
						helper={card.helper}
						isLoading={isLoading && !summary}
						onClick={() => onNavigate(card.tab)}
					/>
				))}
			</SimpleGrid>

			<Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={4}>
				<AttendanceTrendChart
					data={trend}
					isLoading={isLoading && !summary}
					hasError={Boolean(error) && !summary}
					title="Attendance — last 7 days"
					subtitle="Present and absent marks per day"
				/>
				<TodayAttendanceCard
					present={summary?.today.present ?? 0}
					absent={summary?.today.absent ?? 0}
					notMarked={summary?.today.notMarked ?? 0}
					dateLabel={todayLabel}
					isLoading={isLoading && !summary}
				/>
			</Grid>

			<Grid templateColumns={{ base: '1fr', md: '1fr 1fr', xl: '1fr 1fr 1fr' }} gap={4}>
				<DistributionChart
					title="Employees by designation"
					subtitle="Active employees"
					label="ROLES"
					centerLabel="Employees"
					data={summary?.byDesignation || []}
					isLoading={isLoading && !summary}
					hasError={Boolean(error) && !summary}
					emptyMessage="No active employees yet."
				/>
				<DistributionChart
					title="Category of skill"
					subtitle="Active employees"
					label="SKILLS"
					centerLabel="Employees"
					data={summary?.bySkillCategory || []}
					isLoading={isLoading && !summary}
					hasError={Boolean(error) && !summary}
					emptyMessage="No active employees yet."
				/>
				<ContentCard title="Quick actions" subtitle="Jump to a workspace" gridColumn={{ md: 'span 2', xl: 'auto' }}>
					<Stack spacing={2}>
						{quickActions.map((action) => (
							<HStack
								key={action.label}
								as="button"
								type="button"
								onClick={() => onNavigate(action.tab)}
								spacing={3}
								p={3}
								borderRadius="md"
								border="1px solid"
								borderColor="slate.200"
								textAlign="left"
								transition="all 0.15s ease"
								_hover={{ borderColor: 'brand.500', bg: 'brand.50' }}
							>
								<Box display="flex" w="36px" h="36px" alignItems="center" justifyContent="center" borderRadius="md" bg="brand.50" color="brand.500" flexShrink={0}>
									{action.icon}
								</Box>
								<Box minW={0}>
									<Text fontSize="sm" fontWeight="600" color="slate.900">{action.label}</Text>
									<Text fontSize="xs" color="slate.500" noOfLines={1}>{action.description}</Text>
								</Box>
							</HStack>
						))}
					</Stack>
				</ContentCard>
			</Grid>

			<ContentCard
				title="Recently added employees"
				subtitle="The latest employee records"
				icon={<AtSignIcon />}
				noPadding
				actions={<ActionButton tone="neutral" size="sm" onClick={() => onNavigate('Employees')}>View all</ActionButton>}
			>
				<DataTable
					columns={recentColumns}
					rows={summary?.recentEmployees || []}
					rowKey={(employee) => employee.id}
					isLoading={isLoading && !summary}
					emptyTitle="No employees yet"
					emptyDescription="Employees you add will show up here."
				/>
			</ContentCard>
		</Stack>
	);
}

export default DashboardHome;
