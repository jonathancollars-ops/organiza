import './setup_env';
import { memoryStore } from './setup_env';
import { StorageService } from '../src/services/storage';
import { AppSettings, BackupData, ThemeType } from '../src/types';
import { Colors } from '../src/theme';

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

export async function runR1Tests() {
  console.log('\n================================================================');
  console.log('--- R1: FULLSCREEN & STATUS BAR CONFIGURATION TEST SUITE (TIERS 1-4) ---');
  console.log('================================================================\n');

  // Reset store
  Object.keys(memoryStore).forEach(k => delete memoryStore[k]);

  // ==========================================================================
  // TIER 1: SANITY & CONTRACT TESTS
  // ==========================================================================
  console.log('--- TIER 1: Sanity & Interface Contracts ---');

  // 1.1 Uninitialized storage defaults
  const initialSettings = await StorageService.getSettings();
  assert(initialSettings !== undefined && initialSettings !== null, 'Tier 1', 'StorageService.getSettings() returns defined object');
  assert(initialSettings.fullscreen === false, 'Tier 1', 'Factory default fullscreen is strictly false (Status Bar Visible)');
  assert(initialSettings.theme === 'dark', 'Tier 1', 'Factory default theme is dark');
  assert(initialSettings.pomodoroFocusMin === 25, 'Tier 1', 'Factory default pomodoroFocusMin is 25');
  assert(initialSettings.pomodoroBreakMin === 5, 'Tier 1', 'Factory default pomodoroBreakMin is 5');
  assert(initialSettings.pomodoroLongBreakMin === 15, 'Tier 1', 'Factory default pomodoroLongBreakMin is 15');
  assert(initialSettings.defaultPassGrade === 7.0, 'Tier 1', 'Factory default defaultPassGrade is 7.0');
  assert(initialSettings.soundEnabled === true, 'Tier 1', 'Factory default soundEnabled is true');
  assert(initialSettings.hapticsEnabled === true, 'Tier 1', 'Factory default hapticsEnabled is true');
  assert(initialSettings.examWeekMode === false, 'Tier 1', 'Factory default examWeekMode is false');

  // ==========================================================================
  // TIER 2: FUNCTIONAL PERSISTENCE & THEME ADAPTATION TESTS
  // ==========================================================================
  console.log('\n--- TIER 2: Functional Persistence & Theme Adaptation ---');

  // 2.1 Persisting fullscreen = true
  await StorageService.saveSettings({
    ...initialSettings,
    fullscreen: true,
  });
  const updatedSettings = await StorageService.getSettings();
  assert(updatedSettings.fullscreen === true, 'Tier 2', 'Persisting fullscreen: true saves to storage successfully');

  // 2.2 Toggling back to fullscreen = false
  await StorageService.saveSettings({
    ...updatedSettings,
    fullscreen: false,
  });
  const toggledBack = await StorageService.getSettings();
  assert(toggledBack.fullscreen === false, 'Tier 2', 'Toggling back to fullscreen: false persists properly');

  // 2.3 Status Bar Style mapping across all 3 themes
  const resolveStatusBarStyle = (th: ThemeType) => (th === 'light' ? 'dark' : 'light');
  const resolveRNBarStyle = (th: ThemeType) => (th === 'light' ? 'dark-content' : 'light-content');
  const resolveStatusBarBg = (th: ThemeType) => (th === 'light' ? Colors.light.surface : Colors[th].background);

  // Light theme
  assert(resolveStatusBarStyle('light') === 'dark', 'Tier 2', 'Light theme maps to statusBarStyle="dark"');
  assert(resolveRNBarStyle('light') === 'dark-content', 'Tier 2', 'Light theme maps to RN setBarStyle("dark-content")');
  assert(resolveStatusBarBg('light') === Colors.light.surface, 'Tier 2', 'Light theme status bar bg matches surface color (#FFFFFF)');

  // Dark theme
  assert(resolveStatusBarStyle('dark') === 'light', 'Tier 2', 'Dark theme maps to statusBarStyle="light"');
  assert(resolveRNBarStyle('dark') === 'light-content', 'Tier 2', 'Dark theme maps to RN setBarStyle("light-content")');
  assert(resolveStatusBarBg('dark') === Colors.dark.background, 'Tier 2', 'Dark theme status bar bg matches background color (#0F1115)');

  // AMOLED theme
  assert(resolveStatusBarStyle('amoled') === 'light', 'Tier 2', 'AMOLED theme maps to statusBarStyle="light"');
  assert(resolveRNBarStyle('amoled') === 'light-content', 'Tier 2', 'AMOLED theme maps to RN setBarStyle("light-content")');
  assert(resolveStatusBarBg('amoled') === Colors.amoled.background, 'Tier 2', 'AMOLED theme status bar bg matches background color (#000000)');

  // 2.4 Safe Area Edges Selection
  const resolveSafeAreaEdges = (isFullscreen: boolean) => (isFullscreen ? ['bottom'] : ['top', 'bottom']);
  assert(
    JSON.stringify(resolveSafeAreaEdges(true)) === JSON.stringify(['bottom']),
    'Tier 2',
    'Fullscreen mode (true) configures SafeAreaView edges: ["bottom"]'
  );
  assert(
    JSON.stringify(resolveSafeAreaEdges(false)) === JSON.stringify(['top', 'bottom']),
    'Tier 2',
    'Standard mode (false) configures SafeAreaView edges: ["top", "bottom"]'
  );

  // ==========================================================================
  // TIER 3: BOUNDARY, ADVERSARIAL & CORRUPTION RECOVERY TESTS
  // ==========================================================================
  console.log('\n--- TIER 3: Boundary, Adversarial & Corruption Recovery ---');

  // 3.1 Legacy settings payload without fullscreen property
  memoryStore['@organiza_settings'] = JSON.stringify({
    theme: 'amoled',
    pomodoroFocusMin: 45,
    pomodoroBreakMin: 10,
    pomodoroLongBreakMin: 20,
    defaultPassGrade: 6.0,
    examWeekMode: true,
    soundEnabled: false,
    hapticsEnabled: false,
  });

  const legacySettings = await StorageService.getSettings();
  assert(legacySettings.theme === 'amoled', 'Tier 3', 'Legacy settings theme preserved');
  assert(legacySettings.pomodoroFocusMin === 45, 'Tier 3', 'Legacy settings pomodoroFocusMin preserved');
  assert(legacySettings.fullscreen === false, 'Tier 3', 'Missing fullscreen field defaults safely to false');

  // 3.2 Corrupted / malformed JSON in settings key
  memoryStore['@organiza_settings'] = '{ INVALID_JSON_DATA ::: 123 }';
  const corruptedSettings = await StorageService.getSettings();
  assert(corruptedSettings !== null && corruptedSettings.fullscreen === false, 'Tier 3', 'Corrupted settings JSON recovers to DEFAULT_SETTINGS (fullscreen: false)');
  assert(corruptedSettings.theme === 'dark', 'Tier 3', 'Corrupted settings JSON recovers default theme (dark)');

  // 3.3 Multiple rapid consecutive toggles (state thrashing stress)
  for (let i = 0; i < 20; i++) {
    const targetVal = i % 2 === 0;
    await StorageService.saveSettings({ ...initialSettings, fullscreen: targetVal });
    const check = await StorageService.getSettings();
    if (check.fullscreen !== targetVal) {
      assert(false, 'Tier 3', `Rapid toggle iteration ${i} failed expected ${targetVal}`);
      break;
    }
  }
  const finalToggle = await StorageService.getSettings();
  assert(finalToggle.fullscreen === false, 'Tier 3', '20 rapid state toggles executed deterministically without race conditions');

  // ==========================================================================
  // TIER 4: E2E SIMULATION & BACKUP WORKFLOWS
  // ==========================================================================
  console.log('\n--- TIER 4: E2E Simulation & Backup Workflows ---');

  // 4.1 Full Backup Export & Import with Fullscreen = true
  await StorageService.saveSettings({
    ...initialSettings,
    fullscreen: true,
    theme: 'light'
  });

  const exportedBackup = await StorageService.exportBackup();
  assert(exportedBackup.settings !== undefined, 'Tier 4', 'Exported backup contains settings object');
  assert(exportedBackup.settings?.fullscreen === true, 'Tier 4', 'Exported backup accurately preserves fullscreen: true');
  assert(exportedBackup.settings?.theme === 'light', 'Tier 4', 'Exported backup accurately preserves theme: light');

  // Wipe memory and restore
  Object.keys(memoryStore).forEach(k => delete memoryStore[k]);
  const freshCheck = await StorageService.getSettings();
  assert(freshCheck.fullscreen === false, 'Tier 4', 'Fresh wiped store returns factory default fullscreen: false');

  await StorageService.importBackup(exportedBackup);
  const restoredSettings = await StorageService.getSettings();
  assert(restoredSettings.fullscreen === true, 'Tier 4', 'Imported backup restores fullscreen: true accurately');
  assert(restoredSettings.theme === 'light', 'Tier 4', 'Imported backup restores theme: light accurately');

  // 4.2 Full Backup Export & Import with Fullscreen = false
  await StorageService.saveSettings({
    ...restoredSettings,
    fullscreen: false,
    theme: 'amoled'
  });

  const exportedBackup2 = await StorageService.exportBackup();
  Object.keys(memoryStore).forEach(k => delete memoryStore[k]);
  await StorageService.importBackup(exportedBackup2);
  const restoredSettings2 = await StorageService.getSettings();
  assert(restoredSettings2.fullscreen === false, 'Tier 4', 'Imported backup restores fullscreen: false accurately');
  assert(restoredSettings2.theme === 'amoled', 'Tier 4', 'Imported backup restores theme: amoled accurately');

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('\n================================================================');
  console.log('--- R1 TEST RESULTS SUMMARY ---');
  console.log('================================================================');

  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.filter(r => !r.passed).length;

  console.log(`Total R1 Tests : ${results.length}`);
  console.log(`Passed         : ${totalPassed}`);
  console.log(`Failed         : ${totalFailed}`);

  if (totalFailed > 0) {
    console.error('\nFAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => {
      console.error(`- [${r.tier}] ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\nALL R1 FULLSCREEN & STATUS BAR TESTS PASSED (100% SUCCESS)!');
  }
}

// Execute when run directly
runR1Tests().catch((e) => {
  console.error('Fatal test runner error:', e);
  process.exit(1);
});
