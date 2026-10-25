import {
  Alert,
  Avatar,
  Button,
  Checkbox,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Box,
  SimpleGrid,
  Spinner,
  Stack,
  Tag,
  TagCloseButton,
  TagLabel,
  Text,
  useBreakpointValue,
  Wrap,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { ApiError } from '../../../services/api';
import { listEmployees, type EmployeeListParams } from '../../../services/employeeService';
import type { Employee } from '../../../types';
import Pagination from '../../../components/ui/Pagination';

type AssignEmployeeDialogProps = {
  isOpen: boolean;
  isSaving: boolean;
  organizationName: string;
  organizationId?: string;
  locationId?: string;
  locationDesignation?: string;
  onClose: () => void;
  onAssign: (employeeIds: string[]) => Promise<boolean>;
};

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Unable to load unassigned employees.';
}

function AssignEmployeeDialog({
  isOpen,
  isSaving,
  organizationName,
  organizationId,
  locationId,
  locationDesignation,
  onClose,
  onAssign,
}: AssignEmployeeDialogProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<Employee[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const modalSize = useBreakpointValue({ base: 'full', md: '3xl', lg: '4xl' }) ?? '4xl';

  useEffect(() => {
    if (!isOpen) return undefined;
    let isActive = true;
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError('');
    const params: EmployeeListParams = {
      search,
      status: 'active',
      sort: 'name-asc',
      page,
      limit: 10,
      ...(organizationId ? { organizationId } : {}),
      ...(locationId ? { availableForLocationId: locationId } : { unassigned: true }),
      activeOnly: true,
      ...(locationDesignation ? { designation: locationDesignation.toLowerCase() } : {}),
    };
    void listEmployees(params, controller.signal)
      .then((result) => {
        if (!isActive) return;
        setEmployees(result.employees);
        setPage(result.pagination.page);
        setPageSize(result.pagination.limit);
        setTotal(result.pagination.total);
        setTotalPages(result.pagination.totalPages);
      })
      .catch((error: unknown) => {
        if (isActive && !controller.signal.aborted) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    return () => {
      isActive = false;
      controller.abort();
    };
  }, [isOpen, locationDesignation, locationId, organizationId, page, search]);

  async function handleAssign() {
    if (selectedEmployees.length === 0) return;
    if (!await onAssign(selectedEmployees.map(({ id }) => id))) return;
    setSelectedEmployees([]);
    setSearch('');
    setPage(1);
    onClose();
  }

  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function toggleEmployee(employee: Employee, isSelected: boolean) {
    setSelectedEmployees((current) => (
      isSelected
        ? current.some(({ id }) => id === employee.id) ? current : [...current, employee]
        : current.filter(({ id }) => id !== employee.id)
    ));
  }

  function removeSelection(employeeId: string) {
    setSelectedEmployees((current) => current.filter(({ id }) => id !== employeeId));
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={modalSize}
      closeOnEsc={!isSaving}
      closeOnOverlayClick={!isSaving}
      scrollBehavior="inside"
    >
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(3px)" />
      <ModalContent borderRadius={{ base: 0, md: 'xl' }} overflow="hidden" boxShadow="0 24px 64px rgba(15, 23, 42, 0.2)">
        <ModalHeader pb={1} pr={12} fontSize="xl" color="slate.900">Assign employee</ModalHeader>
        <ModalCloseButton top={5} right={5} borderRadius="md" isDisabled={isSaving} />
        <ModalBody pt={0} pb={6} px={{ base: 4, md: 6 }}>
          <Text mb={5} fontSize="sm" color="slate.500">
            Select available {locationDesignation ? `${locationDesignation} ` : ''}employees to add to {organizationName}.
          </Text>
          <Stack spacing={4}>
            <Input
              aria-label="Search unassigned employees"
              placeholder="Search by name, email, or department"
              value={search}
              onChange={(event) => changeSearch(event.target.value)}
            />
            {loadError ? (
              <Alert status="error">{loadError}</Alert>
            ) : isLoading ? (
              <HStack justify="center" py={5}><Spinner color="brand.500" /></HStack>
            ) : total === 0 ? (
              <Text py={3} color="slate.500" fontSize="sm">
                {search ? 'No available employees match this search.' : 'There are no available employees to add.'}
              </Text>
            ) : (
              <>
                  {selectedEmployees.length > 0 && (
                    <Box>
                      <HStack justify="space-between" mb={2}>
                        <Text fontSize="sm" fontWeight="600" color="slate.700">Selected employees</Text>
                        <Button size="xs" variant="ghost" color="slate.500" onClick={() => setSelectedEmployees([])}>
                          Clear all
                        </Button>
                      </HStack>
                      <Wrap spacing={2}>
                        {selectedEmployees.map((employee) => (
                          <Tag key={employee.id} size="sm" colorScheme="brand" borderRadius="full">
                            <TagLabel>{employee.name}</TagLabel>
                            <TagCloseButton aria-label={`Remove ${employee.name}`} onClick={() => removeSelection(employee.id)} />
                          </Tag>
                        ))}
                      </Wrap>
                    </Box>
                  )}
                  <Box
                    border="1px solid"
                    borderColor="slate.200"
                    borderRadius="md"
                    maxH={{ base: '50vh', md: '360px' }}
                    overflowY="auto"
                    bg="slate.50"
                    p={{ base: 2, md: 3 }}
                  >
                    <SimpleGrid templateColumns="repeat(auto-fill, minmax(min(100%, 260px), 1fr))" spacing={{ base: 2, md: 3 }}>
                      {employees.map((employee) => {
                        const isSelected = selectedEmployees.some(({ id }) => id === employee.id);
                        return (
                          <HStack
                            as="label"
                            key={employee.id}
                            spacing={3}
                            minW={0}
                            px={3}
                            py={2.5}
                            cursor="pointer"
                            border="1px solid"
                            borderColor={isSelected ? 'brand.300' : 'slate.200'}
                            borderRadius="md"
                            bg={isSelected ? 'brand.50' : 'white'}
                            boxShadow={isSelected ? '0 0 0 1px var(--chakra-colors-brand-300)' : 'none'}
                            transition="background 0.15s, border-color 0.15s, box-shadow 0.15s"
                            _hover={{ borderColor: 'brand.300' }}
                          >
                            <Checkbox
                              flexShrink={0}
                              colorScheme="brand"
                              isChecked={isSelected}
                              aria-label={`Select ${employee.name}`}
                              onChange={(event) => toggleEmployee(employee, event.target.checked)}
                            />
                            <Avatar size="sm" name={employee.name} flexShrink={0} />
                            <Box flex="1" minW={0}>
                              <Text fontSize="sm" fontWeight="600" color="slate.900" noOfLines={1} title={employee.name}>
                                {employee.name}
                              </Text>
                              <Text fontSize="xs" color="slate.500" noOfLines={1} wordBreak="break-all" title={employee.email}>
                                {employee.email}
                              </Text>
                              {employee.designation && (
                                <Text fontSize="xs" color="slate.400" noOfLines={1} textTransform="capitalize">
                                  {employee.designation}
                                </Text>
                              )}
                            </Box>
                          </HStack>
                        );
                      })}
                    </SimpleGrid>
                  </Box>
                <Stack
                  direction={{ base: 'column', sm: 'row' }}
                  justify="space-between"
                  align={{ base: 'flex-start', sm: 'center' }}
                  spacing={2}
                >
                    <Text fontSize="sm" color="slate.500">
                      {total} available · {selectedEmployees.length} selected
                    </Text>
                  <Pagination currentPage={page} totalPages={totalPages} onPageChange={(value) => {
                    setPage(value);
                  }} />
                </Stack>
                <Text fontSize="xs" color="slate.500">Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)}</Text>
              </>
            )}
          </Stack>
        </ModalBody>
        <ModalFooter gap={3} px={{ base: 4, md: 6 }} py={4} borderTop="1px solid" borderColor="slate.100" bg="slate.50">
          <Button flex={{ base: 1, sm: 'initial' }} variant="outline" onClick={onClose} isDisabled={isSaving}>Cancel</Button>
          <Button flex={{ base: 1, sm: 'initial' }} colorScheme="brand" isLoading={isSaving} isDisabled={selectedEmployees.length === 0 || Boolean(loadError)} onClick={() => void handleAssign()}>
            Add {selectedEmployees.length || ''} to {locationDesignation ? 'location' : 'organization'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default AssignEmployeeDialog;