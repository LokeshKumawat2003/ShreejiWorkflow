import { CloseIcon } from '@chakra-ui/icons';
import { Box, Button, Flex, Text, type BoxProps } from '@chakra-ui/react';
import type { ReactNode } from 'react';

type FilterFieldProps = Omit<BoxProps, 'children'> & {
	label: string;
	children: ReactNode;
};

export function FilterField({ label, children, ...boxProps }: FilterFieldProps) {
	return (
		<Box flex={{ base: '1 1 100%', md: '0 0 180px' }} minW={0} {...boxProps}>
			<Text mb={1.5} fontSize="11px" fontWeight="700" color="slate.500" letterSpacing="0.06em" textTransform="uppercase">
				{label}
			</Text>
			{children}
		</Box>
	);
}

type FilterBarProps = Omit<BoxProps, 'children'> & {
	children: ReactNode;
	variant?: 'card' | 'inset';
	canClear?: boolean;
	onClear?: () => void;
	actions?: ReactNode;
};

function FilterBar({ children, variant = 'card', canClear = false, onClear, actions, ...boxProps }: FilterBarProps) {
	const container: BoxProps = variant === 'card'
		? { bg: 'white', border: '1px solid', borderColor: 'slate.200', borderRadius: 'lg', boxShadow: 'sm' }
		: { bg: 'slate.50', borderBottom: '1px solid', borderColor: 'slate.100' };

	return (
		<Box px={{ base: 4, md: 5 }} py={4} {...container} {...boxProps}>
			<Flex gap={3} align="flex-end" flexWrap="wrap">
				{children}
				{onClear || actions ? (
					<Flex gap={2} align="center" ml={{ base: 0, md: 'auto' }} minH="40px">
						{onClear ? (
							<Button
								size="sm"
								h="40px"
								variant="ghost"
								color="slate.500"
								leftIcon={<CloseIcon boxSize={2} />}
								isDisabled={!canClear}
								_hover={{ bg: 'slate.100', color: 'slate.900' }}
								onClick={onClear}
							>
								Clear filters
							</Button>
						) : null}
						{actions}
					</Flex>
				) : null}
			</Flex>
		</Box>
	);
}

export default FilterBar;
