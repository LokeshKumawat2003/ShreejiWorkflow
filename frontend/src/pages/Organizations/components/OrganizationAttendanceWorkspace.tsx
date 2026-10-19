import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@chakra-ui/react';
import AttendancePage from '../../Employees/components/AttendancePage';
import OrganizationAttendanceHistory from './OrganizationAttendanceHistory';
import OrganizationPayrollPage from './OrganizationPayrollPage';

function OrganizationAttendanceWorkspace() {
  return (
    <Tabs colorScheme="brand" variant="line" isLazy>
      <TabList borderBottomColor="slate.200">
        <Tab>Daily attendance</Tab>
        <Tab>History</Tab>
        <Tab>Payroll</Tab>
      </TabList>
      <TabPanels>
        <TabPanel px={0} pt={5}>
          <AttendancePage role="organization" />
        </TabPanel>
        <TabPanel px={0} pt={5}>
          <OrganizationAttendanceHistory />
        </TabPanel>
        <TabPanel px={0} pt={5}>
          <OrganizationPayrollPage />
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
}

export default OrganizationAttendanceWorkspace;