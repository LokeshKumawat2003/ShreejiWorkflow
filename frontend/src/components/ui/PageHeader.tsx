import { Box, Flex, Heading, HStack, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

type PageHeaderProps = {
	title: ReactNode;
	description?: ReactNode;
	eyebrow?: ReactNode;
	actions?: ReactNode;
};

function PageHeader({ title, description, eyebrow, actions }: PageHeaderProps) {
	return (
		<Flex direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ base: 'stretch', md: 'flex-end' }} gap={4}>
			<Box minW={0}>
				{eyebrow ? (
					<Text fontSize="xs" fontWeight="700" color="brand.600" textTransform="uppercase" letterSpacing="1.2px" mb={1}>
						{eyebrow}
					</Text>
				) : null}
				<Heading fontSize={{ base: 'xl', md: '2xl' }} fontWeight="700" color="slate.900">{title}</Heading>
				{description ? <Text mt={1} fontSize="sm" color="slate.500">{description}</Text> : null}
			</Box>
			{actions ? <HStack spacing={2} flexWrap="wrap">{actions}</HStack> : null}
		</Flex>
	);
}

export default PageHeader;
