import { CalendarIcon, CheckCircleIcon } from '@chakra-ui/icons';
import { Box, Button, HStack, Text, Tooltip } from '@chakra-ui/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
	DataTable,
	EntityCell,
	FilterField,
	FilterInput,
	PeopleIcon,
	StatStrip,
	TableFooter,
	WalletIcon,
	type DataTableColumn,
} from '../../../components/ui';
import type { PayrollLine, PayrollResponse } from '../../../services/attendanceService';

export function localDateString(date: Date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function formatAmount(amount: number, currency = 'INR') {
	try {
		return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
	} catch {
		return `${currency} ${amount.toFixed(2)}`;
	}
}

export function formatPeriodDate(value: string) {
	const [year, month, day] = value.split('-').map(Number);
	if (!year || !month || !day) return value;
	return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(year, month - 1, day));
}

export function periodLabel(fromDate: string, toDate: string) {
	return `${formatPeriodDate(fromDate)} – ${formatPeriodDate(toDate)}`;
}

export function thisMonthRange() {
	const today = new Date();
	return { fromDate: localDateString(new Date(today.getFullYear(), today.getMonth(), 1)), toDate: localDateString(today) };
}

const PRESETS = [
	{
		label: 'This month',
		range: thisMonthRange,
	},
	{
		label: 'Last month',
		range: () => {
			const today = new Date();
			return {
				fromDate: localDateString(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
				toDate: localDateString(new Date(today.getFullYear(), today.getMonth(), 0)),
			};
		},
	},
	{
		label: 'Today',
		range: () => {
			const today = localDateString(new Date());
			return { fromDate: today, toDate: today };
		},
	},
];

type PeriodFieldsProps = {
	fromDate: string;
	toDate: string;
	onChange: (range: { fromDate: string; toDate: string }) => void;
};

/** Quick-range chips plus From/Through inputs; render inside a FilterBar. */
export function PeriodFields({ fromDate, toDate, onChange }: PeriodFieldsProps) {
	return (
		<>
			<FilterField label="Quick range" flex={{ base: '1 1 100%', md: '0 0 auto' }}>
				<HStack spacing={1} p={1} h="40px" bg="white" border="1px solid" borderColor="slate.200" borderRadius="10px">
					{PRESETS.map((preset) => {
						const range = preset.range();
						const isActive = range.fromDate === fromDate && range.toDate === toDate;
						return (
							<Button
								key={preset.label}
								size="xs"
								h="30px"
								px={3}
								borderRadius="8px"
								fontWeight="600"
								variant="ghost"
								bg={isActive ? 'brand.500' : 'transparent'}
								color={isActive ? 'white' : 'slate.600'}
								_hover={{ bg: isActive ? 'brand.600' : 'slate.100' }}
								onClick={() => onChange(range)}
							>
								{preset.label}
							</Button>
						);
					})}
				</HStack>
			</FilterField>
			<FilterField label="From" flex={{ base: '1 1 45%', md: '0 0 170px' }}>
				<FilterInput aria-label="Payroll start date" type="date" value={fromDate} max={toDate} onChange={(event) => onChange({ fromDate: event.target.value, toDate })} />
			</FilterField>
			<FilterField label="Through" flex={{ base: '1 1 45%', md: '0 0 170px' }}>
				<FilterInput aria-label="Payroll end date" type="date" value={toDate} min={fromDate} onChange={(event) => onChange({ fromDate, toDate: event.target.value })} />
			</FilterField>
		</>
	);
}

export function PayrollSummary({ payroll, isLoading }: { payroll: PayrollResponse | null; isLoading: boolean }) {
	const lines = payroll?.lines ?? [];
	const present = lines.reduce((sum, line) => sum + line.presentDays, 0);
	const absent = lines.reduce((sum, line) => sum + line.absentDays, 0);
	const paidDays = lines.reduce((sum, line) => sum + line.paidDays, 0);
	const totals = payroll?.totals ?? [];
	const ready = !isLoading && payroll;

	return (
		<StatStrip
			items={[
				{
					label: 'Employees',
					value: ready ? lines.length : null,
					helper: 'Included in this run',
					color: 'brand.500',
					icon: <PeopleIcon boxSize={5} />,
				},
				{
					label: 'Total payable',
					value: ready ? (totals.length ? totals.map(({ currency, total }) => formatAmount(total, currency)).join(' + ') : formatAmount(0)) : null,
					helper: 'Gross pay for the period',
					color: 'green.500',
					icon: <WalletIcon boxSize={5} />,
				},
				{
					label: 'Paid days',
					value: ready ? paidDays : null,
					helper: lines.length ? `Avg ${(paidDays / lines.length).toFixed(1)} per employee` : 'No attendance yet',
					color: 'blue.500',
					icon: <CalendarIcon />,
				},
				{
					label: 'Attendance',
					value: ready ? (present + absent ? `${Math.round((present / (present + absent)) * 100)}%` : '—') : null,
					helper: `${present} present · ${absent} absent`,
					color: 'orange.400',
					icon: <CheckCircleIcon />,
					share: present + absent ? present / (present + absent) : null,
				},
			]}
		/>
	);
}

function AttendanceBar({ line }: { line: PayrollLine }) {
	const marked = line.presentDays + line.absentDays;
	const share = marked ? line.presentDays / marked : 0;

	return (
		<Tooltip label={`${line.presentDays} present · ${line.absentDays} absent`} hasArrow openDelay={200}>
			<Box minW="150px">
				<HStack spacing={2} mb={1.5} fontSize="xs" fontWeight="600">
					<HStack spacing={1} color="green.600">
						<Box w="6px" h="6px" borderRadius="full" bg="green.500" />
						<Text>{line.presentDays} P</Text>
					</HStack>
					<HStack spacing={1} color="red.500">
						<Box w="6px" h="6px" borderRadius="full" bg="red.400" />
						<Text>{line.absentDays} A</Text>
					</HStack>
				</HStack>
				<Box h="6px" bg={marked ? 'red.100' : 'slate.100'} borderRadius="full" overflow="hidden">
					<Box h="100%" w={`${share * 100}%`} bg="green.400" borderRadius="full" />
				</Box>
			</Box>
		</Tooltip>
	);
}

const payrollColumns: DataTableColumn<PayrollLine>[] = [
	{
		key: 'employee',
		header: 'Employee',
		render: (line) => (
			<EntityCell
				name={line.employeeName}
				subtitle={[line.designation || line.jobTitle, line.organizationName].filter(Boolean).join(' · ') || line.employeeEmail}
				minW="220px"
			/>
		),
	},
	{
		key: 'rate',
		header: 'Daily rate',
		align: 'right',
		hideBelow: 'md',
		render: (line) => <Text color="slate.700" fontWeight="500" whiteSpace="nowrap">{formatAmount(line.dailySalary, line.currency)}</Text>,
	},
	{
		key: 'attendance',
		header: 'Attendance',
		hideBelow: 'md',
		render: (line) => <AttendanceBar line={line} />,
	},
	{
		key: 'paid',
		header: 'Paid days',
		align: 'right',
		render: (line) => (
			<Box as="span" display="inline-block" px={2.5} py={0.5} borderRadius="full" bg="blue.50" color="blue.700" fontWeight="700" fontSize="xs">
				{line.paidDays}
			</Box>
		),
	},
	{
		key: 'pay',
		header: 'Payable',
		align: 'right',
		render: (line) => (
			<Text fontWeight="800" color="slate.900" whiteSpace="nowrap">{formatAmount(line.grossPay, line.currency)}</Text>
		),
	},
];

type PayrollTableProps = {
	lines: PayrollLine[];
	isLoading?: boolean;
	error?: string;
	emptyTitle?: string;
	emptyDescription?: string;
};

const PAYROLL_PAGE_SIZE = 10;

export function PayrollTable({ lines, isLoading, error, emptyTitle = 'No payroll lines', emptyDescription }: PayrollTableProps) {
	const [page, setPage] = useState(1);
	const totalPages = Math.max(1, Math.ceil(lines.length / PAYROLL_PAGE_SIZE));
	const currentPage = Math.min(page, totalPages);
	const pageLines = useMemo(
		() => lines.slice((currentPage - 1) * PAYROLL_PAGE_SIZE, currentPage * PAYROLL_PAGE_SIZE),
		[currentPage, lines],
	);

	useEffect(() => {
		setPage(1);
	}, [lines]);

	return (
		<DataTable
			columns={payrollColumns}
			rows={pageLines}
			rowKey={(line) => line.employeeId}
			isLoading={isLoading}
			error={error}
			emptyTitle={emptyTitle}
			emptyDescription={emptyDescription}
			footer={(
				<>
					{lines.length > 0 && !error ? (
						<TableFooter
							page={currentPage}
							pageSize={PAYROLL_PAGE_SIZE}
							total={lines.length}
							totalPages={totalPages}
							noun="employees"
							isDisabled={isLoading}
							onPageChange={setPage}
						/>
					) : null}
					<PayrollFormulaNote />
				</>
			)}
		/>
	);
}

export function PayrollFormulaNote({ children }: { children?: ReactNode }) {
	return (
		<HStack justify="space-between" flexWrap="wrap" gap={2} px={{ base: 4, md: 5 }} py={3} bg="slate.50" borderTop="1px solid" borderColor="slate.100">
			<HStack spacing={2} fontSize="xs" color="slate.500">
				<Box as="span" px={2} py={0.5} borderRadius="md" bg="white" border="1px solid" borderColor="slate.200" fontWeight="700" color="slate.700">
					Daily rate × present days
				</Box>
				<Text>Absent and unmarked days are unpaid</Text>
			</HStack>
			{children}
		</HStack>
	);
}
