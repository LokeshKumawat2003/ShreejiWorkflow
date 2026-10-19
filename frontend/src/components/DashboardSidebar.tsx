import {
  AddIcon,
  AtSignIcon,
  CheckCircleIcon,
  SettingsIcon,
  TimeIcon,
} from '@chakra-ui/icons';
import {
  Avatar,
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  Text,
  VStack,
} from '@chakra-ui/react';
import type { UserRole } from '../types';

type NavigationItem = {
  label: string;
  icon: typeof AddIcon;
  roles?: UserRole[];
};

type DashboardSidebarProps = {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onNavigate?: () => void;
  userName: string;
  role: UserRole;
};

const navigation: NavigationItem[] = [
  { label: 'Organizations', icon: AddIcon },
  { label: 'Employees', icon: AtSignIcon },
  { label: 'Attendance', icon: CheckCircleIcon, roles: ['organization'] },
  { label: 'Payroll', icon: TimeIcon, roles: ['admin'] },
];

function DashboardSidebar({ activeTab, onSelectTab, onNavigate, userName, role }: DashboardSidebarProps) {
  function selectTab(tab: string) {
    onSelectTab(tab);
    onNavigate?.();
  }

  return (
    <Flex
      as="aside"
      direction="column"
      w="238px"
      minW="238px"
      h="100%"
      bg="white"
      borderRight="1px solid"
      borderColor="gray.200"
      overflowY="auto"
    >
      <HStack h="64px" px={4} spacing={3} borderBottom="1px solid" borderColor="gray.100" flexShrink={0}>
        <Flex w="42px" h="42px" align="center" justify="center" borderRadius="xl" bg="#4F46E5" color="white">
          <Icon viewBox="0 0 24 24" boxSize={6}>
            <path fill="currentColor" d="M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 20a8 8 0 0 1 16 0H4Zm-2-1a6 6 0 0 1 4-5.66A9.9 9.9 0 0 0 3 20H2v-1Zm20 1h-1a9.9 9.9 0 0 0-3-6.66A6 6 0 0 1 22 20Z" />
          </Icon>
        </Flex>
        <Box>
          <Text fontSize="lg" fontWeight="800" color="#0F172A">Shreeji workflow</Text>
          <Text fontSize="xs" color="gray.500">People management</Text>
        </Box>
      </HStack>

      <Box flex="1" px={3} py={5}>
        <Text px={3} mb={3} fontSize="xs" fontWeight="700" color="gray.400" letterSpacing="1.2px">WORKSPACE</Text>
        <VStack align="stretch" spacing={1}>
          {navigation.filter(({ roles }) => !roles || roles.includes(role)).map(({ label, icon: ItemIcon }) => {
              const isActive = activeTab === label;

              return (
                <Box key={label}>
                  <Button
                    variant="ghost"
                    w="100%"
                    minH="42px"
                    h="42px"
                    justifyContent="flex-start"
                    px={3}
                    borderRadius="lg"
                    bg={isActive ? '#EEF0FF' : 'transparent'}
                    color={isActive ? '#4F46E5' : '#64748B'}
                    fontSize="sm"
                    fontWeight={isActive ? '600' : '500'}
                    leftIcon={<ItemIcon boxSize={4} />}
                    _hover={{ bg: '#F1F5F9', color: '#4F46E5' }}
                    onClick={() => selectTab(label)}
                  >
                    <Flex flex="1" align="center" justify="space-between">
                      <Text>{label}</Text>
                    </Flex>
                  </Button>
                </Box>
              );
            })}
        </VStack>
      </Box>

      <Box px={3} pb={4}>
        <HStack mt={4} px={1} spacing={3}>
          <Avatar size="sm" name={userName} bg="#E0E7FF" color="#4338CA" />
          <Box flex="1" minW={0}>
            <Text fontSize="sm" fontWeight="600" color="#0F172A" noOfLines={1}>{userName}</Text>
            <Text fontSize="xs" color="gray.500">{role === 'admin' ? 'Administrator' : 'Organization'}</Text>
          </Box>
          <SettingsIcon color="gray.400" boxSize={4} />
        </HStack>
        <Text mt={4} textAlign="center" fontSize="xs" color="gray.400">Shreeji workflow · v1.0.0</Text>
      </Box>
    </Flex>
  );
}

export default DashboardSidebar;