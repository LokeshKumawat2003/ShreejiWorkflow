import { Flex, type FlexProps } from '@chakra-ui/react';

function Toolbar({ children, ...flexProps }: FlexProps) {
	return (
		<Flex
			direction={{ base: 'column', md: 'row' }}
			align={{ base: 'stretch', md: 'center' }}
			gap={3}
			flexWrap="wrap"
			px={{ base: 4, md: 5 }}
			py={3}
			bg="slate.50"
			borderBottom="1px solid"
			borderColor="slate.100"
			{...flexProps}
		>
			{children}
		</Flex>
	);
}

export default Toolbar;
