import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppEvent,
  ThemeType,
  Subject,
  AttendanceRecord,
  StudyTask,
  StudySession,
  AIConfig,
  Semester,
  AppSettings,
  StudyStreak,
  BackupData,
  AACCActivity,
  GroupProject,
  GamificationData
} from '../types';
import { getCurrentSemesterId, getCurrentSemesterName } from '../utils';

const EVENTS_KEY = '@organiza_events';
const THEME_KEY = '@organiza_theme';
const SUBJECTS_KEY = '@organiza_subjects';
const ATTENDANCES_KEY = '@organiza_attendances';
const TASKS_KEY = '@organiza_tasks';
const STUDY_SESSIONS_KEY = '@organiza_studysessions';
const SEMESTERS_KEY = '@organiza_semesters';
const SETTINGS_KEY = '@organiza_settings';
const STREAK_KEY = '@organiza_streak';
const TEAMS_CONFIG_KEY = '@organiza_teams_config';
const AI_CONFIG_KEY = '@organiza_ai_config';
const SECURE_AI_API_KEY = 'lumen_secure_ai_api_key';
const AACC_KEY = '@organiza_aacc';
const GROUP_PROJECTS_KEY = '@organiza_group_projects';
const GAMIFICATION_KEY = '@organiza_gamification';

let secureStoreModule: any = null;
try {
  secureStoreModule = require('expo-secure-store');
} catch {
  secureStoreModule = null;
}

const inMemorySecureVault: Record<string, string> = {};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fullscreen: false,
  pomodoroFocusMin: 25,
  pomodoroBreakMin: 5,
  pomodoroLongBreakMin: 15,
  defaultPassGrade: 7.0,
  examWeekMode: false,
  soundEnabled: true,
  hapticsEnabled: true,
};

export const DEFAULT_GAMIFICATION: GamificationData = {
  xp: 0,
  level: 1,
  unlockedAchievements: [],
  totalFocusMinutes: 0
};

export const DEFAULT_STREAK: StudyStreak = {
  currentStreak: 0,
  longestStreak: 0,
  lastStudyDate: '',
  bestStreak: 0,
  totalStudyDays: 0,
};

const VALID_THEMES: ThemeType[] = ['dark', 'light', 'amoled'];

/**
 * Safely parses a raw JSON string into a guaranteed non-null typed array.
 * Rules:
 * 1. If raw is null, undefined, not a string, or empty/whitespace -> returns fallback (or []).
 * 2. If raw is literal "null" or "undefined" -> returns fallback (or []).
 * 3. Catches all JSON.parse syntax errors -> returns fallback (or []).
 * 4. Ensures the parsed value is strictly an Array via Array.isArray().
 * 5. Sanitizes array elements by filtering out null and undefined values.
 */
export function safeParseArray<T>(raw: string | null | undefined, fallback: T[] = []): T[] {
  if (!raw || typeof raw !== 'string') {
    return Array.isArray(fallback) ? fallback : [];
  }
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
    return Array.isArray(fallback) ? fallback : [];
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      return Array.isArray(fallback) ? fallback : [];
    }
    return parsed.filter((item): item is T => item !== null && item !== undefined);
  } catch {
    return Array.isArray(fallback) ? fallback : [];
  }
}

/**
 * Safely parses a raw JSON string into a guaranteed non-null typed object,
 * merging with fallback values to guarantee field completeness.
 * Rules:
 * 1. If raw is null, undefined, not a string, or empty/whitespace -> returns shallow copy of fallback.
 * 2. If raw is literal "null" or "undefined" -> returns shallow copy of fallback.
 * 3. Catches all JSON.parse syntax errors -> returns shallow copy of fallback.
 * 4. Ensures parsed value is a non-null, non-array object (typeof === 'object' && !Array.isArray).
 * 5. Merges fallback with parsed object to supply missing/undefined fields.
 */
export function safeParseObject<T extends Record<string, any>>(raw: string | null | undefined, fallback: T): T {
  if (!raw || typeof raw !== 'string') {
    return { ...fallback };
  }
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
    return { ...fallback };
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ...fallback, ...parsed };
    }
    return { ...fallback };
  } catch {
    return { ...fallback };
  }
}

