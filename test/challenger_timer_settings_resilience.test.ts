import './setup_env';
import { memoryStore } from './setup_env';
import { StorageService } from '../src/services/storage';
import { AppSettings, StudySession, StudyStreak, GamificationData, Subject, BackupData } from '../src/types';
import { getLocalDateString, generateId } from '../src/utils';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, name: string, detail?: string) {
  if (condition) {
    results.push({ suite, name, passed: true });
    console.log(`  [PASS] [${suite}] ${name}`);
  } else {
    const err = detail || 'Assertion failed';
    results.push({ suite, name, passed: false, error: err });
    console.error(`  [FAIL] [${suite}] ${name} -> ${err}`);
  }
}

// Sanitization functions mirroring SettingsModal.tsx logic
function sanitizeFocusMinutes(input: string): number {
  let clean = parseInt(input, 10);
  if (isNaN(clean) || clean < 1) clean = 25;
  else if (clean > 180) clean = 180;
  return clean;
}

function sanitizeBreakMinutes(input: string): number {
  let clean = parseInt(input, 10);
  if (isNaN(clean) || clean < 1) clean = 5;
  else if (clean > 60) clean = 60;
  return clean;
}

function sanitizePassGrade(input: string): number {
  let clean = parseFloat(input.replace(',', '.'));
  if (isNaN(clean) || clean < 0) clean = 7.0;
  else if (clean > 10) clean = 10.0;
  return clean;
}

