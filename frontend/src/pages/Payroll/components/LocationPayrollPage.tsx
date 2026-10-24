import { CalendarIcon, CheckCircleIcon, DownloadIcon, InfoOutlineIcon } from '@chakra-ui/icons';
import {
	Alert,
	AlertIcon,
	Box,
	Button,
	Flex,
	HStack,
	Skeleton,
	Stack,
	Text,
	useToast,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import {
	ActionButton,
	ContentCard,
	DataTable,
	EntityCell,
	FilterBar,
	FilterField,
	FilterInput,
	PeopleIcon,
	PrintIcon,
	StatStrip,
	TableFooter,
	WalletIcon,
	type DataTableColumn,
} from '../../../components/ui';
import { ApiError } from '../../../services/api';
import { getPayroll, getWageRegister, type WageRegisterResponse, type WageRegisterRow } from '../../../services/attendanceService';
import { downloadSalarySlipsPdf } from '../utils/salarySlipPdf';
import { exportWageRegisterExcel, exportWageRegisterPdf, registerContractLine } from '../utils/wageRegisterExport';
import { formatAmount } from './PayrollShared';

type LocationPayrollPageProps = {
	organizationId: string;
	locationId: string;
};

type ExportKind = 'slips' | 'excel' | 'pdf' | 'print';

const PAGE_SIZE = 25;

function monthValue(date: Date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const MONTH_PRESETS = [
	{ label: 'This month', value: () => monthValue(new Date()) },
	{ label: 'Last month', value: () => { const today = new Date(); return monthValue(new Date(today.getFullYear(), today.getMonth() - 1, 1)); } },
];

function rupees(value: number, decimals: 0 | 2 = 0) {
	return formatAmount(decimals === 0 ? Math.round(value) : Math.round(value * 100) / 100);
}

function registerColumns(register: WageRegisterResponse): DataTableColumn<WageRegisterRow>[] {
	const { bonusRate, epfRate, esiRate } = register.rates;
	const amount = (value: number, decimals: 0 | 2 = 0) => <Text color="slate.700" whiteSpace="nowrap">{rupees(value, decimals)}</Text>;
	return [
		{ key: 'serial', header: '#', width: '48px', render: (row) => <Text color="slate.500" fontWeight="600">{row.serial}</Text> },
		{
			key: 'employee',
			header: 'Employee',
			render: (row) => (
				<EntityCell
					name={row.employeeName}
					subtitle={[row.showParentName && row.parentName ? `S/O. ${row.parentName}` : '', row.post].filter(Boolean).join(' · ') || '—'}
					minW="200px"
				/>
			),
		},
		{ key: 'workingDays', header: 'Days', align: 'right', render: (row) => (
			<Box as="span" display="inline-block" px={2.5} py={0.5} borderRadius="full" bg="blue.50" color="blue.700" fontWeight="700" fontSize="xs">{row.workingDays}</Box>
		) },
		{
			key: 'dailyWage',
			header: 'Daily wage',
			align: 'right',
			hideBelow: 'md',
			render: (row) => (row.dailyWage
				? amount(row.dailyWage, 2)
				: <Text color="orange.500" fontWeight="600" whiteSpace="nowrap">Not set</Text>),
		},
		{ key: 'wages', header: 'Wages', align: 'right', render: (row) => amount(row.wages, 2) },
		{ key: 'bonus', header: `Bonus ${bonusRate}%`, align: 'right', hideBelow: 'lg', render: (row) => amount(row.bonus, 2) },
		{ key: 'totalWages', header: 'Total wages', align: 'right', hideBelow: 'md', render: (row) => amount(row.totalWages, 2) },
		{ key: 'epf', header: `EPF ${epfRate}%`, align: 'right', hideBelow: 'lg', render: (row) => <Text color="red.500" whiteSpace="nowrap">{row.epf ? `− ${rupees(row.epf)}` : '—'}</Text> },
		{ key: 'esi', header: `ESI ${esiRate}%`, align: 'right', hideBelow: 'lg', render: (row) => <Text color="red.500" whiteSpace="nowrap">{row.esi ? `− ${rupees(row.esi)}` : '—'}</Text> },
		{ key: 'grossPayment', header: 'Net payment', align: 'right', render: (row) => <Text fontWeight="800" color="slate.900" whiteSpace="nowrap">{rupees(row.grossPayment)}</Text> },
	];
}

function errorMessage(error: unknown, fallback: string) {
	return error instanceof ApiError ? error.message : fallback;
}

function LocationPayrollPage({ organizationId, locationId }: LocationPayrollPageProps) {
	const toast = useToast();
	const [month, setMonth] = useState(() => monthValue(new Date()));
	const [page, setPage] = useState(1);
	const [register, setRegister] = useState<WageRegisterResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState('');
	const [exporting, setExporting] = useState<ExportKind | null>(null);

	useEffect(() => {
		if (!/^\d{4}-\d{2}$/.test(month)) return undefined;
		const controller = new AbortController();
		setIsLoading(true);
		setLoadError('');
		void getWageRegister({ organizationId, locationId, month, page, limit: PAGE_SIZE }, controller.signal)
			.then((result) => {
				setRegister(result);
				if (result.pagination.page !== page) setPage(result.pagination.page);
			})
			.catch((error: unknown) => {
				if (controller.signal.aborted) return;
				setRegister(null);
				setLoadError(errorMessage(error, 'Unable to load the wage register.'));
			})
			.finally(() => {
				if (!controller.signal.aborted) setIsLoading(false);
			});
		return () => controller.abort();
	}, [locationId, month, organizationId, page]);

	function changeMonth(value: string) {
		setMonth(value);
		setPage(1);
	}

	async function runExport(kind: ExportKind) {
		setExporting(kind);
		try {
			if (kind === 'slips') {
				const fromDate = `${month}-01`;
				const [year, monthNumber] = month.split('-').map(Number);
				const toDate = `${month}-${String(new Date(year, monthNumber, 0).getDate()).padStart(2, '0')}`;
				const payroll = await getPayroll({ fromDate, toDate, organizationId, locationId });
				await downloadSalarySlipsPdf(payroll.lines, fromDate, toDate);
			} else {
				const fullRegister = await getWageRegister({ organizationId, locationId, month });
				if (kind === 'excel') await exportWageRegisterExcel(fullRegister);
				else await exportWageRegisterPdf(fullRegister, kind === 'print' ? 'print' : 'download');
			}
		} catch (error) {
			toast({ title: errorMessage(error, 'Unable to export the wage register.'), status: 'error', position: 'top' });
		} finally {
			setExporting(null);
		}
	}

	const totals = register?.totals;
	const hasRows = Boolean(totals && totals.employees > 0);
	const canExport = hasRows && !isLoading && !loadError && !exporting;
	const noDeductions = hasRows && totals?.epf === 0 && totals?.esi === 0;
	const missingWage = register?.rows.some((row) => row.dailyWage === 0) ?? false;

	return (
		<Stack spacing={5}>
			<StatStrip
				items={[
					{ label: 'Employees', value: register ? totals?.employees ?? 0 : null, helper: 'On this location register', color: 'brand.500', icon: <PeopleIcon boxSize={5} /> },
					{ label: 'Working days', value: register ? totals?.workingDays ?? 0 : null, helper: 'Present days in the month', color: 'blue.500', icon: <CalendarIcon /> },
					{
						label: 'Gross payment',
						value: register ? formatAmount(totals?.grossPayment ?? 0) : null,
						helper: register ? `Total wages ${formatAmount(totals?.totalWages ?? 0)}` : 'Net of EPF and ESI',
						color: 'green.500',
						icon: <WalletIcon boxSize={5} />,
					},
					{
						label: 'Deductions',
						value: register ? formatAmount((totals?.epf ?? 0) + (totals?.esi ?? 0)) : null,
						helper: register ? `EPF ${formatAmount(totals?.epf ?? 0)} · ESI ${formatAmount(totals?.esi ?? 0)}` : 'EPF and ESI',
						color: 'orange.400',
						icon: <CheckCircleIcon />,
					},
				]}
			/>

			<ContentCard
				noPadding
				icon={<WalletIcon boxSize={5} />}
				title="Register of wages · FORM XVII"
				subtitle={register ? `Period ${register.periodLabel} · calculated from attendance` : 'Monthly wage register for this location'}
				actions={(
					<>
						<ActionButton size="sm" borderRadius="full" leftIcon={<DownloadIcon />} isDisabled={!canExport} isLoading={exporting === 'slips'} onClick={() => void runExport('slips')}>
							Salary slips
						</ActionButton>
						<ActionButton tone="neutral" size="sm" borderRadius="full" leftIcon={<DownloadIcon />} isDisabled={!canExport} isLoading={exporting === 'excel'} onClick={() => void runExport('excel')}>
							Excel
						</ActionButton>
						<ActionButton tone="neutral" size="sm" borderRadius="full" leftIcon={<DownloadIcon />} isDisabled={!canExport} isLoading={exporting === 'pdf'} onClick={() => void runExport('pdf')}>
							PDF
						</ActionButton>
						<ActionButton tone="neutral" size="sm" borderRadius="full" leftIcon={<PrintIcon boxSize={4} />} isDisabled={!canExport} isLoading={exporting === 'print'} onClick={() => void runExport('print')}>
							Print
						</ActionButton>
					</>
				)}
				toolbar={(
					<FilterBar variant="inset">
						<FilterField label="Quick month" flex={{ base: '1 1 100%', md: '0 0 auto' }}>
							<HStack spacing={1} p={1} h="40px" bg="white" border="1px solid" borderColor="slate.200" borderRadius="10px">
								{MONTH_PRESETS.map((preset) => {
									const value = preset.value();
									const isActive = value === month;
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
											onClick={() => changeMonth(value)}
										>
											{preset.label}
										</Button>
									);
								})}
							</HStack>
						</FilterField>
						<FilterField label="Month" flex={{ base: '1 1 100%', md: '0 0 200px' }}>
							<FilterInput aria-label="Wage register month" type="month" value={month} max={monthValue(new Date())} onChange={(event) => event.target.value && changeMonth(event.target.value)} />
						</FilterField>
					</FilterBar>
				)}
			>
				{loadError ? (
					<Box p={4}><Alert status="error" borderRadius="md"><AlertIcon />{loadError}</Alert></Box>
				) : !register ? (
					<Stack p={5} spacing={3}>
						<Skeleton h="56px" borderRadius="md" />
						<Skeleton h="240px" borderRadius="md" />
					</Stack>
				) : (
					<Box>
						{noDeductions || missingWage ? (
							<Stack px={{ base: 4, md: 5 }} pt={4} spacing={2}>
								{missingWage ? (
									<Alert status="warning" borderRadius="md" fontSize="sm">
										<AlertIcon />
										Some employees have no daily wage. Edit the employee and set a Daily salary (or Basic pay + DA).
									</Alert>
								) : null}
								{noDeductions ? (
									<Alert status="info" borderRadius="md" fontSize="sm">
										<AlertIcon />
										No EPF or ESI deducted. Turn on “EPFO applicable” / “ESIC applicable” on each employee to apply them.
									</Alert>
								) : null}
							</Stack>
						) : null}

						<Flex px={{ base: 4, md: 5 }} py={3} gap={{ base: 2, md: 6 }} flexWrap="wrap" fontSize="sm" borderBottom="1px solid" borderColor="slate.100">
							<Box minW={0}>
								<Text fontSize="11px" fontWeight="700" color="slate.500" textTransform="uppercase" letterSpacing="0.06em">Work</Text>
								<Text color="slate.800" fontWeight="600" noOfLines={2}>{registerContractLine(register) || '—'}</Text>
							</Box>
							<Box>
								<Text fontSize="11px" fontWeight="700" color="slate.500" textTransform="uppercase" letterSpacing="0.06em">LOA / work order</Text>
								<Text color={register.header.loaReference ? 'slate.800' : 'slate.400'} fontWeight={register.header.loaReference ? '600' : '400'}>
									{register.header.loaReference || 'Not set — add it from Edit location'}
								</Text>
							</Box>
							<Box>
								<Text fontSize="11px" fontWeight="700" color="slate.500" textTransform="uppercase" letterSpacing="0.06em">Period</Text>
								<Text color="slate.800" fontWeight="600">{register.periodLabel}</Text>
							</Box>
						</Flex>

						<DataTable
							columns={registerColumns(register)}
							rows={register.rows}
							rowKey={(row) => row.employeeId}
							size="sm"
							isLoading={isLoading}
							emptyTitle="No employees on this register"
							emptyDescription={`No employees at this location for ${register.periodLabel}.`}
							summary={hasRows && totals ? {
								employee: <Text>Total{register.pagination.totalPages > 1 ? ' (all pages)' : ''}</Text>,
								workingDays: totals.workingDays,
								wages: rupees(totals.wages, 2),
								bonus: rupees(totals.bonus),
								totalWages: rupees(totals.totalWages),
								epf: totals.epf ? `− ${rupees(totals.epf)}` : '—',
								esi: totals.esi ? `− ${rupees(totals.esi)}` : '—',
								grossPayment: <Text color="green.600" fontWeight="800" whiteSpace="nowrap">{rupees(totals.grossPayment)}</Text>,
							} : undefined}
							footer={(
								<>
									{register.pagination.total > PAGE_SIZE ? (
										<TableFooter
											page={register.pagination.page}
											pageSize={PAGE_SIZE}
											total={register.pagination.total}
											totalPages={register.pagination.totalPages}
											noun="employees"
											isDisabled={isLoading}
											onPageChange={setPage}
										/>
									) : null}
									<HStack px={{ base: 4, md: 5 }} py={3} spacing={2} align="flex-start" fontSize="xs" color="slate.500" bg="slate.50" borderTop="1px solid" borderColor="slate.100">
										<InfoOutlineIcon mt="2px" />
										<Text>
											Wages = days × daily wage · Bonus {register.rates.bonusRate}% · EPF {register.rates.epfRate}%
											{register.rates.epfWageCeiling ? ` (on wages up to ${register.rates.epfWageCeiling})` : ''} · ESI {register.rates.esiRate}% · Net = total wages − EPF − ESI.
											The Excel and PDF downloads use the FORM XVII layout; edit it in Settings → Wage register.
										</Text>
									</HStack>
								</>
							)}
						/>
					</Box>
				)}
			</ContentCard>
		</Stack>
	);
}

export default LocationPayrollPage;
