import { DeleteIcon, EditIcon, SearchIcon, ViewIcon } from '@chakra-ui/icons';
import {
  Badge,
  Avatar,
  HStack,
  Box,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
} from '@chakra-ui/react';
import Pagination from '../../../components/common/Pagination';
import type { User } from '../../../types';

type OrganizationTableProps = {
  organizations: User[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  search: string;
  isLoading: boolean;
  loadError: string;
  statusFilter: 'all' | 'active' | 'disabled';
  sortOrder: 'name-asc' | 'name-desc' | 'newest' | 'oldest';
  onSearchChange: (value: string) => void;
  onStatusChange: (value: 'all' | 'active' | 'disabled') => void;
  onSortChange: (value: 'name-asc' | 'name-desc' | 'newest' | 'oldest') => void;
  onPageChange: (value: number) => void;
  onView: (organization: User) => void;
  onEdit: (organization: User) => void;
  onDelete: (organization: User) => void;
};

function OrganizationTable({
  organizations,
  page,
  pageSize,
  total,
  totalPages,
  search,
  isLoading,
  loadError,
  statusFilter,
  sortOrder,
  onSearchChange,
  onStatusChange,
  onSortChange,
  onPageChange,
  onView,
  onEdit,
  onDelete,
}: OrganizationTableProps) {
  const firstOrganization = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastOrganization = Math.min(page * pageSize, total);

  return (
    <>
      <Box bg="white" border="1px solid" borderColor="slate.200" borderRadius="8px" overflow="hidden">
        <HStack
          align="center"
          justify="space-between"
          flexWrap="wrap"
          gap={4}
          px={{ base: 3, md: 4 }}
          py={4}
          borderBottom="1px solid"
          borderColor="slate.100"
        >
          <InputGroup flex="1" minW="220px" maxW="370px">
            <InputLeftElement pointerEvents="none" color="slate.400"><SearchIcon /></InputLeftElement>
            <Input
              aria-label="Search organizations"
              placeholder="Search organizations..."
              h="40px"
              fontSize="sm"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </InputGroup>
          <HStack spacing={3} ml="auto" flexWrap="wrap">
            <Box minW="176px">
              <Text mb={1} ml={2} fontSize="xs" color="slate.500">Status</Text>
              <Select
                aria-label="Filter organizations by status"
                h="40px"
                fontSize="sm"
                value={statusFilter}
                onChange={(event) => onStatusChange(event.target.value as typeof statusFilter)}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="disabled">Inactive</option>
              </Select>
            </Box>
            <Box minW="176px">
              <Text mb={1} ml={2} fontSize="xs" color="slate.500">Sort by</Text>
              <Select
                aria-label="Sort organizations"
                h="40px"
                fontSize="sm"
                value={sortOrder}
                onChange={(event) => onSortChange(event.target.value as typeof sortOrder)}
              >
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </Select>
            </Box>
          </HStack>
        </HStack>

        <TableContainer>
        <Table variant="simple" size="md" fontSize="sm">
          <Thead>
            <Tr>
              <Th fontSize="xs">Organization</Th>
              <Th fontSize="xs">Account holder</Th>
              <Th fontSize="xs">Email</Th>
              <Th fontSize="xs">Members</Th>
              <Th fontSize="xs">Status</Th>
              <Th fontSize="xs" textAlign="right">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {isLoading ? (
              <Tr><Td colSpan={6} textAlign="center" py={10}><Spinner color="brand.500" /></Td></Tr>
            ) : loadError ? (
              <Tr><Td colSpan={6} textAlign="center" py={10} color="red.600">{loadError}</Td></Tr>
            ) : organizations.length === 0 ? (
              <Tr><Td colSpan={6} textAlign="center" py={10} color="slate.500">No organizations found.</Td></Tr>
            ) : organizations.map((organization) => (
              <Tr key={organization.id}>
                <Td>
                  <HStack spacing={3}>
                    <Avatar size="sm" name={organization.organizationName} />
                    <Text fontWeight="600" color="slate.900">{organization.organizationName}</Text>
                  </HStack>
                </Td>
                <Td>{organization.name}</Td>
                <Td>{organization.email}</Td>
                <Td color="slate.500">—</Td>
                <Td>
                  <Badge
                    px={3}
                    py={1}
                    borderRadius="full"
                    color={organization.status === 'active' ? 'green.600' : 'slate.500'}
                    bg={organization.status === 'active' ? 'green.50' : 'slate.100'}
                    fontSize="xs"
                    fontWeight="600"
                  >
                    {organization.status === 'active' ? 'ACTIVE' : 'INACTIVE'}
                  </Badge>
                </Td>
                <Td>
                  <HStack justify="flex-end" spacing={1}>
                    <Tooltip label="View organization">
                      <IconButton
                        aria-label={`View ${organization.organizationName}`}
                        icon={<ViewIcon />}
                        size="md"
                        variant="ghost"
                        color="slate.500"
                        _hover={{ bg: 'slate.100', color: 'brand.600' }}
                        onClick={() => onView(organization)}
                      />
                    </Tooltip>
                    <Tooltip label="Edit organization">
                      <IconButton
                        aria-label={`Edit ${organization.organizationName}`}
                        icon={<EditIcon />}
                        size="md"
                        variant="ghost"
                        color="slate.500"
                        _hover={{ bg: 'slate.100', color: 'brand.600' }}
                        onClick={() => onEdit(organization)}
                      />
                    </Tooltip>
                    <Tooltip label="Delete organization">
                      <IconButton
                        aria-label={`Delete ${organization.organizationName}`}
                        icon={<DeleteIcon />}
                        size="md"
                        variant="ghost"
                        color="red.600"
                        _hover={{ bg: 'red.50', color: 'red.600' }}
                        onClick={() => onDelete(organization)}
                      />
                    </Tooltip>
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        </TableContainer>
        <HStack justify="space-between" flexWrap="wrap" gap={3} px={{ base: 3, md: 4 }} py={3} borderTop="1px solid" borderColor="slate.100">
          <Text fontSize="sm" color="slate.500">Showing {firstOrganization}-{lastOrganization} of {total}</Text>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            isDisabled={isLoading || Boolean(loadError)}
            onPageChange={onPageChange}
          />
        </HStack>
      </Box>
      <Text srOnly aria-live="polite">{total} organizations</Text>
    </>
  );
}

export default OrganizationTable;