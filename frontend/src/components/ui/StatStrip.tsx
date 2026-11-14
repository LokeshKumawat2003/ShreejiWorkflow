import { SimpleGrid } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import StatCard from './StatCard';

export type StatStripItem = {
	label: string;
	value: number | string | null | undefined;
	helper?: string;
	helperIcon?: ReactNode;
	color?: string;
	icon?: ReactNode;
	art?: ReactNode;
	share?: number | null;
	onClick?: () => void;
};

type StatStripProps = {
	items: StatStripItem[];
};

function StatStrip({ items }: StatStripProps) {
	return (
		<SimpleGrid columns={{ base: 1, sm: 2, lg: items.length }} spacing={4}>
			{items.map((item) => (
				<StatCard
					key={item.label}
					label={item.label}
					value={item.value}
					color={item.color || 'slate.500'}
					icon={item.icon}
					helper={item.helper}
					helperIcon={item.helperIcon}
					share={item.share}
					art={item.art}
					isLoading={item.value === null || item.value === undefined}
					onClick={item.onClick}
				/>
			))}
		</SimpleGrid>
	);
}

export default StatStrip;
