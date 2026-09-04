import { isValid, parseISO } from 'date-fns';
import { Subject, AppEvent, AttendanceRecord } from '../types';

export type AbsenceRiskLevel = 'safe' | 'warning' | 'danger';

export interface SubjectAbsenceSimulation {
  subjectId: string;
  subjectName: string;
  subjectColor?: string;
  currentAbsences: number;
  maxAbsences: number;
  projectedAbsences: number;
  currentPresenceRate: number;
  projectedPresenceRate: number;
  remainingAbsences: number;
  riskLevel: AbsenceRiskLevel;
  hasExamInSameWeek: boolean;
  examDetails?: string;
}

export interface DateAbsenceSimulationResult {
  date: string;
  dayOfWeekName: string;
  affectedSubjects: SubjectAbsenceSimulation[];
  overallVerdict: AbsenceRiskLevel;
}

const DAY_NAMES: readonly string[] = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado'
];

/**
 * Calculates absolute calendar day difference between two dates (YYYY-MM-DD or ISO).
 * Uses UTC date values to prevent daylight saving time / timezone shifts.
 * Returns 999 if either date string is invalid or unparseable.
 */
export function getDayDifference(dateA: string, dateB: string): number {
  if (!dateA || !dateB || typeof dateA !== 'string' || typeof dateB !== 'string') return 999;
  const cleanA = dateA.split('T')[0];
  const cleanB = dateB.split('T')[0];

  const parsedA = parseISO(cleanA);
  const parsedB = parseISO(cleanB);
  if (!isValid(parsedA) || !isValid(parsedB)) return 999;

  const [yA, mA, dA] = cleanA.split('-').map(Number);
  const [yB, mB, dB] = cleanB.split('-').map(Number);
  if (!yA || !mA || !dA || !yB || !mB || !dB) return 999;

  const utcA = Date.UTC(yA, mA - 1, dA);
  const utcB = Date.UTC(yB, mB - 1, dB);
  if (isNaN(utcA) || isNaN(utcB)) return 999;

  return Math.abs(Math.round((utcA - utcB) / (1000 * 60 * 60 * 24)));
}

/**
 * Returns localized Portuguese day-of-week name for a date string.
 * Returns 'Desconhecido' if the date is invalid or corrupt.
 */
export function getDayOfWeekName(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return 'Desconhecido';
  const clean = dateStr.split('T')[0];
  const parsed = parseISO(clean);
  if (!isValid(parsed)) return 'Desconhecido';

  const [y, m, d] = clean.split('-').map(Number);
  if (!y || !m || !d) return 'Desconhecido';

  const timeVal = Date.UTC(y, m - 1, d, 12, 0, 0);
  if (isNaN(timeVal)) return 'Desconhecido';

  const dayIndex = new Date(timeVal).getUTCDay();
  return DAY_NAMES[dayIndex] ?? 'Desconhecido';
}

/**
 * Identifies if an event is an exam or academic evaluation.
 */
export function isExamEvent(event: AppEvent): boolean {
  if (!event) return false;
  if (event.category === 'Provas/Trabalhos') return true;
  const title = (event.title || '').toLowerCase();
  const desc = (event.description || '').toLowerCase();
  const cat = (event.category || '').toLowerCase();
  return title.includes('prova') || desc.includes('prova') || cat.includes('prova');
}

/**
 * Checks if there is an exam event for the specified subject within a tolerance window (default ±3 days).
 */
export function findExamsNearDate(
  subjectId: string,
  targetDateStr: string,
  events: AppEvent[],
  toleranceDays: number = 3
): { hasExam: boolean; examDetails?: string } {
  if (!subjectId || !targetDateStr || typeof targetDateStr !== 'string' || !Array.isArray(events)) {
    return { hasExam: false };
  }

  const cleanTarget = targetDateStr.split('T')[0];
  const parsedTarget = parseISO(cleanTarget);
  if (!isValid(parsedTarget)) {
    return { hasExam: false };
  }

  const safeEvents = events.filter((e): e is AppEvent => Boolean(e && typeof e === 'object'));

  const subjectExams = safeEvents.filter(e => {
    if (!isExamEvent(e)) return false;
    return e.subjectId === subjectId;
  });

  for (const exam of subjectExams) {
    if (!exam.date || typeof exam.date !== 'string') continue;
    const cleanExamDate = exam.date.split('T')[0];
    const parsedExam = parseISO(cleanExamDate);
    if (!isValid(parsedExam)) continue;

    const diffDays = getDayDifference(cleanTarget, cleanExamDate);

    if (diffDays <= toleranceDays) {
      let relativeText = '';
      if (diffDays === 0) {
        relativeText = 'no mesmo dia';
      } else {
        const isAfter = cleanExamDate > cleanTarget;
        relativeText = isAfter ? `${diffDays} dia(s) depois` : `${diffDays} dia(s) antes`;
      }
      const title = exam.title || 'Prova';
      return {
        hasExam: true,
        examDetails: `${title} (${cleanExamDate}, ${relativeText})`
      };
    }
  }

  return { hasExam: false };
}

