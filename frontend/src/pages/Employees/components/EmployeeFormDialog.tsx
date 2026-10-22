import { InfoOutlineIcon } from '@chakra-ui/icons';
import {
  Alert,
  AlertIcon,
  Box,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
} from '@chakra-ui/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import ActionButton from '../../../components/ui/ActionButton';
import FormInput from '../../../components/ui/FormInput';
import FormSection from '../../../components/ui/FormSection';
import MasterDataSelect from '../../../components/ui/MasterDataSelect';
import { fieldLabelStyles, fieldStyles } from '../../../components/ui/fieldStyles';
import useMasterDataOptions from '../../../hooks/useMasterDataOptions';
import type { EmployeeInput } from '../../../services/employeeService';
import type { Employee, EmployeeStatus } from '../../../types';
import { isValidPhone } from '../../../utils/formValidation';

type EmployeeFormDialogProps = {
  isOpen: boolean;
  isSaving: boolean;
  employee: Employee | null;
  requiredDesignation?: string;
  onClose: () => void;
  onSave: (input: EmployeeInput) => Promise<boolean>;
};

const CURRENCIES = ['INR', 'NPR', 'USD', 'AED', 'EUR', 'GBP'];
const MAX_AMOUNT = 1_000_000_000_000;

function isValidAmount(amount: number) {
  return Number.isFinite(amount) && amount >= 0 && amount <= MAX_AMOUNT && Math.abs(Math.round(amount * 100) / 100 - amount) <= 1e-8;
}

function normalizeCurrency(value?: string) {
  const currency = (value || '').toUpperCase();
  return !currency || currency === 'NRI' ? 'INR' : currency;
}

function TextAreaField({ label, value, maxLength, placeholder, onChange }: {
  label: string;
  value: string;
  maxLength: number;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <FormControl>
      <FormLabel {...fieldLabelStyles}>{label}</FormLabel>
      <Textarea {...fieldStyles} rows={3} resize="vertical" maxLength={maxLength} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </FormControl>
  );
}

function ToggleField({ label, description, isChecked, onChange }: {
  label: string;
  description: string;
  isChecked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <FormControl
      as={HStack}
      justify="space-between"
      spacing={4}
      p={3}
      h="100%"
      border="1px solid"
      borderColor={isChecked ? 'brand.200' : 'slate.200'}
      bg={isChecked ? 'brand.50' : 'white'}
      borderRadius="md"
      transition="all 0.15s ease"
    >
      <Box minW={0}>
        <FormLabel m={0} fontSize="sm" fontWeight="600" color="slate.900" cursor="pointer">{label}</FormLabel>
        <Text fontSize="xs" color="slate.500">{description}</Text>
      </Box>
      <Switch colorScheme="brand" isChecked={isChecked} onChange={(event) => onChange(event.target.checked)} />
    </FormControl>
  );
}

