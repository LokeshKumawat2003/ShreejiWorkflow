import { CloseIcon, DownloadIcon } from '@chakra-ui/icons';
import { Box, Button, HStack, Popover, PopoverArrow, PopoverBody, PopoverContent, PopoverTrigger, Stack, Text } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import {
	ConfirmDialog,
	DataTable,
	FilterBar,
	FilterField,
	FilterSelect,
	IconAction,
	PrintIcon,
	StatusBadge,
	TableFooter,
	type DataTableColumn,
} from '../../../components/ui';
import type { BankInvoiceActivity, BankInvoiceBatch } from '../../../services/attendanceService';
import { formatAmount } from '../../Payroll/components/PayrollShared';
import { formatLetterDate } from '../utils/bankLetterExport';
import { printedOn } from './LocationPicker';

type ReprintKind = 'pdf' | 'excel' | 'print';

const HISTORY_PAGE_SIZE = 10;

type PrintedHistoryProps = {
	batches: BankInvoiceBatch[];
	isLoading: boolean;
	error: string;
	busyId: string | null;
	onReprint: (batch: BankInvoiceBatch, kind: ReprintKind) => void;
	onCancel: (batch: BankInvoiceBatch, location: BankInvoiceBatch['locations'][number]) => Promise<void>;
	variant?: 'bank' | 'payroll';
};

type ActionStyle = { label: string; tone: 'info' | 'success' | 'warning' | 'danger' };

const ACTION_LABELS: Record<'bank' | 'payroll', Record<BankInvoiceActivity['action'], ActionStyle>> = {
	bank: {
		pdf: { label: 'PDF downloaded', tone: 'info' },
		excel: { label: 'Excel downloaded', tone: 'success' },
		print: { label: 'Printed', tone: 'warning' },
		cancel: { label: 'Cancelled', tone: 'danger' },
	},
	payroll: {
		pdf: { label: 'Salary slips downloaded', tone: 'info' },
		excel: { label: 'Excel downloaded', tone: 'success' },
		print: { label: 'Slips printed', tone: 'warning' },
		cancel: { label: 'Cancelled', tone: 'danger' },
	},
};

const WORDS = {
	bank: { document: 'letter', reprintPdf: 'Reprint PDF', empty: 'No letters printed this month', emptyHint: 'Letters you print from the selected locations show up here.' },
	payroll: { document: 'payroll run', reprintPdf: 'Download salary slips again', empty: 'No payroll printed this month', emptyHint: 'Payroll you export for the selected locations shows up here.' },
};

function rowStatus(batch: BankInvoiceBatch, location: BankInvoiceBatch['locations'][number]) {
	return batch.status === 'cancelled' || location.status === 'cancelled' ? 'cancelled' : 'printed';
}

