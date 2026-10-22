import { AddIcon, DeleteIcon, EditIcon } from '@chakra-ui/icons';
import { HStack, Switch, Text, useToast } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import {
	ActionButton,
	ConfirmDialog,
	ContentCard,
	DataTable,
	FilterBar,
	FilterField,
	FilterSelect,
	IconAction,
	SearchInput,
	type DataTableColumn,
} from '../../../components/ui';
import { ApiError } from '../../../services/api';
import {
	MASTER_DATA_LABELS,
	createMasterData,
	deleteMasterData,
	listMasterData,
	updateMasterData,
} from '../../../services/masterDataService';
import type { MasterDataItem, MasterDataType } from '../../../types';
import MasterDataFormDialog from './MasterDataFormDialog';

type MasterDataPanelProps = {
	type: MasterDataType;
	onCountChange?: (type: MasterDataType, count: number) => void;
};

type StatusFilter = 'all' | MasterDataItem['status'];

const STATUS_OPTIONS = [
	{ value: 'all', label: 'All statuses' },
	{ value: 'active', label: 'Active' },
	{ value: 'disabled', label: 'Inactive' },
];

function errorMessage(error: unknown, fallback: string) {
	return error instanceof ApiError ? error.message : fallback;
}

function formatDate(value: string) {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function MasterDataPanel({ type, onCountChange }: MasterDataPanelProps) {
	const toast = useToast();
	const label = MASTER_DATA_LABELS[type];
	const [items, setItems] = useState<MasterDataItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState('');
	const [search, setSearch] = useState('');
	const [debouncedSearch, setDebouncedSearch] = useState('');
	const [status, setStatus] = useState<StatusFilter>('all');
	const [refreshToken, setRefreshToken] = useState(0);
	const [editingItem, setEditingItem] = useState<MasterDataItem | null>(null);
	const [isFormOpen, setIsFormOpen] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [formError, setFormError] = useState('');
	const [togglingId, setTogglingId] = useState('');
	const [deletingItem, setDeletingItem] = useState<MasterDataItem | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const isFiltered = Boolean(debouncedSearch) || status !== 'all';

	useEffect(() => {
		const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
		return () => window.clearTimeout(timer);
	}, [search]);

	useEffect(() => {
		const controller = new AbortController();
		setIsLoading(true);
		setLoadError('');
		void listMasterData({ type, status, search: debouncedSearch, includeUsage: true }, controller.signal)
			.then((result) => {
				setItems(result);
				if (status === 'all' && !debouncedSearch) onCountChange?.(type, result.length);
			})
			.catch((error: unknown) => {
				if (!controller.signal.aborted) setLoadError(errorMessage(error, `Unable to load ${label.singular} entries.`));
			})
			.finally(() => {
				if (!controller.signal.aborted) setIsLoading(false);
			});
		return () => controller.abort();
	}, [debouncedSearch, label.singular, onCountChange, refreshToken, status, type]);

	function openForm(item: MasterDataItem | null) {
		setEditingItem(item);
		setFormError('');
		setIsFormOpen(true);
	}

	async function saveItem(input: { name: string; status: MasterDataItem['status'] }) {
		setIsSaving(true);
		setFormError('');
		try {
			if (editingItem) await updateMasterData(editingItem.id, input);
			else await createMasterData({ type, ...input });
			toast({ title: editingItem ? `${label.title} updated` : `${label.title} added`, status: 'success', position: 'top' });
			setIsFormOpen(false);
			setRefreshToken((current) => current + 1);
		} catch (error) {
			setFormError(errorMessage(error, `Unable to save the ${label.singular}.`));
		} finally {
			setIsSaving(false);
		}
	}

	async function toggleStatus(item: MasterDataItem) {
		setTogglingId(item.id);
		try {
			const updated = await updateMasterData(item.id, { status: item.status === 'active' ? 'disabled' : 'active' });
			setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, ...updated } : entry)));
		} catch (error) {
			toast({ title: errorMessage(error, 'Unable to update status.'), status: 'error', position: 'top' });
		} finally {
			setTogglingId('');
		}
	}

	async function confirmDelete() {
		if (!deletingItem) return;
		setIsDeleting(true);
		try {
			await deleteMasterData(deletingItem.id);
			toast({ title: `${label.title} deleted`, status: 'success', position: 'top' });
			setDeletingItem(null);
			setRefreshToken((current) => current + 1);
		} catch (error) {
			toast({ title: errorMessage(error, `Unable to delete the ${label.singular}.`), status: 'error', position: 'top', duration: 6000 });
		} finally {
			setIsDeleting(false);
		}
	}

	const columns: DataTableColumn<MasterDataItem>[] = [
		{ key: 'index', header: '#', width: '60px', render: (_, index) => <Text color="slate.500">{index + 1}</Text> },
		{
			key: 'name',
			header: 'Name',
			render: (item) => (
				<>
					<Text fontWeight="600" color="slate.900">{item.name}</Text>
					{type === 'employmentType' ? <Text fontSize="xs" color="slate.400">Code: {item.code}</Text> : null}
				</>
			),
		},
		{
			key: 'usage',
			header: 'Used by',
			render: (item) => (
				<Text color={item.usageCount ? 'slate.900' : 'slate.400'}>
					{item.usageCount ?? 0} record{item.usageCount === 1 ? '' : 's'}
				</Text>
			),
		},
		{ key: 'created', header: 'Created', hideBelow: 'md', render: (item) => <Text color="slate.500">{formatDate(item.createdAt)}</Text> },
		{
			key: 'active',
			header: 'Active',
			render: (item) => (
				<Switch
					aria-label={`${item.status === 'active' ? 'Disable' : 'Enable'} ${item.name}`}
					colorScheme="green"
					isChecked={item.status === 'active'}
					isDisabled={togglingId === item.id}
					onChange={() => void toggleStatus(item)}
				/>
			),
		},
		{
			key: 'actions',
			header: 'Actions',
			align: 'right',
			render: (item) => (
				<HStack spacing={0.5} justify="flex-end">
					<IconAction label={`Edit ${item.name}`} icon={<EditIcon />} onClick={() => openForm(item)} />
					<IconAction
						label={item.usageCount ? `${item.name} is in use: disable it instead` : `Delete ${item.name}`}
						icon={<DeleteIcon />}
						tone="danger"
						isDisabled={Boolean(item.usageCount)}
						onClick={() => setDeletingItem(item)}
					/>
				</HStack>
			),
		},
	];

	return (
		<ContentCard
			title={label.title}
			subtitle={label.description}
			noPadding
			actions={(
				<ActionButton leftIcon={<AddIcon boxSize={3} />} size="sm" h="36px" onClick={() => openForm(null)}>
					Add {label.singular}
				</ActionButton>
			)}
			toolbar={(
				<FilterBar
					variant="inset"
					canClear={isFiltered}
					onClear={() => {
						setSearch('');
						setStatus('all');
					}}
				>
					<FilterField label="Search" flex={{ base: '1 1 100%', md: '1 1 260px' }} maxW={{ md: '400px' }}>
						<SearchInput value={search} onChange={setSearch} placeholder={`Search ${label.singular}...`} />
					</FilterField>
					<FilterField label="Status">
						<FilterSelect<StatusFilter> label="Filter by status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
					</FilterField>
				</FilterBar>
			)}
		>
			<DataTable
				columns={columns}
				rows={items}
				rowKey={(item) => item.id}
				size="sm"
				isLoading={isLoading}
				error={loadError}
				emptyTitle={isFiltered ? 'No matching entries' : `No ${label.singular} entries yet`}
				emptyDescription={isFiltered ? 'Try a different search or filter.' : 'Add one to show it in the dropdown.'}
			/>

			<MasterDataFormDialog
				isOpen={isFormOpen}
				type={type}
				item={editingItem}
				isSaving={isSaving}
				error={formError}
				onClose={() => setIsFormOpen(false)}
				onSave={(input) => void saveItem(input)}
			/>

			<ConfirmDialog
				isOpen={Boolean(deletingItem)}
				title={`Delete ${label.singular}?`}
				description={`"${deletingItem?.name}" will be removed from the ${label.singular} dropdown.`}
				isLoading={isDeleting}
				onClose={() => setDeletingItem(null)}
				onConfirm={() => void confirmDelete()}
			/>
		</ContentCard>
	);
}

export default MasterDataPanel;
