import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerOverlay,
  Flex,
  Heading,
  Spinner,
  Stack,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { getDashboardPath } from '../app/authorization';
import DashboardNavbar from '../components/DashboardNavbar';
import DashboardSidebar from '../components/DashboardSidebar';
import OrganizationAttendanceWorkspace from './Organizations/components/OrganizationAttendanceWorkspace';
import OrganizationsPage from './Organizations/OrganizationsPage';
import AdminPayrollPage from './Organizations/AdminPayrollPage';
import api, { clearAccessToken } from '../services/api';
import type { User, UserRole } from '../types';
import EmployeesPage from './Employees/EmployeesPage';

type DashboardPageProps = {
  role: UserRole;
};

function DashboardPage({ role }: DashboardPageProps) {
  const navigate = useNavigate();
  const sidebar = useDisclosure();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(role === 'admin' ? 'Organizations' : 'Dashboard');

  useEffect(() => {
    let isActive = true;

    async function loadDashboard() {
      const endpoint = role === 'admin' ? '/dashboard/admin' : '/dashboard';

      try {
        const { data } = await api.get<{ user: User }>(endpoint);
        if (!isActive) return;

        if (data.user.role !== role) {
          navigate(getDashboardPath(data.user.role), { replace: true });
          return;
        }
        setUser(data.user);
      } catch {
        clearAccessToken();
        navigate('/login', { replace: true });
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadDashboard();
    return () => {
      isActive = false;
    };
  }, [navigate, role]);

  if (isLoading || !user) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg="slate.50">
        <Spinner color="brand.500" size="lg" />
      </Flex>
    );
  }

  return (
    <Flex h="100vh" minH={0} overflow="hidden" bg="slate.50">
      <Box display={{ base: 'none', lg: 'block' }}>
        <DashboardSidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          userName={user.name || user.email}
          role={role}
        />
      </Box>
      <Drawer isOpen={sidebar.isOpen} placement="left" onClose={sidebar.onClose}>
        <DrawerOverlay />
        <DrawerContent maxW="280px">
          <DrawerBody p={0}>
            <DashboardSidebar
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              onNavigate={sidebar.onClose}
              userName={user.name || user.email}
              role={role}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <Flex direction="column" flex="1" minW={0} minH={0}>
        <DashboardNavbar
          title={activeTab}
          userName={user.name || user.email}
          role={role}
          onOpenSidebar={sidebar.onOpen}
        />
        <Box as="main" flex="1" minH={0} overflowY="auto" px={{ base: 2, md: 3 }} py={{ base: 7, md: 8 }}>
          <Stack maxW="1200px" mx="auto" spacing={8}>
            {activeTab === 'Dashboard' && (
              <Box>
                <Text color="brand.600" fontSize="sm" fontWeight="700" textTransform="uppercase">
                  {role === 'admin' ? 'Administrator' : 'Organization'}
                </Text>
                <Heading mt={2} color="slate.900" size="lg">Welcome, {user.name}</Heading>
                <Text mt={2} color="slate.500">{user.organizationName || user.email}</Text>
              </Box>
            )}

            {activeTab === 'Employees' ? (
              <EmployeesPage role={role} />
            ) : activeTab === 'Attendance' ? (
              <OrganizationAttendanceWorkspace />
            ) : role === 'admin' && activeTab === 'Organizations' ? (
              <OrganizationsPage />
            ) : role === 'admin' && activeTab === 'Payroll' ? (
              <AdminPayrollPage />
            ) : activeTab !== 'Dashboard' ? (
              <Box bg="white" border="1px solid" borderColor="slate.200" borderRadius="md" p={{ base: 5, md: 7 }}>
                <Heading size="sm" color="slate.900">{activeTab}</Heading>
                <Text mt={4} color="slate.600">{user.organizationName || user.email}</Text>
              </Box>
            ) : null}
          </Stack>
        </Box>
      </Flex>
    </Flex>
  );
}

export default DashboardPage;