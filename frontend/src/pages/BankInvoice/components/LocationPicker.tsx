import { ChevronDownIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { Alert, Box, Button, ButtonGroup, Checkbox, Collapse, Flex, HStack, IconButton, Skeleton, Stack, Text } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState, SearchInput, StatusBadge, TableFooter } from '../../../components/ui';
import type { BankInvoiceLocation, BankInvoiceLocationsResponse, BankInvoiceOrganization } from '../../../services/attendanceService';
import { formatAmount } from '../../Payroll/components/PayrollShared';
import { formatLetterDate } from '../utils/bankLetterExport';

type View = 'pending' | 'printed' | 'all';

const ORGANIZATIONS_PER_PAGE = 5;

type LocationPickerProps = {
	data: BankInvoiceLocationsResponse | null;
	isLoading: boolean;
	error: string;
	selected: string[];
	onChange: (locationIds: string[]) => void;
};

export function isSelectable(location: BankInvoiceLocation) {
	return location.status === 'pending' && location.employees > 0;
}

function matchesView(location: BankInvoiceLocation, view: View) {
	if (view === 'all') return true;
	if (view === 'printed') return location.status === 'printed';
	return isSelectable(location);
}

export function printedOn(value: string | null) {
	if (!value) return '';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	const pad = (number: number) => String(number).padStart(2, '0');
	return formatLetterDate(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
}

function LocationPicker({ data, isLoading, error, selected, onChange }: LocationPickerProps) {
	const [view, setView] = useState<View>('pending');
	const [search, setSearch] = useState('');
	const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
	const selectedSet = useMemo(() => new Set(selected), [selected]);

	const groups = useMemo<BankInvoiceOrganization[]>(() => {
		const term = search.trim().toLowerCase();
		return (data?.organizations ?? [])
			.map((organization) => {
				const organizationMatches = term ? organization.organizationName.toLowerCase().includes(term) : true;
				return {
					...organization,
					locations: organization.locations.filter((location) => matchesView(location, view)
						&& (organizationMatches || location.locationName.toLowerCase().includes(term))),
				};
			})
			.filter((organization) => organization.locations.length > 0);
	}, [data, search, view]);

	const [page, setPage] = useState(1);
	const totalPages = Math.max(1, Math.ceil(groups.length / ORGANIZATIONS_PER_PAGE));
	const currentPage = Math.min(page, totalPages);
	const pageGroups = groups.slice((currentPage - 1) * ORGANIZATIONS_PER_PAGE, currentPage * ORGANIZATIONS_PER_PAGE);

	useEffect(() => {
		setPage(1);
	}, [search, view, data?.month]);

	const selectedTotal = useMemo(() => (data?.organizations ?? [])
		.flatMap((organization) => organization.locations)
		.filter((location) => selectedSet.has(location.locationId))
		.reduce((sum, location) => sum + location.total, 0), [data, selectedSet]);

	function toggle(ids: string[], checked: boolean) {
		const next = new Set(selectedSet);
		for (const id of ids) {
			if (checked) next.add(id);
			else next.delete(id);
		}
		onChange([...next]);
	}

	function toggleCollapsed(organizationId: string) {
		setCollapsed((current) => {
			const next = new Set(current);
			if (next.has(organizationId)) next.delete(organizationId);
			else next.add(organizationId);
			return next;
		});
	}

	const counts = data?.summary;

	return (
		<Stack spacing={3}>
			<Flex gap={3} direction={{ base: 'column', md: 'row' }} align={{ base: 'stretch', md: 'center' }} justify="space-between">
				<ButtonGroup size="sm" isAttached variant="outline">
					{([
						['pending', `Pending${counts ? ` (${counts.pending})` : ''}`],
						['printed', `Printed${counts ? ` (${counts.printed})` : ''}`],
						['all', 'All'],
					] as const).map(([value, label]) => (
						<Button
							key={value}
							onClick={() => setView(value)}
							bg={view === value ? 'brand.500' : 'white'}
							color={view === value ? 'white' : 'slate.700'}
							borderColor={view === value ? 'brand.500' : 'slate.200'}
							_hover={{ bg: view === value ? 'brand.600' : 'slate.50' }}
						>
							{label}
						</Button>
					))}
				</ButtonGroup>
				<Box flex={{ base: '1 1 auto', md: '0 1 320px' }}>
					<SearchInput value={search} onChange={setSearch} placeholder="Organization or location..." label="Search locations" />
				</Box>
			</Flex>

			{error ? <Alert status="error" borderRadius="md" fontSize="sm">{error}</Alert> : null}

			{isLoading && !data ? (
				<Stack spacing={2}>
					{[0, 1, 2].map((row) => <Skeleton key={row} h="44px" borderRadius="md" />)}
				</Stack>
			) : groups.length === 0 ? (
				<EmptyState
					title={view === 'printed' ? 'Nothing printed yet this month' : 'No locations to show'}
					description={view === 'pending' ? 'Every location with payments this month is already on a printed letter.' : undefined}
				/>
			) : (
				<Stack spacing={2}>
					{pageGroups.map((organization) => {
						const selectable = organization.locations.filter(isSelectable).map((location) => location.locationId);
						const selectedCount = selectable.filter((id) => selectedSet.has(id)).length;
						const isOpen = !collapsed.has(organization.organizationId);
						return (
							<Box key={organization.organizationId} flexShrink={0} border="1px solid" borderColor="slate.200" borderRadius="md" overflow="hidden">
								<HStack px={3} py={2} bg="slate.50" spacing={2}>
									<IconButton
										aria-label={isOpen ? 'Collapse' : 'Expand'}
										icon={isOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
										size="xs"
										variant="ghost"
										onClick={() => toggleCollapsed(organization.organizationId)}
									/>
									<Checkbox
										colorScheme="brand"
										aria-label={`Select all pending locations of ${organization.organizationName}`}
										isDisabled={selectable.length === 0}
										isChecked={selectable.length > 0 && selectedCount === selectable.length}
										isIndeterminate={selectedCount > 0 && selectedCount < selectable.length}
										onChange={(event) => toggle(selectable, event.target.checked)}
									/>
									<Text
										fontWeight="700"
										color="slate.800"
										fontSize="sm"
										noOfLines={1}
										cursor="pointer"
										onClick={() => toggleCollapsed(organization.organizationId)}
									>
										{organization.organizationName}
									</Text>
									<Text ml="auto" fontSize="xs" color="slate.500" whiteSpace="nowrap">
										{selectedCount > 0 ? `${selectedCount} selected · ` : ''}{organization.locations.length} location{organization.locations.length === 1 ? '' : 's'}
									</Text>
								</HStack>
								<Collapse in={isOpen} animateOpacity>
									<Stack spacing={0} divider={<Box borderTop="1px solid" borderColor="slate.100" />}>
										{organization.locations.map((location) => (
											<Flex key={location.locationId} px={3} py={2} pl={10} gap={3} align="center" wrap="wrap">
												<HStack flex="1 1 220px" minW={0} spacing={2}>
													<Checkbox
														colorScheme="brand"
														aria-label={`Select ${location.locationName}`}
														isDisabled={!isSelectable(location)}
														isChecked={selectedSet.has(location.locationId)}
														onChange={(event) => toggle([location.locationId], event.target.checked)}
													/>
													<Text
														fontSize="sm"
														color={isSelectable(location) ? 'slate.800' : 'slate.500'}
														noOfLines={1}
														cursor={isSelectable(location) ? 'pointer' : 'default'}
														onClick={() => isSelectable(location) && toggle([location.locationId], !selectedSet.has(location.locationId))}
													>
														{location.locationName}
													</Text>
												</HStack>
												<Text fontSize="xs" color="slate.500" whiteSpace="nowrap">
													{location.employees} employee{location.employees === 1 ? '' : 's'}
													{location.missingBankDetails > 0 ? ` · ${location.missingBankDetails} missing bank` : ''}
												</Text>
												<Text fontSize="sm" fontWeight="700" color="slate.900" minW="96px" textAlign="right" whiteSpace="nowrap">
													{formatAmount(location.total)}
												</Text>
												<Box minW="150px" textAlign="right">
													{location.status === 'printed' ? (
														<StatusBadge tone="success" label={`Printed ${printedOn(location.printedAt)}`} />
													) : location.employees === 0 ? (
														<StatusBadge tone="neutral" label="No payments" />
													) : (
														<StatusBadge tone="warning" label="Pending" />
													)}
												</Box>
											</Flex>
										))}
									</Stack>
								</Collapse>
							</Box>
						);
					})}
				</Stack>
			)}

			{groups.length > ORGANIZATIONS_PER_PAGE ? (
				<Box mx={{ base: -4, md: -5 }}>
					<TableFooter
						page={currentPage}
						pageSize={ORGANIZATIONS_PER_PAGE}
						total={groups.length}
						totalPages={totalPages}
						noun="organizations"
						onPageChange={setPage}
					/>
				</Box>
			) : null}

			<HStack justify="space-between" fontSize="sm" color="slate.600" flexWrap="wrap">
				<Text>
					<Text as="span" fontWeight="700" color="slate.900">{selected.length}</Text> location{selected.length === 1 ? '' : 's'} selected
					{selected.length > 0 ? <> · <Text as="span" fontWeight="700" color="green.600">{formatAmount(selectedTotal)}</Text></> : null}
				</Text>
				{selected.length > 0 ? (
					<Button size="xs" variant="link" colorScheme="brand" onClick={() => onChange([])}>Clear selection</Button>
				) : null}
			</HStack>
		</Stack>
	);
}

export default LocationPicker;
