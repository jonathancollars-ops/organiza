import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppEvent,
  ThemeType,
  Subject,
  AttendanceRecord,
  StudyTask,
  StudySession,
  TeamsConfig,
  AIConfig,
  Semester,
  AppSettings,
  StudyStreak,
  BackupData,
  AACCActivity,
  GroupProject,
  GamificationData
} from '../types';

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
const AACC_KEY = '@organiza_aacc';
const GROUP_PROJECTS_KEY = '@organiza_group_projects';
const GAMIFICATION_KEY = '@organiza_gamification';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  pomodoroFocusMin: 25,
  pomodoroBreakMin: 5,
  pomodoroLongBreakMin: 15,
  defaultPassGrade: 7.0,
  examWeekMode: false,
  soundEnabled: true,
  hapticsEnabled: true,
};

const DEFAULT_GAMIFICATION: GamificationData = {
  xp: 0,
  level: 1,
  unlockedAchievements: [],
  totalFocusMinutes: 0
};

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
      const jsonValue = await AsyncStorage.getItem(ATTENDANCES_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (e) {
      console.error('Failed to fetch attendances', e);
      return [];
    }
  },

  async saveAttendances(records: AttendanceRecord[]): Promise<void> {
    try {
      const jsonValue = JSON.stringify(records);
      await AsyncStorage.setItem(ATTENDANCES_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save attendances', e);
    }
  },

  async getTasks(): Promise<StudyTask[]> {
    try {
      const jsonValue = await AsyncStorage.getItem(TASKS_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (e) {
      console.error('Failed to fetch tasks', e);
      return [];
    }
  },

  async saveTasks(tasks: StudyTask[]): Promise<void> {
    try {
      const jsonValue = JSON.stringify(tasks);
      await AsyncStorage.setItem(TASKS_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save tasks', e);
    }
  },

  async getStudySessions(): Promise<StudySession[]> {
    try {
      const jsonValue = await AsyncStorage.getItem(STUDY_SESSIONS_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (e) {
      console.error('Failed to fetch study sessions', e);
      return [];
    }
  },

  async saveStudySessions(sessions: StudySession[]): Promise<void> {
    try {
      const jsonValue = JSON.stringify(sessions);
      await AsyncStorage.setItem(STUDY_SESSIONS_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save study sessions', e);
    }
  },

  async getSemesters(): Promise<Semester[]> {
    try {
      const jsonValue = await AsyncStorage.getItem(SEMESTERS_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (e) {
      console.error('Failed to fetch semesters from storage', e);
      return [];
    }
  },

  async saveSemesters(semesters: Semester[]): Promise<void> {
    try {
      const jsonValue = JSON.stringify(semesters);
      await AsyncStorage.setItem(SEMESTERS_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save semesters', e);
    }
  },

  async getSettings(): Promise<AppSettings> {
    try {
      const jsonValue = await AsyncStorage.getItem(SETTINGS_KEY);
      if (jsonValue) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(jsonValue) };
      }
      return DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    try {
      const jsonValue = JSON.stringify(settings);
      await AsyncStorage.setItem(SETTINGS_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  },

  async getStreak(): Promise<StudyStreak> {
    try {
      const jsonValue = await AsyncStorage.getItem(STREAK_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : { currentStreak: 0, longestStreak: 0, lastStudyDate: '' };
    } catch (e) {
      return { currentStreak: 0, longestStreak: 0, lastStudyDate: '' };
    }
  },

  async saveStreak(streak: StudyStreak): Promise<void> {
    try {
      const jsonValue = JSON.stringify(streak);
      await AsyncStorage.setItem(STREAK_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save streak', e);
    }
  },

  async getAACCActivities(): Promise<AACCActivity[]> {
    try {
      const jsonValue = await AsyncStorage.getItem(AACC_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (e) {
      console.error('Failed to fetch AACC activities', e);
      return [];
    }
  },

  async saveAACCActivities(activities: AACCActivity[]): Promise<void> {
    try {
      const jsonValue = JSON.stringify(activities);
      await AsyncStorage.setItem(AACC_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save AACC activities', e);
    }
  },

  async getGroupProjects(): Promise<GroupProject[]> {
    try {
      const jsonValue = await AsyncStorage.getItem(GROUP_PROJECTS_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (e) {
      console.error('Failed to fetch group projects', e);
      return [];
    }
  },

  async saveGroupProjects(projects: GroupProject[]): Promise<void> {
    try {
      const jsonValue = JSON.stringify(projects);
      await AsyncStorage.setItem(GROUP_PROJECTS_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save group projects', e);
    }
  },

  async getGamificationData(): Promise<GamificationData> {
    try {
      const jsonValue = await AsyncStorage.getItem(GAMIFICATION_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : DEFAULT_GAMIFICATION;
    } catch (e) {
      return DEFAULT_GAMIFICATION;
    }
  },

  async saveGamificationData(data: GamificationData): Promise<void> {
    try {
      const jsonValue = JSON.stringify(data);
      await AsyncStorage.setItem(GAMIFICATION_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save gamification data', e);
    }
  },

  async addXP(amount: number, additionalMinutes: number = 0): Promise<GamificationData> {
    try {
      const current = await this.getGamificationData();
      const newXP = (current.xp || 0) + amount;
      const newMinutes = (current.totalFocusMinutes || 0) + additionalMinutes;
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

  async getTeamsConfig(): Promise<TeamsConfig | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(TEAMS_CONFIG_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (e) {
      console.error('Failed to fetch teams config from storage', e);
      return null;
    }
  },

  async saveTeamsConfig(config: TeamsConfig): Promise<void> {
    try {
      const jsonValue = JSON.stringify(config);
      await AsyncStorage.setItem(TEAMS_CONFIG_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save teams config to storage', e);
    }
  },

  async getAIConfig(): Promise<AIConfig | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(AI_CONFIG_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (e) {
      console.error('Failed to fetch AI config from storage', e);
      return null;
    }
  },

  async saveAIConfig(config: AIConfig): Promise<void> {
    try {
      const jsonValue = JSON.stringify(config);
      await AsyncStorage.setItem(AI_CONFIG_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save AI config to storage', e);
    }
  },

  /**
   * Export all user application data into a single structured JSON object
   */
  async exportBackup(): Promise<BackupData> {
    const [events, subjects, attendances, tasks, studySessions, semesters, settings, aaccActivities, groupProjects, gamification] = await Promise.all([
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
      aaccActivities,
      groupProjects,
      gamification,
    };
  },

  /**
   * Import and restore data from a valid BackupData object
   */
  async importBackup(backup: BackupData): Promise<boolean> {
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
    await AsyncStorage.multiRemove([
      EVENTS_KEY,
      SUBJECTS_KEY,
      ATTENDANCES_KEY,
      TASKS_KEY,
      STUDY_SESSIONS_KEY,
      SEMESTERS_KEY,
      SETTINGS_KEY,
      STREAK_KEY,
      AACC_KEY,
      GROUP_PROJECTS_KEY,
      GAMIFICATION_KEY,
    ]);
  }
};

