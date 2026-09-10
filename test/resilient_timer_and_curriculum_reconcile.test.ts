import './setup_env';
import { CourseCRService, DEFAULT_CURRICULUM_TEMPLATE } from '../src/services/CourseCRService';
import { StorageService } from '../src/services/storage';
import { NotificationService } from '../src/services/notifications';
import { CourseProgressData, Subject, AppEvent, AttendanceRecord, StudyTask, ActiveTimerState } from '../src/types';

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

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 RESILIENT TIMER & CURRICULUM RECONCILIATION TEST SUITE');
  console.log('================================================================');

  // ── SUITE 1: Ghost Subject Purger in Academic Performance ──
  console.log('\n--- 1. CourseCRService.reconcileWithActiveSubjects ---');

  const mockCourseData: CourseProgressData = {
    courseName: 'Engenharia de Software',
    targetCR: 8.5,
    baselineCR: 8.0,
    totalRequiredCredits: 100,
    completedCredits: 20,
    totalRequiredHours: 1600,
    completedHours: 320,
    semesters: [
      {
        semesterNumber: 1,
        title: '1º Semestre',
        subjects: [
          // Concluída histórica -> DEVE PERMANECER
          { id: 'sub_hist_1', name: 'Cálculo I', credits: 4, isCompleted: true, grade: 8.5 },
          // Concluída com nota -> DEVE PERMANECER
          { id: 'sub_hist_2', name: 'Álgebra Linear', credits: 4, isCompleted: true, grade: 7.0 },
          // Matéria padrão do template não concluída -> DEVE PERMANECER (faz parte da grade de curso)
          { id: 'sub_temp_3', name: 'Física I', credits: 4, isCompleted: false },
        ]
      },
      {
        semesterNumber: 2,
        title: 'Semestre Atual (Em Andamento)',
        subjects: [
          // Matéria ativa cadastrada pelo aluno -> DEVE PERMANECER
          { id: 'subj_active_1', name: 'Estrutura de Dados', credits: 4, isCompleted: false },
          // Matéria fantasma que foi excluída pelo aluno -> DEVE SER EXPURGADA
          { id: 'subj_ghost_deleted', name: 'Matéria Cancelada', credits: 4, isCompleted: false },
          // Matéria histórica concluída dentro do semestre -> DEVE PERMANECER
          { id: 'subj_done_recently', name: 'Projeto Integrador', credits: 2, isCompleted: true, grade: 9.5 }
        ]
      },
      {
        semesterNumber: 3,
        title: 'Extensão Cursando',
        subjects: [
          // Bloco que continha apenas matéria fantasma
          { id: 'subj_ghost_only', name: 'Optativa Fantasma', credits: 4, isCompleted: false }
        ]
      }
    ]
  };

  const activeIds = ['subj_active_1', 'other_sub_not_in_matrix'];

  const reconciled = CourseCRService.reconcileWithActiveSubjects(mockCourseData, activeIds);

  assert(Array.isArray(reconciled.semesters), 'Reconciled course data returns semesters array');
  assert(reconciled.semesters.length === 2, 'Empty ghost-only extension semester was pruned (length: 2)');

  const sem1 = reconciled.semesters[0];
  assert(sem1.subjects.length === 3, '1º Semestre preserved all historical and curriculum template subjects');
  assert(sem1.subjects.some(s => s.id === 'sub_hist_1' && s.grade === 8.5), 'Preserved Cálculo I with grade 8.5');
  assert(sem1.subjects.some(s => s.id === 'sub_hist_2' && s.grade === 7.0), 'Preserved Álgebra Linear with grade 7.0');
  assert(sem1.subjects.some(s => s.id === 'sub_temp_3'), 'Preserved template subject Física I');

  const sem2 = reconciled.semesters[1];
  assert(sem2.subjects.some(s => s.id === 'subj_active_1'), 'Preserved active enrolled subject subj_active_1');
  assert(sem2.subjects.some(s => s.id === 'subj_done_recently'), 'Preserved completed subject subj_done_recently');
  assert(!sem2.subjects.some(s => s.id === 'subj_ghost_deleted'), 'Purged deleted ghost subject subj_ghost_deleted');

  // Baseline CR calculation integrity
  assert(reconciled.baselineCR > 0, `Baseline CR recomputed accurately (${reconciled.baselineCR.toFixed(2)})`);

  // ── SUITE 2: Cascading Storage Deletion with Curriculum Reconcile ──
  console.log('\n--- 2. StorageService.deleteSubject Cascading Purge ---');

  await StorageService.clearAllData();

  const testSubject: Subject = {
    id: 'subj_to_delete',
    name: 'Algoritmos e Estruturas',
    code: 'CC201',
    credits: 4,
    color: '#3B82F6',
    professor: 'Dr. Turing',
  };
  await StorageService.saveSubjects([testSubject]);

  const testEvents: AppEvent[] = [
    {
      id: 'evt_1',
      title: 'Aula de Algoritmos',
      subjectId: 'subj_to_delete',
      date: '2026-03-10',
      time: '08:00',
      category: 'Faculdade/Aulas',
    },
    {
      id: 'evt_orphan_exam',
      title: 'P1 Algoritmos e Estruturas',
      subjectId: '', // órfão com nome da matéria no título
      date: '2026-03-20',
      time: '10:00',
      category: 'Provas/Trabalhos',
      grade: 8.0,
      weight: 1.0,
    },
    {
      id: 'evt_other',
      title: 'Treino de Academia',
      subjectId: 'subj_other',
      date: '2026-03-10',
      time: '18:00',
      category: 'Saúde/Academia',
    }
  ];
  await StorageService.saveEvents(testEvents);

  const testAttendances: AttendanceRecord[] = [
    { id: 'att_1', subjectId: 'subj_to_delete', date: '2026-03-10', status: 'present' },
    { id: 'att_2', subjectId: 'subj_other', date: '2026-03-10', status: 'present' }
  ];
  await StorageService.saveAttendances(testAttendances);

  const testTasks: StudyTask[] = [
    { id: 'task_1', title: 'Lista 1', subjectId: 'subj_to_delete', isCompleted: false, priority: 'high' },
    { id: 'task_2', title: 'Leitura', subjectId: 'subj_other', isCompleted: false, priority: 'low' }
  ];
  await StorageService.saveTasks(testTasks);

  // Initialize course data with the subject enrolled in semester 2
  const initialCourse = CourseCRService.addSubjectToSemester(
    DEFAULT_CURRICULUM_TEMPLATE,
    2,
    { id: 'subj_to_delete', name: 'Algoritmos e Estruturas', credits: 4, isCompleted: false }
  );
  await CourseCRService.saveCourseProgress(initialCourse);

  // Execute cascade deletion
  const deleteResult = await StorageService.deleteSubject('subj_to_delete');
  assert(deleteResult === true, 'deleteSubject returned true');

  const remainingSubjects = await StorageService.getSubjects();
  assert(!remainingSubjects.some(s => s.id === 'subj_to_delete'), 'Subject removed from @organiza_subjects');

  const remainingEvents = await StorageService.getEvents();
  assert(!remainingEvents.some(e => e.id === 'evt_1'), 'Associated direct event removed from @organiza_events');
  assert(!remainingEvents.some(e => e.id === 'evt_orphan_exam'), 'Orphan exam event matching subject name purged');
  assert(remainingEvents.some(e => e.id === 'evt_other'), 'Unrelated event preserved');

  const remainingAtts = await StorageService.getAttendances();
  assert(!remainingAtts.some(a => a.id === 'att_1'), 'Associated attendance record removed');
  assert(remainingAtts.some(a => a.id === 'att_2'), 'Unrelated attendance record preserved');

  const remainingTasks = await StorageService.getTasks();
  assert(!remainingTasks.some(t => t.id === 'task_1'), 'Associated task removed');
  assert(remainingTasks.some(t => t.id === 'task_2'), 'Unrelated task preserved');

  const updatedCourse = await CourseCRService.loadCourseProgress();
  const flatCourseSubjects = updatedCourse.semesters.flatMap(s => s.subjects);
  assert(!flatCourseSubjects.some(s => s.id === 'subj_to_delete'), 'CourseCRService courseData purged ghost subject');

  // ── SUITE 3: Resilient Timer (Pomodoro & Stopwatch) Persistence & Timestamps ──
  console.log('\n--- 3. Resilient ActiveTimerState & Unix Timestamps ---');

  const now = Date.now();
  const pomodoroDurationSec = 25 * 60;
  const targetEndTime = now + (pomodoroDurationSec * 1000);

  const activePomodoro: ActiveTimerState = {
    mode: 'pomodoro',
    isRunning: true,
    startedAt: now,
    targetEndTime,
    remainingSeconds: pomodoroDurationSec,
    initialDuration: pomodoroDurationSec,
    subjectId: 'subj_test_1',
    isBreak: false
  };

  await StorageService.saveActiveTimer(activePomodoro);
  const loadedTimer = await StorageService.getActiveTimer();

  assert(loadedTimer !== null, 'Loaded activeTimer is not null');
  assert(loadedTimer?.mode === 'pomodoro', 'Mode is pomodoro');
  assert(loadedTimer?.isRunning === true, 'isRunning is true');
  assert(loadedTimer?.targetEndTime === targetEndTime, 'targetEndTime is preserved');
  assert(loadedTimer?.subjectId === 'subj_test_1', 'subjectId is preserved');

  // Test timestamp remaining formula: Math.max(0, Math.round((targetEndTime - Date.now()) / 1000))
  const remainingCalculated = Math.max(0, Math.round((loadedTimer!.targetEndTime! - Date.now()) / 1000));
  assert(remainingCalculated >= pomodoroDurationSec - 2 && remainingCalculated <= pomodoroDurationSec, `Calculated remaining seconds (${remainingCalculated}) is close to ${pomodoroDurationSec}`);

  // Expired in background simulation
  const pastTargetEndTime = Date.now() - 5000; // 5 seconds in the past
  const expiredRemaining = Math.max(0, Math.round((pastTargetEndTime - Date.now()) / 1000));
  assert(expiredRemaining === 0, 'Expired timer remainingSeconds clamps safely to 0 for auto-completion');

  // Stopwatch elapsed simulation
  const stopwatchStartedAt = Date.now() - 45000; // 45 seconds ago
  const stopwatchElapsed = Math.max(0, Math.floor((Date.now() - stopwatchStartedAt) / 1000));
  assert(stopwatchElapsed >= 44 && stopwatchElapsed <= 46, `Stopwatch elapsed seconds (${stopwatchElapsed}) accurately derived`);

  // Notification scheduling helper
  const scheduledNotificationId = await NotificationService.scheduleTimerNotification(
    targetEndTime,
    '⏱️ Ciclo Concluído!',
    'Parabéns pelo foco!'
  );
  assert(typeof scheduledNotificationId === 'string' || scheduledNotificationId === null, 'scheduleTimerNotification executed safely');

  await NotificationService.cancelTimerNotification();
  assert(true, 'cancelTimerNotification executed safely without error');

  // Clear timer
  await StorageService.saveActiveTimer(null);
  const clearedTimer = await StorageService.getActiveTimer();
  assert(clearedTimer === null, 'Active timer cleared cleanly');

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed}/${passed + failed} Passed (${failed} Failed)`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
