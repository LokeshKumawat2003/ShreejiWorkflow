import { FormControl, FormErrorMessage, FormHelperText, FormLabel, Textarea } from '@chakra-ui/react';
import type { TextareaProps } from '@chakra-ui/react';
import { useId, type ReactNode } from 'react';
import { fieldLabelStyles, fieldStyles } from './fieldStyles';

type FormTextareaProps = TextareaProps & {
	label: string;
	isRequired?: boolean;
	helperText?: ReactNode;
	error?: string;
};

function FormTextarea({ label, isRequired = false, helperText, error, ...textareaProps }: FormTextareaProps) {
	const textareaId = useId();

	return (
		<FormControl isRequired={isRequired} isInvalid={Boolean(error)}>
			<FormLabel htmlFor={textareaId} {...fieldLabelStyles}>{label}</FormLabel>
			<Textarea id={textareaId} {...fieldStyles} {...textareaProps} />
			{error ? <FormErrorMessage fontSize="xs">{error}</FormErrorMessage> : helperText ? <FormHelperText fontSize="xs">{helperText}</FormHelperText> : null}
		</FormControl>
	);
}

export default FormTextarea;
