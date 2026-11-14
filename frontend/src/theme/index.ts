import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const colors = {
  brand: {
    50: '#EEF2FF',
    100: '#E0E7FF',
    200: '#C7D2FE',
    300: '#A5B4FC',
    400: '#818CF8',
    500: '#4F46E5',
    600: '#4338CA',
    700: '#3730A3',
  },
  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
};

const BRAND_GRADIENT = `linear-gradient(90deg, ${colors.brand[500]}, ${colors.brand[600]})`;
const BRAND_GRADIENT_HOVER = `linear-gradient(90deg, ${colors.brand[600]}, ${colors.brand[700]})`;

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

export const theme = extendTheme({
  config,
  colors,
  styles: {
    global: {
      'html, body': {
        overflowX: 'clip',
      },
    },
  },
  fonts: {
    heading: 'Inter, sans-serif',
    body: 'Inter, sans-serif',
  },
  radii: {
    sm: '8px',
    md: '12px',
    lg: '16px',
  },
  shadows: {
    sm: '0 1px 2px rgba(15, 23, 42, 0.06)',
    md: '0 8px 20px rgba(15, 23, 42, 0.08)',
  },
  components: {
    Button: {
      baseStyle: {
        borderRadius: '10px',
        fontWeight: '600',
        transition: 'background 0.15s, box-shadow 0.15s, transform 0.1s',
        _active: { transform: 'translateY(1px)' },
      },
      variants: {
        // Gradient is set through `bg` (not `bgGradient`) so a component's own `bg` prop still replaces it.
        solid: ({ colorScheme }: { colorScheme: string }) => (colorScheme === 'gray' || colorScheme === 'brand'
          ? {
            bg: BRAND_GRADIENT,
            color: 'white',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
            _hover: { bg: BRAND_GRADIENT_HOVER, boxShadow: '0 6px 16px rgba(79, 70, 229, 0.32)', _disabled: { bg: BRAND_GRADIENT, boxShadow: 'none' } },
            _active: { bg: BRAND_GRADIENT_HOVER },
          }
          : {
            bg: `${colorScheme}.500`,
            color: 'white',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)',
            _hover: { bg: `${colorScheme}.600`, _disabled: { bg: `${colorScheme}.500`, boxShadow: 'none' } },
            _active: { bg: `${colorScheme}.700` },
          }),
        outline: ({ colorScheme }: { colorScheme: string }) => (colorScheme === 'gray'
          ? {
            bg: 'white',
            borderColor: 'slate.200',
            color: 'slate.800',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
            _hover: { bg: 'slate.50', borderColor: 'slate.300', color: 'slate.900' },
            _active: { bg: 'slate.100' },
          }
          : {
            bg: 'white',
            borderColor: `${colorScheme}.200`,
            color: `${colorScheme}.600`,
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
            _hover: { bg: `${colorScheme}.50`, borderColor: `${colorScheme}.300` },
            _active: { bg: `${colorScheme}.100` },
          }),
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: 'white',
          border: '1px solid',
          borderColor: 'slate.200',
          boxShadow: 'sm',
          borderRadius: 'lg',
        },
      },
    },
  },
});

export default theme;
