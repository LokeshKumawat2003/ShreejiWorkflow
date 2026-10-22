import { Box, HStack, Text } from '@chakra-ui/react';

type Tone = 'success' | 'danger' | 'warning' | 'neutral' | 'info';

const toneStyles: Record<Tone, { color: string; bg: string; border: string; dot: string }> = {
	success: { color: 'green.700', bg: 'green.50', border: 'green.200', dot: 'green.500' },
	danger: { color: 'red.700', bg: 'red.50', border: 'red.200', dot: 'red.500' },
	warning: { color: 'orange.700', bg: 'orange.50', border: 'orange.200', dot: 'orange.400' },
	info: { color: 'brand.700', bg: 'brand.50', border: 'brand.100', dot: 'brand.500' },
	neutral: { color: 'slate.500', bg: 'slate.100', border: 'slate.200', dot: 'slate.400' },
};

const statusTones: Record<string, { tone: Tone; label: string }> = {
	active: { tone: 'success', label: 'Active' },
	disabled: { tone: 'neutral', label: 'Inactive' },
	present: { tone: 'success', label: 'Present' },
	absent: { tone: 'danger', label: 'Absent' },
	unmarked: { tone: 'warning', label: 'Not marked' },
};

type StatusBadgeProps = {
	status?: string | null;
	label?: string;
	tone?: Tone;
};

function StatusBadge({ status, label, tone }: StatusBadgeProps) {
	const preset = statusTones[status || 'unmarked'];
	const style = toneStyles[tone || preset?.tone || 'neutral'];

	return (
		<HStack
			display="inline-flex"
			spacing={1.5}
			px={2.5}
			py={0.5}
			borderRadius="full"
			bg={style.bg}
			border="1px solid"
			borderColor={style.border}
		>
			<Box w="6px" h="6px" borderRadius="full" bg={style.dot} />
			<Text fontSize="xs" fontWeight="600" color={style.color} whiteSpace="nowrap">
				{label || preset?.label || status}
			</Text>
		</HStack>
	);
}

export default StatusBadge;
