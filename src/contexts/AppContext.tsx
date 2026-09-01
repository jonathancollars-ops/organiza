import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as Haptics from 'expo-haptics';
import { StorageService } from '../services/storage';
import { AttendanceService } from '../services/AttendanceService';
import { NotificationService } from '../services/notifications';
import { 
  AppEvent, 
  ThemeType, 
  Subject, 
  AttendanceRecord, 
  StudyTask, 
  StudySession, 
  StudyStreak, 
  Semester, 
  AppSettings, 
  GamificationData, 
  AIConfig 
} from '../types';

export interface AppContextData {
  // Theme & Settings
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  aiConfig: AIConfig;
  setAiConfig: React.Dispatch<React.SetStateAction<AIConfig>>;
  
  // Data State
  events: AppEvent[];
  setEvents: React.Dispatch<React.SetStateAction<AppEvent[]>>;
  subjects: Subject[];
  setSubjects: React.Dispatch<React.SetStateAction<Subject[]>>;
  attendances: AttendanceRecord[];
  setAttendances: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  tasks: StudyTask[];
  setTasks: React.Dispatch<React.SetStateAction<StudyTask[]>>;
  studySessions: StudySession[];
  setStudySessions: React.Dispatch<React.SetStateAction<StudySession[]>>;
  streak: StudyStreak;
  setStreak: React.Dispatch<React.SetStateAction<StudyStreak>>;
  semesters: Semester[];
  setSemesters: React.Dispatch<React.SetStateAction<Semester[]>>;
  gamification: GamificationData | null;
  setGamification: React.Dispatch<React.SetStateAction<GamificationData | null>>;
  
  // App Lifecycle
  isInitializing: boolean;
  refreshData: () => Promise<void>;
  handleThemeToggle: () => Promise<void>;
  
  // Actions
  toggleEventCompletion: (eventId: string) => Promise<void>;
  toggleTaskCompletion: (taskId: string) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  updateAttendance: (record: AttendanceRecord) => Promise<void>;
  archiveSubject: (subjectId: string) => Promise<void>;
  addOrUpdateSubject: (subject: Subject) => Promise<void>;
  addOrUpdateEvent: (event: AppEvent) => Promise<void>;
}

