import { FormControl, FormLabel, Input } from '@chakra-ui/react';
import type { InputProps } from '@chakra-ui/react';
import { useId } from 'react';

type FormInputProps = InputProps & {
  label: string;
  isRequired?: boolean;
};

function FormInput({ label, isRequired = false, ...inputProps }: FormInputProps) {
  const inputId = useId();

  return (
    <FormControl isRequired={isRequired}>
      <FormLabel htmlFor={inputId} mb={2} fontSize="sm" fontWeight="600" color="slate.700">
        {label}
      </FormLabel>
      <Input
        id={inputId}
        h="44px"
        fontSize="sm"
        bg="white"
        borderColor="slate.200"
        _hover={{ borderColor: 'slate.300' }}
        _focusVisible={{ borderColor: 'brand.500', boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)' }}
        {...inputProps}
      />
    </FormControl>
  );
}

export default FormInput;
