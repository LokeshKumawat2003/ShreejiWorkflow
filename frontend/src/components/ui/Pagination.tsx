import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { Button, HStack, IconButton, Text } from '@chakra-ui/react';

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isDisabled?: boolean;
};

const PAGE_WINDOW = 5;

const navButtonStyles = {
  h: '34px',
  minW: '42px',
  size: 'sm',
  variant: 'outline',
  borderRadius: 'full',
  borderColor: 'slate.200',
  color: 'slate.600',
  fontSize: 'lg',
  _hover: { bg: 'slate.50', borderColor: 'slate.300' },
} as const;

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
        h="34px"
        minW="34px"
        px={0}
        size="sm"
        borderRadius="full"
        variant="ghost"
        bg={isCurrent ? 'slate.900' : 'transparent'}
        color={isCurrent ? 'white' : 'slate.600'}
        _hover={{ bg: isCurrent ? 'slate.800' : 'slate.100' }}
        isDisabled={isDisabled}
        onClick={() => onPageChange(pageNumber)}
      >
        {pageNumber}
      </Button>
    );
  }

  return (
    <HStack as="nav" aria-label="Pagination" spacing={1.5}>
      <IconButton
        aria-label="Previous page"
        title="Previous page"
        icon={<ChevronLeftIcon />}
        {...navButtonStyles}
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
        {...navButtonStyles}
        isDisabled={isDisabled || page >= lastPage}
        onClick={() => onPageChange(page + 1)}
      />
    </HStack>
  );
}

export default Pagination;
