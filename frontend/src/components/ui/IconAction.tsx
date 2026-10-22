import { IconButton, Tooltip, type IconButtonProps } from '@chakra-ui/react';

type IconActionProps = Omit<IconButtonProps, 'aria-label'> & {
	label: string;
	tone?: 'default' | 'danger';
};

function IconAction({ label, tone = 'default', ...buttonProps }: IconActionProps) {
	const isDanger = tone === 'danger';
	return (
		<Tooltip label={label} hasArrow openDelay={300}>
			<IconButton
				aria-label={label}
				size="sm"
				variant="ghost"
				borderRadius="full"
				color={isDanger ? 'red.500' : 'slate.500'}
				_hover={{ bg: isDanger ? 'red.50' : 'slate.100', color: isDanger ? 'red.600' : 'slate.900' }}
				{...buttonProps}
			/>
		</Tooltip>
	);
}

export default IconAction;
