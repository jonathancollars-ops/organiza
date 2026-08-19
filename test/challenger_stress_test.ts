import { TeamsService } from '../src/services/TeamsService';
import { AIParsingService, ParsingContext } from '../src/services/AIParsingService';
import { AIParsedItem, AIIntent } from '../src/types';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string, details?: any) {
  if (!condition) {
    throw new Error(`${message}${details ? ' -> ' + JSON.stringify(details) : ''}`);
  }
}

function runTest(suite: string, name: string, fn: () => void) {
  try {
    fn();
    results.push({ suite, name, passed: true });
    console.log(`  [PASS] ${name}`);
  } catch (err: any) {
    results.push({ suite, name, passed: false, error: err.message, details: err });
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

console.log('================================================================');
console.log('CHALLENGER M1: EMPIRICAL ADVERSARIAL STRESS TEST SUITE');
console.log('================================================================\n');

// ============================================================================
// SUITE 1: TeamsService.sanitizeHtmlMessage
// ============================================================================
console.log('--- SUITE 1: TeamsService.sanitizeHtmlMessage ---');

runTest('HTML Sanitizer', 'Handles empty, null, undefined, and non-string inputs safely', () => {
  assert(TeamsService.sanitizeHtmlMessage('') === '', 'Empty string should return empty');
  assert(TeamsService.sanitizeHtmlMessage(null as any) === '', 'Null should return empty');
  assert(TeamsService.sanitizeHtmlMessage(undefined as any) === '', 'Undefined should return empty');
  assert(TeamsService.sanitizeHtmlMessage(12345 as any) === '', 'Non-string should return empty');
  assert(TeamsService.sanitizeHtmlMessage({} as any) === '', 'Object should return empty');
});

runTest('HTML Sanitizer', 'Strips simple and complex <script> tags completely', () => {
  const input1 = '<p>Aviso importante</p><script>alert("XSS Attack!");</script><p>Fim do aviso</p>';
  const res1 = TeamsService.sanitizeHtmlMessage(input1);
  assert(!res1.includes('alert'), 'Should strip script content', { res1 });
  assert(!res1.includes('<script>'), 'Should strip script tags', { res1 });
  assert(res1.includes('Aviso importante') && res1.includes('Fim do aviso'), 'Should keep surrounding text');

  const input2 = '<SCRIPT SRC="http://evil.com/xss.js" type="text/javascript">var bad = 1;</SCRIPT>Texto seguro';
  const res2 = TeamsService.sanitizeHtmlMessage(input2);
  assert(!res2.includes('evil.com') && !res2.includes('bad'), 'Case-insensitive script with src should be stripped', { res2 });
  assert(res2 === 'Texto seguro', 'Only clean text should remain', { res2 });

  const input3 = '<script>if (a < b && c > d) { evil(); }</script>Texto apos script';
  const res3 = TeamsService.sanitizeHtmlMessage(input3);
  assert(!res3.includes('evil()'), 'Script with internal angle brackets must be stripped', { res3 });
  assert(res3 === 'Texto apos script', 'Clean text remained', { res3 });

  const input4 = '<script type="module">\nconst x = 1;\nfetch("/api/leak");\n</script>Aula normal';
  const res4 = TeamsService.sanitizeHtmlMessage(input4);
  assert(!res4.includes('leak') && res4 === 'Aula normal', 'Multiline script stripped');
});

runTest('HTML Sanitizer', 'Strips <style> tags and inline CSS definitions completely', () => {
  const input1 = '<style type="text/css">body { color: red; background: url("hack.png"); }</style><p>Mensagem do professor</p>';
  const res1 = TeamsService.sanitizeHtmlMessage(input1);
  assert(!res1.includes('background') && !res1.includes('color'), 'Style content must be stripped', { res1 });
  assert(res1 === 'Mensagem do professor', 'Clean paragraph text remained', { res1 });

  const input2 = '<STYLE>@keyframes slide { from {left: 0;} to {left: 100px;} }</STYLE>Texto da aula';
  const res2 = TeamsService.sanitizeHtmlMessage(input2);
  assert(!res2.includes('keyframes') && res2 === 'Texto da aula', 'Uppercase style tag stripped');
});

runTest('HTML Sanitizer', 'Strips HTML event handler attributes and dangerous tags (img, iframe, svg, onclick)', () => {
  const input = '<img src="invalid" onerror="alert(\'XSS\')" /><svg onload="stealCookie()"><circle cx="50" cy="50" r="40" /></svg><a href="javascript:void(0)" onclick="evil()">Clique aqui</a><iframe src="evil.html"></iframe>';
  const res = TeamsService.sanitizeHtmlMessage(input);
  assert(!res.includes('onerror') && !res.includes('alert'), 'Should strip onerror/alert', { res });
  assert(!res.includes('stealCookie'), 'Should strip svg onload payload', { res });
  assert(!res.includes('javascript:'), 'Should strip anchor tag', { res });
  assert(!res.includes('iframe') && !res.includes('evil.html'), 'Should strip iframe tag', { res });
  assert(res.includes('Clique aqui'), 'Should preserve inner text of anchor', { res });
});

runTest('HTML Sanitizer', 'Handles deeply nested tags (100+ levels of div/p/table) without crashing', () => {
  let nested = 'Mensagem Central';
  for (let i = 0; i < 120; i++) {
    nested = `<div class="level-${i}"><p><span><table><tr><td>${nested}</td></tr></table></span></p></div>`;
  }
  const res = TeamsService.sanitizeHtmlMessage(nested);
  assert(res === 'Mensagem Central', 'Deeply nested tags should collapse to central text', { res });
});

runTest('HTML Sanitizer', 'Handles corrupted, unclosed, and mismatched HTML tags gracefully', () => {
  const broken1 = '<div class="alerta"<span style="color:red">Texto quebrado</div>';
  const res1 = TeamsService.sanitizeHtmlMessage(broken1);
  assert(typeof res1 === 'string' && res1.length > 0, 'Should not crash on malformed open tag', { res1 });

  const broken2 = '<<<<div>>>>Texto com multiplos colchetes<<<</div>>>>';
  const res2 = TeamsService.sanitizeHtmlMessage(broken2);
  assert(res2.includes('Texto com multiplos colchetes'), 'Should extract text despite angle bracket madness', { res2 });

  const broken3 = 'Nota: 10 < 20 e 50 > 30 na prova de Matematica.';
  const res3 = TeamsService.sanitizeHtmlMessage(broken3);
  assert(typeof res3 === 'string', 'Should handle raw comparison operators');
});

runTest('HTML Sanitizer', 'Decodes comprehensive named Portuguese and HTML entities accurately', () => {
  const input = '&Aacute;gua, informa&ccedil;&atilde;o &amp; c&oacute;digo &lt;b&gt;n&atilde;o&lt;/b&gt; &quot;falham&quot;&nbsp;hoje. ' +
                '&Eacute;poca de &Iacute;ndices &Oacute;timos e &Uacute;teis. Aten&ccedil;&atilde;o &agrave; regra &acirc;ncora &ecirc;xito &ocirc;nibus.';
  const res = TeamsService.sanitizeHtmlMessage(input);
  assert(res.includes('Água'), 'Decodes &Aacute;', { res });
  assert(res.includes('informação'), 'Decodes &ccedil;&atilde;', { res });
  assert(res.includes('&'), 'Decodes &amp;', { res });
  assert(res.includes('código'), 'Decodes &oacute;', { res });
  assert(res.includes('"falham"'), 'Decodes &quot;', { res });
  assert(res.includes('não'), 'Decodes &atilde;', { res });
  assert(res.includes('Época'), 'Decodes &Eacute;', { res });
  assert(res.includes('Índices'), 'Decodes &Iacute;', { res });
  assert(res.includes('Ótimos'), 'Decodes &Oacute;', { res });
  assert(res.includes('Úteis'), 'Decodes &Uacute;', { res });
  assert(res.includes('à'), 'Decodes &agrave;', { res });
  assert(res.includes('âncora'), 'Decodes &acirc;', { res });
  assert(res.includes('êxito'), 'Decodes &ecirc;', { res });
  assert(res.includes('ônibus'), 'Decodes &ocirc;', { res });
});

runTest('HTML Sanitizer', 'Decodes numeric decimal (&#225;) and hex (&#xE1;) entities properly', () => {
  const input = 'C&#225;lculo 1: prova no dia &#x32;&#x35;/&#x30;&#x38;. Voc&#234;s est&#227;o prontos? &#193;rea &#xE9; &#xED;mpar.';
  const res = TeamsService.sanitizeHtmlMessage(input);
  assert(res.includes('Cálculo 1'), 'Decodes decimal &#225; to á', { res });
  assert(res.includes('25/08'), 'Decodes hex digits &#x32;&#x35;/&#x30;&#x38; to 25/08', { res });
  assert(res.includes('Você'), 'Decodes decimal &#234; to ê', { res });
  assert(res.includes('estão'), 'Decodes decimal &#227; to ã', { res });
  assert(res.includes('Área'), 'Decodes decimal &#193; to Á', { res });
  assert(res.includes('é'), 'Decodes hex &#xE9; to é', { res });
  assert(res.includes('ímpar'), 'Decodes hex &#xED; to í', { res });
});

runTest('HTML Sanitizer', 'Normalizes whitespace and formats block linebreaks correctly', () => {
  const input = '  <p>Linha 1</p> \n\n <br/><br/> <p>Linha 2</p>  <div> Linha 3 \t\t com tabs </div>  ';
  const res = TeamsService.sanitizeHtmlMessage(input);
  const lines = res.split('\n');
  assert(lines.length >= 3, 'Should format block tags into separate lines', { res, lines });
  assert(res.includes('Linha 1') && res.includes('Linha 2') && res.includes('Linha 3 com tabs'), 'Whitespace inside lines normalized', { res });
  assert(!res.includes('\n\n\n'), 'Should collapse 3+ consecutive newlines', { res });
});

runTest('HTML Sanitizer', 'Resists ReDoS with pathological unclosed script and tag inputs', () => {
  const startTime = Date.now();
  const evilInput1 = '<script ' + '<a '.repeat(500) + 'text after';
  const res1 = TeamsService.sanitizeHtmlMessage(evilInput1);

  const evilInput2 = '<style ' + '<b '.repeat(500) + 'body { color: blue; }';
  const res2 = TeamsService.sanitizeHtmlMessage(evilInput2);

  const elapsed = Date.now() - startTime;
  assert(elapsed < 1000, `ReDoS check: took ${elapsed}ms (should be < 1000ms)`);
  assert(typeof res1 === 'string' && typeof res2 === 'string', 'Returned valid strings');
});


// ============================================================================
// SUITE 2: AIParsingService.parseMessageMock
// ============================================================================
console.log('\n--- SUITE 2: AIParsingService.parseMessageMock ---');

const baseContext: ParsingContext = {
  currentDate: '2026-08-17',
  currentDayOfWeek: 'Segunda-feira',
  registeredSubjects: ['Cálculo 1', 'Algoritmos', 'Física I']
};

runTest('Mock Parser', 'Correctly parses Canonical Message 1 (Cálculo 1 cancellation)', () => {
  const msg = "Aviso aos alunos de Cálculo 1: Excepcionalmente não teremos aula hoje (2026-08-17) devido à minha participação em banca acadêmica. O conteúdo será reposto na próxima semana. Prof. Carlos";
  const result = AIParsingService.parseMessageMock(msg, baseContext);
  
  assert(result.items.length === 1, 'Should have 1 item');
  const item = result.items[0];
  assert(item.intent === 'cancelled_class', 'Intent must be cancelled_class', item);
  assert(item.subjectName === 'Cálculo 1', 'Subject must be Cálculo 1', item);
  assert(item.targetDate === '2026-08-17', 'Date must be 2026-08-17', item);
  assert(item.alerts.length === 2 && item.alerts[0] === 10080 && item.alerts[1] === 1440, 'Alerts should be [10080, 1440]');
});

runTest('Mock Parser', 'Correctly parses Canonical Message 2 (Algoritmos homework)', () => {
  const msg = "Turma de Algoritmos, publiquei no AVA a Lista de Exercícios 3 sobre Árvores Binárias. O prazo final de entrega é dia 2026-08-24 às 23:59. Não deixem para a última hora!";
  const result = AIParsingService.parseMessageMock(msg, baseContext);

  assert(result.items.length === 1, 'Should have 1 item');
  const item = result.items[0];
  assert(item.intent === 'homework', 'Intent must be homework', item);
  assert(item.subjectName === 'Algoritmos', 'Subject must be Algoritmos', item);
  assert(item.targetDate === '2026-08-24', 'Date must be 2026-08-24', item);
  assert(item.startTime === '23:59', 'Time must be 23:59', item);
  assert(item.alerts.includes(10080) && item.alerts.includes(1440), 'Alerts must include 10080 and 1440');
});

runTest('Mock Parser', 'Correctly parses Canonical Message 3 (Física I exam)', () => {
  const msg = "Atenção pessoal de Física I: a nossa Prova P2 foi reagendada para o dia 2026-08-28 no horário normal da aula (08:00 às 10:00). Tragam calculadora científica.";
  const result = AIParsingService.parseMessageMock(msg, baseContext);

  assert(result.items.length === 1, 'Should have 1 item');
  const item = result.items[0];
  assert(item.intent === 'exam', 'Intent must be exam', item);
  assert(item.subjectName === 'Física I', 'Subject must be Física I', item);
  assert(item.targetDate === '2026-08-28', 'Date must be 2026-08-28', item);
  assert(item.startTime === '08:00' && item.endTime === '10:00', 'Time range must be 08:00 to 10:00', item);
  assert(item.alerts.includes(10080) && item.alerts.includes(1440), 'Alerts must include 10080 and 1440');
});

runTest('Mock Parser', 'Correctly parses alternative Portuguese cancellation phrasing', () => {
  const testCases = [
    { msg: "Pessoal de Calculo 1, aula cancelada amanhã por motivo de saúde.", expectedDate: '2026-08-18' },
    { msg: "Informo aos alunos de Física I a dispensa da aula do dia 25/08/2026.", expectedDate: '2026-08-25' },
    { msg: "Turma de Algoritmos: aulas suspensas no dia 2026-09-02.", expectedDate: '2026-09-02' },
    { msg: "Não haverá aula de Cálculo 1 hoje.", expectedDate: '2026-08-17' },
    { msg: "Sem aula de Física I amanhã.", expectedDate: '2026-08-18' }
  ];

  for (const tc of testCases) {
    const res = AIParsingService.parseMessageMock(tc.msg, baseContext);
    assert(res.items.length === 1, `Must return 1 item for: "${tc.msg}"`);
    assert(res.items[0].intent === 'cancelled_class', `Must detect cancelled_class for: "${tc.msg}"`, res.items[0]);
    assert(res.items[0].targetDate === tc.expectedDate, `Must extract target date ${tc.expectedDate} for: "${tc.msg}"`, res.items[0]);
  }
});

runTest('Mock Parser', 'Correctly parses alternative Portuguese homework phrasing', () => {
  const testCases = [
    { msg: "Alunos de Algoritmos, entregar Trabalho 1 no AVA até 2026-09-05 às 23:59.", expectedIntent: 'homework', expectedDate: '2026-09-05' },
    { msg: "Cálculo 1: publicar a resolução da Lista de Exercícios 1 até 10/09/2026.", expectedIntent: 'homework', expectedDate: '2026-09-10' },
    { msg: "Tarefa de Física I postada no portal, prazo amanhã.", expectedIntent: 'homework', expectedDate: '2026-08-18' }
  ];

  for (const tc of testCases) {
    const res = AIParsingService.parseMessageMock(tc.msg, baseContext);
    assert(res.items.length === 1, `Must return 1 item for: "${tc.msg}"`);
    assert(res.items[0].intent === tc.expectedIntent, `Must detect ${tc.expectedIntent} for: "${tc.msg}"`, res.items[0]);
    assert(res.items[0].targetDate === tc.expectedDate, `Must extract ${tc.expectedDate} for: "${tc.msg}"`, res.items[0]);
  }
});

runTest('Mock Parser', 'Correctly parses alternative Portuguese exam phrasing and abbreviations (P1, P3, Exame Final)', () => {
  const testCases = [
    { msg: "Física I: Prova P1 no dia 2026-09-15 das 14:00 às 16:00.", expectedIntent: 'exam', expectedSubj: 'Física I', expectedDate: '2026-09-15' },
    { msg: "Atenção: Exame Final de Algoritmos confirmado para 12/12/2026.", expectedIntent: 'exam', expectedSubj: 'Algoritmos', expectedDate: '2026-12-12' },
    { msg: "Turma de Cálculo 1: a P3 será realizada no dia 2026-11-20.", expectedIntent: 'exam', expectedSubj: 'Cálculo 1', expectedDate: '2026-11-20' }
  ];

  for (const tc of testCases) {
    const res = AIParsingService.parseMessageMock(tc.msg, baseContext);
    assert(res.items.length === 1, `Must return 1 item for: "${tc.msg}"`);
    assert(res.items[0].intent === tc.expectedIntent, `Must detect exam for: "${tc.msg}"`, res.items[0]);
    assert(res.items[0].subjectName === tc.expectedSubj, `Must detect ${tc.expectedSubj} for: "${tc.msg}"`, res.items[0]);
    assert(res.items[0].targetDate === tc.expectedDate, `Must extract ${tc.expectedDate} for: "${tc.msg}"`, res.items[0]);
  }
});

runTest('Mock Parser', 'Handles informal subject matching, case insensitivity, and unregistered subject fallback', () => {
  // Case insensitivity
  const res1 = AIParsingService.parseMessageMock("Aviso de calculo 1: sem aula hoje", baseContext);
  assert(res1.items[0].subjectName === 'Cálculo 1', 'Should match lowercase calculo 1 to registered Cálculo 1', res1.items[0]);

  // Unregistered subject with "alunos de <Subject>" pattern
  const res2 = AIParsingService.parseMessageMock("Aviso aos alunos de Estrutura de Dados: não teremos aula hoje.", baseContext);
  assert(res2.items[0].subjectName === 'Estrutura de Dados', 'Should extract unregistered subject name from pattern', res2.items[0]);

  // Message without registered subject or pattern matches context fallback
  const res3 = AIParsingService.parseMessageMock("Não teremos aula hoje devido a chuva.", baseContext);
  assert(res3.items[0].subjectName === 'Cálculo 1', 'Should fallback to first registered subject', res3.items[0]);
});

runTest('Mock Parser', 'Correctly parses BR date formats with and without explicit year', () => {
  const res1 = AIParsingService.parseMessageMock("Prova de Algoritmos no dia 05/09/2026 às 08:00.", baseContext);
  assert(res1.items[0].targetDate === '2026-09-05', 'Should convert DD/MM/YYYY to YYYY-MM-DD', res1.items[0]);

  const res2 = AIParsingService.parseMessageMock("Entrega de trabalho de Algoritmos no dia 28/08.", baseContext);
  assert(res2.items[0].targetDate === '2026-08-28', 'Should convert DD/MM to YYYY-MM-DD using current year', res2.items[0]);
});

runTest('Mock Parser', 'Correctly classifies non-actionable informational messages as intent "none"', () => {
  const msg = "Bom dia alunos! Segue o link do livro didático para leitura complementar. Um abraço!";
  const res = AIParsingService.parseMessageMock(msg, baseContext);
  assert(res.items.length === 1, 'Should return 1 item');
  assert(res.items[0].intent === 'none', 'Intent must be "none"', res.items[0]);
});


// ============================================================================
// SUITE 3: AIParsingService.cleanAndValidateJson
// ============================================================================
console.log('\n--- SUITE 3: AIParsingService.cleanAndValidateJson ---');

runTest('JSON Cleaner', 'Parses valid clean JSON response from LLM', () => {
  const validJson = JSON.stringify({
    items: [
      {
        intent: 'cancelled_class',
        subjectName: 'Cálculo 1',
        title: 'Aula Cancelada - Cálculo 1',
        description: 'Professor ausente',
        targetDate: '2026-08-17',
        startTime: '08:00',
        endTime: '10:00',
        alerts: [10080, 1440],
        rawSummary: 'Aula cancelada em 2026-08-17'
      }
    ],
    confidence: 0.98
  });

  const res = AIParsingService.cleanAndValidateJson(validJson, baseContext);
  assert(res.items.length === 1, 'Should parse 1 item');
  assert(res.confidence === 0.98, 'Confidence preserved');
  assert(res.items[0].intent === 'cancelled_class', 'Intent correct');
  assert(res.items[0].targetDate === '2026-08-17', 'Date correct');
});

runTest('JSON Cleaner', 'Extracts and parses JSON wrapped in markdown code fences (```json ... ```)', () => {
  const markdownJson = `\`\`\`json
{
  "items": [
    {
      "intent": "homework",
      "subjectName": "Algoritmos",
      "title": "Entrega Lista 3 - Algoritmos",
      "targetDate": "2026-08-24",
      "startTime": "23:59",
      "endTime": "23:59",
      "alerts": [10080, 1440],
      "rawSummary": "Entrega de Lista 3"
    }
  ],
  "confidence": 0.95
}
\`\`\``;

  const res = AIParsingService.cleanAndValidateJson(markdownJson, baseContext);
  assert(res.items.length === 1, 'Should strip code fences and parse item');
  assert(res.items[0].intent === 'homework', 'Intent homework');
  assert(res.items[0].startTime === '23:59', 'Time 23:59');
});

runTest('JSON Cleaner', 'Matches subject names with case and partial substring variations against registered subjects', () => {
  const jsonWithSubjects = JSON.stringify({
    items: [
      {
        intent: 'exam',
        subjectName: 'algoritmos', // exact lowercase
        title: 'Prova P1',
        targetDate: '2026-09-01'
      },
      {
        intent: 'homework',
        subjectName: 'Física', // partial substring of 'Física I'
        title: 'Lista 1',
        targetDate: '2026-09-02'
      }
    ]
  });

  const res = AIParsingService.cleanAndValidateJson(jsonWithSubjects, baseContext);
  assert(res.items.length === 2, 'Should parse 2 items');
  assert(res.items[0].subjectName === 'Algoritmos', 'Case matched to Algoritmos', res.items[0]);
  assert(res.items[1].subjectName === 'Física I', 'Partial matched to Física I', res.items[1]);
});

runTest('JSON Cleaner', 'Normalizes missing or invalid fields (invalid intent, malformed dates, missing alerts)', () => {
  const malformedItems = JSON.stringify({
    items: [
      {
        intent: 'invalid_intent_xyz',
        subjectName: 'Algoritmos',
        targetDate: 'data_invalida_123',
        startTime: 'bad_time',
        endTime: 'bad_time',
        alerts: 'not_an_array'
      }
    ]
  });

  const res = AIParsingService.cleanAndValidateJson(malformedItems, baseContext);
  assert(res.items.length === 1, 'Should parse 1 item');
  const item = res.items[0];
  assert(item.intent === 'none', 'Invalid intent normalizes to none', item);
  assert(item.targetDate === '2026-08-17', 'Malformed targetDate defaults to context.currentDate', item);
  assert(item.startTime === '08:00', 'Malformed startTime defaults to 08:00', item);
  assert(Array.isArray(item.alerts) && item.alerts.length === 2, 'Malformed alerts defaults to [10080, 1440]', item);
});

runTest('JSON Cleaner', 'Gracefully falls back to parseMessageMock when LLM returns non-JSON text', () => {
  const nonJsonText = "Aviso aos alunos de Cálculo 1: Excepcionalmente não teremos aula hoje (2026-08-17) devido a banca.";
  const res = AIParsingService.cleanAndValidateJson(nonJsonText, baseContext);
  assert(res.items.length === 1, 'Should fall back to mock parsing');
  assert(res.items[0].intent === 'cancelled_class', 'Mock parsed cancelled_class');
  assert(res.items[0].subjectName === 'Cálculo 1', 'Mock parsed subject');
  assert(res.items[0].targetDate === '2026-08-17', 'Mock parsed date');
});

console.log('\n================================================================');
console.log('SUMMARY REPORT');
console.log('================================================================');

const passedCount = results.filter(r => r.passed).length;
const failedCount = results.filter(r => !r.passed).length;

console.log(`Total Tests Run : ${results.length}`);
console.log(`Passed          : ${passedCount}`);
console.log(`Failed          : ${failedCount}`);

if (failedCount > 0) {
  console.log('\nFAILURES:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`- [${r.suite}] ${r.name}: ${r.error}`);
  });
  process.exit(1);
} else {
  console.log('\nALL EMPIRICAL STRESS TESTS PASSED PERFECTLY!');
  process.exit(0);
}
