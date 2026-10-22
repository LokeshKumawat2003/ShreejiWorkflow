import { Select, type SelectProps } from '@chakra-ui/react';
import type { SelectOption } from './FormSelect';
import { filterControlStyles } from './fieldStyles';

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
			w="100%"
			value={value}
			onChange={(event) => onChange(event.target.value as T)}
			iconColor="slate.400"
			{...filterControlStyles}
			{...selectProps}
		>
			{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
		</Select>
	);
}

export default FilterSelect;
