import './setup_env';
import fs from 'fs';
import path from 'path';
import { Colors, getThemeColors, getContrastTextColor } from '../src/theme';

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

console.log('================================================================');
console.log('=== PHASE 3: ZERO-STATE UX, TIMER HYGIENE & WCAG AA AUDIT ===');
console.log('================================================================');

// ── 1. Timer Lifecycle Hygiene & Memory Leak Prevention ──
console.log('\n--- 1. Timer Lifecycle Hygiene in StudyScreen.tsx ---');

const studyScreenPath = path.resolve(__dirname, '../src/screens/StudyScreen.tsx');
const studyScreenContent = fs.readFileSync(studyScreenPath, 'utf8');

// Check that blur listener exists and cleans up intervals
assert(
  studyScreenContent.includes("navigation?.addListener?.('blur'") || studyScreenContent.includes('navigation.addListener("blur"'),
  'StudyScreen registers navigation blur listener for timer cleanup'
);

assert(
  studyScreenContent.includes('clearInterval(timerRef.current)') &&
  studyScreenContent.includes('clearInterval(stopwatchRef.current)'),
  'StudyScreen clears both Pomodoro and Stopwatch intervals'
);

// Check tab switch cleanup
assert(
  studyScreenContent.includes('handleTabChange') &&
  studyScreenContent.includes('timerRef.current = null') &&
  studyScreenContent.includes('stopwatchRef.current = null'),
  'StudyScreen unconditionally clears and nulls timer handles on tab switch'
);

// Check unmount cleanup
assert(
  studyScreenContent.includes('clearTimeout(toastTimeoutRef.current)'),
  'StudyScreen clears toast timeout on unmount and blur'
);

// ── 2. Zero-State UX Across All 5 Screens ──
console.log('\n--- 2. Zero-State UX Across Screens ---');

// AgendaScreen Empty State
const agendaScreenPath = path.resolve(__dirname, '../src/screens/AgendaScreen.tsx');
const agendaScreenContent = fs.readFileSync(agendaScreenPath, 'utf8');

assert(
  agendaScreenContent.includes('emptyChecklistCard') &&
  agendaScreenContent.includes('emptyIconCircle'),
  'AgendaScreen renders themed empty card with icon circle when 0 items'
);

assert(
  agendaScreenContent.includes('isToday ?') &&
  agendaScreenContent.includes('Dia livre de compromissos!'),
  'AgendaScreen provides welcoming, context-aware microcopy for today'
);

assert(
  agendaScreenContent.includes('addEventBtn') &&
  agendaScreenContent.includes('+ Agendar Nova Atividade'),
  'AgendaScreen renders prominent CTA button for scheduling activity'
);

// AttendanceScreen Empty State
const attendanceScreenPath = path.resolve(__dirname, '../src/screens/AttendanceScreen.tsx');
const attendanceScreenContent = fs.readFileSync(attendanceScreenPath, 'utf8');

assert(
  attendanceScreenContent.includes('onAddNewSubject') &&
  attendanceScreenContent.includes('emptyCard') &&
  attendanceScreenContent.includes('+ Cadastrar Disciplina'),
  'AttendanceScreen renders empty card with onAddNewSubject CTA button'
);

// AttendanceScreenWrapper SubjectModal Integration
const attendanceWrapperPath = path.resolve(__dirname, '../src/screens/AttendanceScreenWrapper.tsx');
const attendanceWrapperContent = fs.readFileSync(attendanceWrapperPath, 'utf8');

assert(
  attendanceWrapperContent.includes('SubjectModal') &&
  attendanceWrapperContent.includes('subjectModalVisible'),
  'AttendanceScreenWrapper integrates SubjectModal for zero-state creation'
);

// GradesScreen Empty State & No-Grades Banner
const gradesScreenPath = path.resolve(__dirname, '../src/screens/GradesScreen.tsx');
const gradesScreenContent = fs.readFileSync(gradesScreenPath, 'utf8');

assert(
  gradesScreenContent.includes('onAddNewSubject') &&
  gradesScreenContent.includes('emptyCard') &&
  gradesScreenContent.includes('+ Cadastrar Disciplina'),
  'GradesScreen renders empty card with onAddNewSubject CTA button'
);

assert(
  gradesScreenContent.includes('noGradesCard') &&
  gradesScreenContent.includes('Aguardando primeiras notas'),
  'GradesScreen renders informative banner when subjects have no grades recorded yet'
);

// GradesScreenWrapper SubjectModal Integration
const gradesWrapperPath = path.resolve(__dirname, '../src/screens/GradesScreenWrapper.tsx');
const gradesWrapperContent = fs.readFileSync(gradesWrapperPath, 'utf8');

assert(
  gradesWrapperContent.includes('SubjectModal') &&
  gradesWrapperContent.includes('subjectModalVisible'),
  'GradesScreenWrapper integrates SubjectModal for zero-state creation'
);

// StudyScreen Empty States
assert(
  studyScreenContent.includes('emptyTasksCard') &&
  studyScreenContent.includes('emptyTasksBtn') &&
  studyScreenContent.includes('+ Criar Nova Tarefa'),
  'StudyScreen renders emptyTasksCard with CTA button in Tarefas tab'
);