/**
 * Simulates the impact of additional absences on a specific subject.
 * Guaranteed immune to division-by-zero, negative or corrupt values.
 */
export function simulateSubjectAbsences(
  subject: Subject,
  additionalAbsences: number,
  attendances: AttendanceRecord[],
  events?: AppEvent[],
  targetDateStr?: string
): SubjectAbsenceSimulation {
  if (!subject || typeof subject !== 'object') {
    return {
      subjectId: '',
      subjectName: 'Desconhecida',
      currentAbsences: 0,
      maxAbsences: 15,
      projectedAbsences: 0,
      currentPresenceRate: 100,
      projectedPresenceRate: 100,
      remainingAbsences: 15,
      riskLevel: 'safe',
      hasExamInSameWeek: false
    };
  }

  const safeAttendances = Array.isArray(attendances)
    ? attendances.filter((a): a is AttendanceRecord => Boolean(a && typeof a === 'object' && a.subjectId === subject.id))
    : [];

  const currentAbsences = safeAttendances.filter(a => a.status === 'absent').length;
  const currentPresences = safeAttendances.filter(a => a.status === 'present').length;

  // Safe max absences fallback (default 15 or 25% of workload, never <= 0)
  let calculatedMax = typeof subject.maxAbsences === 'number' && !isNaN(subject.maxAbsences) && subject.maxAbsences > 0
    ? subject.maxAbsences
    : (subject.workloadHours && subject.workloadHours > 0 ? Math.floor(subject.workloadHours * 0.25) : 15);

  if (!calculatedMax || calculatedMax <= 0) {
    calculatedMax = subject.workloadHours && subject.workloadHours > 0
      ? Math.max(1, Math.floor(subject.workloadHours * 0.25))
      : 15;
  }
  const maxAbsences = Math.max(1, calculatedMax);

  const safeAdditional = Math.max(0, additionalAbsences || 0);
  const projectedAbsences = currentAbsences + safeAdditional;
  const remainingAbsences = Math.max(0, maxAbsences - projectedAbsences);

  const currentTotal = currentAbsences + currentPresences;
  const currentPresenceRate = currentTotal <= 0
    ? 100.0
    : Number(((currentPresences / currentTotal) * 100).toFixed(1));

  const projectedTotal = projectedAbsences + currentPresences;
  const projectedPresenceRate = projectedTotal <= 0
    ? 100.0
    : Number(((currentPresences / projectedTotal) * 100).toFixed(1));

  // Check for exams in the same week (±3 days)
  let hasExamInSameWeek = false;
  let examDetails: string | undefined = undefined;

  if (events && targetDateStr && typeof targetDateStr === 'string') {
    const examCheck = findExamsNearDate(subject.id, targetDateStr, events, 3);
    hasExamInSameWeek = examCheck.hasExam;
    examDetails = examCheck.examDetails;
  }

  // Calculate Risk Level (guarded against division by zero)
  const absenceRatio = maxAbsences > 0 ? projectedAbsences / maxAbsences : 0;
  let riskLevel: AbsenceRiskLevel = 'safe';

  const isLowPresenceRate = currentPresences > 0 && currentTotal >= 8 && projectedPresenceRate < 75;
  const isWarningPresenceRate = currentPresences > 0 && currentTotal >= 8 && projectedPresenceRate < 80;

  if (projectedAbsences >= maxAbsences || absenceRatio >= 0.8 || isLowPresenceRate) {
    riskLevel = 'danger';
  } else if (absenceRatio >= 0.5 || isWarningPresenceRate) {
    riskLevel = 'warning';
  } else {
    riskLevel = 'safe';
  }

  // Elevate risk level when there is an exam in the same week
  if (hasExamInSameWeek) {
    if (riskLevel === 'safe') {
      riskLevel = 'warning';
    } else if (riskLevel === 'warning') {
      riskLevel = 'danger';
    }
  }

  return {
    subjectId: subject.id,
    subjectName: subject.name,
    subjectColor: subject.color,
    currentAbsences,
    maxAbsences,
    projectedAbsences,
    currentPresenceRate,
    projectedPresenceRate,
    remainingAbsences,
    riskLevel,
    hasExamInSameWeek,
    examDetails
  };
}

/**
 * Simulates absence impact for a given date across all scheduled classes and detects exam conflicts.
 */