function activityTime(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return `${printedOn(value)} ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

function ActivityLine({ entry, labels }: { entry: BankInvoiceActivity; labels: Record<BankInvoiceActivity['action'], ActionStyle> }) {
	const style = labels[entry.action];
	return (
		<HStack spacing={2} align="center" flexWrap="wrap">
			<StatusBadge tone={style.tone} label={entry.reprint ? `${style.label} (again)` : style.label} />
			<Text fontSize="xs" color="slate.500" whiteSpace="nowrap">
				{activityTime(entry.at)}{entry.locationName ? ` · ${entry.locationName}` : ''}{entry.byName ? ` · ${entry.byName}` : ''}
			</Text>
		</HStack>
	);
}

function ActivityLog({ activity, labels }: { activity: BankInvoiceActivity[]; labels: Record<BankInvoiceActivity['action'], ActionStyle> }) {
	if (activity.length === 0) return <Text fontSize="xs" color="slate.400">—</Text>;
	const visible = activity.slice(0, 2);
	const hidden = activity.length - visible.length;
	return (
		<Stack spacing={1.5} minW="220px">
			{visible.map((entry, index) => <ActivityLine key={`${entry.at}-${index}`} entry={entry} labels={labels} />)}
			{hidden > 0 ? (
				<Popover placement="bottom-start" isLazy>
					<PopoverTrigger>
						<Button size="xs" variant="link" colorScheme="brand" alignSelf="flex-start">+{hidden} more</Button>
					</PopoverTrigger>
					<PopoverContent w="auto" maxW="360px">
						<PopoverArrow />
						<PopoverBody>
							<Stack spacing={2} maxH="260px" overflowY="auto">
								{activity.map((entry, index) => <ActivityLine key={`${entry.at}-${index}`} entry={entry} labels={labels} />)}
							</Stack>
						</PopoverBody>
					</PopoverContent>
				</Popover>
			) : null}
		</Stack>
	);
}

type HistoryRow = {
	key: string;
	batch: BankInvoiceBatch;
	location: BankInvoiceBatch['locations'][number];
};

function PrintedHistory({ batches, isLoading, error, busyId, onReprint, onCancel, variant = 'bank' }: PrintedHistoryProps) {
	const labels = ACTION_LABELS[variant];
	const words = WORDS[variant];
	const [confirming, setConfirming] = useState<{ batch: BankInvoiceBatch; location: HistoryRow['location'] } | null>(null);
	const [isCancelling, setIsCancelling] = useState(false);
	const [page, setPage] = useState(1);
	const [organizationId, setOrganizationId] = useState('');
	const [locationId, setLocationId] = useState('');
	const [userName, setUserName] = useState('');
	const [status, setStatus] = useState<'' | BankInvoiceBatch['status']>('');

	const allRows = useMemo<HistoryRow[]>(() => batches.flatMap((batch) => batch.locations.map((location) => ({
		key: `${batch.id}:${location.locationId}`,
		batch,
		location,
	}))), [batches]);

	const organizationOptions = useMemo(() => {
		const names = new Map<string, string>();
		for (const { location } of allRows) names.set(location.organizationId, location.organizationName || '—');
		return [...names.entries()].sort((left, right) => left[1].localeCompare(right[1])).map(([value, label]) => ({ value, label }));
	}, [allRows]);

	const locationOptions = useMemo(() => {
		const names = new Map<string, string>();
		for (const { location } of allRows) {
			if (!organizationId || location.organizationId === organizationId) names.set(location.locationId, location.locationName || '—');
		}
		return [...names.entries()].sort((left, right) => left[1].localeCompare(right[1])).map(([value, label]) => ({ value, label }));
	}, [allRows, organizationId]);

	const userOptions = useMemo(() => [...new Set(batches.flatMap((batch) => (batch.activity ?? []).map((entry) => entry.byName).filter(Boolean)))]
		.sort((left, right) => left.localeCompare(right))
		.map((name) => ({ value: name, label: name })), [batches]);

	const rows = useMemo(() => allRows.filter(({ batch, location }) => (
		(!organizationId || location.organizationId === organizationId)
		&& (!locationId || location.locationId === locationId)
		&& (!status || rowStatus(batch, location) === status)
		&& (!userName || (batch.activity ?? []).some((entry) => entry.byName === userName))
	)), [allRows, locationId, organizationId, status, userName]);

	useEffect(() => {
		setPage(1);
	}, [organizationId, locationId, userName, status]);

	const hasFilters = Boolean(organizationId || locationId || userName || status);
	function clearFilters() {
		setOrganizationId('');
		setLocationId('');
		setUserName('');
		setStatus('');
	}
	const totalPages = Math.max(1, Math.ceil(rows.length / HISTORY_PAGE_SIZE));
	const currentPage = Math.min(page, totalPages);
	const pageRows = rows.slice((currentPage - 1) * HISTORY_PAGE_SIZE, currentPage * HISTORY_PAGE_SIZE);

	const columns: DataTableColumn<HistoryRow>[] = [
		{
			key: 'location',
			header: 'Location',
			render: ({ location }) => (
				<Box minW="180px">
					<Text fontWeight="700" color="slate.900" noOfLines={1}>{location.locationName}</Text>
					<Text fontSize="xs" color="slate.500">{location.employees} employee{location.employees === 1 ? '' : 's'}</Text>
				</Box>
			),
		},
		{
			key: 'organization',
			header: 'Organization',
			render: ({ location }) => (
				<Text fontSize="sm" color="slate.700" noOfLines={1} minW="140px">{location.organizationName || '—'}</Text>
			),
		},
		{
			key: 'reference',
			header: variant === 'payroll' ? 'Reference' : 'Letter',
			render: ({ batch }) => (
				<Box>
					<Text fontSize="sm" fontWeight="600" color="slate.800" whiteSpace="nowrap">{batch.reference}</Text>
					<Text fontSize="xs" color="slate.500" whiteSpace="nowrap">
						{variant === 'payroll'
							? `${batch.employees} employees on this run`
							: `${formatLetterDate(batch.letterDate)} · CH. NO: ${batch.chequeNumber || '—'}`}
					</Text>
				</Box>
			),
		},
		{
			key: 'amount',
			header: 'Amount',
			align: 'right',
			render: ({ location }) => <Text fontWeight="800" color="slate.900" whiteSpace="nowrap">{formatAmount(location.total)}</Text>,
		},
		{
			key: 'activity',
			header: 'Activity',
			render: ({ batch, location }) => (
				<ActivityLog
					activity={(batch.activity ?? []).filter((entry) => (
						(!userName || entry.byName === userName)
						&& (!entry.locationName || entry.locationName === location.locationName)
					))}
					labels={labels}
				/>
			),
		},
		{
			key: 'status',
			header: 'Status',
			hideBelow: 'lg',
			render: ({ batch, location }) => {
				if (rowStatus(batch, location) === 'cancelled') return <StatusBadge tone="neutral" label={`Cancelled ${printedOn(location.cancelledAt ?? batch.cancelledAt)}`} />;
				if (batch.partial) return <StatusBadge tone="info" label={`Some employees ${printedOn(batch.createdAt)}`} />;
				return <StatusBadge tone="success" label={`Printed ${printedOn(batch.createdAt)}`} />;
			},
		},
		{
			key: 'actions',
			header: '',
			align: 'right',
			render: ({ batch, location }) => (
				<HStack spacing={1.5} justify="flex-end">
					<IconAction label={words.reprintPdf} icon={<DownloadIcon />} isDisabled={Boolean(busyId)} isLoading={busyId === `${batch.id}:pdf`} onClick={() => onReprint(batch, 'pdf')} />
					<IconAction label="Reprint Excel" icon={<Text fontSize="10px" fontWeight="800">XLS</Text>} isDisabled={Boolean(busyId)} isLoading={busyId === `${batch.id}:excel`} onClick={() => onReprint(batch, 'excel')} />
					<IconAction label="Print again" icon={<PrintIcon boxSize={4} />} isDisabled={Boolean(busyId)} isLoading={busyId === `${batch.id}:print`} onClick={() => onReprint(batch, 'print')} />
					{rowStatus(batch, location) === 'printed' ? (
						<IconAction
							label={`Cancel ${location.locationName} only (it becomes pending again)`}
							tone="danger"
							icon={<CloseIcon boxSize={2.5} />}
							isDisabled={Boolean(busyId)}
							onClick={() => setConfirming({ batch, location })}
						/>
					) : null}
				</HStack>
			),
		},
	];

	return (
		<>
			<FilterBar variant="inset" canClear={hasFilters} onClear={clearFilters}>
				<FilterField label="Organization" flex={{ base: '1 1 100%', md: '0 1 220px' }}>
					<FilterSelect
						label="Filter history by organization"
						value={organizationId}
						onChange={(value) => {
							setOrganizationId(value);
							setLocationId('');
						}}
						options={[{ value: '', label: 'All organizations' }, ...organizationOptions]}
					/>
				</FilterField>
				<FilterField label="Location" flex={{ base: '1 1 100%', md: '0 1 220px' }}>
					<FilterSelect
						label="Filter history by location"
						value={locationId}
						onChange={setLocationId}
						options={[{ value: '', label: 'All locations' }, ...locationOptions]}
					/>
				</FilterField>
				<FilterField label="User" flex={{ base: '1 1 100%', md: '0 1 200px' }}>
					<FilterSelect
						label="Filter history by user"
						value={userName}
						onChange={setUserName}
						options={[{ value: '', label: 'All users' }, ...userOptions]}
					/>
				</FilterField>
				<FilterField label="Status" flex={{ base: '1 1 100%', md: '0 1 160px' }}>
					<FilterSelect
						label="Filter history by status"
						value={status}
						onChange={setStatus}
						options={[{ value: '', label: 'All' }, { value: 'printed', label: 'Printed' }, { value: 'cancelled', label: 'Cancelled' }]}
					/>
				</FilterField>
			</FilterBar>
			<DataTable
				columns={columns}
				rows={pageRows}
				rowKey={(row) => row.key}
				size="sm"
				isLoading={isLoading}
				error={error}
				emptyTitle={hasFilters && allRows.length > 0 ? 'Nothing matches these filters' : words.empty}
				emptyDescription={hasFilters && allRows.length > 0 ? 'Try another organization, location, user or status.' : words.emptyHint}
				footer={rows.length > HISTORY_PAGE_SIZE ? (
					<TableFooter
						page={currentPage}
						pageSize={HISTORY_PAGE_SIZE}
						total={rows.length}
						totalPages={totalPages}
						noun="locations"
						isDisabled={isLoading}
						onPageChange={setPage}
					/>
				) : undefined}
			/>
			<ConfirmDialog
				isOpen={Boolean(confirming)}
				title={confirming ? `Cancel ${confirming.location.locationName}?` : 'Cancel location?'}
				description={confirming
					? `Only ${confirming.location.locationName}${confirming.location.organizationName ? ` (${confirming.location.organizationName})` : ''} is removed from ${confirming.batch.reference} and becomes pending again for this month. Other locations on this ${words.document} stay printed.`
					: ''}
				confirmLabel="Cancel this location"
				isLoading={isCancelling}
				onClose={() => setConfirming(null)}
				onConfirm={() => {
					if (!confirming) return;
					setIsCancelling(true);
					void onCancel(confirming.batch, confirming.location).finally(() => {
						setIsCancelling(false);
						setConfirming(null);
					});
				}}
			/>
		</>
	);
}

export default PrintedHistory;
