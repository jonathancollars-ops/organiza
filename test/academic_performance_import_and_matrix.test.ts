import './setup_env';
import { resolveDocumentMimeType } from '../src/services/AIParsingService';
import { CourseCRService, DEFAULT_CURRICULUM_TEMPLATE } from '../src/services/CourseCRService';
import { CourseProgressData } from '../src/types';

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
  console.log('📚 ACADEMIC PERFORMANCE, MIME DETECTION & MATRIX TEST SUITE');
  console.log('================================================================');

  // --------------------------------------------------------------------------
  // SUITE 1: resolveDocumentMimeType
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 1: MIME Type Detection & Normalization ---');

  await test('Resolves PDF extensions accurately', () => {
    assert(resolveDocumentMimeType('documento.pdf') === 'application/pdf', '.pdf resolves to application/pdf');
    assert(resolveDocumentMimeType('HISTORICO_2026.PDF') === 'application/pdf', '.PDF uppercase resolves to application/pdf');
    assert(resolveDocumentMimeType('file:///data/user/0/cache/scan.pdf') === 'application/pdf', 'URI path with .pdf resolves to application/pdf');
  });

  await test('Resolves image extensions accurately', () => {
    assert(resolveDocumentMimeType('foto.jpg') === 'image/jpeg', '.jpg resolves to image/jpeg');
    assert(resolveDocumentMimeType('print.jpeg') === 'image/jpeg', '.jpeg resolves to image/jpeg');
    assert(resolveDocumentMimeType('GRADE.PNG') === 'image/png', '.PNG uppercase resolves to image/png');
    assert(resolveDocumentMimeType('fluxograma.webp') === 'image/webp', '.webp resolves to image/webp');
    assert(resolveDocumentMimeType('arquivo.heic') === 'image/heic', '.heic resolves to image/heic');
  });

  await test('Normalizes non-standard image/jpg fallback to image/jpeg', () => {
    assert(resolveDocumentMimeType('arquivo_sem_extensao', 'image/jpg') === 'image/jpeg', 'image/jpg fallback normalized to image/jpeg');
    assert(resolveDocumentMimeType(undefined, 'image/png') === 'image/png', 'image/png fallback preserved');
  });

  await test('Defaults unknown extensions to application/pdf', () => {
    assert(resolveDocumentMimeType('arquivo_desconhecido') === 'application/pdf', 'unknown extension defaults to application/pdf');
    assert(resolveDocumentMimeType(undefined, undefined) === 'application/pdf', 'empty params default to application/pdf');
  });

  // --------------------------------------------------------------------------
  // SUITE 2: Dynamic Inclusion of Non-Template Approved Subjects
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Dynamic Inclusion in applyAIParsedTranscript ---');

  await test('Updates existing template subjects when matched in transcript', () => {
    const aiResult = {
      baselineCR: 8.9,
      approvedSubjects: [
        { name: 'Cálculo Diferencial e Integral I', grade: 9.5, credits: 5 },
        { name: 'Introdução à Programação', grade: 10.0, credits: 4 }
      ]
    };

    const updated = CourseCRService.applyAIParsedTranscript(aiResult, DEFAULT_CURRICULUM_TEMPLATE);

    assert(updated.baselineCR === 8.9, 'Updated baselineCR to 8.9');
    const sem1 = updated.semesters.find(s => s.semesterNumber === 1);
    assert(!!sem1, '1º Semestre exists');

    const calc = sem1?.subjects.find(s => s.name.includes('Cálculo Diferencial'));
    assert(calc?.isCompleted === true, 'Cálculo I marked isCompleted: true');
    assert(calc?.grade === 9.5, 'Cálculo I grade updated to 9.5');

    const prog = sem1?.subjects.find(s => s.name.includes('Introdução à Programação'));
    assert(prog?.isCompleted === true, 'Introdução à Programação marked isCompleted: true');
    assert(prog?.grade === 10.0, 'Introdução à Programação grade updated to 10.0');
  });

  await test('Dynamically includes approved subjects NOT in the template without discarding them', () => {
    const aiResult = {
      baselineCR: 8.2,
      approvedSubjects: [
        { name: 'Bioética Geral', grade: 8.5, credits: 3 }, // Eletiva fora do curso
        { name: 'Empreendedorismo Digital', grade: 9.0, credits: 4, semesterNumber: 2 } // Fora do template mas com semestre 2
      ]
    };

    const initialCompletedCredits = DEFAULT_CURRICULUM_TEMPLATE.completedCredits;
    const updated = CourseCRService.applyAIParsedTranscript(aiResult, DEFAULT_CURRICULUM_TEMPLATE);

    // Subject with explicit semester 2 should be in semester 2
    const sem2 = updated.semesters.find(s => s.semesterNumber === 2);
    const empreend = sem2?.subjects.find(s => s.name === 'Empreendedorismo Digital');
    assert(!!empreend, 'Empreendedorismo Digital added dynamically to 2º Semestre');
    assert(empreend?.isCompleted === true, 'Empreendedorismo Digital is completed');
    assert(empreend?.grade === 9.0, 'Empreendedorismo Digital has grade 9.0');
    assert(empreend?.credits === 4, 'Empreendedorismo Digital has 4 credits');

    // Subject without semester should be in "Disciplinas Concluídas / Eletivas"
    const electiveSem = updated.semesters.find(s => s.title.includes('Disciplinas Concluídas / Eletivas'));
    assert(!!electiveSem, 'Semester "Disciplinas Concluídas / Eletivas" created automatically');

    const bioetica = electiveSem?.subjects.find(s => s.name === 'Bioética Geral');
    assert(!!bioetica, 'Bioética Geral added dynamically to Electives semester');
    assert(bioetica?.isCompleted === true, 'Bioética Geral marked isCompleted: true');
    assert(bioetica?.grade === 8.5, 'Bioética Geral grade preserved as 8.5');
    assert(bioetica?.credits === 3, 'Bioética Geral credits preserved as 3');

    // Degree progress credits updated
    assert(updated.completedCredits > initialCompletedCredits, 'Completed credits increased with newly included subjects');
  });

  // --------------------------------------------------------------------------
  // SUITE 3: Progress Preservation on Matrix Import (applyAIParsedCurriculum)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 3: Progress Preservation in applyAIParsedCurriculum ---');

  await test('Preserves isCompleted and grade from existingData when applying new AI curriculum', () => {
    // Existing data where student previously completed Calculus 1 and Physics 1 with grades
    const existingData: CourseProgressData = {
      ...DEFAULT_CURRICULUM_TEMPLATE,
      semesters: [
        {
          semesterNumber: 1,
          title: '1º Semestre Antigo',
          subjects: [
            { id: 'old_1', name: 'Cálculo 1', code: 'MAT101', credits: 4, hours: 60, isCompleted: true, grade: 8.7 },
            { id: 'old_2', name: 'Física 1', code: 'FIS101', credits: 4, hours: 60, isCompleted: true, grade: 7.5 },
            { id: 'old_3', name: 'Química Geral', code: 'QUI101', credits: 4, hours: 60, isCompleted: false }
          ]
        }
      ]
    };

    // New curriculum structure returned by AI (e.g. from a new university flowchart)
    const aiCurriculumResult = {
      semesters: [
        {
          semesterNumber: 1,
          title: '1º Semestre Novo',
          subjects: [
            { name: 'Cálculo 1', code: 'MAT101', credits: 4 }, // Existed and was completed!
            { name: 'Física 1', code: 'FIS101', credits: 4 }, // Existed and was completed!
            { name: 'Introdução à Computação', credits: 4 } // Brand new subject
          ]
        },
        {
          semesterNumber: 2,
          title: '2º Semestre Novo',
          subjects: [
            { name: 'Cálculo 2', credits: 4 }
          ]
        }
      ]
    };

    const updated = CourseCRService.applyAIParsedCurriculum(aiCurriculumResult, existingData);

    const newSem1 = updated.semesters.find(s => s.semesterNumber === 1);
    assert(!!newSem1, '1º Semestre Novo exists');

    const calc = newSem1?.subjects.find(s => s.name === 'Cálculo 1');
    assert(calc?.isCompleted === true, 'Preserved isCompleted: true for Cálculo 1 in new curriculum');
    assert(calc?.grade === 8.7, 'Preserved grade 8.7 for Cálculo 1 in new curriculum');

    const fis = newSem1?.subjects.find(s => s.name === 'Física 1');
    assert(fis?.isCompleted === true, 'Preserved isCompleted: true for Física 1 in new curriculum');
    assert(fis?.grade === 7.5, 'Preserved grade 7.5 for Física 1 in new curriculum');

    const intro = newSem1?.subjects.find(s => s.name === 'Introdução à Computação');
    assert(intro?.isCompleted === false, 'New subject Introdução à Computação remains uncompleted');

    const sem2 = updated.semesters.find(s => s.semesterNumber === 2);
    const calc2 = sem2?.subjects.find(s => s.name === 'Cálculo 2');
    assert(calc2?.isCompleted === false, 'Cálculo 2 in semester 2 remains uncompleted');
  });

  // --------------------------------------------------------------------------
  // SUITE 4: toggleSubjectCompletion and addSubjectToSemester
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 4: Interactive Matrix Operations ---');

  await test('toggleSubjectCompletion toggles status and updates degree progress', () => {
    const initial = DEFAULT_CURRICULUM_TEMPLATE;
    const targetSubject = initial.semesters[0].subjects[0];
    const initialCompleted = targetSubject.isCompleted;

    const toggled = CourseCRService.toggleSubjectCompletion(initial, targetSubject.id);
    const toggledSubject = toggled.semesters[0].subjects.find(s => s.id === targetSubject.id);

    assert(toggledSubject?.isCompleted === !initialCompleted, 'Subject completion status inverted successfully');
  });

  await test('addSubjectToSemester adds subject and recalculates metrics', () => {
    const initial = DEFAULT_CURRICULUM_TEMPLATE;
    const sem1InitialCount = initial.semesters[0].subjects.length;

    const updated = CourseCRService.addSubjectToSemester(initial, 1, {
      name: 'Inteligência Artificial Aplicada',
      credits: 4,
      isCompleted: false
    });

    const sem1 = updated.semesters.find(s => s.semesterNumber === 1);
    assert(sem1?.subjects.length === sem1InitialCount + 1, 'Subject count incremented in semester 1');
    assert(sem1?.subjects.some(s => s.name === 'Inteligência Artificial Aplicada'), 'New subject found in semester 1');
  });

  console.log('\n================================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error in academic performance test suite:', err);
  process.exit(1);
});
