import { CalendarIcon, TimeIcon } from '@chakra-ui/icons';
import { Stack, Tab, TabList, TabPanel, TabPanels, Tabs, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { BuildingIcon, FileIcon, HeaderBreadcrumb, HeaderCard, HeaderDetail, MapPinIcon, PeopleIcon } from '../../../components/ui';
import type { OrganizationLocation, User } from '../../../types';
import AttendanceRegisterGrid from '../../Attendance/components/AttendanceRegisterGrid';
import AttendanceHistory from '../../Attendance/components/AttendanceHistory';
import OrganizationEmployeesPage from './OrganizationEmployeesPage';
import LocationPayrollPage from '../../Payroll/components/LocationPayrollPage';
import LocationInvoicePage from '../../Invoice/LocationInvoicePage';
type LocationWorkspacePageProps = {
	organization: User;
	location: OrganizationLocation;
	onBack: () => void;
};

const workspaceTabs = [
	{ label: 'Employees', icon: <PeopleIcon boxSize={4} /> },
	{ label: 'Attendance', icon: <CalendarIcon boxSize={3.5} /> },
	{ label: 'Attendance history', icon: <TimeIcon boxSize={3.5} /> },
	{ label: 'Payroll', icon: <Text as="span" fontSize="sm" fontWeight="700" lineHeight="1">₹</Text> },
	{ label: 'Invoice', icon: <FileIcon boxSize={4} /> },
];

function LocationWorkspacePage({ organization, location, onBack }: LocationWorkspacePageProps) {
	const organizationId = organization.id || organization._id;
	const missingId = <Text color="red.600">This organization has no valid ID.</Text>;
	const [isViewingEmployee, setIsViewingEmployee] = useState(false);
	const workName = location.workName && location.workName !== location.name ? location.workName : '';

	return (
		<Tabs variant="unstyled" isLazy>
			<Stack spacing={5}>
				<HeaderBreadcrumb display={isViewingEmployee ? 'none' : 'inline-flex'} parent="Locations" current={location.name} onBack={onBack} />

				<HeaderCard
					display={isViewingEmployee ? 'none' : 'block'}
					name={location.name}
					status={location.status}
					subtitle={`${organization.organizationName || ''}${workName ? `  •  ${workName}` : ''}`}
					details={(
						<>
							<HeaderDetail icon={<BuildingIcon boxSize={3.5} />} label="Organization" value={organization.organizationName} />
							<HeaderDetail icon={<Text as="span" fontSize="xs" fontWeight="700" lineHeight="1">#</Text>} label="PO number" value={location.opNumber} />
							<HeaderDetail icon={<PeopleIcon boxSize={3.5} />} label="Designation" value={location.designation} capitalize />
							<HeaderDetail icon={<MapPinIcon boxSize={3.5} />} label="Address" value={location.address} />
						</>
					)}
					footer={(
						<TabList
							px={{ base: 2, md: 4 }}
							gap={{ base: 0, md: 2 }}
							borderTop="1px solid"
							borderColor="slate.100"
							overflowX="auto"
							sx={{ scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
						>
							{workspaceTabs.map((tab) => (
								<Tab
									key={tab.label}
									position="relative"
									h="48px"
									px={3}
									gap={2}
									flexShrink={0}
									fontSize="sm"
									fontWeight="500"
									color="slate.500"
									whiteSpace="nowrap"
									transition="color 0.15s"
									_hover={{ color: 'slate.900' }}
									_after={{
										content: '""',
										position: 'absolute',
										left: 3,
										right: 3,
										bottom: 0,
										h: '2px',
										borderRadius: '2px 2px 0 0',
										bg: 'transparent',
										transition: 'background 0.15s',
									}}
									_selected={{
										color: 'slate.900',
										fontWeight: '600',
										'& > svg, & > span': { color: 'brand.600' },
										_after: { bg: 'brand.500' },
									}}
								>
									{tab.icon}
									{tab.label}
								</Tab>
							))}
						</TabList>
					)}
				/>

				<TabPanels>
					<TabPanel p={0}>
						{organizationId ? <OrganizationEmployeesPage organizationId={organizationId} organizationName={location.name} location={location} onViewingChange={setIsViewingEmployee} /> : missingId}
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
					<TabPanel p={0}>
						{organizationId ? <LocationInvoicePage organizationId={organizationId} locationId={location.id} /> : missingId}
					</TabPanel>
				</TabPanels>
			</Stack>
		</Tabs>
	);
}

export default LocationWorkspacePage;
