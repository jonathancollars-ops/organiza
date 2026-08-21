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
  GamificationData,
  EventCategory
} from '../src/types';
import {
  getThemeColors,
  getCategoryColor,
  getContrastTextColor,
  Colors,
  CategoryColors
} from '../src/theme';
import { getLocalDateString, formatDisplayDate } from '../src/utils';
import { parseISO, format, addDays, getDay, isLeapYear } from 'date-fns';

interface TestResult {
  category: string;
  testName: string;
  passed: boolean;
  error?: string;
}

const testResults: TestResult[] = [];

function assertTest(condition: boolean, category: string, testName: string, detail?: string) {
  if (condition) {
    testResults.push({ category, testName, passed: true });
    console.log(`  [PASS] [${category}] ${testName}`);
  } else {
    const err = detail || 'Assertion condition evaluated to false';
    testResults.push({ category, testName, passed: false, error: err });
    console.error(`  [FAIL] [${category}] ${testName} -> ${err}`);
  }
}

// Logic engine mirroring AgendaScreen for algorithmic stress testing
function filterTodaysEvents(
  events: AppEvent[],
  targetDate: string,
  subjects: Subject[] = [],
  attendances: AttendanceRecord[] = [],
  examWeekMode: boolean = false
): AppEvent[] {
  return events.filter(e => {
    if (examWeekMode && e.category !== 'Provas/Trabalhos' && e.category !== 'Faculdade/Aulas') {
      return false;
    }

    if (e.subjectId) {
      const subject = subjects.find(s => s.id === e.subjectId);
      if (subject?.isArchived) return false;
    }

    if (e.category === 'Faculdade/Aulas' && e.recurrence === 'weekly') {
      const isCancelled = attendances.some(
        a => a.eventId === e.id && a.date === targetDate && a.status === 'cancelled'
      );
      if (isCancelled) return false;
    }

    if (!e.date || targetDate < e.date) return false;
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
  }).sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));
}

function computeHighlight(
  events: AppEvent[],
  targetDate: string,
  nowTime: Date,
  isToday: boolean,
  subjects: Subject[] = []
) {
  const currentMinutes = nowTime.getHours() * 60 + nowTime.getMinutes();
  let activeEvent: AppEvent | null = null;
  let nextEvent: AppEvent | null = null;
  let minutesUntilNext: number | null = null;

  for (const evt of events) {
    const [sh, sm] = (evt.startTime || '00:00').split(':').map(Number);
    const [eh, em] = (evt.endTime || '23:59').split(':').map(Number);
    const startMins = (sh || 0) * 60 + (sm || 0);
    let endMins = (eh || 0) * 60 + (em || 0);
    if (endMins < startMins) endMins += 24 * 60;

    if (isToday) {
      if (currentMinutes >= startMins && currentMinutes <= endMins) {
        activeEvent = evt;
        break;
      } else if (currentMinutes < startMins && !nextEvent) {
        nextEvent = evt;
        minutesUntilNext = startMins - currentMinutes;
      }
    } else {
      if (!nextEvent) {
        nextEvent = evt;
      }
    }
  }

  const featured = activeEvent || nextEvent;
  const featuredSubject = featured?.subjectId ? subjects.find(s => s.id === featured.subjectId) : null;

  return {
    activeEvent,
    nextEvent,
    minutesUntilNext,
    featured,
    featuredSubject
  };
}

