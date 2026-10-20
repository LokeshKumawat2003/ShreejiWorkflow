import {
  Alert,
  Box,
  Checkbox,
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
  requiredDesignation?: string;
  onClose: () => void;
  onSave: (input: EmployeeInput) => Promise<boolean>;
};

function EmployeeFormDialog({
  isOpen,
  isSaving,
  employee,
  requiredDesignation,
  onClose,
  onSave,
}: EmployeeFormDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [parentName, setParentName] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarConsent, setAadhaarConsent] = useState(false);
  const [establishmentLin, setEstablishmentLin] = useState('');
  const [uan, setUan] = useState('');
  const [esicNumber, setEsicNumber] = useState('');
  const [designation, setDesignation] = useState('');
  const [employmentType, setEmploymentType] = useState<EmployeeInput['employmentType']>('');
  const [skillCategory, setSkillCategory] = useState('');
  const [dateOfJoining, setDateOfJoining] = useState('');
  const [basicPay, setBasicPay] = useState('0');
  const [dearnessAllowance, setDearnessAllowance] = useState('0');
  const [otherAllowances, setOtherAllowances] = useState('');
  const [epfoApplicable, setEpfoApplicable] = useState(false);
  const [esicApplicable, setEsicApplicable] = useState(false);
  const [duties, setDuties] = useState('');
  const [maternityBenefits, setMaternityBenefits] = useState('');
  const [otherInformation, setOtherInformation] = useState('');
  const [wageError, setWageError] = useState('');
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
    setPhone(employee?.phone || '');
    setAddress(employee?.address || '');
    setDateOfBirth(employee?.dateOfBirth || '');
    setParentName(employee?.parentName || '');
    setAadhaarNumber(employee?.aadhaarNumber || '');
    setAadhaarConsent(employee?.aadhaarConsent || false);
    setEstablishmentLin(employee?.establishmentLin || '');
    setUan(employee?.uan || '');
    setEsicNumber(employee?.esicNumber || '');
    setDesignation(requiredDesignation || employee?.designation || '');
    setEmploymentType(employee?.employmentType || '');
    setSkillCategory(employee?.skillCategory || '');
    setDateOfJoining(employee?.dateOfJoining || '');
    setBasicPay(String(employee?.basicPay ?? 0));
    setDearnessAllowance(String(employee?.dearnessAllowance ?? 0));
    setOtherAllowances(employee?.otherAllowances || '');
    setEpfoApplicable(employee?.epfoApplicable || false);
    setEsicApplicable(employee?.esicApplicable || false);
    setDuties(employee?.duties || '');
    setMaternityBenefits(employee?.maternityBenefits || '');
    setOtherInformation(employee?.otherInformation || '');
    setWageError('');
    setBankName(employee?.bankName || '');
    setBankBranch(employee?.bankBranch || '');
    setBankAccountHolder(employee?.bankAccountHolder || '');
    setBankAccountNumber(employee?.bankAccountNumber || '');
    setBankRoutingCode(employee?.bankRoutingCode || '');
    setBankValidationError('');
    setStatus(employee?.status || 'active');
  }, [employee, isOpen, requiredDesignation]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const basicPayAmount = Number(basicPay);
    const dearnessAllowanceAmount = Number(dearnessAllowance);
    const wages = [basicPayAmount, dearnessAllowanceAmount];
    if (wages.some((amount) => !Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000_000 || Math.abs(Math.round(amount * 100) / 100 - amount) > 1e-8)) {
      setWageError('Enter valid non-negative wage amounts with at most two decimal places.');
      return;
    }
    if (aadhaarConsent && aadhaarNumber && !/^\d{12}$/.test(aadhaarNumber.replace(/\s/g, ''))) {
      setWageError('Aadhaar number must contain 12 digits.');
      return;
    }
    if (!aadhaarConsent && aadhaarNumber) {
      setWageError('Aadhaar consent is required before storing the number.');
      return;
    }
    if (hasBankDetails && bankValues.some((value) => !value.trim())) {
      setBankValidationError('Complete every bank field, or leave the bank section blank.');
      return;
    }
    setBankValidationError('');
    setWageError('');
    const input: EmployeeInput = {
      name,
      email,
      phone,
      address,
      dateOfBirth,
      parentName,
      aadhaarNumber: aadhaarConsent ? aadhaarNumber.replace(/\s/g, '') : '',
      aadhaarConsent,
      establishmentLin,
      uan,
      esicNumber,
      designation,
      employmentType,
      skillCategory,
      dateOfJoining,
      basicPay: basicPayAmount,
      dearnessAllowance: dearnessAllowanceAmount,
      otherAllowances,
      epfoApplicable,
      esicApplicable,
      duties,
      maternityBenefits,
      otherInformation,
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
              <FormInput label="Name of employee" isRequired autoFocus autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
              <FormInput label="Email" isRequired type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              <FormInput label="Phone number" type="tel" autoComplete="tel" maxLength={30} pattern="\\+?[0-9(). -]{7,30}" value={phone} onChange={(event) => setPhone(event.target.value)} />
              <FormControl>
                <FormLabel mb={2} fontSize="sm" fontWeight="600" color="slate.700">Address</FormLabel>
                <Textarea maxLength={500} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street, city, district, postal code" />
              </FormControl>
              <FormInput label="Date of birth" type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
              <FormInput label="Father's / Mother's name" maxLength={120} value={parentName} onChange={(event) => setParentName(event.target.value)} />
              <FormInput label="Aadhaar number" inputMode="numeric" autoComplete="off" maxLength={12} isDisabled={!aadhaarConsent} value={aadhaarNumber} onChange={(event) => setAadhaarNumber(event.target.value.replace(/\D/g, ''))} />
              <Checkbox isChecked={aadhaarConsent} onChange={(event) => { setAadhaarConsent(event.target.checked); if (!event.target.checked) setAadhaarNumber(''); }}>Consent obtained to collect Aadhaar</Checkbox>
              <FormInput label="Establishment LIN" maxLength={30} value={establishmentLin} onChange={(event) => setEstablishmentLin(event.target.value)} />
              <FormInput label="UAN (if available)" maxLength={30} value={uan} onChange={(event) => setUan(event.target.value)} />
              <FormInput label="ESIC insurance number (if available)" maxLength={30} value={esicNumber} onChange={(event) => setEsicNumber(event.target.value)} />
              <FormControl>
                <FormLabel mb={2} fontSize="sm" fontWeight="600" color="slate.700">Designation</FormLabel>
                <Select h="44px" isRequired={Boolean(requiredDesignation)} isDisabled={Boolean(requiredDesignation)} value={designation} onChange={(event) => setDesignation(event.target.value)}>
                  <option value="">Select designation</option>
                  <option value="Cook">Cook</option>
                  <option value="Plumber">Plumber</option>
                  <option value="Event">Event</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel mb={2} fontSize="sm" fontWeight="600" color="slate.700">Type of employment</FormLabel>
                <Select h="44px" value={employmentType} onChange={(event) => setEmploymentType(event.target.value as EmployeeInput['employmentType'])}>
                  <option value="">Select type</option>
                  <option value="regular">Regular</option>
                  <option value="fixed-term">Fixed-term employment</option>
                  <option value="contractual">Contractual</option>
                </Select>
              </FormControl>
              <FormInput label="Category of skill" maxLength={100} value={skillCategory} onChange={(event) => setSkillCategory(event.target.value)} />
              <FormInput label="Date of joining" type="date" value={dateOfJoining} onChange={(event) => setDateOfJoining(event.target.value)} />
              <FormInput label="Wages / Basic pay" type="number" min={0} max={1_000_000_000_000} step="0.01" value={basicPay} onChange={(event) => { setBasicPay(event.target.value); setWageError(''); }} />
              <FormInput label="Dearness allowance" type="number" min={0} max={1_000_000_000_000} step="0.01" value={dearnessAllowance} onChange={(event) => { setDearnessAllowance(event.target.value); setWageError(''); }} />
              <FormControl>
                <FormLabel mb={2} fontSize="sm" fontWeight="600" color="slate.700">Other allowances (including accommodation)</FormLabel>
                <Textarea maxLength={1000} value={otherAllowances} onChange={(event) => setOtherAllowances(event.target.value)} />
              </FormControl>
              <Checkbox isChecked={epfoApplicable} onChange={(event) => setEpfoApplicable(event.target.checked)}>EPFO applicable</Checkbox>
              <Checkbox isChecked={esicApplicable} onChange={(event) => setEsicApplicable(event.target.checked)}>ESIC applicable</Checkbox>
              <FormControl>
                <FormLabel mb={2} fontSize="sm" fontWeight="600" color="slate.700">Broad nature of duties</FormLabel>
                <Textarea maxLength={2000} value={duties} onChange={(event) => setDuties(event.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel mb={2} fontSize="sm" fontWeight="600" color="slate.700">Maternity benefits under Chapter VI (women employees)</FormLabel>
                <Textarea maxLength={2000} value={maternityBenefits} onChange={(event) => setMaternityBenefits(event.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel mb={2} fontSize="sm" fontWeight="600" color="slate.700">Any other information</FormLabel>
                <Textarea maxLength={2000} value={otherInformation} onChange={(event) => setOtherInformation(event.target.value)} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel mb={2} fontSize="sm" fontWeight="600" color="slate.700">Account status</FormLabel>
                <Select h="44px" value={status} onChange={(event) => setStatus(event.target.value as EmployeeStatus)}>
                  <option value="active">Active</option>
                  <option value="disabled">Inactive</option>
                </Select>
              </FormControl>
            </SimpleGrid>
            {wageError && <Alert mt={4} status="error">{wageError}</Alert>}
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