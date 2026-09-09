import './setup_env';
import { NotificationService } from '../src/services/notifications';
import { mockNotifications, mockAsyncStorage } from './setup_env';
import { AppEvent, Subject, AttendanceRecord, StudyTask } from '../src/types';
import { calculateFinalGrade } from '../src/components/GradeEngine';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
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

async function test(name: string, fn: () => Promise<void> | void) {
  console.log(`\n--- Test: ${name} ---`);
  await fn();
}

interface ScheduledNotifItem {
  identifier: string;
  content: {
    title: string;
    body: string;
    data?: {
      eventId?: string;
      subjectId?: string;
      category?: string;
    };
  };
}

let scheduledStore: ScheduledNotifItem[] = [];
let getAllScheduledCalls = 0;
let cancelledIdentifiers: string[] = [];

// Instrument mockNotifications for precise tracking
mockNotifications.getAllScheduledNotificationsAsync = async () => {
  getAllScheduledCalls++;
  return [...scheduledStore];
};

mockNotifications.cancelScheduledNotificationAsync = async (id: string) => {
  cancelledIdentifiers.push(id);
  scheduledStore = scheduledStore.filter(n => n.identifier !== id);
};

mockNotifications.scheduleNotificationAsync = async (req: any) => {
  const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  scheduledStore.push({
    identifier: id,
    content: req.content,
  });
  return id;
};

