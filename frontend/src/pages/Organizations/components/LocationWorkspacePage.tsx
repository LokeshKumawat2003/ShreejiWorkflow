import { ChevronLeftIcon } from '@chakra-ui/icons';
import { Avatar, Box, Button, Heading, HStack, Stack, Tab, TabList, TabPanel, TabPanels, Tabs, Text } from '@chakra-ui/react';
import type { OrganizationLocation, User } from '../../../types';
import AttendanceRegisterGrid from '../../Employees/components/AttendanceRegisterGrid';
import OrganizationAttendanceHistory from './OrganizationAttendanceHistory';
import OrganizationEmployeesPage from './OrganizationEmployeesPage';
import OrganizationPayrollPage from './OrganizationPayrollPage';

type LocationWorkspacePageProps = {
	organization: User;
	location: OrganizationLocation;
	onBack: () => void;
};

function LocationWorkspacePage({ organization, location, onBack }: LocationWorkspacePageProps) {
	const organizationId = organization.id || organization._id;

	return (
		<Stack spacing={6}>
			<Button alignSelf="flex-start" h="36px" px={2} variant="ghost" fontSize="sm" color="slate.600" leftIcon={<ChevronLeftIcon />} onClick={onBack}>
				Back to locations
			</Button>
			<HStack spacing={4} minW={0}>
				<Avatar size="lg" name={location.name} />
				<Box minW={0}>
					<Heading fontSize="26px" lineHeight="1.2" fontWeight="700" color="slate.900" noOfLines={2}>{location.name}</Heading>
					  <Text mt={1} fontSize="14px" color="slate.500">{organization.organizationName} | {location.address || 'Address not added'}</Text>
				</Box>
			</HStack>

			<Tabs colorScheme="brand" variant="line" isLazy>
				<TabList overflowX="auto" borderBottomColor="slate.200">
					<Tab>Employees</Tab>
					<Tab>Attendance</Tab>
					<Tab>Attendance history</Tab>
					<Tab>Payroll</Tab>
				</TabList>
				<TabPanels>
					<TabPanel px={0} pt={5}>
						{organizationId ? <OrganizationEmployeesPage organizationId={organizationId} organizationName={location.name} location={location} /> : <Text color="red.600">This organization has no valid ID.</Text>}
					</TabPanel>
					<TabPanel px={0} pt={5}>
						{organizationId ? <AttendanceRegisterGrid organizationId={organizationId} locationId={location.id} /> : <Text color="red.600">This organization has no valid ID.</Text>}
					</TabPanel>
					<TabPanel px={0} pt={5}>
						{organizationId ? <OrganizationAttendanceHistory organizationId={organizationId} locationId={location.id} canEdit /> : <Text color="red.600">This organization has no valid ID.</Text>}
					</TabPanel>
					<TabPanel px={0} pt={5}>
						{organizationId ? <OrganizationPayrollPage organizationId={organizationId} locationId={location.id} /> : <Text color="red.600">This organization has no valid ID.</Text>}
					</TabPanel>
				</TabPanels>
			</Tabs>
		</Stack>
	);
}

export default LocationWorkspacePage;
