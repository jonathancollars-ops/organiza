import './setup_env';
import * as fs from 'fs';
import * as path from 'path';
import {
  simulateSubjectAbsences,
  simulateAbsenceForDate,
  findExamsNearDate,
  getDayDifference,
  getDayOfWeekName,
  isExamEvent,
  SubjectAbsenceSimulation,
  DateAbsenceSimulationResult,
  AbsenceRiskLevel
} from '../src/utils/absencePlanner';
import { Subject, AppEvent, AttendanceRecord } from '../src/types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string): void {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  totalTests++;
  if (actual === expected) {
    passedTests++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${message} (Expected: ${String(expected)}, Got: ${String(actual)})`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  console.log(`\n--- Test: ${name} ---`);
  await fn();
}

async function runTestSuite(): Promise<void> {
  console.log('================================================================');
  console.log('🏖️ STRATEGIC ABSENCE PLANNER & RISK SIMULATION TEST SUITE');
  console.log('================================================================');

  const baseSubject: Subject = {
    id: 'subj_math_101',
    name: 'Cálculo Diferencial',
    color: '#00FFAA',
    icon: 'calculator',
    code: 'MAT101',
    semesterId: 'sem_1',
    workloadHours: 60,
    maxAbsences: 15,
    isArchived: false,
    groups: []
  };

  // ==========================================================================
  // SUITE 1: Absence Planner Engine Core Calculations
  // ==========================================================================
  console.log('\n--- SUITE 1: Absence Planner Engine Core Calculations ---');

  await test('Student with 2 absences out of 15: adding +1 absence maintains "safe" status (presence > 80%)', () => {
    // 18 presences + 2 absences = 20 total classes attended/missed so far
    const attendances: AttendanceRecord[] = [
      ...Array.from({ length: 18 }, (_, i): AttendanceRecord => ({
        id: `att_pres_${i}`,
        subjectId: baseSubject.id,
        eventId: 'evt_class',
        status: 'present',
        date: `2026-08-${String(i + 1).padStart(2, '0')}`
      })),
      { id: 'att_abs_1', subjectId: baseSubject.id, eventId: 'evt_class', status: 'absent', date: '2026-08-25' },
      { id: 'att_abs_2', subjectId: baseSubject.id, eventId: 'evt_class', status: 'absent', date: '2026-08-26' }
    ];

    const simulation: SubjectAbsenceSimulation = simulateSubjectAbsences(baseSubject, 1, attendances);

    assertEqual(simulation.currentAbsences, 2, 'Initial currentAbsences is 2');
    assertEqual(simulation.maxAbsences, 15, 'Max absences is 15');
    assertEqual(simulation.projectedAbsences, 3, 'Projected absences with +1 is 3');
    assertEqual(simulation.remainingAbsences, 12, 'Remaining absences is 12 (15 - 3)');
    assertEqual(simulation.currentPresenceRate, 90.0, 'Current presence rate is 90.0% (18/20)');
    // 18 / 21 = 85.714... -> 85.7%
    assertEqual(simulation.projectedPresenceRate, 85.7, 'Projected presence rate is 85.7% (18/21)');
    assert(simulation.projectedPresenceRate > 80.0, 'Projected presence rate remains > 80%');
    assertEqual(simulation.riskLevel, 'safe', 'Risk level is strictly "safe"');
    assertEqual(simulation.hasExamInSameWeek, false, 'No exam detected in same week');
  });

  await test('Student at boundary (14 of 15): adding +1 triggers "warning" then "danger" (reprovação)', () => {
    // 1. Setup threshold student with 7 absences (safe) -> adding +1 triggers warning (8/15 >= 50%)
    const attendancesWarningTransition: AttendanceRecord[] = Array.from({ length: 7 }, (_, i): AttendanceRecord => ({
      id: `att_abs_w_${i}`,
      subjectId: baseSubject.id,
      eventId: 'evt_class',
      status: 'absent',
      date: `2026-08-${String(i + 1).padStart(2, '0')}`
    }));

    const simBeforeWarning = simulateSubjectAbsences(baseSubject, 0, attendancesWarningTransition);
    assertEqual(simBeforeWarning.currentAbsences, 7, 'Current absences is 7 (46.7%)');
    assertEqual(simBeforeWarning.riskLevel, 'safe', 'Status before threshold is safe');

    const simAtWarning = simulateSubjectAbsences(baseSubject, 1, attendancesWarningTransition);
    assertEqual(simAtWarning.projectedAbsences, 8, 'Projected absences with +1 is 8 (53.3%)');
    assertEqual(simAtWarning.riskLevel, 'warning', 'Adding +1 crosses 50% threshold and triggers "warning" status');

    // 2. Setup threshold student with 11 absences (warning: 73.3%) -> adding +1 reaches 12 (80% danger)
    const attendancesDangerTransition: AttendanceRecord[] = Array.from({ length: 11 }, (_, i): AttendanceRecord => ({
      id: `att_abs_d_${i}`,
      subjectId: baseSubject.id,
      eventId: 'evt_class',
      status: 'absent',
      date: `2026-08-${String(i + 1).padStart(2, '0')}`
    }));

    const simBeforeDanger = simulateSubjectAbsences(baseSubject, 0, attendancesDangerTransition);
    assertEqual(simBeforeDanger.currentAbsences, 11, 'Current absences is 11 (73.3%)');
    assertEqual(simBeforeDanger.riskLevel, 'warning', 'Status at 11 absences is warning');

    const simAtDanger = simulateSubjectAbsences(baseSubject, 1, attendancesDangerTransition);
    assertEqual(simAtDanger.projectedAbsences, 12, 'Projected absences with +1 is 12 (80%)');
    assertEqual(simAtDanger.riskLevel, 'danger', 'Adding +1 reaches 80% threshold and triggers "danger"');

    // 3. Setup student on the brink with 14 absences of 15
    const attendancesCritical: AttendanceRecord[] = Array.from({ length: 14 }, (_, i): AttendanceRecord => ({
      id: `att_abs_crit_${i}`,
      subjectId: baseSubject.id,
      eventId: 'evt_class',
      status: 'absent',
      date: `2026-08-${String(i + 1).padStart(2, '0')}`
    }));

    const simCritical = simulateSubjectAbsences(baseSubject, 0, attendancesCritical);
    assertEqual(simCritical.currentAbsences, 14, 'Current absences is 14');
    assertEqual(simCritical.remainingAbsences, 1, 'Only 1 remaining absence left');
    assertEqual(simCritical.riskLevel, 'danger', '14/15 is already in danger zone');

    // Adding 1 more absence hits max limit (15/15) -> zero remaining absences (reprovação)
    const simFailed = simulateSubjectAbsences(baseSubject, 1, attendancesCritical);
    assertEqual(simFailed.projectedAbsences, 15, 'Projected absences is 15 (100% of max)');
    assertEqual(simFailed.remainingAbsences, 0, 'Remaining absences drops to 0 (reprovação por faltas)');
    assertEqual(simFailed.riskLevel, 'danger', 'Risk level is strictly "danger" at max limit');

    // Adding beyond max limit (e.g. +2 -> 16/15)
    const simExceeded = simulateSubjectAbsences(baseSubject, 2, attendancesCritical);
    assertEqual(simExceeded.projectedAbsences, 16, 'Projected absences is 16');
    assertEqual(simExceeded.remainingAbsences, 0, 'Remaining absences is clamped to 0');
    assertEqual(simExceeded.riskLevel, 'danger', 'Status remains "danger" when exceeded');
  });

  await test('Exact presence rate calculation (expected % precision)', () => {
    // Case A: 15 presences and 5 absences -> 15/20 = 75.0%
    const attendancesA: AttendanceRecord[] = [
      ...Array.from({ length: 15 }, (_, i): AttendanceRecord => ({
        id: `att_p_${i}`,
        subjectId: baseSubject.id,
        eventId: 'evt_class',
        status: 'present',
        date: '2026-08-01'
      })),
      ...Array.from({ length: 5 }, (_, i): AttendanceRecord => ({
        id: `att_a_${i}`,
        subjectId: baseSubject.id,
        eventId: 'evt_class',
        status: 'absent',
        date: '2026-08-02'
      }))
    ];

    const simA = simulateSubjectAbsences(baseSubject, 5, attendancesA);
    assertEqual(simA.currentPresenceRate, 75.0, 'Current rate is exactly 75.0% (15/20)');
    // Adding 5 absences: 15 / 25 = 60.0%
    assertEqual(simA.projectedPresenceRate, 60.0, 'Projected rate is exactly 60.0% (15/25)');

    // Case B: No attendance records yet -> 100.0% safe default
    const simB = simulateSubjectAbsences(baseSubject, 0, []);
    assertEqual(simB.currentPresenceRate, 100.0, 'Default presence rate with 0 records is 100.0%');
    assertEqual(simB.projectedPresenceRate, 100.0, 'Projected presence rate with 0 records and 0 added is 100.0%');

    // Case C: 1 added absence with 0 previous records -> 0 presences / 1 absence -> 0.0%
    const simC = simulateSubjectAbsences(baseSubject, 1, []);
    assertEqual(simC.projectedPresenceRate, 0.0, 'Projected presence rate with 0 presences and 1 absence is 0.0%');
  });

  await test('Exam in the same week detection (hasExamInSameWeek: true) and risk escalation', () => {
    const targetDate = '2026-09-10'; // Simulated absence date (Thursday)
    const examDate = '2026-09-12';   // Exam on Saturday (2 days later, diff <= 3)

    const events: AppEvent[] = [
      {
        id: 'evt_exam_p1',
        subjectId: baseSubject.id,
        title: 'P1 Cálculo Diferencial',
        date: `${examDate}T08:00:00.000Z`,
        startTime: '08:00',
        endTime: '10:00',
        category: 'Provas/Trabalhos',
        alerts: [60]
      }
    ];

    // Check direct utility findExamsNearDate
    const directCheck = findExamsNearDate(baseSubject.id, targetDate, events, 3);
    assertEqual(directCheck.hasExam, true, 'findExamsNearDate identifies exam within 3 days window');
    assert(
      Boolean(directCheck.examDetails && directCheck.examDetails.includes('P1 Cálculo Diferencial')),
      'examDetails contains exam title'
    );
    assert(
      Boolean(directCheck.examDetails && directCheck.examDetails.includes('2 dia(s) depois')),
      'examDetails calculates correct relative offset'
    );

    // Simulate subject absence on targetDate with exam in the same week
    const simWithExam = simulateSubjectAbsences(baseSubject, 1, [], events, targetDate);
    assertEqual(simWithExam.hasExamInSameWeek, true, 'hasExamInSameWeek is strictly true');
    assert(Boolean(simWithExam.examDetails), 'examDetails is populated');

    // Risk escalation check: normally 1/15 is "safe", but exam in same week escalates to "warning"
    assertEqual(simWithExam.riskLevel, 'warning', 'Exam in the same week elevates safe risk to warning');

    // Exam beyond tolerance window (e.g. 10 days away)
    const distantEvents: AppEvent[] = [
      {
        id: 'evt_exam_distant',
        subjectId: baseSubject.id,
        title: 'P2 Cálculo',
        date: '2026-09-25T08:00:00.000Z',
        category: 'Provas/Trabalhos',
        alerts: []
      }
    ];
    const distantCheck = findExamsNearDate(baseSubject.id, targetDate, distantEvents, 3);
    assertEqual(distantCheck.hasExam, false, 'Exam > 3 days away is not detected as same week');

    const simWithoutExam = simulateSubjectAbsences(baseSubject, 1, [], distantEvents, targetDate);
    assertEqual(simWithoutExam.hasExamInSameWeek, false, 'hasExamInSameWeek is false when exam is distant');
    assertEqual(simWithoutExam.riskLevel, 'safe', 'Risk level remains safe when exam is distant');
  });

  await test('Simulation on day with no scheduled classes returns empty affected array', () => {
    // Target date: Sunday, 2026-09-13
    const sundayDate = '2026-09-13';

    // Monday class event only
    const events: AppEvent[] = [
      {
        id: 'evt_monday_class',
        subjectId: baseSubject.id,
        title: 'Aula Cálculo',
        date: '2026-09-07T08:00:00.000Z',
        category: 'Faculdade/Aulas',
        recurrence: 'weekly',
        recurrenceDays: [1], // Monday = 1
        alerts: []
      }
    ];

    const result: DateAbsenceSimulationResult = simulateAbsenceForDate(
      sundayDate,
      [baseSubject],
      events,
      []
    );

    assertEqual(result.date, '2026-09-13', 'Date matches Sunday string');
    assertEqual(result.dayOfWeekName, 'Domingo', 'Day of week correctly identified as Domingo');
    assertEqual(result.affectedSubjects.length, 0, 'affectedSubjects is empty array');
    assertEqual(result.overallVerdict, 'safe', 'overallVerdict is safe when no classes are missed');
  });

  await test('Helper utilities: getDayDifference, getDayOfWeekName, isExamEvent', () => {
    // getDayDifference
    assertEqual(getDayDifference('2026-09-10', '2026-09-10'), 0, 'Same date diff is 0');
    assertEqual(getDayDifference('2026-09-10', '2026-09-13'), 3, '3 days difference is 3');
    assertEqual(getDayDifference('2026-09-13', '2026-09-10'), 3, 'Reversed order difference is 3');
    assertEqual(getDayDifference('', '2026-09-10'), 999, 'Empty string returns 999');
    assertEqual(getDayDifference('invalid', '2026-09-10'), 999, 'Invalid string returns 999');

    // getDayOfWeekName
    assertEqual(getDayOfWeekName('2026-09-07'), 'Segunda-feira', '2026-09-07 is Segunda-feira');
    assertEqual(getDayOfWeekName('2026-09-08'), 'Terça-feira', '2026-09-08 is Terça-feira');
    assertEqual(getDayOfWeekName('2026-09-13'), 'Domingo', '2026-09-13 is Domingo');
    assertEqual(getDayOfWeekName(''), 'Desconhecido', 'Empty date string returns Desconhecido');
    assertEqual(getDayOfWeekName('invalid'), 'Desconhecido', 'Malformed date string returns Desconhecido');

    // isExamEvent
    const examByCategory: AppEvent = { id: 'e1', title: 'Avaliação', date: '2026-09-10', category: 'Provas/Trabalhos', alerts: [] };
    const examByTitle: AppEvent = { id: 'e2', title: 'Prova Final de Física', date: '2026-09-10', alerts: [] };
    const examByDesc: AppEvent = { id: 'e3', title: 'Atividade 1', description: 'Realização de prova individual', date: '2026-09-10', alerts: [] };
    const nonExam: AppEvent = { id: 'e4', title: 'Aula Prática de Laboratório', date: '2026-09-10', category: 'Faculdade/Aulas', alerts: [] };

    assertEqual(isExamEvent(examByCategory), true, 'Identifies exam by category Provas/Trabalhos');
    assertEqual(isExamEvent(examByTitle), true, 'Identifies exam by title containing prova');
    assertEqual(isExamEvent(examByDesc), true, 'Identifies exam by description containing prova');
    assertEqual(isExamEvent(nonExam), false, 'Non-exam event returns false');
  });

  // ==========================================================================
  // SUITE 2: UI Integration & Screen Triggers
  // ==========================================================================
  console.log('\n--- SUITE 2: UI Integration & Screen Triggers ---');

  await test('AttendanceScreen.tsx contains trigger button and modal wiring for the Absence Planner', () => {
    const screensDir = path.resolve(__dirname, '../src/screens');
    const attendanceSource = fs.readFileSync(path.join(screensDir, 'AttendanceScreen.tsx'), 'utf8');

    // 1. Verify import of AbsencePlannerModal
    assert(
      attendanceSource.includes("import { AbsencePlannerModal } from '../components/AbsencePlannerModal';"),
      'AttendanceScreen.tsx imports AbsencePlannerModal'
    );

    // 2. Verify state variable for modal visibility
    assert(
      attendanceSource.includes('const [plannerModalVisible, setPlannerModalVisible] = useState(false);') ||
      attendanceSource.includes('plannerModalVisible'),
      'AttendanceScreen.tsx defines plannerModalVisible state'
    );

    // 3. Verify trigger button "Posso Faltar?" exists in header
    assert(
      attendanceSource.includes('accessibilityLabel="Abrir simulador Posso Faltar?"') ||
      attendanceSource.includes('Posso Faltar?'),
      'AttendanceScreen.tsx contains "Posso Faltar?" button accessibility label / title'
    );

    assert(
      attendanceSource.includes('setPlannerModalVisible(true)'),
      'Trigger button onPress calls setPlannerModalVisible(true)'
    );

    // 4. Verify AbsencePlannerModal JSX element wiring
    assert(
      attendanceSource.includes('<AbsencePlannerModal'),
      'AttendanceScreen.tsx renders <AbsencePlannerModal />'
    );

    assert(
      attendanceSource.includes('visible={plannerModalVisible}'),
      'AbsencePlannerModal is bound to plannerModalVisible'
    );

    assert(
      attendanceSource.includes('setPlannerModalVisible(false)'),
      'AbsencePlannerModal onClose resets plannerModalVisible to false'
    );

    assert(
      attendanceSource.includes('subjects={subjects}') &&
      attendanceSource.includes('events={events}') &&
      attendanceSource.includes('attendances={attendances}'),
      'AbsencePlannerModal receives subjects, events, and attendances props'
    );
  });

  await test('AbsencePlannerModal.tsx defines both simulation modes ("by_date" and "by_subject")', () => {
    const componentsDir = path.resolve(__dirname, '../src/components');
    const modalSource = fs.readFileSync(path.join(componentsDir, 'AbsencePlannerModal.tsx'), 'utf8');

    assert(
      modalSource.includes("'by_date'") && modalSource.includes("'by_subject'"),
      'AbsencePlannerModal supports both "by_date" and "by_subject" simulation modes'
    );

    assert(
      modalSource.includes('getWeeklyExams'),
      'AbsencePlannerModal includes weekly exams conflict detection'
    );

    assert(
      modalSource.includes('getCurrentAbsences'),
      'AbsencePlannerModal calculates current absences from records'
    );

    assert(
      modalSource.includes('dateSimulationResults') || modalSource.includes('subjectSimulationResult'),
      'AbsencePlannerModal computes reactive simulation results'
    );
  });

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passedTests}/${totalTests} Tests Passed (${failedTests} Failed)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
