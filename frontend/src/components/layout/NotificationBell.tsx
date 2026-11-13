import { BellIcon } from '@chakra-ui/icons';
import {
	Avatar,
	Box,
	Button,
	Flex,
	HStack,
	IconButton,
	Popover,
	PopoverBody,
	PopoverContent,
	PopoverFooter,
	PopoverHeader,
	PopoverTrigger,
	Spinner,
	Stack,
	Text,
	useDisclosure,
} from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import {
	listNotifications,
	markAllNotificationsRead,
	markNotificationRead,
	type AppNotification,
	type NotificationList,
} from '../../services/notificationService';
import type { UserRole } from '../../types';

type NotificationBellProps = {
	role: UserRole;
	onOpenTickets: () => void;
};

const POLL_MS = 30000;

function timeAgo(value: string) {
	const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
	if (seconds < 60) return 'Just now';
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes} min ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
	const days = Math.round(hours / 24);
	if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
	return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date(value));
}

function senderOf(notification: AppNotification, role: UserRole) {
	if (notification.kind === 'ticket_updated' || role !== 'admin') return 'Admin';
	return notification.organizationName || 'Organization';
}

function NotificationBell({ role, onOpenTickets }: NotificationBellProps) {
	const popover = useDisclosure();
	const [data, setData] = useState<NotificationList>({ notifications: [], unreadCount: 0 });
	const [isLoading, setIsLoading] = useState(true);

	const refresh = useCallback((signal?: AbortSignal) => {
		void listNotifications(signal)
			.then(setData)
			.catch(() => undefined)
			.finally(() => {
				if (!signal?.aborted) setIsLoading(false);
			});
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		refresh(controller.signal);
		const timer = window.setInterval(() => {
			if (document.visibilityState === 'visible') refresh();
		}, POLL_MS);
		return () => {
			controller.abort();
			window.clearInterval(timer);
		};
	}, [refresh]);

	useEffect(() => {
		if (popover.isOpen) refresh();
	}, [popover.isOpen, refresh]);

	function open(notification: AppNotification) {
		if (!notification.isRead) void markNotificationRead(notification.id).then(setData).catch(() => undefined);
		popover.onClose();
		onOpenTickets();
	}

	const unread = data.unreadCount;

	return (
		<Popover placement="bottom-end" isOpen={popover.isOpen} onOpen={popover.onOpen} onClose={popover.onClose} isLazy>
			<PopoverTrigger>
				<Box position="relative">
					<IconButton
						aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
						icon={<BellIcon boxSize={5} />}
						variant="ghost"
						size="md"
						borderRadius="full"
						color="#475569"
						_hover={{ bg: '#F1F5F9', color: '#0F172A' }}
					/>
					{unread ? (
						<Flex
							position="absolute"
							top="4px"
							right="2px"
							minW="18px"
							h="18px"
							px={1}
							align="center"
							justify="center"
							borderRadius="full"
							bg="red.500"
							color="white"
							fontSize="10px"
							fontWeight="700"
							border="2px solid white"
							pointerEvents="none"
						>
							{unread > 9 ? '9+' : unread}
						</Flex>
					) : null}
				</Box>
			</PopoverTrigger>

			<PopoverContent w={{ base: 'calc(100vw - 24px)', sm: '380px' }} borderColor="#E2E8F0" borderRadius="12px" boxShadow="0 12px 32px rgba(15, 23, 42, 0.12)" _focus={{ outline: 'none' }}>
				<PopoverHeader px={4} py={3} borderColor="#F1F5F9">
					<HStack justify="space-between">
						<HStack spacing={2}>
							<Text fontSize="sm" fontWeight="700" color="#0F172A">Notifications</Text>
							{unread ? (
								<Box px={2} py={0.5} borderRadius="full" bg="brand.50" color="brand.600" fontSize="11px" fontWeight="700">{unread} new</Box>
							) : null}
						</HStack>
						{unread ? (
							<Button
								variant="link"
								size="xs"
								color="brand.600"
								fontWeight="600"
								onClick={() => void markAllNotificationsRead().then(setData).catch(() => undefined)}
							>
								Mark all as read
							</Button>
						) : null}
					</HStack>
				</PopoverHeader>

				<PopoverBody p={0} maxH="420px" overflowY="auto">
					{isLoading && !data.notifications.length ? (
						<Flex py={10} justify="center"><Spinner size="sm" color="brand.500" /></Flex>
					) : !data.notifications.length ? (
						<Stack py={10} px={6} spacing={2} align="center" textAlign="center">
							<Flex boxSize="44px" align="center" justify="center" borderRadius="full" bg="#F1F5F9" color="#94A3B8">
								<BellIcon boxSize={5} />
							</Flex>
							<Text fontSize="sm" fontWeight="600" color="#0F172A">No notifications yet</Text>
							<Text fontSize="xs" color="#64748B">
								{role === 'admin' ? 'New issue reports from organizations will show up here.' : 'Replies to your issue reports will show up here.'}
							</Text>
						</Stack>
					) : (
						data.notifications.map((notification) => {
							const sender = senderOf(notification, role);
							return (
								<HStack
									key={notification.id}
									as="button"
									type="button"
									w="full"
									align="flex-start"
									spacing={3}
									px={4}
									py={3}
									textAlign="left"
									bg={notification.isRead ? 'white' : '#F8F8FF'}
									borderBottom="1px solid"
									borderColor="#F1F5F9"
									transition="background 0.15s"
									_hover={{ bg: '#F1F5F9' }}
									onClick={() => open(notification)}
								>
									<Avatar size="sm" name={sender} bg="brand.50" color="brand.600" fontWeight="700" flexShrink={0} />
									<Box minW={0} flex="1">
										<HStack justify="space-between" align="baseline" spacing={2}>
											<Text fontSize="sm" fontWeight="700" color="#0F172A" noOfLines={1}>{sender}</Text>
											<Text fontSize="11px" color="#94A3B8" flexShrink={0}>{timeAgo(notification.createdAt)}</Text>
										</HStack>
										<Text mt={0.5} fontSize="xs" color="#475569" noOfLines={1}>
											{notification.kind === 'ticket_created' ? 'Reported an issue' : notification.title}
											{notification.ticketNumber ? ` · ${notification.ticketNumber}` : ''}
										</Text>
										<Text mt={1} fontSize="sm" color="#334155" noOfLines={2}>{notification.message}</Text>
									</Box>
									{notification.isRead ? null : <Box mt={2} boxSize="8px" flexShrink={0} borderRadius="full" bg="brand.500" />}
								</HStack>
							);
						})
					)}
				</PopoverBody>

				<PopoverFooter p={2} borderColor="#F1F5F9">
					<Button
						w="full"
						size="sm"
						variant="ghost"
						color="brand.600"
						fontWeight="600"
						onClick={() => {
							popover.onClose();
							onOpenTickets();
						}}
					>
						View all issue reports
					</Button>
				</PopoverFooter>
			</PopoverContent>
		</Popover>
	);
}

export default NotificationBell;
