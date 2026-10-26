import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Input,
  ListItem,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  OrderedList,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { useRef, useState } from 'react';
import ActionButton from '../../../components/ui/ActionButton';
import { ApiError } from '../../../services/api';
import type { EmployeeImportResult } from '../../../services/employeeService';
import { downloadEmployeeImportTemplate } from '../utils/employeeImportTemplate';

type EmployeeImportDialogProps = {
  isOpen: boolean;
  organizationName?: string;
  onClose: () => void;
  onImport: (file: File) => Promise<EmployeeImportResult>;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function EmployeeImportDialog({ isOpen, organizationName, onClose, onImport }: EmployeeImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<EmployeeImportResult | null>(null);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  function closeDialog() {
    if (isUploading) return;
    setFile(null);
    setResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  }

  async function downloadTemplate() {
    setIsDownloading(true);
    setError('');
    try {
      await downloadEmployeeImportTemplate();
    } catch (caught) {
      setError(errorMessage(caught, 'Unable to prepare the employee Excel template.'));
    } finally {
      setIsDownloading(false);
    }
  }

  async function upload() {
    if (!file) return;
    setIsUploading(true);
    setError('');
    setResult(null);
    try {
      setResult(await onImport(file));
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (caught) {
      setError(errorMessage(caught, 'Unable to import employees from this file.'));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={closeDialog} size="3xl" scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(3px)" />
      <ModalContent borderRadius="xl">
        <ModalHeader>
          <Text>Import employees from Excel</Text>
          <Text mt={0.5} fontSize="sm" fontWeight="400" color="slate.500">
            {organizationName ? `Employees will be added to ${organizationName}.` : 'Employees will be added without an organization; assign them later.'}
          </Text>
        </ModalHeader>
        <ModalCloseButton isDisabled={isUploading} />
        <ModalBody>
          <Stack spacing={5}>
            <Box p={4} borderRadius="md" bg="brand.50" border="1px solid" borderColor="brand.100">
              <OrderedList spacing={1.5} fontSize="sm" color="slate.700">
                <ListItem>
                  Download the Excel template.{' '}
                  <Button variant="link" size="sm" colorScheme="brand" isLoading={isDownloading} loadingText="Preparing..." onClick={() => void downloadTemplate()}>
                    Download employee template
                  </Button>
                </ListItem>
                <ListItem>The "Employees" sheet starts with two yellow example rows that show how to fill it; they are ignored on upload. Add your employees below them, one per row. The "Help" sheet explains every column.</ListItem>
                <ListItem>Name and Email are required. Use the dropdowns for designation, type, skill and Yes/No columns. Write dates as DD-MM-YYYY.</ListItem>
                <ListItem>Save the file and upload it below.</ListItem>
              </OrderedList>
            </Box>

            <Input
              ref={fileInputRef}
              aria-label="Employee Excel file"
              type="file"
              accept=".xlsx,.xls,.csv"
              h="40px"
              pt="6px"
              fontSize="sm"
              isDisabled={isUploading}
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setResult(null);
                setError('');
              }}
            />

            {error ? <Alert status="error" borderRadius="md"><AlertIcon />{error}</Alert> : null}

            {result ? (
              <Stack spacing={3}>
                <Alert status={result.failed.length === 0 ? 'success' : result.created > 0 ? 'warning' : 'error'} borderRadius="md">
                  <AlertIcon />
                  {`${result.created} of ${result.total} employee${result.total === 1 ? '' : 's'} added.`}
                  {result.failed.length > 0 ? ` ${result.failed.length} row${result.failed.length === 1 ? '' : 's'} skipped; fix them in Excel and upload only those rows again.` : ''}
                </Alert>
                {result.failed.length > 0 ? (
                  <TableContainer border="1px solid" borderColor="slate.100" borderRadius="md" maxH="320px" overflowY="auto">
                    <Table size="sm">
                      <Thead position="sticky" top={0} bg="white">
                        <Tr>
                          <Th fontSize="xs">Excel row</Th>
                          <Th fontSize="xs">Name</Th>
                          <Th fontSize="xs">Problem</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {result.failed.map((row) => (
                          <Tr key={row.row} bg="red.50">
                            <Td>{row.row}</Td>
                            <Td>{row.name || '-'}</Td>
                            <Td whiteSpace="normal">{row.message}</Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </TableContainer>
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        </ModalBody>
        <ModalFooter gap={3}>
          <ActionButton tone="neutral" onClick={closeDialog} isDisabled={isUploading}>{result ? 'Done' : 'Cancel'}</ActionButton>
          <ActionButton onClick={() => void upload()} isLoading={isUploading} loadingText="Importing..." isDisabled={!file}>
            Upload and import
          </ActionButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default EmployeeImportDialog;
