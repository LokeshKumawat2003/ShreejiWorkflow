import { HStack, IconButton } from '@chakra-ui/react';
import { GridIcon, ListIcon } from './icons';

export type TableView = 'list' | 'grid';

type ViewToggleProps = {
	value: TableView;
	onChange: (value: TableView) => void;
};

const OPTIONS = [
	{ value: 'list', label: 'List view', icon: <ListIcon boxSize={4} /> },
	{ value: 'grid', label: 'Grid view', icon: <GridIcon boxSize={3.5} /> },
] as const;

function ViewToggle({ value, onChange }: ViewToggleProps) {
	return (
		<HStack spacing={0.5} p={0.5} bg="white" border="1px solid" borderColor="slate.200" borderRadius="10px">
			{OPTIONS.map((option) => {
				const isSelected = value === option.value;
				return (
					<IconButton
						key={option.value}
						aria-label={option.label}
						title={option.label}
						aria-pressed={isSelected}
						icon={option.icon}
						size="sm"
						h="30px"
						minW="34px"
						borderRadius="8px"
						variant="ghost"
						bg={isSelected ? 'brand.50' : 'transparent'}
						color={isSelected ? 'brand.600' : 'slate.500'}
						_hover={{ bg: isSelected ? 'brand.50' : 'slate.50', color: isSelected ? 'brand.600' : 'slate.700' }}
						onClick={() => onChange(option.value)}
					/>
				);
			})}
		</HStack>
	);
}

export default ViewToggle;
