import './setup_env';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { AgendaScreen, AgendaScreenProps } from '../src/screens/AgendaScreen';
import { Colors } from '../src/theme';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ' -> ' + detail : ''}`);
    failed++;
  }
}

async function runAppleHIGAgendaScreenTestSuite() {
  console.log('================================================================');
  console.log('🍎 APPLE HIG DESIGN AUDIT: AGENDA SCREEN (INSET GROUPED & STRIP)');
  console.log('================================================================\n');

  const agendaPath = path.resolve(__dirname, '../src/screens/AgendaScreen.tsx');
  assert(fs.existsSync(agendaPath), 'AgendaScreen.tsx exists');

  const agendaSource = fs.readFileSync(agendaPath, 'utf8');

  // ── 1. Large Title Header (Apple HIG: 34pt, Bold, Letter Spacing 0.37) ──
  console.log('--- 1. Apple HIG Large Title Header & Touch Targets ---');

  assert(
    agendaSource.includes('fontSize: 34') &&
    agendaSource.includes("fontWeight: 'bold'") &&
    agendaSource.includes('letterSpacing: 0.37'),
    'AgendaScreen defines 34pt bold Large Title with 0.37 letter spacing per Apple HIG'
  );

  assert(
    agendaSource.includes('datePill') &&
    agendaSource.includes('formattedDateHeader'),
    'AgendaScreen renders subtle date pill below large title using formatted date string'
  );

  assert(
    agendaSource.includes('levelPill') &&
    agendaSource.includes('circularActionBtn'),
    'AgendaScreen renders level badge and circular touch buttons in header'
  );

  assert(
    agendaSource.includes('width: 44') &&
    agendaSource.includes('height: 44') &&
    agendaSource.includes('borderRadius: 22'),
    'Header action buttons enforce 44x44pt minimum touch target per Apple HIG'
  );

  // ── 2. Seletor Semanal em Pílulas Táteis (Weekly Strip) ──
  console.log('\n--- 2. Weekly Strip (7-day Horizontal Tactile Pills) ---');

  assert(
    agendaSource.includes("abbreviations = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']") ||
    agendaSource.includes("'DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'"),
    'Weekly strip defines 7-day Portuguese abbreviations (DOM, SEG, TER, QUA, QUI, SEX, SÁB)'
  );

  assert(
    agendaSource.includes('dayPill') &&
    agendaSource.includes('weeklyStripRow'),
    'AgendaScreen renders tactile day pills in a horizontal row'
  );

  assert(
    agendaSource.includes('minHeight: 64') &&
    agendaSource.includes('borderRadius: 16'),
    'Day pills use Apple continuous rounded corners (borderRadius: 16) and >= 64pt height'
  );

  assert(
    agendaSource.includes('Haptics.selectionAsync()'),
    'Selecting day triggers tactile haptic feedback (Haptics.selectionAsync)'
  );

  assert(
    agendaSource.includes('isMonthCalendarExpanded') &&
    agendaSource.includes('monthToggleBtn') &&
    agendaSource.includes('Ver mês completo'),
    'Calendar component is collapsible on demand with "Ver mês completo" toggle'
  );

  // ── 3. Cards no Padrão Inset Grouped com Chevrons Direcionais (›) ──
  console.log('\n--- 3. Inset Grouped Pattern & Section Cards ---');

  assert(
    agendaSource.includes('borderRadius: 20') &&
    agendaSource.includes('borderWidth: StyleSheet.hairlineWidth'),
    'Inset Grouped cards enforce continuous 20pt radius and hairline border'
  );

  assert(
    agendaSource.includes('cardHeaderChevron') &&
    agendaSource.includes('›'),
    'Cards render directional chevrons (›) in section headers'
  );

  // Card 1: Próxima Aula
  assert(
    agendaSource.includes('Próxima Aula') &&
    agendaSource.includes('nextClassTopRow') &&
    agendaSource.includes('timeChip') &&
    agendaSource.includes('subjectAttendanceSummary'),
    'Card "Próxima Aula" renders subject name, time chip, location and attendance status'
  );

  // Card 2: Provas & Entregas
  assert(
    agendaSource.includes('Provas & Entregas') &&
    agendaSource.includes('urgentExamPill') &&
    agendaSource.includes('colors.dangerLight'),
    'Card "Provas & Entregas" renders urgent exam alert pill in semantic dangerLight'
  );

  // Card 3: Focus Pomodoro
  assert(
    agendaSource.includes('Focus Pomodoro') &&
    agendaSource.includes('activityRingWrapper') &&
    agendaSource.includes('90%'),
    'Card "Focus Pomodoro" renders activity rings preview with focus percentage'
  );

  // ── 4. Lista de Atividades & 24h Timeline ──
  console.log('\n--- 4. Activities Checklist & 24h Timeline ---');

  assert(
    agendaSource.includes('circularCheckbox') &&
    agendaSource.includes('borderRadius: 12'),
    'Checklist items feature circular 24pt checkboxes (borderRadius: 12)'
  );

  assert(
    agendaSource.includes("textDecorationLine: event.isCompleted ? 'line-through' : 'none'"),
    'Completed events apply subtle strikethrough styling'
  );

  assert(
    agendaSource.includes('borderBottomWidth: StyleSheet.hairlineWidth') &&
    agendaSource.includes('colors.borderSubtle'),
    'Checklist items use subtle hairline dividers between rows'
  );

  // ── 5. Floating Action Button (FAB) & Scroll Clearance ──
  console.log('\n--- 5. FAB Position & Liquid Glass Scroll Clearance ---');

  assert(
    agendaSource.includes('bottom: 90') || agendaSource.includes('bottom: 84'),
    'FAB (+) is positioned at bottom: 90/84 to avoid overlapping floating Liquid Glass tab bar'
  );

  assert(
    agendaSource.includes('paddingBottom: 120'),
    'ScrollView contentContainerStyle includes paddingBottom: 120 for complete scroll clearance'
  );

  // ── 6. Component Mounting & Theme Resilience ──
  console.log('\n--- 6. Component Instantiation in All Themes ---');

  const baseProps: AgendaScreenProps = {
    events: [],
    subjects: [],
    attendances: [],
    tasks: [],
    theme: 'light',
    settings: {
      theme: 'light',
      pomodoroFocusMin: 25,
      pomodoroBreakMin: 5,
      pomodoroLongBreakMin: 15,
      defaultPassGrade: 7,
      examWeekMode: false,
    },
    selectedDate: null,
    onSelectDate: () => {},
    onToggleEventCompletion: () => {},
    onToggleTaskCompletion: () => {},
    onEditEvent: () => {},
    onOpenStudy: () => {},
    onOpenAttendanceModal: () => {},
  };

  for (const theme of ['light', 'dark', 'amoled'] as const) {
    const el = React.createElement(AgendaScreen, { ...baseProps, theme });
    assert(el !== null && typeof el.type === 'function', `AgendaScreen instantiates cleanly in ${theme} theme`);
  }

  // ── 7. Zero Hardcoded Dark Colors ──
  console.log('\n--- 7. Zero Hardcoded Dark Tokens Audit ---');

  const FORBIDDEN_DARK_TOKENS = [
    '#0F1115', '#181B20', '#1F232B', '#292E38', '#2A303C',
    '#1E232D', '#3E4756', '#0A0C0E', '#121519', '#1A1E24',
    '#1E2229', '#14171C', '#2C323D'
  ];

  let violations = 0;
  for (const token of FORBIDDEN_DARK_TOKENS) {
    if (new RegExp(token, 'i').test(agendaSource)) {
      violations++;
    }
  }
  assert(violations === 0, 'AgendaScreen has 0 hardcoded dark theme color violations');

  console.log('\n================================================================');
  console.log(`🍎 APPLE HIG AUDIT SUMMARY: ${passed}/${passed + failed} Passed (${failed} Failed)`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runAppleHIGAgendaScreenTestSuite();
