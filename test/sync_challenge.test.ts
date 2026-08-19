import './setup_env';
import { memoryStore, mockAsyncStorage } from './setup_env';
import { SyncService, SIMULATION_RAW_MESSAGES } from '../src/services/SyncService';
import { AIParsingService } from '../src/services/AIParsingService';
import { TeamsService } from '../src/services/TeamsService';
import { StorageService } from '../src/services/storage';
import { Subject, AppEvent, AttendanceRecord, AIParsedItem, AIConfig } from '../src/types';
import { format, parseISO, getDay } from 'date-fns';

// ============================================================================
// CHALLENGE TEST SUITE FOR ORGANIZA TEAMS & AI INTEGRATION (M1)
// ============================================================================

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

async function runTestSuite() {
  console.log('================================================================');
  console.log('STARTING EMPIRICAL CHALLENGE TESTS — MILESTONE 1');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // SUITE 1: CANONICAL 3 INTENTS VIA SyncService.processParsedItems
  // --------------------------------------------------------------------------
  console.log('--- SUITE 1: Primary Intents (processParsedItems) ---');

  // Base test subjects
  const subjectCalc: Subject = {
    id: 'subj_calc_1',
    name: 'Cálculo 1',
    color: '#0A84FF',
    passGrade: 7.0,
    maxAbsences: 15,
    workloadHours: 60,
    gradeGroups: [{
      id: 'group_calc_1',
      name: 'Provas',
      weight: 1,
      items: []
    }]
  };

  const subjectAlgo: Subject = {
    id: 'subj_algo_1',
    name: 'Algoritmos',
    color: '#00FFAA',
    passGrade: 7.0,
    maxAbsences: 15,
    workloadHours: 60,
    gradeGroups: []
  };

  const subjectFis: Subject = {
    id: 'subj_fis_1',
    name: 'Física I',
    color: '#BF5AF2',
    passGrade: 7.0,
    maxAbsences: 15,
    workloadHours: 60,
    gradeGroups: [{
      id: 'group_fis_1',
      name: 'Avaliações',
      weight: 1,
      items: []
    }]
  };

  const initialSubjects = [subjectCalc, subjectAlgo, subjectFis];

  // Recurring class for Cálculo 1 on Monday (2026-08-17 is Monday, day 1)
  const classEventCalc: AppEvent = {
    id: 'class_event_calc_1',
    title: 'Aula de Cálculo 1',
    category: 'Faculdade/Aulas',
    date: '2026-08-17',
    startTime: '08:00',
    endTime: '10:00',
    recurrence: 'weekly',
    alerts: [15],
    isCompleted: false,
    subjectId: subjectCalc.id
  };

  const initialEvents = [classEventCalc];
  const initialAttendances: AttendanceRecord[] = [];

  // Intent 1: cancelled_class
  const itemCancelled: AIParsedItem = {
    intent: 'cancelled_class',
    subjectName: 'Cálculo 1',
    title: 'Aula Cancelada - Cálculo 1',
    description: 'Prof. ausente por banca',
    targetDate: '2026-08-17',
    startTime: '08:00',
    endTime: '10:00',
    alerts: [10080, 1440],
    rawSummary: 'Aula de Cálculo 1 cancelada em 2026-08-17'
  };

  // Intent 2: homework
  const itemHomework: AIParsedItem = {
    intent: 'homework',
    subjectName: 'Algoritmos',
    title: 'Entrega Lista de Exercícios 3 - Algoritmos',
    description: 'Árvores Binárias no AVA',
    targetDate: '2026-08-24',
    startTime: '23:59',
    endTime: '23:59',
    alerts: [10080, 1440],
    rawSummary: 'Lista de Exercícios 3 de Algoritmos até 2026-08-24 às 23:59'
  };

  // Intent 3: exam
  const itemExam: AIParsedItem = {
    intent: 'exam',
    subjectName: 'Física I',
    title: 'Prova P2 - Física I',
    description: 'Prova reagendada com calculadora',
    targetDate: '2026-08-28',
    startTime: '08:00',
    endTime: '10:00',
    alerts: [10080, 1440],
    rawSummary: 'Prova P2 de Física I em 2026-08-28 das 08:00 às 10:00'
  };

  const syncResult1 = await SyncService.processParsedItems(
    [itemCancelled, itemHomework, itemExam],
    initialEvents,
    initialAttendances,
    initialSubjects
  );

  // 1.1 Check Cancelled Attendance Record
  assert(syncResult1.updatedAttendances.length === 1, 'Sync creates 1 attendance record for cancelled class');
  const cancelRec = syncResult1.updatedAttendances[0];
  assert(cancelRec.status === 'cancelled', 'Attendance status is exactly "cancelled"');
  assertEqual(cancelRec.date, '2026-08-17', 'Attendance record has correct targetDate');
  assertEqual(cancelRec.subjectId, subjectCalc.id, 'Attendance record linked to correct subjectId');
  assertEqual(cancelRec.eventId, classEventCalc.id, 'Attendance record linked to matched class eventId');

  // 1.2 Check Homework Event
  const hwEvent = syncResult1.updatedEvents.find(e => e.title.includes('Lista de Exercícios 3'));
  assert(!!hwEvent, 'Homework event was created in updatedEvents');
  if (hwEvent) {
    assertEqual(hwEvent.category, 'Provas/Trabalhos', 'Homework category is "Provas/Trabalhos"');
    assertEqual(hwEvent.date, '2026-08-24', 'Homework date is 2026-08-24');
    assertEqual(hwEvent.startTime, '23:59', 'Homework startTime is 23:59');
    assertEqual(hwEvent.alerts, [10080, 1440], 'Homework alerts contain [10080, 1440] (1 week, 1 day)');
    assertEqual(hwEvent.subjectId, subjectAlgo.id, 'Homework linked to Algoritmos subjectId');
  }

  // 1.3 Check Exam Event & Grade Item Linking
  const examEvent = syncResult1.updatedEvents.find(e => e.title.includes('Prova P2'));
  assert(!!examEvent, 'Exam event was created in updatedEvents');
  if (examEvent) {
    assertEqual(examEvent.category, 'Provas/Trabalhos', 'Exam category is "Provas/Trabalhos"');
    assertEqual(examEvent.date, '2026-08-28', 'Exam date is 2026-08-28');
    assertEqual(examEvent.startTime, '08:00', 'Exam startTime is 08:00');
    assertEqual(examEvent.endTime, '10:00', 'Exam endTime is 10:00');
    assertEqual(examEvent.alerts, [10080, 1440], 'Exam alerts contain [10080, 1440]');
    assertEqual(examEvent.subjectId, subjectFis.id, 'Exam linked to Física I subjectId');

    // Check Subject gradeGroups linking
    const updatedFis = syncResult1.updatedSubjects.find(s => s.id === subjectFis.id);
    assert(!!updatedFis, 'Física I subject exists in updatedSubjects');
    if (updatedFis) {
      assert((updatedFis.gradeGroups?.length || 0) > 0, 'Física I has at least 1 gradeGroup');
      const targetGroup = updatedFis.gradeGroups![0];
      const linkedGradeItem = targetGroup.items.find(item => item.eventId === examEvent.id);
      assert(!!linkedGradeItem, 'GradeItem linked to exam eventId exists in Subject.gradeGroups');
      if (linkedGradeItem) {
        assertEqual(linkedGradeItem.name, examEvent.title, 'GradeItem name matches exam event title');
        assertEqual(linkedGradeItem.eventId, examEvent.id, 'GradeItem eventId matches examEvent.id');
        assertEqual(linkedGradeItem.maxGrade, 10, 'GradeItem maxGrade is 10');
      }
    }
  }

  // --------------------------------------------------------------------------
  // SUITE 2: DOMAIN INVARIANTS (ABSENCES & TIMELINE FILTERING)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Domain Invariants Verification ---');

  // Invariant 2.1: Absences Calculation
  // Simulate AttendanceScreen.calculateAbsences logic (AttendanceScreen.tsx:20-22)
  const calculateAbsences = (subjectId: string, attendances: AttendanceRecord[]) => {
    return attendances.filter(a => a.subjectId === subjectId && a.status === 'absent').length;
  };

  const absencesCalc = calculateAbsences(subjectCalc.id, syncResult1.updatedAttendances);
  assertEqual(absencesCalc, 0, 'Absence count for Cálculo 1 remains 0 with status="cancelled"');

  // Invariant 2.2: Daily Timeline Filtering
  // Simulate App.tsx:208-232 todaysEvents logic for 2026-08-17
  const filterTodaysEvents = (
    targetDate: string,
    events: AppEvent[],
    attendances: AttendanceRecord[],
    subjects: Subject[]
  ) => {
    return events.filter(e => {
      if (e.subjectId) {
        const subject = subjects.find(s => s.id === e.subjectId);
        if (subject?.isArchived) return false;
      }

      if (e.category === 'Faculdade/Aulas' && e.recurrence === 'weekly') {
        const isCancelled = attendances.some(
          a => a.eventId === e.id && a.date === targetDate && a.status === 'cancelled'
        );
        if (isCancelled) return false;
      }

      if (targetDate < e.date) return false;
      if (e.recurrence === 'daily') return true;
      if (e.recurrence === 'weekly') {
        const startDay = getDay(parseISO(e.date));
        const currentDay = getDay(parseISO(targetDate));
        return startDay === currentDay;
      }
      return e.date === targetDate;
    });
  };

  // On cancellation date (2026-08-17):
  const timelineOnCancelDate = filterTodaysEvents(
    '2026-08-17',
    syncResult1.updatedEvents,
    syncResult1.updatedAttendances,
    syncResult1.updatedSubjects
  );
  const classOnCancelDate = timelineOnCancelDate.find(e => e.id === classEventCalc.id);
  assert(!classOnCancelDate, 'Cancelled class is completely excluded from 2026-08-17 timeline');

  // On next week's Monday (2026-08-24):
  const timelineNextWeek = filterTodaysEvents(
    '2026-08-24',
    syncResult1.updatedEvents,
    syncResult1.updatedAttendances,
    syncResult1.updatedSubjects
  );
  const classNextWeek = timelineNextWeek.find(e => e.id === classEventCalc.id);
  assert(!!classNextWeek, 'Weekly class reappears normally on 2026-08-24 (non-cancelled date)');

  // --------------------------------------------------------------------------
  // SUITE 3: SyncService.runSimulation ON CANONICAL MESSAGES
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 3: Simulation Pipeline (runSimulation) ---');

  // Clear mock AsyncStorage
  await mockAsyncStorage.clear();

  // Run simulation starting from blank state
  const simResult = await SyncService.runSimulation(null, [], [], []);

  assert(simResult.updatedSubjects.length === 3, 'Simulation seeded 3 subjects (Cálculo 1, Algoritmos, Física I)');
  assert(simResult.syncResult.cancelledAttendances.length === 1, 'Simulation created 1 cancelled attendance');
  assert(simResult.syncResult.createdEvents.length >= 2, 'Simulation created homework and exam events');
  assert(simResult.syncResult.logs.length > 0, 'Simulation produced structured execution logs');

  // Verify persistence in StorageService
  const persistedEvents = await StorageService.getEvents();
  const persistedAttendances = await StorageService.getAttendances();
  const persistedSubjects = await StorageService.getSubjects();

  assert(persistedEvents.length === simResult.updatedEvents.length, 'StorageService persisted all simulation events');
  assert(persistedAttendances.length === simResult.updatedAttendances.length, 'StorageService persisted all simulation attendances');
  assert(persistedSubjects.length === simResult.updatedSubjects.length, 'StorageService persisted all simulation subjects');

  // --------------------------------------------------------------------------
  // SUITE 4: ADVERSARIAL CHALLENGES & EDGE CASES
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 4: Adversarial & Edge Case Stress Testing ---');

  // 4.1 Subject Fuzzy Matching
  const subjectsToMatch: Subject[] = [
    { id: 's1', name: 'Cálculo 1' },
    { id: 's2', name: 'Física I' },
    { id: 's3', name: 'Algoritmos e Estruturas de Dados' },
    { id: 's4', name: 'Química Geral' },
  ];

  // Exact ID
  assert(SyncService.matchSubject('s1', subjectsToMatch)?.id === 's1', 'Fuzzy match: by ID');
  // Accent normalization
  assert(SyncService.matchSubject('Calculo 1', subjectsToMatch)?.id === 's1', 'Fuzzy match: accent insensitive ("Calculo 1")');
  // Roman numeral to Arabic
  assert(SyncService.matchSubject('Fisica 1', subjectsToMatch)?.id === 's2', 'Fuzzy match: Arabic "1" to Roman "I" ("Fisica 1")');
  assert(SyncService.matchSubject('Cálculo I', subjectsToMatch)?.id === 's1', 'Fuzzy match: Roman "I" to Arabic "1" ("Cálculo I")');
  // Substring match
  assert(SyncService.matchSubject('Algoritmos', subjectsToMatch)?.id === 's3', 'Fuzzy match: substring ("Algoritmos")');
  // Unknown subject returns undefined safely
  assert(SyncService.matchSubject('História da Arte', subjectsToMatch) === undefined, 'Fuzzy match: unknown subject returns undefined without error');

  // 4.2 Sync Idempotency (Re-running sync does not produce duplicates)
  const doubleSyncResult = await SyncService.processParsedItems(
    [itemHomework],
    simResult.updatedEvents,
    simResult.updatedAttendances,
    simResult.updatedSubjects
  );
  const matchingHwEvents = doubleSyncResult.updatedEvents.filter(e => e.title === itemHomework.title);
  assertEqual(matchingHwEvents.length, 1, 'Sync idempotency: Re-syncing existing homework does not create duplicate events');
  assertEqual(doubleSyncResult.syncResult.updatedEvents.length, 1, 'Sync idempotency: Re-syncing records event in updatedEvents');

  // 4.3 Subject with NO gradeGroups initially
  const subjectNoGroups: Subject = {
    id: 's_no_groups',
    name: 'Química Orgânica',
    gradeGroups: undefined // No grade groups
  };
  const examForNoGroups: AIParsedItem = {
    intent: 'exam',
    subjectName: 'Química Orgânica',
    title: 'P1 - Química Orgânica',
    targetDate: '2026-09-01',
    startTime: '08:00',
    endTime: '10:00',
    alerts: [10080, 1440],
    rawSummary: 'P1 Química'
  };

  const noGroupSyncResult = await SyncService.processParsedItems(
    [examForNoGroups],
    [],
    [],
    [subjectNoGroups]
  );
  const updatedSubjNoGroup = noGroupSyncResult.updatedSubjects.find(s => s.id === 's_no_groups');
  assert(!!updatedSubjNoGroup && (updatedSubjNoGroup.gradeGroups?.length || 0) > 0, 'Auto-creates default GradeGroup when subject.gradeGroups is undefined');
  assert(updatedSubjNoGroup?.gradeGroups?.[0]?.items?.length === 1, 'Links GradeItem into newly created GradeGroup');

  // 4.4 HTML Sanitization Security Attacks (TeamsService.sanitizeHtmlMessage)
  const xssPayload = `<script>alert("hacked")</script><style>body{color:red}</style><p>Aviso de <b>Cálculo 1</b>: Não teremos aula hoje.<br/>Atenciosamente, Prof.</p>`;
  const cleanSanitized = TeamsService.sanitizeHtmlMessage(xssPayload);
  assert(!cleanSanitized.includes('<script>') && !cleanSanitized.includes('alert'), 'HTML Sanitizer: Strips script tags & JS payloads');
  assert(!cleanSanitized.includes('<style>') && !cleanSanitized.includes('color:red'), 'HTML Sanitizer: Strips style tags');
  assert(!cleanSanitized.includes('<p>') && !cleanSanitized.includes('<b>') && !cleanSanitized.includes('<br/>'), 'HTML Sanitizer: Strips all HTML formatting tags');
  assert(cleanSanitized.includes('Aviso de Cálculo 1: Não teremos aula hoje.'), 'HTML Sanitizer: Preserves core message content');

  // Named & numeric entities
  const entityHtml = `&iexcl;Ol&aacute;! Prova de F&iacute;sica &amp; C&aacute;lculo &#225; &#xE9;`;
  const sanitizedEntities = TeamsService.sanitizeHtmlMessage(entityHtml);
  assert(sanitizedEntities.includes('Olá!') && sanitizedEntities.includes('Física') && sanitizedEntities.includes('&') && sanitizedEntities.includes('Cálculo'), 'HTML Sanitizer: Decodes named & numeric HTML entities properly');

  // 4.5 AI Parsing Service Mock Fallback & Resilience
  const mockContext = {
    currentDate: '2026-08-17',
    currentDayOfWeek: 'Segunda-feira',
    registeredSubjects: ['Cálculo 1', 'Algoritmos', 'Física I']
  };

  const parsedCancellation = AIParsingService.parseMessageMock(SIMULATION_RAW_MESSAGES[0], mockContext);
  assertEqual(parsedCancellation.items[0]?.intent, 'cancelled_class', 'Mock Parser: accurately extracts "cancelled_class"');
  assertEqual(parsedCancellation.items[0]?.targetDate, '2026-08-17', 'Mock Parser: extracts 2026-08-17 date for "hoje"');

  const parsedHw = AIParsingService.parseMessageMock(SIMULATION_RAW_MESSAGES[1], mockContext);
  assertEqual(parsedHw.items[0]?.intent, 'homework', 'Mock Parser: accurately extracts "homework"');
  assertEqual(parsedHw.items[0]?.targetDate, '2026-08-24', 'Mock Parser: extracts 2026-08-24 target date');
  assertEqual(parsedHw.items[0]?.startTime, '23:59', 'Mock Parser: extracts 23:59 deadline');

  const parsedExam = AIParsingService.parseMessageMock(SIMULATION_RAW_MESSAGES[2], mockContext);
  assertEqual(parsedExam.items[0]?.intent, 'exam', 'Mock Parser: accurately extracts "exam"');
  assertEqual(parsedExam.items[0]?.targetDate, '2026-08-28', 'Mock Parser: extracts 2026-08-28 target date');
  assertEqual(parsedExam.items[0]?.startTime, '08:00', 'Mock Parser: extracts 08:00 start time');
  assertEqual(parsedExam.items[0]?.endTime, '10:00', 'Mock Parser: extracts 10:00 end time');

  // Truncated/Corrupted JSON handling in cleanAndValidateJson
  const brokenJson = `{"items": [{"intent": "cancelled_class", "subjectName": "Cálculo 1", "targetDate": "2026-08-17"`; // missing closing brackets
  const rescuedParsed = AIParsingService.cleanAndValidateJson(brokenJson, mockContext);
  assert(rescuedParsed.items.length > 0, 'cleanAndValidateJson: Gracefully recovers from malformed/truncated LLM JSON via regex fallback');

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('\n================================================================');
  console.log(`TEST EXECUTION SUMMARY:`);
  console.log(`Total Assertions : ${totalTests}`);
  console.log(`Passed           : ${passedTests}`);
  console.log(`Failed           : ${failedTests}`);
  console.log('================================================================');

  if (failedTests > 0) {
    console.error('\nFAILURES:');
    failureDetails.forEach(f => console.error(f));
    process.exit(1);
  } else {
    console.log('\nALL EMPIRICAL TESTS PASSED SUCCESSFULLY! VERDICT: APPROVE');
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal unhandled error during test execution:', err);
  process.exit(1);
});
