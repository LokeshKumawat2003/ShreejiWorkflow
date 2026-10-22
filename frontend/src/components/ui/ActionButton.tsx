import { Button } from '@chakra-ui/react';
import type { ButtonProps } from '@chakra-ui/react';
import { forwardRef } from 'react';

type ActionButtonTone = 'primary' | 'neutral' | 'danger';

type ActionButtonProps = ButtonProps & {
  tone?: ActionButtonTone;
};

const toneStyles: Record<ActionButtonTone, ButtonProps> = {
  primary: { colorScheme: 'brand', variant: 'solid' },
  neutral: {
    variant: 'outline',
    color: 'slate.900',
    borderColor: 'slate.200',
    _hover: { bg: 'slate.50' },
  },
  danger: {
    variant: 'solid',
    bg: 'red.600',
    color: 'white',
    _hover: { bg: 'red.700' },
    _active: { bg: 'red.800' },
  },
};

const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(function ActionButton(
  { tone = 'primary', ...props },
  ref,
) {
  return <Button ref={ref} {...toneStyles[tone]} {...props} />;
});

export default ActionButton;