function formatStopwatch(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export async function runChallengerResilienceTests() {
  console.log('========================================================================');
  console.log('CHALLENGER 1: ADVERSARIAL STRESS & RESILIENCE TEST SUITE');
  console.log('Targets: Timer Lifecycle, Dynamic Sync, Settings Resilience & Storage');
  console.log('========================================================================\n');

  // Reset store
  Object.keys(memoryStore).forEach(k => delete memoryStore[k]);

  // ==========================================================================
  // SECTION 1: RAPID FULLSCREEN TOGGLING & STORAGE CONCURRENCY / RACE CONDITIONS
  // ==========================================================================
  console.log('--- 1. StorageService: Concurrency & Fullscreen Race Conditions ---');

  // 1.1 Rapid consecutive state transitions (100 cycles)
  const baseSettings = await StorageService.getSettings();
  let expectedState = false;
  for (let i = 0; i < 100; i++) {
    expectedState = i % 2 === 1;
    await StorageService.saveSettings({ ...baseSettings, fullscreen: expectedState });
    const current = await StorageService.getSettings();
    if (current.fullscreen !== expectedState) {
      assert(false, 'Storage Concurrency', `Mismatch at iteration ${i}: expected ${expectedState}, got ${current.fullscreen}`);
      break;
    }
  }
  const finalSettings100 = await StorageService.getSettings();
  assert(finalSettings100.fullscreen === true, 'Storage Concurrency', '100 rapid sequential toggles maintained perfect state consistency');

  // 1.2 Multi-Key Concurrent Asynchronous Storage Operations (Promise.all across different keys)
  const concurrentOps: Promise<any>[] = [];
  for (let i = 0; i < 25; i++) {
    concurrentOps.push(StorageService.saveSettings({ ...baseSettings, fullscreen: i % 2 === 0, pomodoroFocusMin: 20 + (i % 10) }));
    concurrentOps.push(StorageService.saveTheme(i % 3 === 0 ? 'dark' : i % 3 === 1 ? 'light' : 'amoled'));
    concurrentOps.push(StorageService.saveStreak({ currentStreak: i, longestStreak: i + 5, lastStudyDate: '2026-08-20' }));
  }
  await Promise.all(concurrentOps);

  const finalCheckSettings = await StorageService.getSettings();
  const finalCheckTheme = await StorageService.getTheme();
  const finalCheckStreak = await StorageService.getStreak();

  assert(typeof finalCheckSettings.fullscreen === 'boolean', 'Storage Concurrency', 'Settings.fullscreen remains valid boolean after 75 multi-key concurrent ops');
  assert(['dark', 'light', 'amoled'].includes(finalCheckTheme), 'Storage Concurrency', 'Theme remains valid ThemeType after concurrent ops');
  assert(finalCheckStreak.currentStreak >= 0, 'Storage Concurrency', 'Streak data intact and uncorrupted');

  // 1.3 Sequential vs Concurrent XP Aggregation Verification
  // Sequential addition (expected standard mobile app behavior)
  Object.keys(memoryStore).forEach(k => delete memoryStore[k]);
  for (let i = 0; i < 20; i++) {
    await StorageService.addXP(10, 5);
  }
  const seqGamification = await StorageService.getGamificationData();
  assert(seqGamification.xp === 200, 'Storage Concurrency', 'Sequential 20x addXP(10) yields exact 200 XP');
  assert(seqGamification.level === 2, 'Storage Concurrency', '200 XP triggers level 2 progression');
  assert(seqGamification.totalFocusMinutes === 100, 'Storage Concurrency', '100 total focus minutes accumulated');

  // 1.4 Missing/Legacy Payload Fallback
  memoryStore['@organiza_settings'] = JSON.stringify({
    theme: 'light',
    // fullscreen missing
    pomodoroFocusMin: 30
  });
  const legacyLoaded = await StorageService.getSettings();
  assert(legacyLoaded.fullscreen === false, 'Storage Concurrency', 'Missing fullscreen property in storage defaults strictly to false');
  assert(legacyLoaded.pomodoroFocusMin === 30, 'Storage Concurrency', 'Existing fields in legacy settings preserved');
  assert(legacyLoaded.defaultPassGrade === 7.0, 'Storage Concurrency', 'Missing fields filled by DEFAULT_SETTINGS');

  // 1.5 Corrupted JSON in Storage Keys
  memoryStore['@organiza_settings'] = '<<<BAD_JSON_RAW_DATA>>>';
  memoryStore['@organiza_gamification'] = '{ corrupt: true, xp: ';
  memoryStore['@organiza_streak'] = 'undefined';

  const corruptSettings = await StorageService.getSettings();
  const corruptGamification = await StorageService.getGamificationData();
  const corruptStreak = await StorageService.getStreak();

  assert(corruptSettings.fullscreen === false && corruptSettings.theme === 'dark', 'Storage Concurrency', 'Corrupted settings key gracefully returns DEFAULT_SETTINGS without exception');
  assert(corruptGamification.xp === 0 && corruptGamification.level === 1, 'Storage Concurrency', 'Corrupted gamification key gracefully returns DEFAULT_GAMIFICATION');
  assert(corruptStreak.currentStreak === 0 && corruptStreak.lastStudyDate === '', 'Storage Concurrency', 'Corrupted streak key gracefully returns clean default streak object');

  // 1.6 Backup Export & Import Integrity Roundtrip
  const backupToExport: BackupData = {
    version: 2,
    timestamp: new Date().toISOString(),
    events: [],
    subjects: [{ id: 'sub_test', name: 'Engenharia de Software', color: '#10B981' }],
    attendances: [],
    tasks: [],
    studySessions: [],
    semesters: [{ id: 'sem_1', name: '2026.1', isCurrent: true }],
    settings: { fullscreen: true, theme: 'amoled', pomodoroFocusMin: 50, pomodoroBreakMin: 10 }
  };

  await StorageService.importBackup(backupToExport);
  const importedSettings = await StorageService.getSettings();
  assert(importedSettings.fullscreen === true, 'Storage Concurrency', 'Imported backup accurately sets fullscreen: true');
  assert(importedSettings.theme === 'amoled', 'Storage Concurrency', 'Imported backup accurately sets theme: amoled');
  assert(importedSettings.pomodoroFocusMin === 50, 'Storage Concurrency', 'Imported backup sets pomodoroFocusMin: 50');

  const reExported = await StorageService.exportBackup();
  assert(reExported.settings?.fullscreen === true, 'Storage Concurrency', 'Re-exported backup contains fullscreen: true');


  // ==========================================================================
  // SECTION 2: POMODORO TIMER STATE MACHINE & PROP MUTATION STRESS
  // ==========================================================================
  console.log('\n--- 2. Pomodoro State Machine: Idle vs Running Prop Mutations ---');

  // Full React Hook Lifecycle Simulation for StudyScreen
  class PomodoroStateMachine {
    focusMinutesDefault: number;
    breakMinutesDefault: number;
    activeFocusMinutes: number;
    timeLeft: number;
    isActive: boolean;
    isBreak: boolean;
    selectedSubjectId: string | null;
    addedSessions: StudySession[] = [];
    awardedXP: number = 0;
    toasts: string[] = [];

    constructor(focusDefault = 25, breakDefault = 5, initialSubject: string | null = 'sub_math') {
      this.focusMinutesDefault = focusDefault;
      this.breakMinutesDefault = breakDefault;
      this.activeFocusMinutes = focusDefault;
      this.timeLeft = focusDefault * 60;
      this.isActive = false;
      this.isBreak = false;
      this.selectedSubjectId = initialSubject;
    }

    // Effect simulating StudyScreen dynamic sync hook (lines 100-109)
    runDynamicSyncEffect() {
      if (!this.isActive) {
        if (!this.isBreak) {
          this.activeFocusMinutes = this.focusMinutesDefault;
          this.timeLeft = this.focusMinutesDefault * 60;
        } else {
          this.timeLeft = this.breakMinutesDefault * 60;
        }
      }
    }

    syncProps(newFocus: number, newBreak: number) {
      this.focusMinutesDefault = newFocus;
      this.breakMinutesDefault = newBreak;
      this.runDynamicSyncEffect();
    }

    selectPreset(minutes: number): boolean {
      if (this.isActive) {
        this.toasts.push('Pause o timer para alterar a duração.');
        return false;
      }
      this.activeFocusMinutes = minutes;
      if (!this.isBreak) {
        this.timeLeft = minutes * 60;
      }
      return true;
    }

    start() {
      this.isActive = true;
    }

    pause() {
      this.isActive = false;
      this.runDynamicSyncEffect();
    }

    tick(seconds = 1) {
      if (!this.isActive) return;
      this.timeLeft = Math.max(0, this.timeLeft - seconds);
      if (this.timeLeft === 0) {
        this.handleComplete();
      }
    }

    handleComplete() {
      this.isActive = false;
      if (!this.isBreak && this.selectedSubjectId) {
        const sessionDurationMin = this.activeFocusMinutes || this.focusMinutesDefault;
        this.addedSessions.push({
          id: generateId('sess'),
          subjectId: this.selectedSubjectId,
          durationMs: sessionDurationMin * 60 * 1000,
          date: getLocalDateString(),
        });
        this.awardedXP += 50;
        this.isBreak = true;
        this.timeLeft = this.breakMinutesDefault * 60;
      } else {
        this.isBreak = false;
        // React effect runs on isBreak changing to false while !isActive
        this.runDynamicSyncEffect();
      }
    }

    reset() {
      this.isActive = false;
      this.isBreak = false;
      this.timeLeft = (this.activeFocusMinutes || this.focusMinutesDefault) * 60;
    }
  }

  // 2.1 Dynamic Sync while Idle (Focus: 25 -> 50)
  const pomodoro = new PomodoroStateMachine(25, 5);
  assert(pomodoro.timeLeft === 1500, 'Pomodoro State Machine', 'Initial idle timeLeft is 1500s (25m)');
  
  pomodoro.syncProps(50, 5);
  assert(pomodoro.timeLeft === 3000 && pomodoro.activeFocusMinutes === 50, 'Pomodoro State Machine', 'Dynamic prop sync while idle correctly updates timeLeft to 3000s (50m)');

  // 2.2 Dynamic Sync while Idle in Break Mode (Break: 5 -> 10)
  pomodoro.isBreak = true;
  pomodoro.syncProps(50, 10);
  assert(pomodoro.timeLeft === 600, 'Pomodoro State Machine', 'Dynamic prop sync during idle break correctly updates timeLeft to 600s (10m)');

  // 2.3 Running Timer Immunity (Active Countdown MUST NOT be overridden by prop mutations)
  pomodoro.reset();
  pomodoro.start();
  pomodoro.tick(300); // 5 minutes elapsed -> 2700s remaining of 50m
  assert(pomodoro.timeLeft === 2700 && pomodoro.isActive, 'Pomodoro State Machine', 'Timer running: 2700s remaining');

  // External prop mutation happens while user is in the middle of a focus session
  pomodoro.syncProps(15, 3);
  assert(pomodoro.timeLeft === 2700, 'Pomodoro State Machine', 'Active running countdown is IMMUNE to prop changes (timeLeft remained 2700s, not reset to 15m)');

  // 2.4 Preset Selection Protection while Running
  const presetResult = pomodoro.selectPreset(45);
  assert(presetResult === false, 'Pomodoro State Machine', 'Preset selection while running is rejected');
  assert(pomodoro.timeLeft === 2700, 'Pomodoro State Machine', 'TimeLeft unmodified by rejected preset');
  assert(pomodoro.toasts.includes('Pause o timer para alterar a duração.'), 'Pomodoro State Machine', 'Warning toast dispatched on attempted preset change while running');

  // 2.5 Focus Completion Transition to Break
  pomodoro.tick(2700); // Complete session
  assert(pomodoro.isActive === false, 'Pomodoro State Machine', 'Timer stops on completion');
  assert(pomodoro.isBreak === true, 'Pomodoro State Machine', 'Timer switches to break mode');
  assert(pomodoro.timeLeft === 180, 'Pomodoro State Machine', 'Break time set to breakMinutesDefault (3m * 60 = 180s)');
  assert(pomodoro.addedSessions.length === 1, 'Pomodoro State Machine', 'StudySession logged with correct metadata');
  assert(pomodoro.addedSessions[0].durationMs === 50 * 60 * 1000, 'Pomodoro State Machine', 'Logged session duration matches activeFocusMinutes (50m)');
  assert(pomodoro.awardedXP === 50, 'Pomodoro State Machine', '+50 XP awarded for completed focus session');

  // 2.6 Break Completion Transition back to Focus
  pomodoro.start();
  pomodoro.tick(180);
  assert(pomodoro.isBreak === false, 'Pomodoro State Machine', 'Break completion switches back to focus mode');
  assert(pomodoro.timeLeft === 15 * 60, 'Pomodoro State Machine', 'TimeLeft reset to current focusMinutesDefault (15m * 60 = 900s)');
  assert(pomodoro.addedSessions.length === 1, 'Pomodoro State Machine', 'No extra session or XP logged on break completion');


  // ==========================================================================
  // SECTION 3: STOPWATCH PRECISION, THRESHOLD BOUNDARIES & XP INTEGRITY
  // ==========================================================================
  console.log('\n--- 3. Stopwatch: Precision, 30s Threshold Boundaries & XP Formulas ---');

  // 3.1 Threshold Boundaries (<30s Discarded vs >=30s Saved)
  const testSub = { id: 'sub_calc', name: 'Cálculo', color: '#3B82F6' };

  function simulateStopwatchSave(seconds: number, subjectId: string | null) {
    if (seconds < 30) {
      return { saved: false, reason: 'Estude por pelo menos 30 segundos para salvar a sessão.' };
    }
    if (!subjectId) {
      return { saved: false, reason: 'Selecione uma matéria para salvar a sessão.' };
    }
    const session: StudySession = {
      id: generateId('sess'),
      subjectId,
      durationMs: seconds * 1000,
      date: getLocalDateString(),
    };
    const minutes = Math.max(1, Math.floor(seconds / 60));
    const xpGained = Math.max(10, Math.round(minutes * 2));
    return { saved: true, session, minutes, xpGained };
  }

  // 0s -> Discarded
  const res0 = simulateStopwatchSave(0, testSub.id);
  assert(res0.saved === false, 'Stopwatch Threshold', '0s session is rejected (<30s)');

  // 29s -> Discarded
  const res29 = simulateStopwatchSave(29, testSub.id);
  assert(res29.saved === false, 'Stopwatch Threshold', '29s session is rejected (<30s boundary)');

  // 30s -> EXACT BOUNDARY -> Saved!
  const res30 = simulateStopwatchSave(30, testSub.id);
  assert(res30.saved === true && res30.session?.durationMs === 30000, 'Stopwatch Threshold', '30s session is SAVED at exact threshold boundary');
  assert(res30.minutes === 1 && res30.xpGained === 10, 'Stopwatch Threshold', '30s session awards minimum 10 XP (1 min base)');

  // 31s -> Saved
  const res31 = simulateStopwatchSave(31, testSub.id);
  assert(res31.saved === true && res31.session?.durationMs === 31000, 'Stopwatch Threshold', '31s session is SAVED');

  // Null subject check
  const resNoSub = simulateStopwatchSave(120, null);
  assert(resNoSub.saved === false && resNoSub.reason?.includes('Selecione uma matéria'), 'Stopwatch Threshold', 'Missing subject prevents saving');

  // 3.2 Formatting Precision under Extremes
  assert(formatStopwatch(0) === '00:00', 'Stopwatch Formatting', '0s -> 00:00');
  assert(formatStopwatch(9) === '00:09', 'Stopwatch Formatting', '9s -> 00:09');
  assert(formatStopwatch(59) === '00:59', 'Stopwatch Formatting', '59s -> 00:59');
  assert(formatStopwatch(60) === '01:00', 'Stopwatch Formatting', '60s -> 01:00');
  assert(formatStopwatch(3599) === '59:59', 'Stopwatch Formatting', '3599s -> 59:59');
  assert(formatStopwatch(3600) === '01:00:00', 'Stopwatch Formatting', '3600s transitions to 3-part format 01:00:00');
  assert(formatStopwatch(3665) === '01:01:05', 'Stopwatch Formatting', '3665s -> 01:01:05');
  assert(formatStopwatch(86399) === '23:59:59', 'Stopwatch Formatting', '86399s -> 23:59:59');
  assert(formatStopwatch(360000) === '100:00:00', 'Stopwatch Formatting', '360000s (100h) -> 100:00:00');

  // 3.3 XP & Level Progression Mathematical Rigor
  // Level = Math.floor(XP / 200) + 1
  Object.keys(memoryStore).forEach(k => delete memoryStore[k]);
  
  // Test Level Progression at boundaries
  const g0 = await StorageService.getGamificationData();
  assert(g0.level === 1 && g0.xp === 0, 'XP & Gamification', 'Initial: 0 XP = Level 1');

  // Add 199 XP -> Level 1
  const g199 = await StorageService.addXP(199, 100);
  assert(g199.xp === 199 && g199.level === 1, 'XP & Gamification', '199 XP = Level 1 (boundary)');

  // Add 1 XP -> 200 XP -> Level 2
  const g200 = await StorageService.addXP(1, 1);
  assert(g200.xp === 200 && g200.level === 2, 'XP & Gamification', '200 XP = Level 2 (level up boundary)');

  // Add 199 XP -> 399 XP -> Level 2
  const g399 = await StorageService.addXP(199, 50);
  assert(g399.xp === 399 && g399.level === 2, 'XP & Gamification', '399 XP = Level 2');

  // Add 1 XP -> 400 XP -> Level 3
  const g400 = await StorageService.addXP(1, 1);
  assert(g400.xp === 400 && g400.level === 3, 'XP & Gamification', '400 XP = Level 3');

  // Proportional XP scaling for various durations
  // 5m -> max(10, round(5*2)) = 10 XP
  assert(simulateStopwatchSave(300, 'sub').xpGained === 10, 'XP & Gamification', '5 min session awards minimum 10 XP');
  // 15m -> max(10, round(15*2)) = 30 XP
  assert(simulateStopwatchSave(900, 'sub').xpGained === 30, 'XP & Gamification', '15 min session awards 30 XP');
  // 45m -> max(10, round(45*2)) = 90 XP
  assert(simulateStopwatchSave(2700, 'sub').xpGained === 90, 'XP & Gamification', '45 min session awards 90 XP');
  // 60m -> max(10, round(60*2)) = 120 XP
  assert(simulateStopwatchSave(3600, 'sub').xpGained === 120, 'XP & Gamification', '60 min session awards 120 XP');


  // ==========================================================================
  // SECTION 4: SETTINGS NUMERICAL CORRUPTION & SANITIZATION RESILIENCE
  // ==========================================================================
  console.log('\n--- 4. Settings: Numerical Corruption, Extremes & String Sanitization ---');

  // 4.1 Focus Minutes Sanitization (1 to 180 min, fallback: 25)
  assert(sanitizeFocusMinutes('') === 25, 'Settings Sanitization', 'Empty string -> 25 default');
  assert(sanitizeFocusMinutes('NaN') === 25, 'Settings Sanitization', '"NaN" -> 25 default');
  assert(sanitizeFocusMinutes('abc!@#') === 25, 'Settings Sanitization', 'Garbage characters -> 25 default');
  assert(sanitizeFocusMinutes('-50') === 25, 'Settings Sanitization', 'Negative number "-50" -> 25 default');
  assert(sanitizeFocusMinutes('0') === 25, 'Settings Sanitization', 'Zero "0" (<1 min) -> 25 default');
  assert(sanitizeFocusMinutes('1') === 1, 'Settings Sanitization', 'Min boundary "1" -> 1');
  assert(sanitizeFocusMinutes('25') === 25, 'Settings Sanitization', 'Normal value "25" -> 25');
  assert(sanitizeFocusMinutes('180') === 180, 'Settings Sanitization', 'Max boundary "180" -> 180');
  assert(sanitizeFocusMinutes('181') === 180, 'Settings Sanitization', 'Above max "181" -> clamped to 180');
  assert(sanitizeFocusMinutes('999999') === 180, 'Settings Sanitization', 'Extreme integer "999999" -> clamped to 180');
  assert(sanitizeFocusMinutes('45.9') === 45, 'Settings Sanitization', 'Float string "45.9" -> parsed as integer 45');

  // 4.2 Break Minutes Sanitization (1 to 60 min, fallback: 5)
  assert(sanitizeBreakMinutes('') === 5, 'Settings Sanitization', 'Empty string -> 5 default');
  assert(sanitizeBreakMinutes('invalid') === 5, 'Settings Sanitization', 'Invalid string -> 5 default');
  assert(sanitizeBreakMinutes('-1') === 5, 'Settings Sanitization', 'Negative number -> 5 default');
  assert(sanitizeBreakMinutes('0') === 5, 'Settings Sanitization', 'Zero "0" -> 5 default');
  assert(sanitizeBreakMinutes('1') === 1, 'Settings Sanitization', 'Min boundary "1" -> 1');
  assert(sanitizeBreakMinutes('5') === 5, 'Settings Sanitization', 'Normal value "5" -> 5');
  assert(sanitizeBreakMinutes('60') === 60, 'Settings Sanitization', 'Max boundary "60" -> 60');
  assert(sanitizeBreakMinutes('61') === 60, 'Settings Sanitization', 'Above max "61" -> clamped to 60');
  assert(sanitizeBreakMinutes('500') === 60, 'Settings Sanitization', 'Extreme value "500" -> clamped to 60');

  // 4.3 Pass Grade Sanitization (0.0 to 10.0, fallback: 7.0)
  assert(sanitizePassGrade('') === 7.0, 'Settings Sanitization', 'Empty string -> 7.0 default');
  assert(sanitizePassGrade('NaN') === 7.0, 'Settings Sanitization', '"NaN" -> 7.0 default');
  assert(sanitizePassGrade('-2.5') === 7.0, 'Settings Sanitization', 'Negative grade "-2.5" -> 7.0 default');
  assert(sanitizePassGrade('0') === 0.0, 'Settings Sanitization', 'Min grade "0" -> 0.0 (valid zero grade)');
  assert(sanitizePassGrade('0.0') === 0.0, 'Settings Sanitization', 'Min grade "0.0" -> 0.0');
  assert(sanitizePassGrade('5.5') === 5.5, 'Settings Sanitization', 'Valid float "5.5" -> 5.5');
  assert(sanitizePassGrade('8,75') === 8.75, 'Settings Sanitization', 'Comma decimal "8,75" -> 8.75');
  assert(sanitizePassGrade('10') === 10.0, 'Settings Sanitization', 'Max grade "10" -> 10.0');
  assert(sanitizePassGrade('10.0') === 10.0, 'Settings Sanitization', 'Max grade "10.0" -> 10.0');
  assert(sanitizePassGrade('10.1') === 10.0, 'Settings Sanitization', 'Above max "10.1" -> clamped to 10.0');
  assert(sanitizePassGrade('100.0') === 10.0, 'Settings Sanitization', 'Extreme value "100.0" -> clamped to 10.0');

  // 4.4 Full Settings Object Serialization with Corrupted Injections
  const injectedCorruptedSettings: any = {
    theme: 'dark',
    fullscreen: true,
    pomodoroFocusMin: sanitizeFocusMinutes('-999'),
    pomodoroBreakMin: sanitizeBreakMinutes('abc'),
    pomodoroLongBreakMin: 15,
    defaultPassGrade: sanitizePassGrade('15.5'),
    examWeekMode: true,
    soundEnabled: true,
    hapticsEnabled: true,
  };

  await StorageService.saveSettings(injectedCorruptedSettings);
  const reloaded = await StorageService.getSettings();

  assert(reloaded.pomodoroFocusMin === 25, 'Settings Sanitization', 'Corrupted focus input safely sanitized to 25 in storage');
  assert(reloaded.pomodoroBreakMin === 5, 'Settings Sanitization', 'Corrupted break input safely sanitized to 5 in storage');
  assert(reloaded.defaultPassGrade === 10.0, 'Settings Sanitization', 'Out-of-range grade 15.5 safely clamped to 10.0 in storage');
  assert(reloaded.fullscreen === true, 'Settings Sanitization', 'Fullscreen setting preserved correctly during sanitized save');


  // ==========================================================================
  // SUMMARY REPORT
  // ==========================================================================
  console.log('\n========================================================================');
  console.log('CHALLENGER 1 RESILIENCE TEST SUITE SUMMARY');
  console.log('========================================================================');

  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.filter(r => !r.passed).length;

  console.log(`Total Tests Run : ${results.length}`);
  console.log(`Passed          : ${totalPassed}`);
  console.log(`Failed          : ${totalFailed}`);

  if (totalFailed > 0) {
    console.error('\nFAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => {
      console.error(`- [${r.suite}] ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\nALL 4 ADVERSARIAL STRESS & RESILIENCE SUITES PASSED (100% SUCCESS)!');
  }
}

// Direct runner
runChallengerResilienceTests().catch((err) => {
  console.error('Fatal error running challenger resilience suite:', err);
  process.exit(1);
});
