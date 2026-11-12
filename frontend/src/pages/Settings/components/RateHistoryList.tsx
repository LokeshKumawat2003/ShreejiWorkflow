import { Box, Stack, Text } from '@chakra-ui/react';
import type { RatePeriod } from '../../../services/settingsService';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabel(month: string) {
	const [year, number] = month.split('-').map(Number);
	return year && number ? `${MONTHS[number - 1]} ${year}` : month;
}

function previousMonth(month: string) {
	const [year, number] = month.split('-').map(Number);
	if (!year || !number) return month;
	return number === 1 ? `${year - 1}-12` : `${year}-${String(number - 1).padStart(2, '0')}`;
}

type RateHistoryListProps = {
	history: RatePeriod[];
	describe: (values: Record<string, string>) => string;
};

function RateHistoryList({ history, describe }: RateHistoryListProps) {
	if (!history.length) return null;
	return (
		<Box>
			<Text fontSize="sm" fontWeight="600" color="slate.800" mb={1}>Earlier rates (used for older months)</Text>
			<Stack spacing={1}>
				{[...history].reverse().map((period) => (
					<Text key={`${period.fromMonth}-${period.toMonth}-${period.changedAt}`} fontSize="xs" color="slate.600" px={2} py={1.5} bg="slate.50" borderRadius="md">
						<Text as="span" fontWeight="600">{period.fromMonth ? monthLabel(period.fromMonth) : 'Start'} to {monthLabel(previousMonth(period.toMonth))}</Text>
						{' · '}{describe(period.values)}
					</Text>
				))}
			</Stack>
		</Box>
	);
}

export default RateHistoryList;
