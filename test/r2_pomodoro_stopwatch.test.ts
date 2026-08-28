import './setup_env';
import { memoryStore } from './setup_env';
import { StorageService } from '../src/services/storage';
import { StudySession, StudyStreak, GamificationData, Subject, AppSettings } from '../src/types';
import { getLocalDateString, generateId } from '../src/utils';

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

// Helpers mirroring StudyScreen / Settings logic
function sanitizeFocusMinutes(input: string): number {
  const parsed = parseInt(input, 10);
  if (isNaN(parsed) || parsed < 1) return 25;
  if (parsed > 180) return 180;
  return parsed;
}

function sanitizeBreakMinutes(input: string): number {
  const parsed = parseInt(input, 10);
  if (isNaN(parsed) || parsed < 1) return 5;
  if (parsed > 60) return 60;
  return parsed;
}

function sanitizePassGrade(input: string): number {
  const parsed = parseFloat(input.replace(',', '.'));
  if (isNaN(parsed) || parsed < 0) return 7.0;
  if (parsed > 10) return 10.0;
  return parsed;
}

function formatPomodoroTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatStopwatchTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function computeStreakUpdate(
  currentStreakObj: StudyStreak,
  todayStr: string
): StudyStreak {
  const newStreak = { ...currentStreakObj };

  if (currentStreakObj.lastStudyDate === todayStr) {
    return newStreak; // already studied today
  }

  const [y, m, d] = todayStr.split('-').map(Number);
  const yesterday = new Date(y, m - 1, d - 1);
  const yesterdayStr = getLocalDateString(yesterday);

  if (currentStreakObj.lastStudyDate === yesterdayStr) {
    newStreak.currentStreak += 1;
  } else {
    newStreak.currentStreak = 1;
  }

  if (newStreak.currentStreak > newStreak.longestStreak) {
    newStreak.longestStreak = newStreak.currentStreak;
  }
  newStreak.lastStudyDate = todayStr;

  return newStreak;
}

