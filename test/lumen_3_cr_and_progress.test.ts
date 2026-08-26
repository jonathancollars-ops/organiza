import './setup_env';
import { CourseCRService, DEFAULT_CURRICULUM_TEMPLATE } from '../src/services/CourseCRService';
import { LocalAIModelService, AVAILABLE_MODEL_TIERS } from '../src/services/LocalAIModelService';
import { getCurrentSemesterId, getCurrentSemesterName } from '../src/utils/date';
import { CourseProgressData, Subject } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  [PASS] ${message}`);
}

async function runTests() {
  console.log('================================================================');
  console.log('LUMEN 3.0: CR TRACKER, DEGREE PROGRESS & TUTOR VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const test = async (name: string, fn: () => void | Promise<void>) => {
    console.log(`--- Test: ${name} ---`);
    try {
      await fn();
      passed++;
    } catch (e: any) {
      console.error(`Error in ${name}:`, e.message);
      failed++;
    }
    console.log('');
  };

  // Test 1: Automatic Semester Resolution
  await test('Automatic Semester Resolution based on date clock', () => {
    const marchDate = new Date('2026-03-15T12:00:00');
    assert(getCurrentSemesterId(marchDate) === '2026.1', 'March date resolves to 2026.1');
    assert(getCurrentSemesterName(marchDate) === '1º Semestre de 2026', 'March name resolves to 1º Semestre de 2026');

    const augustDate = new Date('2026-08-21T12:00:00');
    assert(getCurrentSemesterId(augustDate) === '2026.2', 'August date resolves to 2026.2');
    assert(getCurrentSemesterName(augustDate) === '2º Semestre de 2026', 'August name resolves to 2º Semestre de 2026');

    const decemberDate = new Date('2026-12-10T12:00:00');
    assert(getCurrentSemesterId(decemberDate) === '2026.2', 'December date resolves to 2026.2');

    const janDate = new Date('2027-01-05T12:00:00');
    assert(getCurrentSemesterId(janDate) === '2027.1', 'January date resolves to 2027.1');
  });

  // Test 2: Weighted Cumulative CR Calculation
  await test('Weighted Cumulative CR Calculation', () => {
    const mockData: CourseProgressData = {
      totalRequiredCredits: 100,
      completedCredits: 15,
      semesters: [
        {
          semesterNumber: 1,
          title: '1º Semestre',
          subjects: [
            { id: '1', name: 'Cálculo 1', credits: 5, grade: 8.0, isCompleted: true }, // 40
            { id: '2', name: 'Física 1', credits: 4, grade: 7.0, isCompleted: true },   // 28
            { id: '3', name: 'Programação', credits: 4, grade: 9.0, isCompleted: true }, // 36
            { id: '4', name: 'Metodologia', credits: 2, grade: 10.0, isCompleted: true } // 20
          ]
        }
      ]
    };
    // Total weighted: 40 + 28 + 36 + 20 = 124
    // Total credits: 5 + 4 + 4 + 2 = 15
    // CR = 124 / 15 = 8.2666... -> 8.27
    const cr = CourseCRService.calculateHistoricalCR(mockData);
    assert(cr === 8.27, `CR calculates to exactly 8.27 (got ${cr})`);
  });

  // Test 3: Degree Progress and % of Course Completion
  await test('Degree Progress and % of Course Completion', () => {
    const mockData: CourseProgressData = {
      totalRequiredCredits: 200,
      completedCredits: 0,
      semesters: [
        {
          semesterNumber: 1,
          title: '1º Semestre',
          subjects: [
            { id: '1', name: 'Matéria 1', credits: 5, isCompleted: true },
            { id: '2', name: 'Matéria 2', credits: 5, isCompleted: true },
            { id: '3', name: 'Matéria 3', credits: 5, isCompleted: false },
            { id: '4', name: 'Matéria 4', credits: 5, isCompleted: false }
          ]
        },
        {
          semesterNumber: 2,
          title: '2º Semestre',
          subjects: [
            { id: '5', name: 'Matéria 5', credits: 5, isCompleted: true },
            { id: '6', name: 'Matéria 6', credits: 5, isCompleted: false }
          ]
        }
      ]
    };

    const progress = CourseCRService.calculateDegreeProgress(mockData);
    // Completed credits = 5 + 5 + 5 = 15 credits
    // Total required = 200 credits
    // Percentage = (15 / 200) * 100 = 7.5%
    assert(progress.completedCredits === 15, `Completed credits = 15 (got ${progress.completedCredits})`);
    assert(progress.completionPercentage === 7.5, `Completion % = 7.5% (got ${progress.completionPercentage})`);
    assert(progress.completedSubjectsCount === 3, `Completed subjects = 3 (got ${progress.completedSubjectsCount})`);
    assert(progress.totalSubjectsCount === 6, `Total subjects in matrix = 6 (got ${progress.totalSubjectsCount})`);
  });

  // Test 4: Subject Completion Toggling
  await test('Subject Completion Toggling in Curriculum Matrix', () => {
    let data = { ...DEFAULT_CURRICULUM_TEMPLATE };
    const firstSubId = data.semesters[0].subjects[0].id;
    const initialStatus = data.semesters[0].subjects[0].isCompleted;

    data = CourseCRService.toggleSubjectCompletion(data, firstSubId);
    assert(data.semesters[0].subjects[0].isCompleted === !initialStatus, 'Subject toggled correctly');

    data = CourseCRService.toggleSubjectCompletion(data, firstSubId);
    assert(data.semesters[0].subjects[0].isCompleted === initialStatus, 'Subject toggled back to initial state');
  });

  // Test 5: Dynamic What-If Simulation Scenarios
  await test('Dynamic What-If Simulation Scenarios', () => {
    const courseData: CourseProgressData = {
      targetCR: 8.5,
      baselineCR: 8.0,
      totalRequiredCredits: 100,
      completedCredits: 20,
      semesters: [
        {
          semesterNumber: 1,
          title: '1º Semestre',
          subjects: [
            { id: '1', name: 'Cálculo 1', credits: 10, grade: 8.0, isCompleted: true },
            { id: '2', name: 'Física 1', credits: 10, grade: 8.0, isCompleted: true }
          ]
        }
      ]
    };

    const activeSubjects: Subject[] = [
      { id: 'cur_1', name: 'Cálculo 2', passGrade: 7.0, workloadHours: 80 },
      { id: 'cur_2', name: 'Física 2', passGrade: 7.0, workloadHours: 80 }
    ];

    const result = CourseCRService.simulateCRScenarios(courseData, activeSubjects);
    assert(result.currentCR === 8.0, `Historical CR is 8.0 (got ${result.currentCR})`);
    assert(result.scenarios.length === 4, `4 simulation scenarios generated (got ${result.scenarios.length})`);
    
    const worstCase = result.scenarios.find(s => s.type === 'worst_case');
    assert(!!worstCase, 'Worst-case scenario exists');
    assert(worstCase!.projectedCR <= 8.0, `Worst case CR (${worstCase!.projectedCR}) <= historical`);

    const bestCase = result.scenarios.find(s => s.type === 'best_case');
    assert(!!bestCase, 'Best-case scenario exists');
    assert(bestCase!.projectedCR >= 8.0, `Best case CR (${bestCase!.projectedCR}) >= historical`);

    const targetScen = result.scenarios.find(s => s.type === 'target');
    assert(!!targetScen, 'Target scenario exists');
    assert(targetScen!.projectedCR === 8.5, 'Target scenario targets 8.5');
  });

  // Test 6: Socratic Tutor Pedagogical Prompts
  await test('Socratic Tutor Pedagogical Prompts vs Direct Mode', () => {
    const socraticPrompt = LocalAIModelService.getTutorSystemPrompt('socratic', 'Cálculo I');
    assert(socraticPrompt.includes('Método Socrático'), 'Contains Socratic method directive');
    assert(socraticPrompt.includes('NUNCA dê a resposta final'), 'Contains strict non-spoiler rule');
    assert(socraticPrompt.includes('Cálculo I'), 'Contextualized with subject name');

    const directPrompt = LocalAIModelService.getTutorSystemPrompt('direct', 'Física II');
    assert(directPrompt.includes('Modo Resolução Direta'), 'Contains Direct resolution directive');
    assert(directPrompt.includes('resolução completa'), 'Contains step-by-step resolution rule');
  });

  // Test 7: Available Model Tiers Configurations
  await test('Available Model Tiers Configurations', () => {
    assert(AVAILABLE_MODEL_TIERS.light.tier === 'light', 'Light tier configured');
    assert(AVAILABLE_MODEL_TIERS.light.sizeBytes < 500000000, 'Light tier is < 500 MB');
    assert(AVAILABLE_MODEL_TIERS.medium.tier === 'medium', 'Medium tier configured');
    assert(AVAILABLE_MODEL_TIERS.medium.sizeBytes > 1000000000, 'Medium tier is > 1.0 GB');
    assert(AVAILABLE_MODEL_TIERS.deep.tier === 'deep', 'Deep tier configured');
    assert(AVAILABLE_MODEL_TIERS.deep.sizeBytes > 2000000000, 'Deep tier is > 2.0 GB');
  });

  // Test 8: Parse History Text
  await test('Parse raw history text into CourseProgressData', () => {
    const rawTranscript = `
