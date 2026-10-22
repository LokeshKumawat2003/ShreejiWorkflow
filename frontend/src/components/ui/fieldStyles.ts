export const fieldLabelStyles = {
	mb: 2,
	fontSize: 'sm',
	fontWeight: '600',
	color: 'slate.900',
} as const;

export const fieldStyles = {
	fontSize: 'sm',
	bg: 'white',
	borderColor: 'slate.200',
	borderRadius: 'md',
	_hover: { borderColor: 'slate.400' },
	_focusVisible: { borderColor: 'brand.500', boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)' },
} as const;

export const filterControlStyles = {
	...fieldStyles,
	h: '40px',
	borderRadius: '10px',
	color: 'slate.900',
	_placeholder: { color: 'slate.400' },
	_hover: { borderColor: 'slate.300' },
	_focusVisible: { borderColor: 'brand.500', boxShadow: '0 0 0 3px rgba(79, 70, 229, 0.15)' },
} as const;
