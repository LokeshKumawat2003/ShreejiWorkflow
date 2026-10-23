import { CheckCircleIcon, DownloadIcon, InfoOutlineIcon, WarningTwoIcon } from '@chakra-ui/icons';
import { Alert, AlertIcon, Box, FormControl, FormLabel, HStack, SimpleGrid, Stack, Switch, Text, useToast } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import {
	ActionButton,
	ContentCard,
	DataTable,
	EntityCell,
	FilterBar,
	FilterField,
	FilterInput,
	FilterSelect,
	FormInput,
	PageHeader,
	PeopleIcon,
	SearchInput,
	StatStrip,
	TableFooter,
	WalletIcon,
	type DataTableColumn,
} from '../../components/ui';
import { ApiError } from '../../services/api';
import { getBankPayments, type BankPaymentRow, type BankPaymentsParams, type BankPaymentsResponse } from '../../services/attendanceService';
import { listOrganizationLocations } from '../../services/locationService';
import { listOrganizations } from '../../services/organizationService';
import type { OrganizationLocation, User } from '../../types';
import { formatAmount } from '../Payroll/components/PayrollShared';
import { exportBankLetterExcel, exportBankLetterPdf } from './utils/bankLetterExport';

const PAGE_SIZE = 10;

function monthValue(date: Date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function todayValue() {
	const now = new Date();
	return `${monthValue(now)}-${String(now.getDate()).padStart(2, '0')}`;
}

function errorMessage(error: unknown, fallback: string) {
	return error instanceof ApiError ? error.message : fallback;
}

function useDebounced<T>(value: T, delay = 300) {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const timer = window.setTimeout(() => setDebounced(value), delay);
		return () => window.clearTimeout(timer);
	}, [delay, value]);
	return debounced;
}

const missing = <Text as="span" color="orange.500" fontWeight="600">Missing</Text>;

const columns: DataTableColumn<BankPaymentRow>[] = [
	{ key: 'serial', header: '#', width: '48px', render: (row) => <Text color="slate.500" fontWeight="600">{row.serial}</Text> },
	{
		key: 'employee',
		header: 'Employee',
		render: (row) => (
			<EntityCell
				name={row.employeeName}
				subtitle={[row.locationName || row.organizationName, `${row.workingDays} days`].filter(Boolean).join(' · ')}
				minW="200px"
			/>
		),
	},
	{
		key: 'account',
		header: 'Account number',
		render: (row) => (row.accountNumber
			? <Text fontFamily="mono" fontSize="sm" color="slate.800" whiteSpace="nowrap">{row.accountNumber}</Text>
			: missing),
	},
	{
		key: 'ifsc',
		header: 'IFSC',
		hideBelow: 'md',
		render: (row) => (row.ifsc ? <Text fontFamily="mono" fontSize="sm" color="slate.700">{row.ifsc}</Text> : missing),
	},
	{
		key: 'bank',
		header: 'Bank',
		hideBelow: 'lg',
		render: (row) => (row.bankName ? (
			<Box>
				<Text color="slate.800" fontWeight="500" textTransform="uppercase" noOfLines={1}>{row.bankName}</Text>
				{row.bankBranch ? <Text fontSize="xs" color="slate.500" noOfLines={1}>{row.bankBranch}</Text> : null}
			</Box>
		) : missing),
	},
	{
		key: 'amount',
		header: 'Gross payment',
		align: 'right',
		render: (row) => <Text fontWeight="800" color="slate.900" whiteSpace="nowrap">{formatAmount(row.amount)}</Text>,
	},
];

