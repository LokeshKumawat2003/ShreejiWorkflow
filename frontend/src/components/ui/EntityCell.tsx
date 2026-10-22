import { Avatar, Box, HStack, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

type EntityCellProps = {
	name: string;
	subtitle?: ReactNode;
	minW?: string;
};

function EntityCell({ name, subtitle, minW = '200px' }: EntityCellProps) {
	return (
		<HStack spacing={3} minW={minW}>
			<Avatar name={name} boxSize="40px" fontSize="sm" fontWeight="700" color="white" />
			<Box minW={0}>
				<Text fontWeight="600" color="slate.900" noOfLines={1}>{name}</Text>
				{subtitle ? <Text mt={0.5} fontSize="xs" color="slate.500" noOfLines={1}>{subtitle}</Text> : null}
			</Box>
		</HStack>
	);
}

export default EntityCell;
