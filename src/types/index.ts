export type EventCategory = 'Saúde/Academia' | 'Faculdade/Aulas' | 'Provas/Trabalhos' | 'Lazer' | 'Outros';

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

export interface GradeItem {
  id: string;
  name: string; // e.g., 'P1', 'Trabalho 1'
  weight: number; // e.g., 1
  grade?: number; // Resulting grade
  maxGrade: number; // e.g., 10
  eventId?: string; // Link to an AppEvent (exam)
  isFinalExam?: boolean; // Se for prova final, a regra de cálculo muda
}

export interface GradeGroup {
  id: string;
  name: string; // e.g., 'Média das Provas', 'Seminários'
  weight: number; // Weight of this group in the final grade
  items: GradeItem[];
}

export interface Semester {
  id: string;
  name: string; // e.g. "2026.1", "2026.2"
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  isCurrent?: boolean;
  isArchived?: boolean;
}

export interface Subject {
  id: string;
  name: string;
  color?: string;
  passGrade?: number; // ex: 7.0
  maxAbsences?: number; // ex: 15 (Calculated from workload)
  workloadHours?: number; // ex: 60h
  gradeGroups?: GradeGroup[];
  isArchived?: boolean; // If true, events are hidden from the calendar
  semesterId?: string; // Link to a Semester
  notes?: string;
}

export interface AppEvent {
  id: string;
  title: string;
  description?: string;
  category: EventCategory;
  date: string; // ISO string for the specific date or start date
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  recurrence: RecurrenceType;
  recurrenceDays?: number[]; // 0 = Sunday, 1 = Monday, etc. Used for weekly.
  alerts: number[]; // Array of minutes before the event to notify (e.g. [60, 1440])
  isCompleted: boolean; // For the habit tracking
  isImportant?: boolean; // Highlighted below the calendar
  isNotified?: boolean; // Default true, allows disabling notifications
  completedDates?: string[]; // Array of ISO date strings for recurring events check-ins
  subjectId?: string; // Link to a Subject if it's an exam or class
  
  // Grade Engine
  weight?: number; // Weight in the weighted average
  grade?: number; // Grade obtained (null/undefined if not taken yet)
  maxGrade?: number; // Maximum possible grade (default 10)
  isExtraPoint?: boolean; // If true, adds directly to final grade instead of average
}

export type AttendanceStatus = 'present' | 'absent' | 'pending' | 'cancelled';

export interface AttendanceRecord {
  id: string;
  subjectId: string;
  date: string; // YYYY-MM-DD
  eventId: string; // Link to the specific weekly class AppEvent
  status: AttendanceStatus;
}

export type ThemeType = 'dark' | 'light' | 'amoled';

export interface StudyTask {
  id: string;
  title: string;
  isCompleted: boolean;
  subjectId?: string; // Optional: linked to a specific subject
  dueDate?: string; // Optional: YYYY-MM-DD
  priority?: 'low' | 'medium' | 'high';
}

export interface StudySession {
  id: string;
  subjectId: string;
  durationMs: number; // Time studied in milliseconds
  date: string; // YYYY-MM-DD
}

export interface StudyStreak {
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: string; // YYYY-MM-DD
}

export interface AppSettings {
  theme: ThemeType;
  pomodoroFocusMin: number; // Default 25
  pomodoroBreakMin: number; // Default 5
  pomodoroLongBreakMin: number; // Default 15
  defaultPassGrade: number; // Default 7.0
  examWeekMode: boolean; // Default false
  soundEnabled: boolean; // Default true
  hapticsEnabled: boolean; // Default true
  currentSemesterId?: string;
}

export interface AACCActivity {
  id: string;
  title: string;
  category: 'Ensino' | 'Pesquisa' | 'Extensão' | 'Outros';
  hours: number;
  date: string; // YYYY-MM-DD
  institution?: string;
  notes?: string;
}

export interface GroupTask {
  id: string;
  title: string;
  assignedTo: string;
  status: 'todo' | 'doing' | 'done';
  dueDate?: string; // YYYY-MM-DD
}

export interface GroupProject {
  id: string;
  subjectId: string;
  title: string;
  deadline: string; // YYYY-MM-DD
  members: string[];
  tasks: GroupTask[];
  description?: string;
}

export interface GamificationData {
  xp: number;
  level: number;
  unlockedAchievements: string[];
  totalFocusMinutes: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  xp: number;
  unlocked: boolean;
  progress?: { current: number; total: number };
}

export interface BackupData {
  version: number;
  timestamp: string;
  events: AppEvent[];
  subjects: Subject[];
  attendances: AttendanceRecord[];
  tasks: StudyTask[];
  studySessions: StudySession[];
  semesters: Semester[];
  settings?: Partial<AppSettings>;
  aaccActivities?: AACCActivity[];
  groupProjects?: GroupProject[];
  gamification?: GamificationData;
}

// ==========================================
// Microsoft Teams & AI Integration Types
// ==========================================

export interface TeamsConfig {
  clientId: string;
  tenantId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  selectedTeamId?: string;
  selectedChannelId?: string;
  isConnected: boolean;
  lastSync?: string;
}

export type AIProvider = 'gemini' | 'openai';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

export type AIIntent = 'cancelled_class' | 'homework' | 'exam' | 'none';

export interface AIParsedItem {
  intent: AIIntent;
  subjectName: string;
  title: string;
  description?: string;
  targetDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  alerts: number[]; // e.g. [10080, 1440]
  rawSummary: string;
}

export interface AIParsingResult {
  items: AIParsedItem[];
  confidence: number;
  rawResponse?: string;
}

export interface SyncResult {
  cancelledAttendances: AttendanceRecord[];
  createdEvents: AppEvent[];
  updatedEvents: AppEvent[];
  logs: string[];
}

export interface TeamsMessageSender {
  displayName?: string;
  id?: string;
}

export interface TeamsMessageBody {
  content: string;
  contentType?: 'html' | 'text' | string;
}

export interface TeamsMessage {
  id: string;
  createdDateTime: string;
  subject?: string;
  body: TeamsMessageBody | string;
  from?: {
    user?: TeamsMessageSender;
  };
  senderName?: string;
  cleanText?: string;
  rawHtml?: string;
}

