import './setup_env';
import * as fs from 'fs';
import * as path from 'path';
import { CourseCRService } from '../src/services/CourseCRService';
import { AIParsingService, resolveDocumentMimeType } from '../src/services/AIParsingService';
import { CourseProgressData, Subject, AIConfig } from '../src/types';

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
  console.log('🎓 SEMESTER CLOSURE, CASCADE DELETION & PDF PARSING TEST SUITE');
  console.log('================================================================');

  // --------------------------------------------------------------------------
  // SUITE 1: CourseCRService.removeSubjectFromCurrentSemester (Ghost cleanup)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 1: Cascade Subject Deletion in courseData ---');

  await test('Removes subject by matching ID from active/uncompleted semester', () => {
    const mockData: CourseProgressData = {
      courseName: 'Ciência da Computação',
      totalRequiredCredits: 100,
      completedCredits: 20,
      baselineCR: 8.0,
      semesters: [
        {
          semesterNumber: 1,
          title: '1º Semestre',
          subjects: [
            { id: 'subj_1_done', name: 'Cálculo I', credits: 4, isCompleted: true, grade: 9.0 },
            { id: 'subj_1_prog', name: 'Programação I', credits: 4, isCompleted: true, grade: 8.5 },
          ]
        },
        {
          semesterNumber: 2,
          title: '2º Semestre (2026.1)',
          subjects: [
            { id: 'subj_to_delete', name: 'Física I', credits: 4, isCompleted: false },
            { id: 'subj_keep', name: 'Álgebra Linear', credits: 4, isCompleted: false },
          ]
        }
      ]
    };

    const updated = CourseCRService.removeSubjectFromCurrentSemester(mockData, 'subj_to_delete', 'Física I');

    const sem2 = updated.semesters.find(s => s.semesterNumber === 2);
    assert(!!sem2, '2º Semestre exists');
    assert(sem2?.subjects.length === 1, '2º Semestre has exactly 1 subject left');
    assert(sem2?.subjects[0].id === 'subj_keep', 'Remaining subject is subj_keep');
    assert(!sem2?.subjects.some(s => s.id === 'subj_to_delete'), 'subj_to_delete was removed');
  });

  await test('Removes subject by normalized name match in active/uncompleted semester', () => {
    const mockData: CourseProgressData = {
      courseName: 'Engenharia',
      totalRequiredCredits: 120,
      completedCredits: 10,
      baselineCR: 7.5,
      semesters: [
        {
          semesterNumber: 1,
          title: '1º Semestre',
          subjects: [
            { id: 'flow_calc', name: 'Cálculo Diferencial e Integral I', credits: 6, isCompleted: false },
            { id: 'flow_quim', name: 'Química Geral', credits: 4, isCompleted: false },
          ]
        }
      ]
    };

    // User deletes discipline named 'Cálculo 1' in the app
    const updated = CourseCRService.removeSubjectFromCurrentSemester(mockData, 'subj_app_different_id', 'Cálculo 1');

    const sem1 = updated.semesters[0];
    assert(sem1.subjects.length === 1, 'Semestre has 1 subject remaining');
    assert(sem1.subjects[0].name === 'Química Geral', 'Química Geral preserved');
    assert(!sem1.subjects.some(s => s.name.includes('Cálculo')), 'Cálculo was removed by normalized name match');
  });

  await test('Does not remove already completed historical subject if ID does not match', () => {
    const mockData: CourseProgressData = {
      courseName: 'Computação',
      totalRequiredCredits: 100,
      completedCredits: 30,
      baselineCR: 8.5,
      semesters: [
        {
          semesterNumber: 1,
          title: '1º Semestre (2025.1)',
          subjects: [
            { id: 'hist_calc1', name: 'Cálculo I', credits: 4, isCompleted: true, grade: 9.0 }
          ]
        },
        {
          semesterNumber: 2,
          title: '2º Semestre (2026.1)',
          subjects: [
            { id: 'active_calc2', name: 'Cálculo II', credits: 4, isCompleted: false }
          ]
        }
      ]
    };

    // Attempt to delete an active subject 'Cálculo I' with unrelated ID
    const updated = CourseCRService.removeSubjectFromCurrentSemester(mockData, 'new_temp_id', 'Cálculo I');

    // The completed subject in semester 1 must remain intact because it is already completed and in past semester
    const sem1 = updated.semesters.find(s => s.semesterNumber === 1);
    assert(sem1?.subjects.length === 1, 'Completed past subject preserved');
    assert(sem1?.subjects[0].id === 'hist_calc1', 'Historical Cálculo I is safe');
  });

  // --------------------------------------------------------------------------
  // SUITE 2: CourseCRService.closeActiveSemester (Semester closure)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Semester Closure & Consolidation ---');

  await test('Consolidates active subjects with grades and marks completion based on passGrade', () => {
    const baseData: CourseProgressData = {
      courseName: 'Engenharia de Software',
      totalRequiredCredits: 100,
      completedCredits: 10,
      baselineCR: 8.0,
      semesters: [
        {
          semesterNumber: 1,
          title: '1º Semestre',
          subjects: [
            { id: 'sub_1', name: 'Algoritmos', credits: 4, isCompleted: true, grade: 8.0 }
          ]
        }
      ]
    };

    const activeSubjects: Subject[] = [
      {
        id: 'active_1',
        name: 'Estrutura de Dados',
        workloadHours: 60,
        passGrade: 7.0,
        gradeGroups: [
          {
            id: 'g1',
            name: 'Provas',
            weight: 1.0,
            items: [
              { id: 'gr1', name: 'P1', grade: 8.0, weight: 1.0, maxGrade: 10 },
              { id: 'gr2', name: 'P2', grade: 9.0, weight: 1.0, maxGrade: 10 }
            ]
          }
        ]
      },
      {
        id: 'active_2',
        name: 'Banco de Dados',
        workloadHours: 60,
        passGrade: 7.0,
        gradeGroups: [
          {
            id: 'g2',
            name: 'Provas',
            weight: 1.0,
            items: [
              { id: 'gr3', name: 'P1', grade: 5.0, weight: 1.0, maxGrade: 10 },
              { id: 'gr4', name: 'P2', grade: 5.0, weight: 1.0, maxGrade: 10 }
            ]
          }
        ]
      }
    ];

    const result = CourseCRService.closeActiveSemester(baseData, activeSubjects, '2026.1', 7.0);

    assert(result.semesters.length === 2, 'New semester 2026.1 was appended');
    const closedSem = result.semesters.find(s => s.title === '2026.1');
    assert(!!closedSem, 'Found closed semester 2026.1');
    assert(closedSem?.subjects.length === 2, 'Closed semester contains 2 subjects');

    const ed = closedSem?.subjects.find(s => s.name === 'Estrutura de Dados');
    assert(ed?.isCompleted === true, 'Estrutura de Dados isCompleted: true (average 8.5 >= 7.0)');
    assert(ed?.grade === 8.5, 'Estrutura de Dados grade is 8.5');
    assert(ed?.credits === 4, 'Credits derived from 60h workload (60/15 = 4)');

    const bd = closedSem?.subjects.find(s => s.name === 'Banco de Dados');
    assert(bd?.isCompleted === false, 'Banco de Dados isCompleted: false (average 5.0 < 7.0)');
    assert(bd?.grade === 5.0, 'Banco de Dados grade is 5.0');

    // Check CR recalculation:
    // Sub 1: grade 8.0 * 4 = 32
    // ED: grade 8.5 * 4 = 34
    // Completed credits = 4 + 4 = 8 credits (BD was reproved so not counted as completed credits)
    assert(result.completedCredits === 8, 'Completed credits is exactly 8 (only passing subjects count)');
    assert(result.baselineCR > 0, 'Baseline CR was recalculated and is positive');
  });

  await test('Updates existing semester if period title already exists', () => {
    const baseData: CourseProgressData = {
      courseName: 'Sistemas',
      totalRequiredCredits: 80,
      completedCredits: 0,
      semesters: [
        {
          semesterNumber: 1,
          title: '2026.1',
          subjects: []
        }
      ]
    };

    const activeSubjects: Subject[] = [
      {
        id: 'sub_a',
        name: 'Programação Web',
        workloadHours: 60,
        passGrade: 6.0,
        gradeGroups: [
          {
            id: 'g1',
            name: 'Avaliações',
            weight: 1.0,
            items: [{ id: 'gr1', name: 'Final', grade: 8.0, weight: 1.0, maxGrade: 10 }]
          }
        ]
      }
    ];

    const result = CourseCRService.closeActiveSemester(baseData, activeSubjects, '2026.1', 6.0);

    assert(result.semesters.length === 1, 'Does not duplicate semester; updates existing');
    assert(result.semesters[0].subjects.length === 1, 'Semester now contains 1 closed subject');
    assert(result.semesters[0].subjects[0].name === 'Programação Web', 'Subject correctly inserted');
  });

  // --------------------------------------------------------------------------
  // SUITE 3: Full Subject Status Recognition in applyAIParsedTranscript
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 3: Full Subject Status (Approved, In Progress, Reproved, Dispensed) ---');

  await test('Correctly maps approved, in_progress, reproved, and dispensed subjects with status and semesterNumber', () => {
    const aiResult = {
      baselineCR: 7.95,
      subjects: [
        {
          name: 'Cálculo I',
          grade: 9.0,
          credits: 4,
          status: 'approved',
          isCompleted: true,
          semesterNumber: 1
        },
        {
          name: 'Álgebra Linear',
          credits: 4,
          status: 'dispensed',
          isCompleted: true,
          semesterNumber: 1
        },
        {
          name: 'Física I',
          grade: 3.5,
          credits: 4,
          status: 'reproved',
          isCompleted: false,
          semesterNumber: 2
        },
        {
          name: 'Estruturas de Dados',
          credits: 4,
          status: 'in_progress',
          isCompleted: false,
          semesterNumber: 2
        }
      ]
    };

    const emptyTemplate: CourseProgressData = {
      courseName: 'Ciência da Computação',
      totalRequiredCredits: 100,
      completedCredits: 0,
      baselineCR: 0,
      semesters: []
    };

    const updated = CourseCRService.applyAIParsedTranscript(aiResult, emptyTemplate);

    assert(updated.baselineCR === 7.95, 'baselineCR updated to 7.95');
    assert(updated.semesters.length === 2, 'Generated 2 semesters based on semesterNumber');

    const sem1 = updated.semesters.find(s => s.semesterNumber === 1);
    assert(!!sem1, '1º Semestre exists');
    assert(sem1?.subjects.length === 2, 'Semestre 1 has 2 subjects');

    const calc = sem1?.subjects.find(s => s.name === 'Cálculo I');
    assert(calc?.isCompleted === true, 'approved subject marked isCompleted: true');
    assert(calc?.grade === 9.0, 'approved subject has grade 9.0');

    const alg = sem1?.subjects.find(s => s.name === 'Álgebra Linear');
    assert(alg?.isCompleted === true, 'dispensed subject marked isCompleted: true');

    const sem2 = updated.semesters.find(s => s.semesterNumber === 2);
    assert(!!sem2, '2º Semestre exists');
    assert(sem2?.subjects.length === 2, 'Semestre 2 has 2 subjects');

    const fis = sem2?.subjects.find(s => s.name === 'Física I');
    assert(fis?.isCompleted === false, 'reproved subject marked isCompleted: false');
    assert(fis?.grade === 3.5, 'reproved subject has grade 3.5');

    const ed = sem2?.subjects.find(s => s.name === 'Estruturas de Dados');
    assert(ed?.isCompleted === false, 'in_progress subject marked isCompleted: false');

    // Verify completed credits only include approved and dispensed (4 + 4 = 8)
    assert(updated.completedCredits === 8, 'completedCredits is 8 (only approved + dispensed)');
  });

  await test('Routes unnumbered subjects into proper extension groups (Concluídas vs Andamento)', () => {
    const aiResult = {
      subjects: [
        { name: 'Optativa Concluída', grade: 9.0, credits: 2, status: 'approved' },
        { name: 'Optativa Cursando', credits: 2, status: 'in_progress' }
      ]
    };

    const updated = CourseCRService.applyAIParsedTranscript(aiResult, {
      courseName: 'Engenharia',
      totalRequiredCredits: 100,
      completedCredits: 0,
      semesters: []
    });

    const semCompleted = updated.semesters.find(s => s.title.toLowerCase().includes('concluídas'));
    assert(!!semCompleted, 'Extension group for completed subjects created');
    assert(semCompleted?.subjects.some(s => s.name === 'Optativa Concluída'), 'Contains Optativa Concluída');

    const semProgress = updated.semesters.find(s => s.title.toLowerCase().includes('andamento'));
    assert(!!semProgress, 'Extension group for in_progress subjects created');
    assert(semProgress?.subjects.some(s => s.name === 'Optativa Cursando'), 'Contains Optativa Cursando');
  });

  // --------------------------------------------------------------------------
  // SUITE 4: Document Parser Resilience & 90-Second Timeout
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 4: Document Parser Timeout & MIME Handling ---');

  await test('Verifies 90-second timeout in AIParsingService for heavy PDFs', () => {
    const serviceFilePath = path.resolve(__dirname, '../src/services/AIParsingService.ts');
    const content = fs.readFileSync(serviceFilePath, 'utf8');

    // Check that parseAcademicDocument uses 90000ms timeout
    const has90sTimeout = content.includes('AbortSignal.timeout(90000)');
    assert(has90sTimeout, 'AIParsingService sets AbortSignal.timeout(90000) for document parsing');
  });

  await test('Requires API Key for parseAcademicDocument and raises helpful error', async () => {
    const emptyConfig: AIConfig = {
      provider: 'gemini',
      apiKey: '',
      model: 'gemini-1.5-flash',
      autoSync: false,
      enableNotifications: true
    };

    let caughtError: any = null;
    try {
      await AIParsingService.parseAcademicDocument('mock_base64', 'application/pdf', 'transcript', emptyConfig);
    } catch (err) {
      caughtError = err;
    }

    assert(caughtError !== null, 'Throws error when API key is missing');
    assert(
      caughtError.message.includes('Chave de API do Lumen AI') || caughtError.message.includes('configurada'),
      'Error message clearly explains missing API key requirement'
    );
  });

  await test('Resolves MIME types robustly for multiple file formats', () => {
    assert(resolveDocumentMimeType('boletim.pdf') === 'application/pdf', 'Resolves .pdf');
    assert(resolveDocumentMimeType('foto.jpeg') === 'image/jpeg', 'Resolves .jpeg');
    assert(resolveDocumentMimeType('foto.jpg') === 'image/jpeg', 'Resolves .jpg as image/jpeg');
    assert(resolveDocumentMimeType('grade.png') === 'image/png', 'Resolves .png');
    assert(resolveDocumentMimeType('scan.webp') === 'image/webp', 'Resolves .webp');
    assert(resolveDocumentMimeType('scan.heic') === 'image/heic', 'Resolves .heic');
    assert(resolveDocumentMimeType('arquivo', 'image/jpg') === 'image/jpeg', 'Normalizes fallback image/jpg to image/jpeg');
  });

  console.log('\n================================================================');
  console.log(`📊 FINAL RESULTS: ${passedTests}/${totalTests} Tests Passed (${failedTests} Failed)`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
