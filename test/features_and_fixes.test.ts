import './setup_env';
import { AttendanceService } from '../src/services/AttendanceService';
import { calculateFinalGrade } from '../src/components/GradeEngine';
import { StorageService } from '../src/services/storage';
import { generateId } from '../src/utils/id';
import { Subject, GradeGroup, AppEvent, AttendanceRecord, Semester, BackupData } from '../src/types';

async function runTests() {
  console.log('================================================================');
  console.log('ORGANIZA 2.0: FEATURES & BUG FIXES TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string) {
    if (condition) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name}`);
      failed++;
    }
  }

  // ── 1. Unique ID Generator ──
  console.log('--- 1. Unique ID Generation ---');
  const ids = new Set<string>();
  const totalGenerations = 10000;
  for (let i = 0; i < totalGenerations; i++) {
    ids.add(generateId('test'));
  }
  assert(ids.size === totalGenerations, `Generated ${totalGenerations} unique IDs without any collisions`);
  assert(Array.from(ids)[0].startsWith('test_'), 'ID matches specified prefix');

  // ── 2. Attendance Service Optimized Step Loop ──
  console.log('\n--- 2. Attendance Service (Weekly step optimization) ---');
  const sampleEvents: AppEvent[] = [
    {
      id: 'evt_calc_class',
      title: 'Aula Cálculo',
      category: 'Faculdade/Aulas',
      date: '2026-08-03', // Monday
      startTime: '08:00',
      endTime: '10:00',
      recurrence: 'weekly',
      recurrenceDays: [1],
      alerts: [],
      isCompleted: false,
      isImportant: false,
      isNotified: false,
      subjectId: 'subj_calc',
    }
  ];

  const existingAttendances: AttendanceRecord[] = [];
  const generated = await AttendanceService.generatePendingAttendances(sampleEvents, existingAttendances);
  assert(generated.length > 0, `Generated ${generated.length} past class attendances efficiently`);
  assert(generated.every(a => a.subjectId === 'subj_calc'), 'All attendances correctly linked to subject');

  // ── 3. Grade Engine Calculation & Simulator Logic ──
  console.log('\n--- 3. Grade Engine Calculation & Simulator ---');
  
  const sampleGroups: GradeGroup[] = [
    {
      id: 'grp_1',
      name: 'Avaliações',
      weight: 1,
      items: [
        { id: 'item_1', name: 'P1', weight: 1, maxGrade: 10, grade: 8.0 },
        { id: 'item_2', name: 'P2', weight: 1, maxGrade: 10, grade: undefined } // Missing P2
      ]
    }
  ];

  const calc1 = calculateFinalGrade(sampleGroups, 7.0);
  assert(calc1.score === 8.0, 'Calculates current score correctly (8.0)');
  assert(calc1.hasMissingItems === true, 'Identifies missing items');
  assert(calc1.missingItemsCount === 1, 'Identifies 1 missing assessment');
  assert(calc1.minimumNeeded === 6.0, `Calculates minimum needed in P2 to pass (needs 6.0, got ${calc1.minimumNeeded})`);

  // Low score requiring final exam
  const failingGroups: GradeGroup[] = [
    {
      id: 'grp_f',
      name: 'Avaliações',
      weight: 1,
      items: [
        { id: 'item_1', name: 'P1', weight: 1, maxGrade: 10, grade: 4.0 },
        { id: 'item_2', name: 'P2', weight: 1, maxGrade: 10, grade: 4.0 }
      ]
    }
  ];
  const calcFailing = calculateFinalGrade(failingGroups, 7.0);
  assert(calcFailing.score === 4.0, 'Average is 4.0');
  assert(calcFailing.inFinal === true, 'Flags student as in Final Exam status');
  assert(calcFailing.hasMissingItems === false, 'No missing normal items');

  // Simulated Final Exam grade
  const finalExamGroup: GradeGroup[] = [
    {
      id: 'grp_f2',
      name: 'Avaliações',
      weight: 1,
      items: [
        { id: 'item_1', name: 'P1', weight: 1, maxGrade: 10, grade: 4.0 },
        { id: 'item_2', name: 'P2', weight: 1, maxGrade: 10, grade: 4.0 },
        { id: 'item_final', name: 'Prova Final', weight: 1, maxGrade: 10, grade: 6.0, isFinalExam: true }
      ]
    }
  ];
  const calcWithFinal = calculateFinalGrade(finalExamGroup, 7.0);
  assert(calcWithFinal.usedFinal === true, 'Applied final exam weighting');
  assert(calcWithFinal.score === 5.0, `Calculates (4.0 + 6.0) / 2 = 5.0 (got ${calcWithFinal.score})`);

  // ── 4. Storage Service Backup & Restore Verification ──
  console.log('\n--- 4. Backup & Restore Invariant Testing ---');
  const mockSemesters: Semester[] = [
    { id: 'sem_2026_1', name: '2026.1', isCurrent: true, isArchived: false }
  ];
  await StorageService.saveSemesters(mockSemesters);
  const loadedSemesters = await StorageService.getSemesters();
  assert(loadedSemesters.length === 1 && loadedSemesters[0].name === '2026.1', 'Saved and loaded semester successfully');

  const backup = await StorageService.exportBackup();
  assert(backup.version >= 1, `Backup export version is valid (version ${backup.version})`);
  assert(backup.semesters.length === 1, 'Backup contains semesters');

  // Mutate and restore
  await StorageService.saveSemesters([]);
  assert((await StorageService.getSemesters()).length === 0, 'Cleared semesters before import');
  await StorageService.importBackup(backup);
  const restoredSemesters = await StorageService.getSemesters();
  assert(restoredSemesters.length === 1 && restoredSemesters[0].name === '2026.1', 'Successfully restored data from backup');

  console.log('\n================================================================');
  console.log(`TESTS SUMMARY: ${passed}/${passed + failed} Passed (${failed} Failed)`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runTests();
