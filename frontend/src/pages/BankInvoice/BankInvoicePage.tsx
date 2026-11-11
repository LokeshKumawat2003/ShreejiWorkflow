import { CheckCircleIcon, DownloadIcon, InfoOutlineIcon } from '@chakra-ui/icons';
import { Alert, AlertIcon, Box, Flex, FormControl, FormLabel, HStack, SimpleGrid, Stack, Switch, Text, useToast } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import {
	ActionButton,
	ContentCard,
	DataTable,
	EntityCell,
	FilterBar,
	FilterField,
	FilterInput,
	FormInput,
	MapPinIcon,
	PageHeader,
	PeopleIcon,
	PrintIcon,
	SearchInput,
	StatStrip,
	TableFooter,
	WalletIcon,
	type DataTableColumn,
} from '../../components/ui';
import { ApiError } from '../../services/api';
import {
	cancelBankInvoiceBatch,
	createBankInvoiceBatch,
	getBankInvoiceBatch,
	getBankInvoiceLocations,
	getBankPayments,
	listBankInvoiceBatches,
	logBankInvoiceActivity,
	type BankInvoiceBatch,
	type BankInvoiceLocationsResponse,
	type BankPaymentRow,
	type BankPaymentsParams,
	type BankPaymentsResponse,
} from '../../services/attendanceService';
import { formatAmount } from '../Payroll/components/PayrollShared';
import { fieldLabelStyles } from '../../components/ui/fieldStyles';
import LocationPicker, { isSelectable } from './components/LocationPicker';
import PrintedHistory from './components/PrintedHistory';
import { exportBankLetterExcel, exportBankLetterPdf, formatLetterDate, type BankLetterDetails } from './utils/bankLetterExport';

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

type ExportKind = 'pdf' | 'excel' | 'print';

async function makeLetter(kind: ExportKind, details: BankLetterDetails) {
	if (kind === 'excel') await exportBankLetterExcel(details);
	else await exportBankLetterPdf(details, kind === 'print' ? 'print' : 'download');
}

