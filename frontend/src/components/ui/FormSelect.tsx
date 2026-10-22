import { FormControl, FormErrorMessage, FormHelperText, FormLabel, Select } from '@chakra-ui/react';
import type { SelectProps } from '@chakra-ui/react';
import { useId, type ReactNode } from 'react';
import { fieldLabelStyles, fieldStyles } from './fieldStyles';

export type SelectOption = { value: string; label: string };

type FormSelectProps = Omit<SelectProps, 'placeholder'> & {
	label: string;
	options?: SelectOption[];
	placeholder?: string;
	isRequired?: boolean;
	helperText?: ReactNode;
	error?: string;
};

function FormSelect({ label, options, placeholder, isRequired = false, helperText, error, children, ...selectProps }: FormSelectProps) {
	const selectId = useId();

	return (
		<FormControl isRequired={isRequired} isInvalid={Boolean(error)}>
			<FormLabel htmlFor={selectId} {...fieldLabelStyles}>{label}</FormLabel>
			<Select id={selectId} h="44px" {...fieldStyles} {...selectProps}>
				{placeholder !== undefined ? <option value="">{placeholder}</option> : null}
				{options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
				{children}
			</Select>
			{error ? <FormErrorMessage fontSize="xs">{error}</FormErrorMessage> : helperText ? <FormHelperText fontSize="xs">{helperText}</FormHelperText> : null}
		</FormControl>
	);
}

export default FormSelect;