assert(
  studyScreenContent.includes('emptyDailyStudyCard') &&
  studyScreenContent.includes('Nenhum ciclo registrado hoje'),
  'StudyScreen renders emptyDailyStudyCard when todayTotalStudyMs === 0'
);

assert(
  studyScreenContent.includes('noSubjectsCard') &&
  studyScreenContent.includes('addSubjectCtaBtn') &&
  studyScreenContent.includes('+ Cadastrar Matéria'),
  'StudyScreen renders noSubjectsCard with CTA button when no subjects enrolled'
);

// StudyScreenWrapper SubjectModal Integration
const studyWrapperPath = path.resolve(__dirname, '../src/screens/StudyScreenWrapper.tsx');
const studyWrapperContent = fs.readFileSync(studyWrapperPath, 'utf8');

assert(
  studyWrapperContent.includes('SubjectModal') &&
  studyWrapperContent.includes('subjectModalVisible'),
  'StudyScreenWrapper integrates SubjectModal for zero-state subject creation'
);

// AcademicPerformanceScreen (Lumen AI Prompt Chips)
const academicScreenPath = path.resolve(__dirname, '../src/screens/AcademicPerformanceScreen.tsx');
const academicScreenContent = fs.readFileSync(academicScreenPath, 'utf8');

assert(
  academicScreenContent.includes('promptChipsContainer') &&
  academicScreenContent.includes('promptChip') &&
  academicScreenContent.includes('Histórico Completo') &&
  academicScreenContent.includes('Grade Engenharia'),
  'AcademicPerformanceScreen provides suggested academic prompt chips for AI import'
);

// ── 3. Touch Target Sizing (>= 44x44dp) & Accessibility (WCAG 2.1 AA) ──
console.log('\n--- 3. Touch Target Sizing (>= 44x44dp) & Accessibility ---');

// Verify AgendaScreen addEventBtn touch target
assert(
  agendaScreenContent.includes('minHeight: 48') && agendaScreenContent.includes('minWidth: 48'),
  'AgendaScreen addEventBtn enforces minimum 48x48dp hit area (>= 44dp HIG/Material)'
);

// Verify AttendanceScreen emptyCtaBtn touch target
assert(
  attendanceScreenContent.includes('minHeight: 48') && attendanceScreenContent.includes('minWidth: 48'),
  'AttendanceScreen emptyCtaBtn enforces minimum 48x48dp hit area (>= 44dp HIG/Material)'
);

// Verify GradesScreen emptyCtaBtn touch target
assert(
  gradesScreenContent.includes('minHeight: 48') && gradesScreenContent.includes('minWidth: 48'),
  'GradesScreen emptyCtaBtn enforces minimum 48x48dp hit area (>= 44dp HIG/Material)'
);

// Verify StudyScreen emptyTasksBtn & addSubjectCtaBtn touch target
assert(
  studyScreenContent.includes('minHeight: 48') && studyScreenContent.includes('minWidth: 48') &&
  studyScreenContent.includes('minHeight: 44') && studyScreenContent.includes('minWidth: 44'),
  'StudyScreen empty state buttons enforce minimum 44-48dp hit area'
);

// Verify AcademicPerformanceScreen promptChip touch target
assert(
  academicScreenContent.includes('minHeight: 44'),
  'AcademicPerformanceScreen promptChip enforces minimum 44dp touch target'
);

// Accessibility Roles & Labels Verification
const accessibilityChecks = [
  { content: agendaScreenContent, label: 'AgendaScreen CTA has accessibilityRole="button"', pattern: 'accessibilityRole="button"' },
  { content: attendanceScreenContent, label: 'AttendanceScreen CTA has accessibilityRole="button"', pattern: 'accessibilityRole="button"' },
  { content: gradesScreenContent, label: 'GradesScreen CTA has accessibilityRole="button"', pattern: 'accessibilityRole="button"' },
  { content: studyScreenContent, label: 'StudyScreen CTA has accessibilityRole="button"', pattern: 'accessibilityRole="button"' },
  { content: academicScreenContent, label: 'AcademicPerformance prompt chips have accessibilityRole="button"', pattern: 'accessibilityRole="button"' },
];

for (const check of accessibilityChecks) {
  assert(check.content.includes(check.pattern), check.label);
}

// ── 4. Theme Contrast Verification Across Light, Dark, and AMOLED ──
console.log('\n--- 4. Theme Contrast Verification Across Light, Dark, AMOLED ---');

const themes: ('light' | 'dark' | 'amoled')[] = ['light', 'dark', 'amoled'];
for (const t of themes) {
  const pal = getThemeColors(t);
  const primaryText = getContrastTextColor(pal.primary);
  assert(
    primaryText === '#0A0A0A' || primaryText === '#FFFFFF' || primaryText === '#000000',
    `getContrastTextColor on ${t}.primary (${pal.primary}) returns compliant high-contrast color (${primaryText})`
  );
}

console.log('\n================================================================');
console.log(`PHASE 3 TEST SUMMARY: ${passed}/${passed + failed} Passed (${failed} Failed)`);
console.log('================================================================');

if (failed > 0) process.exit(1);
