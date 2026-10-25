import { CalendarIcon, ChevronLeftIcon, DownloadIcon, EditIcon, EmailIcon, InfoOutlineIcon, LockIcon, PhoneIcon } from '@chakra-ui/icons';
import {
	Avatar,
	Box,
	Button,
	Heading,
	HStack,
	SimpleGrid,
	Spinner,
	Stack,
	Text,
} from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { ActionButton, BuildingIcon, ContentCard, PeopleIcon, PrintIcon, StatusBadge } from '../../../components/ui';
import useMasterDataOptions, { masterLabel } from '../../../hooks/useMasterDataOptions';
import type { Employee, UserRole } from '../../../types';
import type { PdfAction } from '../../../utils/pdfOutput';

type EmployeeDetailsPageProps = {
	employee: Employee;
	isLoading: boolean;
	role: UserRole;
	onBack: () => void;
	onEdit: () => void;
	onJoiningLetter?: (action: PdfAction) => void;
	isPreparingLetter?: boolean;
};

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

function formatDate(value?: string) {
	if (!value) return '';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatCreatedAt(value?: string) {
	if (!value) return '';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatMoney(value?: number) {
	return typeof value === 'number' && Number.isFinite(value) ? currency.format(value) : '';
}

function EmployeeDetailsPage({ employee, isLoading, role, onBack, onEdit, onJoiningLetter, isPreparingLetter = false }: EmployeeDetailsPageProps) {
	const isAdmin = role === 'admin';
	const { options: masterOptions } = useMasterDataOptions();
	const monthlyPay = (Number(employee.basicPay) || 0) + (Number(employee.dearnessAllowance) || 0);

	return (
		<Stack spacing={6}>
			<Button
				alignSelf="flex-start"
				h="34px"
				px={3}
				variant="ghost"
				borderRadius="full"
				fontSize="sm"
				fontWeight="600"
				color="slate.600"
				leftIcon={<ChevronLeftIcon boxSize={4} />}
				_hover={{ bg: 'white', color: 'slate.900', boxShadow: 'sm' }}
				onClick={onBack}
			>
				Back to employees
			</Button>

			<Box bg="white" border="1px solid" borderColor="slate.200" borderRadius="lg" boxShadow="sm" overflow="hidden">
				<Box
					position="relative"
					h={{ base: '84px', md: '104px' }}
					bgGradient="linear(120deg, teal.500 0%, brand.500 55%, purple.400 100%)"
					overflow="hidden"
				>
					<Box position="absolute" top="-60px" right="-30px" w="220px" h="220px" borderRadius="full" bg="whiteAlpha.200" />
					<Box position="absolute" bottom="-90px" right="180px" w="180px" h="180px" borderRadius="full" bg="whiteAlpha.100" />
					<Box position="absolute" top="-40px" left="35%" w="120px" h="120px" borderRadius="full" bg="whiteAlpha.100" />
				</Box>

				<Box position="relative" px={{ base: 4, md: 6 }} pb={{ base: 5, md: 6 }}>
					<Stack direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ base: 'flex-start', md: 'flex-end' }} spacing={4}>
						<Box minW={0}>
							<Avatar
								mt={{ base: '-36px', md: '-44px' }}
								boxSize={{ base: '72px', md: '88px' }}
								fontSize={{ base: '2xl', md: '3xl' }}
								name={employee.name}
								bg="teal.50"
								color="teal.700"
								border="4px solid white"
								boxShadow="md"
							/>
							<HStack mt={3} spacing={3} flexWrap="wrap">
								<Heading fontSize={{ base: '20px', md: '24px' }} lineHeight="1.25" fontWeight="800" color="slate.900" noOfLines={2}>
									{employee.name}
								</Heading>
								<StatusBadge status={employee.status} />
							</HStack>
							<Text mt={1} fontSize="sm" color="slate.500" noOfLines={1} textTransform="capitalize">
								{[employee.designation || 'Employee', employee.organizationName].filter(Boolean).join(' · ')}
							</Text>
						</Box>
						{isAdmin && (
							<ActionButton borderRadius="full" leftIcon={<EditIcon />} onClick={onEdit} flexShrink={0}>
								Edit employee
							</ActionButton>
						)}
						{onJoiningLetter && (
							<HStack spacing={2} flexShrink={0} flexWrap="wrap">
								<ActionButton borderRadius="full" leftIcon={<DownloadIcon />} isLoading={isPreparingLetter} isDisabled={isLoading} onClick={() => onJoiningLetter('download')}>
									Download joining letter
								</ActionButton>
								<ActionButton tone="neutral" borderRadius="full" leftIcon={<PrintIcon boxSize={4} />} isDisabled={isLoading || isPreparingLetter} onClick={() => onJoiningLetter('print')}>
									Print
								</ActionButton>
							</HStack>
						)}
					</Stack>

					<SimpleGrid mt={6} columns={{ base: 1, sm: 2, xl: 4 }} spacing={3}>
						<InfoTile icon={<EmailIcon boxSize={4} />} color="blue" label="Work email" value={employee.email} />
						<InfoTile icon={<PhoneIcon boxSize={3.5} />} color="green" label="Phone" value={employee.phone} />
						<InfoTile icon={<CalendarIcon boxSize={3.5} />} color="orange" label="Joined on" value={formatDate(employee.dateOfJoining)} />
						<InfoTile
							icon={<Text as="span" fontSize="md" fontWeight="800" lineHeight="1">₹</Text>}
							color="brand"
							label="Basic + DA"
							value={monthlyPay ? currency.format(monthlyPay) : ''}
						/>
					</SimpleGrid>
				</Box>
			</Box>

			{isLoading ? (
				<HStack justify="center" py={12}><Spinner color="brand.500" /></HStack>
			) : (
				<SimpleGrid columns={{ base: 1, xl: 2 }} spacing={6} alignItems="start">
					<Section icon={<PeopleIcon boxSize={5} />} color="teal" title="Personal information" subtitle="Identity and family details">
						<Detail label="Full name" value={employee.name} />
						<Detail label="Date of birth" value={formatDate(employee.dateOfBirth)} />
						<Detail label="Father's / Mother's name" value={employee.parentName} />
						{isAdmin && <Detail label="Aadhaar number" value={employee.aadhaarNumber} mono />}
						<Detail label="Work email" value={employee.email} />
						<Detail label="Phone" value={employee.phone} />
						<Detail label="Home address" value={employee.address} multiline full />
					</Section>

					<Section icon={<BuildingIcon boxSize={5} />} color="brand" title="Employment" subtitle="Role, placement and duties">
						<Detail label="Designation" value={employee.designation} capitalize />
						<Detail label="Type of employment" value={masterLabel(masterOptions.employmentType, employee.employmentType)} />
						<Detail label="Category of skill" value={employee.skillCategory} capitalize />
						<Detail label="Date of joining" value={formatDate(employee.dateOfJoining)} />
						{isAdmin && <Detail label="Organization" value={employee.organizationName} />}
						<Detail label="Account status" value={<StatusBadge status={employee.status} />} />
						<Detail label="Broad nature of duties" value={employee.duties} multiline full />
					</Section>

					<Section icon={<Text as="span" fontSize="lg" fontWeight="800" lineHeight="1">₹</Text>} color="green" title="Salary" subtitle="Monthly pay structure">
						<Detail label="Basic pay" value={formatMoney(employee.basicPay)} emphasis />
						<Detail label="Dearness allowance" value={formatMoney(employee.dearnessAllowance)} emphasis />
						<Detail label="Other allowances" value={employee.otherAllowances} multiline full />
					</Section>

					<Section icon={<LockIcon boxSize={4} />} color="orange" title="Statutory & compliance" subtitle="PF, ESIC and registrations">
						<Detail label="Establishment LIN" value={employee.establishmentLin} mono />
						<Detail label="UAN" value={employee.uan} mono />
						<Detail label="ESIC insurance number" value={employee.esicNumber} mono />
						<Box />
						<Detail label="EPFO applicable" value={<YesNo value={employee.epfoApplicable} />} />
						<Detail label="ESIC applicable" value={<YesNo value={employee.esicApplicable} />} />
					</Section>

					{isAdmin && (
						<Section icon={<BuildingIcon boxSize={5} />} color="blue" title="Bank details" subtitle="Used on salary slips">
							<Detail label="Bank name" value={employee.bankName} />
							<Detail label="Branch" value={employee.bankBranch} />
							<Detail label="Account holder" value={employee.bankAccountHolder} />
							<Detail label="Account number" value={employee.bankAccountNumber} mono />
							<Detail label="Routing / bank code" value={employee.bankRoutingCode} mono />
						</Section>
					)}

					<Section icon={<InfoOutlineIcon boxSize={4} />} color="purple" title="Other information" subtitle="Benefits and notes">
						<Detail label="Maternity benefits under Chapter VI" value={employee.maternityBenefits} multiline full />
						<Detail label="Any other information" value={employee.otherInformation} multiline full />
						{isAdmin && <Detail label="Created" value={formatCreatedAt(employee.createdAt)} />}
						{isAdmin && <Detail label="Employee ID" value={employee.id} mono />}
					</Section>
				</SimpleGrid>
			)}
		</Stack>
	);
}

