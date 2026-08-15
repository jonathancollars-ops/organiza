import { EventCategory, ThemeType } from '../types';

export const Colors = {
  light: {
    background: '#F5F7F8',
    surface: '#FFFFFF',
    text: '#1C1C1E',
    textSecondary: '#8E8E93',
    primary: '#00DFA2', // Mint Green
    primaryDark: '#00B383',
    border: '#E5E5EA',
    danger: '#FF3B30',
  },
  dark: {
    background: '#000000',
    surface: '#1C1C1E',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    primary: '#00FFAA', // Vibrant Mint Green
    primaryDark: '#00DFA2',
    border: '#38383A',
    danger: '#FF453A',
  }
};

export const CategoryColors: Record<EventCategory, string> = {
  'Saúde/Academia': '#00FFAA', // Mint Green
  'Faculdade/Aulas': '#0A84FF', // Blue
  'Provas/Trabalhos': '#FF453A', // Red
  'Lazer': '#FF9F0A', // Orange
  'Outros': '#BF5AF2', // Purple
};

export const getThemeColors = (theme: ThemeType) => Colors[theme];
