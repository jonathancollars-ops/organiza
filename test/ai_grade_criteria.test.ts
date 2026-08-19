import { AIParsingService } from '../src/services/AIParsingService';
import { calculateFinalGrade } from '../src/components/GradeEngine';
import { ParsedSubjectCriteria } from '../src/types';

console.log('--- STARTING AI GRADE CRITERIA PARSER TESTS ---');

const PRESET_4_SUBJECTS = `1. Cálculo I:
Teremos duas provas teóricas (P1 peso 2 e P2 peso 3) e uma lista de exercícios semanal com peso 1. Média de corte para aprovação: 7.0. Terá exame final caso a média seja inferior a 7.0.

2. Algoritmos e Estruturas de Dados:
Avaliação composta por 3 provas (P1 peso 1, P2 peso 1, P3 peso 1) e um Projeto Prático Final com peso 2. Média mínima para passar direto: 6.0.

3. Física Geral I:
Composta por Prova 1 (peso 3), Prova 2 (peso 4) e Relatórios de Laboratório prático (peso 3). Média de corte: 7.0. Carga horária de 80h.

4. Álgebra Linear:
Teremos P1 (peso 1), P2 (peso 1) e Seminário de Aplicações (peso 1). Média para aprovação: 5.0. Carga horária de 60h.`;

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  console.log('\n[Test 1] Parsing 4 Subjects Criteria (Mock / Offline NLP)');
  const result = await AIParsingService.parseGradeCriteria(PRESET_4_SUBJECTS, null, [
    'Cálculo I',
    'Algoritmos e Estruturas de Dados',
    'Física Geral I',
    'Álgebra Linear'
  ]);

  assert(result.subjects.length === 4, `Expected 4 subjects parsed, got ${result.subjects.length}`);

  const calc1 = result.subjects.find(s => s.subjectName.toLowerCase().includes('cálculo') || s.subjectName.toLowerCase().includes('calculo'));
  assert(!!calc1, 'Cálculo I found in parsed subjects');
  if (calc1) {
    assert(calc1.passGrade === 7.0, `Cálculo I passGrade is 7.0 (got ${calc1.passGrade})`);
    const allItems = calc1.gradeGroups.flatMap(g => g.items);
    const p1 = allItems.find(i => i.name === 'P1');
    const p2 = allItems.find(i => i.name === 'P2');
    const finalExam = allItems.find(i => i.isFinalExam);
    assert(!!p1 && p1.weight === 2, `P1 weight is 2 (got ${p1?.weight})`);
    assert(!!p2 && p2.weight === 3, `P2 weight is 3 (got ${p2?.weight})`);
    assert(!!finalExam, 'Exame Final detected as isFinalExam: true');
  }

  const alg = result.subjects.find(s => s.subjectName.toLowerCase().includes('algoritmos'));
  assert(!!alg, 'Algoritmos found in parsed subjects');
  if (alg) {
    assert(alg.passGrade === 6.0, `Algoritmos passGrade is 6.0 (got ${alg.passGrade})`);
    const allItems = alg.gradeGroups.flatMap(g => g.items);
    assert(allItems.some(i => i.name === 'P1'), 'Algoritmos has P1');
    assert(allItems.some(i => i.name === 'P2'), 'Algoritmos has P2');
    assert(allItems.some(i => i.name === 'P3'), 'Algoritmos has P3');
    assert(allItems.some(i => i.name.includes('Projeto') && i.weight === 2), 'Algoritmos has Projeto Final with weight 2');
  }

  const fis = result.subjects.find(s => s.subjectName.toLowerCase().includes('física') || s.subjectName.toLowerCase().includes('fisica'));
  assert(!!fis, 'Física Geral I found in parsed subjects');
  if (fis) {
    assert(fis.passGrade === 7.0, `Física passGrade is 7.0 (got ${fis.passGrade})`);
    assert(fis.workloadHours === 80, `Física workloadHours is 80 (got ${fis.workloadHours})`);
    const allItems = fis.gradeGroups.flatMap(g => g.items);
    assert(allItems.some(i => i.name === 'P1' && i.weight === 3), 'Física has P1 weight 3');
    assert(allItems.some(i => i.name === 'P2' && i.weight === 4), 'Física has P2 weight 4');
  }

  const algLin = result.subjects.find(s => s.subjectName.toLowerCase().includes('álgebra') || s.subjectName.toLowerCase().includes('algebra'));
  assert(!!algLin, 'Álgebra Linear found in parsed subjects');
  if (algLin) {
    assert(algLin.passGrade === 5.0, `Álgebra Linear passGrade is 5.0 (got ${algLin.passGrade})`);
  }

  console.log('\n[Test 2] Grade Calculation Verification for Cálculo I');
  if (calc1) {
    // Simulating grades: P1 = 8.0 (peso 2), P2 = 6.0 (peso 3), Lista = 10.0 (peso 1)
    // Weighted avg: (8*2 + 6*3 + 10*1) / (2+3+1) = (16 + 18 + 10) / 6 = 44 / 6 = 7.33
    const groups = JSON.parse(JSON.stringify(calc1.gradeGroups));
    groups[0].items.forEach((it: any) => {
      if (it.name === 'P1') it.grade = 8.0;
      if (it.name === 'P2') it.grade = 6.0;
      if (it.name.includes('Lista')) it.grade = 10.0;
    });

    const calcRes = calculateFinalGrade(groups, calc1.passGrade);
    assert(Math.abs(calcRes.score - 7.33) < 0.05, `Calculated grade is ~7.33 (got ${calcRes.score.toFixed(2)})`);
    assert(calcRes.score >= calc1.passGrade, 'Student is approved (score >= 7.0)');
    assert(!calcRes.inFinal, 'Student is not in final exam');
  }

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
