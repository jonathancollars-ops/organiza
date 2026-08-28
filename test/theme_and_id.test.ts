import './setup_env';
import * as fs from 'fs';
import * as path from 'path';
import { Colors, CategoryColors, getThemeColors, getContrastTextColor } from '../src/theme';
import { generateId } from '../src/utils/id';
import { EventCategory, ThemeType } from '../src/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ' -> ' + detail : ''}`);
    failed++;
  }
}

async function runThemeAndIdTestSuite() {
  console.log('================================================================');
  console.log('THEME TOKENS, CONTRAST UTILITIES & ID GENERATOR UNIT TEST SUITE');
  console.log('================================================================');

  // ── 1. getContrastTextColor Tests ──
  console.log('\n--- 1. getContrastTextColor Contrast Calculations ---');

  // Theme Token Contrast Verification
  assert(getContrastTextColor(Colors.light.primary) === '#FFFFFF', `Colors.light.primary (${Colors.light.primary}) yields high-contrast white text #FFFFFF`);
  assert(getContrastTextColor(Colors.light.background) === '#0A0A0A', `Colors.light.background (${Colors.light.background}) yields dark text #0A0A0A`);
  assert(getContrastTextColor(Colors.light.surface) === '#0A0A0A', `Colors.light.surface (${Colors.light.surface}) yields dark text #0A0A0A`);
  assert(getContrastTextColor(Colors.light.primaryLight) === '#0A0A0A', `Colors.light.primaryLight (${Colors.light.primaryLight}) yields dark text #0A0A0A`);
  assert(getContrastTextColor(Colors.dark.primary) === '#0A0A0A', `Colors.dark.primary (${Colors.dark.primary}) yields dark text #0A0A0A`);
  assert(getContrastTextColor(Colors.dark.background) === '#FFFFFF', `Colors.dark.background (${Colors.dark.background}) yields white text #FFFFFF`);
  assert(getContrastTextColor(Colors.dark.surface) === '#FFFFFF', `Colors.dark.surface (${Colors.dark.surface}) yields white text #FFFFFF`);
  assert(getContrastTextColor(Colors.amoled.background) === '#FFFFFF', `Colors.amoled.background (${Colors.amoled.background}) yields white text #FFFFFF`);
  assert(getContrastTextColor(Colors.amoled.surface) === '#FFFFFF', `Colors.amoled.surface (${Colors.amoled.surface}) yields white text #FFFFFF`);

  // Pure White and Light Backgrounds (Expect Dark Text: #0A0A0A)
  assert(getContrastTextColor('#FFFFFF') === '#0A0A0A', 'Pure white (#FFFFFF) yields dark text #0A0A0A');
  assert(getContrastTextColor('#fff') === '#0A0A0A', '3-digit hex white (#fff) yields dark text #0A0A0A');
  assert(getContrastTextColor('#F8F9FA') === '#0A0A0A', 'Light gray surface (#F8F9FA) yields dark text #0A0A0A');
  assert(getContrastTextColor('#00FFAA') === '#0A0A0A', 'Vibrant Mint Green (#00FFAA) yields dark text #0A0A0A');
  assert(getContrastTextColor('#FEF3C7') === '#0A0A0A', 'Light warning tint (#FEF3C7) yields dark text #0A0A0A');
  assert(getContrastTextColor('#D1FAE5') === '#0A0A0A', 'Light success tint (#D1FAE5) yields dark text #0A0A0A');
  assert(getContrastTextColor('#FEE2E2') === '#0A0A0A', 'Light danger tint (#FEE2E2) yields dark text #0A0A0A');
  assert(getContrastTextColor('#FFFF00') === '#0A0A0A', 'Yellow (#FFFF00) yields dark text #0A0A0A');

  // Pure Black and Dark Backgrounds (Expect Light Text: #FFFFFF)
  assert(getContrastTextColor('#000000') === '#FFFFFF', 'Pure black (#000000) yields white text #FFFFFF');
  assert(getContrastTextColor('#000') === '#FFFFFF', '3-digit hex black (#000) yields white text #FFFFFF');
  assert(getContrastTextColor('#0F1115') === '#FFFFFF', 'Dark background (#0F1115) yields white text #FFFFFF');
  assert(getContrastTextColor('#181B20') === '#FFFFFF', 'Dark surface (#181B20) yields white text #FFFFFF');
  assert(getContrastTextColor('#047857') === '#FFFFFF', 'Deep emerald primaryDark (#047857) yields white text #FFFFFF');
  assert(getContrastTextColor('#B91C1C') === '#FFFFFF', 'Deep dangerDark (#B91C1C) yields white text #FFFFFF');
  assert(getContrastTextColor('#B45309') === '#FFFFFF', 'Deep warningDark (#B45309) yields white text #FFFFFF');
  assert(getContrastTextColor('#1E3A8A') === '#FFFFFF', 'Deep blue (#1E3A8A) yields white text #FFFFFF');

  // HSL Strings
  assert(getContrastTextColor('hsl(120, 100%, 75%)') === '#0A0A0A', 'Light HSL lightness 75% (>55%) yields dark text');
  assert(getContrastTextColor('hsl(240, 80%, 20%)') === '#FFFFFF', 'Dark HSL lightness 20% (<=55%) yields white text');
  assert(getContrastTextColor('hsl(0, 0%, 90%)') === '#0A0A0A', 'Light gray HSL lightness 90% yields dark text');
  assert(getContrastTextColor('hsl(0, 0%, 30%)') === '#FFFFFF', 'Dark gray HSL lightness 30% yields white text');

  // Edge Cases & Missing/Malformed Inputs
  assert(getContrastTextColor(undefined) === '#000000', 'Undefined background returns safe default #000000');
  assert(getContrastTextColor('') === '#000000', 'Empty string returns safe default #000000');
  assert(getContrastTextColor('invalid_string') === '#000000', 'Unparseable string returns safe default #000000');

  // ── 2. Theme Token Palette Integrity ──
  console.log('\n--- 2. Theme Token Palette Integrity & WCAG AA Tokens ---');

  const themes: ThemeType[] = ['light', 'dark', 'amoled'];
  const expectedKeys = [
    'background', 'surface', 'surfaceSubtle', 'surfaceHighlight',
    'text', 'textSecondary', 'textMuted',
    'primary', 'primaryDark', 'primaryLight',
    'border', 'borderSubtle', 'borderHighlight',
    'danger', 'dangerLight', 'dangerDark',
    'warning', 'warningLight', 'warningDark',
    'success', 'successLight', 'successDark',
    'info', 'card', 'shadow'
  ];

  for (const theme of themes) {
    const palette = Colors[theme];
    assert(palette !== undefined && palette !== null, `Colors.${theme} is defined and non-null`);
    for (const key of expectedKeys) {
      const val = (palette as any)[key];
      const isValid = typeof val === 'string' && val.trim().length > 0 && (
        val.startsWith('#') || val.startsWith('rgb') || val.startsWith('rgba') || val.startsWith('hsl')
      );
      assert(
        isValid,
        `Colors.${theme}.${key} is valid, non-null, and non-empty color string ("${val}")`
      );
    }
  }

  // Light theme WCAG AA dark tokens verification
  assert(Colors.light.warningDark === '#B45309', 'Colors.light.warningDark has high contrast token #B45309');
  assert(Colors.light.dangerDark === '#B91C1C', 'Colors.light.dangerDark has high contrast token #B91C1C');
  assert(Colors.light.successDark === '#047857', 'Colors.light.successDark has high contrast token #047857');

  // getThemeColors helper function
  assert(getThemeColors('light').background === Colors.light.background, 'getThemeColors(light) returns light palette');
  assert(getThemeColors('dark').background === Colors.dark.background, 'getThemeColors(dark) returns dark palette');
  assert(getThemeColors('amoled').background === Colors.amoled.background, 'getThemeColors(amoled) returns amoled palette');
  assert(getThemeColors(undefined as any).background === Colors.dark.background, 'getThemeColors(undefined) defaults to dark palette');

  // CategoryColors map verification
  const categories: EventCategory[] = [
    'Saúde/Academia',
    'Faculdade/Aulas',
    'Provas/Trabalhos',
    'Lazer',
    'Outros'
  ];
  for (const cat of categories) {
    assert(
      CategoryColors[cat] !== undefined && CategoryColors[cat].startsWith('#'),
      `CategoryColors['${cat}'] has valid hex color (${CategoryColors[cat]})`
    );
  }

  // ── 3. generateId Collision-Free ID Generator ──
  console.log('\n--- 3. generateId Utility & Collision Entropy ---');

  const defaultId = generateId();
  assert(defaultId.startsWith('id_'), 'Default generateId() starts with "id_" prefix');

  const prefixes = ['evt', 'subj', 'sem', 'aacc', 'proj', 'task', 'att', 'sess', 'group', 'item', 'evt_eval', 'evt_class'];
  for (const p of prefixes) {
    const id = generateId(p);
    assert(id.startsWith(`${p}_`), `generateId('${p}') generates ID with '${p}_' prefix (${id})`);
    const parts = id.split('_');
    assert(parts.length >= 3, `ID contains prefix, timestamp, and random segments (${id})`);
  }

  // High-entropy uniqueness test: 2,000 generated IDs
  const idSet = new Set<string>();
  const NUM_IDS = 2000;
  for (let i = 0; i < NUM_IDS; i++) {
    idSet.add(generateId('test'));
  }
  assert(idSet.size === NUM_IDS, `2000 consecutively generated IDs have 0 collisions (size=${idSet.size})`);

  // ── 4. Static Codebase Audit: No Hardcoded Dark Theme Colors in Screens/Components ──
  console.log('\n--- 4. Static Codebase Audit (No Hardcoded Dark Colors in Screens/Components) ---');

  const FORBIDDEN_DARK_TOKENS = [
    '#0F1115', // Dark background
    '#181B20', // Dark surface / card
    '#1F232B', // Dark surfaceSubtle
    '#292E38', // Dark surfaceHighlight
    '#2A303C', // Dark border
    '#1E232D', // Dark borderSubtle
    '#3E4756', // Dark borderHighlight
    '#0A0C0E', // AMOLED surface / card
    '#121519', // AMOLED surfaceSubtle
    '#1A1E24', // AMOLED surfaceHighlight
    '#1E2229', // AMOLED border
    '#14171C', // AMOLED borderSubtle
    '#2C323D', // AMOLED borderHighlight
  ];

  function scanDirectory(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const files: string[] = [];
    for (const item of fs.readdirSync(dir)) {
      const full = path.join(dir, item);
      if (fs.statSync(full).isDirectory()) {
        files.push(...scanDirectory(full));
      } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
        files.push(full);
      }
    }
    return files;
  }

  const screensDir = path.resolve(__dirname, '../src/screens');
  const componentsDir = path.resolve(__dirname, '../src/components');

  const filesToAudit = [
    ...scanDirectory(screensDir),
    ...scanDirectory(componentsDir)
  ];

  assert(filesToAudit.length > 0, `Discovered ${filesToAudit.length} UI files in src/screens and src/components to audit`);

  let totalHardcodedViolations = 0;

  for (const filePath of filesToAudit) {
    const relativePath = path.relative(path.resolve(__dirname, '..'), filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf8');
    const foundTokens: string[] = [];

    for (const token of FORBIDDEN_DARK_TOKENS) {
      const regex = new RegExp(token.replace('#', '#'), 'i');
      if (regex.test(content)) {
        foundTokens.push(token);
      }
    }

    if (foundTokens.length > 0) {
      totalHardcodedViolations += foundTokens.length;
      assert(false, `No hardcoded dark colors in ${relativePath}`, `Found tokens: ${foundTokens.join(', ')}`);
    } else {
      assert(true, `No hardcoded dark colors in ${relativePath}`);
    }
  }

  assert(totalHardcodedViolations === 0, `Total hardcoded dark color violations across UI components is 0`);

  console.log('\n================================================================');
  console.log(`THEME & ID TESTS SUMMARY: ${passed}/${passed + failed} Passed (${failed} Failed)`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runThemeAndIdTestSuite();
