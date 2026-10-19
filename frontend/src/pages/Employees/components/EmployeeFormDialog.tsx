import {
  Alert,
  Box,
  FormControl,
  FormLabel,
  Heading,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Select,
  Textarea,
  Text,
} from '@chakra-ui/react';
import { useEffect, useState, type FormEvent } from 'react';
import ActionButton from '../../../components/common/ActionButton';
import FormInput from '../../../components/common/FormInput';
import type { EmployeeInput } from '../../../services/employeeService';
import type { Employee, EmployeeStatus } from '../../../types';

type EmployeeFormDialogProps = {
  isOpen: boolean;
  isSaving: boolean;
  employee: Employee | null;
  onClose: () => void;
  onSave: (input: EmployeeInput) => Promise<boolean>;
};

function EmployeeFormDialog({
  isOpen,
  isSaving,
  employee,
  onClose,
  onSave,
}: EmployeeFormDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [dailySalary, setDailySalary] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [salaryError, setSalaryError] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankRoutingCode, setBankRoutingCode] = useState('');
  const [bankValidationError, setBankValidationError] = useState('');
  const [status, setStatus] = useState<EmployeeStatus>('active');
  const isEditing = employee !== null;
  const bankValues = [bankName, bankBranch, bankAccountHolder, bankAccountNumber, bankRoutingCode];
  const hasBankDetails = bankValues.some((value) => value.trim().length > 0);

  useEffect(() => {
    if (!isOpen) return;
    setName(employee?.name || '');
    setEmail(employee?.email || '');
    setDepartment(employee?.department || '');
    setJobTitle(employee?.jobTitle || '');
    setPhone(employee?.phone || '');
    setAddress(employee?.address || '');
    setDailySalary(employee ? String(employee.dailySalary ?? 0) : '');
    setCurrency(employee?.currency || 'NRI');
    setSalaryError('');
    setBankName(employee?.bankName || '');
    setBankBranch(employee?.bankBranch || '');
    setBankAccountHolder(employee?.bankAccountHolder || '');
    setBankAccountNumber(employee?.bankAccountNumber || '');
    setBankRoutingCode(employee?.bankRoutingCode || '');
    setBankValidationError('');
    setStatus(employee?.status || 'active');
  }, [employee, isOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const salaryAmount = Number(dailySalary);
    if (!dailySalary.trim() || !Number.isFinite(salaryAmount) || salaryAmount < 0 || salaryAmount > 1_000_000_000_000) {
      setSalaryError('Enter a valid non-negative daily salary.');
      return;
    }
    if (Math.abs(Math.round(salaryAmount * 100) / 100 - salaryAmount) > 1e-8) {
      setSalaryError('Salary can have at most two decimal places.');
      return;
    }
    if (!/^[A-Za-z]{3}$/.test(currency.trim())) {
      setSalaryError('Enter a three-letter currency code, such as USD.');
      return;
    }
    if (hasBankDetails && bankValues.some((value) => !value.trim())) {
      setBankValidationError('Complete every bank field, or leave the bank section blank.');
      return;
    }
    setBankValidationError('');
    setSalaryError('');
    const input: EmployeeInput = {
      name,
      email,
      department,
      jobTitle,
      phone,
      address,
      dailySalary: salaryAmount,
      currency: currency.trim().toUpperCase(),
      bankName,
      bankBranch,
      bankAccountHolder,
      bankAccountNumber,
      bankRoutingCode,
      status,
    };
    if (await onSave(input)) onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="4xl"
      closeOnEsc={!isSaving}
      closeOnOverlayClick={!isSaving}
      scrollBehavior="inside"
    >
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(3px)" />
      <ModalContent borderRadius="xl" overflow="hidden" boxShadow="0 24px 64px rgba(15, 23, 42, 0.2)">
        <ModalHeader pb={1} pr={12} fontSize="xl" color="slate.900">
          {isEditing ? 'Edit employee' : 'Add employee'}
        </ModalHeader>
        <ModalCloseButton top={5} right={5} borderRadius="md" isDisabled={isSaving} />
        <ModalBody pt={0} pb={6}>
          <Text mb={5} fontSize="sm" color="slate.500">
            {isEditing ? 'Update employee information' : 'Create an employee record'}
          </Text>
          <form id="employee-form" onSubmit={handleSubmit}>
            <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={5}>
              <FormInput label="Full name" isRequired autoFocus autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
              <FormInput label="Work email" isRequired type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              <FormInput label="Job title" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
              <FormInput label="Department" value={department} onChange={(event) => setDepartment(event.target.value)} />
              <FormInput label="Phone" type="tel" autoComplete="tel" maxLength={30} pattern="\\+?[0-9(). -]{7,30}" value={phone} onChange={(event) => setPhone(event.target.value)} />
              <FormInput
                label="Daily salary (per day)"
                isRequired
                type="number"
                min={0}
                max={1_000_000_000_000}
                step="0.01"
                value={dailySalary}
                onChange={(event) => { setDailySalary(event.target.value); setSalaryError(''); }}
              />
              <FormInput
                label="Currency code"
                isRequired
                minLength={3}
                maxLength={3}
                pattern="[A-Za-z]{3}"
                placeholder="NRI"
                value={currency}
                onChange={(event) => { setCurrency(event.target.value.toUpperCase()); setSalaryError(''); }}
              />
              <FormControl isRequired>
                <FormLabel mb={2} fontSize="sm" fontWeight="600" color="slate.700">Account status</FormLabel>
                <Select h="44px" value={status} onChange={(event) => setStatus(event.target.value as EmployeeStatus)}>
                  <option value="active">Active</option>
                  <option value="disabled">Inactive</option>
                </Select>
              </FormControl>
            </SimpleGrid>
            {salaryError && <Alert mt={4} status="error">{salaryError}</Alert>}
            <FormControl mt={6}>
              <FormLabel mb={2} fontSize="sm" fontWeight="600" color="slate.700">Address</FormLabel>
              <Textarea
                value={address}
                maxLength={500}
                minH="96px"
                resize="vertical"
                placeholder="Street, city, region, postal code, country"
                onChange={(event) => setAddress(event.target.value)}
              />
            </FormControl>
            <Box mt={8}>
              <Heading as="h2" size="sm" color="slate.900">Bank details</Heading>
              <Text mt={1} mb={4} fontSize="sm" color="slate.500">
                Optional. Complete all five fields to add employee payment details.
              </Text>
              <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={5}>
                <FormInput label="Bank name" value={bankName} maxLength={120} onChange={(event) => { setBankName(event.target.value); setBankValidationError(''); }} />
                <FormInput label="Branch" value={bankBranch} maxLength={120} onChange={(event) => { setBankBranch(event.target.value); setBankValidationError(''); }} />
                <FormInput label="Account holder" value={bankAccountHolder} maxLength={100} onChange={(event) => { setBankAccountHolder(event.target.value); setBankValidationError(''); }} />
                <FormInput label="Account number" value={bankAccountNumber} autoComplete="off" minLength={4} maxLength={34} pattern="[A-Za-z0-9 -]{4,34}" onChange={(event) => { setBankAccountNumber(event.target.value); setBankValidationError(''); }} />
                <FormInput label="Routing / bank code" value={bankRoutingCode} autoComplete="off" minLength={3} maxLength={20} pattern="[A-Za-z0-9 -]{3,20}" onChange={(event) => { setBankRoutingCode(event.target.value); setBankValidationError(''); }} />
              </SimpleGrid>
              {bankValidationError && <Alert mt={4} status="error">{bankValidationError}</Alert>}
            </Box>
          </form>
        </ModalBody>
        <ModalFooter gap={3} px={6} py={4} borderTop="1px solid" borderColor="slate.100" bg="slate.50">
          <ActionButton tone="neutral" onClick={onClose} isDisabled={isSaving}>Cancel</ActionButton>
          <ActionButton
            type="submit"
            form="employee-form"
            colorScheme="brand"
            isLoading={isSaving}
          >
            {isEditing ? 'Save changes' : 'Add employee'}
          </ActionButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default EmployeeFormDialog;