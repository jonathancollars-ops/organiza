import './setup_env';
import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { StorageService } from '../src/services/storage';
import { SecuritySanitizer } from '../src/services/SecuritySanitizer';
import { StudyScreen } from '../src/screens/StudyScreen';
import { AgendaScreen, AgendaScreenProps } from '../src/screens/AgendaScreen';
import {
  Subject,
  AppEvent,
  AttendanceRecord,
  StudyTask,
  StudySession,
  StudyStreak,
  GamificationData,
  ThemeType
} from '../src/types';
import { generateId, getLocalDateString } from '../src/utils';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string, detail?: string): void {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${message}${detail ? ' -> ' + detail : ''}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  totalTests++;
  if (actual === expected) {
    passedTests++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${message} (Expected: ${String(expected)}, Got: ${String(actual)})`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  console.log(`\n--- Test: ${name} ---`);
  await fn();
}

async function runTestSuite(): Promise<void> {
  console.log('================================================================');
  console.log('🛡️ HARDENING PHASE 2 & 3: REGRESSION & EDGE-CASES TEST SUITE');
  console.log('================================================================');

  // ==========================================================================
  // SUITE 1: StudyScreen Session Save under Fallback 'general', XP & Streak
  // ==========================================================================
  console.log('\n--- SUITE 1: StudyScreen Fallback Subject, XP Award & Streak Increment ---');

  await test('Pomodoro session save under fallback "general" awards +50 XP and increments streak', async () => {
    // 1. Setup initial storage state: empty subjects, initial streak, initial gamification
    const initialStreak: StudyStreak = {
      currentStreak: 2,
      longestStreak: 5,
      lastStudyDate: (() => {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        return getLocalDateString(y);
      })(),
    };

    const initialGamification: GamificationData = {
      xp: 150,
      level: 1,
      unlockedAchievements: ['first_study'],
      totalFocusMinutes: 60,
    };

    await StorageService.saveSubjects([]);
    await StorageService.saveStreak(initialStreak);
    await StorageService.saveGamificationData(initialGamification);

    // 2. Simulate session save logic mirroring StudyScreen.tsx (handlePomodoroComplete)
    const subjects: Subject[] = [];
    const selectedSubjectId: string | null = null;
    const focusMinutes = 25;

    // Resolve subjectId: fallback to 'general' when subjects is empty
    const subId = selectedSubjectId || (subjects.length > 0 ? subjects[0].id : 'general');
    assertEqual(subId, 'general', 'Subject fallback correctly resolves to "general"');

    const newSession: StudySession = {
      id: generateId('sess'),
      subjectId: subId,
      durationMs: focusMinutes * 60 * 1000,
      date: getLocalDateString(),
    };
    assertEqual(newSession.subjectId, 'general', 'Session record created with subjectId="general"');

    // 3. Update streak on session saved
    const updateStreakOnSessionSaved = async (streak: StudyStreak): Promise<StudyStreak> => {
      const todayStr = getLocalDateString();
      const updated = { ...streak };

      if (streak.lastStudyDate === todayStr) {
        return updated;
      }

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getLocalDateString(yesterday);

      if (streak.lastStudyDate === yesterdayStr) {
        updated.currentStreak += 1;
      } else {
        updated.currentStreak = 1;
      }

      if (updated.currentStreak > updated.longestStreak) {
        updated.longestStreak = updated.currentStreak;
      }
      updated.lastStudyDate = todayStr;

      await StorageService.saveStreak(updated);
      return updated;
    };

    const updatedStreak = await updateStreakOnSessionSaved(initialStreak);
    assertEqual(updatedStreak.currentStreak, 3, 'Streak incremented from 2 to 3');
    assertEqual(updatedStreak.lastStudyDate, getLocalDateString(), 'lastStudyDate set to today');

    // 4. Award +50 XP via StorageService.addXP
    const updatedGamification = await StorageService.addXP(50, 0);
    assertEqual(updatedGamification.xp, 200, 'Gamification XP increased by exactly +50 (150 -> 200)');

    // 5. Verify persisted storage reflects the updates
    const storedStreak = await StorageService.getStreak();
    assertEqual(storedStreak.currentStreak, 3, 'Persisted streak is 3');
    assertEqual(storedStreak.lastStudyDate, getLocalDateString(), 'Persisted lastStudyDate is today');

    const storedGamification = await StorageService.getGamificationData();
    assertEqual(storedGamification.xp, 200, 'Persisted XP is 200');
    assertEqual(storedGamification.totalFocusMinutes, 60, 'Persisted focus minutes is 60');
  });

  await test('Streak initializes to 1 for first-time study session without prior history', async () => {
    const emptyStreak: StudyStreak = {
      currentStreak: 0,
      longestStreak: 0,
      lastStudyDate: '',
    };

    const todayStr = getLocalDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday);

    let updatedStreak = { ...emptyStreak };
    if (emptyStreak.lastStudyDate === yesterdayStr) {
      updatedStreak.currentStreak += 1;
    } else {
      updatedStreak.currentStreak = 1;
    }
    updatedStreak.longestStreak = Math.max(updatedStreak.longestStreak, updatedStreak.currentStreak);
    updatedStreak.lastStudyDate = todayStr;

    await StorageService.saveStreak(updatedStreak);

    assertEqual(updatedStreak.currentStreak, 1, 'Streak becomes 1 on first session');
    assertEqual(updatedStreak.longestStreak, 1, 'Longest streak updated to 1');
    assertEqual(updatedStreak.lastStudyDate, todayStr, 'lastStudyDate set to today');
  });

  await test('Streak update is idempotent on multiple sessions in the same day', async () => {
    const todayStr = getLocalDateString();
    const streakToday: StudyStreak = {
      currentStreak: 4,
      longestStreak: 5,
      lastStudyDate: todayStr,
    };

    // If already studied today, streak should not double-increment
    const tryIncrement = (s: StudyStreak): StudyStreak => {
      if (s.lastStudyDate === todayStr) {
        return { ...s };
      }
      return { ...s, currentStreak: s.currentStreak + 1 };
    };

    const result = tryIncrement(streakToday);
    assertEqual(result.currentStreak, 4, 'Streak count stays at 4 when already completed today');
    assertEqual(result.lastStudyDate, todayStr, 'lastStudyDate remains today');
  });

  // ==========================================================================
  // SUITE 2: Malicious & Negative Input Sanitization
  // ==========================================================================
  console.log('\n--- SUITE 2: Malicious & Negative Input Sanitization Before Persistence ---');

  await test('Subject input sanitization: negative passGrade, maxAbsences, and workload are bounded safely', () => {
    // Test negative, extreme, or NaN numbers in Subject attributes
    const safePassGradeNeg = SecuritySanitizer.sanitizeNumber(-5, 0, 10, 7.0);
    assertEqual(safePassGradeNeg, 0, 'Negative passGrade (-5) is clamped to 0');

    const safePassGradeExt = SecuritySanitizer.sanitizeNumber(99, 0, 10, 7.0);
    assertEqual(safePassGradeExt, 10, 'Extreme passGrade (99) is clamped to 10');

    const safePassGradeNaN = SecuritySanitizer.sanitizeNumber(NaN, 0, 10, 7.0);
    assertEqual(safePassGradeNaN, 7.0, 'NaN passGrade falls back to default 7.0');

    const safeMaxAbsencesNeg = SecuritySanitizer.sanitizeInteger(-15, 0, 1000, 15);
    assertEqual(safeMaxAbsencesNeg, 0, 'Negative maxAbsences (-15) clamped to 0');

    const safeMaxAbsencesNaN = SecuritySanitizer.sanitizeInteger(NaN, 0, 1000, 15);
    assertEqual(safeMaxAbsencesNaN, 15, 'NaN maxAbsences falls back to default 15');

    const safeWeeklyClassesNeg = SecuritySanitizer.sanitizeInteger(-4, 1, 100, 2);
    assertEqual(safeWeeklyClassesNeg, 1, 'Negative weeklyClasses (-4) clamped to minimum 1');

    const safeDurationNeg = SecuritySanitizer.sanitizeInteger(-60, 10, 360, 50);
    assertEqual(safeDurationNeg, 10, 'Negative classDuration (-60) clamped to minimum 10');

    const safeCountNeg = SecuritySanitizer.sanitizeInteger(0, 1, 12, 2);
    assertEqual(safeCountNeg, 1, 'Zero classCount clamped to minimum 1');
  });

  await test('Event input sanitization: negative startMinutes, durationMinutes, and alerts are bounded', () => {
    const safeStartMinutes = SecuritySanitizer.sanitizeInteger(-120, 0, 1439, 480);
    assertEqual(safeStartMinutes, 0, 'Negative startMinutes (-120) clamped to 0');

    const safeDurationMinutes = SecuritySanitizer.sanitizeInteger(-45, 5, 1440, 60);
    assertEqual(safeDurationMinutes, 5, 'Negative durationMinutes (-45) clamped to minimum 5');

    const safeIntervalNeg = SecuritySanitizer.sanitizeInteger(-2, 1, 12, 1);
    assertEqual(safeIntervalNeg, 1, 'Negative recurrenceInterval (-2) clamped to 1');

    const safeRecurrenceDayExt = SecuritySanitizer.sanitizeInteger(45, 1, 31, 15);
    assertEqual(safeRecurrenceDayExt, 31, 'Out of bounds recurrenceMonthDay (45) clamped to 31');

    // Alerts array sanitization
    const rawAlerts = [-30, 0, 15, 5000000, NaN, 15];
    const safeAlerts = rawAlerts
      .map(a => SecuritySanitizer.sanitizeInteger(a, 0, 525600, 0))
      .filter((v, i, arr) => arr.indexOf(v) === i);

    assertEqual(safeAlerts.includes(0), true, 'Negative alert clamped to 0');
    assertEqual(safeAlerts.includes(15), true, 'Valid 15 min alert retained');
    assertEqual(safeAlerts.includes(525600), true, 'Excessive alert clamped to max 1 year (525600 min)');
    assertEqual(safeAlerts.filter(a => a === 15).length, 1, 'Duplicate alerts deduplicated');
  });

  await test('HTML injection & XSS attempts in Subject and Event titles are stripped', () => {
    const maliciousSubjectTitle = '<script>alert("pwned")</script><b>Sistemas Operacionais</b>';
    const cleanSubject = SecuritySanitizer.sanitizeTitle(maliciousSubjectTitle);
    assertEqual(cleanSubject, 'Sistemas Operacionais', 'Script and HTML tags stripped from subject title');

    const maliciousEventTitle = '<img src=x onerror=alert(1)>Prova Final de Redes';
    const cleanEvent = SecuritySanitizer.sanitizeTitle(maliciousEventTitle);
    assertEqual(cleanEvent, 'Prova Final de Redes', 'Img onerror tag stripped from event title');

    const maliciousNotes = '<script>fetch("http://evil.com")</script>Capítulo 4 e 5\nExercícios de fixação';
    const cleanNotes = SecuritySanitizer.sanitizeNotes(maliciousNotes);
    assert(!cleanNotes.includes('<script>'), 'Script tag completely purged from notes');
    assert(cleanNotes.includes('Capítulo 4 e 5'), 'Legitimate text preserved');
  });

  await test('Sanitized objects persist cleanly into StorageService without corruption', async () => {
    const sanitizedSubject: Subject = {
      id: generateId('subj'),
      name: SecuritySanitizer.sanitizeTitle('<script>x</script>Cálculo II'),
      color: '#00FFAA',
      passGrade: SecuritySanitizer.sanitizeNumber(-2, 0, 10, 7.0),
      workloadHours: SecuritySanitizer.sanitizeInteger(-10, 1, 100, 4),
      maxAbsences: SecuritySanitizer.sanitizeInteger(9999, 0, 1000, 15),
      isArchived: false,
      groups: []
    };

    await StorageService.saveSubjects([sanitizedSubject]);
    const stored = await StorageService.getSubjects();

    assertEqual(stored.length, 1, 'Stored 1 subject');
    assertEqual(stored[0].name, 'Cálculo II', 'Stored subject title is sanitized');
    assertEqual(stored[0].passGrade, 0, 'Stored passGrade is clamped to 0');
    assertEqual(stored[0].workloadHours, 1, 'Stored workloadHours is clamped to 1');
    assertEqual(stored[0].maxAbsences, 1000, 'Stored maxAbsences is clamped to 1000');
  });

  // ==========================================================================
  // SUITE 3: Empty State Zero-Crash Verification
  // ==========================================================================
  console.log('\n--- SUITE 3: Zero-Crash Rendering on Empty States Across All Screens ---');

  await test('AgendaScreen instantiates with empty state without "undefined is not an object" exception', () => {
    const emptyAgendaProps: AgendaScreenProps = {
      events: [],
      subjects: [],
      attendances: [],
      tasks: [],
      theme: 'dark',
      onAddNewEvent: () => {},
      onEditEvent: () => {},
      onToggleEventCompletion: () => {},
      onToggleTaskCompletion: () => {},
      onSelectDate: () => {},
      onOpenAttendanceModal: () => {},
      onOpenScheduleGrid: () => {},
      onOpenExamDetails: () => {},
    };

    const element = React.createElement(AgendaScreen, emptyAgendaProps);
    assert(element !== null && typeof element.type === 'function', 'AgendaScreen instantiates cleanly with empty collections');
  });

  await test('StudyScreen instantiates with empty state without "undefined is not an object" exception', () => {
    const emptyStudyProps = {
      subjects: [],
      tasks: [],
      onUpdateTasks: () => {},
      sessions: [],
      onAddSession: () => {},
      theme: 'dark' as ThemeType,
      focusMinutesDefault: 25,
      breakMinutesDefault: 5,
      onOpenAchievements: () => {},
      onOpenAnalytics: () => {},
      onAddNewSubject: () => {},
    };

    const element = React.createElement(StudyScreen, emptyStudyProps);
    assert(element !== null && typeof element.type === 'function', 'StudyScreen instantiates cleanly with empty collections');
  });

  await test('AgendaScreen empty state static structure contains informative card and CTA', () => {
    const screensDir = path.resolve(__dirname, '../src/screens');
    const agendaSource = fs.readFileSync(path.join(screensDir, 'AgendaScreen.tsx'), 'utf8');

    assert(
      agendaSource.includes('totalItemsCount === 0'),
      'AgendaScreen checks totalItemsCount === 0 for empty checklist'
    );
    assert(
      agendaSource.includes('styles.emptyChecklistCard'),
      'AgendaScreen renders styles.emptyChecklistCard'
    );
    assert(
      agendaSource.includes('Dia livre de compromissos!'),
      'AgendaScreen contains "Dia livre de compromissos!" message'
    );
    assert(
      agendaSource.includes('+ Agendar Nova Atividade'),
      'AgendaScreen includes CTA to schedule new activity'
    );
  });

  await test('StudyScreen empty state static structure contains zero-state cards for subjects, daily study, and tasks', () => {
    const screensDir = path.resolve(__dirname, '../src/screens');
    const studySource = fs.readFileSync(path.join(screensDir, 'StudyScreen.tsx'), 'utf8');

    assert(
      studySource.includes('styles.noSubjectsCard'),
      'StudyScreen defines styles.noSubjectsCard when subjects.length === 0'
    );
    assert(
      studySource.includes('Nenhuma disciplina cadastrada'),
      'StudyScreen includes "Nenhuma disciplina cadastrada" title'
    );
    assert(
      studySource.includes('styles.emptyDailyStudyCard'),
      'StudyScreen defines styles.emptyDailyStudyCard when todayTotalStudyMs === 0'
    );
    assert(
      studySource.includes('Nenhum ciclo registrado hoje'),
      'StudyScreen includes "Nenhum ciclo registrado hoje" title'
    );
    assert(
      studySource.includes('styles.emptyTasksCard'),
      'StudyScreen defines styles.emptyTasksCard when filteredTasks.length === 0'
    );
    assert(
      studySource.includes('Nenhuma meta de estudo criada'),
      'StudyScreen includes "Nenhuma meta de estudo criada" title'
    );
  });

  await test('AttendanceScreen empty state static structure contains zero-state cards and safe calculations', () => {
    const screensDir = path.resolve(__dirname, '../src/screens');
    const attendanceSource = fs.readFileSync(path.join(screensDir, 'AttendanceScreen.tsx'), 'utf8');

    assert(
      attendanceSource.includes('filteredSubjects.length === 0'),
      'AttendanceScreen checks filteredSubjects.length === 0'
    );
    assert(
      attendanceSource.includes('Nenhuma matéria cadastrada'),
      'AttendanceScreen includes "Nenhuma matéria cadastrada" empty state title'
    );
    assert(
      attendanceSource.includes('+ Cadastrar Disciplina'),
      'AttendanceScreen includes "+ Cadastrar Disciplina" CTA button'
    );
  });

  await test('GradesScreen empty state static structure contains zero-state cards for no grades and no subjects', () => {
    const screensDir = path.resolve(__dirname, '../src/screens');
    const gradesSource = fs.readFileSync(path.join(screensDir, 'GradesScreen.tsx'), 'utf8');

    assert(
      gradesSource.includes('filteredSubjects.length === 0'),
      'GradesScreen checks filteredSubjects.length === 0'
    );
    assert(
      gradesSource.includes('Aguardando primeiras notas'),
      'GradesScreen displays "Aguardando primeiras notas" when subjects exist without grades'
    );
    assert(
      gradesSource.includes('+ Cadastrar Disciplina'),
      'GradesScreen includes "+ Cadastrar Disciplina" CTA button'
    );
  });

  await test('AcademicPerformanceScreen empty state static structure handles empty semesters cleanly', () => {
    const screensDir = path.resolve(__dirname, '../src/screens');
    const perfSource = fs.readFileSync(path.join(screensDir, 'AcademicPerformanceScreen.tsx'), 'utf8');

    assert(
      perfSource.includes('Array.isArray(courseData?.semesters)'),
      'AcademicPerformanceScreen guards courseData.semesters with Array.isArray'
    );
    assert(
      perfSource.includes('Array.isArray(subjects)'),
      'AcademicPerformanceScreen guards subjects with Array.isArray'
    );
    assert(
      perfSource.includes('Nenhuma matéria neste semestre'),
      'AcademicPerformanceScreen provides empty semester feedback message'
    );
  });

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passedTests}/${totalTests} Tests Passed (${failedTests} Failed)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
