import { AddIcon, DeleteIcon, EditIcon, SearchIcon } from '@chakra-ui/icons';
import {
	Alert,
	AlertDialog,
	AlertDialogBody,
	AlertDialogContent,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogOverlay,
	Box,
	Flex,
	HStack,
	IconButton,
	Input,
	InputGroup,
	InputLeftElement,
	Select,
	Skeleton,
	Stack,
	Switch,
	Table,
	TableContainer,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tooltip,
	Tr,
	useToast,
} from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import ActionButton from '../../../components/common/ActionButton';
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
	const cancelRef = useRef<HTMLButtonElement>(null!);

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
		const nextStatus = item.status === 'active' ? 'disabled' : 'active';
		setTogglingId(item.id);
		try {
			const updated = await updateMasterData(item.id, { status: nextStatus });
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

	return (
		<Box bg="white" border="1px solid" borderColor="slate.200" borderRadius="lg" boxShadow="sm" overflow="hidden">
			<Flex
				direction={{ base: 'column', md: 'row' }}
				justify="space-between"
				align={{ base: 'stretch', md: 'center' }}
				gap={3}
				px={{ base: 4, md: 5 }}
				py={4}
				borderBottom="1px solid"
				borderColor="slate.100"
			>
				<Box>
					<Text fontWeight="700" color="slate.900">{label.title}</Text>
					<Text fontSize="sm" color="slate.500">{label.description}</Text>
				</Box>
				<ActionButton leftIcon={<AddIcon boxSize={3} />} size="sm" h="36px" onClick={() => openForm(null)}>
					Add {label.singular}
				</ActionButton>
			</Flex>

			<HStack spacing={3} px={{ base: 4, md: 5 }} py={3} bg="slate.50" borderBottom="1px solid" borderColor="slate.100" flexWrap="wrap">
				<InputGroup maxW={{ base: '100%', md: '320px' }} size="sm">
					<InputLeftElement pointerEvents="none" color="slate.400">
						<SearchIcon boxSize={3} />
					</InputLeftElement>
					<Input
						aria-label={`Search ${label.singular}`}
						placeholder={`Search ${label.singular}`}
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						bg="white"
						borderRadius="md"
					/>
				</InputGroup>
				<Select
					aria-label="Filter by status"
					size="sm"
					w="auto"
					value={status}
					onChange={(event) => setStatus(event.target.value as StatusFilter)}
					bg="white"
					borderRadius="md"
				>
					<option value="all">All statuses</option>
					<option value="active">Active</option>
					<option value="disabled">Inactive</option>
				</Select>
			</HStack>

			{loadError ? (
				<Alert status="error">{loadError}</Alert>
			) : isLoading && items.length === 0 ? (
				<Stack p={5} spacing={3}>
					{[0, 1, 2].map((row) => <Skeleton key={row} h="40px" borderRadius="md" />)}
				</Stack>
			) : items.length === 0 ? (
				<Box py={12} textAlign="center">
					<Text fontWeight="600" color="slate.900">
						{debouncedSearch || status !== 'all' ? 'No matching entries' : `No ${label.singular} entries yet`}
					</Text>
					<Text fontSize="sm" color="slate.500">
						{debouncedSearch || status !== 'all' ? 'Try a different search or filter.' : `Add one to show it in the dropdown.`}
					</Text>
				</Box>
			) : (
				<TableContainer opacity={isLoading ? 0.6 : 1} transition="opacity 0.15s">
					<Table size="sm" variant="simple">
						<Thead bg="slate.50">
							<Tr>
								<Th py={3} w="60px">#</Th>
								<Th py={3}>Name</Th>
								<Th py={3}>Used by</Th>
								<Th py={3}>Created</Th>
								<Th py={3}>Active</Th>
								<Th py={3} textAlign="right">Actions</Th>
							</Tr>
						</Thead>
						<Tbody>
							{items.map((item, index) => (
								<Tr key={item.id} _hover={{ bg: 'slate.50' }}>
									<Td color="slate.500">{index + 1}</Td>
									<Td>
										<Text fontWeight="600" color="slate.900">{item.name}</Text>
										{type === 'employmentType' ? <Text fontSize="xs" color="slate.400">Code: {item.code}</Text> : null}
									</Td>
									<Td>
										<Text fontSize="sm" color={item.usageCount ? 'slate.900' : 'slate.400'}>
											{item.usageCount ?? 0} record{item.usageCount === 1 ? '' : 's'}
										</Text>
									</Td>
									<Td color="slate.500" fontSize="sm">{formatDate(item.createdAt)}</Td>
									<Td>
										<Switch
											aria-label={`${item.status === 'active' ? 'Disable' : 'Enable'} ${item.name}`}
											colorScheme="green"
											isChecked={item.status === 'active'}
											isDisabled={togglingId === item.id}
											onChange={() => void toggleStatus(item)}
										/>
									</Td>
									<Td textAlign="right">
										<HStack spacing={1} justify="flex-end">
											<Tooltip label="Edit" hasArrow>
												<IconButton aria-label={`Edit ${item.name}`} icon={<EditIcon />} size="sm" variant="ghost" onClick={() => openForm(item)} />
											</Tooltip>
											<Tooltip label={item.usageCount ? 'In use: disable it instead' : 'Delete'} hasArrow>
												<IconButton
													aria-label={`Delete ${item.name}`}
													icon={<DeleteIcon />}
													size="sm"
													variant="ghost"
													color="red.500"
													isDisabled={Boolean(item.usageCount)}
													onClick={() => setDeletingItem(item)}
												/>
											</Tooltip>
										</HStack>
									</Td>
								</Tr>
							))}
						</Tbody>
					</Table>
				</TableContainer>
			)}

			<MasterDataFormDialog
				isOpen={isFormOpen}
				type={type}
				item={editingItem}
				isSaving={isSaving}
				error={formError}
				onClose={() => setIsFormOpen(false)}
				onSave={(input) => void saveItem(input)}
			/>

			<AlertDialog isOpen={Boolean(deletingItem)} leastDestructiveRef={cancelRef} onClose={() => setDeletingItem(null)}>
				<AlertDialogOverlay>
					<AlertDialogContent>
						<AlertDialogHeader>Delete {label.singular}?</AlertDialogHeader>
						<AlertDialogBody>
							"{deletingItem?.name}" will be removed from the {label.singular} dropdown.
						</AlertDialogBody>
						<AlertDialogFooter>
							<ActionButton ref={cancelRef} tone="neutral" onClick={() => setDeletingItem(null)}>Cancel</ActionButton>
							<ActionButton tone="danger" onClick={() => void confirmDelete()} isLoading={isDeleting} ml={3}>Delete</ActionButton>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialogOverlay>
			</AlertDialog>
		</Box>
	);
}

export default MasterDataPanel;
