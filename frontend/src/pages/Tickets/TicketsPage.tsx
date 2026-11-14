import { AddIcon, CheckCircleIcon, RepeatIcon, TimeIcon, WarningTwoIcon } from '@chakra-ui/icons';
import { Box, Stack, Text, useToast } from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	ActionButton,
	ContentCard,
	DataTable,
	FileIcon,
	FilterBar,
	FilterField,
	FilterSelect,
	PageHeader,
	SearchInput,
	StatStrip,
	TableFooter,
	ChartArt,
	CheckArt,
	ClockArt,
	WarningArt,
	type DataTableColumn,
} from '../../components/ui';
import { ApiError } from '../../services/api';
import { listOrganizations } from '../../services/organizationService';
import {
	createTicket,
	listTickets,
	TICKET_STATUS_OPTIONS,
	TICKET_TYPE_OPTIONS,
	updateTicket,
	type CreateTicketInput,
	type Ticket,
	type TicketListResponse,
	type TicketStatus,
	type TicketType,
	type UpdateTicketInput,
} from '../../services/ticketService';
import type { User, UserRole } from '../../types';
import CreateTicketDialog from './components/CreateTicketDialog';
import TicketDetailsDialog from './components/TicketDetailsDialog';
import { formatTicketDate, TicketPriorityBadge, TicketStatusBadge, ticketTypeLabel } from './components/TicketBadges';

const PAGE_SIZE = 10;

type TicketsPageProps = {
	role: UserRole;
};

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

