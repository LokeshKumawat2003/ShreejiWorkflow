import { Box, Heading, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

type FormSectionProps = {
	title: string;
	description?: string;
	children: ReactNode;
};

function FormSection({ title, description, children }: FormSectionProps) {
	return (
		<Box border="1px solid" borderColor="slate.200" borderRadius="lg" bg="white" overflow="hidden">
			<Box px={{ base: 4, md: 5 }} py={3} bg="slate.50" borderBottom="1px solid" borderColor="slate.100">
				<Heading as="h3" fontSize="sm" fontWeight="700" color="slate.900">{title}</Heading>
				{description ? <Text mt={0.5} fontSize="xs" color="slate.500">{description}</Text> : null}
			</Box>
			<Box px={{ base: 4, md: 5 }} py={5}>{children}</Box>
		</Box>
	);
}

export default FormSection;