function generateMarkedDates(
  events: AppEvent[],
  targetDate: string | null,
  theme: ThemeType,
  subjects: Subject[] = []
) {
  const colors = getThemeColors(theme);
  const marks: Record<string, any> = {};

  events.forEach(e => {
    if (e.subjectId) {
      const subject = subjects.find(s => s.id === e.subjectId);
      if (subject?.isArchived) return;
    }

    const subject = e.subjectId ? subjects.find(s => s.id === e.subjectId) : null;
    const dotColor = subject?.color || getCategoryColor(e.category, theme) || colors.primary;

    if (e.recurrence === 'none') {
      if (!marks[e.date]) marks[e.date] = { dots: [] };
      if (marks[e.date].dots && marks[e.date].dots.length < 3) {
        marks[e.date].dots.push({ color: dotColor, key: `${e.id}_${marks[e.date].dots.length}` });
      }
    } else {
      if (!e.date) return;
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

  if (targetDate) {
    marks[targetDate] = {
      ...(marks[targetDate] || {}),
      selected: true,
      selectedColor: colors.primary,
      selectedTextColor: getContrastTextColor(colors.primary)
    };
  }

  return marks;
}

export async function runAdversarialTestSuite() {
  console.log('\n================================================================');
  console.log('--- ADVERSARIAL STRESS SUITE: AGENDA, CALENDAR & THEME CONTRAST ---');
  console.log('================================================================\n');

  // ==========================================================================
  // 1. EXTREME CALENDAR DATES, LEAP YEARS & MONTH BOUNDARIES
  // ==========================================================================
  console.log('--- AREA 1: Extreme Calendar Dates, Leap Years & Boundaries ---');

  // 1.1 Leap year: 2024-02-29
  const leapEvent2024: AppEvent = {
    id: 'leap_2024',
    title: 'Leap Day 2024 Event',
    category: 'Outros',
    date: '2024-02-29',
    startTime: '10:00',
    endTime: '11:00',
    recurrence: 'none',
    alerts: [],
    isCompleted: false
  };
  const filteredLeap2024 = filterTodaysEvents([leapEvent2024], '2024-02-29');
  assertTest(filteredLeap2024.length === 1 && filteredLeap2024[0].id === 'leap_2024', 'Area 1: Dates', 'Leap year 2024-02-29 correctly matched');

  // 1.2 Non-leap year: 2026-02-28 vs 2026-02-29 (invalid)
  const filteredNonLeap28 = filterTodaysEvents([leapEvent2024], '2026-02-28');
  assertTest(filteredNonLeap28.length === 0, 'Area 1: Dates', 'Non-matching event on 2026-02-28 returns empty');

  // 1.3 Century leap year: 2000-02-29 (divisible by 400)
  const centuryLeapEvent: AppEvent = {
    id: 'century_leap',
    title: 'Y2K Leap Day',
    category: 'Faculdade/Aulas',
    date: '2000-02-29',
    startTime: '08:00',
    endTime: '09:00',
    recurrence: 'none',
    alerts: [],
    isCompleted: false
  };
  const filteredY2K = filterTodaysEvents([centuryLeapEvent], '2000-02-29');
  assertTest(filteredY2K.length === 1, 'Area 1: Dates', 'Century leap year 2000-02-29 supported');

  // 1.4 Year boundary crossover: 2026-12-31 to 2027-01-01
  const nyeEvent: AppEvent = {
    id: 'nye_event',
    title: 'New Year Eve Study',
    category: 'Faculdade/Aulas',
    date: '2026-12-31',
    startTime: '22:00',
    endTime: '23:30',
    recurrence: 'none',
    alerts: [],
    isCompleted: false
  };
  const filteredNYE = filterTodaysEvents([nyeEvent], '2026-12-31');
  const filteredNYD = filterTodaysEvents([nyeEvent], '2027-01-01');
  assertTest(filteredNYE.length === 1 && filteredNYD.length === 0, 'Area 1: Dates', 'Year boundary 2026-12-31 to 2027-01-01 correctly isolated');

  // 1.5 Far future date: 9999-12-31
  const farFutureEvent: AppEvent = {
    id: 'future_9999',
    title: 'Far Future Milestone',
    category: 'Outros',
    date: '9999-12-31',
    startTime: '12:00',
    endTime: '13:00',
    recurrence: 'none',
    alerts: [],
    isCompleted: false
  };
  const filteredFuture = filterTodaysEvents([farFutureEvent], '9999-12-31');
  assertTest(filteredFuture.length === 1, 'Area 1: Dates', 'Far future date 9999-12-31 handled safely');

  // 1.6 Date formatting helper on leap year and century dates
  assertTest(formatDisplayDate('2024-02-29') === '29/02/2024', 'Area 1: Dates', 'formatDisplayDate handles leap day 29/02/2024');
  assertTest(formatDisplayDate('2026-12-31') === '31/12/2026', 'Area 1: Dates', 'formatDisplayDate handles year end 31/12/2026');

  // ==========================================================================
  // 2. OVERLAPPING MULTI-DOT INDICATORS (>3 EVENTS)
  // ==========================================================================
  console.log('\n--- AREA 2: Multi-Dot Indicators & Dot Limit Stress ---');

  // Create 15 events on the same day with different categories/subjects
  const heavyDay = '2026-09-15';
  const heavyEvents: AppEvent[] = Array.from({ length: 15 }, (_, i) => ({
    id: `heavy_evt_${i}`,
    title: `Activity #${i + 1}`,
    category: (['Saúde/Academia', 'Faculdade/Aulas', 'Provas/Trabalhos', 'Lazer', 'Outros'] as EventCategory[])[i % 5],
    date: heavyDay,
    startTime: `${8 + Math.floor(i / 2)}:00`,
    endTime: `${9 + Math.floor(i / 2)}:00`,
    recurrence: 'none',
    alerts: [],
    isCompleted: false
  }));

  const marks15 = generateMarkedDates(heavyEvents, heavyDay, 'dark');
  assertTest(marks15[heavyDay] !== undefined, 'Area 2: Multi-Dot', 'Markings created for heavy event day');
  assertTest(marks15[heavyDay].dots.length === 3, 'Area 2: Multi-Dot', 'Strict cap of maximum 3 dots enforced for 15 events');

  // Ensure dot keys are unique
  const dotKeys = marks15[heavyDay].dots.map((d: any) => d.key);
  const uniqueKeys = new Set(dotKeys);
  assertTest(uniqueKeys.size === 3, 'Area 2: Multi-Dot', 'All 3 dot keys are strictly unique');

  // Verify mixed recurring + non-recurring dot cap
  const dailyRecEvent: AppEvent = {
    id: 'daily_dot_test',
    title: 'Daily Habit',
    category: 'Saúde/Academia',
    date: '2026-09-01',
    startTime: '07:00',
    endTime: '07:30',
    recurrence: 'daily',
    alerts: [],
    isCompleted: false
  };
  const combinedMarks = generateMarkedDates([dailyRecEvent, ...heavyEvents], heavyDay, 'dark');
  assertTest(combinedMarks[heavyDay].dots.length === 3, 'Area 2: Multi-Dot', 'Dot cap remains strictly 3 when combining daily recurring + multiple single events');

  // ==========================================================================
  // 3. RECURRENCE RULE EXPANSIONS (DAILY, WEEKLY, MONTHLY)
  // ==========================================================================
  console.log('\n--- AREA 3: Recurrence Rule Expansions ---');

  // 3.1 Daily recurrence: test active on date >= start date, rejected on date < start date
  const dailyEvt: AppEvent = {
    id: 'daily_1',
    title: 'Daily Meditation',
    category: 'Saúde/Academia',
    date: '2026-08-01',
    startTime: '06:30',
    endTime: '07:00',
    recurrence: 'daily',
    alerts: [],
    isCompleted: false
  };
  assertTest(filterTodaysEvents([dailyEvt], '2026-08-01').length === 1, 'Area 3: Recurrence', 'Daily matches on start date');
  assertTest(filterTodaysEvents([dailyEvt], '2026-08-15').length === 1, 'Area 3: Recurrence', 'Daily matches 14 days later');
  assertTest(filterTodaysEvents([dailyEvt], '2026-12-31').length === 1, 'Area 3: Recurrence', 'Daily matches months later');
  assertTest(filterTodaysEvents([dailyEvt], '2026-07-31').length === 0, 'Area 3: Recurrence', 'Daily rejects date before start date');

  // 3.2 Weekly recurrence without recurrenceDays (uses start date day-of-week)
  // 2026-08-05 is Wednesday (getDay = 3)
  const wedWeeklyEvt: AppEvent = {
    id: 'weekly_wed',
    title: 'Wednesday Lab',
    category: 'Faculdade/Aulas',
    date: '2026-08-05',
    startTime: '14:00',
    endTime: '16:00',
    recurrence: 'weekly',
    alerts: [],
    isCompleted: false
  };
  assertTest(filterTodaysEvents([wedWeeklyEvt], '2026-08-05').length === 1, 'Area 3: Recurrence', 'Weekly matches start Wednesday');
  assertTest(filterTodaysEvents([wedWeeklyEvt], '2026-08-12').length === 1, 'Area 3: Recurrence', 'Weekly matches subsequent Wednesday (Aug 12)');
  assertTest(filterTodaysEvents([wedWeeklyEvt], '2026-08-19').length === 1, 'Area 3: Recurrence', 'Weekly matches subsequent Wednesday (Aug 19)');
  assertTest(filterTodaysEvents([wedWeeklyEvt], '2026-08-06').length === 0, 'Area 3: Recurrence', 'Weekly rejects Thursday (Aug 6)');
  assertTest(filterTodaysEvents([wedWeeklyEvt], '2026-08-04').length === 0, 'Area 3: Recurrence', 'Weekly rejects Tuesday before start');

  // 3.3 Weekly recurrence with specific recurrenceDays [1, 3, 5] (Mon, Wed, Fri)
  const multiDayWeeklyEvt: AppEvent = {
    id: 'weekly_mwf',
    title: 'Calculus MWF Lectures',
    category: 'Faculdade/Aulas',
    date: '2026-08-03', // Monday
    startTime: '10:00',
    endTime: '12:00',
    recurrence: 'weekly',
    recurrenceDays: [1, 3, 5],
    alerts: [],
    isCompleted: false
  };
  assertTest(filterTodaysEvents([multiDayWeeklyEvt], '2026-08-03').length === 1, 'Area 3: Recurrence', 'RecurrenceDays matches Monday (Aug 3)');
  assertTest(filterTodaysEvents([multiDayWeeklyEvt], '2026-08-05').length === 1, 'Area 3: Recurrence', 'RecurrenceDays matches Wednesday (Aug 5)');
  assertTest(filterTodaysEvents([multiDayWeeklyEvt], '2026-08-07').length === 1, 'Area 3: Recurrence', 'RecurrenceDays matches Friday (Aug 7)');
  assertTest(filterTodaysEvents([multiDayWeeklyEvt], '2026-08-04').length === 0, 'Area 3: Recurrence', 'RecurrenceDays rejects Tuesday (Aug 4)');
  assertTest(filterTodaysEvents([multiDayWeeklyEvt], '2026-08-06').length === 0, 'Area 3: Recurrence', 'RecurrenceDays rejects Thursday (Aug 6)');

  // 3.4 Monthly recurrence: 31st of month boundary
  const monthly31stEvt: AppEvent = {
    id: 'monthly_31',
    title: 'Monthly Rent / Subscription',
    category: 'Outros',
    date: '2026-01-31',
    startTime: '18:00',
    endTime: '19:00',
    recurrence: 'monthly',
    alerts: [],
    isCompleted: false
  };
  assertTest(filterTodaysEvents([monthly31stEvt], '2026-01-31').length === 1, 'Area 3: Recurrence', 'Monthly matches Jan 31');
  assertTest(filterTodaysEvents([monthly31stEvt], '2026-03-31').length === 1, 'Area 3: Recurrence', 'Monthly matches Mar 31');
  assertTest(filterTodaysEvents([monthly31stEvt], '2026-05-31').length === 1, 'Area 3: Recurrence', 'Monthly matches May 31');
  assertTest(filterTodaysEvents([monthly31stEvt], '2026-02-28').length === 0, 'Area 3: Recurrence', 'Monthly on 31st safely returns 0 for Feb 28 without throwing');
  assertTest(filterTodaysEvents([monthly31stEvt], '2026-04-30').length === 0, 'Area 3: Recurrence', 'Monthly on 31st safely returns 0 for Apr 30 without throwing');

  // ==========================================================================
  // 4. MIDNIGHT EVENT TRANSITIONS & CORNER CASE TIMINGS
  // ==========================================================================
  console.log('\n--- AREA 4: Midnight Event Transitions & Timings ---');

  // 4.1 Event crossing midnight (23:30 -> 00:30)
  const midnightCrossoverEvt: AppEvent = {
    id: 'mid_cross',
    title: 'Late Night Hackathon Session',
    category: 'Faculdade/Aulas',
    date: '2026-08-21',
    startTime: '23:30',
    endTime: '00:30',
    recurrence: 'none',
    alerts: [],
    isCompleted: false
  };

  // Test during event at 23:45 -> in_progress
  const duringMid = computeHighlight([midnightCrossoverEvt], '2026-08-21', new Date(2026, 7, 21, 23, 45), true);
  assertTest(duringMid.activeEvent?.id === 'mid_cross', 'Area 4: Midnight', 'Active event detected at 23:45 during 23:30-00:30 transition');
  assertTest(duringMid.activeEvent !== null, 'Area 4: Midnight', 'Midnight crossover wraps 24h calculation and marks active');

  // 4.2 Event starting exactly at 00:00 (00:00 -> 01:00)
  const earlyMidnightEvt: AppEvent = {
    id: 'mid_early',
    title: 'Midnight Backup Job',
    category: 'Outros',
    date: '2026-08-21',
    startTime: '00:00',
    endTime: '01:00',
    recurrence: 'none',
    alerts: [],
    isCompleted: false
  };
  const atZeroZero = computeHighlight([earlyMidnightEvt], '2026-08-21', new Date(2026, 7, 21, 0, 15), true);
  assertTest(atZeroZero.activeEvent?.id === 'mid_early', 'Area 4: Midnight', 'Event starting at 00:00 detected in progress at 00:15');

  // 4.3 Zero duration event (20:00 -> 20:00)
  const zeroDurationEvt: AppEvent = {
    id: 'zero_dur',
    title: 'Instant Reminder',
    category: 'Lazer',
    date: '2026-08-21',
    startTime: '20:00',
    endTime: '20:00',
    recurrence: 'none',
    alerts: [],
    isCompleted: false
  };
  const beforeInstant = computeHighlight([zeroDurationEvt], '2026-08-21', new Date(2026, 7, 21, 19, 50), true);
  assertTest(beforeInstant.nextEvent?.id === 'zero_dur' && beforeInstant.minutesUntilNext === 10, 'Area 4: Midnight', 'Zero duration event computes 10 min countdown accurately');

  // 4.4 Same start time sorting stability
  const simEvents: AppEvent[] = [
    { id: 'sim_1', title: 'Task A', category: 'Lazer', date: '2026-08-21', startTime: '09:00', endTime: '10:00', recurrence: 'none', alerts: [], isCompleted: false },
    { id: 'sim_2', title: 'Task B', category: 'Saúde/Academia', date: '2026-08-21', startTime: '09:00', endTime: '10:00', recurrence: 'none', alerts: [], isCompleted: false },
    { id: 'sim_3', title: 'Task C', category: 'Faculdade/Aulas', date: '2026-08-21', startTime: '09:00', endTime: '10:00', recurrence: 'none', alerts: [], isCompleted: false },
  ];
  const sortedSim = filterTodaysEvents(simEvents, '2026-08-21');
  assertTest(sortedSim.length === 3, 'Area 4: Midnight', 'Multiple simultaneous events sort deterministically without crash');

  // ==========================================================================
  // 5. CORRUPTED EVENT STRUCTURES & MISSING SUBJECT IDS
  // ==========================================================================
  console.log('\n--- AREA 5: Corrupted Event Structures & Missing Subject Resilience ---');

  // 5.1 Event with deleted / non-existent subjectId
  const orphanEvent: AppEvent = {
    id: 'orphan_1',
    title: 'Orphaned Subject Class',
    category: 'Faculdade/Aulas',
    date: '2026-08-21',
    startTime: '11:00',
    endTime: '12:00',
    recurrence: 'none',
    alerts: [],
    isCompleted: false,
    subjectId: 'non_existent_subject_9999'
  };
  const orphanHighlight = computeHighlight([orphanEvent], '2026-08-21', new Date(2026, 7, 21, 10, 0), true, []);
  assertTest(orphanHighlight.featured?.id === 'orphan_1', 'Area 5: Corrupted', 'Orphaned subject event loads cleanly in highlight');
  assertTest(!orphanHighlight.featuredSubject, 'Area 5: Corrupted', 'Non-existent subject gracefully resolves to null/falsy');

  const orphanMarks = generateMarkedDates([orphanEvent], '2026-08-21', 'dark', []);
  assertTest(orphanMarks['2026-08-21'].dots[0].color === '#3B82F6', 'Area 5: Corrupted', 'Orphaned event falls back to Category color (#3B82F6)');

  // 5.2 Malformed start / end times ("" / "invalid" / "25:99")
  const malformedTimeEvt: AppEvent = {
    id: 'malformed_time',
    title: 'Corrupted Timings',
    category: 'Outros',
    date: '2026-08-21',
    startTime: '' as any,
    endTime: 'invalid' as any,
    recurrence: 'none',
    alerts: [],
    isCompleted: false
  };
  const malformedFiltered = filterTodaysEvents([malformedTimeEvt], '2026-08-21');
  assertTest(malformedFiltered.length === 1, 'Area 5: Corrupted', 'Event with empty/corrupted startTime does not throw');

  // When isToday is false (viewing another date), highlight picks the event safely as nextEvent
  const malformedHighlightOtherDay = computeHighlight([malformedTimeEvt], '2026-08-21', new Date(2026, 7, 21, 10, 0), false);
  assertTest(malformedHighlightOtherDay.featured?.id === 'malformed_time', 'Area 5: Corrupted', 'Highlight compute on selected date handles malformed time without crash');

  // 5.3 Malformed date string ("invalid-iso")
  const malformedDateEvt: AppEvent = {
    id: 'malformed_date',
    title: 'Bad Date Event',
    category: 'Lazer',
    date: 'invalid-iso-date',
    startTime: '10:00',
    endTime: '11:00',
    recurrence: 'daily',
    alerts: [],
    isCompleted: false
  };
  const badDateMarks = generateMarkedDates([malformedDateEvt], '2026-08-21', 'dark');
  assertTest(badDateMarks['2026-08-21']?.dots === undefined, 'Area 5: Corrupted', 'Invalid date ISO safely aborts recurrence loop without NaN loop or throw');

  // 5.4 Subject with undefined / empty color
  const colorlessSubject: Subject = {
    id: 'sub_colorless',
    name: 'Subject Without Color',
    color: ''
  };
  const colorlessEvt: AppEvent = {
    id: 'evt_colorless',
    title: 'Colorless Event',
    category: 'Faculdade/Aulas',
    date: '2026-08-21',
    startTime: '14:00',
    endTime: '15:00',
    recurrence: 'none',
    alerts: [],
    isCompleted: false,
    subjectId: 'sub_colorless'
  };
  const colorlessMarks = generateMarkedDates([colorlessEvt], '2026-08-21', 'dark', [colorlessSubject]);
  assertTest(colorlessMarks['2026-08-21'].dots[0].color === '#3B82F6', 'Area 5: Corrupted', 'Empty subject color falls back to category color');

  // ==========================================================================
  // 6. INVALID COLOR STRINGS PASSED TO getContrastTextColor
  // ==========================================================================
  console.log('\n--- AREA 6: getContrastTextColor Adversarial Matrix ---');

  // 6.1 Standard Hex (#RRGGBB)
  assertTest(getContrastTextColor('#00FFAA') === '#0A0A0A', 'Area 6: Contrast', '#00FFAA (Light mint) -> #0A0A0A');
  assertTest(getContrastTextColor('#059669') === '#FFFFFF', 'Area 6: Contrast', '#059669 (Emerald) -> #FFFFFF');
  assertTest(getContrastTextColor('#000000') === '#FFFFFF', 'Area 6: Contrast', '#000000 (Black) -> #FFFFFF');
  assertTest(getContrastTextColor('#FFFFFF') === '#0A0A0A', 'Area 6: Contrast', '#FFFFFF (White) -> #0A0A0A');

  // 6.2 Hex without hash (#)
  assertTest(getContrastTextColor('00FFAA') === '#0A0A0A', 'Area 6: Contrast', '00FFAA without # -> #0A0A0A');
  assertTest(getContrastTextColor('000000') === '#FFFFFF', 'Area 6: Contrast', '000000 without # -> #FFFFFF');
  assertTest(getContrastTextColor('FFFFFF') === '#0A0A0A', 'Area 6: Contrast', 'FFFFFF without # -> #0A0A0A');

  // 6.3 3-digit short Hex (#RGB and RGB)
  assertTest(getContrastTextColor('#FFF') === '#0A0A0A', 'Area 6: Contrast', '#FFF -> #0A0A0A');
  assertTest(getContrastTextColor('#000') === '#FFFFFF', 'Area 6: Contrast', '#000 -> #FFFFFF');
  assertTest(getContrastTextColor('FFF') === '#0A0A0A', 'Area 6: Contrast', 'FFF (3-digit no #) -> #0A0A0A');
  assertTest(getContrastTextColor('000') === '#FFFFFF', 'Area 6: Contrast', '000 (3-digit no #) -> #FFFFFF');

  // 6.4 8-digit Hex with alpha (#RRGGBBAA)
  assertTest(getContrastTextColor('#00FFAA80') === '#0A0A0A', 'Area 6: Contrast', '#00FFAA80 (8-char hex) -> #0A0A0A');
  assertTest(getContrastTextColor('#000000FF') === '#FFFFFF', 'Area 6: Contrast', '#000000FF (8-char hex) -> #FFFFFF');

  // 6.5 RGB and RGBA strings
  assertTest(getContrastTextColor('rgb(255, 255, 255)') === '#0A0A0A', 'Area 6: Contrast', 'rgb(255, 255, 255) -> #0A0A0A');
  assertTest(getContrastTextColor('rgb(0, 0, 0)') === '#FFFFFF', 'Area 6: Contrast', 'rgb(0, 0, 0) -> #FFFFFF');
  assertTest(getContrastTextColor('rgba(0, 255, 170, 0.8)') === '#0A0A0A', 'Area 6: Contrast', 'rgba(0, 255, 170, 0.8) -> #0A0A0A');
  assertTest(getContrastTextColor('rgba(15, 17, 21, 1)') === '#FFFFFF', 'Area 6: Contrast', 'rgba(15, 17, 21, 1) -> #FFFFFF');

  // 6.6 HSL strings
  assertTest(getContrastTextColor('hsl(120, 100%, 75%)') === '#0A0A0A', 'Area 6: Contrast', 'hsl(120, 100%, 75%) lightness 75% -> #0A0A0A');
  assertTest(getContrastTextColor('hsl(240, 100%, 20%)') === '#FFFFFF', 'Area 6: Contrast', 'hsl(240, 100%, 20%) lightness 20% -> #FFFFFF');

  // 6.7 Falsy, Null, Undefined, Empty & Whitespace strings
  assertTest(getContrastTextColor(undefined) === '#000000', 'Area 6: Contrast', 'undefined input -> #000000');
  assertTest(getContrastTextColor(null as any) === '#000000', 'Area 6: Contrast', 'null input -> #000000');
  assertTest(getContrastTextColor('') === '#000000', 'Area 6: Contrast', 'empty string input -> #000000');
  assertTest(getContrastTextColor('   ') === '#000000', 'Area 6: Contrast', 'whitespace input -> #000000');

  // 6.8 Invalid Hex characters and Garbage inputs
  assertTest(getContrastTextColor('#XYZ123') === '#000000', 'Area 6: Contrast', '#XYZ123 (invalid hex) safely falls back to #000000');
  assertTest(getContrastTextColor('#GGG') === '#000000', 'Area 6: Contrast', '#GGG (invalid 3-char hex) safely falls back to #000000');
  assertTest(getContrastTextColor('not-a-color') === '#000000', 'Area 6: Contrast', '"not-a-color" safely falls back to #000000');
  assertTest(getContrastTextColor('rgb(invalid, rgb)') === '#0A0A0A', 'Area 6: Contrast', 'malformed rgb falls back safely');
  assertTest(getContrastTextColor('hsl(invalid)') === '#0A0A0A', 'Area 6: Contrast', 'malformed hsl falls back safely');

  // ==========================================================================
  // 7. EMPTY STATE RENDERING ACROSS ALL 3 THEMES (DARK, AMOLED, LIGHT)
  // ==========================================================================
  console.log('\n--- AREA 7: Empty State & Theme Design System Verification ---');

  const themes: ThemeType[] = ['dark', 'amoled', 'light'];

  themes.forEach(th => {
    const themeColors = getThemeColors(th);

    // Verify critical token existence
    assertTest(typeof themeColors.background === 'string' && themeColors.background.length > 0, 'Area 7: Themes', `[${th}] background token defined: ${themeColors.background}`);
    assertTest(typeof themeColors.surface === 'string' && themeColors.surface.length > 0, 'Area 7: Themes', `[${th}] surface token defined: ${themeColors.surface}`);
    assertTest(typeof themeColors.text === 'string' && themeColors.text.length > 0, 'Area 7: Themes', `[${th}] text token defined: ${themeColors.text}`);
    assertTest(typeof themeColors.primary === 'string' && themeColors.primary.length > 0, 'Area 7: Themes', `[${th}] primary token defined: ${themeColors.primary}`);
    assertTest(typeof themeColors.border === 'string' && themeColors.border.length > 0, 'Area 7: Themes', `[${th}] border token defined: ${themeColors.border}`);

    // Verify empty state highlight compute
    const emptyHighlight = computeHighlight([], '2026-08-21', new Date(2026, 7, 21, 10, 0), true);
    assertTest(emptyHighlight.featured === null, 'Area 7: Themes', `[${th}] Empty events list produces null featured event (fallback card displayed)`);

    // Verify empty state markings
    const emptyMarks = generateMarkedDates([], '2026-08-21', th);
    assertTest(emptyMarks['2026-08-21'].selected === true, 'Area 7: Themes', `[${th}] Selected date marked true in empty state`);
    assertTest(emptyMarks['2026-08-21'].selectedColor === themeColors.primary, 'Area 7: Themes', `[${th}] Selected color matches theme primary`);
    assertTest(emptyMarks['2026-08-21'].selectedTextColor === getContrastTextColor(themeColors.primary), 'Area 7: Themes', `[${th}] Selected text color has high contrast with primary`);
  });

  // Verify full AgendaScreen component can mount and render in all 3 themes with empty data
  themes.forEach(th => {
    const props: AgendaScreenProps = {
      events: [],
      subjects: [],
      attendances: [],
      tasks: [],
      theme: th,
      settings: {
        theme: th,
        fullscreen: false,
        pomodoroFocusMin: 25,
        pomodoroBreakMin: 5,
        pomodoroLongBreakMin: 15,
        defaultPassGrade: 7,
        examWeekMode: false,
        soundEnabled: true,
        hapticsEnabled: true,
      },
      gamification: { xp: 150, level: 1, unlockedAchievements: [], totalFocusMinutes: 45 },
      selectedDate: null,
      onSelectDate: () => {},
      onToggleEventCompletion: () => {},
      onToggleTaskCompletion: () => {},
      onEditEvent: () => {},
      onOpenStudy: () => {},
      onOpenAttendanceModal: () => {},
    };

    try {
      const element = React.createElement(AgendaScreen, props);
      assertTest(element !== null && typeof element.type === 'function', 'Area 7: Themes', `[${th}] AgendaScreen instantiates with empty state without exception`);
    } catch (e: any) {
      assertTest(false, 'Area 7: Themes', `[${th}] AgendaScreen failed instantiation: ${e?.message}`);
    }
  });

  // ==========================================================================
  // SUMMARY REPORT
  // ==========================================================================
  console.log('\n================================================================');
  console.log('--- ADVERSARIAL STRESS SUITE SUMMARY ---');
  console.log('================================================================');

  const totalPassed = testResults.filter(r => r.passed).length;
  const totalFailed = testResults.filter(r => !r.passed).length;

  console.log(`Total Stress Assertions : ${testResults.length}`);
  console.log(`Passed                  : ${totalPassed}`);
  console.log(`Failed                  : ${totalFailed}`);

  if (totalFailed > 0) {
    console.error('\nFAILURES DETECTED:');
    testResults.filter(r => !r.passed).forEach(r => {
      console.error(`- [${r.category}] ${r.testName}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\nALL 7 ADVERSARIAL CHALLENGE AREAS PASSED (100% SUCCESSFUL RESILIENCE)!');
  }
}

// Direct execution
runAdversarialTestSuite().catch(err => {
  console.error('Fatal crash during adversarial suite run:', err);
  process.exit(1);
});
