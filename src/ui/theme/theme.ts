import { useColorScheme } from 'react-native';

export type Palette = {
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  success: string;
  warning: string;
  danger: string;
  bubbleUser: string;
  bubbleAssistant: string;
  overlay: string;
};

export const darkPalette: Palette = {
  background: '#0E1116',
  surface: '#161A21',
  surfaceElevated: '#1C212A',
  border: '#242A35',
  borderStrong: '#333B49',
  text: '#ECEEF2',
  textMuted: '#9BA4B4',
  textFaint: '#6B7484',
  accent: '#7C8CF8',
  accentSoft: '#242A45',
  accentText: '#0E1116',
  success: '#4CC38A',
  warning: '#E5B454',
  danger: '#F2686B',
  bubbleUser: '#2A3150',
  bubbleAssistant: '#171B22',
  overlay: 'rgba(6, 8, 12, 0.72)',
};

export const lightPalette: Palette = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceElevated: '#F1F3F7',
  border: '#E2E5EB',
  borderStrong: '#CDD2DC',
  text: '#12141A',
  textMuted: '#5B6472',
  textFaint: '#8A93A2',
  accent: '#4F5FE8',
  accentSoft: '#E8EAFB',
  accentText: '#FFFFFF',
  success: '#1E9E63',
  warning: '#B7791F',
  danger: '#D14343',
  bubbleUser: '#E6E9FD',
  bubbleAssistant: '#FFFFFF',
  overlay: 'rgba(20, 24, 31, 0.35)',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;

export function usePalette(): { palette: Palette; scheme: 'light' | 'dark' } {
  const scheme = useColorScheme() === 'light' ? 'light' : 'dark';
  return { palette: scheme === 'light' ? lightPalette : darkPalette, scheme };
}
