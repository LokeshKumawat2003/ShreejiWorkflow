import { Box, Flex, HStack, Text, type BoxProps } from '@chakra-ui/react';
import type { ReactNode } from 'react';

type ContentCardProps = Omit<BoxProps, 'title'> & {
	title?: ReactNode;
	subtitle?: ReactNode;
	icon?: ReactNode;
	actions?: ReactNode;
	toolbar?: ReactNode;
	footer?: ReactNode;
	noPadding?: boolean;
	children?: ReactNode;
};

function ContentCard({ title, subtitle, icon, actions, toolbar, footer, noPadding = false, children, ...boxProps }: ContentCardProps) {
	const hasHeader = Boolean(title || subtitle || icon || actions);

	return (
		<Box bg="white" border="1px solid" borderColor="slate.200" borderRadius="lg" boxShadow="sm" overflow="hidden" minW={0} {...boxProps}>
			{hasHeader ? (
				<Flex
					direction={{ base: 'column', md: 'row' }}
					justify="space-between"
					align={{ base: 'stretch', md: 'center' }}
					gap={3}
					px={{ base: 4, md: 5 }}
					py={4}
					borderBottom="1px solid"
					borderColor="slate.100"
				>
					<HStack spacing={3} minW={0}>
						{icon ? (
							<Flex w="40px" h="40px" flexShrink={0} borderRadius="md" bg="brand.50" color="brand.500" align="center" justify="center">
								{icon}
							</Flex>
						) : null}
						<Box minW={0}>
							{title ? <Text fontWeight="700" color="slate.900" noOfLines={1}>{title}</Text> : null}
							{subtitle ? <Text fontSize="xs" color="slate.500">{subtitle}</Text> : null}
						</Box>
					</HStack>
					{actions ? <HStack spacing={2} flexWrap="wrap">{actions}</HStack> : null}
				</Flex>
			) : null}
			{toolbar}
			<Box p={noPadding ? 0 : { base: 4, md: 5 }}>{children}</Box>
			{footer ? (
				<Box px={{ base: 4, md: 5 }} py={3} borderTop="1px solid" borderColor="slate.100">
					{footer}
				</Box>
			) : null}
		</Box>
	);
}

export default ContentCard;
