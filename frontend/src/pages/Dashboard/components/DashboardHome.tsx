import { AddIcon, AtSignIcon, CalendarIcon, CheckCircleIcon, InfoIcon, RepeatIcon, SettingsIcon, TimeIcon, WarningIcon } from '@chakra-ui/icons';
import { Alert, Avatar, Box, Button, ButtonGroup, Grid, HStack, IconButton, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import AttendanceTrendChart from '../../../components/charts/AttendanceTrendChart';
import DistributionChart from '../../../components/charts/DistributionChart';
import {
	ActionButton,
	BuildingIcon,
	ContentCard,
	DataTable,
	MapPinIcon,
	PageHeader,
	PeopleIcon,
	StatCard,
	StatStrip,
	StatusBadge,
	WalletIcon,
	type DataTableColumn,
} from '../../../components/ui';
import { ApiError } from '../../../services/api';
import { getDashboardSummary, type DashboardRange, type DashboardSummary } from '../../../services/dashboardService';
import type { User, UserRole } from '../../../types';
import LocationAttendanceCard from './LocationAttendanceCard';
import NotMarkedTodayCard from './NotMarkedTodayCard';
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

function formatMoney({ currency, total }: { currency: string; total: number }) {
	try {
		return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(total);
	} catch {
		return `${currency} ${Math.round(total).toLocaleString()}`;
	}
}

function formatDays(value: number) {
	return Number.isInteger(value) ? value : value.toFixed(1);
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
	const [range, setRange] = useState<DashboardRange>(7);

	useEffect(() => {
		const controller = new AbortController();
		setIsLoading(true);
		setError('');
		void getDashboardSummary(range, controller.signal)
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
	}, [refreshToken, range]);

	const trend = useMemo(
		() => (summary?.trend || []).map((point) => ({
			...point,
			label: formatDay(point.date, summary?.range === 30 ? { day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric' }),
		})),
		[summary],
	);

	const totals = summary?.totals;
	const today = summary?.today;
	const month = summary?.month;
	const todayLabel = summary ? formatDay(summary.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';

	const ratio = (part?: number | null, whole?: number | null) => (whole ? (part ?? 0) / whole : null);
	const todayTotal = today ? today.present + today.absent + today.halfDay + today.leave + today.off + today.notMarked : 0;
	const presentToday = today ? today.present + today.halfDay : 0;
	const monthWorkingMarks = month ? month.present + month.absent + month.halfDay + month.leave : 0;
	const monthItems = [
		{
			label: 'Attendance rate',
			value: month ? (month.attendanceRate === null ? '—' : `${month.attendanceRate}%`) : null,
			helper: 'Present out of marked working days',
			color: 'green.500',
			icon: <CheckCircleIcon />,
			share: month?.attendanceRate == null ? null : month.attendanceRate / 100,
		},
		{ label: 'Present days', value: month?.present, helper: `${month?.halfDay ?? 0} half days`, color: 'brand.500', icon: <CalendarIcon />, share: ratio(month?.present, monthWorkingMarks) },
		{ label: 'Absent days', value: month?.absent, helper: isAdmin ? `${month?.leave ?? 0} leave days` : 'Marked absent', color: 'red.500', icon: <WarningIcon />, share: ratio(month?.absent, monthWorkingMarks) },
		...(isAdmin
			? [
				{ label: 'Paid days', value: month ? formatDays(month.paidDays ?? 0) : null, helper: 'Present, paid leave, half days', color: 'blue.500', icon: <InfoIcon /> },
				{
					label: 'Estimated wages',
					value: month ? (month.wages?.length ? month.wages.map(formatMoney).join(' + ') : formatMoney({ currency: 'INR', total: 0 })) : null,
					helper: 'Paid days × daily salary',
					color: 'orange.400',
					icon: <WalletIcon boxSize={5} />,
				},
			]
			: [
				{ label: 'Leave days', value: month?.leave, helper: `${month?.off ?? 0} weekly off / holiday`, color: 'blue.500', icon: <InfoIcon />, share: ratio(month?.leave, monthWorkingMarks) },
			]),
	];
	const statCards = isAdmin
		? [
			{ label: 'Organizations', value: totals?.organizations ?? 0, color: 'brand.500', icon: <BuildingIcon boxSize={5} />, helper: 'Client organizations', tab: 'Organizations' },
			{ label: 'Locations', value: totals?.locations ?? 0, color: 'blue.500', icon: <MapPinIcon boxSize={5} />, helper: `${totals?.activeLocations ?? 0} active sites`, share: ratio(totals?.activeLocations, totals?.locations), tab: 'Organizations' },
			{ label: 'Active employees', value: totals?.activeEmployees ?? 0, color: 'green.500', icon: <PeopleIcon boxSize={5} />, helper: `of ${totals?.employees ?? 0} records`, share: ratio(totals?.activeEmployees, totals?.employees), tab: 'Employees' },
			{ label: 'Unassigned', value: totals?.unassignedEmployees ?? 0, color: 'orange.400', icon: <WarningIcon />, helper: 'Not placed yet', share: ratio(totals?.unassignedEmployees, totals?.employees), tab: 'Employees' },
		]
		: [
			{ label: 'Active employees', value: totals?.activeEmployees ?? 0, color: 'brand.500', icon: <PeopleIcon boxSize={5} />, helper: `of ${totals?.employees ?? 0} records · ${totals?.activeLocations ?? 0} sites`, share: ratio(totals?.activeEmployees, totals?.employees), tab: 'Employees' },
			{ label: 'Present today', value: presentToday, color: 'green.500', icon: <CheckCircleIcon />, helper: today?.halfDay ? `incl. ${today.halfDay} half day` : 'Marked present', share: ratio(presentToday, todayTotal), tab: 'Attendance' },
			{ label: 'Absent / leave', value: today ? today.absent + today.leave : 0, color: 'red.500', icon: <WarningIcon />, helper: `${today?.absent ?? 0} absent · ${today?.leave ?? 0} on leave`, share: ratio(today ? today.absent + today.leave : 0, todayTotal), tab: 'Attendance' },
			{ label: 'Not marked', value: today?.notMarked ?? 0, color: 'orange.400', icon: <TimeIcon />, helper: today?.isSunday ? 'Sunday — weekly off' : 'Waiting for a mark today', share: ratio(today?.notMarked, todayTotal), tab: 'Attendance' },
		];

	const quickActions = isAdmin
		? [
			{ label: 'Organizations', description: 'Clients, locations and attendance', icon: <AddIcon />, tab: 'Organizations' },
			{ label: 'Employees', description: 'Add, edit and assign staff', icon: <AtSignIcon />, tab: 'Employees' },
			{ label: 'Payroll', description: 'Wages for a date range', icon: <TimeIcon />, tab: 'Payroll' },
			{ label: 'Settings', description: 'Designations and master data', icon: <SettingsIcon />, tab: 'Settings' },
		]
		: [
			{ label: 'Register of Attendance', description: 'Monthly register per location', icon: <CalendarIcon />, tab: 'Attendance' },
			{ label: 'Attendance history', description: 'Past attendance records', icon: <CheckCircleIcon />, tab: 'Attendance' },
			{ label: 'Employees', description: 'View your employees and appointment letters', icon: <AtSignIcon />, tab: 'Employees' },
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
						share={'share' in card ? card.share : undefined}
						isLoading={isLoading && !summary}
						onClick={() => onNavigate(card.tab)}
					/>
				))}
			</SimpleGrid>

			<Stack spacing={3}>
				<HStack justify="space-between" align="baseline">
					<Text fontSize="sm" fontWeight="700" color="slate.700">This month{month ? ` · ${month.label}` : ''}</Text>
					<Text fontSize="xs" color="slate.500">Up to today</Text>
				</HStack>
				<StatStrip items={monthItems} />
			</Stack>

			<Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={4}>
				<AttendanceTrendChart
					data={trend}
					isLoading={isLoading && !summary}
					hasError={Boolean(error) && !summary}
					title={`Attendance — last ${range} days`}
					subtitle="Present, half day, leave and absent marks per day"
					actions={(
						<ButtonGroup size="xs" isAttached variant="outline">
							{([7, 30] as const).map((option) => (
								<Button
									key={option}
									onClick={() => setRange(option)}
									bg={range === option ? 'brand.500' : 'white'}
									color={range === option ? 'white' : 'slate.600'}
									borderColor={range === option ? 'brand.500' : 'slate.200'}
									_hover={{ bg: range === option ? 'brand.600' : 'slate.50' }}
								>
									{option} days
								</Button>
							))}
						</ButtonGroup>
					)}
				/>
				<TodayAttendanceCard counts={today ?? null} dateLabel={todayLabel} isLoading={isLoading && !summary} />
			</Grid>

			{!isAdmin ? (
				<Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={4}>
					<LocationAttendanceCard
						locations={summary?.locations || []}
						isSunday={Boolean(today?.isSunday)}
						isLoading={isLoading && !summary}
						onOpenAttendance={() => onNavigate('Attendance')}
					/>
					<NotMarkedTodayCard
						employees={summary?.notMarkedToday || []}
						total={today?.notMarked ?? 0}
						isSunday={Boolean(today?.isSunday)}
						isLoading={isLoading && !summary}
					/>
				</Grid>
			) : null}

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
					onRowClick={() => onNavigate('Employees')}
					isLoading={isLoading && !summary}
					emptyTitle="No employees yet"
					emptyDescription="Employees you add will show up here."
				/>
			</ContentCard>
		</Stack>
	);
}

export default DashboardHome;