function EmployeeFormDialog({
  isOpen,
  isSaving,
  employee,
  requiredDesignation,
  onClose,
  onSave,
}: EmployeeFormDialogProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
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
  const [employmentType, setEmploymentType] = useState('');
  const { options: masterOptions, isLoading: isLoadingMasterData } = useMasterDataOptions(isOpen);
  const [skillCategory, setSkillCategory] = useState('');
  const [dateOfJoining, setDateOfJoining] = useState('');
  const [dailySalary, setDailySalary] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [basicPay, setBasicPay] = useState('0');
  const [dearnessAllowance, setDearnessAllowance] = useState('0');
  const [otherAllowances, setOtherAllowances] = useState('');
  const [epfoApplicable, setEpfoApplicable] = useState(false);
  const [esicApplicable, setEsicApplicable] = useState(false);
  const [duties, setDuties] = useState('');
  const [maternityBenefits, setMaternityBenefits] = useState('');
  const [otherInformation, setOtherInformation] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankRoutingCode, setBankRoutingCode] = useState('');
  const [status, setStatus] = useState<EmployeeStatus>('active');
  const [formError, setFormError] = useState('');
  const isEditing = employee !== null;
  const bankValues = [bankName, bankBranch, bankAccountHolder, bankAccountNumber, bankRoutingCode];
  const hasBankDetails = bankValues.some((value) => value.trim().length > 0);
  const currencyOptions = CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES];

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
    setDailySalary(employee?.dailySalary ? String(employee.dailySalary) : '');
    setCurrency(normalizeCurrency(employee?.currency));
    setBasicPay(String(employee?.basicPay ?? 0));
    setDearnessAllowance(String(employee?.dearnessAllowance ?? 0));
    setOtherAllowances(employee?.otherAllowances || '');
    setEpfoApplicable(employee?.epfoApplicable || false);
    setEsicApplicable(employee?.esicApplicable || false);
    setDuties(employee?.duties || '');
    setMaternityBenefits(employee?.maternityBenefits || '');
    setOtherInformation(employee?.otherInformation || '');
    setBankName(employee?.bankName || '');
    setBankBranch(employee?.bankBranch || '');
    setBankAccountHolder(employee?.bankAccountHolder || '');
    setBankAccountNumber(employee?.bankAccountNumber || '');
    setBankRoutingCode(employee?.bankRoutingCode || '');
    setStatus(employee?.status || 'active');
    setFormError('');
  }, [employee, isOpen, requiredDesignation]);

  function showError(message: string) {
    setFormError(message);
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const dailySalaryAmount = dailySalary.trim() ? Number(dailySalary) : 0;
    const basicPayAmount = basicPay.trim() ? Number(basicPay) : 0;
    const dearnessAllowanceAmount = dearnessAllowance.trim() ? Number(dearnessAllowance) : 0;
    const cleanPhone = phone.trim();

    if (!isValidPhone(cleanPhone)) {
      showError('Enter a valid phone number with at least 7 digits.');
      return;
    }
    if (![dailySalaryAmount, basicPayAmount, dearnessAllowanceAmount].every(isValidAmount)) {
      showError('Enter valid non-negative amounts with at most two decimal places.');
      return;
    }
    if (aadhaarNumber && !aadhaarConsent) {
      showError('Aadhaar consent is required before storing the number.');
      return;
    }
    if (aadhaarConsent && aadhaarNumber && !/^\d{12}$/.test(aadhaarNumber)) {
      showError('Aadhaar number must contain 12 digits.');
      return;
    }
    if (hasBankDetails && bankValues.some((value) => !value.trim())) {
      showError('Complete every bank field, or leave the bank section blank.');
      return;
    }
    setFormError('');

    const input: EmployeeInput = {
      name: name.trim(),
      email: email.trim(),
      phone: cleanPhone,
      address,
      dateOfBirth,
      parentName,
      aadhaarNumber: aadhaarConsent ? aadhaarNumber : '',
      aadhaarConsent,
      establishmentLin,
      uan,
      esicNumber,
      designation,
      employmentType,
      skillCategory,
      dateOfJoining,
      dailySalary: dailySalaryAmount,
      currency,
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
        <ModalHeader pb={3} pr={12} borderBottom="1px solid" borderColor="slate.100">
          <Text fontSize="xl" fontWeight="800" color="slate.900">{isEditing ? 'Edit employee' : 'Add employee'}</Text>
          <Text mt={0.5} fontSize="sm" fontWeight="400" color="slate.500">
            {isEditing ? 'Update the employee record. Fields marked * are required.' : 'Create an employee record. Fields marked * are required.'}
          </Text>
        </ModalHeader>
        <ModalCloseButton top={5} right={5} borderRadius="md" isDisabled={isSaving} />
        <ModalBody ref={bodyRef} py={5} bg="slate.50">
          <form id="employee-form" onSubmit={handleSubmit}>
            <Stack spacing={5}>
              {formError ? (
                <Alert status="error" borderRadius="md">
                  <AlertIcon />
                  {formError}
                </Alert>
              ) : null}

              <FormSection title="Personal details" description="Basic contact information for the employee.">
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormInput label="Name of employee" isRequired autoFocus autoComplete="name" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
                  <FormInput label="Email" isRequired type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
                  <FormInput label="Phone number" type="tel" autoComplete="tel" maxLength={30} placeholder="+91 98765 43210" value={phone} onChange={(event) => setPhone(event.target.value)} />
                  <FormInput label="Father's / Mother's name" maxLength={120} value={parentName} onChange={(event) => setParentName(event.target.value)} />
                  <FormInput label="Date of birth" type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
                  <Box gridColumn={{ md: 'span 2' }}>
                    <TextAreaField label="Home address" maxLength={500} placeholder="Street, city, district, postal code" value={address} onChange={setAddress} />
                  </Box>
                </SimpleGrid>
              </FormSection>

              <FormSection title="Job details" description="Role, employment terms and account status.">
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                  <FormControl isRequired={Boolean(requiredDesignation)}>
                    <FormLabel {...fieldLabelStyles}>Designation</FormLabel>
                    <MasterDataSelect
                      h="44px"
                      {...fieldStyles}
                      items={masterOptions.designation}
                      valueKey="name"
                      placeholder={isLoadingMasterData ? 'Loading…' : 'Select designation'}
                      isDisabled={Boolean(requiredDesignation)}
                      value={designation}
                      onChange={setDesignation}
                    />
                    {requiredDesignation ? <FormHelperText fontSize="xs">Set by the location.</FormHelperText> : null}
                  </FormControl>
                  <FormControl>
                    <FormLabel {...fieldLabelStyles}>Type of employment</FormLabel>
                    <MasterDataSelect
                      h="44px"
                      {...fieldStyles}
                      items={masterOptions.employmentType}
                      valueKey="code"
                      placeholder={isLoadingMasterData ? 'Loading…' : 'Select type'}
                      value={employmentType}
                      onChange={setEmploymentType}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel {...fieldLabelStyles}>Category of skill</FormLabel>
                    <MasterDataSelect
                      h="44px"
                      {...fieldStyles}
                      items={masterOptions.skillCategory}
                      valueKey="name"
                      placeholder={isLoadingMasterData ? 'Loading…' : 'Select category'}
                      value={skillCategory}
                      onChange={setSkillCategory}
                    />
                  </FormControl>
                  <FormInput label="Date of joining" type="date" value={dateOfJoining} onChange={(event) => setDateOfJoining(event.target.value)} />
                  <FormControl isRequired>
                    <FormLabel {...fieldLabelStyles}>Account status</FormLabel>
                    <Select h="44px" {...fieldStyles} value={status} onChange={(event) => setStatus(event.target.value as EmployeeStatus)}>
                      <option value="active">Active</option>
                      <option value="disabled">Inactive</option>
                    </Select>
                  </FormControl>
                </SimpleGrid>
              </FormSection>

              <FormSection title="Salary & wages" description="The daily rate is used for payroll, salary slips and the appointment letter.">
                <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
                  <Box gridColumn={{ lg: 'span 2' }}>
                    <FormInput
                      label="Daily salary"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={MAX_AMOUNT}
                      step="0.01"
                      placeholder="e.g. 650"
                      value={dailySalary}
                      helperText="Payable per present day."
                      onChange={(event) => setDailySalary(event.target.value)}
                    />
                  </Box>
                  <Box gridColumn={{ lg: 'span 2' }}>
                    <FormControl>
                      <FormLabel {...fieldLabelStyles}>Currency</FormLabel>
                      <Select h="44px" {...fieldStyles} value={currency} onChange={(event) => setCurrency(event.target.value)}>
                        {currencyOptions.map((code) => <option key={code} value={code}>{code}</option>)}
                      </Select>
                    </FormControl>
                  </Box>
                  <Box gridColumn={{ lg: 'span 2' }}>
                    <FormInput label="Wages / Basic pay" type="number" inputMode="decimal" min={0} max={MAX_AMOUNT} step="0.01" value={basicPay} onChange={(event) => setBasicPay(event.target.value)} />
                  </Box>
                  <Box gridColumn={{ lg: 'span 2' }}>
                    <FormInput label="Dearness allowance" type="number" inputMode="decimal" min={0} max={MAX_AMOUNT} step="0.01" value={dearnessAllowance} onChange={(event) => setDearnessAllowance(event.target.value)} />
                  </Box>
                  <Box gridColumn={{ md: 'span 2', lg: 'span 4' }}>
                    <TextAreaField label="Other allowances (including accommodation)" maxLength={1000} value={otherAllowances} onChange={setOtherAllowances} />
                  </Box>
                </SimpleGrid>
              </FormSection>

              <FormSection title="Statutory & identity" description="Aadhaar, PF and ESIC details for compliance registers.">
                <Stack spacing={4}>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <ToggleField
                      label="Aadhaar consent"
                      description="Consent obtained to collect Aadhaar"
                      isChecked={aadhaarConsent}
                      onChange={(checked) => {
                        setAadhaarConsent(checked);
                        if (!checked) setAadhaarNumber('');
                      }}
                    />
                    <FormInput
                      label="Aadhaar number"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={12}
                      placeholder={aadhaarConsent ? '12-digit number' : 'Turn on consent first'}
                      isDisabled={!aadhaarConsent}
                      value={aadhaarNumber}
                      onChange={(event) => setAadhaarNumber(event.target.value.replace(/\D/g, ''))}
                    />
                  </SimpleGrid>
                  <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                    <FormInput label="Establishment LIN" maxLength={30} value={establishmentLin} onChange={(event) => setEstablishmentLin(event.target.value)} />
                    <FormInput label="UAN (if available)" maxLength={30} value={uan} onChange={(event) => setUan(event.target.value)} />
                    <FormInput label="ESIC insurance number" maxLength={30} value={esicNumber} onChange={(event) => setEsicNumber(event.target.value)} />
                  </SimpleGrid>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <ToggleField label="EPFO applicable" description="Provident fund deductions apply" isChecked={epfoApplicable} onChange={setEpfoApplicable} />
                    <ToggleField label="ESIC applicable" description="State insurance deductions apply" isChecked={esicApplicable} onChange={setEsicApplicable} />
                  </SimpleGrid>
                </Stack>
              </FormSection>

              <FormSection title="Bank details" description="Optional. Complete all five fields to add payment details.">
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                  <FormInput label="Bank name" value={bankName} maxLength={120} onChange={(event) => setBankName(event.target.value)} />
                  <FormInput label="Branch" value={bankBranch} maxLength={120} onChange={(event) => setBankBranch(event.target.value)} />
                  <FormInput label="Account holder" value={bankAccountHolder} maxLength={100} onChange={(event) => setBankAccountHolder(event.target.value)} />
                  <FormInput label="Account number" value={bankAccountNumber} autoComplete="off" minLength={4} maxLength={34} pattern="[A-Za-z0-9 \-]{4,34}" onChange={(event) => setBankAccountNumber(event.target.value)} />
                  <FormInput label="IFSC / routing code" value={bankRoutingCode} autoComplete="off" minLength={3} maxLength={20} pattern="[A-Za-z0-9 \-]{3,20}" onChange={(event) => setBankRoutingCode(event.target.value.toUpperCase())} />
                </SimpleGrid>
              </FormSection>

              <FormSection title="Additional information">
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <TextAreaField label="Broad nature of duties" maxLength={2000} value={duties} onChange={setDuties} />
                  <TextAreaField label="Maternity benefits (women employees)" maxLength={2000} value={maternityBenefits} onChange={setMaternityBenefits} />
                  <Box gridColumn={{ md: 'span 2' }}>
                    <TextAreaField label="Any other information" maxLength={2000} value={otherInformation} onChange={setOtherInformation} />
                  </Box>
                </SimpleGrid>
              </FormSection>
            </Stack>
          </form>
        </ModalBody>
        <ModalFooter gap={3} px={6} py={4} borderTop="1px solid" borderColor="slate.100" bg="white" justifyContent="space-between">
          <HStack spacing={2} fontSize="xs" color="slate.500" display={{ base: 'none', md: 'flex' }}>
            <InfoOutlineIcon />
            <Text>Daily salary drives payroll; leave it blank to set later.</Text>
          </HStack>
          <HStack spacing={3}>
            <ActionButton tone="neutral" onClick={onClose} isDisabled={isSaving}>Cancel</ActionButton>
            <ActionButton type="submit" form="employee-form" isLoading={isSaving}>
              {isEditing ? 'Save changes' : 'Add employee'}
            </ActionButton>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default EmployeeFormDialog;
