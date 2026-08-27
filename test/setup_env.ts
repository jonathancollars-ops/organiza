// Preload environment setup for Node test execution
(globalThis as any).__DEV__ = true;

// In-memory AsyncStorage implementation
export const memoryStore: Record<string, string> = {};

export const mockAsyncStorage = {
  getItem: async (key: string) => memoryStore[key] ?? null,
  setItem: async (key: string, value: string) => { memoryStore[key] = value; },
  removeItem: async (key: string) => { delete memoryStore[key]; },
  clear: async () => { Object.keys(memoryStore).forEach(k => delete memoryStore[k]); },
  multiRemove: async (keys: string[]) => { keys.forEach(k => delete memoryStore[k]); },
  multiGet: async (keys: string[]) => keys.map(k => [k, memoryStore[k] ?? null] as [string, string | null]),
  multiSet: async (pairs: [string, string][]) => { pairs.forEach(([k, v]) => { memoryStore[k] = v; }); },
  getAllKeys: async () => Object.keys(memoryStore),
};

// In-memory FileSystem store
export const mockFileSystemStore: Record<string, { exists: boolean; size: number; isDirectory: boolean }> = {};
export let mockFreeDiskStorageBytes = 10 * 1024 * 1024 * 1024; // 10 GB free by default
export function setMockFreeDiskStorageBytes(bytes: number) {
  mockFreeDiskStorageBytes = bytes;
}

// Hook require for Expo/React-Native modules
const Module = require('module');
export const mockReactNative = {
  Platform: { OS: 'ios', select: (obj: any) => obj.ios || obj.default },
  StyleSheet: { create: (styles: any) => styles },
  View: 'View',
  Text: 'Text',
  ScrollView: 'ScrollView',
  TouchableOpacity: 'TouchableOpacity',
  Alert: { alert: () => {} },
  StatusBar: { setBarStyle: () => {} },
  ActivityIndicator: 'ActivityIndicator',
  Linking: {
    openURL: async () => true,
    canOpenURL: async () => true,
  },
};

export const mockReactNativeCalendars = {
  Calendar: 'Calendar',
  LocaleConfig: { locales: {} as Record<string, any>, defaultLocale: 'pt-br' },
};

const origRequire = Module.prototype.require;

export const mockSecureStore: Record<string, string> = {};
export const mockSecureStoreImpl = {
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  setItemAsync: async (k: string, v: string) => { mockSecureStore[k] = v; },
  getItemAsync: async (k: string) => mockSecureStore[k] ?? null,
  deleteItemAsync: async (k: string) => { delete mockSecureStore[k]; },
};

export const mockNotifications = {
  setNotificationHandler: () => {},
  setNotificationChannelAsync: async () => {},
  getPermissionsAsync: async () => ({ status: 'granted' }),
  requestPermissionsAsync: async () => ({ status: 'granted' }),
  scheduleNotificationAsync: async () => 'mock_notif_id',
  getAllScheduledNotificationsAsync: async () => [],
  cancelScheduledNotificationAsync: async () => {},
  AndroidImportance: { MAX: 5 },
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    DATE: 'date',
  },
};

Module.prototype.require = function (id: string) {
  if (id === 'expo-secure-store') {
    return mockSecureStoreImpl;
  }
  if (id === '@react-native-async-storage/async-storage') {
    return { default: mockAsyncStorage, ...mockAsyncStorage };
  }
  if (id === 'react-native') {
    return mockReactNative;
  }
  if (id === 'react-native-calendars') {
    return mockReactNativeCalendars;
  }
  if (id === 'expo-notifications') {
    return mockNotifications;
  }
  if (id === 'expo-haptics') {
    return {
      selectionAsync: async () => {},
      impactAsync: async () => {},
      notificationAsync: async () => {},
      ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
      NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' }
    };
  }
  if (id === 'expo-file-system' || id === 'expo-file-system/legacy') {
    return {
      documentDirectory: 'file:///mock_sandbox_app/files/',
      cacheDirectory: 'file:///mock_sandbox_app/cache/',
      getInfoAsync: async (uri: string) => {
        if (mockFileSystemStore[uri]) {
          return { exists: true, isDirectory: mockFileSystemStore[uri].isDirectory, size: mockFileSystemStore[uri].size, uri };
        }
        return { exists: false, isDirectory: false, uri };
      },
      getFreeDiskStorageAsync: async () => mockFreeDiskStorageBytes,
      makeDirectoryAsync: async (dirUri: string) => {
        mockFileSystemStore[dirUri] = { exists: true, isDirectory: true, size: 0 };
      },
      deleteAsync: async (uri: string) => {
        delete mockFileSystemStore[uri];
      },
      createDownloadResumable: (url: string, fileUri: string, options: any, callback: any) => {
        let isPaused = false;
        let isCancelled = false;
        return {
          downloadAsync: async () => {
            if (isCancelled) throw new Error('Download cancelado');
            const totalBytes = 800000000;
            if (callback) {
              callback({ totalBytesWritten: Math.floor(totalBytes / 2), totalBytesExpectedToWrite: totalBytes });
              callback({ totalBytesWritten: totalBytes, totalBytesExpectedToWrite: totalBytes });
            }
            mockFileSystemStore[fileUri] = { exists: true, isDirectory: false, size: totalBytes };
            return { uri: fileUri, status: 200 };
          },
          pauseAsync: async () => {
            isPaused = true;
            return { url, fileUri, options, resumeData: 'mock_resume_data' };
          },
          resumeAsync: async () => {
            isPaused = false;
            return { uri: fileUri, status: 200 };
          },
          cancelAsync: async () => {
            isCancelled = true;
            delete mockFileSystemStore[fileUri];
          }
        };
      }
    };
  }
  return origRequire.apply(this, arguments);
};
