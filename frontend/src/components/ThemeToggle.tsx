import { ChevronDownIcon, MoonIcon, SunIcon } from '@chakra-ui/icons';
import { Button } from '@chakra-ui/react';

type ThemeMode = 'light' | 'dark';

type ThemeToggleProps = {
  mode: ThemeMode;
  onToggle: () => void;
};

function ThemeToggle({ mode, onToggle }: ThemeToggleProps) {
  const isLight = mode === 'light';
  const isDark = !isLight;

  return (
    <Button
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} theme`}
      title={`Switch to ${isLight ? 'dark' : 'light'} theme`}
      leftIcon={isLight ? <SunIcon /> : <MoonIcon />}
      rightIcon={<ChevronDownIcon />}
      size="sm"
      variant="outline"
      borderRadius="full"
      borderColor={isDark ? 'whiteAlpha.300' : 'slate.200'}
      color={isDark ? 'white' : 'slate.900'}
      bg={isDark ? 'whiteAlpha.100' : 'whiteAlpha.800'}
      _hover={{ bg: isDark ? 'whiteAlpha.200' : 'slate.50' }}
    >
      {isLight ? 'Light' : 'Dark'}
    </Button>
  );
}

export default ThemeToggle;
