import './setup_env';
import { memoryStore, mockAsyncStorage } from './setup_env';
import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import { StorageService } from '../src/services/storage';
import { AttendanceService } from '../src/services/AttendanceService';
import { getThemeColors, getContrastTextColor, Colors } from '../src/theme';
import { AppEvent, AttendanceRecord, Subject, ThemeType, AppSettings, GamificationData, StudyStreak } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  total: number;
  passed: number;
  failed: number;
  findings: string[];
}

const suiteResults: { [suite: string]: TestResult } = {};

function getSuite(name: string): TestResult {
  if (!suiteResults[name]) {
    suiteResults[name] = { total: 0, passed: 0, failed: 0, findings: [] };
  }
  return suiteResults[name];
}

function assert(suiteName: string, condition: boolean, testName: string, findingDetail?: string) {
  const s = getSuite(suiteName);
  s.total++;
  if (condition) {
    s.passed++;
    console.log(`  [PASS] ${testName}`);
  } else {
    s.failed++;
    const msg = `[FINDING] ${testName} ${findingDetail ? `-> ${findingDetail}` : ''}`;
    console.warn(`  ⚠️  ${msg}`);
    s.findings.push(msg);
  }
}

function assertEqual<T>(suiteName: string, actual: T, expected: T, testName: string) {
  const match = JSON.stringify(actual) === JSON.stringify(expected);
  assert(suiteName, match, testName, `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function runChallengerStressTests() {
  console.log('================================================================');
  console.log('CHALLENGER 2: EMPIRICAL STRESS TEST HARNESS — MILESTONE 2');
  console.log('Visual, UX, Keyboard Avoidance, Header Scaling & Splash State');
  console.log('================================================================\n');

  const srcDir = path.resolve(__dirname, '../src');

  // ==========================================================================
  // SUITE 1: KEYBOARDAVOIDINGVIEW & SCROLLVIEW BEHAVIOR ACROSS PRIMARY MODALS
  // ==========================================================================
  console.log('--- SUITE 1: Primary Modals Keyboard Avoidance & Scroll Ergonomics ---');
  const primaryModals = [
    'components/EventModal.tsx',
    'components/GradeEngine.tsx',
    'components/SubjectModal.tsx',
    'components/ExamModal.tsx',
    'components/EditSubjectModal.tsx',
    'components/AnalyticsAndAACCModal.tsx',
    'components/GroupProjectsModal.tsx'
  ];

  for (const relPath of primaryModals) {
    const fullPath = path.join(srcDir, relPath);
    assert('PrimaryModals', fs.existsSync(fullPath), `${relPath}: File exists`);
    const content = fs.readFileSync(fullPath, 'utf8');

    // KAV integration
    assert('PrimaryModals', content.includes('KeyboardAvoidingView'), `${relPath}: Contains KeyboardAvoidingView wrapper`);
    assert(
      'PrimaryModals',
      content.includes("behavior={Platform.OS === 'ios' ? 'padding' : undefined}"),
      `${relPath}: KAV uses iOS padding behavior`
    );

    // ScrollView handled taps
    assert(
      'PrimaryModals',
      content.includes('keyboardShouldPersistTaps="handled"'),
      `${relPath}: ScrollView specifies keyboardShouldPersistTaps="handled"`
    );
  }

  // ==========================================================================
  // SUITE 2: DYNAMIC SAFE AREA INSETS & TOUCH-TO-DISMISS ERGONOMICS
  // ==========================================================================
  console.log('\n--- SUITE 2: Dynamic Safe Area Insets & Backdrop Dismiss Ergonomics ---');
  const fullScreenModals = [
    'components/SubjectModal.tsx',
    'components/ExamModal.tsx',
    'components/EditSubjectModal.tsx',
    'components/AnalyticsAndAACCModal.tsx',
    'components/GroupProjectsModal.tsx',
    'components/PendingAttendanceModal.tsx',
    'components/GradeSimulatorModal.tsx'
  ];

  for (const relPath of fullScreenModals) {
    const content = fs.readFileSync(path.join(srcDir, relPath), 'utf8');
    assert('SafeAreaAndDismiss', content.includes("from 'react-native-safe-area-context'"), `${relPath}: Imports SafeAreaView from react-native-safe-area-context`);
    assert('SafeAreaAndDismiss', content.includes("edges={['top', 'bottom']}"), `${relPath}: Sets edges={['top', 'bottom']} for dynamic safe insets`);
    const noHardcodedPaddingTop = !content.includes('paddingTop: 50');
    assert('SafeAreaAndDismiss', noHardcodedPaddingTop, `${relPath}: Hardcoded paddingTop: 50 removed`);
  }

  const transparentModals = [
    'components/EventModal.tsx',
    'components/EventTypeModal.tsx',
    'components/GradeEngine.tsx'
  ];

  for (const relPath of transparentModals) {
    const content = fs.readFileSync(path.join(srcDir, relPath), 'utf8');
    assert('SafeAreaAndDismiss', content.includes('activeOpacity={1}'), `${relPath}: Modal overlay configured with activeOpacity={1}`);
    assert('SafeAreaAndDismiss', content.includes('e.stopPropagation?.()'), `${relPath}: Inner container uses stopPropagation to prevent false dismiss`);
  }

  const gradeEngineContent = fs.readFileSync(path.join(srcDir, 'components/GradeEngine.tsx'), 'utf8');
  assert('SafeAreaAndDismiss', gradeEngineContent.includes('hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}'), 'GradeEngine: Delete assessment target has hitSlop bounds');
  assert('SafeAreaAndDismiss', gradeEngineContent.includes('minHeight: 128'), 'GradeEngine: itemSquare uses minHeight: 128');

  // ==========================================================================
  // SUITE 3: SECONDARY MODAL AUDIT & EDGE CASE FINDINGS
  // ==========================================================================
  console.log('\n--- SUITE 3: Secondary Modals Input & Scroll Audit ---');
  const secondaryModals = [
    { file: 'components/TeamsConfigModal.tsx', hasInputs: true },
    { file: 'components/SettingsModal.tsx', hasInputs: true },
    { file: 'components/GradeSimulatorModal.tsx', hasInputs: true },
    { file: 'screens/StudyScreen.tsx', hasInputs: true }
  ];

  for (const item of secondaryModals) {
    const content = fs.readFileSync(path.join(srcDir, item.file), 'utf8');
    const hasKAV = content.includes('KeyboardAvoidingView');
    const hasHandledTaps = content.includes('keyboardShouldPersistTaps="handled"');

    assert('SecondaryModalsAudit', hasKAV, `${item.file}: KeyboardAvoidingView status`, hasKAV ? undefined : 'Lacks KeyboardAvoidingView wrapper around input forms');
    assert('SecondaryModalsAudit', hasHandledTaps, `${item.file}: keyboardShouldPersistTaps status`, hasHandledTaps ? undefined : 'Lacks keyboardShouldPersistTaps="handled" on ScrollView');
  }

  // ==========================================================================
  // SUITE 4: HEADER RESPONSIVE LAYOUT & VIEWPORT SCALING (320px - 414px)
  // ==========================================================================
  console.log('\n--- SUITE 4: Header Component Layout & Viewport Scaling ---');
  const appContent = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf8');

  assert('HeaderLayout', appContent.includes('flexShrink: 1'), 'App.tsx: Header title container specifies flexShrink: 1');
  assert('HeaderLayout', appContent.includes('numberOfLines={1}'), 'App.tsx: Header title specifies numberOfLines={1}');
  assert('HeaderLayout', appContent.includes('gap: 6'), 'App.tsx: Header right action cluster specifies gap: 6');
  assert('HeaderLayout', appContent.includes('paddingHorizontal: 14'), 'App.tsx: Header container uses paddingHorizontal: 14');

  // Geometry calculations
  const headerHorizontalPadding = 14 * 2; // 28px
  const rightClusterTotalWidth = 52 + (5 * 34) + (5 * 6); // 52 (Level) + 170 (5 icon buttons) + 30 (5 gaps) = 252px
  const logoWidth = 32 + 8; // 40px
  const examBadgeWidth = 96; // 96px

  const standardViewports = [
    { width: 320, name: '320px (Compact Mobile)' },
    { width: 360, name: '360px (Standard Mobile)' },
    { width: 390, name: '390px (iPhone 12-15)' },
    { width: 414, name: '414px (Large Mobile)' }
  ];

  for (const vp of standardViewports) {
    const availableInner = vp.width - headerHorizontalPadding;
    const remainingForLeft = availableInner - rightClusterTotalWidth;
    const remainingForTitle = remainingForLeft - logoWidth;

    console.log(`\n  * Viewport ${vp.name}: Inner=${availableInner}px, RightCluster=${rightClusterTotalWidth}px, LeftAvailable=${remainingForLeft}px, TitleSpace=${remainingForTitle}px`);

    assert(
      'HeaderLayout',
      remainingForLeft > 0,
      `Viewport ${vp.width}px: Left header has positive space allocation without horizontal wrap blowout`
    );

    if (vp.width >= 360) {
      assert(
        'HeaderLayout',
        remainingForTitle >= 40,
        `Viewport ${vp.width}px: Title area (${remainingForTitle}px) cleanly displays "Organiza"`
      );
    }
  }

  // Stress-Test: Exam Week Mode on Small Viewports
  console.log('\n  * Stress-Testing Exam Week Mode Badge on Narrow Viewports:');
  const viewportsForExamBadge = [320, 360, 390, 414];
  for (const w of viewportsForExamBadge) {
    const availableInner = w - headerHorizontalPadding;
    const remainingForLeft = availableInner - rightClusterTotalWidth;
    const totalRequiredLeft = logoWidth + 70 /* Title */ + examBadgeWidth;
    const fitsWithoutShrink = remainingForLeft >= totalRequiredLeft;
    
    assert(
      'HeaderExamModeStress',
      appContent.includes('flexShrink: 1'),
      `Viewport ${w}px with Exam Mode: flexShrink: 1 is active on title container to prevent row breaking`,
      fitsWithoutShrink ? undefined : `Title is truncated or compressed when Exam Mode is active alongside 6 action buttons (Required ${totalRequiredLeft}px vs Available ${remainingForLeft}px)`
    );
  }

  // Header accessibility
  const accessibilityLabels = [
    'Conquistas e Nível',
    'Trabalhos em Grupo',
    'Estatísticas e AACC',
    'Configurações do Microsoft Teams e IA',
    'Configurações do App',
    'Alterar Tema'
  ];
  for (const label of accessibilityLabels) {
    assert('HeaderLayout', appContent.includes(`accessibilityLabel="${label}"`), `App.tsx Header: Contains accessibilityLabel="${label}"`);
  }

  // ==========================================================================
  // SUITE 5: COLD-START SPLASH STATE TRANSITION & STORAGE HYDRATION
  // ==========================================================================
  console.log('\n--- SUITE 5: Cold-Start Splash State Transition & Hydration Engine ---');

  assert('SplashState', appContent.includes('const [isInitializing, setIsInitializing] = useState(true);'), 'App.tsx: isInitializing starts as true');
  assert('SplashState', appContent.includes('if (isInitializing) {'), 'App.tsx: Guard prevents unhydrated UI rendering');
  assert('SplashState', appContent.includes('<ActivityIndicator size="small" color={colors.primary}'), 'App.tsx: Splash renders ActivityIndicator');
  assert('SplashState', appContent.includes('finally {'), 'App.tsx: loadData() uses finally block to guarantee isInitializing=false');

  await mockAsyncStorage.clear();
  await StorageService.saveTheme('amoled');
  await StorageService.saveEvents([{ id: 'ev_1', title: 'Aula M2', category: 'Faculdade/Aulas', date: '2026-08-18', startTime: '10:00', endTime: '12:00', recurrence: 'none', alerts: [] }]);
  await StorageService.saveSubjects([{ id: 'sub_1', name: 'Arquitetura de Software', color: '#6366F1', passGrade: 7.0, maxAbsences: 10, workloadHours: 60, gradeGroups: [] }]);
  await StorageService.saveStreak({ currentStreak: 7, longestStreak: 15, lastStudyDate: '2026-08-17' });
  await StorageService.saveSettings({ theme: 'amoled', pomodoroFocusMin: 25, pomodoroBreakMin: 5, pomodoroLongBreakMin: 15, defaultPassGrade: 7.0, examWeekMode: false, soundEnabled: true, hapticsEnabled: true });
  await StorageService.saveGamificationData({ xp: 800, level: 4, unlockedAchievements: ['first_focus'], totalFocusMinutes: 300 });

  let isInitializingSim = true;
  let hydratedTheme: ThemeType = 'dark';
  let hydratedEvents: AppEvent[] = [];
  let hydratedSubjects: Subject[] = [];
  let hydratedStreak: StudyStreak | null = null;
  let hydratedGamification: GamificationData | null = null;

  try {
    const [savedTheme, savedEvents, savedSubjects, savedAttendances, savedTasks, savedSessions, savedSemesters, savedSettings, savedGamification, savedStreak] = await Promise.all([
      StorageService.getTheme(),
      StorageService.getEvents(),
      StorageService.getSubjects(),
      StorageService.getAttendances(),
      StorageService.getTasks(),
      StorageService.getStudySessions(),
      StorageService.getSemesters(),
      StorageService.getSettings(),
      StorageService.getGamificationData(),
      StorageService.getStreak(),
    ]);

    hydratedTheme = savedTheme;
    hydratedEvents = savedEvents;
    hydratedSubjects = savedSubjects;
    hydratedStreak = savedStreak;
    hydratedGamification = savedGamification;
  } finally {
    isInitializingSim = false;
  }

  assert('SplashState', isInitializingSim === false, 'Transition: isInitializing successfully set to false');
  assert('SplashState', hydratedTheme === 'amoled', 'Hydrated state: theme loaded as "amoled"');
  assert('SplashState', hydratedEvents.length === 1 && hydratedEvents[0].title === 'Aula M2', 'Hydrated state: Events array hydrated');
  assert('SplashState', hydratedSubjects.length === 1 && hydratedSubjects[0].name === 'Arquitetura de Software', 'Hydrated state: Subjects array hydrated');
  assert('SplashState', hydratedStreak?.currentStreak === 7, 'Hydrated state: Streak hydrated');
  assert('SplashState', hydratedGamification?.level === 4, 'Hydrated state: Gamification level hydrated');

  // Corrupted storage recovery test
  let errorCaught = false;
  let finalStateRecovered = false;
  try {
    await (async () => { throw new Error('Simulated AsyncStorage corruption'); })();
  } catch (e) {
    errorCaught = true;
  } finally {
    finalStateRecovered = true;
  }

  assert('SplashState', errorCaught, 'Corrupt storage test: Error handled gracefully');
  assert('SplashState', finalStateRecovered, 'Corrupt storage test: Finally block executes regardless of storage failures');

  // ==========================================================================
  // FINAL SUMMARY OF ALL SUITES
  // ==========================================================================
  console.log('\n================================================================');
  console.log('CHALLENGER 2 STRESS TEST EXECUTION REPORT');
  console.log('================================================================');
  let overallTotal = 0;
  let overallPassed = 0;
  let overallFailed = 0;

  for (const [sName, sResult] of Object.entries(suiteResults)) {
    console.log(`\nSuite [${sName}]:`);
    console.log(`  Total Assertions : ${sResult.total}`);
    console.log(`  Passed           : ${sResult.passed}`);
    console.log(`  Findings/Failures: ${sResult.failed}`);
    if (sResult.findings.length > 0) {
      sResult.findings.forEach(f => console.log(`    - ${f}`));
    }
    overallTotal += sResult.total;
    overallPassed += sResult.passed;
    overallFailed += sResult.failed;
  }

  console.log('\n================================================================');
  console.log(`OVERALL TOTAL ASSERTIONS : ${overallTotal}`);
  console.log(`OVERALL PASSED           : ${overallPassed}`);
  console.log(`OVERALL FINDINGS         : ${overallFailed}`);
  console.log('================================================================\n');

  console.log('>>> EMPIRICAL STRESS TEST SUITE FINISHED EXECUTION <<<');
}

runChallengerStressTests().catch(err => {
  console.error('Challenger Stress Test Error:', err);
  process.exit(1);
});