export const StorageService = {
  async getEvents(): Promise<AppEvent[]> {
    try {
      const jsonValue = await AsyncStorage.getItem(EVENTS_KEY);
      return safeParseArray<AppEvent>(jsonValue, []);
    } catch (e) {
      console.error('Failed to fetch events from storage', e);
      return [];
    }
  },

  async saveEvents(events: AppEvent[]): Promise<void> {
    try {
      const safeEvents = Array.isArray(events) ? events.filter(Boolean) : [];
      const jsonValue = JSON.stringify(safeEvents);
      await AsyncStorage.setItem(EVENTS_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save events to storage', e);
    }
  },

  async getSubjects(): Promise<Subject[]> {
    try {
      const jsonValue = await AsyncStorage.getItem(SUBJECTS_KEY);
      return safeParseArray<Subject>(jsonValue, []);
    } catch (e) {
      console.error('Failed to fetch subjects from storage', e);
      return [];
    }
  },

  async saveSubjects(subjects: Subject[]): Promise<void> {
    try {
      const safeSubjects = Array.isArray(subjects) ? subjects.filter(Boolean) : [];
      const jsonValue = JSON.stringify(safeSubjects);
      await AsyncStorage.setItem(SUBJECTS_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save subjects to storage', e);
    }
  },

  async getTheme(): Promise<ThemeType> {
    try {
      const theme = await AsyncStorage.getItem(THEME_KEY);
      return (theme && VALID_THEMES.includes(theme as ThemeType)) ? (theme as ThemeType) : 'dark';
    } catch (e) {
      return 'dark';
    }
  },

  async saveTheme(theme: ThemeType): Promise<void> {
    try {
      const safeTheme = VALID_THEMES.includes(theme) ? theme : 'dark';
      await AsyncStorage.setItem(THEME_KEY, safeTheme);
    } catch (e) {
      console.error('Failed to save theme', e);
    }
  },

  async getAttendances(): Promise<AttendanceRecord[]> {
    try {
      const jsonValue = await AsyncStorage.getItem(ATTENDANCES_KEY);
      return safeParseArray<AttendanceRecord>(jsonValue, []);
    } catch (e) {
      console.error('Failed to fetch attendances', e);
      return [];
    }
  },

  async saveAttendances(records: AttendanceRecord[]): Promise<void> {
    try {
      const safeRecords = Array.isArray(records) ? records.filter(Boolean) : [];
      const jsonValue = JSON.stringify(safeRecords);
      await AsyncStorage.setItem(ATTENDANCES_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save attendances', e);
    }
  },

  async getTasks(): Promise<StudyTask[]> {
    try {
      const jsonValue = await AsyncStorage.getItem(TASKS_KEY);
      return safeParseArray<StudyTask>(jsonValue, []);
    } catch (e) {
      console.error('Failed to fetch tasks', e);
      return [];
    }
  },

  async saveTasks(tasks: StudyTask[]): Promise<void> {
    try {
      const safeTasks = Array.isArray(tasks) ? tasks.filter(Boolean) : [];
      const jsonValue = JSON.stringify(safeTasks);
      await AsyncStorage.setItem(TASKS_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save tasks', e);
    }
  },

  async getStudySessions(): Promise<StudySession[]> {
    try {
      const jsonValue = await AsyncStorage.getItem(STUDY_SESSIONS_KEY);
      return safeParseArray<StudySession>(jsonValue, []);
    } catch (e) {
      console.error('Failed to fetch study sessions', e);
      return [];
    }
  },

  async saveStudySessions(sessions: StudySession[]): Promise<void> {
    try {
      const safeSessions = Array.isArray(sessions) ? sessions.filter(Boolean) : [];
      const jsonValue = JSON.stringify(safeSessions);
      await AsyncStorage.setItem(STUDY_SESSIONS_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save study sessions', e);
    }
  },

  async getSemesters(): Promise<Semester[]> {
    try {
      const currentSemId = getCurrentSemesterId();
      const currentSemName = getCurrentSemesterName();
      const jsonValue = await AsyncStorage.getItem(SEMESTERS_KEY);
      let semesters: Semester[] = safeParseArray<Semester>(jsonValue, []);

      if (semesters.length === 0) {
        semesters = [{
          id: currentSemId,
          name: currentSemName || currentSemId,
          isCurrent: true
        }];
        await this.saveSemesters(semesters);
      } else {
        const hasCurrent = semesters.some(s => s && (s.id === currentSemId || s.name === currentSemId || s.name === currentSemName));
        if (!hasCurrent) {
          semesters = semesters.map(s => ({ ...s, isCurrent: false }));
          semesters.unshift({
            id: currentSemId,
            name: currentSemName || currentSemId,
            isCurrent: true
          });
          await this.saveSemesters(semesters);
        }
      }
      return semesters;
    } catch (e) {
      console.error('Failed to fetch semesters from storage', e);
      const semId = getCurrentSemesterId();
      const semName = getCurrentSemesterName();
      return [{ id: semId, name: semName || semId, isCurrent: true }];
    }
  },

  async saveSemesters(semesters: Semester[]): Promise<void> {
    try {
      const safeSemesters = Array.isArray(semesters) ? semesters.filter(Boolean) : [];
      const jsonValue = JSON.stringify(safeSemesters);
      await AsyncStorage.setItem(SEMESTERS_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save semesters', e);
    }
  },

  async getSettings(): Promise<AppSettings> {
    try {
      const jsonValue = await AsyncStorage.getItem(SETTINGS_KEY);
      const parsed = safeParseObject<AppSettings>(jsonValue, DEFAULT_SETTINGS);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        fullscreen: parsed.fullscreen === true,
        pomodoroFocusMin: Number.isFinite(parsed.pomodoroFocusMin) ? Number(parsed.pomodoroFocusMin) : DEFAULT_SETTINGS.pomodoroFocusMin,
        pomodoroBreakMin: Number.isFinite(parsed.pomodoroBreakMin) ? Number(parsed.pomodoroBreakMin) : DEFAULT_SETTINGS.pomodoroBreakMin,
        pomodoroLongBreakMin: Number.isFinite(parsed.pomodoroLongBreakMin) ? Number(parsed.pomodoroLongBreakMin) : DEFAULT_SETTINGS.pomodoroLongBreakMin,
        defaultPassGrade: Number.isFinite(parsed.defaultPassGrade) ? Number(parsed.defaultPassGrade) : DEFAULT_SETTINGS.defaultPassGrade,
        soundEnabled: parsed.soundEnabled !== false,
        hapticsEnabled: parsed.hapticsEnabled !== false,
        examWeekMode: parsed.examWeekMode === true,
      };
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    try {
      const safe: AppSettings = {
        theme: (settings && VALID_THEMES.includes(settings.theme)) ? settings.theme : DEFAULT_SETTINGS.theme,
        fullscreen: settings?.fullscreen === true,
        pomodoroFocusMin: Math.max(1, Math.min(180, Number(settings?.pomodoroFocusMin) || DEFAULT_SETTINGS.pomodoroFocusMin)),
        pomodoroBreakMin: Math.max(1, Math.min(60, Number(settings?.pomodoroBreakMin) || DEFAULT_SETTINGS.pomodoroBreakMin)),
        pomodoroLongBreakMin: Math.max(1, Math.min(60, Number(settings?.pomodoroLongBreakMin) || DEFAULT_SETTINGS.pomodoroLongBreakMin)),
        defaultPassGrade: Math.max(0, Math.min(10, Number(settings?.defaultPassGrade) || DEFAULT_SETTINGS.defaultPassGrade)),
        examWeekMode: settings?.examWeekMode === true,
        soundEnabled: settings?.soundEnabled !== false,
        hapticsEnabled: settings?.hapticsEnabled !== false,
        currentSemesterId: settings?.currentSemesterId || undefined,
      };
      const jsonValue = JSON.stringify(safe);
      await AsyncStorage.setItem(SETTINGS_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  },

  async getStreak(): Promise<StudyStreak> {
    try {
      const jsonValue = await AsyncStorage.getItem(STREAK_KEY);
      const parsed = safeParseObject<StudyStreak>(jsonValue, DEFAULT_STREAK);
      const current = Number.isFinite(parsed.currentStreak) ? Math.max(0, Number(parsed.currentStreak)) : 0;
      const longest = Number.isFinite(parsed.longestStreak)
        ? Math.max(0, Number(parsed.longestStreak))
        : Number.isFinite(parsed.bestStreak)
        ? Math.max(0, Number(parsed.bestStreak!))
        : 0;
      const best = Number.isFinite(parsed.bestStreak)
        ? Math.max(0, Number(parsed.bestStreak!))
        : longest;
      const totalDays = Number.isFinite(parsed.totalStudyDays)
        ? Math.max(0, Number(parsed.totalStudyDays!))
        : 0;
      return {
        currentStreak: current,
        longestStreak: Math.max(longest, best),
        lastStudyDate: typeof parsed.lastStudyDate === 'string' ? parsed.lastStudyDate : '',
        bestStreak: Math.max(best, longest),
        totalStudyDays: totalDays,
      };
    } catch (e) {
      return DEFAULT_STREAK;
    }
  },

  async saveStreak(streak: StudyStreak): Promise<void> {
    try {
      const current = Math.max(0, Number(streak?.currentStreak) || 0);
      const longest = Number.isFinite(streak?.longestStreak)
        ? Math.max(0, Number(streak.longestStreak))
        : Number.isFinite(streak?.bestStreak)
        ? Math.max(0, Number(streak.bestStreak!))
        : 0;
      const best = Number.isFinite(streak?.bestStreak)
        ? Math.max(0, Number(streak.bestStreak!))
        : longest;
      const totalDays = Number.isFinite(streak?.totalStudyDays)
        ? Math.max(0, Number(streak.totalStudyDays!))
        : 0;
      const safe: StudyStreak = {
        currentStreak: current,
        longestStreak: Math.max(longest, best),
        lastStudyDate: typeof streak?.lastStudyDate === 'string' ? streak.lastStudyDate : '',
        bestStreak: Math.max(best, longest),
        totalStudyDays: totalDays,
      };
      const jsonValue = JSON.stringify(safe);
      await AsyncStorage.setItem(STREAK_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save streak', e);
    }
  },

  async getAACCActivities(): Promise<AACCActivity[]> {
    try {
      const jsonValue = await AsyncStorage.getItem(AACC_KEY);
      return safeParseArray<AACCActivity>(jsonValue, []);
    } catch (e) {
      console.error('Failed to fetch AACC activities', e);
      return [];
    }
  },

  async saveAACCActivities(activities: AACCActivity[]): Promise<void> {
    try {
      const safeActivities = Array.isArray(activities) ? activities.filter(Boolean) : [];
      const jsonValue = JSON.stringify(safeActivities);
      await AsyncStorage.setItem(AACC_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save AACC activities', e);
    }
  },

  async getGroupProjects(): Promise<GroupProject[]> {
    try {
      const jsonValue = await AsyncStorage.getItem(GROUP_PROJECTS_KEY);
      const parsed = safeParseArray<GroupProject>(jsonValue, []);
      return parsed.map(p => ({
        ...p,
        members: Array.isArray(p.members) ? p.members.filter(Boolean) : [],
        tasks: Array.isArray(p.tasks) ? p.tasks.filter(Boolean) : []
      }));
    } catch (e) {
      console.error('Failed to fetch group projects', e);
      return [];
    }
  },

  async saveGroupProjects(projects: GroupProject[]): Promise<void> {
    try {
      const safeProjects = Array.isArray(projects) ? projects.filter(Boolean).map(p => ({
        ...p,
        members: Array.isArray(p.members) ? p.members.filter(Boolean) : [],
        tasks: Array.isArray(p.tasks) ? p.tasks.filter(Boolean) : []
      })) : [];
      const jsonValue = JSON.stringify(safeProjects);
      await AsyncStorage.setItem(GROUP_PROJECTS_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save group projects', e);
    }
  },

  async getGamificationData(): Promise<GamificationData> {
    try {
      const jsonValue = await AsyncStorage.getItem(GAMIFICATION_KEY);
      const parsed = safeParseObject<GamificationData>(jsonValue, DEFAULT_GAMIFICATION);
      return {
        xp: Number.isFinite(parsed.xp) ? Math.max(0, Number(parsed.xp)) : 0,
        level: Number.isFinite(parsed.level) ? Math.max(1, Number(parsed.level)) : 1,
        unlockedAchievements: Array.isArray(parsed.unlockedAchievements) ? parsed.unlockedAchievements.filter(Boolean) : [],
        totalFocusMinutes: Number.isFinite(parsed.totalFocusMinutes) ? Math.max(0, Number(parsed.totalFocusMinutes)) : 0,
      };
    } catch (e) {
      return DEFAULT_GAMIFICATION;
    }
  },

  async saveGamificationData(data: GamificationData): Promise<void> {
    try {
      const safe: GamificationData = {
        xp: Math.max(0, Number(data?.xp) || 0),
        level: Math.max(1, Number(data?.level) || 1),
        unlockedAchievements: Array.isArray(data?.unlockedAchievements) ? data.unlockedAchievements.filter(Boolean) : [],
        totalFocusMinutes: Math.max(0, Number(data?.totalFocusMinutes) || 0),
      };
      const jsonValue = JSON.stringify(safe);
      await AsyncStorage.setItem(GAMIFICATION_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save gamification data', e);
    }
  },

  async addXP(amount: number, additionalMinutes: number = 0): Promise<GamificationData> {
    try {
      const validAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
      const validMinutes = Number.isFinite(additionalMinutes) ? Math.max(0, additionalMinutes) : 0;
      const current = await this.getGamificationData();
      const newXP = (current.xp || 0) + validAmount;
      const newMinutes = (current.totalFocusMinutes || 0) + validMinutes;
      // Formula: Level = Math.floor(XP / 200) + 1
      const newLevel = Math.floor(newXP / 200) + 1;
      
      const updated: GamificationData = {
        ...current,
        xp: newXP,
        level: newLevel,
        totalFocusMinutes: newMinutes
      };
      await this.saveGamificationData(updated);
      return updated;
    } catch (e) {
      return DEFAULT_GAMIFICATION;
    }
  },

  async saveSecureSecret(key: string, value: string): Promise<void> {
    if (!key) return;
    try {
      if (!value || value.trim() === '') {
        await this.deleteSecureSecret(key);
        return;
      }
      inMemorySecureVault[key] = value;
      if (secureStoreModule && typeof secureStoreModule.setItemAsync === 'function') {
        await secureStoreModule.setItemAsync(key, value, {
          keychainAccessible: secureStoreModule.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
      }
    } catch (e) {
      inMemorySecureVault[key] = value;
    }
  },

  async getSecureSecret(key: string): Promise<string | null> {
    if (!key) return null;
    try {
      if (secureStoreModule && typeof secureStoreModule.getItemAsync === 'function') {
        const val = await secureStoreModule.getItemAsync(key);
        if (val !== null && val !== undefined) {
          inMemorySecureVault[key] = val;
          return val;
        }
      }
    } catch (e) {
      // Fallback to in-memory vault
    }
    return inMemorySecureVault[key] ?? null;
  },

  async deleteSecureSecret(key: string): Promise<void> {
    if (!key) return;
    delete inMemorySecureVault[key];
    try {
      if (secureStoreModule && typeof secureStoreModule.deleteItemAsync === 'function') {
        await secureStoreModule.deleteItemAsync(key);
      }
    } catch (e) {
      // Ignore fallback deletion error
    }
  },

  async getAIConfig(): Promise<AIConfig> {
    let secureApiKey: string | null = null;
    try {
      secureApiKey = await this.getSecureSecret(SECURE_AI_API_KEY);
    } catch {
      secureApiKey = null;
    }

    try {
      const jsonValue = await AsyncStorage.getItem(AI_CONFIG_KEY);
      const parsed = safeParseObject<Partial<AIConfig>>(jsonValue, {});
      const legacyApiKey = typeof parsed.apiKey === 'string' ? parsed.apiKey : '';

      // Backward compatibility migration: migrate plaintext key from AsyncStorage to SecureStore
      if (!secureApiKey && legacyApiKey && legacyApiKey.trim().length > 0) {
        await this.saveSecureSecret(SECURE_AI_API_KEY, legacyApiKey.trim());
        secureApiKey = legacyApiKey.trim();
        const sanitized = { ...parsed, apiKey: '' };
        await AsyncStorage.setItem(AI_CONFIG_KEY, JSON.stringify(sanitized)).catch(() => {});
      }

      return {
        provider: parsed.provider === 'openai' ? 'openai' : 'gemini',
        mode: parsed.mode || 'local_edge',
        apiKey: secureApiKey || '',
        model: parsed.model || 'gemini-1.5-flash',
        enableFallbackToCloud: parsed.enableFallbackToCloud !== false,
        localModelPath: parsed.localModelPath
      };
    } catch (e) {
      console.warn('Failed to fetch AI config from storage', e);
      return {
        provider: 'gemini',
        mode: 'local_edge',
        apiKey: secureApiKey || '',
        model: 'gemini-1.5-flash',
        enableFallbackToCloud: true
      };
    }
  },

  async saveAIConfig(config: AIConfig): Promise<void> {
    try {
      if (config.apiKey && config.apiKey.trim().length > 0) {
        await this.saveSecureSecret(SECURE_AI_API_KEY, config.apiKey.trim());
      } else {
        await this.deleteSecureSecret(SECURE_AI_API_KEY);
      }

      // Persist config without sensitive plaintext in unencrypted AsyncStorage
      const sanitizedConfig = {
        ...config,
        apiKey: ''
      };
      const jsonValue = JSON.stringify(sanitizedConfig);
      await AsyncStorage.setItem(AI_CONFIG_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save AI config to storage', e);
    }
  },

  /**
   * Export all user application data into a single structured JSON object
   */
  async exportBackup(): Promise<BackupData> {
    const [events, subjects, attendances, tasks, studySessions, semesters, settings, aaccActivities, groupProjects, gamification, streak] = await Promise.all([
      this.getEvents(),
      this.getSubjects(),
      this.getAttendances(),
      this.getTasks(),
      this.getStudySessions(),
      this.getSemesters(),
      this.getSettings(),
      this.getAACCActivities(),
      this.getGroupProjects(),
      this.getGamificationData(),
      this.getStreak(),
    ]);

    return {
      version: 2,
      timestamp: new Date().toISOString(),
      events,
      subjects,
      attendances,
      tasks,
      studySessions,
      semesters,
      settings,
      streak,
      aaccActivities,
      groupProjects,
      gamification,
    } as BackupData;
  },

  /**
   * Import and restore data from a valid BackupData object
   */
  async importBackup(backup: BackupData & { streak?: StudyStreak }): Promise<boolean> {
    if (!backup || typeof backup !== 'object') {
      throw new Error('Formato de backup inválido.');
    }

    try {
      if (Array.isArray(backup.events)) await this.saveEvents(backup.events);
      if (Array.isArray(backup.subjects)) await this.saveSubjects(backup.subjects);
      if (Array.isArray(backup.attendances)) await this.saveAttendances(backup.attendances);
      if (Array.isArray(backup.tasks)) await this.saveTasks(backup.tasks);
      if (Array.isArray(backup.studySessions)) await this.saveStudySessions(backup.studySessions);
      if (Array.isArray(backup.semesters)) await this.saveSemesters(backup.semesters);
      if (Array.isArray(backup.aaccActivities)) await this.saveAACCActivities(backup.aaccActivities);
      if (Array.isArray(backup.groupProjects)) await this.saveGroupProjects(backup.groupProjects);
      if (backup.gamification) await this.saveGamificationData(backup.gamification);
      if (backup.streak) await this.saveStreak(backup.streak);
      if (backup.settings) {
        await this.saveSettings({ ...DEFAULT_SETTINGS, ...backup.settings });
        if (backup.settings.theme) await this.saveTheme(backup.settings.theme);
      }
      return true;
    } catch (err) {
      console.error('Erro ao restaurar backup', err);
      throw err;
    }
  },

  /**
   * Clear all application data
   */
  async clearAllData(): Promise<void> {
    await this.deleteSecureSecret(SECURE_AI_API_KEY);
    Object.keys(inMemorySecureVault).forEach(k => delete inMemorySecureVault[k]);
    await AsyncStorage.multiRemove([
      EVENTS_KEY,
      THEME_KEY,
      SUBJECTS_KEY,
      ATTENDANCES_KEY,
      TASKS_KEY,
      STUDY_SESSIONS_KEY,
      SEMESTERS_KEY,
      SETTINGS_KEY,
      STREAK_KEY,
      TEAMS_CONFIG_KEY,
      AACC_KEY,
      GROUP_PROJECTS_KEY,
      GAMIFICATION_KEY,
      AI_CONFIG_KEY,
      '@organiza_local_ai_model_info',
    ]);
  }
};
