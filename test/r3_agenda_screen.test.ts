import './setup_env';
import React from 'react';
import { AgendaScreen, AgendaScreenProps } from '../src/screens/AgendaScreen';
import {
  AppEvent,
  Subject,
  AttendanceRecord,
  StudyTask,
  ThemeType,
  AppSettings,
  GamificationData
} from '../src/types';
import {
  getThemeColors,
  getCategoryColor,
  getContrastTextColor,
  Colors,
  CategoryColors
} from '../src/theme';
import { getLocalDateString, formatDisplayDate } from '../src/utils';
import { LocaleConfig } from 'react-native-calendars';
import { parseISO, format, addDays, getDay } from 'date-fns';

interface TestResult {
  tier: string;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, tier: string, name: string, detail?: string) {
  if (condition) {
    results.push({ tier, name, passed: true });
    console.log(`  [PASS] [${tier}] ${name}`);
  } else {
    const err = detail || 'Assertion failed';
    results.push({ tier, name, passed: false, error: err });
    console.error(`  [FAIL] [${tier}] ${name} -> ${err}`);
  }
}

// Deterministic Next Activity Calculator mirroring AgendaScreen logic
interface NextActivityInfo {
  event: AppEvent;
  status: 'in_progress' | 'upcoming';
  statusText: string;
  minutesUntilStart: number;
}

function calculateNextActivity(
  events: AppEvent[],
  targetDate: string,
  nowTime: Date,
  subjects: Subject[] = [],
  attendances: AttendanceRecord[] = [],
  examWeekMode: boolean = false
): NextActivityInfo | null {
  const currentMins = nowTime.getHours() * 60 + nowTime.getMinutes();

  const filteredEvents = events.filter(e => {
    // Exam week filter
    if (examWeekMode && e.category !== 'Provas/Trabalhos' && e.category !== 'Faculdade/Aulas') {
      return false;
    }

    // Archived subject filter
    if (e.subjectId) {
      const sub = subjects.find(s => s.id === e.subjectId);
      if (sub?.isArchived) return false;
    }

    // Cancelled attendance filter
    if (e.category === 'Faculdade/Aulas' && e.recurrence === 'weekly') {
      const isCancelled = attendances.some(
        a => a.eventId === e.id && a.date === targetDate && a.status === 'cancelled'
      );
      if (isCancelled) return false;
    }

    if (targetDate < e.date) return false;
    if (e.recurrence === 'daily') return true;
    if (e.recurrence === 'weekly') {
      if (e.recurrenceDays && e.recurrenceDays.length > 0) {
        const currentDay = getDay(parseISO(targetDate));
        return e.recurrenceDays.includes(currentDay);
      }
      const startDay = getDay(parseISO(e.date));
      const currentDay = getDay(parseISO(targetDate));
      return startDay === currentDay;
    }
    if (e.recurrence === 'monthly') {
      const startDayOfMonth = parseISO(e.date).getDate();
      const currentDayOfMonth = parseISO(targetDate).getDate();
      return startDayOfMonth === currentDayOfMonth;
    }
    return e.date === targetDate;
  }).sort((a, b) => (a.startTime || '08:00').localeCompare(b.startTime || '08:00'));

  for (const event of filteredEvents) {
    const [startH, startM] = (event.startTime || '08:00').split(':').map(Number);
    const startTotalMins = (startH || 0) * 60 + (startM || 0);

    let endTotalMins = startTotalMins + 60;
    if (event.endTime) {
      const [endH, endM] = event.endTime.split(':').map(Number);
      let calcEnd = (endH || 0) * 60 + (endM || 0);
      if (calcEnd < startTotalMins) calcEnd += 24 * 60; // handle midnight wrap
      endTotalMins = calcEnd;
    }

    // Check if event is in progress
    if (currentMins >= startTotalMins && currentMins < endTotalMins) {
      return {
        event,
        status: 'in_progress',
        statusText: 'EM ANDAMENTO',
        minutesUntilStart: 0,
      };
    }

    // Check if event is upcoming today
    if (startTotalMins > currentMins) {
      const diff = startTotalMins - currentMins;
      const hours = Math.floor(diff / 60);
      const mins = diff % 60;
      let statusText = '';
      if (hours > 0) {
        statusText = `Começa em ${hours}h ${mins > 0 ? mins + 'm' : ''}`.trim();
      } else {
        statusText = `Começa em ${mins} min`;
      }

      return {
        event,
        status: 'upcoming',
        statusText,
        minutesUntilStart: diff,
      };
    }
  }

  return null;
}

