// Preload environment setup for Node test execution
(globalThis as any).__DEV__ = true;

// In-memory AsyncStorage implementation
export const memoryStore: Record<string, string> = {};

export const mockAsyncStorage = {
  getItem: async (key: string) => memoryStore[key] ?? null,
  setItem: async (key: string, value: string) => { memoryStore[key] = value; },
  removeItem: async (key: string) => { delete memoryStore[key]; },
  clear: async () => { Object.keys(memoryStore).forEach(k => delete memoryStore[k]); },
};

// Hook require for Expo/React-Native modules
const Module = require('module');
const origRequire = Module.prototype.require;

Module.prototype.require = function (id: string) {
  if (id === '@react-native-async-storage/async-storage') {
    return { default: mockAsyncStorage, ...mockAsyncStorage };
  }
  if (id === 'react-native') {
    return {
      Platform: { OS: 'ios', select: (obj: any) => obj.ios || obj.default },
    };
  }
  if (id === 'expo-notifications') {
    return {
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
      getInfoAsync: async (uri: string) => ({ exists: false, isDirectory: false }),
      makeDirectoryAsync: async () => {},
      deleteAsync: async () => {},
      createDownloadResumable: (url: string, fileUri: string, options: any, callback: any) => ({
        downloadAsync: async () => {
          if (callback) callback({ totalBytesWritten: 1280000000, totalBytesExpectedToWrite: 1280000000 });
          return { uri: fileUri, status: 200 };
        },
        cancelAsync: async () => {},
        pauseAsync: async () => {}
      })
    };
  }
  return origRequire.apply(this, arguments);
};
