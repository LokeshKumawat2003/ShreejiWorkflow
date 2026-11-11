import { CloseIcon, DownloadIcon } from '@chakra-ui/icons';
import { Box, Button, HStack, Popover, PopoverArrow, PopoverBody, PopoverContent, PopoverTrigger, Stack, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { ConfirmDialog, DataTable, IconAction, PrintIcon, StatusBadge, type DataTableColumn } from '../../../components/ui';
import type { BankInvoiceActivity, BankInvoiceBatch } from '../../../services/attendanceService';
import { formatAmount } from '../../Payroll/components/PayrollShared';
import { formatLetterDate } from '../utils/bankLetterExport';
import { printedOn } from './LocationPicker';

type ReprintKind = 'pdf' | 'excel' | 'print';

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

function locationSummary(batch: BankInvoiceBatch) {
	const organizations = new Set(batch.locations.map((location) => location.organizationName));
	return `${batch.locations.length} location${batch.locations.length === 1 ? '' : 's'} · ${organizations.size} organization${organizations.size === 1 ? '' : 's'}`;
}

function PrintedHistory({ batches, isLoading, error, busyId, onReprint, onCancel }: PrintedHistoryProps) {
	const [confirming, setConfirming] = useState<BankInvoiceBatch | null>(null);
	const [isCancelling, setIsCancelling] = useState(false);

	const columns: DataTableColumn<BankInvoiceBatch>[] = [
		{
			key: 'reference',
			header: 'Reference',
			render: (batch) => (
				<Box>
					<Text fontWeight="700" color="slate.900" whiteSpace="nowrap">{batch.reference}</Text>
					<Text fontSize="xs" color="slate.500">Printed {printedOn(batch.createdAt)}</Text>
				</Box>
			),
		},
		{
			key: 'letter',
			header: 'Letter date / cheque',
			hideBelow: 'md',
			render: (batch) => (
				<Box>
					<Text fontSize="sm" color="slate.800">{formatLetterDate(batch.letterDate)}</Text>
					<Text fontSize="xs" color="slate.500">CH. NO: {batch.chequeNumber || '—'}</Text>
				</Box>
			),
		},
		{
			key: 'locations',
			header: 'Locations',
			render: (batch) => (
				<Box maxW="360px">
					<Text fontSize="sm" color="slate.800">{locationSummary(batch)}</Text>
					<Text fontSize="xs" color="slate.500" noOfLines={2}>
						{batch.locations.map((location) => `${location.organizationName} – ${location.locationName}`).join(', ')}
					</Text>
				</Box>
			),
		},
		{
			key: 'amount',
			header: 'Amount',
			align: 'right',
			render: (batch) => (
				<Box>
					<Text fontWeight="800" color="slate.900" whiteSpace="nowrap">{formatAmount(batch.total)}</Text>
					<Text fontSize="xs" color="slate.500">{batch.employees} employees</Text>
				</Box>
			),
		},
		{
			key: 'activity',
			header: 'Activity',
			render: (batch) => <ActivityLog activity={batch.activity ?? []} />,
		},
		{
			key: 'status',
			header: 'Status',
			hideBelow: 'lg',
			render: (batch) => (batch.status === 'printed'
				? <StatusBadge tone="success" label="Printed" />
				: <StatusBadge tone="neutral" label="Cancelled" />),
		},
		{
			key: 'actions',
			header: '',
			align: 'right',
			render: (batch) => (
				<HStack spacing={1.5} justify="flex-end">
					<IconAction label="Reprint PDF" icon={<DownloadIcon />} isDisabled={Boolean(busyId)} isLoading={busyId === `${batch.id}:pdf`} onClick={() => onReprint(batch, 'pdf')} />
					<IconAction label="Reprint Excel" icon={<Text fontSize="10px" fontWeight="800">XLS</Text>} isDisabled={Boolean(busyId)} isLoading={busyId === `${batch.id}:excel`} onClick={() => onReprint(batch, 'excel')} />
					<IconAction label="Print again" icon={<PrintIcon boxSize={4} />} isDisabled={Boolean(busyId)} isLoading={busyId === `${batch.id}:print`} onClick={() => onReprint(batch, 'print')} />
					{batch.status === 'printed' ? (
						<IconAction label="Cancel letter (locations become pending again)" tone="danger" icon={<CloseIcon boxSize={2.5} />} isDisabled={Boolean(busyId)} onClick={() => setConfirming(batch)} />
					) : null}
				</HStack>
			),
		},
	];

	return (
		<>
			<DataTable
				columns={columns}
				rows={batches}
				rowKey={(batch) => batch.id}
				size="sm"
				isLoading={isLoading}
				error={error}
				emptyTitle="No letters printed this month"
				emptyDescription="Letters you print from the selected locations show up here."
			/>
			<ConfirmDialog
				isOpen={Boolean(confirming)}
				title="Cancel this bank letter?"
				description={confirming ? `${confirming.reference} will be marked cancelled and its ${confirming.locations.length} location${confirming.locations.length === 1 ? '' : 's'} will show as pending again for this month.` : ''}
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
