import { CloseIcon, DownloadIcon } from '@chakra-ui/icons';
import { Box, Button, HStack, Popover, PopoverArrow, PopoverBody, PopoverContent, PopoverTrigger, Stack, Text } from '@chakra-ui/react';
import { useMemo, useState } from 'react';
import { ConfirmDialog, DataTable, IconAction, PrintIcon, StatusBadge, TableFooter, type DataTableColumn } from '../../../components/ui';
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
	onCancel: (batch: BankInvoiceBatch) => Promise<void>;
};

const ACTION_LABELS: Record<BankInvoiceActivity['action'], { label: string; tone: 'info' | 'success' | 'warning' | 'danger' }> = {
	pdf: { label: 'PDF downloaded', tone: 'info' },
	excel: { label: 'Excel downloaded', tone: 'success' },
	print: { label: 'Printed', tone: 'warning' },
	cancel: { label: 'Cancelled', tone: 'danger' },
};

function activityTime(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return `${printedOn(value)} ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

function ActivityLine({ entry }: { entry: BankInvoiceActivity }) {
	const style = ACTION_LABELS[entry.action];
	return (
		<HStack spacing={2} align="center" flexWrap="wrap">
			<StatusBadge tone={style.tone} label={entry.reprint ? `${style.label} (again)` : style.label} />
			<Text fontSize="xs" color="slate.500" whiteSpace="nowrap">
				{activityTime(entry.at)}{entry.byName ? ` · ${entry.byName}` : ''}
			</Text>
		</HStack>
	);
}

function ActivityLog({ activity }: { activity: BankInvoiceActivity[] }) {
	if (activity.length === 0) return <Text fontSize="xs" color="slate.400">—</Text>;
	const visible = activity.slice(0, 2);
	const hidden = activity.length - visible.length;
	return (
		<Stack spacing={1.5} minW="220px">
			{visible.map((entry, index) => <ActivityLine key={`${entry.at}-${index}`} entry={entry} />)}
			{hidden > 0 ? (
				<Popover placement="bottom-start" isLazy>
					<PopoverTrigger>
						<Button size="xs" variant="link" colorScheme="brand" alignSelf="flex-start">+{hidden} more</Button>
					</PopoverTrigger>
					<PopoverContent w="auto" maxW="360px">
						<PopoverArrow />
						<PopoverBody>
							<Stack spacing={2} maxH="260px" overflowY="auto">
								{activity.map((entry, index) => <ActivityLine key={`${entry.at}-${index}`} entry={entry} />)}
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

function PrintedHistory({ batches, isLoading, error, busyId, onReprint, onCancel }: PrintedHistoryProps) {
	const [confirming, setConfirming] = useState<BankInvoiceBatch | null>(null);
	const [isCancelling, setIsCancelling] = useState(false);
	const [page, setPage] = useState(1);
	const rows = useMemo<HistoryRow[]>(() => batches.flatMap((batch) => batch.locations.map((location) => ({
		key: `${batch.id}:${location.locationId}`,
		batch,
		location,
	}))), [batches]);
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
			header: 'Letter',
			render: ({ batch }) => (
				<Box>
					<Text fontSize="sm" fontWeight="600" color="slate.800" whiteSpace="nowrap">{batch.reference}</Text>
					<Text fontSize="xs" color="slate.500" whiteSpace="nowrap">
						{formatLetterDate(batch.letterDate)} · CH. NO: {batch.chequeNumber || '—'}
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
			render: ({ batch }) => <ActivityLog activity={batch.activity ?? []} />,
		},
		{
			key: 'status',
			header: 'Status',
			hideBelow: 'lg',
			render: ({ batch }) => (batch.status === 'printed'
				? <StatusBadge tone="success" label={`Printed ${printedOn(batch.createdAt)}`} />
				: <StatusBadge tone="neutral" label="Cancelled" />),
		},
		{
			key: 'actions',
			header: '',
			align: 'right',
			render: ({ batch }) => (
				<HStack spacing={1.5} justify="flex-end">
					<IconAction label="Reprint PDF" icon={<DownloadIcon />} isDisabled={Boolean(busyId)} isLoading={busyId === `${batch.id}:pdf`} onClick={() => onReprint(batch, 'pdf')} />
					<IconAction label="Reprint Excel" icon={<Text fontSize="10px" fontWeight="800">XLS</Text>} isDisabled={Boolean(busyId)} isLoading={busyId === `${batch.id}:excel`} onClick={() => onReprint(batch, 'excel')} />
					<IconAction label="Print again" icon={<PrintIcon boxSize={4} />} isDisabled={Boolean(busyId)} isLoading={busyId === `${batch.id}:print`} onClick={() => onReprint(batch, 'print')} />
					{batch.status === 'printed' ? (
						<IconAction label={batch.locations.length > 1 ? `Cancel letter ${batch.reference} (all ${batch.locations.length} locations on it become pending again)` : 'Cancel letter (location becomes pending again)'} tone="danger" icon={<CloseIcon boxSize={2.5} />} isDisabled={Boolean(busyId)} onClick={() => setConfirming(batch)} />
					) : null}
				</HStack>
			),
		},
	];

	return (
		<>
			<DataTable
				columns={columns}
				rows={pageRows}
				rowKey={(row) => row.key}
				size="sm"
				isLoading={isLoading}
				error={error}
				emptyTitle="No letters printed this month"
				emptyDescription="Letters you print from the selected locations show up here."
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
				title="Cancel this bank letter?"
				description={confirming ? `${confirming.reference} will be marked cancelled. These locations will show as pending again for this month: ${confirming.locations.map((location) => location.locationName).join(', ')}.` : ''}
				confirmLabel="Cancel letter"
				isLoading={isCancelling}
				onClose={() => setConfirming(null)}
				onConfirm={() => {
					if (!confirming) return;
					setIsCancelling(true);
					void onCancel(confirming).finally(() => {
						setIsCancelling(false);
						setConfirming(null);
					});
				}}
			/>
		</>
	);
}

export default PrintedHistory;
