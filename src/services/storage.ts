import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppEvent, ThemeType, Subject, AttendanceRecord } from '../types';

const EVENTS_KEY = '@organiza_events';
const THEME_KEY = '@organiza_theme';
const SUBJECTS_KEY = '@organiza_subjects';

export const StorageService = {
  async getEvents(): Promise<AppEvent[]> {
    try {
      const jsonValue = await AsyncStorage.getItem(EVENTS_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (e) {
      console.error('Failed to fetch events from storage', e);
      return [];
    }
  },

  async saveEvents(events: AppEvent[]): Promise<void> {
    try {
      const jsonValue = JSON.stringify(events);
      await AsyncStorage.setItem(EVENTS_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save events to storage', e);
    }
  },

  async getSubjects(): Promise<Subject[]> {
    try {
      const jsonValue = await AsyncStorage.getItem(SUBJECTS_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (e) {
      console.error('Failed to fetch subjects from storage', e);
      return [];
    }
  },

  async saveSubjects(subjects: Subject[]): Promise<void> {
    try {
      const jsonValue = JSON.stringify(subjects);
      await AsyncStorage.setItem(SUBJECTS_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save subjects to storage', e);
    }
  },

  async getTheme(): Promise<ThemeType> {
    try {
      const theme = await AsyncStorage.getItem(THEME_KEY);
      return (theme as ThemeType) || 'dark';
    } catch (e) {
      return 'dark';
    }
  },

  async saveTheme(theme: ThemeType): Promise<void> {
    try {
      await AsyncStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      console.error('Failed to save theme', e);
    }
  },

  async getAttendances(): Promise<AttendanceRecord[]> {
    try {
      const jsonValue = await AsyncStorage.getItem('@organiza_attendances');
      return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (e) {
      console.error('Failed to fetch attendances', e);
      return [];
    }
  },

  async saveAttendances(records: AttendanceRecord[]): Promise<void> {
    try {
      const jsonValue = JSON.stringify(records);
      await AsyncStorage.setItem('@organiza_attendances', jsonValue);
    } catch (e) {
      console.error('Failed to save attendances', e);
    }
  }
};
