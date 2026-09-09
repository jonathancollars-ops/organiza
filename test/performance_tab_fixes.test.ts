import './setup_env';
import * as fs from 'fs';
import * as path from 'path';
import { CourseCRService } from '../src/services/CourseCRService';
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
  console.log('🎯 PERFORMANCE TAB FIXES & DIRECT DELETION TEST SUITE');
  console.log('================================================================');

  await test('Removes a subject directly from any semester by its exact ID', () => {
    const mockData: CourseProgressData = {
      courseName: 'Engenharia de Software',
      totalRequiredCredits: 160,
      completedCredits: 20,
      baselineCR: 8.0,
      semesters: [
        {
          semesterNumber: 1,
          title: '1º Semestre',
          subjects: [
            { id: 'sub_1', name: 'Algoritmos', credits: 4, isCompleted: true, grade: 8.5 },
            { id: 'sub_2_to_delete', name: 'Matemática Discreta', credits: 4, isCompleted: false }
          ]
        },
        {
          semesterNumber: 2,
          title: '2º Semestre',
          subjects: [
            { id: 'sub_3', name: 'Banco de Dados', credits: 4, isCompleted: false }
          ]
        }
      ]
    };

    const updated = CourseCRService.removeSubjectFromCurriculum(mockData, 'sub_2_to_delete', 'Matemática Discreta');
    const sem1 = updated.semesters.find(s => s.semesterNumber === 1);
    assert(!!sem1, 'Semestre 1 exists');
    assert(sem1?.subjects.length === 1, 'Semestre 1 has 1 subject remaining');
    assert(sem1?.subjects[0].id === 'sub_1', 'sub_1 is preserved');
    assert(!sem1?.subjects.some(s => s.id === 'sub_2_to_delete'), 'sub_2_to_delete was successfully purged');
  });

  await test('Removes completed or uncompleted subject when user directly clicks delete in curriculum', () => {
    const mockData: CourseProgressData = {
      courseName: 'Engenharia',
      totalRequiredCredits: 200,
      completedCredits: 40,
      baselineCR: 8.2,
      semesters: [
        {
          semesterNumber: 1,
          title: '1º Semestre',
          subjects: [
            { id: 'sub_completed_delete', name: 'Química Teórica', credits: 4, isCompleted: true, grade: 7.0 }
          ]
        }
      ]
    };

    const updated = CourseCRService.removeSubjectFromCurriculum(mockData, 'sub_completed_delete');
    assert(updated.semesters[0].subjects.length === 0, 'Subject was deleted even if completed when ID matches directly');
  });

  await test('Verifies AcademicPerformanceScreen imports expo-file-system/legacy', () => {
    const filePath = path.join(__dirname, '../src/screens/AcademicPerformanceScreen.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert(
      content.includes("from 'expo-file-system/legacy'"),
      "AcademicPerformanceScreen imports from 'expo-file-system/legacy'"
    );
    assert(
      !content.includes("from 'expo-file-system';"),
      "AcademicPerformanceScreen does NOT import from deprecated 'expo-file-system' root"
    );
  });

  await test('Verifies Header uncluttered and subject delete button present', () => {
    const filePath = path.join(__dirname, '../src/screens/AcademicPerformanceScreen.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert(content.includes('headerTitleContainer'), 'headerTitleContainer exists for responsive title layout');
    assert(content.includes('numberOfLines={1}'), 'headerTitle uses numberOfLines={1} to prevent squashing');
    assert(content.includes('handleDeleteCurriculumSubject'), 'handleDeleteCurriculumSubject handler is implemented');
    assert(content.includes('subjectDeleteBtn'), 'subjectDeleteBtn style and component are present');
  });

  console.log('\n================================================================');
  console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} Tests Passed (${failedTests} Failed)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