function BankInvoicePage() {
	const toast = useToast();
	const [month, setMonth] = useState(() => monthValue(new Date()));
	const [organizationId, setOrganizationId] = useState('');
	const [locationId, setLocationId] = useState('');
	const [search, setSearch] = useState('');
	const debouncedSearch = useDebounced(search);
	const [page, setPage] = useState(1);
	const [data, setData] = useState<BankPaymentsResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState('');
	const [organizations, setOrganizations] = useState<User[]>([]);
	const [locations, setLocations] = useState<OrganizationLocation[]>([]);
	const [letterDate, setLetterDate] = useState(todayValue);
	const [referenceNumber, setReferenceNumber] = useState('01');
	const [chequeNumber, setChequeNumber] = useState('');
	const [skipMissing, setSkipMissing] = useState(true);
	const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		void listOrganizations({ search: '', status: 'all', sort: 'name-asc', page: 1, limit: 100 }, controller.signal)
			.then((result) => setOrganizations(result.organizations))
			.catch(() => undefined);
		return () => controller.abort();
	}, []);

	useEffect(() => {
		setLocations([]);
		if (!organizationId) return undefined;
		const controller = new AbortController();
		void listOrganizationLocations(organizationId, {}, controller.signal)
			.then((result) => setLocations(result.locations))
			.catch(() => undefined);
		return () => controller.abort();
	}, [organizationId]);

	const query = useMemo<BankPaymentsParams>(() => ({
		month,
		organizationId: organizationId || undefined,
		locationId: locationId || undefined,
		search: debouncedSearch.trim() || undefined,
	}), [debouncedSearch, locationId, month, organizationId]);

	useEffect(() => {
		setPage(1);
	}, [query]);

	useEffect(() => {
		if (!/^\d{4}-\d{2}$/.test(month)) return undefined;
		const controller = new AbortController();
		setIsLoading(true);
		setLoadError('');
		void getBankPayments({ ...query, page, limit: PAGE_SIZE }, controller.signal)
			.then((result) => {
				setData(result);
				if (result.pagination && result.pagination.page !== page) setPage(result.pagination.page);
			})
			.catch((error: unknown) => {
				if (controller.signal.aborted) return;
				setData(null);
				setLoadError(errorMessage(error, 'Unable to load bank payments.'));
			})
			.finally(() => {
				if (!controller.signal.aborted) setIsLoading(false);
			});
		return () => controller.abort();
	}, [month, page, query]);

	const summary = data?.summary;
	const payable = summary ? (skipMissing ? summary.employees - summary.missingBankDetails : summary.employees) : 0;
	const reference = data ? `${data.referencePrefix} ${referenceNumber.trim() || '01'}` : '';
	const canExport = Boolean(data) && payable > 0 && !isLoading && !exporting && Boolean(letterDate);

	async function runExport(kind: 'pdf' | 'excel') {
		setExporting(kind);
		try {
			const full = await getBankPayments(query);
			const rows = skipMissing ? full.rows.filter((row) => !row.missingBankDetails) : full.rows;
			const details = { letter: full.letter, reference: `${full.referencePrefix} ${referenceNumber.trim() || '01'}`, date: letterDate, chequeNumber, rows, month: full.month };
			if (kind === 'pdf') await exportBankLetterPdf(details);
			else await exportBankLetterExcel(details);
		} catch (error) {
			toast({ title: errorMessage(error, 'Unable to create the bank letter.'), status: 'error', position: 'top' });
		} finally {
			setExporting(null);
		}
	}

	return (
		<Stack spacing={6}>
			<PageHeader
				title="Bank invoice"
				description="NEFT payment request to the bank. Each amount is the employee's GROSS PAYMENT IN RS. from the location wage register (FORM XVII column N); account details come from the employee record."
			/>

			<StatStrip
				items={[
					{ label: 'Employees', value: summary ? summary.employees : null, helper: 'Paid in this month', color: 'brand.500', icon: <PeopleIcon boxSize={5} /> },
					{ label: 'Total amount', value: summary ? formatAmount(summary.total) : null, helper: data ? data.periodLabel : 'Net payable', color: 'green.500', icon: <WalletIcon boxSize={5} /> },
					{ label: 'Banks', value: summary ? summary.banks : null, helper: 'Different receiving banks', color: 'blue.500', icon: <CheckCircleIcon /> },
					{
						label: 'Missing details',
						value: summary ? summary.missingBankDetails : null,
						helper: 'No account, IFSC or bank',
						color: summary?.missingBankDetails ? 'orange.400' : 'slate.400',
						icon: <WarningTwoIcon />,
					},
				]}
			/>

			<ContentCard title="Letter details" subtitle="Printed on the letter. The bank, account and signatory are in Settings → Bank letter.">
				<SimpleGrid columns={{ base: 1, md: 4 }} spacing={4} alignItems="end">
					<FormInput label="Letter date" type="date" isRequired value={letterDate} onChange={(event) => setLetterDate(event.target.value)} />
					<FormInput
						label="Reference number"
						maxLength={10}
						value={referenceNumber}
						helperText={reference ? `Ref:- ${reference}` : undefined}
						onChange={(event) => setReferenceNumber(event.target.value)}
					/>
					<FormInput label="Cheque number" maxLength={30} inputMode="numeric" value={chequeNumber} placeholder="e.g. 628374" onChange={(event) => setChequeNumber(event.target.value)} />
					<FormControl display="flex" alignItems="center" gap={3} pb={{ md: 7 }}>
						<Switch id="skip-missing" colorScheme="brand" isChecked={skipMissing} onChange={(event) => setSkipMissing(event.target.checked)} />
						<FormLabel htmlFor="skip-missing" mb={0} fontSize="sm" color="slate.700">Leave out employees without bank details</FormLabel>
					</FormControl>
				</SimpleGrid>
			</ContentCard>

			<ContentCard
				noPadding
				icon={<WalletIcon boxSize={5} />}
				title="Payment list"
				subtitle={data ? `${data.periodLabel} · ${payable} of ${summary?.employees ?? 0} employees go on the letter` : 'Employees paid in the selected month'}
				actions={(
					<>
						<ActionButton tone="neutral" size="sm" borderRadius="full" leftIcon={<DownloadIcon />} isDisabled={!canExport} isLoading={exporting === 'excel'} onClick={() => void runExport('excel')}>
							Excel
						</ActionButton>
						<ActionButton size="sm" borderRadius="full" leftIcon={<DownloadIcon />} isDisabled={!canExport} isLoading={exporting === 'pdf'} onClick={() => void runExport('pdf')}>
							PDF
						</ActionButton>
					</>
				)}
				toolbar={(
					<FilterBar
						variant="inset"
						canClear={Boolean(organizationId || locationId || search)}
						onClear={() => {
							setOrganizationId('');
							setLocationId('');
							setSearch('');
						}}
					>
						<FilterField label="Month" flex={{ base: '1 1 100%', md: '0 0 180px' }}>
							<FilterInput aria-label="Payment month" type="month" value={month} max={monthValue(new Date())} onChange={(event) => event.target.value && setMonth(event.target.value)} />
						</FilterField>
						<FilterField label="Organization" flex={{ base: '1 1 100%', md: '0 0 220px' }}>
							<FilterSelect
								label="Filter by organization"
								value={organizationId}
								onChange={(value) => {
									setOrganizationId(value);
									setLocationId('');
								}}
								options={[{ value: '', label: 'All organizations' }, ...organizations.filter((organization) => organization.id).map((organization) => ({ value: organization.id as string, label: organization.organizationName || organization.name || organization.email }))]}
							/>
						</FilterField>
						<FilterField label="Location" flex={{ base: '1 1 100%', md: '0 0 220px' }}>
							<FilterSelect
								label="Filter by location"
								value={locationId}
								isDisabled={!organizationId}
								onChange={setLocationId}
								options={[{ value: '', label: organizationId ? 'All locations' : 'Choose an organization' }, ...locations.map((location) => ({ value: location.id, label: location.workName || location.name }))]}
							/>
						</FilterField>
						<FilterField label="Search" flex={{ base: '1 1 100%', md: '1 1 200px' }}>
							<SearchInput value={search} onChange={setSearch} placeholder="Name, account, IFSC, bank..." label="Search bank payments" />
						</FilterField>
					</FilterBar>
				)}
			>
				{summary && summary.missingBankDetails > 0 ? (
					<Box px={{ base: 4, md: 5 }} pt={4}>
						<Alert status="warning" borderRadius="md" fontSize="sm">
							<AlertIcon />
							{summary.missingBankDetails} employee{summary.missingBankDetails === 1 ? ' has' : 's have'} no complete bank details.
							{skipMissing ? ' They are left out of the letter.' : ' They will print with blank cells.'} Edit the employee to add account number, IFSC and bank name.
						</Alert>
					</Box>
				) : null}
				<DataTable
					columns={columns}
					rows={data?.rows ?? []}
					rowKey={(row) => row.employeeId}
					size="sm"
					isLoading={isLoading}
					error={loadError}
					emptyTitle="No payments for this month"
					emptyDescription="Only employees on a location wage register with present days are listed. Try another month or filter."
					summary={summary && summary.employees > 0 ? {
						employee: <Text>Total{data?.pagination && data.pagination.totalPages > 1 ? ' (all pages)' : ''}</Text>,
						amount: <Text color="green.600" fontWeight="800" whiteSpace="nowrap">{formatAmount(summary.total)}</Text>,
					} : undefined}
					footer={(
						<>
							{data?.pagination && data.pagination.total > PAGE_SIZE ? (
								<TableFooter
									page={data.pagination.page}
									pageSize={PAGE_SIZE}
									total={data.pagination.total}
									totalPages={data.pagination.totalPages}
									noun="employees"
									isDisabled={isLoading}
									onPageChange={setPage}
								/>
							) : null}
							<HStack px={{ base: 4, md: 5 }} py={3} spacing={2} align="flex-start" fontSize="xs" color="slate.500" bg="slate.50" borderTop="1px solid" borderColor="slate.100">
								<InfoOutlineIcon mt="2px" />
								<Text>Gross payment = the same figure as GROSS PAYMENT IN RS. on the location's wage register (total wages − EPF − ESI). Bank details are read-only here; change them on the employee.</Text>
							</HStack>
						</>
					)}
				/>
			</ContentCard>
		</Stack>
	);
}

export default BankInvoicePage;
