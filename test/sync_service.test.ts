import './setup_env';
import { SyncService } from '../src/services/SyncService';
import { StorageService } from '../src/services/storage';
import { AppEvent, AttendanceRecord, Subject, AIParsedItem } from '../src/types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureDetails: string[] = [];

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    const msg = `  [FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`;
    console.error(msg);
    failureDetails.push(msg);
  }
}

function assertEqual<T>(actual: T, expected: T, testName: string) {
  const match = JSON.stringify(actual) === JSON.stringify(expected);
  assert(match, testName, `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

export async function runSyncServiceTests() {
  console.log('================================================================');
  console.log('SYNC SERVICE UNIT & INTEGRATION TEST SUITE');
  console.log('================================================================\n');

  const subjects: Subject[] = [
    {
      id: 'sub_1',
      name: 'Cálculo 1',
      gradeGroups: [{ id: 'gg_1', name: 'Avaliações', weight: 1, items: [] }]
    },
    {
      id: 'sub_2',
      name: 'Algoritmos e Estruturas de Dados',
      gradeGroups: [{ id: 'gg_2', name: 'Trabalhos', weight: 1, items: [] }]
    },
    {
      id: 'sub_3',
      name: 'Física I',
      gradeGroups: [{ id: 'gg_3', name: 'Provas', weight: 1, items: [] }]
    }
  ];

  const classEvents: AppEvent[] = [
    {
      id: 'ev_class_1',
      title: 'Aula de Cálculo 1',
      category: 'Faculdade/Aulas',
      date: '2026-08-17',
      startTime: '08:00',
      endTime: '10:00',
      recurrence: 'weekly',
      alerts: [15],
      isCompleted: false,
      subjectId: 'sub_1'
    }
  ];

  // 1. Subject Matching Algorithm
  console.log('--- 1. Subject Matching Algorithm ---');
  assert(SyncService.matchSubject('sub_1', subjects)?.id === 'sub_1', 'Matches subject by direct ID');
  assert(SyncService.matchSubject('Cálculo 1', subjects)?.id === 'sub_1', 'Matches subject by exact name');
  assert(SyncService.matchSubject('calculo 1', subjects)?.id === 'sub_1', 'Matches subject with accent normalization');
  assert(SyncService.matchSubject('Física 1', subjects)?.id === 'sub_3', 'Matches Roman vs Arabic numerals (Física 1 -> Física I)');
  assert(SyncService.matchSubject('Algoritmos', subjects)?.id === 'sub_2', 'Matches subject by unambiguous substring');
  assert(SyncService.matchSubject('História', subjects) === undefined, 'Returns undefined for unregistered subject');

  // 2. Class Event Lookup
  console.log('\n--- 2. Class Event Lookup ---');
  const foundClass = SyncService.findClassEvent('sub_1', '2026-08-17', classEvents);
  assert(foundClass?.id === 'ev_class_1', 'Finds weekly recurring class matching target date');

  // 3. Class Cancellation Sync
  console.log('\n--- 3. Class Cancellation Processing ---');
  const cancelItem: AIParsedItem = {
    intent: 'cancelled_class',
    subjectName: 'Cálculo 1',
    title: 'Aula Cancelada - Cálculo 1',
    targetDate: '2026-08-17',
    startTime: '08:00',
    endTime: '10:00',
    alerts: [10080, 1440],
    rawSummary: 'Aula de Cálculo 1 cancelada em 2026-08-17'
  };

  const cancelResult = await SyncService.processParsedItems(
    [cancelItem],
    classEvents,
    [],
    subjects
  );

  assert(cancelResult.updatedAttendances.length === 1, 'Creates 1 attendance record for cancellation');
  assert(cancelResult.updatedAttendances[0].status === 'cancelled', 'Attendance record status is cancelled');
  assert(cancelResult.updatedAttendances[0].subjectId === 'sub_1', 'Linked to correct subjectId');
  assert(cancelResult.updatedAttendances[0].eventId === 'ev_class_1', 'Linked to weekly class eventId');

  // 4. Homework Sync with [10080, 1440] Alerts
  console.log('\n--- 4. Homework Processing & Alert Invariants ---');
  const hwItem: AIParsedItem = {
    intent: 'homework',
    subjectName: 'Algoritmos e Estruturas de Dados',
    title: 'Entrega Lista de Exercícios 3 - Algoritmos',
    targetDate: '2026-08-24',
    startTime: '23:59',
    endTime: '23:59',
    alerts: [10080, 1440],
    rawSummary: 'Entrega lista 3'
  };

  const hwResult = await SyncService.processParsedItems(
    [hwItem],
    cancelResult.updatedEvents,
    cancelResult.updatedAttendances,
    cancelResult.updatedSubjects
  );

  const hwEvent = hwResult.updatedEvents.find(e => e.title.includes('Lista de Exercícios 3'));
  assert(hwEvent !== undefined, 'Created homework event in calendar');
  assert(hwEvent?.category === 'Provas/Trabalhos', 'Category set to Provas/Trabalhos');
  assertEqual(hwEvent?.alerts, [10080, 1440], 'Alerts set strictly to [10080, 1440]');
  assert(hwEvent?.startTime === '23:59', 'Homework deadline set to 23:59');

  // 5. Exam Sync & Grade Linking
  console.log('\n--- 5. Exam Processing & Grade Item Integration ---');
  const examItem: AIParsedItem = {
    intent: 'exam',
    subjectName: 'Física I',
    title: 'Prova P2 - Física I',
    targetDate: '2026-08-28',
    startTime: '08:00',
    endTime: '10:00',
    alerts: [10080, 1440],
    rawSummary: 'Prova P2 de Física I em 2026-08-28'
  };

  const examResult = await SyncService.processParsedItems(
    [examItem],
    hwResult.updatedEvents,
    hwResult.updatedAttendances,
    hwResult.updatedSubjects
  );

  const examEvent = examResult.updatedEvents.find(e => e.title.includes('Prova P2'));
  assert(examEvent !== undefined, 'Created exam event in calendar');
  assert(examEvent?.date === '2026-08-28', 'Exam date set to 2026-08-28');
  assertEqual(examEvent?.alerts, [10080, 1440], 'Exam alerts set to [10080, 1440]');

  const updatedFisica = examResult.updatedSubjects.find(s => s.id === 'sub_3');
  const linkedGradeItem = updatedFisica?.gradeGroups?.[0]?.items?.find(i => i.eventId === examEvent?.id);
  assert(linkedGradeItem !== undefined, 'Registered exam as GradeItem in Subject gradeGroups');
  assert(linkedGradeItem?.name === examEvent?.title, 'Grade item name matches exam title');
  assert(linkedGradeItem?.maxGrade === 10, 'Grade item maxGrade is 10');

  // 6. Simulation Debug Runner Check
  console.log('\n--- 6. runSimulation Runner Execution ---');
  const sim = await SyncService.runSimulation(null, [], [], []);
  assert(sim.updatedSubjects.length === 3, 'Simulation provisions 3 standard subjects');
  assert(sim.updatedAttendances.some(a => a.status === 'cancelled'), 'Simulation creates cancelled attendance');
  assert(sim.updatedEvents.some(e => e.title.includes('Exercícios')), 'Simulation creates homework event');
  assert(sim.updatedEvents.some(e => e.title.includes('Prova P2')), 'Simulation creates exam event');
  assert(sim.syncResult.logs.length > 5, 'Simulation produces informative trace logs');

  console.log('\n================================================================');
  console.log(`SYNC SERVICE TESTS SUMMARY: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    throw new Error(`${failedTests} Sync Service tests failed.`);
  }
}

if (require.main === module) {
  runSyncServiceTests().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