export function simulateAbsenceForDate(
  dateStr: string,
  subjects: Subject[],
  events: AppEvent[],
  attendances: AttendanceRecord[]
): DateAbsenceSimulationResult {
  if (!dateStr || typeof dateStr !== 'string') {
    return {
      date: '',
      dayOfWeekName: 'Desconhecido',
      affectedSubjects: [],
      overallVerdict: 'safe'
    };
  }

  const cleanDate = dateStr.split('T')[0];
  const parsedDate = parseISO(cleanDate);
  if (!isValid(parsedDate)) {
    return {
      date: cleanDate,
      dayOfWeekName: 'Desconhecido',
      affectedSubjects: [],
      overallVerdict: 'safe'
    };
  }

  const dayOfWeekName = getDayOfWeekName(cleanDate);

  const safeSubjects = Array.isArray(subjects) ? subjects.filter((s): s is Subject => Boolean(s && typeof s === 'object')) : [];
  const safeEvents = Array.isArray(events) ? events.filter((e): e is AppEvent => Boolean(e && typeof e === 'object')) : [];
  const safeAttendances = Array.isArray(attendances) ? attendances.filter((a): a is AttendanceRecord => Boolean(a && typeof a === 'object')) : [];

  const [y, m, d] = cleanDate.split('-').map(Number);
  if (!y || !m || !d) {
    return {
      date: cleanDate,
      dayOfWeekName,
      affectedSubjects: [],
      overallVerdict: 'safe'
    };
  }

  const timeVal = Date.UTC(y, m - 1, d, 12, 0, 0);
  if (isNaN(timeVal)) {
    return {
      date: cleanDate,
      dayOfWeekName,
      affectedSubjects: [],
      overallVerdict: 'safe'
    };
  }
  const targetDayOfWeek = new Date(timeVal).getUTCDay();

  // Find classes occurring on the simulated date
  const scheduledClasses = safeEvents.filter(e => {
    if (!e || !e.subjectId) return false;

    // Skip classes that were explicitly cancelled for this date
    const isCancelled = safeAttendances.some(
      a => a.eventId === e.id && a.date === cleanDate && a.status === 'cancelled'
    );
    if (isCancelled) return false;

    const isClassOrExam = e.category === 'Faculdade/Aulas' ||
      e.category === 'Provas/Trabalhos' ||
      (e.title && e.title.toLowerCase().includes('aula'));
    if (!isClassOrExam) return false;

    if (e.recurrence === 'weekly') {
      const eventStartClean = (e.date || '').split('T')[0];
      if (eventStartClean) {
        const parsedStart = parseISO(eventStartClean);
        if (isValid(parsedStart) && cleanDate < eventStartClean) return false;
      }

      if (Array.isArray(e.recurrenceDays) && e.recurrenceDays.length > 0) {
        return e.recurrenceDays.includes(targetDayOfWeek);
      }

      if (eventStartClean) {
        const parsedStart = parseISO(eventStartClean);
        if (!isValid(parsedStart)) return false;
        const [ey, em, ed] = eventStartClean.split('-').map(Number);
        if (!ey || !em || !ed) return false;
        const startTime = Date.UTC(ey, em - 1, ed, 12, 0, 0);
        if (isNaN(startTime)) return false;
        const eventDayOfWeek = new Date(startTime).getUTCDay();
        return eventDayOfWeek === targetDayOfWeek;
      }
      return false;
    }

    if (e.recurrence === 'daily') {
      const eventStartClean = (e.date || '').split('T')[0];
      return !eventStartClean || cleanDate >= eventStartClean;
    }

    // Single occurrence
    const eventDateClean = (e.date || '').split('T')[0];
    return eventDateClean === cleanDate;
  });

  // Group by subjectId
  const subjectClassCountMap = new Map<string, number>();
  for (const c of scheduledClasses) {
    if (c.subjectId) {
      const current = subjectClassCountMap.get(c.subjectId) || 0;
      subjectClassCountMap.set(c.subjectId, current + 1);
    }
  }

  const affectedSubjects: SubjectAbsenceSimulation[] = [];

  for (const [subjId, count] of subjectClassCountMap.entries()) {
    const subject = safeSubjects.find(s => s.id === subjId);
    if (!subject || subject.isArchived) continue;

    const simulation = simulateSubjectAbsences(
      subject,
      count,
      safeAttendances,
      safeEvents,
      cleanDate
    );
    affectedSubjects.push(simulation);
  }

  // Sort affected subjects by risk severity
  const priorityMap: Record<AbsenceRiskLevel, number> = {
    danger: 3,
    warning: 2,
    safe: 1
  };
  affectedSubjects.sort((a, b) => priorityMap[b.riskLevel] - priorityMap[a.riskLevel]);

  let overallVerdict: AbsenceRiskLevel = 'safe';
  if (affectedSubjects.some(s => s.riskLevel === 'danger')) {
    overallVerdict = 'danger';
  } else if (affectedSubjects.some(s => s.riskLevel === 'warning')) {
    overallVerdict = 'warning';
  }

  return {
    date: cleanDate,
    dayOfWeekName,
    affectedSubjects,
    overallVerdict
  };
}
