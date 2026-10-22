import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@chakra-ui/react';
import AttendancePage from './components/AttendancePage';
import AttendanceHistory from './components/AttendanceHistory';
import OrganizationPayrollPage from '../Payroll/components/OrganizationPayrollPage';

function AttendanceWorkspacePage() {
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
          <AttendanceHistory />
        </TabPanel>
        <TabPanel px={0} pt={5}>
          <OrganizationPayrollPage />
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
}

export default AttendanceWorkspacePage;