import { FormControl, FormErrorMessage, FormHelperText, FormLabel, Input } from '@chakra-ui/react';
import type { InputProps } from '@chakra-ui/react';
import { useId, type ReactNode } from 'react';
import { fieldLabelStyles, fieldStyles } from './fieldStyles';

type FormInputProps = InputProps & {
	label: string;
	isRequired?: boolean;
	helperText?: ReactNode;
	error?: string;
};

function FormInput({ label, isRequired = false, helperText, error, ...inputProps }: FormInputProps) {
	const inputId = useId();

	return (
		<FormControl isRequired={isRequired} isInvalid={Boolean(error)}>
			<FormLabel htmlFor={inputId} {...fieldLabelStyles}>{label}</FormLabel>
			<Input id={inputId} h="44px" {...fieldStyles} {...inputProps} />
			{error ? <FormErrorMessage fontSize="xs">{error}</FormErrorMessage> : helperText ? <FormHelperText fontSize="xs">{helperText}</FormHelperText> : null}
		</FormControl>
	);
}

export default FormInput;
