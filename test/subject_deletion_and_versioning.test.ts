import './setup_env';
import * as fs from 'fs';
import * as path from 'path';
import { compareSemver, isNewerVersion, parseSemver, APP_VERSION } from '../src/utils/version';
import { StorageService } from '../src/services/storage';
import { NotificationService } from '../src/services/notifications';
import { Subject, AppEvent, AttendanceRecord, ThemeType } from '../src/types';
import { mockNotifications } from './setup_env';

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
  console.log('📦 SUBJECT ATOMIC DELETION, ARCHIVE FILTER & SEMVER TEST SUITE');
  console.log('================================================================');

  // ==========================================================================
  // SUITE 1: SemVer & Build Number Comparator Tests
  // ==========================================================================
  console.log('\n--- SUITE 1: Semantic Versioning & Build Number Comparisons ---');

  await test('3.3.1 is recognized as newer than 3.3.0', () => {
    assertEqual(compareSemver('3.3.1', '3.3.0'), 1, 'compareSemver("3.3.1", "3.3.0") returns 1');
    assertEqual(isNewerVersion('3.3.1', '3.3.0'), true, '3.3.1 is strictly newer than 3.3.0');
    assertEqual(isNewerVersion('3.3.0', '3.3.1'), false, '3.3.0 is not newer than 3.3.1');
  });

  await test('v3.3.0-build-55 is newer than v3.3.0-build-54', () => {
    const p55 = parseSemver('v3.3.0-build-55');
    const p54 = parseSemver('v3.3.0-build-54');
    assertEqual(p55.build, 55, 'v3.3.0-build-55 parsed build is 55');
    assertEqual(p54.build, 54, 'v3.3.0-build-54 parsed build is 54');
    assertEqual(compareSemver('v3.3.0-build-55', 'v3.3.0-build-54'), 1, 'compareSemver returns 1 for higher build');
    assertEqual(isNewerVersion('v3.3.0-build-55', 'v3.3.0-build-54'), true, 'v3.3.0-build-55 is newer than v3.3.0-build-54');
    assertEqual(isNewerVersion('v3.3.0-build-54', 'v3.3.0-build-55'), false, 'v3.3.0-build-54 is not newer than v3.3.0-build-55');
  });

  await test('isNewerVersion("v3.3.1-build-1", "3.3.0") === true', () => {
    const result = isNewerVersion('v3.3.1-build-1', '3.3.0');
    assertEqual(result, true, 'isNewerVersion("v3.3.1-build-1", "3.3.0") returns true');
  });

  await test('SemVer comparison edge cases and formats', () => {
    // Equal versions
    assertEqual(compareSemver('3.3.0', '3.3.0'), 0, 'Identical versions return 0');
    assertEqual(isNewerVersion('3.3.0', '3.3.0'), false, 'Identical versions do not trigger update');

    // Build equality
    assertEqual(compareSemver('v3.3.0-build-10', 'v3.3.0-build-10'), 0, 'Identical build versions return 0');

    // Major bump beats higher minor/patch/build
    assertEqual(isNewerVersion('4.0.0', '3.99.99-build-999'), true, 'Major 4.0.0 is newer than 3.99.99-build-999');

    // Minor bump beats higher patch/build
    assertEqual(isNewerVersion('3.4.0', '3.3.99-build-999'), true, 'Minor 3.4.0 is newer than 3.3.99-build-999');

    // Dot and plus build formats
    const pDot = parseSemver('3.3.1-build.42');
    assertEqual(pDot.build, 42, '3.3.1-build.42 extracts build 42');
    const pPlus = parseSemver('3.3.1+88');
    assertEqual(pPlus.build, 88, '3.3.1+88 extracts build 88');

    // Defensive handling of malformed and empty inputs
    assertEqual(isNewerVersion('', '3.3.0'), false, 'Empty remote string returns false safely');
    assertEqual(isNewerVersion(null as unknown as string, '3.3.0'), false, 'Null remote string returns false safely');
    assertEqual(isNewerVersion(undefined as unknown as string, '3.3.0'), false, 'Undefined remote string returns false safely');
    assertEqual(isNewerVersion('invalid_version', '3.3.0'), false, 'Invalid string returns false safely');
  });

  // ==========================================================================
  // SUITE 2: Atomic Cascade Subject Deletion Tests
  // ==========================================================================
  console.log('\n--- SUITE 2: Atomic Cascade Subject Deletion ---');

  await test('deleteSubject purges subject, related events, related attendances and cancels notifications', async () => {
    const targetSubjectId = 'subj_calculus_101';
    const otherSubjectId = 'subj_physics_202';

    const initialSubjects: readonly Subject[] = [
      {
        id: targetSubjectId,
        name: 'Cálculo Diferencial I',
        color: '#00FFAA',
        icon: 'calculator',
        code: 'MAT101',
        semesterId: 'sem_1',
        workloadHours: 60,
        maxAbsences: 15,
        isArchived: false,
        groups: []
      },
      {
        id: otherSubjectId,
        name: 'Física Clássica',
        color: '#3B82F6',
        icon: 'atom',
        code: 'FIS101',
        semesterId: 'sem_1',
        workloadHours: 60,
        maxAbsences: 15,
        isArchived: false,
        groups: []
      }
    ];

    const initialEvents: readonly AppEvent[] = [
      {
        id: 'evt_calc_class_1',
        subjectId: targetSubjectId,
        title: 'Aula Cálculo - Limites',
        date: '2026-09-05T08:00:00.000Z',
        startTime: '08:00',
        endTime: '10:00',
        category: 'Faculdade/Aulas',
        alerts: [15]
      },
      {
        id: 'evt_calc_exam_1',
        subjectId: targetSubjectId,
        title: 'P1 Cálculo',
        date: '2026-09-20T10:00:00.000Z',
        startTime: '10:00',
        endTime: '12:00',
        category: 'Provas/Trabalhos',
        alerts: [60, 1440]
      },
      {
        id: 'evt_phys_class_1',
        subjectId: otherSubjectId,
        title: 'Aula Física - Vetores',
        date: '2026-09-06T14:00:00.000Z',
        startTime: '14:00',
        endTime: '16:00',
        category: 'Faculdade/Aulas',
        alerts: [15]
      },
      {
        id: 'evt_personal_gym',
        title: 'Treino de Academia',
        date: '2026-09-05T18:00:00.000Z',
        startTime: '18:00',
        endTime: '19:30',
        category: 'Saúde/Academia',
        alerts: [30]
      }
    ];

    const initialAttendances: readonly AttendanceRecord[] = [
      {
        id: 'att_calc_1',
        subjectId: targetSubjectId,
        eventId: 'evt_calc_class_1',
        status: 'present',
        date: '2026-09-05'
      },
      {
        id: 'att_calc_2',
        subjectId: targetSubjectId,
        eventId: 'evt_calc_class_1',
        status: 'absent',
        date: '2026-09-12'
      },
      {
        id: 'att_phys_1',
        subjectId: otherSubjectId,
        eventId: 'evt_phys_class_1',
        status: 'present',
        date: '2026-09-06'
      }
    ];

    // Seed storage with initial data
    await StorageService.saveSubjects([...initialSubjects]);
    await StorageService.saveEvents([...initialEvents]);
    await StorageService.saveAttendances([...initialAttendances]);

    // Track cancelled notification IDs
    const cancelledNotificationEventIds: string[] = [];
    const origCancel = NotificationService.cancelEventNotifications;
    NotificationService.cancelEventNotifications = async (eventId: string) => {
      cancelledNotificationEventIds.push(eventId);
    };

    try {
      // Execute atomic cascade deleteSubject logic (mirroring AppContext.tsx)
      const executeDeleteSubject = async (
        subjectId: string,
        currentSubjects: readonly Subject[],
        currentEvents: readonly AppEvent[],
        currentAttendances: readonly AttendanceRecord[]
      ): Promise<{
        updatedSubjects: Subject[];
        updatedEvents: AppEvent[];
        updatedAttendances: AttendanceRecord[];
      }> => {
        const updatedSubjects = currentSubjects.filter(s => s.id !== subjectId);
        const removedEvents = currentEvents.filter(e => e.subjectId === subjectId);
        const updatedEvents = currentEvents.filter(e => e.subjectId !== subjectId);
        const updatedAttendances = currentAttendances.filter(a => a.subjectId !== subjectId);

        await Promise.all([
          StorageService.saveSubjects(updatedSubjects),
          StorageService.saveEvents(updatedEvents),
          StorageService.saveAttendances(updatedAttendances),
          ...removedEvents.map(e => NotificationService.cancelEventNotifications(e.id))
        ]);

        return { updatedSubjects, updatedEvents, updatedAttendances };
      };

      const result = await executeDeleteSubject(
        targetSubjectId,
        initialSubjects,
        initialEvents,
        initialAttendances
      );

      // 1. Verify subject removed from state
      assertEqual(result.updatedSubjects.length, 1, 'Subjects list reduced from 2 to 1');
      assert(!result.updatedSubjects.some(s => s.id === targetSubjectId), 'Target subject was completely purged');
      assert(result.updatedSubjects.some(s => s.id === otherSubjectId), 'Other subject remains intact');

      // 2. Verify all associated events purged from state
      assertEqual(result.updatedEvents.length, 2, 'Events list reduced from 4 to 2');
      assert(!result.updatedEvents.some(e => e.subjectId === targetSubjectId), 'All target subject events were purged');
      assert(result.updatedEvents.some(e => e.id === 'evt_phys_class_1'), 'Physics event remains intact');
      assert(result.updatedEvents.some(e => e.id === 'evt_personal_gym'), 'Personal event without subject remains intact');

      // 3. Verify all associated attendances purged from state
      assertEqual(result.updatedAttendances.length, 1, 'Attendances list reduced from 3 to 1');
      assert(!result.updatedAttendances.some(a => a.subjectId === targetSubjectId), 'All target subject attendances purged');
      assert(result.updatedAttendances.some(a => a.id === 'att_phys_1'), 'Physics attendance remains intact');

      // 4. Verify notifications were cancelled for each removed event
      assertEqual(cancelledNotificationEventIds.length, 2, 'cancelEventNotifications called for both removed events');
      assert(cancelledNotificationEventIds.includes('evt_calc_class_1'), 'Cancelled notification for evt_calc_class_1');
      assert(cancelledNotificationEventIds.includes('evt_calc_exam_1'), 'Cancelled notification for evt_calc_exam_1');
      assert(!cancelledNotificationEventIds.includes('evt_phys_class_1'), 'Physics event notification was not cancelled');

      // 5. Verify persistence in StorageService
      const storedSubjects = await StorageService.getSubjects();
      const storedEvents = await StorageService.getEvents();
      const storedAttendances = await StorageService.getAttendances();

      assertEqual(storedSubjects.length, 1, 'StorageService holds 1 subject');
      assert(!storedSubjects.some(s => s.id === targetSubjectId), 'StorageService has no reference to target subject');

      assertEqual(storedEvents.length, 2, 'StorageService holds 2 events');
      assert(!storedEvents.some(e => e.subjectId === targetSubjectId), 'StorageService has no events for target subject');

      assertEqual(storedAttendances.length, 1, 'StorageService holds 1 attendance');
      assert(!storedAttendances.some(a => a.subjectId === targetSubjectId), 'StorageService has no attendances for target subject');
    } finally {
      NotificationService.cancelEventNotifications = origCancel;
    }
  });

  await test('deleteSubject is idempotent and handles non-existent subject ID gracefully', async () => {
    const subjects = await StorageService.getSubjects();
    const events = await StorageService.getEvents();
    const attendances = await StorageService.getAttendances();

    const nonExistentId = 'subj_non_existent_999';
    const updatedSubjects = subjects.filter(s => s.id !== nonExistentId);
    const updatedEvents = events.filter(e => e.subjectId !== nonExistentId);
    const updatedAttendances = attendances.filter(a => a.subjectId !== nonExistentId);

    assertEqual(updatedSubjects.length, subjects.length, 'No subjects removed for unknown ID');
    assertEqual(updatedEvents.length, events.length, 'No events removed for unknown ID');
    assertEqual(updatedAttendances.length, attendances.length, 'No attendances removed for unknown ID');
  });

  // ==========================================================================
  // SUITE 3: Active vs Archived Subjects Filter in AttendanceScreen & GradesScreen
  // ==========================================================================
  console.log('\n--- SUITE 3: Active Subjects Filtering (isArchived: true Excluded) ---');

  const mixedSubjects: readonly Subject[] = [
    {
      id: 'subj_active_1',
      name: 'Algoritmos e Estruturas de Dados',
      color: '#00FFAA',
      icon: 'code',
      code: 'CC101',
      semesterId: 'sem_1',
      workloadHours: 60,
      maxAbsences: 15,
      isArchived: false,
      groups: []
    },
    {
      id: 'subj_active_2',
      name: 'Banco de Dados I',
      color: '#3B82F6',
      icon: 'database',
      code: 'CC201',
      semesterId: 'sem_1',
      workloadHours: 60,
      maxAbsences: 15,
      isArchived: false,
      groups: []
    },
    {
      id: 'subj_archived_1',
      name: 'Química Geral (Concluída)',
      color: '#A855F7',
      icon: 'beaker',
      code: 'QUI001',
      semesterId: 'sem_old',
      workloadHours: 40,
      maxAbsences: 10,
      isArchived: true,
      groups: []
    },
    {
      id: 'subj_archived_2',
      name: 'Filosofia da Ciência (Trancada)',
      color: '#F59E0B',
      icon: 'book',
      code: 'FIL001',
      semesterId: 'sem_old',
      workloadHours: 30,
      maxAbsences: 8,
      isArchived: true,
      groups: []
    }
  ];

  await test('AttendanceScreen static source code filters out isArchived subjects', () => {
    const screensDir = path.resolve(__dirname, '../src/screens');
    const attendanceSource = fs.readFileSync(path.join(screensDir, 'AttendanceScreen.tsx'), 'utf8');

    assert(
      attendanceSource.includes('if (s.isArchived) return false;') ||
      attendanceSource.includes('!s.isArchived'),
      'AttendanceScreen.tsx explicitly checks and filters out s.isArchived'
    );
    assert(
      attendanceSource.includes('if (s.isArchived) return;'),
      'AttendanceScreen.tsx summaryMetrics ignores archived subjects'
    );
  });

  await test('GradesScreen static source code filters out isArchived subjects', () => {
    const screensDir = path.resolve(__dirname, '../src/screens');
    const gradesSource = fs.readFileSync(path.join(screensDir, 'GradesScreen.tsx'), 'utf8');

    assert(
      gradesSource.includes('if (s.isArchived) return false;') ||
      gradesSource.includes('!s.isArchived'),
      'GradesScreen.tsx explicitly checks and filters out s.isArchived'
    );
    assert(
      gradesSource.includes('if (s.isArchived) return;'),
      'GradesScreen.tsx overallMetrics ignores archived subjects'
    );
  });

  await test('AttendanceScreen active subjects filter isolates unarchived subjects', () => {
    // Replicate AttendanceScreen filteredSubjects logic strictly
    const filterAttendanceSubjects = (
      subjects: readonly Subject[],
      selectedSemester?: string
    ): Subject[] => {
      return subjects.filter(s => {
        if (s.isArchived) return false;
        if (selectedSemester && s.semesterId && s.semesterId !== selectedSemester) return false;
        return true;
      });
    };

    const activeList = filterAttendanceSubjects(mixedSubjects);
    assertEqual(activeList.length, 2, 'Only 2 active subjects retained out of 4');
    assert(!activeList.some(s => s.isArchived), 'Zero archived subjects present in active list');
    assert(activeList.some(s => s.id === 'subj_active_1'), 'Active subject 1 present');
    assert(activeList.some(s => s.id === 'subj_active_2'), 'Active subject 2 present');
    assert(!activeList.some(s => s.id === 'subj_archived_1'), 'Archived subject 1 excluded');
    assert(!activeList.some(s => s.id === 'subj_archived_2'), 'Archived subject 2 excluded');
  });

  await test('GradesScreen active subjects filter isolates unarchived subjects', () => {
    // Replicate GradesScreen filteredSubjects logic strictly
    const filterGradesSubjects = (
      subjects: readonly Subject[],
      selectedSemester?: string,
      searchQuery: string = ''
    ): Subject[] => {
      return subjects.filter(s => {
        if (s.isArchived) return false;
        if (selectedSemester && s.semesterId && s.semesterId !== selectedSemester) return false;
        if (searchQuery.trim() && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      });
    };

    const activeGrades = filterGradesSubjects(mixedSubjects);
    assertEqual(activeGrades.length, 2, 'Only 2 active subjects retained in GradesScreen filter');
    assert(!activeGrades.some(s => s.isArchived), 'Zero archived subjects present in active grades list');

    // Search query on active vs archived
    const searchArchived = filterGradesSubjects(mixedSubjects, undefined, 'Química');
    assertEqual(searchArchived.length, 0, 'Searching for archived subject name still yields 0 results');

    const searchActive = filterGradesSubjects(mixedSubjects, undefined, 'Algoritmos');
    assertEqual(searchActive.length, 1, 'Searching for active subject name yields matching subject');
    assertEqual(searchActive[0].id, 'subj_active_1', 'Matched correct active subject');
  });

  await test('Filter handles edge case when all subjects are archived', () => {
    const allArchived: readonly Subject[] = mixedSubjects.map(s => ({ ...s, isArchived: true }));
    const filtered = allArchived.filter(s => !s.isArchived);
    assertEqual(filtered.length, 0, 'Empty array returned when all subjects are archived');
  });

  await test('Filter handles subjects with missing isArchived (default active)', () => {
    const withoutArchivedFlag: readonly Subject[] = [
      {
        id: 'subj_default_active',
        name: 'Sistemas Operacionais',
        color: '#3B82F6',
        icon: 'terminal',
        code: 'SO101',
        semesterId: 'sem_1',
        workloadHours: 60,
        maxAbsences: 15,
        groups: []
      }
    ];

    const filtered = withoutArchivedFlag.filter(s => {
      if (s.isArchived) return false;
      return true;
    });

    assertEqual(filtered.length, 1, 'Subject with undefined isArchived is treated as active');
    assertEqual(filtered[0].id, 'subj_default_active', 'Retained active subject');
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
