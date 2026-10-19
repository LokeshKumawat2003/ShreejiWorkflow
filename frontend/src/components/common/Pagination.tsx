import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { Button, HStack, IconButton, Text } from '@chakra-ui/react';

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isDisabled?: boolean;
};

const PAGE_WINDOW = 5;

function Pagination({ currentPage, totalPages, onPageChange, isDisabled = false }: PaginationProps) {
  const lastPage = Math.max(1, totalPages);
  const page = Math.min(Math.max(1, currentPage), lastPage);
  const firstWindowPage = Math.max(1, Math.min(page - 2, lastPage - PAGE_WINDOW + 1));
  const lastWindowPage = Math.min(lastPage, firstWindowPage + PAGE_WINDOW - 1);
  const visiblePages = Array.from(
    { length: lastWindowPage - firstWindowPage + 1 },
    (_, index) => firstWindowPage + index,
  );

  function renderPageButton(pageNumber: number) {
    const isCurrent = pageNumber === page;
    return (
      <Button
        key={pageNumber}
        aria-current={isCurrent ? 'page' : undefined}
        aria-label={`Page ${pageNumber}`}
        h="32px"
        minW="32px"
        px={0}
        size="sm"
        variant={isCurrent ? 'solid' : 'ghost'}
        colorScheme={isCurrent ? 'brand' : undefined}
        isDisabled={isDisabled}
        onClick={() => onPageChange(pageNumber)}
      >
        {pageNumber}
      </Button>
    );
  }

  return (
    <HStack as="nav" aria-label="Pagination" spacing={1}>
      <IconButton
        aria-label="Previous page"
        title="Previous page"
        icon={<ChevronLeftIcon />}
        h="32px"
        minW="32px"
        size="sm"
        variant="outline"
        isDisabled={isDisabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
      />
      {firstWindowPage > 1 && renderPageButton(1)}
      {firstWindowPage > 2 && <Text aria-hidden="true" px={1} color="slate.500">...</Text>}
      {visiblePages.map(renderPageButton)}
      {lastWindowPage < lastPage - 1 && <Text aria-hidden="true" px={1} color="slate.500">...</Text>}
      {lastWindowPage < lastPage && renderPageButton(lastPage)}
      <IconButton
        aria-label="Next page"
        title="Next page"
        icon={<ChevronRightIcon />}
        h="32px"
        minW="32px"
        size="sm"
        variant="outline"
        isDisabled={isDisabled || page >= lastPage}
        onClick={() => onPageChange(page + 1)}
      />
    </HStack>
  );
}

export default Pagination;