async function runGhostNotificationsTestSuite() {
  console.log('================================================================');
  console.log('👻 GHOST NOTIFICATIONS & CASCADING CLEANUP TEST SUITE');
  console.log('================================================================');

  // --------------------------------------------------------------------------
  // SUITE 1: Notification Payload Enrichment
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 1: Notification Payload Enrichment (data: eventId, subjectId, category) ---');

  await test('Enriches notification payload with eventId, subjectId, and category', async () => {
    scheduledStore = [];
    const futureDate = new Date(Date.now() + 2 * 3600 * 1000);
    const dateStr = futureDate.toISOString().split('T')[0];
    const hourStr = String(futureDate.getHours()).padStart(2, '0');
    const minStr = String(futureDate.getMinutes()).padStart(2, '0');

    const sampleEvent: AppEvent = {
      id: 'evt_calc_p1',
      title: 'Prova 1 de Cálculo',
      description: 'Capítulos 1 a 3',
      category: 'Provas/Trabalhos',
      date: dateStr,
      startTime: `${hourStr}:${minStr}`,
      endTime: `${hourStr}:${minStr}`,
      recurrence: 'none',
      alerts: [15],
      isCompleted: false,
      subjectId: 'subj_calc_101',
    };

    await NotificationService.scheduleEventNotifications(sampleEvent);

    assert(scheduledStore.length > 0, 'Notification was scheduled in store');
    const scheduled = scheduledStore[0];
    assert(scheduled.content.data?.eventId === 'evt_calc_p1', 'Payload contains correct eventId');
    assert(scheduled.content.data?.subjectId === 'subj_calc_101', 'Payload contains correct subjectId');
    assert(scheduled.content.data?.category === 'Provas/Trabalhos', 'Payload contains correct category');
  });

  await test('Defaults subjectId and category to empty strings when absent in event', async () => {
    scheduledStore = [];
    const futureDate = new Date(Date.now() + 3 * 3600 * 1000);
    const dateStr = futureDate.toISOString().split('T')[0];

    const generalEvent: AppEvent = {
      id: 'evt_general_meeting',
      title: 'Reunião de Alinhamento',
      category: 'Outros',
      date: dateStr,
      startTime: '16:00',
      endTime: '17:00',
      recurrence: 'none',
      alerts: [30],
      isCompleted: false,
    };

    await NotificationService.scheduleEventNotifications(generalEvent);

    assert(scheduledStore.length > 0, 'General notification was scheduled');
    const scheduled = scheduledStore[0];
    assert(scheduled.content.data?.eventId === 'evt_general_meeting', 'Payload contains eventId');
    assert(scheduled.content.data?.subjectId === '', 'Payload defaults missing subjectId to ""');
    assert(scheduled.content.data?.category === 'Outros', 'Payload preserves category');
  });

  // --------------------------------------------------------------------------
  // SUITE 2: Batch Cancellation (cancelSubjectNotifications)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Batch Cancellation (cancelSubjectNotifications) ---');

  await test('Cancels all notifications for a subjectId and removedEventIds in a single fetch', async () => {
    scheduledStore = [
      { identifier: 'n1', content: { title: 'Aula 1', body: '', data: { eventId: 'e1', subjectId: 'subj_target' } } },
      { identifier: 'n2', content: { title: 'Aula 2', body: '', data: { eventId: 'e2', subjectId: 'subj_target' } } },
      { identifier: 'n3', content: { title: 'Outra Aula', body: '', data: { eventId: 'e3', subjectId: 'subj_other' } } },
      { identifier: 'n4', content: { title: 'Prova Órfã', body: '', data: { eventId: 'e_removed_exam', subjectId: '' } } },
      { identifier: 'n5', content: { title: 'Lazer', body: '', data: { eventId: 'e5', subjectId: 'subj_other' } } },
    ];
    getAllScheduledCalls = 0;
    cancelledIdentifiers = [];

    await NotificationService.cancelSubjectNotifications('subj_target', ['e_removed_exam']);

    assert(getAllScheduledCalls === 1, 'Performed exactly ONE call to getAllScheduledNotificationsAsync');
    assert(cancelledIdentifiers.includes('n1'), 'Cancelled n1 (matching subjectId)');
    assert(cancelledIdentifiers.includes('n2'), 'Cancelled n2 (matching subjectId)');
    assert(cancelledIdentifiers.includes('n4'), 'Cancelled n4 (matching removed eventId)');
    assert(!cancelledIdentifiers.includes('n3'), 'Did NOT cancel n3 (belongs to subj_other)');
    assert(!cancelledIdentifiers.includes('n5'), 'Did NOT cancel n5 (belongs to subj_other)');
    assert(scheduledStore.length === 2, 'Remaining store has exactly 2 non-target notifications');
  });

  await test('Handles empty subjectId and empty eventIds gracefully without throwing', async () => {
    getAllScheduledCalls = 0;
    await NotificationService.cancelSubjectNotifications('', []);
    assert(getAllScheduledCalls === 0, 'Early return when subjectId and eventIds are empty');
  });

  // --------------------------------------------------------------------------
  // SUITE 3: Orphan Notification Garbage Collection (reconcileAndPurgeOrphanNotifications)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 3: Orphan Notification Garbage Collection ---');

  await test('Purges ghost notifications whose eventId or subjectId no longer exists', async () => {
    const activeSubjects: Subject[] = [
      { id: 'subj_active_1', name: 'Física I' },
    ];
    const activeEvents: AppEvent[] = [
      {
        id: 'evt_active_1',
        title: 'Aula Física',
        category: 'Faculdade/Aulas',
        date: '2026-09-10',
        startTime: '08:00',
        endTime: '10:00',
        recurrence: 'none',
        alerts: [15],
        isCompleted: false,
        subjectId: 'subj_active_1',
      },
    ];

    scheduledStore = [
      // 1. Valid notification: active event and active subject
      { identifier: 'n_valid', content: { title: 'Válida', body: '', data: { eventId: 'evt_active_1', subjectId: 'subj_active_1' } } },
      // 2. Ghost: event deleted from activeEvents
      { identifier: 'n_ghost_evt', content: { title: 'Fantasma Evento', body: '', data: { eventId: 'evt_deleted', subjectId: 'subj_active_1' } } },
      // 3. Ghost: subject deleted from activeSubjects
      { identifier: 'n_ghost_subj', content: { title: 'Fantasma Matéria', body: '', data: { eventId: 'evt_orphan_2', subjectId: 'subj_deleted_already' } } },
      // 4. Ghost: direct subject notification for deleted subject
      { identifier: 'n_ghost_direct', content: { title: 'Fantasma Direto', body: '', data: { subjectId: 'subj_deleted_already' } } },
    ];

    const purgeResult = await NotificationService.reconcileAndPurgeOrphanNotifications(activeEvents, activeSubjects);

    assert(purgeResult.purgedCount === 3, `Purged 3 orphan notifications (purgedCount=${purgeResult.purgedCount})`);
    assert(scheduledStore.length === 1, 'Exactly 1 valid notification remains in store');
    assert(scheduledStore[0].identifier === 'n_valid', 'Remaining notification is n_valid');
  });

  await test('Returns purgedCount=0 when all scheduled notifications are valid', async () => {
    const activeSubjects: Subject[] = [{ id: 's1', name: 'Química' }];
    const activeEvents: AppEvent[] = [
      {
        id: 'e1',
        title: 'Aula',
        category: 'Faculdade/Aulas',
        date: '2026-09-10',
        startTime: '10:00',
        endTime: '12:00',
        recurrence: 'none',
        alerts: [15],
        isCompleted: false,
        subjectId: 's1',
      }
    ];

    scheduledStore = [
      { identifier: 'n_ok', content: { title: 'Aula', body: '', data: { eventId: 'e1', subjectId: 's1' } } },
    ];

    const result = await NotificationService.reconcileAndPurgeOrphanNotifications(activeEvents, activeSubjects);
    assert(result.purgedCount === 0, 'No notifications were purged');
    assert(scheduledStore.length === 1, 'Store maintains valid notification');
  });

  // --------------------------------------------------------------------------
  // SUITE 4: Cascading Deletion Logic Simulation (deleteSubject)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 4: Cascading Deletion Logic (deleteSubject) ---');

  await test('Cleans up events, orphaned exams matching subject name, attendances, and tasks', async () => {
    const subjects: Subject[] = [
      { id: 'subj_calc', name: 'Cálculo I' },
      { id: 'subj_prog', name: 'Programação' },
    ];

    const events: AppEvent[] = [
      // Direct subject event
      { id: 'evt_1', title: 'Aula Cálculo', category: 'Faculdade/Aulas', date: '2026-09-10', startTime: '08:00', endTime: '10:00', recurrence: 'none', alerts: [15], isCompleted: false, subjectId: 'subj_calc' },
      // Other subject event
      { id: 'evt_2', title: 'Aula Prog', category: 'Faculdade/Aulas', date: '2026-09-10', startTime: '10:00', endTime: '12:00', recurrence: 'none', alerts: [15], isCompleted: false, subjectId: 'subj_prog' },
      // Orphan exam with no subjectId, but title references 'Cálculo I'
      { id: 'evt_orphan_exam', title: 'P2 de Cálculo I Geral', category: 'Provas/Trabalhos', date: '2026-09-15', startTime: '08:00', endTime: '10:00', recurrence: 'none', alerts: [60], isCompleted: false },
      // General event
      { id: 'evt_gym', title: 'Academia Treino A', category: 'Saúde/Academia', date: '2026-09-10', startTime: '18:00', endTime: '19:00', recurrence: 'none', alerts: [15], isCompleted: false },
    ];

    const attendances: AttendanceRecord[] = [
      { id: 'att_1', subjectId: 'subj_calc', date: '2026-09-01', eventId: 'evt_1', status: 'present' },
      { id: 'att_2', subjectId: 'subj_prog', date: '2026-09-01', eventId: 'evt_2', status: 'present' },
    ];

    const tasks: StudyTask[] = [
      { id: 'task_1', title: 'Lista 1 de Derivadas', isCompleted: false, subjectId: 'subj_calc' },
      { id: 'task_2', title: 'Trabalho de Matrizes', isCompleted: false, subjectId: 'subj_prog' },
      { id: 'task_3', title: 'Comprar caderno', isCompleted: false },
    ];

    const subjectIdToDelete = 'subj_calc';
    const targetSubject = subjects.find(s => s.id === subjectIdToDelete);
    const targetSubjectName = targetSubject?.name?.trim().toLowerCase();

    const isSubjectEvent = (e: AppEvent): boolean => {
      if (e.subjectId === subjectIdToDelete) return true;
      if (!e.subjectId || e.subjectId.trim() === '') {
        if (targetSubjectName && targetSubjectName.length > 0) {
          const titleLower = (e.title || '').toLowerCase();
          const isExam = (
            e.category === 'Provas/Trabalhos' ||
            e.category?.toLowerCase().includes('prova') ||
            titleLower.includes('prova') ||
            typeof e.grade !== 'undefined' ||
            typeof e.weight !== 'undefined'
          );
          if (isExam && titleLower.includes(targetSubjectName)) {
            return true;
          }
        }
      }
      return false;
    };

    const removedEvents = events.filter(isSubjectEvent);
    const removedEventIds = removedEvents.map(e => e.id);
    const updatedEvents = events.filter(e => !isSubjectEvent(e));
    const updatedSubjects = subjects.filter(s => s.id !== subjectIdToDelete);
    const updatedAttendances = attendances.filter(a => a.subjectId !== subjectIdToDelete);
    const updatedTasks = tasks.filter(t => t.subjectId !== subjectIdToDelete);

    assert(updatedSubjects.length === 1, 'Only 1 subject remains after deletion');
    assert(updatedSubjects[0].id === 'subj_prog', 'Remaining subject is Programação');

    assert(removedEventIds.includes('evt_1'), 'Removed direct subject event evt_1');
    assert(removedEventIds.includes('evt_orphan_exam'), 'Removed orphaned exam evt_orphan_exam matching subject name');
    assert(updatedEvents.length === 2, '2 events remain (evt_2 and evt_gym)');

    assert(updatedAttendances.length === 1, 'Only 1 attendance record remains');
    assert(updatedAttendances[0].subjectId === 'subj_prog', 'Remaining attendance belongs to Programação');

    assert(updatedTasks.length === 2, '2 tasks remain');
    assert(!updatedTasks.some(t => t.subjectId === 'subj_calc'), 'No task with deleted subjectId remains');
    assert(updatedTasks.some(t => t.id === 'task_2'), 'Preserved task_2 (Programação)');
    assert(updatedTasks.some(t => t.id === 'task_3'), 'Preserved general task_3');
  });

  // --------------------------------------------------------------------------
  // SUITE 5: GradeSimulatorModal Ghost Subject Defense
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 5: GradeSimulatorModal Ghost Subject Defense ---');

  await test('Falls back gracefully when current selected subject is deleted or subjects is empty', () => {
    const activeSubjects: Subject[] = [
      { id: 'subj_b', name: 'Bioquímica', passGrade: 7.0, gradeGroups: [] },
    ];
    let selectedSubjectId = 'subj_deleted_already';

    // Simulated effectiveSubjectId logic from GradeSimulatorModal
    const effectiveSubjectId = activeSubjects.some(s => s.id === selectedSubjectId)
      ? selectedSubjectId
      : (activeSubjects[0]?.id || '');

    assert(effectiveSubjectId === 'subj_b', 'Effective subject fell back to first remaining subject');

    // Test empty subjects array
    const emptySubjects: Subject[] = [];
    const emptyEffectiveId = emptySubjects.some(s => s.id === selectedSubjectId)
      ? selectedSubjectId
      : (emptySubjects[0]?.id || '');

    assert(emptyEffectiveId === '', 'Effective subject is empty string when no subjects exist');

    const currentSubject = emptySubjects.find(s => s.id === emptyEffectiveId);
    assert(currentSubject === undefined, 'No currentSubject found for empty subjects');

    const gradeInfo = (!currentSubject || emptySubjects.length === 0)
      ? null
      : calculateFinalGrade(currentSubject.gradeGroups || [], 7.0);

    assert(gradeInfo === null, 'No grade calculation triggered when subjects is empty (prevents ghost calculations)');
  });

  console.log('\n================================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runGhostNotificationsTestSuite().catch(err => {
  console.error('Fatal error in ghost notifications test suite:', err);
  process.exit(1);
});
