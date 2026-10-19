import { DeleteIcon, EditIcon, SearchIcon, ViewIcon } from '@chakra-ui/icons';
import {
  Avatar,
  Badge,
  Box,
  HStack,
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
import type { Employee, EmployeeStatus, UserRole } from '../../../types';

type EmployeeTableProps = {
  employees: Employee[];
  role: UserRole;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  search: string;
  status: 'all' | EmployeeStatus;
  sort: 'name-asc' | 'name-desc' | 'newest' | 'oldest';
  isLoading: boolean;
  loadError: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: 'all' | EmployeeStatus) => void;
  onSortChange: (value: EmployeeTableProps['sort']) => void;
  onPageChange: (page: number) => void;
  onView: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  deleteLabel: string;
};

function EmployeeTable({
  employees,
  role,
  page,
  pageSize,
  total,
  totalPages,
  search,
  status,
  sort,
  isLoading,
  loadError,
  onSearchChange,
  onStatusChange,
  onSortChange,
  onPageChange,
  onView,
  onEdit,
  onDelete,
  deleteLabel,
}: EmployeeTableProps) {
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);
  const columnCount = 5;

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
              aria-label="Search employees"
              placeholder="Search employees..."
              h="40px"
              fontSize="sm"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </InputGroup>
          <HStack spacing={3} ml="auto" flexWrap="wrap">
            <Box minW="150px">
              <Text mb={1} ml={2} fontSize="xs" color="slate.500">Status</Text>
              <Select aria-label="Filter employees by status" h="40px" fontSize="sm" value={status} onChange={(event) => onStatusChange(event.target.value as typeof status)}>
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="disabled">Inactive</option>
              </Select>
            </Box>
            <Box minW="160px">
              <Text mb={1} ml={2} fontSize="xs" color="slate.500">Sort by</Text>
              <Select aria-label="Sort employees" h="40px" fontSize="sm" value={sort} onChange={(event) => onSortChange(event.target.value as typeof sort)}>
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
                <Th fontSize="xs">Employee</Th>
                <Th fontSize="xs">Email</Th>
                <Th fontSize="xs">Phone</Th>
                <Th fontSize="xs">Status</Th>
                <Th fontSize="xs" textAlign="right">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {isLoading ? (
                <Tr><Td colSpan={columnCount} textAlign="center" py={10}><Spinner color="brand.500" /></Td></Tr>
              ) : loadError ? (
                <Tr><Td colSpan={columnCount} textAlign="center" py={10} color="red.600">{loadError}</Td></Tr>
              ) : employees.length === 0 ? (
                <Tr><Td colSpan={columnCount} textAlign="center" py={10} color="slate.500">No employees found.</Td></Tr>
              ) : employees.map((employee) => (
                <Tr key={employee.id}>
                  <Td>
                    <HStack spacing={3} minW="180px">
                      <Avatar size="sm" name={employee.name} />
                      <Text fontWeight="600" color="slate.900">{employee.name}</Text>
                    </HStack>
                  </Td>
                  <Td>{employee.email}</Td>
                  <Td whiteSpace="nowrap">{employee.phone || '—'}</Td>
                  <Td>
                    <Badge
                      px={3}
                      py={1}
                      borderRadius="full"
                      color={employee.status === 'active' ? 'green.600' : 'slate.500'}
                      bg={employee.status === 'active' ? 'green.50' : 'slate.100'}
                      fontSize="xs"
                      fontWeight="600"
                    >
                      {employee.status === 'active' ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  </Td>
                  <Td>
                    <HStack justify="flex-end" spacing={1}>
                      <Tooltip label="View employee">
                        <IconButton aria-label={`View ${employee.name}`} icon={<ViewIcon />} size="md" variant="ghost" color="slate.500" onClick={() => onView(employee)} />
                      </Tooltip>
                      {role === 'admin' && (
                        <Tooltip label="Edit employee">
                          <IconButton aria-label={`Edit ${employee.name}`} icon={<EditIcon />} size="md" variant="ghost" color="slate.500" onClick={() => onEdit(employee)} />
                        </Tooltip>
                      )}
                      <Tooltip label={deleteLabel}>
                        <IconButton
                          aria-label={`${deleteLabel} ${employee.name}`}
                          icon={<DeleteIcon />}
                          size="sm"
                          minW="34px"
                          h="34px"
                          variant="ghost"
                          color="red.600"
                          bg="red.50"
                          borderRadius="md"
                          _hover={{ bg: 'red.100', color: 'red.700' }}
                          _active={{ bg: 'red.200' }}
                          onClick={() => onDelete(employee)}
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
          <Text fontSize="sm" color="slate.500">Showing {firstItem}-{lastItem} of {total}</Text>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            isDisabled={isLoading || Boolean(loadError)}
            onPageChange={onPageChange}
          />
        </HStack>
      </Box>
      <Text srOnly aria-live="polite">{total} employees</Text>
    </>
  );
}

export default EmployeeTable;