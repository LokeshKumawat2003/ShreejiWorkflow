import { CalendarIcon, CheckCircleIcon, DownloadIcon, InfoOutlineIcon } from '@chakra-ui/icons';
import {
	Alert,
	AlertIcon,
	Box,
	Button,
	Flex,
	HStack,
	Image,
	Skeleton,
	Stack,
	Table,
	Tbody,
	Td,
	Text,
	Tfoot,
	Th,
	Thead,
	Tr,
	useToast,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { ActionButton, ContentCard, FilterBar, FilterField, FilterInput, PeopleIcon, StatStrip, TableFooter, WalletIcon } from '../../../components/ui';
import { ApiError } from '../../../services/api';
import { getPayroll, getWageRegister, type WageRegisterResponse } from '../../../services/attendanceService';
import { downloadSalarySlipsPdf } from '../utils/salarySlipPdf';
import {
	exportWageRegisterExcel,
	exportWageRegisterPdf,
	formatRegisterNumber,
	registerContractLine,
	registerHeadings,
} from '../utils/wageRegisterExport';
import { formatAmount } from './PayrollShared';

type LocationPayrollPageProps = {
	organizationId: string;
	locationId: string;
};

type ExportKind = 'slips' | 'excel' | 'pdf';

const PAGE_SIZE = 25;

function monthValue(date: Date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const MONTH_PRESETS = [
	{ label: 'This month', value: () => monthValue(new Date()) },
	{ label: 'Last month', value: () => { const today = new Date(); return monthValue(new Date(today.getFullYear(), today.getMonth() - 1, 1)); } },
];

const cellBorder = { border: '1px solid', borderColor: 'slate.300' } as const;

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
				else await exportWageRegisterPdf(fullRegister);
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

						<Box px={{ base: 3, md: 5 }} py={5}>
							<Box border="1px solid" borderColor="slate.200" borderRadius="md" bg="white" px={{ base: 3, md: 6 }} py={5} fontFamily="'Times New Roman', Times, serif" color="slate.900">
								<Stack spacing={1} align="center" textAlign="center">
									<Text fontSize={{ base: 'lg', md: '2xl' }} fontWeight="700" textDecoration="underline">{register.header.title}</Text>
									{register.header.formTitle ? <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="700">{register.header.formTitle}</Text> : null}
									{registerContractLine(register) ? (
										<Text fontSize={{ base: 'xs', md: 'sm' }} fontWeight="700" textDecoration="underline">{registerContractLine(register)}</Text>
									) : null}
								</Stack>
								<Flex mt={3} justify="space-between" gap={3} flexWrap="wrap" fontSize={{ base: 'xs', md: 'sm' }} fontWeight="700">
									<Text>Name of Contractor :- {register.header.contractorName}</Text>
									<Text>Period- {register.periodLabel}</Text>
								</Flex>
								{register.header.loaReference ? (
									<Text mt={1} fontSize={{ base: 'xs', md: 'sm' }} fontWeight="700">{register.header.loaReference}</Text>
								) : (
									<Text mt={1} fontSize="xs" color="slate.400" fontFamily="body">Add the LOA / work order reference from Edit location to print it here.</Text>
								)}

								<Box mt={3} overflowX="auto" opacity={isLoading ? 0.6 : 1} transition="opacity 0.15s ease">
									<Table size="sm" minW="900px" sx={{ borderCollapse: 'collapse', 'th, td': { ...cellBorder, fontFamily: "'Times New Roman', Times, serif" } }}>
										<Thead>
											<Tr>
												{registerHeadings(register).map((heading) => (
													<Th key={heading.key} textAlign="center" fontSize="10px" color="slate.900" textTransform="uppercase" letterSpacing="0" lineHeight="1.25" px={2} py={2} maxW={heading.key === 'name' ? undefined : '96px'} whiteSpace="normal">
														{heading.title}
													</Th>
												))}
											</Tr>
											<Tr>
												{registerHeadings(register).map((heading) => (
													<Th key={heading.key} textAlign="center" fontSize="11px" color="slate.900" px={2} py={1}>{heading.letter}</Th>
												))}
											</Tr>
										</Thead>
										<Tbody>
											{register.rows.length === 0 ? (
												<Tr><Td colSpan={11} textAlign="center" py={8} color="slate.500" fontFamily="body">No employees at this location for {register.periodLabel}.</Td></Tr>
											) : register.rows.map((row) => (
												<Tr key={row.employeeId} _hover={{ bg: 'slate.50' }}>
													<Td textAlign="center">{row.serial}</Td>
													<Td>
														<Text fontWeight="600" textTransform="uppercase">{row.employeeName}</Text>
														{row.showParentName ? <Text fontSize="xs" textTransform="uppercase">S/O. {row.parentName}</Text> : null}
													</Td>
													<Td textAlign="center">{row.post || '—'}</Td>
													<Td textAlign="center">{row.workingDays}</Td>
													<Td textAlign="center" color={row.dailyWage ? undefined : 'orange.500'}>{formatRegisterNumber(row.dailyWage)}</Td>
													<Td textAlign="center">{formatRegisterNumber(row.wages)}</Td>
													<Td textAlign="center">{formatRegisterNumber(row.bonus, 2)}</Td>
													<Td textAlign="center">{formatRegisterNumber(row.totalWages, 2)}</Td>
													<Td textAlign="center">{formatRegisterNumber(row.epf, 0)}</Td>
													<Td textAlign="center">{formatRegisterNumber(row.esi, 0)}</Td>
													<Td textAlign="center" fontWeight="700">{formatRegisterNumber(row.grossPayment, 0)}</Td>
												</Tr>
											))}
										</Tbody>
										{totals && totals.employees > 0 ? (
											<Tfoot>
												<Tr fontWeight="700" bg="slate.50">
													<Td />
													<Td fontWeight="700">TOTAL{register.pagination.totalPages > 1 ? ' (all pages)' : ''}</Td>
													<Td />
													<Td textAlign="center" fontWeight="700">{totals.workingDays}</Td>
													<Td />
													<Td textAlign="center" fontWeight="700">{formatRegisterNumber(totals.wages)}</Td>
													<Td textAlign="center" fontWeight="700">{formatRegisterNumber(totals.bonus, 0)}</Td>
													<Td textAlign="center" fontWeight="700">{formatRegisterNumber(totals.totalWages, 0)}</Td>
													<Td textAlign="center" fontWeight="700">{formatRegisterNumber(totals.epf, 0)}</Td>
													<Td textAlign="center" fontWeight="700">{formatRegisterNumber(totals.esi, 0)}</Td>
													<Td textAlign="center" fontWeight="800">{formatRegisterNumber(totals.grossPayment, 0)}</Td>
												</Tr>
											</Tfoot>
										) : null}
									</Table>
								</Box>
								{register.header.note ? <Text mt={3} fontSize={{ base: 'xs', md: 'sm' }}>Note:-{register.header.note}</Text> : null}
								{register.header.signatoryCompany || register.header.signatoryTitle || register.header.signatureImage ? (
									<Box mt={4} ml={{ base: 0, md: '8%' }} w="fit-content" textAlign="center" fontSize={{ base: 'xs', md: 'sm' }}>
										<Flex h="56px" align="flex-end" justify="center">
											{register.header.signatureImage
												? <Image src={register.header.signatureImage} alt="Signature" maxH="52px" maxW="180px" objectFit="contain" />
												: null}
										</Flex>
										{register.header.signatoryCompany ? <Text fontWeight="700">{register.header.signatoryCompany}</Text> : null}
										{register.header.signatoryTitle ? <Text>{register.header.signatoryTitle}</Text> : null}
									</Box>
								) : null}
							</Box>
							<HStack mt={3} spacing={2} fontSize="xs" color="slate.500" fontFamily="body">
								<InfoOutlineIcon />
								<Text>
									F = D × E · H = F × {register.rates.bonusRate}% · J = F + H · K = EPF {register.rates.epfRate}% of F
									{register.rates.epfWageCeiling ? ` (max ${register.rates.epfWageCeiling})` : ''} · L = ESI {register.rates.esiRate}% of F · N = J − K − L. Rates and header text are in Settings → Wage register.
								</Text>
							</HStack>
						</Box>

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
					</Box>
				)}
			</ContentCard>
		</Stack>
	);
}

export default LocationPayrollPage;
