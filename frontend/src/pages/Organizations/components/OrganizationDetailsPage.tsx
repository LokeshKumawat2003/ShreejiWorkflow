import { ChevronLeftIcon, EditIcon } from '@chakra-ui/icons';
import {
  Avatar,
  Alert,
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  SimpleGrid,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
} from '@chakra-ui/react';
import type { User } from '../../../types';
import AttendancePage from '../../Employees/components/AttendancePage';
import OrganizationAttendanceHistory from './OrganizationAttendanceHistory';
import OrganizationEmployeesPage from './OrganizationEmployeesPage';
import OrganizationPayrollPage from './OrganizationPayrollPage';

type OrganizationDetailsPageProps = {
  organization: User;
  isLoading: boolean;
  onBack: () => void;
  onEdit: () => void;
};

function formatCreatedAt(value?: string) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function OrganizationDetailsPage({ organization, isLoading, onBack, onEdit }: OrganizationDetailsPageProps) {
  const isActive = organization.status !== 'disabled';
  const organizationId = organization.id || organization._id;

  return (
    <Stack spacing={6}>
      <Button
        alignSelf="flex-start"
        h="36px"
        px={2}
        variant="ghost"
        fontSize="sm"
        color="slate.600"
        leftIcon={<ChevronLeftIcon />}
        _hover={{ bg: 'slate.100', color: 'slate.900' }}
        onClick={onBack}
      >
        Back to organizations
      </Button>

      <HStack justify="space-between" align="center" flexWrap="wrap" gap={4}>
        <HStack spacing={4} minW={0}>
          <Avatar size="lg" name={organization.organizationName} />
          <Box minW={0}>
            <Heading fontSize="26px" lineHeight="1.2" fontWeight="700" color="slate.900" noOfLines={2}>
              {organization.organizationName || 'Organization'}
            </Heading>
            <Text mt={1} fontSize="14px" color="slate.500">
              Account holder: {organization.name || 'Not available'}
            </Text>
          </Box>
        </HStack>
        <Button h="40px" fontSize="sm" leftIcon={<EditIcon />} colorScheme="brand" onClick={onEdit}>
          Edit organization
        </Button>
      </HStack>

      <Tabs colorScheme="brand" variant="line" isLazy>
        <TabList overflowX="auto" borderBottomColor="slate.200">
          <Tab>Overview</Tab>
          <Tab>Employees</Tab>
          <Tab>Attendance</Tab>
          <Tab>Attendance history</Tab>
          <Tab>Payroll</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0} pt={5}>
            <Box bg="white" border="1px solid" borderColor="slate.200" borderRadius="8px" overflow="hidden">
              <Heading
                as="h2"
                fontSize="16px"
                fontWeight="700"
                color="slate.900"
                px={{ base: 4, md: 6 }}
                py={4}
                borderBottom="1px solid"
                borderColor="slate.100"
              >
                Organization details
              </Heading>
              {isLoading ? (
                <HStack justify="center" py={12}><Spinner color="brand.500" /></HStack>
              ) : (
                <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={10} spacingY={7} p={{ base: 4, md: 6 }}>
                  <Detail label="Organization name" value={organization.organizationName} />
                  <Detail label="Account holder" value={organization.name} />
                  <Detail label="Login email" value={organization.email} />
                  <Detail label="Phone number" value={organization.phone} />
                  <Detail label="Industry" value={organization.industry} />
                  <Detail label="Website" value={organization.website} />
                  <Detail label="Address" value={organization.address} multiline />
                  <Detail label="About the organization" value={organization.about} multiline />
                  <Box>
                    <Text mb={1} fontSize="13px" fontWeight="600" color="slate.500">Account status</Text>
                    <Badge
                      px={3}
                      py={1}
                      borderRadius="full"
                      color={isActive ? 'green.600' : 'slate.500'}
                      bg={isActive ? 'green.50' : 'slate.100'}
                      fontSize="xs"
                      fontWeight="600"
                    >
                      {isActive ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  </Box>
                  <Detail label="Created" value={formatCreatedAt(organization.createdAt)} />
                  <Detail label="Organization ID" value={organizationId} />
                </SimpleGrid>
              )}
            </Box>
          </TabPanel>
          <TabPanel px={0} pt={5}>
            {organizationId ? (
              <OrganizationEmployeesPage
                organizationId={organizationId}
                organizationName={organization.organizationName || 'Organization'}
              />
            ) : (
              <Alert status="error">This organization has no valid ID.</Alert>
            )}
          </TabPanel>
          <TabPanel px={0} pt={5}>
            {organizationId ? (
              <AttendancePage role="admin" organizationId={organizationId} />
            ) : (
              <Alert status="error">This organization has no valid ID.</Alert>
            )}
          </TabPanel>
          <TabPanel px={0} pt={5}>
            {organizationId ? (
              <OrganizationAttendanceHistory organizationId={organizationId} canEdit />
            ) : (
              <Alert status="error">This organization has no valid ID.</Alert>
            )}
          </TabPanel>
          <TabPanel px={0} pt={5}>
            {organizationId ? (
              <OrganizationPayrollPage organizationId={organizationId} />
            ) : (
              <Alert status="error">This organization has no valid ID.</Alert>
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>
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

export default OrganizationDetailsPage;