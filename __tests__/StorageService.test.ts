import { StorageService, DEFAULT_SETTINGS, DEFAULT_STREAK, DEFAULT_GAMIFICATION } from '../src/services/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock do AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

describe('StorageService Resilience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSettings', () => {
    it('should return default settings if AsyncStorage.getItem throws an error', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('AsyncStorage Error'));
      const settings = await StorageService.getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should return default settings if storage returns corrupted JSON', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('{corrupted:json}');
      const settings = await StorageService.getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should return valid settings if storage returns partial or missing values', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify({ theme: 'light', pomodoroFocusMin: null }));
      const settings = await StorageService.getSettings();
      expect(settings.theme).toBe('light');
      expect(settings.pomodoroFocusMin).toBe(DEFAULT_SETTINGS.pomodoroFocusMin); // fallback aplicado
    });
  });

  describe('saveSettings', () => {
    it('should safely save settings even if AsyncStorage.setItem throws an error (no crash)', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Write Error'));
      // A função não deve disparar erro pra cima
      await expect(StorageService.saveSettings(DEFAULT_SETTINGS)).resolves.not.toThrow();
    });
  });

  describe('getEvents', () => {
    it('should return empty array for events if getItem throws', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Error'));
      const events = await StorageService.getEvents();
      expect(events).toEqual([]);
    });
  });

  describe('getGamificationData', () => {
    it('should return default gamification if getItem fails', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Error'));
      const data = await StorageService.getGamificationData();
      expect(data).toEqual(DEFAULT_GAMIFICATION);
    });
  });

  describe('getStreak', () => {
    it('should return default streak if getItem fails', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Error'));
      const data = await StorageService.getStreak();
      expect(data).toEqual(DEFAULT_STREAK);
    });
  });
});
