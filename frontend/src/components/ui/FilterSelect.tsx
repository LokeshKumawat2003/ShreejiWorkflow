import { Select, type SelectProps } from '@chakra-ui/react';
import type { SelectOption } from './FormSelect';
import { fieldStyles } from './fieldStyles';

type FilterSelectProps<T extends string> = Omit<SelectProps, 'onChange' | 'value'> & {
	label: string;
	value: T;
	options: SelectOption[];
	onChange: (value: T) => void;
};

function FilterSelect<T extends string>({ label, value, options, onChange, ...selectProps }: FilterSelectProps<T>) {
	return (
		<Select
			aria-label={label}
			w={{ base: '100%', md: 'auto' }}
			minW="160px"
			value={value}
			onChange={(event) => onChange(event.target.value as T)}
			{...fieldStyles}
			{...selectProps}
		>
			{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
		</Select>
	);
}

export default FilterSelect;
