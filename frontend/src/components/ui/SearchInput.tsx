import { CloseIcon, SearchIcon } from '@chakra-ui/icons';
import { IconButton, Input, InputGroup, InputLeftElement, InputRightElement, type InputGroupProps } from '@chakra-ui/react';
import { fieldStyles } from './fieldStyles';

type SearchInputProps = Omit<InputGroupProps, 'onChange'> & {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	label?: string;
	isPill?: boolean;
};

function SearchInput({ value, onChange, placeholder = 'Search', label, isPill = false, ...groupProps }: SearchInputProps) {
	return (
		<InputGroup maxW={{ base: '100%', md: '320px' }} {...groupProps}>
			<InputLeftElement pointerEvents="none" color="slate.400" h="full" pl={isPill ? 2 : 0}>
				<SearchIcon boxSize={3.5} />
			</InputLeftElement>
			<Input
				aria-label={label || placeholder}
				placeholder={placeholder}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				{...fieldStyles}
				{...(isPill ? { borderRadius: 'full', pl: 11 } : {})}
			/>
			{value ? (
				<InputRightElement h="full" pr={isPill ? 2 : 0}>
					<IconButton aria-label="Clear search" icon={<CloseIcon boxSize={2} />} size="xs" variant="ghost" borderRadius="full" color="slate.400" onClick={() => onChange('')} />
				</InputRightElement>
			) : null}
		</InputGroup>
	);
}

export default SearchInput;