function Section({ icon, color, title, subtitle, children }: { icon: ReactNode; color: string; title: string; subtitle: string; children: ReactNode }) {
	return (
		<ContentCard
			title={title}
			subtitle={subtitle}
			icon={(
				<Box display="grid" placeItems="center" w="40px" h="40px" borderRadius="md" bg={`${color}.50`} color={`${color}.600`}>
					{icon}
				</Box>
			)}
		>
			<SimpleGrid columns={{ base: 1, sm: 2 }} spacingX={6} spacingY={5}>
				{children}
			</SimpleGrid>
		</ContentCard>
	);
}

function InfoTile({ icon, color, label, value }: { icon: ReactNode; color: string; label: string; value?: string }) {
	return (
		<HStack
			spacing={3}
			p={3}
			minW={0}
			bg="slate.50"
			border="1px solid"
			borderColor="slate.100"
			borderRadius="md"
			transition="all 0.15s ease"
			_hover={{ bg: 'white', borderColor: 'slate.200', boxShadow: 'sm' }}
		>
			<Box display="grid" placeItems="center" flexShrink={0} w="38px" h="38px" borderRadius="10px" bg={`${color}.100`} color={`${color}.600`}>
				{icon}
			</Box>
			<Box minW={0}>
				<Text fontSize="11px" fontWeight="700" letterSpacing="0.06em" textTransform="uppercase" color="slate.400">{label}</Text>
				<Text fontSize="sm" fontWeight="600" color={value ? 'slate.900' : 'slate.400'} noOfLines={1} title={value}>
					{value || 'Not added'}
				</Text>
			</Box>
		</HStack>
	);
}