function TicketsPage({ role }: TicketsPageProps) {
	const toast = useToast();
	const isAdmin = role === 'admin';
	const [search, setSearch] = useState('');
	const debouncedSearch = useDebounced(search);
	const [status, setStatus] = useState<'all' | TicketStatus>('all');
	const [type, setType] = useState<'all' | TicketType>('all');
	const [organizationId, setOrganizationId] = useState('');
	const [organizations, setOrganizations] = useState<User[]>([]);
	const [page, setPage] = useState(1);
	const [data, setData] = useState<TicketListResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState('');
	const [reloadKey, setReloadKey] = useState(0);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState('');

	useEffect(() => {
		if (!isAdmin) return undefined;
		const controller = new AbortController();
		void listOrganizations({ search: '', status: 'all', sort: 'name-asc', page: 1, limit: 100 }, controller.signal)
			.then((result) => setOrganizations(result.organizations))
			.catch(() => undefined);
		return () => controller.abort();
	}, [isAdmin]);

	const query = useMemo(() => ({
		search: debouncedSearch.trim() || undefined,
		status,
		type,
		organizationId: organizationId || undefined,
	}), [debouncedSearch, organizationId, status, type]);

	useEffect(() => {
		setPage(1);
	}, [query]);

	useEffect(() => {
		const controller = new AbortController();
		setIsLoading(true);
		setLoadError('');
		void listTickets({ ...query, page, limit: PAGE_SIZE }, controller.signal)
			.then((result) => {
				setData(result);
				if (result.pagination.page !== page) setPage(result.pagination.page);
			})
			.catch((error: unknown) => {
				if (controller.signal.aborted) return;
				setData(null);
				setLoadError(errorMessage(error, 'Unable to load issue reports.'));
			})
			.finally(() => {
				if (!controller.signal.aborted) setIsLoading(false);
			});
		return () => controller.abort();
	}, [page, query, reloadKey]);

	const reload = useCallback(() => setReloadKey((key) => key + 1), []);

	async function handleCreate(input: CreateTicketInput) {
		setIsSaving(true);
		setSaveError('');
		try {
			const ticket = await createTicket(input);
			setIsCreateOpen(false);
			toast({ title: `Issue reported as ${ticket.ticketNumber}`, status: 'success', position: 'top' });
			reload();
		} catch (error) {
			setSaveError(errorMessage(error, 'Unable to submit the report.'));
		} finally {
			setIsSaving(false);
		}
	}

	async function handleUpdate(input: UpdateTicketInput) {
		if (!selectedTicket) return;
		setIsSaving(true);
		setSaveError('');
		try {
			const ticket = await updateTicket(selectedTicket.id, input);
			setSelectedTicket(null);
			toast({ title: `${ticket.ticketNumber} updated`, status: 'success', position: 'top' });
			reload();
		} catch (error) {
			setSaveError(errorMessage(error, 'Unable to update the ticket.'));
		} finally {
			setIsSaving(false);
		}
	}

	const columns: DataTableColumn<Ticket>[] = [
		{
			key: 'ticket',
			header: 'Ticket',
			render: (row) => (
				<Box minW="200px">
					<Text fontSize="xs" fontFamily="mono" fontWeight="700" color="brand.600">{row.ticketNumber}</Text>
					<Text fontWeight="600" color="slate.900" noOfLines={1}>{row.subject}</Text>
					{isAdmin ? <Text fontSize="xs" color="slate.500" noOfLines={1}>{row.organizationName}</Text> : null}
				</Box>
			),
		},
		{ key: 'type', header: 'Type', hideBelow: 'md', render: (row) => <Text color="slate.700" whiteSpace="nowrap">{ticketTypeLabel(row.type)}</Text> },
		{ key: 'priority', header: 'Priority', hideBelow: 'md', render: (row) => <TicketPriorityBadge priority={row.priority} /> },
		{ key: 'status', header: 'Status', render: (row) => <TicketStatusBadge status={row.status} /> },
		{ key: 'created', header: 'Reported', hideBelow: 'lg', render: (row) => <Text fontSize="sm" color="slate.600" whiteSpace="nowrap">{formatTicketDate(row.createdAt)}</Text> },
	];

	const summary = data?.summary;
	const canClear = Boolean(search || status !== 'all' || type !== 'all' || organizationId);

	return (
		<Stack spacing={6}>
			<PageHeader
				title="Issue reports"
				description={isAdmin
					? 'Issues raised by organizations. Open a ticket to change its status and reply.'
					: 'Report any problem to the admin team and track its progress here.'}
				actions={isAdmin ? undefined : (
					<ActionButton leftIcon={<AddIcon boxSize={3} />} onClick={() => { setSaveError(''); setIsCreateOpen(true); }}>
						Report issue
					</ActionButton>
				)}
			/>

			<StatStrip
				items={[
					{ label: 'Total', value: summary?.total, helper: 'All tickets', color: 'blue.500', icon: <FileIcon boxSize={5} />, art: <ChartArt /> },
					{ label: 'Open', value: summary?.open, helper: 'Waiting for admin', color: 'orange.500', icon: <WarningTwoIcon />, art: <WarningArt /> },
					{ label: 'In progress', value: summary?.in_progress, helper: 'Being worked on', color: 'brand.500', icon: <TimeIcon />, art: <ClockArt /> },
					{
						label: 'Resolved',
						value: summary ? summary.resolved + summary.closed : undefined,
						helper: 'Resolved or closed',
						color: 'green.500',
						icon: <CheckCircleIcon />,
						art: <CheckArt />,
					},
				]}
			/>

			<ContentCard
				noPadding
				icon={<FileIcon boxSize={5} />}
				title={isAdmin ? 'All tickets' : 'My tickets'}
				subtitle="Click a ticket to see the full message and reply"
				actions={(
					<ActionButton tone="neutral" size="sm" leftIcon={<RepeatIcon />} isLoading={isLoading} loadingText="Refreshing" onClick={reload}>
						Refresh
					</ActionButton>
				)}
				toolbar={(
					<FilterBar
						variant="inset"
						canClear={canClear}
						onClear={() => {
							setSearch('');
							setStatus('all');
							setType('all');
							setOrganizationId('');
						}}
					>
						{isAdmin ? (
							<FilterField label="Organization" flex={{ base: '1 1 100%', md: '0 0 220px' }}>
								<FilterSelect
									label="Filter by organization"
									value={organizationId}
									onChange={setOrganizationId}
									options={[{ value: '', label: 'All organizations' }, ...organizations.filter((organization) => organization.id).map((organization) => ({ value: organization.id as string, label: organization.organizationName || organization.name || organization.email }))]}
								/>
							</FilterField>
						) : null}
						<FilterField label="Status" flex={{ base: '1 1 100%', md: '0 0 170px' }}>
							<FilterSelect label="Filter by status" value={status} onChange={setStatus} options={[{ value: 'all', label: 'All statuses' }, ...TICKET_STATUS_OPTIONS]} />
						</FilterField>
						<FilterField label="Type" flex={{ base: '1 1 100%', md: '0 0 190px' }}>
							<FilterSelect label="Filter by type" value={type} onChange={setType} options={[{ value: 'all', label: 'All types' }, ...TICKET_TYPE_OPTIONS]} />
						</FilterField>
						<FilterField label="Search" flex={{ base: '1 1 100%', md: '1 1 200px' }}>
							<SearchInput value={search} onChange={setSearch} placeholder="Ticket no, subject, message..." label="Search tickets" />
						</FilterField>
					</FilterBar>
				)}
			>
				<DataTable
					columns={columns}
					rows={data?.tickets ?? []}
					rowKey={(row) => row.id}
					size="sm"
					isLoading={isLoading}
					error={loadError}
					onRowClick={(row) => { setSaveError(''); setSelectedTicket(row); }}
					emptyTitle={canClear ? 'No tickets match these filters' : 'No issues reported yet'}
					emptyDescription={isAdmin ? 'Tickets raised by organizations will appear here.' : 'Use "Report issue" to tell the admin team about a problem.'}
					footer={data && data.pagination.total > PAGE_SIZE ? (
						<TableFooter
							page={data.pagination.page}
							pageSize={PAGE_SIZE}
							total={data.pagination.total}
							totalPages={data.pagination.totalPages}
							noun="tickets"
							isDisabled={isLoading}
							onPageChange={setPage}
						/>
					) : undefined}
				/>
			</ContentCard>

			<CreateTicketDialog
				isOpen={isCreateOpen}
				isSaving={isSaving}
				error={saveError}
				onClose={() => setIsCreateOpen(false)}
				onSave={(input) => void handleCreate(input)}
			/>
			<TicketDetailsDialog
				ticket={selectedTicket}
				role={role}
				isSaving={isSaving}
				error={saveError}
				onClose={() => setSelectedTicket(null)}
				onSave={(input) => void handleUpdate(input)}
			/>
		</Stack>
	);
}

export default TicketsPage;
