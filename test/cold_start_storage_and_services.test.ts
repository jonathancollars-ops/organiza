import './setup_env';
import {
  StorageService,
  safeParseArray,
  safeParseObject,
  DEFAULT_SETTINGS,
  DEFAULT_GAMIFICATION,
  DEFAULT_STREAK,
} from '../src/services/storage';
import { AttendanceService } from '../src/services/AttendanceService';
import { AppUpdateService } from '../src/services/AppUpdateService';
import { calculateFinalGrade } from '../src/components/GradeEngine';
import { memoryStore } from './setup_env';
import { AppEvent, AttendanceRecord } from '../src/types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, description: string, details?: any) {
  totalTests++;
  if (!condition) {
    failedTests++;
    console.error(`  ❌ FAIL: ${description}`);
    if (details) console.error('     Details:', details);
    throw new Error(`Assertion failed: ${description}`);
  }
  passedTests++;
  console.log(`  ✅ PASS: ${description}`);
}

async function testSection(name: string, fn: () => Promise<void> | void) {
  console.log(`\n================================================================`);
  console.log(`⚔️  ADVERSARIAL SUITE: ${name}`);
  console.log(`================================================================`);
  await fn();
}

async function runColdStartTests() {
  console.log('################################################################');
  console.log('🛡️  MILESTONE 1: COLD START & STORAGE HARDENING VERIFICATION');
  console.log('################################################################');

  // ==========================================================================
  // SECTION 1: safeParseArray Primitives
  // ==========================================================================
  await testSection('safeParseArray Edge Cases & Malformed Payloads', () => {
    assert(Array.isArray(safeParseArray(null)), 'safeParseArray(null) returns array');
    assert(safeParseArray(null).length === 0, 'safeParseArray(null) is empty');
    assert(Array.isArray(safeParseArray(undefined)), 'safeParseArray(undefined) returns array');
    assert(Array.isArray(safeParseArray('')), 'safeParseArray("") returns array');
    assert(Array.isArray(safeParseArray('   ')), 'safeParseArray("   ") returns array');
    assert(Array.isArray(safeParseArray('null')), 'safeParseArray("null") returns array');
    assert(safeParseArray('null').length === 0, 'safeParseArray("null") is empty');
    assert(Array.isArray(safeParseArray('undefined')), 'safeParseArray("undefined") returns array');
    assert(Array.isArray(safeParseArray('{ "id": 1 }')), 'safeParseArray(object string) returns fallback array');
    assert(Array.isArray(safeParseArray('12345')), 'safeParseArray(number string) returns fallback array');
    assert(Array.isArray(safeParseArray('invalid json {')), 'safeParseArray(syntax error) returns fallback array');

    // Array with null elements
    const arrayWithNulls = safeParseArray<any>('[null, {"id":"e1"}, null, {"id":"e2"}, null]');
    assert(arrayWithNulls.length === 2, 'safeParseArray filters out null and undefined items');
    assert(arrayWithNulls[0].id === 'e1' && arrayWithNulls[1].id === 'e2', 'safeParseArray keeps valid elements');

    // Custom fallback
    const customFallback = [{ id: 'fallback' }];
    assert(safeParseArray('null', customFallback)[0].id === 'fallback', 'safeParseArray uses custom fallback on null string');
  });

  // ==========================================================================
  // SECTION 2: safeParseObject Primitives
  // ==========================================================================
  await testSection('safeParseObject Edge Cases & Malformed Payloads', () => {
    const fallback = { a: 1, b: 'test', c: true };
    assert(safeParseObject(null, fallback).a === 1, 'safeParseObject(null) returns fallback');
    assert(safeParseObject(undefined, fallback).b === 'test', 'safeParseObject(undefined) returns fallback');
    assert(safeParseObject('', fallback).c === true, 'safeParseObject("") returns fallback');
    assert(safeParseObject('null', fallback).a === 1, 'safeParseObject("null") returns fallback');
    assert(safeParseObject('undefined', fallback).b === 'test', 'safeParseObject("undefined") returns fallback');
    assert(safeParseObject('[1, 2, 3]', fallback).a === 1, 'safeParseObject(array string) returns fallback');
    assert(safeParseObject('12345', fallback).a === 1, 'safeParseObject(number string) returns fallback');
    assert(safeParseObject('invalid { json', fallback).a === 1, 'safeParseObject(syntax error) returns fallback');

    // Partial object merging
    const merged = safeParseObject('{"a": 99}', fallback);
    assert(merged.a === 99, 'safeParseObject merges parsed fields');
    assert(merged.b === 'test', 'safeParseObject retains missing fallback fields');
    assert(merged.c === true, 'safeParseObject retains missing boolean fallback fields');
  });

  // ==========================================================================
  // SECTION 3: StorageService Getters Under Hostile "null" Storage State
  // ==========================================================================
  await testSection('StorageService Under "null" Literal Storage Injection', async () => {
    // Inject literal string "null" into all keys
    const keys = [
      '@organiza_events',
      '@organiza_subjects',
      '@organiza_attendances',
      '@organiza_tasks',
      '@organiza_studysessions',
      '@organiza_semesters',
      '@organiza_settings',
      '@organiza_streak',
      '@organiza_aacc',
      '@organiza_group_projects',
      '@organiza_gamification',
      '@organiza_ai_config',
      '@organiza_theme',
    ];

    for (const key of keys) {
      memoryStore[key] = 'null';
    }

    const events = await StorageService.getEvents();
    assert(Array.isArray(events), 'getEvents() returns array under "null" storage');
    assert(events.length === 0, 'getEvents() is empty array');

    const subjects = await StorageService.getSubjects();
    assert(Array.isArray(subjects), 'getSubjects() returns array under "null" storage');

    const attendances = await StorageService.getAttendances();
    assert(Array.isArray(attendances), 'getAttendances() returns array under "null" storage');

    const tasks = await StorageService.getTasks();
    assert(Array.isArray(tasks), 'getTasks() returns array under "null" storage');

    const sessions = await StorageService.getStudySessions();
    assert(Array.isArray(sessions), 'getStudySessions() returns array under "null" storage');

    const semesters = await StorageService.getSemesters();
    assert(Array.isArray(semesters), 'getSemesters() returns array under "null" storage');
    assert(semesters.length > 0, 'getSemesters() automatically initializes current semester');
    assert(semesters[0].isCurrent === true, 'initialized semester is marked current');

    const settings = await StorageService.getSettings();
    assert(settings && typeof settings === 'object', 'getSettings() returns object under "null" storage');
    assert(settings.pomodoroFocusMin === DEFAULT_SETTINGS.pomodoroFocusMin, 'getSettings() has valid pomodoroFocusMin');
    assert(settings.defaultPassGrade === DEFAULT_SETTINGS.defaultPassGrade, 'getSettings() has valid defaultPassGrade');
    assert(typeof settings.fullscreen === 'boolean', 'getSettings() has boolean fullscreen');

    const streak = await StorageService.getStreak();
    assert(streak && typeof streak === 'object', 'getStreak() returns object under "null" storage');
    assert(streak.currentStreak === 0, 'getStreak() has numeric currentStreak');
    assert(streak.longestStreak === 0, 'getStreak() has numeric longestStreak');

    const aacc = await StorageService.getAACCActivities();
    assert(Array.isArray(aacc), 'getAACCActivities() returns array under "null" storage');

    const groupProjects = await StorageService.getGroupProjects();
    assert(Array.isArray(groupProjects), 'getGroupProjects() returns array under "null" storage');

    const gamification = await StorageService.getGamificationData();
    assert(gamification && typeof gamification === 'object', 'getGamificationData() returns object under "null" storage');
    assert(gamification.xp === 0, 'getGamificationData() has xp=0');
    assert(gamification.level === 1, 'getGamificationData() has level=1');
    assert(Array.isArray(gamification.unlockedAchievements), 'getGamificationData() has unlockedAchievements array');

    const aiConfig = await StorageService.getAIConfig();
    assert(aiConfig && typeof aiConfig === 'object', 'getAIConfig() returns object under "null" storage');
    assert(aiConfig.provider === 'gemini', 'getAIConfig() has default provider');

    const theme = await StorageService.getTheme();
    assert(theme === 'dark', 'getTheme() defaults to "dark" under "null" storage');
  });

  // ==========================================================================
  // SECTION 4: Gamification addXP Mathematics & Safety
  // ==========================================================================
  await testSection('Gamification addXP Calculations & Bounds', async () => {
    // Reset gamification
    await StorageService.saveGamificationData(DEFAULT_GAMIFICATION);

    const res1 = await StorageService.addXP(100, 25);
    assert(res1.xp === 200, 'addXP(100, 25) sets XP to 200 (50 study + 50 achievement + 100 generic)');
    assert(res1.totalFocusMinutes === 25, 'addXP adds 25 minutes');
    assert(res1.level === 2, 'Level becomes 2 at 200 XP');

    const res2 = await StorageService.addXP(150, 25);
    assert(res2.xp === 400, 'addXP(150, 25) sets XP to 400');
    assert(res2.totalFocusMinutes === 50, 'addXP totalFocusMinutes is 50');
    assert(res2.level === 3, 'Level advances to 3 at 400 XP');

    // Defensive NaN inputs
    const res3 = await StorageService.addXP(NaN as any, 'invalid' as any);
    assert(!isNaN(res3.xp), 'addXP guards against NaN input');
    assert(!isNaN(res3.totalFocusMinutes), 'addXP guards against invalid minutes input');
  });

  // ==========================================================================
  // SECTION 5: AttendanceService Hardening
  // ==========================================================================
  await testSection('AttendanceService Defensive Invariants', async () => {
    // 1. Calling with null, null
    const res1 = await AttendanceService.generatePendingAttendances(null, null);
    assert(Array.isArray(res1), 'generatePendingAttendances(null, null) returns array');
    assert(res1.length === 0, 'generatePendingAttendances(null, null) is empty');

    // 2. Calling with undefined, undefined
    const res2 = await AttendanceService.generatePendingAttendances(undefined, undefined);
    assert(Array.isArray(res2), 'generatePendingAttendances(undefined, undefined) returns array');

    // 3. Calling with corrupted array elements
    const corruptedEvents: any[] = [
      null,
      undefined,
      { id: 'evt1' }, // missing subjectId, date
      { id: 'evt2', category: 'Faculdade/Aulas', recurrence: 'weekly', subjectId: 'sub1', date: 'invalid-date' },
      { id: 'evt3', category: 'Faculdade/Aulas', recurrence: 'weekly', subjectId: 'sub1', date: '2026-08-01', endTime: 'invalid' },
    ];
    const corruptedRecords: any[] = [null, undefined, { id: 'att1', eventId: 'evt3', date: '2026-08-01' }];

    const res3 = await AttendanceService.generatePendingAttendances(corruptedEvents, corruptedRecords);
    assert(Array.isArray(res3), 'generatePendingAttendances survives corrupted events and records');
    assert(res3.every(r => r && typeof r === 'object'), 'All returned attendance records are valid objects');
  });

  // ==========================================================================
  // SECTION 6: AppUpdateService Hardening
  // ==========================================================================
  await testSection('AppUpdateService "null" Storage & URL Handling', async () => {
    memoryStore['@lumen_update_state'] = 'null';

    const state = await AppUpdateService.getUpdateState();
    assert(state && typeof state === 'object' && !Array.isArray(state), 'getUpdateState() returns valid empty object for "null" storage');
    assert(state.lastCheckedAt === undefined, 'lastCheckedAt is safely undefined without TypeError');

    // Calling openDownloadUrl with empty or null
    const resUrl1 = await AppUpdateService.openDownloadUrl('');
    assert(resUrl1 === false, 'openDownloadUrl("") returns false safely');
    const resUrl2 = await AppUpdateService.openDownloadUrl(null as any);
    assert(resUrl2 === false, 'openDownloadUrl(null) returns false safely');
  });

  // ==========================================================================
  // SECTION 7: GradeEngine calculateFinalGrade Guarding
  // ==========================================================================
  await testSection('GradeEngine calculateFinalGrade Defensive Input Handling', () => {
    const res1 = calculateFinalGrade(null, 7.0);
    assert(res1.score === 0, 'calculateFinalGrade(null, 7.0) returns score 0');
    assert(res1.hasMissingItems === false, 'calculateFinalGrade(null) hasMissingItems is false');

    const res2 = calculateFinalGrade(undefined, 7.0);
    assert(res2.score === 0, 'calculateFinalGrade(undefined, 7.0) returns score 0');

    const res3 = calculateFinalGrade([], 7.0);
    assert(res3.score === 0, 'calculateFinalGrade([], 7.0) returns score 0');

    // Corrupted groups with missing items arrays
    const corruptedGroups: any[] = [
      null,
      { id: 'g1', weight: 1 }, // missing items
      { id: 'g2', weight: 1, items: [null, { id: 'i1', weight: 1, maxGrade: 10, grade: 8 }] },
    ];
    const res4 = calculateFinalGrade(corruptedGroups, 7.0);
    assert(res4.score > 0, 'calculateFinalGrade processes valid items amidst corrupted groups');
  });

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('\n================================================================');
  console.log(`📊 COLD START RESILIENCE SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================');

  if (failedTests > 0) {
    console.error(`❌ FAILED: ${failedTests} tests failed.`);
    process.exit(1);
  } else {
    console.log('🎉 ALL COLD START & STORAGE HARDENING TESTS PASSED 100% GREEN!');
    process.exit(0);
  }
}

runColdStartTests().catch(err => {
  console.error('Fatal error running cold start tests:', err);
  process.exit(1);
});