const AppContext = createContext<AppContextData | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Theme & Settings State
  const [theme, setTheme] = useState<ThemeType>('dark');
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark',
    fullscreen: false,
    pomodoroFocusMin: 25,
    pomodoroBreakMin: 5,
    pomodoroLongBreakMin: 15,
    defaultPassGrade: 7.0,
    examWeekMode: false,
    soundEnabled: true,
    hapticsEnabled: true,
  });
  const [aiConfig, setAiConfig] = useState<AIConfig>({ provider: 'gemini', mode: 'gemini_cloud', apiKey: '' });
  
  // Data State
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [streak, setStreak] = useState<StudyStreak>({ currentStreak: 0, longestStreak: 0, lastStudyDate: '' });
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [gamification, setGamification] = useState<GamificationData | null>(null);
  
  // App Lifecycle
  const [isInitializing, setIsInitializing] = useState(true);

  const loadData = async () => {
    try {
      const [
        savedTheme,
        savedEvents,
        savedSubjects,
        savedAttendances,
        savedTasks,
        savedSessions,
        savedSemesters,
        savedSettings,
        savedGamification,
        savedStreak
      ] = await Promise.all([
        StorageService.getTheme().catch(() => 'dark' as ThemeType),
        StorageService.getEvents().catch(() => [] as AppEvent[]),
        StorageService.getSubjects().catch(() => [] as Subject[]),
        StorageService.getAttendances().catch(() => [] as AttendanceRecord[]),
        StorageService.getTasks().catch(() => [] as StudyTask[]),
        StorageService.getStudySessions().catch(() => [] as StudySession[]),
        StorageService.getSemesters().catch(() => [] as Semester[]),
        StorageService.getSettings().catch(() => null),
        StorageService.getGamificationData().catch(() => null),
        StorageService.getStreak().catch(() => null),
      ]);

      // Sanitize array collections
      const safeEvents = Array.isArray(savedEvents) ? savedEvents.filter((e): e is AppEvent => Boolean(e && typeof e === 'object')) : [];
      const safeSubjects = Array.isArray(savedSubjects) ? savedSubjects.filter((s): s is Subject => Boolean(s && typeof s === 'object')) : [];
      const safeAttendances = Array.isArray(savedAttendances) ? savedAttendances.filter((a): a is AttendanceRecord => Boolean(a && typeof a === 'object')) : [];
      const safeTasks = Array.isArray(savedTasks) ? savedTasks.filter((t): t is StudyTask => Boolean(t && typeof t === 'object')) : [];
      const safeSessions = Array.isArray(savedSessions) ? savedSessions.filter((ss): ss is StudySession => Boolean(ss && typeof ss === 'object')) : [];
      const safeSemesters = Array.isArray(savedSemesters) ? savedSemesters.filter((sem): sem is Semester => Boolean(sem && typeof sem === 'object')) : [];

      // Check for pending attendances safely
      let updatedAttendances = safeAttendances;
      try {
        updatedAttendances = await AttendanceService.generatePendingAttendances(safeEvents, safeAttendances);
      } catch (attError) {
        console.warn('AppContext: Attendance calculation error in loadData:', attError);
      }

      // Sanitize theme
      const safeTheme: ThemeType = savedTheme === 'light' || savedTheme === 'amoled' || savedTheme === 'dark' ? savedTheme : 'dark';

      // Sanitize settings
      const safeSettings: AppSettings = (savedSettings && typeof savedSettings === 'object' && !Array.isArray(savedSettings))
        ? {
            theme: (savedSettings.theme === 'light' || savedSettings.theme === 'amoled' || savedSettings.theme === 'dark') ? savedSettings.theme : safeTheme,
            fullscreen: Boolean(savedSettings.fullscreen),
            pomodoroFocusMin: Number(savedSettings.pomodoroFocusMin) || 25,
            pomodoroBreakMin: Number(savedSettings.pomodoroBreakMin) || 5,
            pomodoroLongBreakMin: Number(savedSettings.pomodoroLongBreakMin) || 15,
            defaultPassGrade: typeof savedSettings.defaultPassGrade === 'number' && !isNaN(savedSettings.defaultPassGrade) ? savedSettings.defaultPassGrade : 7.0,
            examWeekMode: Boolean(savedSettings.examWeekMode),
            soundEnabled: savedSettings.soundEnabled !== false,
            hapticsEnabled: savedSettings.hapticsEnabled !== false,
          }
        : { theme: safeTheme, fullscreen: false, pomodoroFocusMin: 25, pomodoroBreakMin: 5, pomodoroLongBreakMin: 15, defaultPassGrade: 7.0, examWeekMode: false, soundEnabled: true, hapticsEnabled: true };

      // Sanitize gamification
      const safeGamification: GamificationData = (savedGamification && typeof savedGamification === 'object' && !Array.isArray(savedGamification))
        ? {
            xp: Number(savedGamification.xp) || 0,
            level: Number(savedGamification.level) || 1,
            unlockedAchievements: Array.isArray(savedGamification.unlockedAchievements) ? savedGamification.unlockedAchievements : [],
            totalFocusMinutes: Number(savedGamification.totalFocusMinutes) || 0,
          }
        : { xp: 0, level: 1, unlockedAchievements: [], totalFocusMinutes: 0 };

      // Sanitize study streak
      const safeStreak: StudyStreak = (savedStreak && typeof savedStreak === 'object' && !Array.isArray(savedStreak))
        ? {
            currentStreak: Number(savedStreak.currentStreak) || 0,
            longestStreak: Number(savedStreak.longestStreak) || 0,
            lastStudyDate: typeof savedStreak.lastStudyDate === 'string' ? savedStreak.lastStudyDate : '',
          }
        : { currentStreak: 0, longestStreak: 0, lastStudyDate: '' };

      setTheme(safeTheme);
      setEvents(safeEvents);
      setSubjects(safeSubjects);
      setAttendances(Array.isArray(updatedAttendances) ? updatedAttendances : safeAttendances);
      setTasks(safeTasks);
      setStudySessions(safeSessions);
      setSemesters(safeSemesters);
      setSettings(safeSettings);
      setGamification(safeGamification);
      setStreak(safeStreak);
    } catch (err) {
      console.error('Error loading app data in AppContext:', err);
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    // Carrega dados de forma assíncrona na montagem, não travando a thread principal.
    loadData();
  }, []);

  const handleThemeToggle = async () => {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const nextTheme: ThemeType = theme === 'dark' ? 'amoled' : theme === 'amoled' ? 'light' : 'dark';
    setTheme(nextTheme);
    await StorageService.saveTheme(nextTheme);
    const updatedSettings = { ...settings, theme: nextTheme };
    setSettings(updatedSettings);
    await StorageService.saveSettings(updatedSettings);
  };

  const toggleEventCompletion = async (eventId: string) => {
    const updatedEvents = events.map(e => e.id === eventId ? { ...e, isCompleted: !e.isCompleted } : e);
    setEvents(updatedEvents);
    await StorageService.saveEvents(updatedEvents);
  };

  const toggleTaskCompletion = async (taskId: string) => {
    const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t);
    setTasks(updatedTasks);
    await StorageService.saveTasks(updatedTasks);
  };

  const deleteEvent = async (eventId: string) => {
    const updatedEvents = events.filter(e => e.id !== eventId);
    setEvents(updatedEvents);
    await StorageService.saveEvents(updatedEvents);
    await NotificationService.cancelEventNotifications(eventId);
  };

  const updateAttendance = async (record: AttendanceRecord) => {
    const exists = attendances.find(a => a.id === record.id);
    const updated = exists 
      ? attendances.map(a => a.id === record.id ? record : a)
      : [...attendances, record];
    setAttendances(updated);
    await StorageService.saveAttendances(updated);
  };

  const archiveSubject = async (subjectId: string) => {
    const updated = subjects.map(s => s.id === subjectId ? { ...s, isArchived: true } : s);
    setSubjects(updated);
    await StorageService.saveSubjects(updated);
  };

  const addOrUpdateSubject = async (subject: Subject) => {
    const exists = subjects.find(s => s.id === subject.id);
    const updated = exists 
      ? subjects.map(s => s.id === subject.id ? subject : s)
      : [...subjects, subject];
    setSubjects(updated);
    await StorageService.saveSubjects(updated);
  };

  const addOrUpdateEvent = async (event: AppEvent) => {
    const exists = events.find(e => e.id === event.id);
    const updated = exists
      ? events.map(e => e.id === event.id ? event : e)
      : [...events, event];
    setEvents(updated);
    await StorageService.saveEvents(updated);
  };

  const value: AppContextData = {
    theme, setTheme,
    settings, setSettings,
    aiConfig, setAiConfig,
    events, setEvents,
    subjects, setSubjects,
    attendances, setAttendances,
    tasks, setTasks,
    studySessions, setStudySessions,
    streak, setStreak,
    semesters, setSemesters,
    gamification, setGamification,
    isInitializing,
    refreshData: loadData,
    handleThemeToggle,
    toggleEventCompletion,
    toggleTaskCompletion,
    deleteEvent,
    updateAttendance,
    archiveSubject,
    addOrUpdateSubject,
    addOrUpdateEvent
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextData => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
