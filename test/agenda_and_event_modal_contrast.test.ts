import './setup_env';
import fs from 'fs';
import path from 'path';
import {
  Colors,
  CategoryColors,
  getThemeColors,
  getCategoryColor,
  getContrastTextColor,
} from '../src/theme';
import { ThemeType, EventCategory } from '../src/types';

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

async function runContrastAndInputTestSuite() {
  console.log('================================================================');
  console.log('CONTRAST, BADGES/CHIPS & INPUT AUDIT TEST SUITE (WCAG 2.1 AA)');
  console.log('================================================================');

  // ── 1. getContrastTextColor Multi-Format Matrix ──
  console.log('\n--- 1. getContrastTextColor Robustness Tests ---');

  // 3-digit and 4-digit hex
  assert(getContrastTextColor('#000') === '#FFFFFF', 'Tier 1', '3-digit #000 -> #FFFFFF');
  assert(getContrastTextColor('#fff') === '#0A0A0A', 'Tier 1', '3-digit #fff -> #0A0A0A');
  assert(getContrastTextColor('000') === '#FFFFFF', 'Tier 1', '3-digit 000 (no #) -> #FFFFFF');
  assert(getContrastTextColor('fff') === '#0A0A0A', 'Tier 1', '3-digit fff (no #) -> #0A0A0A');
  assert(getContrastTextColor('#000F') === '#FFFFFF', 'Tier 1', '4-digit #000F -> #FFFFFF');
  assert(getContrastTextColor('#FFFF') === '#0A0A0A', 'Tier 1', '4-digit #FFFF -> #0A0A0A');

  // 6-digit hex
  assert(getContrastTextColor('#000000') === '#FFFFFF', 'Tier 1', '6-digit #000000 -> #FFFFFF');
  assert(getContrastTextColor('#FFFFFF') === '#0A0A0A', 'Tier 1', '6-digit #FFFFFF -> #0A0A0A');
  assert(getContrastTextColor('#00FFAA') === '#0A0A0A', 'Tier 1', '6-digit #00FFAA (Mint) -> #0A0A0A');
  assert(getContrastTextColor('#059669') === '#FFFFFF', 'Tier 1', '6-digit #059669 (Emerald) -> #FFFFFF');
  assert(getContrastTextColor('#F59E0B') === '#0A0A0A', 'Tier 1', '6-digit #F59E0B (Amber) -> #0A0A0A');
  assert(getContrastTextColor('#3B82F6') === '#FFFFFF', 'Tier 1', '6-digit #3B82F6 (Blue) -> #FFFFFF');

  // 8-digit hex (with alpha)
  assert(getContrastTextColor('#000000FF') === '#FFFFFF', 'Tier 1', '8-digit #000000FF -> #FFFFFF');
  assert(getContrastTextColor('#FFFFFFFF') === '#0A0A0A', 'Tier 1', '8-digit #FFFFFFFF -> #0A0A0A');
  assert(getContrastTextColor('#00FFAA80') === '#0A0A0A', 'Tier 1', '8-digit #00FFAA80 -> #0A0A0A');
  assert(getContrastTextColor('#05966980') === '#FFFFFF', 'Tier 1', '8-digit #05966980 -> #FFFFFF');

  // RGB and RGBA strings
  assert(getContrastTextColor('rgb(0, 0, 0)') === '#FFFFFF', 'Tier 1', 'rgb(0, 0, 0) -> #FFFFFF');
  assert(getContrastTextColor('rgb(255, 255, 255)') === '#0A0A0A', 'Tier 1', 'rgb(255, 255, 255) -> #0A0A0A');
  assert(getContrastTextColor('rgba(0, 255, 170, 0.8)') === '#0A0A0A', 'Tier 1', 'rgba(0, 255, 170, 0.8) -> #0A0A0A');
  assert(getContrastTextColor('rgba(15, 17, 21, 1)') === '#FFFFFF', 'Tier 1', 'rgba(15, 17, 21, 1) -> #FFFFFF');

  // HSL strings
  assert(getContrastTextColor('hsl(120, 100%, 75%)') === '#0A0A0A', 'Tier 1', 'hsl(120, 100%, 75%) -> #0A0A0A');
  assert(getContrastTextColor('hsl(240, 100%, 20%)') === '#FFFFFF', 'Tier 1', 'hsl(240, 100%, 20%) -> #FFFFFF');

  // Invalid / Edge cases
  assert(getContrastTextColor(undefined) === '#000000', 'Tier 1', 'undefined -> #000000');
  assert(getContrastTextColor(null as any) === '#000000', 'Tier 1', 'null -> #000000');
  assert(getContrastTextColor('') === '#000000', 'Tier 1', 'empty string -> #000000');
  assert(getContrastTextColor('   ') === '#000000', 'Tier 1', 'whitespace -> #000000');
  assert(getContrastTextColor('#XYZ123') === '#000000', 'Tier 1', 'invalid hex #XYZ123 -> #000000');
  assert(getContrastTextColor('#12345Z') === '#000000', 'Tier 1', 'invalid hex #12345Z -> #000000');

  // ── 2. Category Contrast in All Themes ──
  console.log('\n--- 2. Category Contrast Across All Themes ---');

  const themes: ThemeType[] = ['light', 'dark', 'amoled'];
  const categories = Object.keys(CategoryColors) as EventCategory[];

  for (const th of themes) {
    for (const cat of categories) {
      const color = getCategoryColor(cat, th);
      assert(
        typeof color === 'string' && color.startsWith('#'),
        'Tier 2',
        `Category "${cat}" in ${th} theme has valid color string (${color})`
      );

      const contrastText = getContrastTextColor(color);
      assert(
        contrastText === '#0A0A0A' || contrastText === '#FFFFFF',
        'Tier 2',
        `Category "${cat}" in ${th} yields high-contrast text (${contrastText})`
      );
    }
  }

  // ── 3. Static Audit: AgendaScreen.tsx ──
  console.log('\n--- 3. Static Code Audit of AgendaScreen.tsx ---');

  const agendaPath = path.resolve(__dirname, '../src/screens/AgendaScreen.tsx');
  const agendaContent = fs.readFileSync(agendaPath, 'utf8');

  // Check: No unsafe opacity concatenation on colors used for text
  assert(
    !agendaContent.includes("+ '20'") && !agendaContent.includes('+ "20"'),
    'Tier 3',
    'AgendaScreen.tsx has 0 occurrences of unsafe "+ \'20\'" opacity concatenation'
  );
  assert(
    !agendaContent.includes("+ '22'") && !agendaContent.includes('+ "22"'),
    'Tier 3',
    'AgendaScreen.tsx has 0 occurrences of unsafe "+ \'22\'" opacity concatenation'
  );

  // Check: subjectBadge in highlight card uses surfaceSubtle
  assert(
    agendaContent.includes('styles.subjectBadge, { backgroundColor: colors.surfaceSubtle'),
    'Tier 3',
    'AgendaScreen.tsx subjectBadge uses accessible colors.surfaceSubtle background'
  );

  // Check: miniCategoryBadge and miniSubjectBadge are defined
  assert(
    agendaContent.includes('styles.miniCategoryBadge,') &&
    agendaContent.includes('styles.miniSubjectBadge,'),
    'Tier 3',
    'AgendaScreen.tsx miniCategoryBadge and miniSubjectBadge are defined'
  );

  // Check: timelineEventCard uses getContrastTextColor
  assert(
    agendaContent.includes('const contrastColor = getContrastTextColor(bg);'),
    'Tier 3',
    'AgendaScreen.tsx timelineEventCard calculates dynamic high-contrast text color'
  );

  // ── 4. Static Audit: EventModal.tsx ──
  console.log('\n--- 4. Static Code Audit of EventModal.tsx ---');

  const modalPath = path.resolve(__dirname, '../src/components/EventModal.tsx');
  const modalContent = fs.readFileSync(modalPath, 'utf8');

  // Check: Title input uses colors.surfaceSubtle
  assert(
    modalContent.includes('styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceSubtle }'),
    'Tier 4',
    'EventModal.tsx title input uses colors.surfaceSubtle and colors.border'
  );

  // Check: Category chips use getCategoryColor(c, theme)
  assert(
    modalContent.includes('const catColor = getCategoryColor(c, theme);'),
    'Tier 4',
    'EventModal.tsx category chips use theme-aware getCategoryColor'
  );

  // Check: Custom unit chips exist with 44dp height
  assert(
    modalContent.includes('customUnitChip: {') && modalContent.includes('height: 44,'),
    'Tier 4',
    'EventModal.tsx customUnitChip meets 44dp minimum touch target'
  );
  assert(
    modalContent.includes('addCustomAlertBtn: {') && modalContent.includes('width: 44,'),
    'Tier 4',
    'EventModal.tsx addCustomAlertBtn meets 44dp minimum touch target'
  );

  // ── 5. Zero Hardcoded Dark Tokens Audit ──
  console.log('\n--- 5. Zero Hardcoded Dark Tokens in Target Files ---');

  const FORBIDDEN_DARK_TOKENS = [
    '#0F1115', '#181B20', '#1F232B', '#292E38', '#2A303C', '#1E232D', '#3E4756',
    '#0A0C0E', '#121519', '#1A1E24', '#1E2229', '#14171C', '#2C323D'
  ];

  for (const token of FORBIDDEN_DARK_TOKENS) {
    assert(
      !agendaContent.includes(token),
      'Tier 5',
      `AgendaScreen.tsx does not contain forbidden dark token ${token}`
    );
    assert(
      !modalContent.includes(token),
      'Tier 5',
      `EventModal.tsx does not contain forbidden dark token ${token}`
    );
  }

  // ── Summary ──
  console.log('\n================================================================');
  console.log('--- CONTRAST & INPUT SUITE SUMMARY ---');
  console.log('================================================================');

  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.filter(r => !r.passed).length;

  console.log(`Total Tests : ${results.length}`);
  console.log(`Passed      : ${totalPassed}`);
  console.log(`Failed      : ${totalFailed}`);

  if (totalFailed > 0) {
    console.error('\nFAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => {
      console.error(`- [${r.tier}] ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\nALL CONTRAST, BADGE/CHIP & INPUT TESTS PASSED (100% SUCCESS)!');
  }
}

runContrastAndInputTestSuite().catch(e => {
  console.error('Fatal error in contrast test suite:', e);
  process.exit(1);
});
