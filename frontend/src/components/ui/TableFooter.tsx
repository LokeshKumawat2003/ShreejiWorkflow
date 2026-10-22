import { HStack, Text } from '@chakra-ui/react';
import Pagination from './Pagination';

type TableFooterProps = {
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
	noun: string;
	isDisabled?: boolean;
	onPageChange: (page: number) => void;
};

function TableFooter({ page, pageSize, total, totalPages, noun, isDisabled, onPageChange }: TableFooterProps) {
	const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
	const last = Math.min(page * pageSize, total);

	return (
		<HStack justify="space-between" flexWrap="wrap" gap={3} px={{ base: 4, md: 5 }} py={3} borderTop="1px solid" borderColor="slate.100">
			<Text fontSize="sm" color="slate.600" aria-live="polite">
				{total === 0 ? `No ${noun}` : `Showing ${first}–${last} of ${total} ${noun}`}
			</Text>
			<Pagination currentPage={page} totalPages={totalPages} isDisabled={isDisabled} onPageChange={onPageChange} />
		</HStack>
	);
}

export default TableFooter;