function BankInvoicePage() {
	const toast = useToast();
	const [month, setMonth] = useState(() => monthValue(new Date()));
	const [selected, setSelected] = useState<string[]>([]);
	const [search, setSearch] = useState('');
	const debouncedSearch = useDebounced(search);
	const [page, setPage] = useState(1);
	const [data, setData] = useState<BankPaymentsResponse | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [loadError, setLoadError] = useState('');
	const [locationsData, setLocationsData] = useState<BankInvoiceLocationsResponse | null>(null);
	const [locationsLoading, setLocationsLoading] = useState(true);
	const [locationsError, setLocationsError] = useState('');
	const [batches, setBatches] = useState<BankInvoiceBatch[]>([]);
	const [batchesLoading, setBatchesLoading] = useState(true);
	const [batchesError, setBatchesError] = useState('');
	const [refreshKey, setRefreshKey] = useState(0);
	const [letterDate, setLetterDate] = useState(todayValue);
	const [referenceNumber, setReferenceNumber] = useState('01');
	const [referenceEdited, setReferenceEdited] = useState(false);
	const [chequeNumber, setChequeNumber] = useState('');
	const [skipMissing, setSkipMissing] = useState(true);
	const [exporting, setExporting] = useState<ExportKind | null>(null);
	const [busyBatch, setBusyBatch] = useState<string | null>(null);
	const [showHistory, setShowHistory] = useState(false);

	useEffect(() => {
		setSelected([]);
		setReferenceEdited(false);
	}, [month]);

	useEffect(() => {
		if (!/^\d{4}-\d{2}$/.test(month)) return undefined;
		const controller = new AbortController();
		setLocationsLoading(true);
		setLocationsError('');
		setBatchesLoading(true);
		setBatchesError('');
		void getBankInvoiceLocations(month, controller.signal)
			.then((result) => {
				setLocationsData(result);
				const selectable = new Set(result.organizations.flatMap((organization) => organization.locations).filter(isSelectable).map((location) => location.locationId));
				setSelected((current) => {
					const kept = current.filter((id) => selectable.has(id));
					return kept.length === current.length ? current : kept;
				});
			})
			.catch((error: unknown) => {
				if (controller.signal.aborted) return;
				setLocationsData(null);
				setLocationsError(errorMessage(error, 'Unable to load locations.'));
			})
			.finally(() => {
				if (!controller.signal.aborted) setLocationsLoading(false);
			});
		void listBankInvoiceBatches(month, controller.signal)
			.then(setBatches)
			.catch((error: unknown) => {
				if (controller.signal.aborted) return;
				setBatches([]);
				setBatchesError(errorMessage(error, 'Unable to load printed letters.'));
			})
			.finally(() => {
				if (!controller.signal.aborted) setBatchesLoading(false);
			});
		return () => controller.abort();
	}, [month, refreshKey]);

	useEffect(() => {
		if (locationsData && !referenceEdited) setReferenceNumber(locationsData.nextReference);
	}, [locationsData, referenceEdited]);

	const query = useMemo<BankPaymentsParams>(() => ({
		month,
		locationIds: [...selected].sort(),
		search: debouncedSearch.trim() || undefined,
	}), [debouncedSearch, month, selected]);

	useEffect(() => {
		setPage(1);
	}, [query]);

	useEffect(() => {
		if (!/^\d{4}-\d{2}$/.test(month) || selected.length === 0) {
			setData(null);
			setLoadError('');
			setIsLoading(false);
			return undefined;
		}
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
	}, [month, page, query, selected.length]);

	const summary = data?.summary;
	const payable = summary ? (skipMissing ? summary.employees - summary.missingBankDetails : summary.employees) : 0;
	const referencePrefix = locationsData?.referencePrefix ?? data?.referencePrefix ?? '';
	const reference = referencePrefix ? `${referencePrefix} ${referenceNumber.trim() || '01'}` : '';
	const canExport = selected.length > 0 && Boolean(data) && !debouncedSearch.trim() && payable > 0 && !isLoading && !exporting && Boolean(letterDate);
	const printedCount = batches.filter((batch) => batch.status === 'printed').length;

	async function runExport(kind: ExportKind) {
		setExporting(kind);
		try {
			const result = await createBankInvoiceBatch({
				month,
				locationIds: selected,
				letterDate,
				referenceNumber: referenceNumber.trim(),
				chequeNumber: chequeNumber.trim(),
				skipMissing,
				format: kind,
			});
			setSelected([]);
			setReferenceEdited(false);
			setRefreshKey((key) => key + 1);
			toast({
				title: `${result.batch.reference} saved`,
				description: `${result.batch.locations.length} location${result.batch.locations.length === 1 ? '' : 's'} marked as printed for ${result.periodLabel}.`,
				status: 'success',
				position: 'top',
			});
			await makeLetter(kind, {
				letter: result.letter,
				reference: result.batch.reference,
				date: result.batch.letterDate,
				chequeNumber: result.batch.chequeNumber,
				rows: result.rows,
				month: result.month,
			});
		} catch (error) {
			toast({ title: errorMessage(error, 'Unable to create the bank letter.'), status: 'error', position: 'top' });
			if (error instanceof ApiError && error.status === 409) setRefreshKey((key) => key + 1);
		} finally {
			setExporting(null);
		}
	}

	async function reprint(batch: BankInvoiceBatch, kind: ExportKind) {
		setBusyBatch(`${batch.id}:${kind}`);
		try {
			const result = await getBankInvoiceBatch(batch.id);
			await makeLetter(kind, {
				letter: result.letter,
				reference: result.batch.reference,
				date: result.batch.letterDate,
				chequeNumber: result.batch.chequeNumber,
				rows: result.rows,
				month: result.month,
			});
			const updated = await logBankInvoiceActivity(batch.id, kind);
			setBatches((current) => current.map((item) => (item.id === updated.id ? updated : item)));
		} catch (error) {
			toast({ title: errorMessage(error, 'Unable to reprint the bank letter.'), status: 'error', position: 'top' });
		} finally {
			setBusyBatch(null);
		}
	}

	async function cancelBatch(batch: BankInvoiceBatch) {
		try {
			await cancelBankInvoiceBatch(batch.id);
			setRefreshKey((key) => key + 1);
			toast({ title: `${batch.reference} cancelled`, description: 'Its locations are pending again.', status: 'success', position: 'top' });
		} catch (error) {
			toast({ title: errorMessage(error, 'Unable to cancel the bank letter.'), status: 'error', position: 'top' });
		}
	}

	return (
		<Stack spacing={6}>
			<PageHeader
				title="Bank invoice"
				description="NEFT payment request to the bank. Pick locations from any organizations, print one letter for them, and they are marked as printed for the month. Each amount is the employee's GROSS PAYMENT IN RS. from the location wage register (FORM XVII column N)."
			/>

			<StatStrip
				items={[
					{ label: 'Pending locations', value: locationsData ? locationsData.summary.pending : null, helper: 'With payments, not printed yet', color: 'orange.400', icon: <MapPinIcon boxSize={5} /> },
					{ label: 'Printed letters', value: batchesLoading ? null : printedCount, helper: locationsData ? `${locationsData.summary.printed} locations covered` : 'This month', color: 'green.500', icon: <CheckCircleIcon /> },
					{ label: 'Selected employees', value: summary ? summary.employees : selected.length === 0 ? 0 : null, helper: `${selected.length} location${selected.length === 1 ? '' : 's'} selected`, color: 'brand.500', icon: <PeopleIcon boxSize={5} /> },
					{ label: 'Selected amount', value: summary ? formatAmount(summary.total) : selected.length === 0 ? formatAmount(0) : null, helper: locationsData ? locationsData.periodLabel : 'Net payable', color: 'green.500', icon: <WalletIcon boxSize={5} /> },
				]}
			/>

			<ContentCard title="Letter details" subtitle="Printed on the letter. The bank, account and signatory are in Settings → Bank letter.">
				<SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4} alignItems="start">
					<FormInput label="Letter date" type="date" isRequired value={letterDate} onChange={(event) => setLetterDate(event.target.value)} />
					<FormInput
						label="Reference number"
						maxLength={10}
						value={referenceNumber}
						placeholder="01"
						onChange={(event) => {
							setReferenceEdited(true);
							setReferenceNumber(event.target.value);
						}}
					/>
					<FormInput label="Cheque number" maxLength={30} inputMode="numeric" value={chequeNumber} placeholder="e.g. 628374" onChange={(event) => setChequeNumber(event.target.value)} />
					<FormControl>
						<FormLabel htmlFor="skip-missing" {...fieldLabelStyles}>Missing bank details</FormLabel>
						<Flex
							h="44px"
							px={3}
							align="center"
							justify="space-between"
							gap={3}
							border="1px solid"
							borderColor="slate.200"
							borderRadius="md"
							bg="white"
						>
							<Text fontSize="sm" color="slate.700" noOfLines={1}>Leave them off the letter</Text>
							<Switch id="skip-missing" colorScheme="brand" isChecked={skipMissing} onChange={(event) => setSkipMissing(event.target.checked)} />
						</Flex>
					</FormControl>
				</SimpleGrid>
				<HStack
					mt={4}
					px={4}
					py={2.5}
					spacing={{ base: 3, md: 6 }}
					flexWrap="wrap"
					bg="slate.50"
					border="1px solid"
					borderColor="slate.100"
					borderRadius="md"
					fontSize="sm"
					color="slate.600"
				>
					<Text fontWeight="600" color="slate.500" fontSize="xs" textTransform="uppercase" letterSpacing="wide">On the letter</Text>
					<Text>Ref:- <Text as="span" fontWeight="600" color="slate.800">{reference || '—'}</Text></Text>
					<Text>Date:- <Text as="span" fontWeight="600" color="slate.800">{letterDate ? formatLetterDate(letterDate) : '—'}</Text></Text>
					<Text>CH. NO:- <Text as="span" fontWeight="600" color="slate.800">{chequeNumber.trim() || '—'}</Text></Text>
				</HStack>
			</ContentCard>

			<ContentCard
				icon={<MapPinIcon boxSize={5} />}
				title="Locations"
				subtitle={locationsData ? `${locationsData.periodLabel} · tick locations from one or more organizations to put them on one letter` : 'Choose a month'}
				actions={(
					<HStack spacing={3} align="flex-end">
						<ActionButton
							tone={showHistory ? 'primary' : 'neutral'}
							h="40px"
							leftIcon={showHistory ? <WalletIcon boxSize={4} /> : <PrintIcon boxSize={4} />}
							onClick={() => setShowHistory((value) => !value)}
						>
							{showHistory ? 'Payment list' : `Printed history${batchesLoading ? '' : ` (${batches.length})`}`}
						</ActionButton>
						<FilterField label="Month" flex="0 0 180px">
							<FilterInput aria-label="Payment month" type="month" value={month} max={monthValue(new Date())} onChange={(event) => event.target.value && setMonth(event.target.value)} />
						</FilterField>
					</HStack>
				)}
			>
				<LocationPicker
					data={locationsData}
					isLoading={locationsLoading}
					error={locationsError}
					selected={selected}
					onChange={(locationIds) => {
						setSelected(locationIds);
						if (locationIds.length > 0) setShowHistory(false);
					}}
				/>
			</ContentCard>

			{showHistory ? (
				<ContentCard
					noPadding
					icon={<PrintIcon boxSize={5} />}
					title="Printed history"
					subtitle={locationsData ? `Letters printed for ${locationsData.periodLabel}. Cancel a letter to make its locations pending again.` : 'Letters printed this month'}
					actions={(
						<ActionButton tone="neutral" size="sm" borderRadius="full" leftIcon={<WalletIcon boxSize={4} />} onClick={() => setShowHistory(false)}>
							Back to payment list
						</ActionButton>
					)}
				>
					<PrintedHistory
						batches={batches}
						isLoading={batchesLoading}
						error={batchesError}
						busyId={busyBatch}
						onReprint={(batch, kind) => void reprint(batch, kind)}
						onCancel={cancelBatch}
					/>
				</ContentCard>
			) : (
			<ContentCard
				noPadding
				icon={<WalletIcon boxSize={5} />}
				title="Payment list"
				subtitle={selected.length === 0
					? 'Select locations above to prepare a letter'
					: debouncedSearch.trim()
						? 'Clear the search to print — the letter always includes every employee of the selected locations'
						: data ? `${data.periodLabel} · ${payable} of ${summary?.employees ?? 0} employees go on the letter · printing marks the selected locations as printed` : 'Loading…'}
				actions={(
					<>
						<ActionButton tone="neutral" size="sm" borderRadius="full" leftIcon={<DownloadIcon />} isDisabled={!canExport} isLoading={exporting === 'excel'} onClick={() => void runExport('excel')}>
							Excel
						</ActionButton>
						<ActionButton size="sm" borderRadius="full" leftIcon={<DownloadIcon />} isDisabled={!canExport} isLoading={exporting === 'pdf'} onClick={() => void runExport('pdf')}>
							PDF
						</ActionButton>
						<ActionButton tone="neutral" size="sm" borderRadius="full" leftIcon={<PrintIcon boxSize={4} />} isDisabled={!canExport} isLoading={exporting === 'print'} onClick={() => void runExport('print')}>
							Print
						</ActionButton>
					</>
				)}
				toolbar={(
					<FilterBar
						variant="inset"
						canClear={Boolean(search)}
						onClear={() => setSearch('')}
					>
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
					emptyTitle={selected.length === 0 ? 'Select locations to prepare a letter' : 'No payments for these locations'}
					emptyDescription={selected.length === 0
						? 'Tick pending locations above. You can mix locations from different organizations on one letter.'
						: 'Only employees on a location wage register with present days are listed.'}
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
			)}
		</Stack>
	);
}

export default BankInvoicePage;
