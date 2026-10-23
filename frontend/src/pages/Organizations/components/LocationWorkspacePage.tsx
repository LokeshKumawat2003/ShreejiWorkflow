import { CalendarIcon, ChevronLeftIcon, InfoOutlineIcon, TimeIcon } from '@chakra-ui/icons';
import { Avatar, Box, Button, Heading, HStack, SimpleGrid, Stack, Tab, TabList, TabPanel, TabPanels, Tabs, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { BuildingIcon, MapPinIcon, PeopleIcon, StatusBadge } from '../../../components/ui';
import type { OrganizationLocation, User } from '../../../types';
import AttendanceRegisterGrid from '../../Attendance/components/AttendanceRegisterGrid';
import AttendanceHistory from '../../Attendance/components/AttendanceHistory';
import OrganizationEmployeesPage from './OrganizationEmployeesPage';
import LocationPayrollPage from '../../Payroll/components/LocationPayrollPage';

type LocationWorkspacePageProps = {
	organization: User;
	location: OrganizationLocation;
	onBack: () => void;
};

const workspaceTabs = [
	{ label: 'Employees', icon: <PeopleIcon boxSize={4} /> },
	{ label: 'Attendance', icon: <CalendarIcon boxSize={3.5} /> },
	{ label: 'Attendance history', icon: <TimeIcon boxSize={3.5} /> },
	{ label: 'Payroll', icon: <Text as="span" fontSize="sm" fontWeight="800" lineHeight="1">₹</Text> },
];

function LocationWorkspacePage({ organization, location, onBack }: LocationWorkspacePageProps) {
	const organizationId = organization.id || organization._id;
	const missingId = <Text color="red.600">This organization has no valid ID.</Text>;

	return (
		<Tabs colorScheme="brand" variant="unstyled" isLazy>
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
					Back to locations
				</Button>

				<Box bg="white" border="1px solid" borderColor="slate.200" borderRadius="lg" boxShadow="sm" overflow="hidden">
					<Box
						position="relative"
						h={{ base: '76px', md: '92px' }}
						bgGradient="linear(120deg, pink.500 0%, brand.500 55%, purple.400 100%)"
						overflow="hidden"
					>
						<Box position="absolute" top="-60px" right="-30px" w="220px" h="220px" borderRadius="full" bg="whiteAlpha.200" />
						<Box position="absolute" bottom="-90px" right="180px" w="180px" h="180px" borderRadius="full" bg="whiteAlpha.100" />
						<Box position="absolute" top="-40px" left="35%" w="120px" h="120px" borderRadius="full" bg="whiteAlpha.100" />
					</Box>

					<Box position="relative" px={{ base: 4, md: 6 }} pb={5}>
						<Avatar
							mt={{ base: '-36px', md: '-44px' }}
							boxSize={{ base: '72px', md: '88px' }}
							fontSize={{ base: '2xl', md: '3xl' }}
							name={location.name}
							bg="pink.50"
							color="pink.600"
							border="4px solid white"
							boxShadow="md"
						/>
						<HStack mt={3} spacing={3} flexWrap="wrap">
							<Heading fontSize={{ base: '20px', md: '24px' }} lineHeight="1.25" fontWeight="800" color="slate.900" noOfLines={2}>
								{location.name}
							</Heading>
							<StatusBadge status={location.status} />
						</HStack>
						<Text mt={1} fontSize="sm" color="slate.500" noOfLines={1}>
							{[organization.organizationName, location.workName && location.workName !== location.name ? location.workName : ''].filter(Boolean).join(' · ')}
						</Text>

						<SimpleGrid mt={5} columns={{ base: 1, sm: 2, xl: 4 }} spacing={3}>
							<InfoTile icon={<BuildingIcon boxSize={4} />} color="brand" label="Organization" value={organization.organizationName} />
							<InfoTile icon={<InfoOutlineIcon boxSize={3.5} />} color="blue" label="OP number" value={location.opNumber} />
							<InfoTile icon={<PeopleIcon boxSize={4} />} color="green" label="Designation" value={location.designation} capitalize />
							<InfoTile icon={<MapPinIcon boxSize={4} />} color="orange" label="Address" value={location.address} />
						</SimpleGrid>
					</Box>

					<Box px={{ base: 3, md: 5 }} py={3} bg="slate.50" borderTop="1px solid" borderColor="slate.100">
						<TabList gap={1.5} overflowX="auto" sx={{ scrollbarWidth: 'none' }}>
							{workspaceTabs.map((tab) => (
								<Tab
									key={tab.label}
									h="38px"
									px={4}
									gap={2}
									flexShrink={0}
									borderRadius="full"
									fontSize="sm"
									fontWeight="600"
									color="slate.600"
									whiteSpace="nowrap"
									transition="all 0.15s ease"
									_hover={{ bg: 'white', color: 'slate.900' }}
									_selected={{ bg: 'white', color: 'brand.600', boxShadow: 'sm', border: '1px solid', borderColor: 'slate.200' }}
								>
									{tab.icon}
									{tab.label}
								</Tab>
							))}
						</TabList>
					</Box>
				</Box>

				<TabPanels>
					<TabPanel p={0}>
						{organizationId ? <OrganizationEmployeesPage organizationId={organizationId} organizationName={location.name} location={location} /> : missingId}
					</TabPanel>
					<TabPanel p={0}>
						{organizationId ? <AttendanceRegisterGrid organizationId={organizationId} locationId={location.id} /> : missingId}
					</TabPanel>
					<TabPanel p={0}>
						{organizationId ? <AttendanceHistory organizationId={organizationId} locationId={location.id} /> : missingId}
					</TabPanel>
					<TabPanel p={0}>
						{organizationId ? <LocationPayrollPage organizationId={organizationId} locationId={location.id} /> : missingId}
					</TabPanel>
				</TabPanels>
			</Stack>
		</Tabs>
	);
}

function InfoTile({ icon, color, label, value, capitalize = false }: { icon: ReactNode; color: string; label: string; value?: string; capitalize?: boolean }) {
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
				<Text fontSize="11px" fontWeight="700" letterSpacing="0.06em" textTransform="uppercase" color="slate.400">
					{label}
				</Text>
				<Text fontSize="sm" fontWeight="600" color={value ? 'slate.900' : 'slate.400'} noOfLines={1} title={value} textTransform={capitalize ? 'capitalize' : undefined}>
					{value || 'Not added'}
				</Text>
			</Box>
		</HStack>
	);
}

export default LocationWorkspacePage;