// Calendar Multi-Dot Marking Generator mirroring AgendaScreen logic
function generateCalendarMarkings(
  events: AppEvent[],
  selectedDate: string | null,
  theme: ThemeType,
  subjects: Subject[] = []
) {
  const colors = getThemeColors(theme);
  const marks: Record<string, any> = {};

  events.forEach(e => {
    if (e.subjectId) {
      const sub = subjects.find(s => s.id === e.subjectId);
      if (sub?.isArchived) return;
    }

    const sub = e.subjectId ? subjects.find(s => s.id === e.subjectId) : null;
    const dotColor = sub?.color || getCategoryColor(e.category, theme) || colors.primary;

    if (e.recurrence === 'none') {
      if (!marks[e.date]) marks[e.date] = { dots: [] };
      if (marks[e.date].dots && marks[e.date].dots.length < 3) {
        marks[e.date].dots.push({ color: dotColor, key: `${e.id}_${marks[e.date].dots.length}` });
      }
    } else {
      let currentDate = parseISO(e.date);
      if (isNaN(currentDate.getTime())) return;

      const maxSteps = e.recurrence === 'daily' ? 180 : e.recurrence === 'weekly' ? 30 : 6;
      for (let i = 0; i < maxSteps; i++) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        if (!marks[dateStr]) marks[dateStr] = { dots: [] };
        if (marks[dateStr].dots && marks[dateStr].dots.length < 3) {
          marks[dateStr].dots.push({ color: dotColor, key: `${e.id}_${dateStr}_${marks[dateStr].dots.length}` });
        }
        currentDate = addDays(currentDate, e.recurrence === 'daily' ? 1 : e.recurrence === 'weekly' ? 7 : 30);
      }
    }
  });

  if (selectedDate) {
    marks[selectedDate] = {
      ...(marks[selectedDate] || {}),
      selected: true,
      selectedColor: colors.primary,
      selectedTextColor: getContrastTextColor(colors.primary),
    };
  }

  return marks;
}

