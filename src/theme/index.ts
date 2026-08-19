import { EventCategory, ThemeType } from '../types';

export const Colors = {
  light: {
    background: '#F8F9FA',
    surface: '#FFFFFF',
    surfaceSubtle: '#F1F3F5',
    surfaceHighlight: '#E9ECEF',
    text: '#1A1D20',
    textSecondary: '#6C757D',
    textMuted: '#ADB5BD',
    primary: '#059669', // Emerald/Mint elegante com alto contraste
    primaryDark: '#047857',
    primaryLight: '#D1FAE5',
    border: '#E2E8F0',
    borderSubtle: '#F1F5F9',
    borderHighlight: '#CBD5E1',
    danger: '#EF4444',
    dangerLight: '#FEE2E2',
    dangerDark: '#B91C1C',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    warningDark: '#B45309',
    success: '#10B981',
    successLight: '#D1FAE5',
    successDark: '#047857',
    info: '#3B82F6',
    card: '#FFFFFF',
    shadow: 'rgba(0, 0, 0, 0.06)',
  },
  dark: {
    background: '#0F1115',
    surface: '#181B20',
    surfaceSubtle: '#1F232B',
    surfaceHighlight: '#292E38',
    text: '#F4F4F6',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    primary: '#00FFAA', // Vibrant Mint Green
    primaryDark: '#00DFA2',
    primaryLight: 'rgba(0, 255, 170, 0.12)',
    border: '#2A303C',
    borderSubtle: '#1E232D',
    borderHighlight: '#3E4756',
    danger: '#F87171',
    dangerLight: 'rgba(239, 68, 68, 0.15)',
    dangerDark: '#F87171',
    warning: '#FBBF24',
    warningLight: 'rgba(245, 158, 11, 0.15)',
    warningDark: '#FBBF24',
    success: '#34D399',
    successLight: 'rgba(16, 185, 129, 0.15)',
    successDark: '#34D399',
    info: '#60A5FA',
    card: '#181B20',
    shadow: 'rgba(0, 0, 0, 0.4)',
  },
  amoled: {
    background: '#000000',
    surface: '#0A0C0E',
    surfaceSubtle: '#121519',
    surfaceHighlight: '#1A1E24',
    text: '#FFFFFF',
    textSecondary: '#8B95A5',
    textMuted: '#525B6A',
    primary: '#00FFAA', // Neon Mint Green
    primaryDark: '#00DFA2',
    primaryLight: 'rgba(0, 255, 170, 0.15)',
    border: '#1E2229',
    borderSubtle: '#14171C',
    borderHighlight: '#2C323D',
    danger: '#F87171',
    dangerLight: 'rgba(239, 68, 68, 0.18)',
    dangerDark: '#F87171',
    warning: '#FBBF24',
    warningLight: 'rgba(245, 158, 11, 0.18)',
    warningDark: '#FBBF24',
    success: '#34D399',
    successLight: 'rgba(16, 185, 129, 0.18)',
    successDark: '#34D399',
    info: '#60A5FA',
    card: '#0A0C0E',
    shadow: 'rgba(0, 0, 0, 0.6)',
  }
};

export const CategoryColors: Record<EventCategory, string> = {
  'Saúde/Academia': '#00FFAA', // Mint Green
  'Faculdade/Aulas': '#3B82F6', // Modern Blue
  'Provas/Trabalhos': '#F43F5E', // Rose/Red
  'Lazer': '#F59E0B', // Amber
  'Outros': '#A855F7', // Violet
};

export const getThemeColors = (theme: ThemeType = 'dark') => Colors[theme] || Colors.dark;

/**
 * Retorna cor de texto de alto contraste (#000000 ou #FFFFFF) com base na cor de fundo
 */
export function getContrastTextColor(hexOrHsl: string | undefined): string {
  if (!hexOrHsl) return '#000000';

  // HSL string handling (e.g. hsl(120, 75%, 60%))
  if (hexOrHsl.startsWith('hsl')) {
    const match = hexOrHsl.match(/hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/);
    if (match) {
      const lightness = parseInt(match[3], 10);
      return lightness > 55 ? '#0A0A0A' : '#FFFFFF';
    }
    return '#0A0A0A';
  }

  // Hex color handling (#RRGGBB or #RGB)
  let hex = hexOrHsl.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Relative luminance calculation
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 140 ? '#0A0A0A' : '#FFFFFF';
  }

  return '#000000';
}

