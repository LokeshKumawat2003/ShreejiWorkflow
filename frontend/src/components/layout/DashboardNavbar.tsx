
import {
  ChevronDownIcon,
  HamburgerIcon,
} from '@chakra-ui/icons';

import {
  Avatar,
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Text,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { clearAccessToken } from '../../services/api';
import type { UserRole } from '../../types';

type DashboardNavbarProps = {
  onOpenSidebar: () => void;
  title: string;
  userName: string;
  role: UserRole;
};

function DashboardNavbar({ onOpenSidebar, title, userName, role }: DashboardNavbarProps) {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAccessToken();
    navigate('/login', { replace: true });
  };
  return (
    <Flex
      as="header"
      h="64px"
      minH="64px"
      flexShrink={0}
      w="100%"
      position="sticky"
      top={0}
      zIndex="sticky"
      align="center"
      justify="space-between"
      px={{ base: 3, md: 6 }}
      gap={3}
      bg="white"
      borderBottom="1px solid"
      borderColor="#E2E8F0"
    >
      {/* Left section */}
      <HStack spacing={3} minW={0}>
        <IconButton
          display={{ base: 'inline-flex', lg: 'none' }}
          aria-label="Open navigation"
          icon={<HamburgerIcon />}
          variant="ghost"
          size="sm"
          color="#475569"
          borderRadius="lg"
          onClick={onOpenSidebar}
          _hover={{ bg: '#F1F5F9' }}
        />

        <Text
          fontSize={{ base: 'md', md: 'lg' }}
          fontWeight="700"
          color="#0F172A"
          whiteSpace="nowrap"
        >
          {title}
        </Text>
      </HStack>

      {/* Right section */}
      <HStack spacing={{ base: 2, md: 4 }}>


        <Box
          h="30px"
          w="1px"
          bg="#E2E8F0"
          display={{ base: 'none', sm: 'block' }}
        />

        <Popover placement="bottom-end" isLazy>
          <PopoverTrigger>
            <Button
              variant="ghost"
              h="44px"
              px={{ base: 1, sm: 2 }}
              borderRadius="lg"
              aria-label="Open profile details"
              _hover={{ bg: '#F8FAFC' }}
            >
              <HStack spacing={2}>
                <Avatar
                  size="xs"
                  name={userName}
                  bg="#EEF2FF"
                  color="#4F46E5"
                  fontWeight="600"
                />

                <Box display={{ base: 'none', sm: 'block' }} lineHeight="1.3" textAlign="left">
                  <Text fontSize="xs" fontWeight="600" color="#0F172A" whiteSpace="nowrap">
                    {userName}
                  </Text>
                  <Text fontSize="10px" color="#64748B">
                    {role === 'admin' ? 'Administrator' : 'Organization'}
                  </Text>
                </Box>

                <ChevronDownIcon
                  display={{ base: 'none', sm: 'block' }}
                  color="#64748B"
                  boxSize={3}
                />
              </HStack>
            </Button>
          </PopoverTrigger>

          <PopoverContent
            w="260px"
            borderColor="#E2E8F0"
            borderRadius="12px"
            boxShadow="0 12px 32px rgba(15, 23, 42, 0.12)"
            _focus={{ outline: 'none' }}
          >
            <PopoverArrow borderColor="#E2E8F0" />
            <PopoverBody p={4}>
              <HStack spacing={3}>
                <Avatar
                  size="sm"
                  name={userName}
                  bg="#EEF2FF"
                  color="#4F46E5"
                  fontWeight="600"
                />
                <Box minW={0}>
                  <Text fontSize="sm" fontWeight="700" color="#0F172A" noOfLines={1}>
                    {userName}
                  </Text>
                  <Text mt={0.5} fontSize="xs" color="#64748B">
                    {role === 'admin' ? 'Administrator' : 'Organization'}
                  </Text>
                </Box>
              </HStack>

              <Button
                mt={4}
                size="sm"
                w="100%"
                colorScheme="red"
                variant="outline"
                onClick={handleLogout}
              >
                Logout
              </Button>
            </PopoverBody>
          </PopoverContent>
        </Popover>
      </HStack>
    </Flex>
  );
}

export default DashboardNavbar;

