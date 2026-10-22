import { Box, Flex, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

type EmptyStateProps = {
	title: string;
	description?: string;
	icon?: ReactNode;
	action?: ReactNode;
	py?: number;
};

function EmptyState({ title, description, icon, action, py = 12 }: EmptyStateProps) {
	return (
		<Flex direction="column" align="center" justify="center" textAlign="center" py={py} px={4} gap={2}>
			{icon ? (
				<Flex w="44px" h="44px" borderRadius="xl" bg="slate.100" color="slate.400" align="center" justify="center" mb={1}>
					{icon}
				</Flex>
			) : null}
			<Text fontWeight="600" color="slate.900">{title}</Text>
			{description ? <Text fontSize="sm" color="slate.500" maxW="360px">{description}</Text> : null}
			{action ? <Box mt={2}>{action}</Box> : null}
		</Flex>
	);
}

export default EmptyState;
