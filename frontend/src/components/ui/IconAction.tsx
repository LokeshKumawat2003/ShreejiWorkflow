import { IconButton, Tooltip, type IconButtonProps } from '@chakra-ui/react';

type Tone = 'default' | 'primary' | 'danger';

type IconActionProps = Omit<IconButtonProps, 'aria-label'> & {
	label: string;
	tone?: Tone;
};

const toneHover: Record<Tone, { bg: string; color: string; borderColor: string }> = {
	default: { bg: 'slate.50', color: 'slate.900', borderColor: 'slate.300' },
	primary: { bg: 'brand.50', color: 'brand.600', borderColor: 'brand.200' },
	danger: { bg: 'red.50', color: 'red.600', borderColor: 'red.200' },
};

function IconAction({ label, tone = 'default', ...buttonProps }: IconActionProps) {
	return (
		<Tooltip label={label} hasArrow openDelay={300}>
			<IconButton
				aria-label={label}
				w="32px"
				minW="32px"
				h="32px"
				fontSize="14px"
				variant="outline"
				bg="white"
				borderRadius="9px"
				borderColor="slate.200"
				color={tone === 'danger' ? 'red.500' : 'slate.500'}
				transition="all 0.15s ease"
				_hover={{ ...toneHover[tone], transform: 'translateY(-1px)', boxShadow: 'sm' }}
				_active={{ transform: 'translateY(0)' }}
				{...buttonProps}
			/>
		</Tooltip>
	);
}

export default IconAction;
