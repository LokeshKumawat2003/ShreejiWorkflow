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
import { getDashboardPath } from '../../app/authorization';
import DashboardNavbar from '../../components/layout/DashboardNavbar';
import DashboardSidebar from '../../components/layout/DashboardSidebar';
import AttendanceWorkspacePage from '../Attendance/AttendanceWorkspacePage';
import BankInvoicePage from '../BankInvoice/BankInvoicePage';
import OrganizationsPage from '../Organizations/OrganizationsPage';
import AdminPayrollPage from '../Payroll/AdminPayrollPage';
import api, { clearAccessToken, isAccessTokenExpired, logoutToLogin } from '../../services/api';
import type { User, UserRole } from '../../types';
import EmployeesPage from '../Employees/EmployeesPage';
import SettingsPage from '../Settings/SettingsPage';
import DashboardHome from './components/DashboardHome';

type DashboardPageProps = {
  role: UserRole;
};

function DashboardPage({ role }: DashboardPageProps) {
  const navigate = useNavigate();
  const sidebar = useDisclosure();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Dashboard');

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

    if (isAccessTokenExpired()) {
      logoutToLogin();
      return;
    }

    void loadDashboard();
    return () => {
      isActive = false;
    };
  }, [navigate, role]);

  useEffect(() => {
    function checkExpiry() {
      if (isAccessTokenExpired()) logoutToLogin();
    }

    const intervalId = window.setInterval(checkExpiry, 60_000);
    window.addEventListener('focus', checkExpiry);
    document.addEventListener('visibilitychange', checkExpiry);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', checkExpiry);
      document.removeEventListener('visibilitychange', checkExpiry);
    };
  }, []);

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
            {activeTab === 'Dashboard' ? (
              <DashboardHome user={user} role={role} onNavigate={setActiveTab} />
            ) : activeTab === 'Employees' ? (
              <EmployeesPage role={role} />
            ) : activeTab === 'Attendance' ? (
              <AttendanceWorkspacePage />
            ) : role === 'admin' && activeTab === 'Organizations' ? (
              <OrganizationsPage />
            ) : role === 'admin' && activeTab === 'Payroll' ? (
              <AdminPayrollPage />
            ) : role === 'admin' && activeTab === 'Bank invoice' ? (
              <BankInvoicePage />
            ) : role === 'admin' && activeTab === 'Settings' ? (
              <SettingsPage />
            ) : (
              <Box bg="white" border="1px solid" borderColor="slate.200" borderRadius="lg" boxShadow="sm" p={{ base: 5, md: 7 }}>
                <Heading size="sm" color="slate.900">{activeTab}</Heading>
                <Text mt={4} color="slate.600">{user.organizationName || user.email}</Text>
              </Box>
            )}
          </Stack>
        </Box>
      </Flex>
    </Flex>
  );
}

export default DashboardPage;