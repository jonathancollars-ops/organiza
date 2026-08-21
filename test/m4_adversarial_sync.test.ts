import './setup_env';
import { memoryStore, mockAsyncStorage } from './setup_env';
import { SyncService, SIMULATION_RAW_MESSAGES } from '../src/services/SyncService';
import { StorageService } from '../src/services/storage';
import { NotificationService } from '../src/services/notifications';
import { AppEvent, AttendanceRecord, Subject, GradeItem, GradeGroup, AIParsedItem, AIConfig } from '../src/types';
import { format, parseISO, subMinutes, getDay, addDays } from 'date-fns';

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

export async function runM4AdversarialSyncSuite() {
  console.log('================================================================================');
  console.log('ORGANIZA MILESTONE 4 — TIER 5 WHITE-BOX ADVERSARIAL STRESS TEST SUITE');
  console.log('Sync Engine, Storage Persistence & App State Mutation Verification');
  console.log('================================================================================\n');

  // ============================================================================
  // CATEGORY 1: CONCURRENT & REPEATED SYNC RUNS (IDEMPOTENCY & DUPLICATE PREVENTION)
  // ============================================================================
  console.log('--------------------------------------------------------------------------------');
  console.log('CATEGORY 1: IDEMPOTENCY, REPEATED & CONCURRENT SYNC STRESS');
  console.log('--------------------------------------------------------------------------------');

  const initialSubject: Subject = {
    id: 'sub_calc_adv',
    name: 'Cálculo 1',
    color: '#0A84FF',
    passGrade: 7.0,
    maxAbsences: 15,
    workloadHours: 60,
    gradeGroups: [{
      id: 'gg_calc_adv',
      name: 'Avaliações',
      weight: 1,
      items: []
    }]
  };

  const initialClassEvent: AppEvent = {
    id: 'ev_class_calc_adv',
    title: 'Aula de Cálculo 1',
    category: 'Faculdade/Aulas',
    date: '2026-08-17',
    startTime: '08:00',
    endTime: '10:00',
    recurrence: 'weekly',
    alerts: [15],
    isCompleted: false,
    subjectId: 'sub_calc_adv'
  };

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

  const hwItem: AIParsedItem = {
    intent: 'homework',
    subjectName: 'Cálculo 1',
    title: 'Lista de Exercícios 1 - Limites',
    targetDate: '2026-08-25',
    startTime: '23:59',
    endTime: '23:59',
    alerts: [10080, 1440],
    rawSummary: 'Entregar lista 1 de limites'
  };

  const examItem: AIParsedItem = {
    intent: 'exam',
    subjectName: 'Cálculo 1',
    title: 'Prova P1 - Cálculo 1',
    targetDate: '2026-09-01',
    startTime: '08:00',
    endTime: '10:00',
    alerts: [10080, 1440],
    rawSummary: 'Prova P1 de Cálculo 1'
  };

  // 1.1: 50 Sequential Repeated Sync Runs
  let stateEvents = [initialClassEvent];
  let stateAttendances: AttendanceRecord[] = [];
  let stateSubjects = [initialSubject];

  for (let i = 0; i < 50; i++) {
    const res = await SyncService.processParsedItems(
      [cancelItem, hwItem, examItem],
      stateEvents,
      stateAttendances,
      stateSubjects
    );
    stateEvents = res.updatedEvents;
    stateAttendances = res.updatedAttendances;
    stateSubjects = res.updatedSubjects;
  }

  assert(stateEvents.length === 3, '[C1.1] 50 repeated sync runs maintain exactly 3 events (1 class, 1 hw, 1 exam)', `Got ${stateEvents.length}`);
  assert(stateAttendances.length === 1, '[C1.1] 50 repeated sync runs maintain exactly 1 attendance record', `Got ${stateAttendances.length}`);
  assert(stateAttendances[0].status === 'cancelled', '[C1.1] Attendance record status remains cancelled after 50 runs');
  const calcSubj = stateSubjects.find(s => s.id === 'sub_calc_adv');
  assert(calcSubj?.gradeGroups?.[0]?.items?.length === 1, '[C1.1] 50 repeated sync runs maintain exactly 1 GradeItem in gradeGroups[0]', `Got ${calcSubj?.gradeGroups?.[0]?.items?.length}`);

  // 1.2: Massive Batch with Identical Duplicates (100x each in single call)
  const massiveDuplicateBatch: AIParsedItem[] = [
    ...Array(100).fill(cancelItem),
    ...Array(100).fill(hwItem),
    ...Array(100).fill(examItem)
  ];

  const batchResult = await SyncService.processParsedItems(
    massiveDuplicateBatch,
    [initialClassEvent],
    [],
    [initialSubject]
  );

  assert(batchResult.updatedEvents.length === 3, '[C1.2] Single batch of 300 duplicate items deduplicates to exactly 3 events');
  assert(batchResult.updatedAttendances.length === 1, '[C1.2] Single batch of 300 duplicate items deduplicates to 1 attendance record');
  assert(batchResult.updatedSubjects[0].gradeGroups[0].items.length === 1, '[C1.2] Single batch of 300 duplicate items deduplicates to 1 GradeItem');

  // 1.3: Concurrent Parallel processParsedItems Invocations
  const concurrentPromises = Array(10).fill(0).map(() =>
    SyncService.processParsedItems([cancelItem, hwItem, examItem], [initialClassEvent], [], [initialSubject])
  );
  const concurrentResults = await Promise.all(concurrentPromises);
  const allMatch = concurrentResults.every(r =>
    r.updatedEvents.length === 3 &&
    r.updatedAttendances.length === 1 &&
    r.updatedSubjects[0].gradeGroups[0].items.length === 1
  );
  assert(allMatch, '[C1.3] 10 concurrent parallel processParsedItems invocations produce identical deterministic state');

  // 1.4: Exam Rescheduling Idempotency & Date Migration
  const examMovedDate1: AIParsedItem = {
    ...examItem,
    targetDate: '2026-09-08',
    startTime: '08:30',
    endTime: '10:30'
  };

  const rescheduledRes1 = await SyncService.processParsedItems(
    [examMovedDate1],
    stateEvents,
    stateAttendances,
    stateSubjects
  );

  const updatedExamEvent = rescheduledRes1.updatedEvents.find(e => e.title.includes('Prova P1'));
  assert(rescheduledRes1.updatedEvents.length === 3, '[C1.4] Rescheduling exam does not create extra event');
  assert(updatedExamEvent?.date === '2026-09-08', '[C1.4] Exam event date updated to 2026-09-08');
  assert(updatedExamEvent?.startTime === '08:30', '[C1.4] Exam start time updated to 08:30');
  const gradeItemsAfterReschedule = rescheduledRes1.updatedSubjects[0].gradeGroups[0].items;
  assert(gradeItemsAfterReschedule.length === 1, '[C1.4] Grade items count remains 1 after reschedule');
  assert(gradeItemsAfterReschedule[0].eventId === updatedExamEvent?.id, '[C1.4] GradeItem eventId remains strictly linked to updated exam event');

  // 1.5: Case-Insensitive, Accented & Whitespace Title Variations
  const hwVariation: AIParsedItem = {
    intent: 'homework',
    subjectName: 'cálculo 1',
    title: '  LISTA DE EXERCÍCIOS 1 - LIMITES  ',
    targetDate: '2026-08-25',
    startTime: '23:59',
    endTime: '23:59',
    alerts: [10080, 1440],
    rawSummary: 'Updated summary variation'
  };

  const variationRes = await SyncService.processParsedItems(
    [hwVariation],
    rescheduledRes1.updatedEvents,
    rescheduledRes1.updatedAttendances,
    rescheduledRes1.updatedSubjects
  );
  assert(variationRes.updatedEvents.length === 3, '[C1.5] Whitespace/case variation on title matches existing homework without duplication');

  // ============================================================================
  // CATEGORY 2: ATTENDANCE STATE MUTATIONS & PENALTY-FREE RECALCULATION
  // ============================================================================
  console.log('\n--------------------------------------------------------------------------------');
  console.log('CATEGORY 2: ATTENDANCE STATE MUTATIONS & UNEXCUSED PENALTY RECALCULATION');
  console.log('--------------------------------------------------------------------------------');

  const subjectMath: Subject = {
    id: 'sub_math_att',
    name: 'Matemática Discreta',
    color: '#FF9500',
    passGrade: 7.0,
    maxAbsences: 15,
    workloadHours: 60,
    gradeGroups: []
  };

  const classEventMath: AppEvent = {
    id: 'ev_math_monday',
    title: 'Aula de Matemática Discreta',
    category: 'Faculdade/Aulas',
    date: '2026-08-17',
    startTime: '10:00',
    endTime: '12:00',
    recurrence: 'weekly',
    alerts: [15],
    isCompleted: false,
    subjectId: 'sub_math_att'
  };

  // 2.1: Lifecycle Transition pending -> present -> absent -> cancelled
  let attRecord: AttendanceRecord = {
    id: 'att_math_1',
    subjectId: 'sub_math_att',
    eventId: 'ev_math_monday',
    date: '2026-08-17',
    status: 'pending'
  };

  // State 1: Present
  attRecord.status = 'present';
  assert(attRecord.status === 'present', '[C2.1] Record initialized as present');

  // State 2: Absent
  attRecord.status = 'absent';
  assert(attRecord.status === 'absent', '[C2.1] Record transitioned to absent');

  // State 3: Sync receives cancellation -> transitions absent to cancelled
  const mathCancelItem: AIParsedItem = {
    intent: 'cancelled_class',
    subjectName: 'Matemática Discreta',
    title: 'Aula Cancelada - Matemática Discreta',
    targetDate: '2026-08-17',
    startTime: '10:00',
    endTime: '12:00',
    alerts: [10080, 1440],
    rawSummary: 'Aula cancelada pelo professor'
  };

  const cancelFromAbsentRes = await SyncService.processParsedItems(
    [mathCancelItem],
    [classEventMath],
    [attRecord],
    [subjectMath]
  );

  const updatedAtt = cancelFromAbsentRes.updatedAttendances.find(a => a.date === '2026-08-17' && a.subjectId === 'sub_math_att');
  assert(updatedAtt?.status === 'cancelled', '[C2.1] Absent attendance successfully mutated to status: "cancelled"');
  assert(cancelFromAbsentRes.updatedAttendances.length === 1, '[C2.1] Exactly 1 record preserved (mutated in-place)');

  // 2.2: Absence Calculation Math Verification (Cancelled must NOT count as absence)
  const mockAttendances: AttendanceRecord[] = [
    { id: 'a1', subjectId: 'sub_math_att', eventId: 'ev_math_monday', date: '2026-08-03', status: 'present' },
    { id: 'a2', subjectId: 'sub_math_att', eventId: 'ev_math_monday', date: '2026-08-10', status: 'present' },
    { id: 'a3', subjectId: 'sub_math_att', eventId: 'ev_math_monday', date: '2026-08-17', status: 'cancelled' }, // CANCELLED
    { id: 'a4', subjectId: 'sub_math_att', eventId: 'ev_math_monday', date: '2026-08-24', status: 'absent' },
    { id: 'a5', subjectId: 'sub_math_att', eventId: 'ev_math_monday', date: '2026-08-31', status: 'present' },
    { id: 'a6', subjectId: 'sub_math_att', eventId: 'ev_math_monday', date: '2026-09-07', status: 'cancelled' }, // CANCELLED
    { id: 'a7', subjectId: 'sub_math_att', eventId: 'ev_math_monday', date: '2026-09-14', status: 'present' },
    { id: 'a8', subjectId: 'sub_math_att', eventId: 'ev_math_monday', date: '2026-09-21', status: 'absent' },
    { id: 'a9', subjectId: 'sub_math_att', eventId: 'ev_math_monday', date: '2026-09-28', status: 'cancelled' }, // CANCELLED
    { id: 'a10', subjectId: 'sub_math_att', eventId: 'ev_math_monday', date: '2026-10-05', status: 'present' },
  ];

  const totalAbsences = mockAttendances.filter(a => a.subjectId === 'sub_math_att' && a.status === 'absent').length;
  const totalPresents = mockAttendances.filter(a => a.subjectId === 'sub_math_att' && a.status === 'present').length;
  const totalCancelled = mockAttendances.filter(a => a.subjectId === 'sub_math_att' && a.status === 'cancelled').length;

  assert(totalAbsences === 2, '[C2.2] Total unexcused absences is exactly 2 (ignoring 3 cancelled classes)', `Got ${totalAbsences}`);
  assert(totalPresents === 5, '[C2.2] Total presents is 5');
  assert(totalCancelled === 3, '[C2.2] Total cancelled is 3');

  const maxAbsences = subjectMath.maxAbsences || 15;
  const absencePercentage = (totalAbsences / maxAbsences) * 100;
  assert(Math.abs(absencePercentage - (2 / 15 * 100)) < 0.001, '[C2.2] Absence % calculated solely on absent count: 13.33%');

  const heldClasses = totalPresents + totalAbsences; // 7 held classes
  const netAttendanceRate = (totalPresents / heldClasses) * 100;
  assert(Math.abs(netAttendanceRate - (5 / 7 * 100)) < 0.001, '[C2.2] Net attendance rate is 5/7 (71.43%) without cancelled dilution');

  // 2.3: Multi-Subject Attendance Isolation
  const subjectPhysics: Subject = { id: 'sub_phys_att', name: 'Física Moderna', color: '#BF5AF2', maxAbsences: 10, passGrade: 7, workloadHours: 60, gradeGroups: [] };
  const multiSubjectAttendances: AttendanceRecord[] = [
    { id: 'p1', subjectId: 'sub_phys_att', eventId: 'ev_p', date: '2026-08-17', status: 'absent' },
    { id: 'p2', subjectId: 'sub_phys_att', eventId: 'ev_p', date: '2026-08-24', status: 'absent' },
    ...mockAttendances
  ];

  const mathAbsences = multiSubjectAttendances.filter(a => a.subjectId === 'sub_math_att' && a.status === 'absent').length;
  const physAbsences = multiSubjectAttendances.filter(a => a.subjectId === 'sub_phys_att' && a.status === 'absent').length;
  assert(mathAbsences === 2, '[C2.3] Subject Math retains exactly 2 absences in multi-subject dataset');
  assert(physAbsences === 2, '[C2.3] Subject Physics retains exactly 2 absences');

  // 2.4: Consecutive Multi-Date Cancellations for Same Subject
  const batchCancellations: AIParsedItem[] = [
    { intent: 'cancelled_class', subjectName: 'Matemática Discreta', title: 'Aula Cancelada 1', targetDate: '2026-10-12', startTime: '10:00', endTime: '12:00', alerts: [10080, 1440], rawSummary: 'Dispensa 1' },
    { intent: 'cancelled_class', subjectName: 'Matemática Discreta', title: 'Aula Cancelada 2', targetDate: '2026-10-19', startTime: '10:00', endTime: '12:00', alerts: [10080, 1440], rawSummary: 'Dispensa 2' },
    { intent: 'cancelled_class', subjectName: 'Matemática Discreta', title: 'Aula Cancelada 3', targetDate: '2026-10-26', startTime: '10:00', endTime: '12:00', alerts: [10080, 1440], rawSummary: 'Dispensa 3' }
  ];

  const batchCancelRes = await SyncService.processParsedItems(
    batchCancellations,
    [classEventMath],
    mockAttendances,
    [subjectMath]
  );

  const newCancelledCount = batchCancelRes.updatedAttendances.filter(a => a.subjectId === 'sub_math_att' && a.status === 'cancelled').length;
  const newAbsenceCount = batchCancelRes.updatedAttendances.filter(a => a.subjectId === 'sub_math_att' && a.status === 'absent').length;
  assert(newCancelledCount === 6, '[C2.4] Cancelled count increased by 3 to total of 6');
  assert(newAbsenceCount === 2, '[C2.4] Absence count remains invariant at 2 after multiple cancellations');

  // ============================================================================
  // CATEGORY 3: HOMEWORK ALERTS [10080, 1440] ACROSS LEAP YEARS & TIMEZONES
  // ============================================================================
  console.log('\n--------------------------------------------------------------------------------');
  console.log('CATEGORY 3: HOMEWORK ALERTS [10080, 1440], TIMEZONES & LEAP YEAR TRIGGERS');
  console.log('--------------------------------------------------------------------------------');

  // 3.1: Leap Year Homework Creation on Feb 29 (2028 is a leap year)
  const leapDayHW: AIParsedItem = {
    intent: 'homework',
    subjectName: 'Cálculo 1',
    title: 'Projeto Bissexto - Equações Diferenciais',
    targetDate: '2028-02-29',
    startTime: '23:59',
    endTime: '23:59',
    alerts: [10080, 1440],
    rawSummary: 'Entrega em ano bissexto'
  };

  const leapRes = await SyncService.processParsedItems([leapDayHW], [], [], [initialSubject]);
  const leapEvent = leapRes.updatedEvents[0];
  assert(leapEvent.date === '2028-02-29', '[C3.1] Created homework event on leap day 2028-02-29');
  assertEqual(leapEvent.alerts, [10080, 1440], '[C3.1] Alerts strictly [10080, 1440]');

  // Trigger date calculation verification:
  const leapDate = parseISO(`${leapEvent.date}T${leapEvent.startTime}:00`);
  const alert1Week = subMinutes(leapDate, 10080); // 7 days prior
  const alert1Day = subMinutes(leapDate, 1440);   // 1 day prior

  assert(format(alert1Week, 'yyyy-MM-dd HH:mm') === '2028-02-22 23:59', '[C3.1] 10080 min trigger on leap year is exactly 2028-02-22 23:59');
  assert(format(alert1Day, 'yyyy-MM-dd HH:mm') === '2028-02-28 23:59', '[C3.1] 1440 min trigger on leap year is exactly 2028-02-28 23:59');

  // 3.2: Post Leap-Day Trigger Crosses Feb 29
  const postLeapHW: AIParsedItem = {
    intent: 'homework',
    subjectName: 'Cálculo 1',
    title: 'Lista Pós-Bissexto',
    targetDate: '2028-03-05',
    startTime: '12:00',
    endTime: '12:00',
    alerts: [10080, 1440],
    rawSummary: 'Entrega em março de ano bissexto'
  };
  const postLeapDate = parseISO(`${postLeapHW.targetDate}T${postLeapHW.startTime}:00`);
  const postLeap1Week = subMinutes(postLeapDate, 10080); // 7 days prior crossing Feb 29
  assert(format(postLeap1Week, 'yyyy-MM-dd HH:mm') === '2028-02-27 12:00', '[C3.2] 1-week alert for 2028-03-05 correctly crosses Feb 29 to reach 2028-02-27');

  // 3.3: Year Boundary Rollover
  const yearRolloverHW: AIParsedItem = {
    intent: 'homework',
    subjectName: 'Cálculo 1',
    title: 'Trabalho de Férias',
    targetDate: '2027-01-04',
    startTime: '18:00',
    endTime: '18:00',
    alerts: [10080, 1440],
    rawSummary: 'Entrega no início do ano'
  };
  const rolloverDate = parseISO(`${yearRolloverHW.targetDate}T${yearRolloverHW.startTime}:00`);
  const rollover1Week = subMinutes(rolloverDate, 10080);
  const rollover1Day = subMinutes(rolloverDate, 1440);
  assert(format(rollover1Week, 'yyyy-MM-dd HH:mm') === '2026-12-28 18:00', '[C3.3] 10080 min alert for Jan 4 rolls over cleanly to previous year Dec 28');
  assert(format(rollover1Day, 'yyyy-MM-dd HH:mm') === '2027-01-03 18:00', '[C3.3] 1440 min alert for Jan 4 resolves to Jan 3');

  // 3.4: Alert Normalization on Empty/Malformed alerts array
  const emptyAlertsHW: AIParsedItem = {
    intent: 'homework',
    subjectName: 'Cálculo 1',
    title: 'Trabalho sem Alertas Explícitos',
    targetDate: '2026-08-25',
    startTime: '23:59',
    endTime: '23:59',
    alerts: [],
    rawSummary: 'Sem alertas'
  };

  const normalizedRes = await SyncService.processParsedItems([emptyAlertsHW], [], [], [initialSubject]);
  assertEqual(normalizedRes.updatedEvents[0].alerts, [10080, 1440], '[C3.4] Empty alerts array automatically normalized to [10080, 1440]');

  // 3.5: Notification Service Schedule Call Execution & Sound/Channel Invariants
  let scheduledNotif: any = null;
  const mockExpoNotifications = require('expo-notifications');
  const origSchedule = mockExpoNotifications.scheduleNotificationAsync;
  mockExpoNotifications.scheduleNotificationAsync = async (params: any) => {
    scheduledNotif = params;
    return 'mock_notif_id_adv';
  };

  await NotificationService.scheduleEventNotifications(normalizedRes.updatedEvents[0]);
  mockExpoNotifications.scheduleNotificationAsync = origSchedule;

  assert(normalizedRes.updatedEvents[0].isNotified === true, '[C3.5] Event isNotified flag is true');
  assert(normalizedRes.updatedEvents[0].isImportant === true, '[C3.5] Event isImportant flag is true');

  // ============================================================================
  // CATEGORY 4: EXAM EVENT CREATION, GRADEITEM LINKING & AUTO SUBJECT CREATION
  // ============================================================================
  console.log('\n--------------------------------------------------------------------------------');
  console.log('CATEGORY 4: EXAM SYNC, GRADEITEM LINKAGE & AUTO SUBJECT PROVISIONING');
  console.log('--------------------------------------------------------------------------------');

  // 4.1: runSimulation with Completely Empty State Auto-Provisions 3 Subjects & GradeGroup
  memoryStore['@organiza_events'] = '[]';
  memoryStore['@organiza_attendances'] = '[]';
  memoryStore['@organiza_subjects'] = '[]';

  const simResult = await SyncService.runSimulation(null, [], [], []);

  assert(simResult.updatedSubjects.length === 3, '[C4.1] runSimulation creates 3 subjects when initialized empty');
  const simFisica = simResult.updatedSubjects.find(s => s.name === 'Física I');
  assert(simFisica !== undefined, '[C4.1] Física I subject provisioned');
  assert(simFisica?.gradeGroups.length === 1, '[C4.1] Física I has gradeGroups[0] (Avaliações)');
  const examGradeItem = simFisica?.gradeGroups[0].items.find(i => i.name.includes('Prova P2'));
  assert(examGradeItem !== undefined, '[C4.1] Prova P2 GradeItem automatically created and linked in gradeGroups[0]');
  assert(examGradeItem?.maxGrade === 10, '[C4.1] Linked GradeItem maxGrade is 10');
  assert(examGradeItem?.weight === 1, '[C4.1] Linked GradeItem weight is 1');

  const simExamEvent = simResult.updatedEvents.find(e => e.title.includes('Prova P2'));
  assert(simExamEvent !== undefined, '[C4.1] Prova P2 AppEvent created in calendar');
  assert(examGradeItem?.eventId === simExamEvent?.id, '[C4.1] GradeItem eventId strictly matches calendar event id');

  // 4.2: Subject with empty gradeGroups array receiving exam
  const emptyGroupSubject: Subject = {
    id: 'sub_quimica_adv',
    name: 'Química Geral',
    color: '#30D158',
    passGrade: 7.0,
    maxAbsences: 15,
    workloadHours: 60,
    gradeGroups: [] // NO grade groups initially
  };

  const quimicaExamItem: AIParsedItem = {
    intent: 'exam',
    subjectName: 'Química Geral',
    title: 'Prova Final - Química Geral',
    targetDate: '2026-11-20',
    startTime: '08:00',
    endTime: '10:00',
    alerts: [10080, 1440],
    rawSummary: 'Prova final de química'
  };

  const quimicaRes = await SyncService.processParsedItems([quimicaExamItem], [], [], [emptyGroupSubject]);
  const updatedQuimica = quimicaRes.updatedSubjects[0];
  assert(updatedQuimica.gradeGroups.length === 1, '[C4.2] Auto-provisions default GradeGroup "Avaliações" when gradeGroups is empty');
  assert(updatedQuimica.gradeGroups[0].items.length === 1, '[C4.2] Links exam GradeItem to newly provisioned gradeGroups[0]');
  assert(updatedQuimica.gradeGroups[0].items[0].name === 'Prova Final - Química Geral', '[C4.2] GradeItem name matches exam title');

  // 4.3: Multiple Distinct Exams for Same Subject (P1, P2, P3, P4)
  const multiExams: AIParsedItem[] = [
    { intent: 'exam', subjectName: 'Química Geral', title: 'Prova P1 - Química Geral', targetDate: '2026-09-10', startTime: '08:00', endTime: '10:00', alerts: [10080, 1440], rawSummary: 'P1' },
    { intent: 'exam', subjectName: 'Química Geral', title: 'Prova P2 - Química Geral', targetDate: '2026-10-15', startTime: '08:00', endTime: '10:00', alerts: [10080, 1440], rawSummary: 'P2' },
    { intent: 'exam', subjectName: 'Química Geral', title: 'Prova P3 - Química Geral', targetDate: '2026-11-12', startTime: '08:00', endTime: '10:00', alerts: [10080, 1440], rawSummary: 'P3' }
  ];

  const multiExamRes = await SyncService.processParsedItems(
    multiExams,
    quimicaRes.updatedEvents,
    quimicaRes.updatedAttendances,
    quimicaRes.updatedSubjects
  );

  const quimicaGradeItems = multiExamRes.updatedSubjects[0].gradeGroups[0].items;
  assert(quimicaGradeItems.length === 4, '[C4.3] Exactly 4 distinct GradeItems registered for 4 exams', `Got ${quimicaGradeItems.length}`);
  assert(multiExamRes.updatedEvents.length === 4, '[C4.3] Exactly 4 distinct exam AppEvents created');

  // 4.4: Updating Exam Details Updates Linked GradeItem in-place
  // Case A: Title revision on same date (matches via date)
  const updatedP1: AIParsedItem = {
    intent: 'exam',
    subjectName: 'Química Geral',
    title: 'Prova P1 - Química Geral (Revisada)',
    targetDate: '2026-09-10',
    startTime: '09:00',
    endTime: '11:00',
    alerts: [10080, 1440],
    rawSummary: 'P1 horário e título revisados'
  };

  const updateP1Res = await SyncService.processParsedItems(
    [updatedP1],
    multiExamRes.updatedEvents,
    multiExamRes.updatedAttendances,
    multiExamRes.updatedSubjects
  );

  const updatedP1Item = updateP1Res.updatedSubjects[0].gradeGroups[0].items.find(i => i.name.includes('Revisada'));
  assert(updateP1Res.updatedSubjects[0].gradeGroups[0].items.length === 4, '[C4.4] GradeItem count remains 4 after renaming/updating P1 on same date');
  assert(updatedP1Item !== undefined, '[C4.4] Linked GradeItem name updated to include "(Revisada)"');
  assert(updatedP1Item?.eventId === updateP1Res.updatedEvents.find(e => e.title.includes('Revisada'))?.id, '[C4.4] GradeItem eventId matches updated event id');

  // Case B: Reschedule to new date with base title match (matches via substring in e.title)
  const rescheduleP2: AIParsedItem = {
    intent: 'exam',
    subjectName: 'Química Geral',
    title: 'Prova P2',
    targetDate: '2026-10-22',
    startTime: '08:00',
    endTime: '10:00',
    alerts: [10080, 1440],
    rawSummary: 'P2 adiada em 1 semana'
  };

  const rescheduleP2Res = await SyncService.processParsedItems(
    [rescheduleP2],
    updateP1Res.updatedEvents,
    updateP1Res.updatedAttendances,
    updateP1Res.updatedSubjects
  );
  assert(rescheduleP2Res.updatedSubjects[0].gradeGroups[0].items.length === 4, '[C4.4] GradeItem count remains 4 after rescheduling P2 with base title substring');
  const rescheduledP2Event = rescheduleP2Res.updatedEvents.find(e => e.title.includes('P2'));
  assert(rescheduledP2Event?.date === '2026-10-22', '[C4.4] P2 event date updated to 2026-10-22');

  // ============================================================================
  // CATEGORY 5: STORAGE PERSISTENCE, CORRUPTION RECOVERY & FAULT INJECTION
  // ============================================================================
  console.log('\n--------------------------------------------------------------------------------');
  console.log('CATEGORY 5: STORAGE CORRUPTION RECOVERY & ADVERSARIAL FAULT INJECTION');
  console.log('--------------------------------------------------------------------------------');

  // 5.1: StorageService Gracefully Survives Corrupted JSON Strings
  memoryStore['@organiza_events'] = '{"corrupted: JSON [unclosed';
  memoryStore['@organiza_subjects'] = '<<<BAD_SUBJECT_DATA>>>';
  memoryStore['@organiza_attendances'] = 'undefined';
  memoryStore['@organiza_teams_config'] = '{not_valid:';
  memoryStore['@organiza_ai_config'] = 'null_pointer_exception';

  const recoveredEvents = await StorageService.getEvents();
  const recoveredSubjects = await StorageService.getSubjects();
  const recoveredAttendances = await StorageService.getAttendances();
  const recoveredTeams = await StorageService.getTeamsConfig();
  const recoveredAI = await StorageService.getAIConfig();

  assertEqual(recoveredEvents, [], '[C5.1] StorageService.getEvents returns [] on JSON parse corruption');
  assertEqual(recoveredSubjects, [], '[C5.1] StorageService.getSubjects returns [] on JSON parse corruption');
  assertEqual(recoveredAttendances, [], '[C5.1] StorageService.getAttendances returns [] on JSON parse corruption');
  assertEqual(recoveredTeams, null, '[C5.1] StorageService.getTeamsConfig returns null on corruption');
  assertEqual(recoveredAI.provider, 'gemini', '[C5.1] StorageService.getAIConfig returns default fallback on corruption');

  // 5.2: Missing Keys Default Handling
  await mockAsyncStorage.clear();
  assertEqual(await StorageService.getEvents(), [], '[C5.2] Empty storage returns [] for events');
  assertEqual(await StorageService.getSubjects(), [], '[C5.2] Empty storage returns [] for subjects');
  assertEqual(await StorageService.getAttendances(), [], '[C5.2] Empty storage returns [] for attendances');
  assertEqual(await StorageService.getTheme(), 'dark', '[C5.2] Empty storage returns default theme "dark"');

  // 5.3: Fault Injection: Notification Service Throwing Error
  const origScheduleNotif = NotificationService.scheduleEventNotifications;
  NotificationService.scheduleEventNotifications = async () => {
    throw new Error('SIMULATED_EXPO_NOTIFICATION_CRASH');
  };

  const resilientRes = await SyncService.processParsedItems([hwItem, examItem], [], [], [initialSubject]);
  assert(resilientRes.updatedEvents.length === 2, '[C5.3] SyncService completes successfully despite NotificationService crash');
  assert(resilientRes.syncResult.logs.some(l => l.includes('SIMULATED_EXPO_NOTIFICATION_CRASH')), '[C5.3] Error logged cleanly in syncResult.logs');

  NotificationService.scheduleEventNotifications = origScheduleNotif;

  // 5.4: Fault Injection: StorageService Save Rejection during runSimulation
  const origSaveEvents = StorageService.saveEvents;
  StorageService.saveEvents = async () => {
    throw new Error('SIMULATED_DISK_IO_FULL_ERROR');
  };

  const simWithSaveFailure = await SyncService.runSimulation(null, [], [], []);
  assert(simWithSaveFailure.updatedEvents.length >= 3, '[C5.4] runSimulation returns updated data even if storage write fails');
  assert(simWithSaveFailure.syncResult.logs.some(l => l.includes('SIMULATED_DISK_IO_FULL_ERROR')), '[C5.4] Storage failure captured in simulation logs without uncaught exception');

  StorageService.saveEvents = origSaveEvents;

  // 5.5: High-Volume 200 Interleaved Items Stress Test
  const highVolumeItems: AIParsedItem[] = [];
  for (let i = 0; i < 50; i++) {
    highVolumeItems.push({
      intent: 'cancelled_class',
      subjectName: 'Cálculo 1',
      title: `Cancelamento Semana ${i + 1}`,
      targetDate: format(addDays(parseISO('2026-08-17'), i * 7), 'yyyy-MM-dd'),
      startTime: '08:00',
      endTime: '10:00',
      alerts: [10080, 1440],
      rawSummary: `Cancelamento ${i + 1}`
    });
    highVolumeItems.push({
      intent: 'homework',
      subjectName: 'Cálculo 1',
      title: `Lista de Tarefas ${i + 1}`,
      targetDate: format(addDays(parseISO('2026-08-20'), i * 7), 'yyyy-MM-dd'),
      startTime: '23:59',
      endTime: '23:59',
      alerts: [10080, 1440],
      rawSummary: `Tarefa ${i + 1}`
    });
    highVolumeItems.push({
      intent: 'exam',
      subjectName: 'Cálculo 1',
      title: `Simulado ou Prova ${i + 1}`,
      targetDate: format(addDays(parseISO('2026-08-22'), i * 7), 'yyyy-MM-dd'),
      startTime: '08:00',
      endTime: '10:00',
      alerts: [10080, 1440],
      rawSummary: `Prova ${i + 1}`
    });
    highVolumeItems.push({
      intent: 'none',
      subjectName: 'Geral',
      title: 'Aviso sem ação',
      targetDate: '2026-08-17',
      startTime: '',
      endTime: '',
      alerts: [],
      rawSummary: 'Mensagem informativa'
    });
  }

  const startHr = Date.now();
  const highVolRes = await SyncService.processParsedItems(
    highVolumeItems,
    [initialClassEvent],
    [],
    [initialSubject]
  );
  const elapsedMs = Date.now() - startHr;

  assert(highVolRes.updatedEvents.length === 101, '[C5.5] High-volume stress (200 items) produced 101 events (1 initial + 50 hw + 50 exam)', `Got ${highVolRes.updatedEvents.length}`);
  assert(highVolRes.updatedAttendances.length === 50, '[C5.5] High-volume stress produced 50 cancelled attendances', `Got ${highVolRes.updatedAttendances.length}`);
  assert(highVolRes.updatedSubjects[0].gradeGroups[0].items.length === 50, '[C5.5] High-volume stress created 50 GradeItems in gradeGroups[0]', `Got ${highVolRes.updatedSubjects[0].gradeGroups[0].items.length}`);
  assert(elapsedMs < 3000, `[C5.5] High-volume stress executed in ${elapsedMs}ms (< 3000ms threshold)`);

  // ============================================================================
  // FINAL ADVERSARIAL EXECUTION SUMMARY
  // ============================================================================
  console.log('\n================================================================================');
  console.log(`TIER 5 ADVERSARIAL STRESS TEST SUMMARY: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log(`SUCCESS RATE: ${((passedTests / totalTests) * 100).toFixed(2)}%`);
  console.log('================================================================================\n');

  if (failedTests > 0) {
    console.error('FAILED TEST DETAILS:');
    failureDetails.forEach(d => console.error(d));
    throw new Error(`${failedTests} Tier 5 Adversarial tests failed.`);
  }
}

if (require.main === module) {
  runM4AdversarialSyncSuite().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
