import './setup_env';
import { LocalAIModelService, DEFAULT_OFFLINE_MODEL } from '../src/services/LocalAIModelService';
import { LocalAIInferenceService } from '../src/services/LocalAIInferenceService';
import { SyncService } from '../src/services/SyncService';
import { StorageService } from '../src/services/storage';
import { AIConfig, Subject, AppEvent, AttendanceRecord } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[TEST FAILED] ${message}`);
  }
  console.log(`  ✅ ${message}`);
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 SUITE: ON-DEVICE AI & UNIVERSAL HUB (METHOD 2)');
  console.log('======================================================\n');

  // ─────────────────────────────────────────────────────────────
  // 1. Local AI Model & Sandbox Storage Lifecycle Tests
  // ─────────────────────────────────────────────────────────────
  console.log('📦 1. Testing LocalAIModelService (Sandbox & Storage)...');

  const modelDir = LocalAIModelService.getModelDirectory();
  assert(modelDir.endsWith('models/'), `Model directory should end with models/, got: ${modelDir}`);

  const modelPath = LocalAIModelService.getModelFilePath('gemma-2b-it-cpu-int4.bin');
  assert(modelPath.includes('gemma-2b-it-cpu-int4.bin'), `Model path contains filename: ${modelPath}`);

  const initialStatus = await LocalAIModelService.checkModelStatus();
  assert(initialStatus.id === DEFAULT_OFFLINE_MODEL.id, `Default model ID is ${DEFAULT_OFFLINE_MODEL.id}`);

  // Test download simulation & progress callback
  let progressReported = false;
  const downloadedModel = await LocalAIModelService.startDownload((progress, downloaded, total) => {
    if (progress > 0) progressReported = true;
  });
  assert(downloadedModel.downloadState === 'downloaded', 'Model successfully marked as downloaded');
  assert(progressReported, 'Download progress callback was triggered');

  // Test storage stats
  const stats = await LocalAIModelService.getStorageStats();
  assert(stats.formattedSize.includes('GB') || stats.formattedSize.includes('MB'), `Storage formatted size: ${stats.formattedSize}`);

  // Test model deletion (cleanup sandbox)
  await LocalAIModelService.deleteModel();
  const postDeleteStatus = await LocalAIModelService.checkModelStatus();
  assert(postDeleteStatus.downloadState === 'not_downloaded', 'Model state reset to not_downloaded after deletion');

  // ─────────────────────────────────────────────────────────────
  // 2. AI Grade Calculation Formula Extraction Tests
  // ─────────────────────────────────────────────────────────────
  console.log('\n🎓 2. Testing AI Grade Criteria Extraction (Natural Language)...');

  const defaultAIConfig: AIConfig = {
    provider: 'gemini',
    mode: 'heuristic_offline',
    apiKey: '',
    model: 'gemini-1.5-flash',
    enableFallbackToCloud: true
  };

  // Test Case A: Weighted Exams (40% / 60%)
  const formula1 = await LocalAIInferenceService.extractGradeFormula(
    'Minha faculdade calcula a média com P1 peso 4 e P2 peso 6. Média 7.0 para aprovação.',
    defaultAIConfig,
    7.0
  );
  assert(formula1.groups.length > 0, 'Extracted grade groups for weighted exams');
  assert(formula1.passGrade === 7.0, `Extracted pass grade 7.0 (got ${formula1.passGrade})`);
  const examGroup = formula1.groups.find(g => g.name.toLowerCase().includes('prova') || g.name.toLowerCase().includes('avalia'));
  assert(examGroup !== undefined && examGroup.items.length === 2, 'Generated P1 and P2 items');
  assert(examGroup!.items[0].weight === 4 && examGroup!.items[1].weight === 6, 'P1 weight is 4 and P2 weight is 6');

  // Test Case B: 3 Exams Arithmetic Average
  const formula2 = await LocalAIInferenceService.extractGradeFormula(
    'São 3 provas no semestre: P1, P2 e P3. A média mínima é 6.0.',
    defaultAIConfig,
    6.0
  );
  assert(formula2.passGrade === 6.0, `Extracted pass grade 6.0 (got ${formula2.passGrade})`);
  const group2 = formula2.groups[0];
  assert(group2.items.length === 3, 'Extracted 3 exam items (P1, P2, P3)');

  // Test Case C: Provas + Extra Points
  const formula3 = await LocalAIInferenceService.extractGradeFormula(
    'São 2 provas (P1 e P2) e quem fizer o seminário ganha até 1.5 ponto extra na média final.',
    defaultAIConfig,
    7.0
  );
  assert(formula3.extraPoints !== undefined, 'Detected extra points rule');
  assert(formula3.extraPoints!.maxPoints === 1.5, `Extra points value is 1.5 (got ${formula3.extraPoints?.maxPoints})`);

  // ─────────────────────────────────────────────────────────────
  // 3. Universal Academic Text Parsing (WhatsApp, Classroom, etc.)
  // ─────────────────────────────────────────────────────────────
  console.log('\n💬 3. Testing Universal Academic Text AI Parsing...');

  const context = {
    currentDate: '2026-08-20',
    currentDayOfWeek: 'Quinta-feira',
    registeredSubjects: ['Cálculo 1', 'Física I', 'Algoritmos']
  };

  // Test Case A: Class Cancellation
  const cancelResult = await LocalAIInferenceService.parseUniversalInput(
    {
      rawText: 'Aviso urgente: Hoje (2026-08-20) não teremos aula de Cálculo 1 pois o professor está em congresso.',
      sourceType: 'text'
    },
    defaultAIConfig,
    context
  );
  assert(cancelResult.items.length === 1, 'Extracted 1 item for class cancellation');
  assert(cancelResult.items[0].intent === 'cancelled_class', 'Intent is cancelled_class');
  assert(cancelResult.items[0].subjectName === 'Cálculo 1', `Subject matched: ${cancelResult.items[0].subjectName}`);
  assert(cancelResult.items[0].targetDate === '2026-08-20', `Date matched: ${cancelResult.items[0].targetDate}`);

  // Test Case B: Exam Rescheduled
  const examResult = await LocalAIInferenceService.parseUniversalInput(
    {
      rawText: 'Atenção alunos de Física I: A Prova P2 foi remarcada para 2026-08-28 das 08:00 às 10:00.',
      sourceType: 'text'
    },
    defaultAIConfig,
    context
  );
  assert(examResult.items.length === 1, 'Extracted 1 exam item');
  assert(examResult.items[0].intent === 'exam', 'Intent is exam');
  assert(examResult.items[0].subjectName === 'Física I', `Subject matched: ${examResult.items[0].subjectName}`);
  assert(examResult.items[0].targetDate === '2026-08-28', `Exam date is 2026-08-28`);
  assert(examResult.items[0].startTime === '08:00' && examResult.items[0].endTime === '10:00', 'Time range extracted 08:00 to 10:00');

  // Test Case C: Homework Assignment
  const hwResult = await LocalAIInferenceService.parseUniversalInput(
    {
      rawText: 'Turma de Algoritmos, a entrega do Trabalho Prático 1 fica para 2026-09-02 às 23:59.',
      sourceType: 'text'
    },
    defaultAIConfig,
    context
  );
  assert(hwResult.items.length === 1, 'Extracted 1 homework item');
  assert(hwResult.items[0].intent === 'homework', 'Intent is homework');
  assert(hwResult.items[0].targetDate === '2026-09-02', 'Delivery date is 2026-09-02');
  assert(JSON.stringify(hwResult.items[0].alerts) === JSON.stringify([10080, 1440]), 'Homework has 1-week and 1-day alerts ([10080, 1440])');

  // ─────────────────────────────────────────────────────────────
  // 4. End-to-End Calendar and Attendance Sync
  // ─────────────────────────────────────────────────────────────
  console.log('\n🔄 4. Testing End-to-End Calendar & Attendance Sync...');

  const mockSubjects: Subject[] = [
    { id: 'subj_calc', name: 'Cálculo 1', color: '#3b82f6', semester: '2026.1', creditHours: 60, absencesAllowed: 15, passGrade: 7.0 }
  ];

  const mockEvents: AppEvent[] = [
    {
      id: 'event_calc_class',
      title: 'Aula de Cálculo 1',
      category: 'Faculdade/Aulas',
      date: '2026-08-20',
      startTime: '08:00',
      endTime: '10:00',
      recurrence: 'weekly',
      recurrenceDays: [4], // Thursday
      subjectId: 'subj_calc'
    }
  ];

  const mockAttendances: AttendanceRecord[] = [];

  const syncResult = await SyncService.processParsedItems(
    cancelResult.items,
    mockEvents,
    mockAttendances,
    mockSubjects
  );

  assert(syncResult.updatedAttendances.length === 1, 'Created 1 attendance record');
  assert(syncResult.updatedAttendances[0].status === 'cancelled', 'Attendance status set to cancelled');
  assert(syncResult.updatedAttendances[0].subjectId === 'subj_calc', 'Attendance linked to subject Cálculo 1');

  console.log('\n======================================================');
  console.log('🎉 ALL ON-DEVICE AI & UNIVERSAL HUB TESTS PASSED (100%)');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
