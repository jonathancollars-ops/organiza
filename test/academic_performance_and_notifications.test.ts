import './setup_env';
import { CourseCRService, DEFAULT_CURRICULUM_TEMPLATE } from '../src/services/CourseCRService';
import { Subject } from '../src/types';
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${msg}`);
    failed++;
  }
}

console.log('================================================================');
console.log('ACADEMIC PERFORMANCE & NOTIFICATION ICON VERIFICATION SUITE');
console.log('================================================================\n');

// 1. Test notification icon asset existence and size
console.log('--- 1. Notification Icon & Configuration Verification ---');
const iconPath = path.resolve(__dirname, '../assets/notification-icon.png');
assert(fs.existsSync(iconPath), 'assets/notification-icon.png exists on filesystem');
const stats = fs.statSync(iconPath);
assert(stats.size > 100, `notification-icon.png has valid byte size (${stats.size} bytes)`);

const appJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../app.json'), 'utf-8'));
const notifPlugin = appJson.expo.plugins.find((p: any) => Array.isArray(p) && p[0] === 'expo-notifications');
assert(notifPlugin !== undefined, 'expo-notifications plugin configured in app.json');
assert(notifPlugin[1].icon === './assets/notification-icon.png', 'expo-notifications icon points to ./assets/notification-icon.png');
assert(notifPlugin[1].color === '#00FFAA', 'expo-notifications accent color is #00FFAA');

// 2. Test Curriculum Matrix Parsing
console.log('\n--- 2. Curriculum Matrix (Fluxograma) Parsing ---');
const sampleMatrix = `
1º Semestre
Cálculo I 5 cr 80h Aprovado
Física I 4 cr 60h Aprovado
Algoritmos 4 cr 60h

2º Semestre
Cálculo II 5 cr 80h
Estrutura de Dados 4 cr 60h
Física II 4 cr 60h

3º Semestre
Cálculo III 4 cr 60h
Banco de Dados 4 cr 60h
`;

const parsedMatrix = CourseCRService.parseCurriculumMatrixText(sampleMatrix);
assert(parsedMatrix.semesters.length === 3, `Parsed exactly 3 semesters (got ${parsedMatrix.semesters.length})`);
assert(parsedMatrix.semesters[0].subjects.length === 3, '1º Semestre has 3 subjects');
assert(parsedMatrix.semesters[0].subjects[0].name.includes('Cálculo I'), 'First subject is Cálculo I');
assert(parsedMatrix.semesters[0].subjects[0].isCompleted === true, 'Cálculo I marked as completed');
assert(parsedMatrix.semesters[1].subjects.length === 3, '2º Semestre has 3 subjects');
assert(parsedMatrix.semesters[2].subjects.length === 2, '3º Semestre has 2 subjects');

// 3. Test Degree Progress Calculation with Parsed Matrix
console.log('\n--- 3. Degree Progress Calculation ---');
const progress = CourseCRService.calculateDegreeProgress(parsedMatrix);
assert(progress.completedSubjectsCount === 2, `Completed subjects count is 2 (got ${progress.completedSubjectsCount})`);
assert(progress.totalSubjectsCount === 8, `Total subjects count is 8 (got ${progress.totalSubjectsCount})`);
assert(progress.completedCredits === 9, `Completed credits is 9 (got ${progress.completedCredits})`);
assert(progress.completionPercentage > 0, `Completion % is calculated (${progress.completionPercentage}%)`);

// 4. Test Final Exam Calculator (Calculadora de Prova Final)
console.log('\n--- 4. Final Exam Requirement Calculation ---');
// Case A: Student has average 8.5 (already approved)
const resApproved = CourseCRService.calculateFinalExamRequirement(8.5, 7.0);
assert(resApproved.status === 'approved', 'Grade 8.5 results in approved status');
assert(resApproved.neededGrade === 0, 'Needed grade in final is 0');

// Case B: Student has average 5.0 (needs exam)
const resExam = CourseCRService.calculateFinalExamRequirement(5.0, 7.0, 5.0);
assert(resExam.status === 'final_exam', 'Grade 5.0 results in final_exam status');
assert(resExam.neededGrade === 5.0, `Needed grade in final is 5.0 (got ${resExam.neededGrade})`);

// Case C: Student has average 1.0 (reproved straight)
const resReproved = CourseCRService.calculateFinalExamRequirement(1.0, 7.0, 5.0);
assert(resReproved.status === 'reproved', 'Grade 1.0 results in reproved status (needed > 10.0)');

// 5. Test What-If Simulations with Custom Target
console.log('\n--- 5. What-If Simulation Scenarios ---');
const mockSubjects: Subject[] = [
  {
    id: 'sub_test_1',
    name: 'Cálculo Numérico',
    color: '#3B82F6',
    teacher: 'Prof. Silva',
    room: 'Lab 01',
    workloadHours: 80,
    maxAbsences: 20,
    passGrade: 7.0,
    gradeGroups: [
      { id: 'g1', name: 'Provas', weight: 100, items: [{ id: 'i1', name: 'P1', value: 8.0 }] }
    ]
  }
];

const simResult = CourseCRService.simulateCRScenarios(DEFAULT_CURRICULUM_TEMPLATE, mockSubjects);
assert(simResult.scenarios.length === 4, 'Generates 4 What-If scenarios');
const worstCase = simResult.scenarios.find(s => s.type === 'worst_case');
assert(worstCase !== undefined, 'Worst-case scenario exists');
const bestCase = simResult.scenarios.find(s => s.type === 'best_case');
assert(bestCase !== undefined, 'Best-case scenario exists');
assert(bestCase!.projectedCR >= worstCase!.projectedCR, 'Best case projected CR >= Worst case projected CR');

console.log('\n================================================================');
console.log(`SUMMARY: ${passed}/${passed + failed} Tests Passed (${failed} Failed)`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
