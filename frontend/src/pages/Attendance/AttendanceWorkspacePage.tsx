import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@chakra-ui/react';
import AttendanceHistory from './components/AttendanceHistory';
import OrganizationRegisterPage from './components/OrganizationRegisterPage';

type AttendanceWorkspacePageProps = {
  organizationId?: string;
};

function AttendanceWorkspacePage({ organizationId }: AttendanceWorkspacePageProps) {
  return (
    <Tabs colorScheme="brand" variant="line" isLazy>
      <TabList borderBottomColor="slate.200">
        {organizationId ? <Tab>Register of Attendance</Tab> : null}
        <Tab>History</Tab>
      </TabList>
      <TabPanels>
        {organizationId ? (
          <TabPanel px={0} pt={5}>
            <OrganizationRegisterPage organizationId={organizationId} />
          </TabPanel>
        ) : null}
        <TabPanel px={0} pt={5}>
          <AttendanceHistory />
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
}

export default AttendanceWorkspacePage;
