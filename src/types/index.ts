export type EventCategory = 'Saúde/Academia' | 'Faculdade/Aulas' | 'Provas/Trabalhos' | 'Lazer' | 'Outros';

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

export interface GradeItem {
  id: string;
  name: string; // e.g., 'P1', 'Trabalho 1'
  weight: number; // e.g., 1
  grade?: number; // Resulting grade
  maxGrade: number; // e.g., 10
  eventId?: string; // Link to an AppEvent (exam)
}

export interface GradeGroup {
  id: string;
  name: string; // e.g., 'Média das Provas', 'Seminários'
  weight: number; // Weight of this group in the final grade
  items: GradeItem[];
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

export type AttendanceStatus = 'present' | 'absent' | 'pending';

export interface AttendanceRecord {
  id: string;
  subjectId: string;
  date: string; // YYYY-MM-DD
  eventId: string; // Link to the specific weekly class AppEvent
  status: AttendanceStatus;
}

export type ThemeType = 'dark' | 'light';
