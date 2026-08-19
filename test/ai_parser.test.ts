import './setup_env';
import { AIParsingService, ParsingContext } from '../src/services/AIParsingService';
import { AIConfig, AIParsedItem } from '../src/types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureDetails: string[] = [];

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    const msg = `  [FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`;
    console.error(msg);
    failureDetails.push(msg);
  }
}

function assertEqual<T>(actual: T, expected: T, testName: string) {
  const match = JSON.stringify(actual) === JSON.stringify(expected);
  assert(match, testName, `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

export async function runAIParserTests() {
  console.log('================================================================');
  console.log('AI PARSER UNIT & INTEGRATION TEST SUITE');
  console.log('================================================================\n');

  const context: ParsingContext = {
    currentDate: '2026-08-17',
    currentDayOfWeek: 'Segunda-feira',
    registeredSubjects: ['Cálculo 1', 'Algoritmos e Estruturas', 'Física I']
  };

  // 1. System Prompt Construction
  console.log('--- 1. System Prompt Construction ---');
  const prompt = AIParsingService.buildSystemPrompt(context);
  assert(prompt.includes('2026-08-17'), 'Prompt includes reference date');
  assert(prompt.includes('Segunda-feira'), 'Prompt includes day of week');
  assert(prompt.includes('Cálculo 1'), 'Prompt includes registered subjects');
  assert(prompt.includes('cancelled_class'), 'Prompt specifies cancelled_class intent');
  assert(prompt.includes('10080, 1440'), 'Prompt specifies standard alert offsets');

  // Empty subjects in context
  const emptyContextPrompt = AIParsingService.buildSystemPrompt({
    currentDate: '2026-08-17',
    currentDayOfWeek: 'Monday',
    registeredSubjects: []
  });
  assert(emptyContextPrompt.includes('Nenhuma matéria previamente cadastrada'), 'Prompt handles empty subjects list');

  // 2. Empty / Whitespace Parsing
  console.log('\n--- 2. Empty & Whitespace Input Handling ---');
  const emptyResult = await AIParsingService.parseMessage('', null, context);
  assertEqual(emptyResult.items, [], 'Empty message yields empty items array');
  assert(emptyResult.confidence === 1.0, 'Empty message has 1.0 confidence');

  const whitespaceResult = await AIParsingService.parseMessage('   \n\t  ', null, context);
  assertEqual(whitespaceResult.items, [], 'Whitespace-only message yields empty items array');

  // 3. Deterministic Mock Parser - Cancellation
  console.log('\n--- 3. Mock Parser: Class Cancellation ---');
  const cancelMsg = 'Aviso aos alunos de Cálculo 1: Excepcionalmente não teremos aula hoje (2026-08-17). Prof. Carlos';
  const cancelRes = AIParsingService.parseMessageMock(cancelMsg, context);
  assert(cancelRes.items.length === 1, 'Cancellation message yields 1 item');
  assert(cancelRes.items[0].intent === 'cancelled_class', 'Intent is cancelled_class');
  assert(cancelRes.items[0].targetDate === '2026-08-17', 'Target date is 2026-08-17');
  assert(cancelRes.items[0].subjectName === 'Cálculo 1', 'Subject is Cálculo 1');
  assertEqual(cancelRes.items[0].alerts, [10080, 1440], 'Alerts are [10080, 1440]');

  // 4. Deterministic Mock Parser - Homework
  console.log('\n--- 4. Mock Parser: Homework ---');
  const hwMsg = 'Turma de Algoritmos e Estruturas, publiquei a Lista de Exercícios 3. Entrega dia 2026-08-24 às 23:59.';
  const hwRes = AIParsingService.parseMessageMock(hwMsg, context);
  assert(hwRes.items.length === 1, 'Homework message yields 1 item');
  assert(hwRes.items[0].intent === 'homework', 'Intent is homework');
  assert(hwRes.items[0].targetDate === '2026-08-24', 'Target date is 2026-08-24');
  assert(hwRes.items[0].startTime === '23:59', 'Deadline time is 23:59');
  assert(hwRes.items[0].subjectName === 'Algoritmos e Estruturas', 'Subject matched accurately');
  assertEqual(hwRes.items[0].alerts, [10080, 1440], 'Alerts are [10080, 1440]');

  // 5. Deterministic Mock Parser - Exam
  console.log('\n--- 5. Mock Parser: Exam ---');
  const examMsg = 'Atenção pessoal de Física I: a nossa Prova P2 foi agendada para o dia 2026-08-28 das 08:00 às 10:00.';
  const examRes = AIParsingService.parseMessageMock(examMsg, context);
  assert(examRes.items.length === 1, 'Exam message yields 1 item');
  assert(examRes.items[0].intent === 'exam', 'Intent is exam');
  assert(examRes.items[0].targetDate === '2026-08-28', 'Target date is 2026-08-28');
  assert(examRes.items[0].startTime === '08:00', 'Start time is 08:00');
  assert(examRes.items[0].endTime === '10:00', 'End time is 10:00');
  assert(examRes.items[0].subjectName === 'Física I', 'Subject matched Física I');
  assertEqual(examRes.items[0].alerts, [10080, 1440], 'Alerts are [10080, 1440]');

  // 6. Non-actionable Informational Message
  console.log('\n--- 6. Mock Parser: Non-Actionable Message ---');
  const infoMsg = 'Bom dia a todos! Desejo um excelente semestre acadêmico!';
  const infoRes = AIParsingService.parseMessageMock(infoMsg, context);
  assert(infoRes.items.length === 1, 'Info message returns 1 item');
  assert(infoRes.items[0].intent === 'none', 'Intent is none');
  assertEqual(infoRes.items[0].alerts, [], 'No alerts configured for none intent');

  // 7. cleanAndValidateJson Robustness
  console.log('\n--- 7. JSON Response Cleaning & Normalization ---');
  const markdownJson = '```json\n{\n  "items": [\n    {\n      "intent": "exam",\n      "subjectName": "cálculo 1",\n      "title": "Prova P1",\n      "targetDate": "2026-09-10",\n      "startTime": "10:00",\n      "endTime": "12:00",\n      "alerts": [10080, 1440]\n    }\n  ],\n  "confidence": 0.98\n}\n```';
  const cleanRes = AIParsingService.cleanAndValidateJson(markdownJson, context);
  assert(cleanRes.items.length === 1, 'Extracted 1 item from markdown code block');
  assert(cleanRes.items[0].intent === 'exam', 'Intent parsed from JSON is exam');
  assert(cleanRes.items[0].subjectName === 'Cálculo 1', 'Case-insensitive matched subject name to registered casing');
  assert(cleanRes.confidence === 0.98, 'Confidence field preserved');

  // Invalid JSON fallback
  const invalidJson = 'Not a valid JSON payload string';
  const fallbackRes = AIParsingService.cleanAndValidateJson(invalidJson, context);
  assert(fallbackRes.items.length > 0, 'Invalid JSON falls back gracefully to regex/mock parser without exception');

  console.log('\n================================================================');
  console.log(`AI PARSER TESTS SUMMARY: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    throw new Error(`${failedTests} AI Parser tests failed.`);
  }
}

if (require.main === module) {
  runAIParserTests().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
