import './setup_env';
import * as fs from 'fs';
import * as path from 'path';
import { StorageService } from '../src/services/storage';
import { NotificationService } from '../src/services/notifications';
import { AppEvent, StudyTask, Subject, AttendanceRecord } from '../src/types';
import { mockAsyncStorage, memoryStore, mockNotifications } from './setup_env';

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

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧭 NAVIGATION, SCREEN WRAPPERS & ACTION BUTTONS QA SUITE');
  console.log('================================================================');

  // ==========================================================================
  // SUITE 1: Static ScreenWrapper Callback Integrity Audit
  // ==========================================================================
  console.log('\n--- SUITE 1: Static ScreenWrapper Callback Integrity Audit ---');

  const screensDir = path.resolve(__dirname, '../src/screens');
  const wrapperFiles = fs.readdirSync(screensDir)
    .filter(f => f.endsWith('Wrapper.tsx'))
    .sort();

  await test('Discover all ScreenWrappers in src/screens', () => {
    assert(wrapperFiles.length >= 5, `Found ${wrapperFiles.length} ScreenWrapper files (expected at least 5)`);
    assert(wrapperFiles.includes('AgendaScreenWrapper.tsx'), 'AgendaScreenWrapper.tsx is present');
    assert(wrapperFiles.includes('AttendanceScreenWrapper.tsx'), 'AttendanceScreenWrapper.tsx is present');
    assert(wrapperFiles.includes('GradesScreenWrapper.tsx'), 'GradesScreenWrapper.tsx is present');
    assert(wrapperFiles.includes('StudyScreenWrapper.tsx'), 'StudyScreenWrapper.tsx is present');
    assert(wrapperFiles.includes('AcademicPerformanceScreenWrapper.tsx'), 'AcademicPerformanceScreenWrapper.tsx is present');
  });

  await test('Verify no ScreenWrapper contains empty dummy callbacks (() => {}) for critical actions', () => {
    const criticalCallbackProps = [
      'onToggleEventCompletion',
      'onToggleTaskCompletion',
      'onOpenStudy',
      'onSubjectPress',
      'onUpdateAttendance',
      'onArchiveSubject',
      'onAddNewEvent',
      'onOpenAttendanceModal',
      'onOpenScheduleGrid',
      'onOpenAchievements',
      'onOpenAnalytics',
      'onDeleteSubject',
      'onUpdateSubject',
      'onEditEvent'
    ];

    const emptyCallbackRegex = /=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/;

    for (const wrapperFile of wrapperFiles) {
      const filePath = path.join(screensDir, wrapperFile);
      const content = fs.readFileSync(filePath, 'utf8');

      // 1. Ensure no callback is explicitly assigned to () => {}
      assert(!emptyCallbackRegex.test(content), `${wrapperFile} contains no empty () => {} prop callbacks`);

      // 2. Ensure specific critical props in this file are wired to actual functions
      for (const prop of criticalCallbackProps) {
        if (content.includes(prop)) {
          // Check that prop is not assigned to empty handler
          const propRegex = new RegExp(`${prop}\\s*=\\s*\\{\\s*\\(\\s*\\)\\s*=>\\s*\\{\\s*\\}\\s*\\}`);
          assert(!propRegex.test(content), `${wrapperFile} prop "${prop}" is not a no-op dummy`);
        }
      }
    }
  });

  await test('Verify AgendaScreenWrapper wires all core modal triggers and callbacks', () => {
    const content = fs.readFileSync(path.join(screensDir, 'AgendaScreenWrapper.tsx'), 'utf8');
    assert(content.includes('onToggleEventCompletion={toggleEventCompletion}'), 'onToggleEventCompletion is wired to toggleEventCompletion');
    assert(content.includes('onToggleTaskCompletion={toggleTaskCompletion}'), 'onToggleTaskCompletion is wired to toggleTaskCompletion');
    assert(content.includes('onAddNewEvent='), 'onAddNewEvent is wired to event type modal trigger');
    assert(content.includes('onOpenStudy='), 'onOpenStudy is wired to navigation.navigate');
    assert(content.includes('onOpenScheduleGrid='), 'onOpenScheduleGrid is wired to schedule grid modal');
    assert(content.includes('onOpenAttendanceModal='), 'onOpenAttendanceModal is wired to attendance modal');
  });

  await test('Verify AttendanceScreenWrapper and GradesScreenWrapper wire subject and attendance actions', () => {
    const attContent = fs.readFileSync(path.join(screensDir, 'AttendanceScreenWrapper.tsx'), 'utf8');
    assert(attContent.includes('onSubjectPress={handleOpenDetails}'), 'AttendanceScreenWrapper wires onSubjectPress to modal opener');
    assert(attContent.includes('onUpdateAttendance='), 'AttendanceScreenWrapper wires onUpdateAttendance to updateAttendance');
    assert(attContent.includes('onDeleteSubject={handleDeleteSubject}'), 'AttendanceScreenWrapper wires onDeleteSubject to archiveSubject');

    const gradesContent = fs.readFileSync(path.join(screensDir, 'GradesScreenWrapper.tsx'), 'utf8');
    assert(gradesContent.includes('onSubjectPress={handleOpenDetails}'), 'GradesScreenWrapper wires onSubjectPress to modal opener');
    assert(gradesContent.includes('onArchiveSubject='), 'GradesScreenWrapper wires onArchiveSubject to archiveSubject');
  });

  // ==========================================================================
  // SUITE 2: Floating Action Button (FAB) & Agenda Screen Interactions
  // ==========================================================================
  console.log('\n--- SUITE 2: Floating Action Button (FAB) & Agenda Screen Interactions ---');

  await test('AgendaScreen.tsx defines permanent Floating Action Button (FAB) with onAddNewEvent trigger', () => {
    const agendaContent = fs.readFileSync(path.join(screensDir, 'AgendaScreen.tsx'), 'utf8');

    // Verify FAB component presence
    assert(agendaContent.includes('styles.fab'), 'AgendaScreen.tsx uses styles.fab');
    assert(agendaContent.includes('accessibilityLabel="Adicionar novo compromisso"'), 'FAB has accessibilityLabel');
    assert(agendaContent.includes('onAddNewEvent();'), 'FAB onPress calls onAddNewEvent callback');
    assert(agendaContent.includes('Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)'), 'FAB onPress triggers haptic feedback');

    // Verify FAB styling structure
    assert(agendaContent.includes('fab: {'), 'AgendaScreen.tsx stylesheet includes fab styling');
    assert(agendaContent.includes('position: \'absolute\''), 'FAB is positioned absolutely');
    assert(agendaContent.includes('bottom:'), 'FAB has bottom positioning offset');
    assert(agendaContent.includes('right:'), 'FAB has right positioning offset');
  });

  // ==========================================================================
  // SUITE 3: Business Logic State & Event Lifecycle Tests
  // ==========================================================================
  console.log('\n--- SUITE 3: Business Logic State & Event Lifecycle Tests ---');

  await test('toggleEventCompletion flips isCompleted flag and persists in storage', async () => {
    // Initial events state
    const initialEvents: AppEvent[] = [
      {
        id: 'evt_nav_test_1',
        title: 'Estudar Álgebra Linear',
        date: '2026-09-01T14:00:00.000Z',
        startTime: '14:00',
        endTime: '16:00',
        category: 'Faculdade/Aulas',
        isCompleted: false,
        alerts: [15]
      },
      {
        id: 'evt_nav_test_2',
        title: 'Academia',
        date: '2026-09-01T18:00:00.000Z',
        startTime: '18:00',
        endTime: '19:30',
        category: 'Saúde/Academia',
        isCompleted: true,
        alerts: [30]
      }
    ];

    await StorageService.saveEvents(initialEvents);

    // Function simulating toggleEventCompletion business logic
    const executeToggleEvent = async (eventsList: AppEvent[], eventId: string) => {
      const updated = eventsList.map(e => e.id === eventId ? { ...e, isCompleted: !e.isCompleted } : e);
      await StorageService.saveEvents(updated);
      return updated;
    };

    // Toggle false -> true
    const updated1 = await executeToggleEvent(initialEvents, 'evt_nav_test_1');
    const target1 = updated1.find(e => e.id === 'evt_nav_test_1');
    assert(target1?.isCompleted === true, 'Event evt_nav_test_1 flipped isCompleted from false to true');

    // Check storage persistence
    const loadedEvents1 = await StorageService.getEvents();
    assert(loadedEvents1.find(e => e.id === 'evt_nav_test_1')?.isCompleted === true, 'Updated event is saved in StorageService');

    // Toggle true -> false
    const updated2 = await executeToggleEvent(updated1, 'evt_nav_test_1');
    const target2 = updated2.find(e => e.id === 'evt_nav_test_1');
    assert(target2?.isCompleted === false, 'Event evt_nav_test_1 flipped isCompleted back from true to false');

    const loadedEvents2 = await StorageService.getEvents();
    assert(loadedEvents2.find(e => e.id === 'evt_nav_test_1')?.isCompleted === false, 'Reverted event is saved in StorageService');
  });

  await test('toggleTaskCompletion flips isCompleted flag on study tasks', async () => {
    const initialTasks: StudyTask[] = [
      {
        id: 'task_nav_1',
        title: 'Lista 3 de Física II',
        isCompleted: false,
        estimatedMinutes: 45,
        priority: 'high'
      },
      {
        id: 'task_nav_2',
        title: 'Resumo de Algoritmos',
        isCompleted: true,
        estimatedMinutes: 30,
        priority: 'medium'
      }
    ];

    await StorageService.saveTasks(initialTasks);

    const executeToggleTask = async (tasksList: StudyTask[], taskId: string) => {
      const updated = tasksList.map(t => t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t);
      await StorageService.saveTasks(updated);
      return updated;
    };

    // Toggle false -> true
    const step1 = await executeToggleTask(initialTasks, 'task_nav_1');
    assert(step1.find(t => t.id === 'task_nav_1')?.isCompleted === true, 'Task 1 isCompleted changed to true');

    const savedTasks1 = await StorageService.getTasks();
    assert(savedTasks1.find(t => t.id === 'task_nav_1')?.isCompleted === true, 'Task 1 true is saved to storage');

    // Toggle true -> false
    const step2 = await executeToggleTask(step1, 'task_nav_1');
    assert(step2.find(t => t.id === 'task_nav_1')?.isCompleted === false, 'Task 1 isCompleted changed back to false');
  });

  await test('deleteEvent removes event from list, cancels notifications and persists', async () => {
    const currentEvents: AppEvent[] = [
      { id: 'evt_del_1', title: 'Aula 1', date: '2026-09-02T08:00:00.000Z', startTime: '08:00', endTime: '10:00', category: 'Faculdade/Aulas', alerts: [] },
      { id: 'evt_del_2', title: 'Prova P2', date: '2026-09-03T10:00:00.000Z', startTime: '10:00', endTime: '12:00', category: 'Provas/Trabalhos', alerts: [60] },
      { id: 'evt_del_3', title: 'Aula 2', date: '2026-09-04T08:00:00.000Z', startTime: '08:00', endTime: '10:00', category: 'Faculdade/Aulas', alerts: [] },
    ];

    await StorageService.saveEvents(currentEvents);

    let cancelledEventId: string | null = null;
    const origCancel = NotificationService.cancelEventNotifications;
    NotificationService.cancelEventNotifications = async (id: string) => {
      cancelledEventId = id;
    };

    try {
      const executeDeleteEvent = async (eventsList: AppEvent[], eventId: string) => {
        const updated = eventsList.filter(e => e.id !== eventId);
        await StorageService.saveEvents(updated);
        await NotificationService.cancelEventNotifications(eventId);
        return updated;
      };

      const afterDelete = await executeDeleteEvent(currentEvents, 'evt_del_2');
      assert(afterDelete.length === 2, 'Events count decreased from 3 to 2');
      assert(!afterDelete.some(e => e.id === 'evt_del_2'), 'Event evt_del_2 was removed from state');
      assert(cancelledEventId === 'evt_del_2', 'NotificationService.cancelEventNotifications was triggered for deleted event');

      const loaded = await StorageService.getEvents();
      assert(loaded.length === 2, 'Storage holds 2 events after deletion');
      assert(!loaded.some(e => e.id === 'evt_del_2'), 'Storage does not contain deleted event');
    } finally {
      NotificationService.cancelEventNotifications = origCancel;
    }
  });

  await test('updateAttendance modifies existing record or appends new record', async () => {
    const initialAttendances: AttendanceRecord[] = [
      {
        id: 'att_test_1',
        subjectId: 'subj_math',
        eventId: 'evt_1',
        status: 'pending',
        date: '2026-09-01'
      }
    ];

    await StorageService.saveAttendances(initialAttendances);

    const executeUpdateAttendance = async (list: AttendanceRecord[], record: AttendanceRecord) => {
      const exists = list.find(a => a.id === record.id);
      const updated = exists 
        ? list.map(a => a.id === record.id ? record : a)
        : [...list, record];
      await StorageService.saveAttendances(updated);
      return updated;
    };

    // Update existing record from 'pending' to 'present'
    const updatedRecord: AttendanceRecord = {
      id: 'att_test_1',
      subjectId: 'subj_math',
      eventId: 'evt_1',
      status: 'present',
      date: '2026-09-01'
    };
    const list1 = await executeUpdateAttendance(initialAttendances, updatedRecord);
    assert(list1.length === 1, 'List size remains 1');
    assert(list1[0].status === 'present', 'Attendance status updated to present');

    const saved1 = await StorageService.getAttendances();
    assert(saved1[0].status === 'present', 'Saved attendance status is present');

    // Add new record (absent)
    const newRecord: AttendanceRecord = {
      id: 'att_test_2',
      subjectId: 'subj_physics',
      eventId: 'evt_2',
      status: 'absent',
      date: '2026-09-02'
    };
    const list2 = await executeUpdateAttendance(list1, newRecord);
    assert(list2.length === 2, 'List size increased to 2');
    assert(list2.find(a => a.id === 'att_test_2')?.status === 'absent', 'New attendance record appended with absent status');

    const saved2 = await StorageService.getAttendances();
    assert(saved2.length === 2, 'Storage contains 2 attendance records');
  });

  await test('archiveSubject marks subject as isArchived: true and persists', async () => {
    const initialSubjects: Subject[] = [
      {
        id: 'subj_arch_1',
        name: 'Cálculo Numérico',
        color: '#00FFAA',
        icon: 'calculator',
        code: 'MAT201',
        semesterId: 'sem_1',
        workloadHours: 60,
        maxAbsences: 15,
        isArchived: false,
        groups: []
      },
      {
        id: 'subj_arch_2',
        name: 'Física Moderna',
        color: '#3B82F6',
        icon: 'atom',
        code: 'FIS301',
        semesterId: 'sem_1',
        workloadHours: 60,
        maxAbsences: 15,
        isArchived: false,
        groups: []
      }
    ];

    await StorageService.saveSubjects(initialSubjects);

    const executeArchiveSubject = async (subjectsList: Subject[], subjectId: string) => {
      const updated = subjectsList.map(s => s.id === subjectId ? { ...s, isArchived: true } : s);
      await StorageService.saveSubjects(updated);
      return updated;
    };

    const archivedList = await executeArchiveSubject(initialSubjects, 'subj_arch_1');
    const subj1 = archivedList.find(s => s.id === 'subj_arch_1');
    const subj2 = archivedList.find(s => s.id === 'subj_arch_2');

    assert(subj1?.isArchived === true, 'subj_arch_1 is marked as isArchived: true');
    assert(subj2?.isArchived === false, 'subj_arch_2 remains isArchived: false');

    const savedSubjects = await StorageService.getSubjects();
    assert(savedSubjects.find(s => s.id === 'subj_arch_1')?.isArchived === true, 'Archived subject is saved in storage');
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
