import { Input, type InputProps } from '@chakra-ui/react';
import { filterControlStyles } from './fieldStyles';

function FilterInput(props: InputProps) {
	return <Input w="100%" {...filterControlStyles} {...props} />;
}

export default FilterInput;