function YesNo({ value }: { value?: boolean }) {
	return <StatusBadge label={value ? 'Yes' : 'No'} tone={value ? 'success' : 'neutral'} />;
}

type DetailProps = {
	label: string;
	value?: ReactNode;
	multiline?: boolean;
	full?: boolean;
	mono?: boolean;
	emphasis?: boolean;
	capitalize?: boolean;
};

function Detail({ label, value, multiline = false, full = false, mono = false, emphasis = false, capitalize = false }: DetailProps) {
	const isEmpty = value === undefined || value === null || value === '';

	return (
		<Box minW={0} gridColumn={full ? '1 / -1' : undefined}>
			<Text mb={1} fontSize="11px" fontWeight="700" letterSpacing="0.06em" textTransform="uppercase" color="slate.400">
				{label}
			</Text>
			{isEmpty ? (
				<Text fontSize="sm" color="slate.400" fontStyle="italic">Not added</Text>
			) : typeof value === 'string' ? (
				<Text
					fontSize={emphasis ? 'lg' : 'sm'}
					lineHeight="1.5"
					fontWeight={emphasis ? '800' : '600'}
					color="slate.900"
					fontFamily={mono ? 'mono' : undefined}
					letterSpacing={mono ? '0.02em' : undefined}
					overflowWrap="anywhere"
					whiteSpace={multiline ? 'pre-wrap' : undefined}
					textTransform={capitalize ? 'capitalize' : undefined}
				>
					{value}
				</Text>
			) : (
				value
			)}
		</Box>
	);
}

export default EmployeeDetailsPage;
