import { CloseIcon, SearchIcon } from '@chakra-ui/icons';
import { Box, IconButton, Input, type BoxProps } from '@chakra-ui/react';
import { filterControlStyles } from './fieldStyles';

type SearchInputProps = Omit<BoxProps, 'onChange'> & {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	label?: string;
};

function SearchInput({ value, onChange, placeholder = 'Search', label, ...boxProps }: SearchInputProps) {
	return (
		<Box position="relative" w="100%" {...boxProps}>
			<SearchIcon
				position="absolute"
				left="14px"
				top="50%"
				transform="translateY(-50%)"
				boxSize={3.5}
				color="slate.400"
				pointerEvents="none"
				zIndex={1}
			/>
			<Input
				aria-label={label || placeholder}
				placeholder={placeholder}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				{...filterControlStyles}
				ps="38px"
				pe={value ? '36px' : 3}
			/>
			{value ? (
				<IconButton
					aria-label="Clear search"
					icon={<CloseIcon boxSize={2} />}
					size="xs"
					variant="ghost"
					borderRadius="full"
					color="slate.400"
					position="absolute"
					right="8px"
					top="50%"
					transform="translateY(-50%)"
					zIndex={1}
					onClick={() => onChange('')}
				/>
			) : null}
		</Box>
	);
}

export default SearchInput;
