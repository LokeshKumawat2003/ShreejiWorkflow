import { Box, HStack, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

type EntityCellProps = {
	name: string;
	subtitle?: ReactNode;
	minW?: string;
};

const palette = ['brand', 'blue', 'teal', 'green', 'orange', 'pink', 'purple', 'cyan'];

function initialsOf(name: string) {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return '?';
	const first = parts[0][0] || '';
	const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
	return `${first}${last}`.toUpperCase();
}

function colorOf(name: string) {
	let hash = 0;
	for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
	return palette[hash % palette.length];
}

function EntityCell({ name, subtitle, minW = '200px' }: EntityCellProps) {
	const color = colorOf(name);

	return (
		<HStack spacing={3} minW={minW}>
			<Box
				display="grid"
				placeItems="center"
				flexShrink={0}
				w="40px"
				h="40px"
				borderRadius="12px"
				bg={`${color}.50`}
				color={`${color}.600`}
				border="1px solid"
				borderColor={`${color}.100`}
				fontSize="13px"
				fontWeight="800"
				letterSpacing="0.02em"
				aria-hidden="true"
			>
				{initialsOf(name)}
			</Box>
			<Box minW={0}>
				<Text fontWeight="700" color="slate.900" noOfLines={1} title={name}>{name}</Text>
				{subtitle ? <Text mt={0.5} fontSize="xs" color="slate.500" noOfLines={1}>{subtitle}</Text> : null}
			</Box>
		</HStack>
	);
}

export default EntityCell;
