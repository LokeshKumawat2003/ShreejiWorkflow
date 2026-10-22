import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const colors = {
  brand: {
    50: '#EEF2FF',
    100: '#E0E7FF',
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

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

export const theme = extendTheme({
  config,
  colors,
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
        borderRadius: 'md',
        fontWeight: '600',
      },
      variants: {
        solid: {
          bg: 'brand.500',
          color: 'white',
          _hover: { bg: 'brand.600' },
        },
        outline: {
          borderColor: 'slate.200',
          color: 'slate.900',
        },
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