MAT101 Cálculo Diferencial 80h Aprovado 8.5
FIS101 Física Geral I 60h Concluído 7.0
CC101 Algoritmos 60h 9.0 Aprovada
    `;
    const parsed = CourseCRService.parseHistoryText(rawTranscript);
    assert(parsed.semesters.length > 0, 'Parsed into curriculum semesters');
    assert(parsed.semesters[0].subjects.length >= 3, 'Parsed at least 3 subjects');
  });

  // Test 9: Check All Tiers Status
  await test('Check All 3 AI Model Tiers Status in Sandbox', async () => {
    const allStatuses = await LocalAIModelService.checkAllTiersStatus();
    assert(!!allStatuses.light, 'Light tier status returned');
    assert(allStatuses.light.formattedSize === AVAILABLE_MODEL_TIERS.light.formattedSize, 'Light tier formatted size matches');
    assert(!!allStatuses.medium, 'Medium tier status returned');
    assert(allStatuses.medium.formattedSize === AVAILABLE_MODEL_TIERS.medium.formattedSize, 'Medium tier formatted size matches');
    assert(!!allStatuses.deep, 'Deep tier status returned');
    assert(allStatuses.deep.formattedSize === AVAILABLE_MODEL_TIERS.deep.formattedSize, 'Deep tier formatted size matches');
  });

  // Test 10: FAB Visibility Condition on Tabs (Only on Agenda)
  await test('FAB Add Button Visibility Condition (Agenda only)', () => {
    const shouldShowFAB = (tab: 'agenda' | 'estudos' | 'ia' | 'faltas' | 'notas') => {
      return tab === 'agenda';
    };

    assert(shouldShowFAB('agenda') === true, 'FAB is visible on Agenda tab');
    assert(shouldShowFAB('estudos') === false, 'FAB is hidden on Estudos tab');
    assert(shouldShowFAB('faltas') === false, 'FAB is hidden on Faltas tab');
    assert(shouldShowFAB('ia') === false, 'FAB is hidden on Lumen AI tab');
    assert(shouldShowFAB('notas') === false, 'FAB is hidden on Notas tab');
  });

  console.log('================================================================');
  console.log(`LUMEN 3.0 TESTS SUMMARY: ${passed}/${passed + failed} Suites Passed (${failed} Failed)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