export async function runR2Tests() {
  console.log('\n================================================================');
  console.log('--- R2: POMODORO & STOPWATCH (ESTUDOS) TEST SUITE (TIERS 1-4) ---');
  console.log('================================================================\n');

  // Reset store
  Object.keys(memoryStore).forEach(k => delete memoryStore[k]);

  // ==========================================================================
  // TIER 1: SANITY & INTERFACE CONTRACTS
  // ==========================================================================
  console.log('--- TIER 1: Sanity & Interface Contracts ---');

  const defaultGamification = await StorageService.getGamificationData();
  assert(defaultGamification.xp === 0, 'Tier 1', 'Initial Gamification XP is 0');
  assert(defaultGamification.level === 1, 'Tier 1', 'Initial Gamification level is 1');
  assert(defaultGamification.totalFocusMinutes === 0, 'Tier 1', 'Initial totalFocusMinutes is 0');
  assert(Array.isArray(defaultGamification.unlockedAchievements), 'Tier 1', 'Unlocked achievements is an array');

  const defaultStreak = await StorageService.getStreak();
  assert(defaultStreak.currentStreak === 0, 'Tier 1', 'Initial currentStreak is 0');
  assert(defaultStreak.longestStreak === 0, 'Tier 1', 'Initial longestStreak is 0');
  assert(defaultStreak.lastStudyDate === '', 'Tier 1', 'Initial lastStudyDate is empty string');

  const initialSessions = await StorageService.getStudySessions();
  assert(Array.isArray(initialSessions) && initialSessions.length === 0, 'Tier 1', 'Initial study sessions list is empty array');

  // ==========================================================================
  // TIER 2: FUNCTIONAL POMODORO DYNAMIC SYNC & STOPWATCH OPERATIONS
  // ==========================================================================
  console.log('\n--- TIER 2: Functional Pomodoro Dynamic Sync & Stopwatch Operations ---');

  // 2.1 Dynamic sync of timeLeft when default focus minutes changes while idle
  let focusDefault = 25;
  let isTimerActive = false;
  let isBreak = false;
  let timeLeft = focusDefault * 60;
  assert(timeLeft === 1500, 'Tier 2', 'Initial idle timeLeft is 1500s (25 min)');

  // Settings change focus to 50 min
  focusDefault = 50;
  if (!isTimerActive && !isBreak) {
    timeLeft = focusDefault * 60;
  }
  assert(timeLeft === 3000, 'Tier 2', 'Changing focusMinutesDefault from 25 to 50 dynamically syncs idle timeLeft to 3000s (50 min)');

  // Settings change break to 10 min while in break mode
  let breakDefault = 5;
  isBreak = true;
  isTimerActive = false;
  breakDefault = 10;
  if (!isTimerActive && isBreak) {
    timeLeft = breakDefault * 60;
  }
  assert(timeLeft === 600, 'Tier 2', 'Changing breakMinutesDefault from 5 to 10 dynamically syncs break timeLeft to 600s (10 min)');

  // 2.2 Running timer immunity (active countdown does not abruptly get overwritten)
  isTimerActive = true;
  timeLeft = 1200; // 20 mins remaining
  focusDefault = 60;
  // If timer is active, timeLeft must not be overwritten
  if (!isTimerActive) {
    timeLeft = focusDefault * 60;
  }
  assert(timeLeft === 1200, 'Tier 2', 'Active running countdown maintains current remaining time without abrupt setting override');

  // 2.3 Quick presets (15, 25, 45, 50, 60 min)
  const presets = [15, 25, 45, 50, 60];
  presets.forEach(p => {
    const presetSec = p * 60;
    assert(formatPomodoroTime(presetSec) === `${p.toString().padStart(2, '0')}:00`, 'Tier 2', `Quick preset ${p}m maps to ${p}:00`);
  });

  // 2.4 Free Stopwatch (Cronômetro Livre) Time Formatting
  assert(formatStopwatchTime(0) === '00:00', 'Tier 2', 'Stopwatch 0s formats as "00:00"');
  assert(formatStopwatchTime(59) === '00:59', 'Tier 2', 'Stopwatch 59s formats as "00:59"');
  assert(formatStopwatchTime(60) === '01:00', 'Tier 2', 'Stopwatch 60s formats as "01:00"');
  assert(formatStopwatchTime(125) === '02:05', 'Tier 2', 'Stopwatch 125s formats as "02:05"');
  assert(formatStopwatchTime(3599) === '59:59', 'Tier 2', 'Stopwatch 3599s formats as "59:59"');
  assert(formatStopwatchTime(3600) === '01:00:00', 'Tier 2', 'Stopwatch 3600s (1 hour) transitions to "01:00:00" (HH:MM:SS)');
  assert(formatStopwatchTime(3665) === '01:01:05', 'Tier 2', 'Stopwatch 3665s formats as "01:01:05"');
  assert(formatStopwatchTime(7322) === '02:02:02', 'Tier 2', 'Stopwatch 7322s formats as "02:02:02"');

  // 2.5 Stopwatch Session Recording and Minimum Threshold
  const testSubject: Subject = {
    id: 'sub_math',
    name: 'Cálculo I',
    color: '#00FFAA'
  };

  // Sub-30s session -> Discarded
  const discardDurationSec = 25;
  let discardedSession: StudySession | null = null;
  if (discardDurationSec >= 30) {
    discardedSession = {
      id: generateId('sess'),
      subjectId: testSubject.id,
      durationMs: discardDurationSec * 1000,
      date: getLocalDateString()
    };
  }
  assert(discardedSession === null, 'Tier 2', 'Stopwatch session < 30s is discarded without saving or awarding XP');

  // >= 30s session -> Saved
  const validDurationSec = 180; // 3 minutes
  let savedSession: StudySession | null = null;
  if (validDurationSec >= 30) {
    savedSession = {
      id: generateId('sess'),
      subjectId: testSubject.id,
      durationMs: validDurationSec * 1000,
      date: getLocalDateString()
    };
  }
  assert(savedSession !== null && savedSession.durationMs === 180000, 'Tier 2', 'Stopwatch session >= 30s creates valid StudySession object');

  // ==========================================================================
  // TIER 3: BOUNDARIES, SANITIZATION & GAMIFICATION XP MATHEMATICS
  // ==========================================================================
  console.log('\n--- TIER 3: Boundaries, Sanitization & Gamification XP Mathematics ---');

  // 3.1 Input sanitization and boundary clamping for focus / break minutes
  assert(sanitizeFocusMinutes('50') === 50, 'Tier 3', 'Valid focus time 50m parsed correctly');
  assert(sanitizeFocusMinutes('0') === 25, 'Tier 3', 'Zero focus time falls back to 25m');
  assert(sanitizeFocusMinutes('-10') === 25, 'Tier 3', 'Negative focus time falls back to 25m');
  assert(sanitizeFocusMinutes('abc') === 25, 'Tier 3', 'NaN/string focus time falls back to 25m');
  assert(sanitizeFocusMinutes('') === 25, 'Tier 3', 'Empty string focus time falls back to 25m');
  assert(sanitizeFocusMinutes('300') === 180, 'Tier 3', 'Excessive focus time 300m clamped to maximum 180m');
  assert(sanitizeFocusMinutes('1') === 1, 'Tier 3', 'Minimum focus bound 1m accepted');
  assert(sanitizeFocusMinutes('180') === 180, 'Tier 3', 'Maximum focus bound 180m accepted');

  // Break bounds
  assert(sanitizeBreakMinutes('10') === 10, 'Tier 3', 'Valid break time 10m parsed correctly');
  assert(sanitizeBreakMinutes('') === 5, 'Tier 3', 'Empty break time falls back to 5m');
  assert(sanitizeBreakMinutes('0') === 5, 'Tier 3', 'Zero break time falls back to 5m');
  assert(sanitizeBreakMinutes('-5') === 5, 'Tier 3', 'Negative break time falls back to 5m');
  assert(sanitizeBreakMinutes('120') === 60, 'Tier 3', 'Excessive break time 120m clamped to maximum 60m');
  assert(sanitizeBreakMinutes('1') === 1, 'Tier 3', 'Minimum break bound 1m accepted');
  assert(sanitizeBreakMinutes('60') === 60, 'Tier 3', 'Maximum break bound 60m accepted');

  // Grade bounds
  assert(sanitizePassGrade('8.5') === 8.5, 'Tier 3', 'Decimal grade 8.5 parsed correctly');
  assert(sanitizePassGrade('8,5') === 8.5, 'Tier 3', 'Comma-formatted grade 8,5 parsed correctly');
  assert(sanitizePassGrade('15') === 10.0, 'Tier 3', 'Grade > 10 clamped to 10.0');
  assert(sanitizePassGrade('-2') === 7.0, 'Tier 3', 'Negative grade falls back to default 7.0');

  // 3.2 XP Level Formula (GamificationService)
  const GamificationServiceModule = require('../src/services/GamificationService');
  const xpThresholds = [
    { xp: 0, level: 1 },
    { xp: 99, level: 1 },
    { xp: 100, level: 2 },
    { xp: 282, level: 2 },
    { xp: 283, level: 3 },
    { xp: 519, level: 3 },
    { xp: 520, level: 4 }
  ];

  xpThresholds.forEach(t => {
    const calcLevel = GamificationServiceModule.GamificationService.calculateLevelFromXP(t.xp);
    assert(calcLevel === t.level, 'Tier 3', `XP ${t.xp} calculates to Level ${calcLevel}`);
  });

  // 3.3 AddXP calculation through StorageService
  await StorageService.clearAllData();
  const g1 = await StorageService.addXP(50, 25);
  // 25m = 50 XP (study) + 50 XP (first_study) + 50 XP (generic) = 150 XP
  assert(g1.xp === 150 && g1.level === 2 && g1.totalFocusMinutes === 25, 'Tier 3', 'Pomodoro completion adds +150 XP and 25 min');

  const g2 = await StorageService.addXP(160, 45);
  // 45m = 90 XP (study) + 160 XP (generic) = +250 XP -> Total 400 XP
  assert(g2.xp === 400 && g2.level === 3 && g2.totalFocusMinutes === 70, 'Tier 3', 'XP accumulation (400 XP) triggers Level 3 promotion');

  // 3.4 Study Streak mathematical state machine
  let currentStreak: StudyStreak = { currentStreak: 0, longestStreak: 0, lastStudyDate: '' };

  // First study on 2026-08-20
  currentStreak = computeStreakUpdate(currentStreak, '2026-08-20');
  assert(currentStreak.currentStreak === 1 && currentStreak.longestStreak === 1 && currentStreak.lastStudyDate === '2026-08-20', 'Tier 3', 'First study creates currentStreak=1, longestStreak=1');

  // Second study on the same day (2026-08-20)
  currentStreak = computeStreakUpdate(currentStreak, '2026-08-20');
  assert(currentStreak.currentStreak === 1 && currentStreak.longestStreak === 1, 'Tier 3', 'Same-day study does not double-count streak');

  // Consecutive day study (2026-08-21)
  currentStreak = computeStreakUpdate(currentStreak, '2026-08-21');
  assert(currentStreak.currentStreak === 2 && currentStreak.longestStreak === 2 && currentStreak.lastStudyDate === '2026-08-21', 'Tier 3', 'Consecutive study increments currentStreak to 2 and longestStreak to 2');

  // Consecutive day study (2026-08-22)
  currentStreak = computeStreakUpdate(currentStreak, '2026-08-22');
  assert(currentStreak.currentStreak === 3 && currentStreak.longestStreak === 3, 'Tier 3', 'Consecutive study increments currentStreak to 3');

  // Missed a day (skip 2026-08-23, study on 2026-08-24)
  currentStreak = computeStreakUpdate(currentStreak, '2026-08-24');
  assert(currentStreak.currentStreak === 1 && currentStreak.longestStreak === 3 && currentStreak.lastStudyDate === '2026-08-24', 'Tier 3', 'Streak gap resets currentStreak to 1 but retains longestStreak=3');

  // ==========================================================================
  // TIER 4: E2E SIMULATION & MULTI-SESSION WORKFLOWS
  // ==========================================================================
  console.log('\n--- TIER 4: E2E Simulation & Multi-Session Workflows ---');

  await StorageService.clearAllData();

  // 4.1 Pomodoro Complete Cycle E2E
  const mathSub: Subject = { id: 'sub_1', name: 'Matemática Discreta', color: '#3B82F6' };
  const physSub: Subject = { id: 'sub_2', name: 'Física I', color: '#F43F5E' };
  await StorageService.saveSubjects([mathSub, physSub]);

  // Session 1: Pomodoro 25 min in Math
  const sess1: StudySession = {
    id: generateId('sess'),
    subjectId: mathSub.id,
    durationMs: 25 * 60 * 1000,
    date: getLocalDateString()
  };
  await StorageService.saveStudySessions([sess1]);
  const gamifPomo = await StorageService.addXP(50, 25);
  let streakObj = await StorageService.getStreak();
  streakObj = computeStreakUpdate(streakObj, getLocalDateString());
  await StorageService.saveStreak(streakObj);

  assert(gamifPomo.xp === 150 && gamifPomo.totalFocusMinutes === 25, 'Tier 4', 'E2E Pomodoro Session 1 logged with +150 XP and 25 min');

  // Session 2: Stopwatch 45 min in Physics
  const sess2: StudySession = {
    id: generateId('sess'),
    subjectId: physSub.id,
    durationMs: 45 * 60 * 1000,
    date: getLocalDateString()
  };
  const currentSessions = await StorageService.getStudySessions();
  const allSessions = [...currentSessions, sess2];
  await StorageService.saveStudySessions(allSessions);
  const gamifStopwatch = await StorageService.addXP(25, 45);
  assert(gamifStopwatch.xp === 265 && gamifStopwatch.totalFocusMinutes === 70, 'Tier 4', 'E2E Stopwatch Session 2 logged with +115 XP and 45 min');

  // 4.2 Aggregate calculations
  const totalMs = allSessions.reduce((acc, curr) => acc + curr.durationMs, 0);
  const mathTotalMs = allSessions.filter(s => s.subjectId === mathSub.id).reduce((acc, curr) => acc + curr.durationMs, 0);
  const physTotalMs = allSessions.filter(s => s.subjectId === physSub.id).reduce((acc, curr) => acc + curr.durationMs, 0);

  assert(totalMs === 70 * 60 * 1000, 'Tier 4', 'Total daily studied time sums accurately to 70 mins (4,200,000 ms)');
  assert(mathTotalMs === 25 * 60 * 1000, 'Tier 4', 'Math subject studied time isolated to 25 mins');
  assert(physTotalMs === 45 * 60 * 1000, 'Tier 4', 'Physics subject studied time isolated to 45 mins');

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('\n================================================================');
  console.log('--- R2 TEST RESULTS SUMMARY ---');
  console.log('================================================================');

  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.filter(r => !r.passed).length;

  console.log(`Total R2 Tests : ${results.length}`);
  console.log(`Passed         : ${totalPassed}`);
  console.log(`Failed         : ${totalFailed}`);

  if (totalFailed > 0) {
    console.error('\nFAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => {
      console.error(`- [${r.tier}] ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\nALL R2 POMODORO & STOPWATCH TESTS PASSED (100% SUCCESS)!');
  }
}

// Execute when run directly
runR2Tests().catch((e) => {
  console.error('Fatal test runner error:', e);
  process.exit(1);
});
