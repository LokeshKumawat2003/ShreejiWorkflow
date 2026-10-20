import { ChevronLeftIcon, EditIcon } from '@chakra-ui/icons';
import {
	Avatar,
	Badge,
	Box,
	Button,
	Heading,
	HStack,
	SimpleGrid,
	Spinner,
	Stack,
	Text,
} from '@chakra-ui/react';
import type { Employee, UserRole } from '../../../types';

type EmployeeDetailsPageProps = {
	employee: Employee;
	isLoading: boolean;
	role: UserRole;
	onBack: () => void;
	onEdit: () => void;
};

function formatCreatedAt(value?: string) {
	if (!value) return 'Not available';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return 'Not available';
	return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function EmployeeDetailsPage({ employee, isLoading, role, onBack, onEdit }: EmployeeDetailsPageProps) {
	const isActive = employee.status === 'active';
	const maskedAccount = employee.bankAccountNumber
		? `•••• ${employee.bankAccountNumber.slice(-4)}`
		: 'Not provided';

	return (
		<Stack spacing={6}>
			<Button alignSelf="flex-start" h="36px" px={2} variant="ghost" fontSize="sm" color="slate.600" leftIcon={<ChevronLeftIcon />} onClick={onBack}>
				Back to employees
			</Button>
			<HStack justify="space-between" align="center" flexWrap="wrap" gap={4}>
				<HStack spacing={4} minW={0}>
					<Avatar size="lg" name={employee.name} />
					<Box minW={0}>
						<Heading fontSize="26px" lineHeight="1.2" fontWeight="700" color="slate.900" noOfLines={2}>
							{employee.name}
						</Heading>
						<Text mt={1} fontSize="14px" color="slate.500">{employee.designation || 'Employee'}</Text>
					</Box>
				</HStack>
				{role === 'admin' && (
					<Button h="40px" fontSize="sm" leftIcon={<EditIcon />} colorScheme="brand" onClick={onEdit}>
						Edit employee
					</Button>
				)}
			</HStack>

			<Box bg="white" border="1px solid" borderColor="slate.200" borderRadius="8px" overflow="hidden">
				<Heading as="h2" fontSize="16px" fontWeight="700" color="slate.900" px={{ base: 4, md: 6 }} py={4} borderBottom="1px solid" borderColor="slate.100">
					Employee details
				</Heading>
				{isLoading ? (
					<HStack justify="center" py={12}><Spinner color="brand.500" /></HStack>
				) : (
					<SimpleGrid columns={{ base: 1, md: 2 }} spacingX={10} spacingY={7} p={{ base: 4, md: 6 }}>
						<Detail label="Full name" value={employee.name} />
						<Detail label="Work email" value={employee.email} />
						<Detail label="Date of birth" value={employee.dateOfBirth} />
						<Detail label="Father's / Mother's name" value={employee.parentName} />
						{role === 'admin' && <Detail label="Aadhaar number" value={employee.aadhaarNumber} />}
						<Detail label="Establishment LIN" value={employee.establishmentLin} />
						<Detail label="UAN" value={employee.uan} />
						<Detail label="ESIC insurance number" value={employee.esicNumber} />
						<Detail label="Designation" value={employee.designation} />
						<Detail label="Type of employment" value={employee.employmentType} />
						<Detail label="Category of skill" value={employee.skillCategory} />
						<Detail label="Date of joining" value={employee.dateOfJoining} />
						<Detail label="Basic pay" value={String(employee.basicPay)} />
						<Detail label="Dearness allowance" value={String(employee.dearnessAllowance)} />
						<Detail label="Other allowances" value={employee.otherAllowances} multiline />
						<Detail label="EPFO applicable" value={employee.epfoApplicable ? 'Yes' : 'No'} />
						<Detail label="ESIC applicable" value={employee.esicApplicable ? 'Yes' : 'No'} />
						<Detail label="Broad nature of duties" value={employee.duties} multiline />
						<Detail label="Maternity benefits under Chapter VI" value={employee.maternityBenefits} multiline />
						<Detail label="Any other information" value={employee.otherInformation} multiline />
						<Detail label="Phone" value={employee.phone} />
						{role === 'admin' && <Detail label="Organization" value={employee.organizationName} />}
						<Box>
							<Text mb={1} fontSize="13px" fontWeight="600" color="slate.500">Account status</Text>
							<Badge px={3} py={1} borderRadius="full" color={isActive ? 'green.600' : 'slate.500'} bg={isActive ? 'green.50' : 'slate.100'} fontSize="xs" fontWeight="600">
								{isActive ? 'ACTIVE' : 'INACTIVE'}
							</Badge>
						</Box>
						{role === 'admin' && employee.bankName && (
							<>
								<Detail label="Bank name" value={employee.bankName} />
								<Detail label="Branch" value={employee.bankBranch} />
								<Detail label="Bank account holder" value={employee.bankAccountHolder} />
								<Detail label="Account number" value={maskedAccount} />
								<Detail label="Routing / bank code" value={employee.bankRoutingCode} />
							</>
						)}
						{role === 'admin' && (
							<>
								<Detail label="Created" value={formatCreatedAt(employee.createdAt)} />
								<Detail label="Employee ID" value={employee.id} />
							</>
						)}
					</SimpleGrid>
				)}
			</Box>
		</Stack>
	);
}

function Detail({ label, value, multiline = false }: { label: string; value?: string; multiline?: boolean }) {
	return (
		<Box minW={0}>
			<Text mb={1} fontSize="13px" fontWeight="600" color="slate.500">{label}</Text>
			<Text fontSize="16px" lineHeight="1.5" fontWeight="600" color="slate.900" overflowWrap="anywhere" whiteSpace={multiline ? 'pre-wrap' : undefined}>
				{value || 'Not available'}
			</Text>
		</Box>
	);
}

export default EmployeeDetailsPage;
