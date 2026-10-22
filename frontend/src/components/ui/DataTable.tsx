import { Alert, Box, Skeleton, Stack, Table, TableContainer, Tbody, Td, Th, Thead, Tr } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import EmptyState from './EmptyState';

export type DataTableColumn<T> = {
	key: string;
	header: ReactNode;
	render: (row: T, index: number) => ReactNode;
	align?: 'left' | 'center' | 'right';
	width?: string;
	hideBelow?: 'md' | 'lg';
};

type DataTableProps<T> = {
	columns: DataTableColumn<T>[];
	rows: T[];
	rowKey: (row: T) => string;
	isLoading?: boolean;
	error?: string;
	emptyTitle?: string;
	emptyDescription?: string;
	emptyAction?: ReactNode;
	onRowClick?: (row: T) => void;
	size?: 'sm' | 'md';
	footer?: ReactNode;
};

function DataTable<T>({
	columns,
	rows,
	rowKey,
	isLoading = false,
	error,
	emptyTitle = 'Nothing here yet',
	emptyDescription,
	emptyAction,
	onRowClick,
	size = 'md',
	footer,
}: DataTableProps<T>) {
	const cellY = size === 'sm' ? 3 : 4;
	const display = (column: DataTableColumn<T>) => (column.hideBelow ? { base: 'none', [column.hideBelow]: 'table-cell' } : undefined);

	let body: ReactNode;
	if (error) {
		body = <Box p={4}><Alert status="error" borderRadius="md">{error}</Alert></Box>;
	} else if (isLoading && rows.length === 0) {
		body = (
			<Stack p={4} spacing={3}>
				{[0, 1, 2, 3, 4].map((row) => <Skeleton key={row} h="48px" borderRadius="md" />)}
			</Stack>
		);
	} else if (rows.length === 0) {
		body = <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
	} else {
		body = (
			<Box position="relative" opacity={isLoading ? 0.6 : 1} transition="opacity 0.15s">
				<TableContainer>
					<Table variant="simple">
						<Thead>
							<Tr>
								{columns.map((column) => (
									<Th
										key={column.key}
										py={3}
										w={column.width}
										textAlign={column.align}
										display={display(column)}
										bg="slate.50"
										fontSize="11px"
										fontWeight="700"
										color="slate.500"
										letterSpacing="0.06em"
										borderColor="slate.200"
									>
										{column.header}
									</Th>
								))}
							</Tr>
						</Thead>
						<Tbody>
							{rows.map((row, index) => (
								<Tr
									key={rowKey(row)}
									cursor={onRowClick ? 'pointer' : undefined}
									onClick={onRowClick ? () => onRowClick(row) : undefined}
									transition="background 0.15s ease"
									_hover={{ bg: '#F8F9FF' }}
									sx={{
										'&:last-of-type > td': { borderBottom: 'none' },
										'& > td:first-of-type': { boxShadow: 'inset 3px 0 0 transparent', transition: 'box-shadow 0.15s ease' },
										'&:hover > td:first-of-type': { boxShadow: 'inset 3px 0 0 var(--chakra-colors-brand-400)' },
									}}
								>
									{columns.map((column) => (
										<Td key={column.key} py={cellY} textAlign={column.align} display={display(column)} borderColor="slate.100" fontSize="sm" verticalAlign="middle">
											{column.render(row, index)}
										</Td>
									))}
								</Tr>
							))}
						</Tbody>
					</Table>
				</TableContainer>
			</Box>
		);
	}

	return (
		<>
			{body}
			{footer}
		</>
	);
}

export default DataTable;
