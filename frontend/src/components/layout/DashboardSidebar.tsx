import { CalendarIcon, SettingsIcon } from '@chakra-ui/icons';
import {
  Avatar,
  AvatarBadge,
  Box,
  createIcon,
  Flex,
  HStack,
  Icon,
  IconButton,
  Text,
  Tooltip,
  VStack,
} from '@chakra-ui/react';
import type { UserRole } from '../../types';
import { BuildingIcon, PeopleIcon, WalletIcon } from '../ui';

type NavigationItem = {
  label: string;
  icon: typeof SettingsIcon;
  roles?: UserRole[];
  section: 'Workspace' | 'Administration';
};

type DashboardSidebarProps = {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onNavigate?: () => void;
  userName: string;
  role: UserRole;
};

const DashboardIcon = createIcon({
  displayName: 'DashboardIcon',
  viewBox: '0 0 24 24',
  path: <path fill="currentColor" d="M4 4h7v7H4V4Zm9 0h7v4h-7V4ZM4 13h7v7H4v-7Zm9-3h7v10h-7V10Z" />,
});

const navigation: NavigationItem[] = [
  { label: 'Dashboard', icon: DashboardIcon, section: 'Workspace' },
  { label: 'Organizations', icon: BuildingIcon, roles: ['admin'], section: 'Workspace' },
  { label: 'Employees', icon: PeopleIcon, section: 'Workspace' },
  { label: 'Attendance', icon: CalendarIcon, roles: ['organization'], section: 'Workspace' },
  { label: 'Payroll', icon: WalletIcon, roles: ['admin'], section: 'Administration' },
  { label: 'Settings', icon: SettingsIcon, roles: ['admin'], section: 'Administration' },
];

const sections: NavigationItem['section'][] = ['Workspace', 'Administration'];

function DashboardSidebar({ activeTab, onSelectTab, onNavigate, userName, role }: DashboardSidebarProps) {
  const items = navigation.filter(({ roles }) => !roles || roles.includes(role));

  function selectTab(tab: string) {
    onSelectTab(tab);
    onNavigate?.();
  }

  return (
    <Flex
      as="aside"
      direction="column"
      w="248px"
      minW="248px"
      h="100%"
      bg="white"
      borderRight="1px solid"
      borderColor="slate.200"
      overflowY="auto"
    >
      <HStack h="72px" px={5} spacing={3} flexShrink={0}>
        <Flex
          w="40px"
          h="40px"
          align="center"
          justify="center"
          borderRadius="12px"
          bgGradient="linear(135deg, brand.500, purple.500)"
          color="white"
          boxShadow="0 6px 16px rgba(79, 70, 229, 0.35)"
        >
          <Icon viewBox="0 0 24 24" boxSize={5}>
            <path fill="currentColor" d="M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 20a8 8 0 0 1 16 0H4Zm-2-1a6 6 0 0 1 4-5.66A9.9 9.9 0 0 0 3 20H2v-1Zm20 1h-1a9.9 9.9 0 0 0-3-6.66A6 6 0 0 1 22 20Z" />
          </Icon>
        </Flex>
        <Box minW={0}>
          <Text fontSize="md" fontWeight="800" color="slate.900" lineHeight="1.2" letterSpacing="-0.01em">Shreeji workflow</Text>
          <Text fontSize="xs" color="slate.500">People management</Text>
        </Box>
      </HStack>

      <Box mx={5} h="1px" bg="slate.100" />

      <Box flex="1" px={3} py={4}>
        {sections.map((section) => {
          const sectionItems = items.filter((item) => item.section === section);
          if (sectionItems.length === 0) return null;

          return (
            <Box key={section} mb={5}>
              <Text px={3} mb={2} fontSize="11px" fontWeight="700" color="slate.400" letterSpacing="0.08em" textTransform="uppercase">
                {section}
              </Text>
              <VStack align="stretch" spacing={1}>
                {sectionItems.map(({ label, icon: ItemIcon }) => {
                  const isActive = activeTab === label;

                  return (
                    <HStack
                      key={label}
                      as="button"
                      type="button"
                      role="group"
                      position="relative"
                      w="100%"
                      h="44px"
                      px={2}
                      spacing={3}
                      borderRadius="12px"
                      bg={isActive ? 'brand.50' : 'transparent'}
                      color={isActive ? 'brand.700' : 'slate.600'}
                      textAlign="left"
                      transition="all 0.15s ease"
                      _hover={{ bg: isActive ? 'brand.50' : 'slate.50', color: isActive ? 'brand.700' : 'slate.900' }}
                      _focusVisible={{ outline: 'none', boxShadow: '0 0 0 3px rgba(79,70,229,0.25)' }}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => selectTab(label)}
                    >
                      {isActive && (
                        <Box position="absolute" left="-12px" top="10px" bottom="10px" w="4px" borderRightRadius="full" bg="brand.500" />
                      )}
                      <Flex
                        w="30px"
                        h="30px"
                        flexShrink={0}
                        align="center"
                        justify="center"
                        borderRadius="9px"
                        bg={isActive ? 'brand.500' : 'slate.100'}
                        color={isActive ? 'white' : 'slate.500'}
                        boxShadow={isActive ? '0 4px 10px rgba(79, 70, 229, 0.3)' : 'none'}
                        transition="all 0.15s ease"
                        _groupHover={isActive ? undefined : { bg: 'white', color: 'brand.600', boxShadow: 'sm' }}
                      >
                        <ItemIcon boxSize={4} />
                      </Flex>
                      <Text flex="1" fontSize="sm" fontWeight={isActive ? '700' : '500'}>{label}</Text>
                    </HStack>
                  );
                })}
              </VStack>
            </Box>
          );
        })}
      </Box>

      <Box px={3} pb={4} flexShrink={0}>
        <HStack p={2.5} spacing={3} bg="slate.50" border="1px solid" borderColor="slate.100" borderRadius="14px">
          <Avatar size="sm" name={userName} bg="brand.100" color="brand.700" fontWeight="700">
            <AvatarBadge boxSize="0.9em" bg="green.400" borderColor="slate.50" />
          </Avatar>
          <Box flex="1" minW={0}>
            <Text fontSize="sm" fontWeight="700" color="slate.900" noOfLines={1} title={userName}>{userName}</Text>
            <Text fontSize="xs" color="slate.500">{role === 'admin' ? 'Administrator' : 'Organization'}</Text>
          </Box>
          {role === 'admin' && (
            <Tooltip label="Settings" hasArrow>
              <IconButton
                aria-label="Open settings"
                icon={<SettingsIcon boxSize={3.5} />}
                size="sm"
                variant="ghost"
                borderRadius="full"
                color="slate.400"
                _hover={{ bg: 'white', color: 'brand.600', boxShadow: 'sm' }}
                onClick={() => selectTab('Settings')}
              />
            </Tooltip>
          )}
        </HStack>
        <Text mt={3} textAlign="center" fontSize="11px" color="slate.400">Shreeji workflow · v1.0.0</Text>
      </Box>
    </Flex>
  );
}

export default DashboardSidebar;
