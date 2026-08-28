import React from 'react';
import { render, act, waitFor, fireEvent } from '@testing-library/react-native';
import { Text, TouchableOpacity } from 'react-native';
import { AppProvider, useApp } from '../src/contexts/AppContext';

// Mocks
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve('dark')),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

const TestThemeComponent = () => {
  const { theme, handleThemeToggle } = useApp();
  return (
    <>
      <Text testID="theme-text">{theme}</Text>
      <TouchableOpacity testID="toggle-button" onPress={handleThemeToggle}>
        <Text>Toggle Theme</Text>
      </TouchableOpacity>
    </>
  );
};

describe('Theme System (AppContext)', () => {
  it('provides the default theme and cycles themes correctly', async () => {
    const { getByTestId } = render(
      <AppProvider>
        <TestThemeComponent />
      </AppProvider>
    );

    // O estado inicial pode levar um ciclo para estabilizar pois usa loadData no useEffect
    await waitFor(() => {
      expect(getByTestId('theme-text').children[0]).toBe('dark');
    });

    // Clica para alternar tema
    await act(async () => {
      fireEvent.press(getByTestId('toggle-button'));
    });

    // dark -> amoled
    await waitFor(() => {
      expect(getByTestId('theme-text').children[0]).toBe('amoled');
    });

    // Clica novamente
    await act(async () => {
      fireEvent.press(getByTestId('toggle-button'));
    });

    // amoled -> light
    await waitFor(() => {
      expect(getByTestId('theme-text').children[0]).toBe('light');
    });
  });
});