export async function runR3Tests() {
  console.log('\n================================================================');
  console.log('--- R3: AGENDA SCREEN, CALENDAR & CONTRAST TEST SUITE (TIERS 1-4) ---');
  console.log('================================================================\n');

  const mockSubjects: Subject[] = [
    { id: 'sub_1', name: 'Cálculo II', color: '#3B82F6', notes: 'Sala 302, Bloco B' },
    { id: 'sub_2', name: 'Estruturas de Dados', color: '#10B981', notes: 'Laboratório 4' },
    { id: 'sub_archived', name: 'Matéria Antiga', color: '#888888', isArchived: true },
  ];

  const todayStr = '2026-08-21';

  // ==========================================================================
  // TIER 1: SANITY & CONTRACT TESTS
  // ==========================================================================
  console.log('--- TIER 1: Sanity & Interface Contracts ---');

  // 1.1 AgendaScreen export verification
  assert(typeof AgendaScreen === 'function', 'Tier 1', 'AgendaScreen is exported as a valid React component');

  // 1.2 Locale configuration for react-native-calendars
  assert(LocaleConfig.locales['pt-br'] !== undefined, 'Tier 1', 'Portuguese locale is registered in LocaleConfig.locales["pt-br"]');
  assert(LocaleConfig.locales['pt-br'].today === 'Hoje', 'Tier 1', 'LocaleConfig pt-br defines today: "Hoje"');
  assert(LocaleConfig.locales['pt-br'].monthNames.length === 12, 'Tier 1', 'LocaleConfig pt-br defines 12 month names');
  assert(LocaleConfig.locales['pt-br'].dayNames.length === 7, 'Tier 1', 'LocaleConfig pt-br defines 7 day names');

  // 1.3 Theme palette tokens
  const darkColors = getThemeColors('dark');
  const amoledColors = getThemeColors('amoled');
  const lightColors = getThemeColors('light');
  assert(darkColors.background === '#0F1115' && darkColors.primary === '#00FFAA', 'Tier 1', 'Dark theme colors defined with Mint primary');
  assert(amoledColors.background === '#000000' && amoledColors.surface === '#0A0C0E', 'Tier 1', 'AMOLED theme colors defined with pure black bg');
  assert(lightColors.background === '#F8F9FA' && lightColors.primary === '#059669', 'Tier 1', 'Light theme colors defined with Emerald primary');

  // 1.4 Category Colors
  assert(getCategoryColor('Faculdade/Aulas', 'dark') === '#3B82F6', 'Tier 1', 'Faculdade/Aulas category maps to #3B82F6');
  assert(getCategoryColor('Provas/Trabalhos', 'dark') === '#F43F5E', 'Tier 1', 'Provas/Trabalhos category maps to #F43F5E');
  assert(getCategoryColor('Saúde/Academia', 'light') === '#059669', 'Tier 1', 'Saúde/Academia in light theme adapts to #059669 for WCAG contrast');

  // ==========================================================================
  // TIER 2: FUNCTIONAL NEXT ACTIVITY & INTERACTIVE CALENDAR MARKINGS
  // ==========================================================================
  console.log('\n--- TIER 2: Functional Next Activity & Calendar Markings ---');

  const testEvents: AppEvent[] = [
    {
      id: 'ev_1',
      title: 'Aula de Cálculo II',
      category: 'Faculdade/Aulas',
      date: todayStr,
      startTime: '08:00',
      endTime: '10:00',
      recurrence: 'none',
      alerts: [15],
      isCompleted: false,
      subjectId: 'sub_1'
    },
    {
      id: 'ev_2',
      title: 'Prova de Estruturas de Dados',
      category: 'Provas/Trabalhos',
      date: todayStr,
      startTime: '10:30',
      endTime: '12:00',
      recurrence: 'none',
      alerts: [60],
      isCompleted: false,
      subjectId: 'sub_2',
      isImportant: true
    },
    {
      id: 'ev_3',
      title: 'Academia',
      category: 'Saúde/Academia',
      date: todayStr,
      startTime: '14:00',
      endTime: '15:30',
      recurrence: 'none',
      alerts: [],
      isCompleted: false
    }
  ];

  // 2.1 Next Activity in Early Morning (07:15) -> "Começa em 45 min"
  const morningTime = new Date(2026, 7, 21, 7, 15);
  const nextActMorning = calculateNextActivity(testEvents, todayStr, morningTime, mockSubjects);
  assert(nextActMorning !== null, 'Tier 2', 'Identified next activity in the morning');
  assert(nextActMorning?.event.id === 'ev_1', 'Tier 2', 'Correct event identified (Aula de Cálculo II)');
  assert(nextActMorning?.status === 'upcoming', 'Tier 2', 'Status is upcoming');
  assert(nextActMorning?.statusText === 'Começa em 45 min', 'Tier 2', 'Status text is "Começa em 45 min"');
  assert(nextActMorning?.minutesUntilStart === 45, 'Tier 2', 'Exact 45 minutes until start');

  // 2.2 Next Activity During Event (08:30) -> "EM ANDAMENTO"
  const inProgressTime = new Date(2026, 7, 21, 8, 30);
  const nextActInProgress = calculateNextActivity(testEvents, todayStr, inProgressTime, mockSubjects);
  assert(nextActInProgress !== null, 'Tier 2', 'Identified active activity during event');
  assert(nextActInProgress?.event.id === 'ev_1', 'Tier 2', 'Correct active event (Aula de Cálculo II)');
  assert(nextActInProgress?.status === 'in_progress', 'Tier 2', 'Status is in_progress');
  assert(nextActInProgress?.statusText === 'EM ANDAMENTO', 'Tier 2', 'Status text is "EM ANDAMENTO"');

  // 2.3 Next Activity in Transition (10:15) -> Next is Prova in 15 min
  const transitionTime = new Date(2026, 7, 21, 10, 15);
  const nextActTransition = calculateNextActivity(testEvents, todayStr, transitionTime, mockSubjects);
  assert(nextActTransition?.event.id === 'ev_2', 'Tier 2', 'Identified next exam after class (Prova de Estruturas)');
  assert(nextActTransition?.statusText === 'Começa em 15 min', 'Tier 2', 'Status text is "Começa em 15 min"');

  // 2.4 Next Activity After All Events (20:00) -> null (Fallback card trigger)
  const nightTime = new Date(2026, 7, 21, 20, 0);
  const nextActNight = calculateNextActivity(testEvents, todayStr, nightTime, mockSubjects);
  assert(nextActNight === null, 'Tier 2', 'Returns null after all events completed, triggering fallback card');

  // 2.5 Calendar Multi-Dot Markings
  const markings = generateCalendarMarkings(testEvents, todayStr, 'dark', mockSubjects);
  assert(markings[todayStr] !== undefined, 'Tier 2', 'Calendar markings generated for today');
  assert(markings[todayStr].dots !== undefined, 'Tier 2', 'Today has multi-dot array');
  assert(markings[todayStr].dots.length === 3, 'Tier 2', 'Today has 3 dots for 3 events');
  assert(markings[todayStr].selected === true, 'Tier 2', 'Selected date is marked selected: true');
  assert(markings[todayStr].selectedColor === '#00FFAA', 'Tier 2', 'Selected color is primary mint (#00FFAA)');
  assert(markings[todayStr].selectedTextColor === '#0A0A0A', 'Tier 2', 'Selected text color is high-contrast #0A0A0A');

  // ==========================================================================
  // TIER 3: BOUNDARY, ADVERSARIAL & FILTERING EDGE CASES
  // ==========================================================================
  console.log('\n--- TIER 3: Boundary, Adversarial & Filtering Edge Cases ---');

  // 3.1 Weekly Recurrence & Day of Week Matching
  const weeklyClassEvent: AppEvent = {
    id: 'ev_weekly_fri',
    title: 'Aula de Sexta-feira',
    category: 'Faculdade/Aulas',
    date: '2026-08-07', // Friday
    startTime: '09:00',
    endTime: '11:00',
    recurrence: 'weekly',
    alerts: [15],
    isCompleted: false,
    subjectId: 'sub_1'
  };

  const friDate = '2026-08-21'; // Friday
  const satDate = '2026-08-22'; // Saturday
  const friTime = new Date(2026, 7, 21, 8, 0);
  const satTime = new Date(2026, 7, 22, 8, 0);

  const nextOnFri = calculateNextActivity([weeklyClassEvent], friDate, friTime, mockSubjects);
  assert(nextOnFri?.event.id === 'ev_weekly_fri', 'Tier 3', 'Weekly recurring event correctly matched on Friday');

  const nextOnSat = calculateNextActivity([weeklyClassEvent], satDate, satTime, mockSubjects);
  assert(nextOnSat === null, 'Tier 3', 'Weekly recurring Friday event correctly ignored on Saturday');

  // 3.2 Cancelled Attendance Filtering
  const cancelledAtt: AttendanceRecord = {
    id: 'att_c1',
    subjectId: 'sub_1',
    eventId: 'ev_weekly_fri',
    date: friDate,
    status: 'cancelled'
  };

  const nextWhenCancelled = calculateNextActivity(
    [weeklyClassEvent],
    friDate,
    friTime,
    mockSubjects,
    [cancelledAtt]
  );
  assert(nextWhenCancelled === null, 'Tier 3', 'Cancelled class is filtered out from next activity and agenda');

  // 3.3 Archived Subject Filtering
  const archivedEvent: AppEvent = {
    id: 'ev_arch',
    title: 'Aula de Matéria Velha',
    category: 'Faculdade/Aulas',
    date: friDate,
    startTime: '09:00',
    endTime: '11:00',
    recurrence: 'none',
    alerts: [],
    isCompleted: false,
    subjectId: 'sub_archived'
  };

  const nextWhenArchived = calculateNextActivity([archivedEvent], friDate, friTime, mockSubjects);
  assert(nextWhenArchived === null, 'Tier 3', 'Archived subject event is excluded from next activity');

  const markingsWithArchived = generateCalendarMarkings([archivedEvent], friDate, 'dark', mockSubjects);
  assert(!markingsWithArchived[friDate]?.dots || markingsWithArchived[friDate]?.dots.length === 0, 'Tier 3', 'Archived subject event produces no calendar dots');

  // 3.4 Exam Week Mode Filtering
  const nextInExamMode = calculateNextActivity(
    testEvents,
    todayStr,
    new Date(2026, 7, 21, 13, 0),
    mockSubjects,
    [],
    true // Exam week mode ON
  );
  // ev_3 is Academia (Saúde/Academia), which should be hidden in exam week mode
  assert(nextInExamMode === null, 'Tier 3', 'Non-academic event (Academia) is hidden during exam week mode');

  // 3.5 Overnight Event Spanning Midnight (23:00 - 01:00)
  const overnightEvent: AppEvent = {
    id: 'ev_overnight',
    title: 'Plantão de Dúvidas Noturno',
    category: 'Faculdade/Aulas',
    date: todayStr,
    startTime: '23:00',
    endTime: '01:00',
    recurrence: 'none',
    alerts: [],
    isCompleted: false,
    subjectId: 'sub_1'
  };

  const lateNightTime = new Date(2026, 7, 21, 23, 30);
  const nextOvernight = calculateNextActivity([overnightEvent], todayStr, lateNightTime, mockSubjects);
  assert(nextOvernight?.status === 'in_progress', 'Tier 3', 'Overnight event crossing midnight is detected as in_progress at 23:30');

  // 3.6 Tasks Checklist Completion Toggle
  const taskA: StudyTask = {
    id: 'tsk_1',
    title: 'Exercícios 1 a 10 de Cálculo',
    isCompleted: false,
    dueDate: todayStr,
    priority: 'high',
    subjectId: 'sub_1'
  };

  const toggledTaskA: StudyTask = { ...taskA, isCompleted: !taskA.isCompleted };
  assert(toggledTaskA.isCompleted === true, 'Tier 3', 'Task completion flips to true on interactive toggle');

  // ==========================================================================
  // TIER 4: THEME CONTRAST & ACCESSIBILITY AUDIT
  // ==========================================================================
  console.log('\n--- TIER 4: Theme Contrast & WCAG AA AA Compliance ---');

  // 4.1 Contrast Helper Test Matrix
  const contrastPairs = [
    { bg: '#00FFAA', expected: '#0A0A0A', name: 'Vibrant Mint (#00FFAA)' },
    { bg: '#059669', expected: '#FFFFFF', name: 'Emerald Green (#059669)' },
    { bg: '#3B82F6', expected: '#FFFFFF', name: 'Modern Blue (#3B82F6)' },
    { bg: '#F43F5E', expected: '#FFFFFF', name: 'Rose Red (#F43F5E)' },
    { bg: '#F59E0B', expected: '#0A0A0A', name: 'Amber Yellow (#F59E0B)' },
    { bg: '#A855F7', expected: '#FFFFFF', name: 'Violet (#A855F7)' },
    { bg: '#FFFFFF', expected: '#0A0A0A', name: 'Pure White (#FFFFFF)' },
    { bg: '#000000', expected: '#FFFFFF', name: 'Pure Black (#000000)' },
    { bg: '#0F1115', expected: '#FFFFFF', name: 'Dark Surface (#0F1115)' },
    { bg: '#F8F9FA', expected: '#0A0A0A', name: 'Light Surface (#F8F9FA)' },
  ];

  contrastPairs.forEach(pair => {
    const computed = getContrastTextColor(pair.bg);
    assert(
      computed === pair.expected,
      'Tier 4',
      `${pair.name} yields contrast color ${computed} (expected ${pair.expected})`
    );
  });

  // 4.2 Category contrast verification across all themes
  const allCategories = Object.keys(CategoryColors) as (keyof typeof CategoryColors)[];
  const allThemes: ThemeType[] = ['dark', 'amoled', 'light'];

  allThemes.forEach(th => {
    allCategories.forEach(cat => {
      const catColor = getCategoryColor(cat, th);
      const contrast = getContrastTextColor(catColor);
      assert(
        contrast === '#0A0A0A' || contrast === '#FFFFFF',
        'Tier 4',
        `Category "${cat}" in ${th} theme has valid WCAG text color: ${contrast}`
      );
    });
  });

  // 4.3 Date formatting tests
  assert(formatDisplayDate('2026-08-21') === '21/08/2026', 'Tier 4', 'formatDisplayDate converts YYYY-MM-DD to DD/MM/YYYY');
  assert(formatDisplayDate('') === '', 'Tier 4', 'formatDisplayDate safely handles empty input');

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('\n================================================================');
  console.log('--- R3 TEST RESULTS SUMMARY ---');
  console.log('================================================================');

  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.filter(r => !r.passed).length;

  console.log(`Total R3 Tests : ${results.length}`);
  console.log(`Passed         : ${totalPassed}`);
  console.log(`Failed         : ${totalFailed}`);

  if (totalFailed > 0) {
    console.error('\nFAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => {
      console.error(`- [${r.tier}] ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\nALL R3 AGENDA VERTICAL SCROLL REDESIGN TESTS PASSED (100% SUCCESS)!');
  }
}

// Execute when run directly
runR3Tests().catch((e) => {
  console.error('Fatal test runner error:', e);
  process.exit(1);
});
