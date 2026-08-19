import './setup_env';
import { memoryStore, mockAsyncStorage } from './setup_env';
import { TeamsService } from '../src/services/TeamsService';
import { AIParsingService, ParsingContext } from '../src/services/AIParsingService';
import { SyncService } from '../src/services/SyncService';
import {
  AIConfig,
  AIParsedItem,
  AppEvent,
  AttendanceRecord,
  Subject
} from '../src/types';

// ============================================================================
// TIER 5 ADVERSARIAL TEST HARNESS INFRASTRUCTURE
// ============================================================================

interface AdversarialStats {
  htmlSanitizer: { total: number; passed: number; failed: number };
  aiPromptAndJson: { total: number; passed: number; failed: number };
  portugueseSyntax: { total: number; passed: number; failed: number };
  fuzzingAndSync: { total: number; passed: number; failed: number };
}

const stats: AdversarialStats = {
  htmlSanitizer: { total: 0, passed: 0, failed: 0 },
  aiPromptAndJson: { total: 0, passed: 0, failed: 0 },
  portugueseSyntax: { total: 0, passed: 0, failed: 0 },
  fuzzingAndSync: { total: 0, passed: 0, failed: 0 },
};

let currentSection: keyof AdversarialStats = 'htmlSanitizer';
const failureDetails: string[] = [];

function setSection(section: keyof AdversarialStats) {
  currentSection = section;
}

function assert(condition: boolean, testId: string, description: string, detail?: string) {
  stats[currentSection].total++;
  if (condition) {
    stats[currentSection].passed++;
    console.log(`  [PASS] [${testId}] ${description}`);
  } else {
    stats[currentSection].failed++;
    const msg = `  [FAIL] [${testId}] ${description} ${detail ? `-> ${detail}` : ''}`;
    console.error(msg);
    failureDetails.push(msg);
  }
}

function assertEqual<T>(actual: T, expected: T, testId: string, description: string) {
  const match = JSON.stringify(actual) === JSON.stringify(expected);
  assert(match, testId, description, `Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`);
}

// ============================================================================
// ADVERSARIAL SUITE EXECUTION
// ============================================================================

export async function runTier5AdversarialSuite() {
  console.log('================================================================================');
  console.log('  ORGANIZA TIER 5 ADVERSARIAL STRESS TEST SUITE: TEAMS & AI PARSING');
  console.log('================================================================================\n');

  const defaultContext: ParsingContext = {
    currentDate: '2026-08-17',
    currentDayOfWeek: 'Segunda-feira',
    registeredSubjects: ['Cálculo 1', 'Algoritmos e Estruturas de Dados', 'Física I']
  };

  // ============================================================================
  // SECTION 1: HTML SANITIZATION ADVERSARIAL STRESS TESTING
  // ============================================================================
  setSection('htmlSanitizer');
  console.log('================================================================================');
  console.log('SECTION 1: HTML SANITIZER ADVERSARIAL STRESS TESTING');
  console.log('================================================================================\n');

  // 1.1 Null / Undefined / Non-String Inputs
  assert(TeamsService.sanitizeHtmlMessage(null as any) === '', 'T5.HTML.1', 'Null input returns empty string');
  assert(TeamsService.sanitizeHtmlMessage(undefined as any) === '', 'T5.HTML.2', 'Undefined input returns empty string');
  assert(TeamsService.sanitizeHtmlMessage(12345 as any) === '', 'T5.HTML.3', 'Number input returns empty string');
  assert(TeamsService.sanitizeHtmlMessage('' as any) === '', 'T5.HTML.4', 'Empty string returns empty string');
  assert(TeamsService.sanitizeHtmlMessage('   \t\n  ' as any) === '', 'T5.HTML.5', 'Whitespace-only returns empty string');

  // 1.2 Script Injection & XSS Payloads
  const xssPayloads = [
    '<script>alert("xss")</script>Texto legítimo',
    '<SCRIPT SRC="http://evil.com/xss.js"></SCRIPT>Aviso de aula',
    '<script type="text/javascript">var secret="123";</script>Aviso importante',
    '<img src="invalid" onerror="alert(\'XSS\')" />Lista de exercícios',
    '<svg/onload=alert(1)>Prova P1 remarcada',
    '<iframe src="javascript:alert(1)"></iframe>Entrega amanhã',
    '<<SCRIPT>alert("nested");//<</SCRIPT>Cancelado hoje',
    '<a href="javascript:alert(1)">Clique para ver o trabalho</a>'
  ];

  for (let i = 0; i < xssPayloads.length; i++) {
    const cleaned = TeamsService.sanitizeHtmlMessage(xssPayloads[i]);
    const containsTag = /<script|<iframe|<svg|<img/i.test(cleaned);
    const containsAlert = /alert\(/i.test(cleaned);
    assert(
      !containsTag && (!containsAlert || !cleaned.includes('<')),
      `T5.HTML.XSS.${i + 1}`,
      `XSS payload ${i + 1} sanitized without executable tags (${cleaned.substring(0, 30)}...)`
    );
  }

  // 1.3 Nested & Malformed Tables / Layout Tags
  const nestedTableHtml = `
    <table>
      <thead><tr><th>Matéria</th><th>Data</th><th>Horário</th></tr></thead>
      <tbody>
        <tr><td>Cálculo 1</td><td>2026-08-17</td><td>08:00 às 10:00</td></tr>
        <tr><td>Física I</td><td>2026-08-28</td><td>10:00 às 12:00</td></tr>
      </tbody>
    </table>
  `;
  const tableResult = TeamsService.sanitizeHtmlMessage(nestedTableHtml);
  assert(
    tableResult.includes('Cálculo 1') && tableResult.includes('2026-08-17') && !tableResult.includes('<table>') && !tableResult.includes('<tr>'),
    'T5.HTML.6',
    'Table converted to clean text with tags stripped'
  );

  // 1.4 Deeply Nested Tags & Unclosed Tags
  let deepTags = 'Aviso de início: ';
  for (let i = 0; i < 60; i++) {
    deepTags += `<div><p><span class="deep_${i}">`;
  }
  deepTags += 'Conteúdo profundo de Algoritmos';
  // Deliberately omit closing tags
  const deepResult = TeamsService.sanitizeHtmlMessage(deepTags);
  assert(
    deepResult.includes('Aviso de início:') && deepResult.includes('Conteúdo profundo de Algoritmos') && !deepResult.includes('<span'),
    'T5.HTML.7',
    'Deeply nested 60-level unclosed tags stripped completely'
  );

  // 1.5 Entity Decoding: Named, Decimal, and Hexadecimal
  const entityHtml = 'Aviso: &aacute;&eacute;&iacute;&oacute;&uacute; &atilde;&otilde; &ccedil; &Aacute;&Eacute;&Iacute;&Oacute;&Uacute; &Atilde;&Otilde; &Ccedil; &#225; &#xE1; &quot;aspas&quot; &amp; &lt;tag&gt;';
  const entityResult = TeamsService.sanitizeHtmlMessage(entityHtml);
  assert(
    entityResult.includes('áéíóú ãõ ç ÁÉÍÓÚ ÃÕ Ç á á "aspas" & <tag>'),
    'T5.HTML.8',
    'HTML named, decimal (&#225;) and hex (&#xE1;) entities decoded correctly'
  );

  // 1.6 Malformed & Unknown Entities
  const malformedEntityHtml = 'Texto com &unknown; e &#; e &#x; e &amp;lt; e &';
  const malformedEntityResult = TeamsService.sanitizeHtmlMessage(malformedEntityHtml);
  assert(
    malformedEntityResult.includes('&unknown;') && (malformedEntityResult.includes('&lt;') || malformedEntityResult.includes('<')),
    'T5.HTML.9',
    'Malformed/unknown entities do not crash or corrupt text'
  );

  // 1.7 Non-ASCII, Unicode Emojis & Combining Characters
  const unicodeHtml = '<p>📢 <b>Atenção Turma!</b> 📚 Prova P2 de Física I agendada 📅 para 28/08/2026 ⏰ das 08:00 às 10:00! 👨‍🏫✍️</p>';
  const unicodeResult = TeamsService.sanitizeHtmlMessage(unicodeHtml);
  assert(
    unicodeResult.includes('📢') && unicodeResult.includes('Atenção Turma!') && unicodeResult.includes('📚') && unicodeResult.includes('28/08/2026'),
    'T5.HTML.10',
    'Preserves Unicode emojis, multi-byte sequences and text intact'
  );

  // 1.8 Massive Payload (100KB) Stress Test (ReDoS & Performance check)
  const startTime = Date.now();
  const chunk = '<p>Professor Carlos informa: <span style="color:red">Entrega da Lista 3</span> adiada para <b>2026-08-24</b>.</p>\n';
  const massiveHtml = chunk.repeat(1000); // ~105 KB
  const massiveResult = TeamsService.sanitizeHtmlMessage(massiveHtml);
  const elapsedMs = Date.now() - startTime;

  assert(
    massiveResult.length > 50000 && !massiveResult.includes('<p>') && elapsedMs < 2000,
    'T5.HTML.11',
    `Massive 105KB HTML payload processed in ${elapsedMs}ms (<2000ms, no ReDoS)`
  );

  // ============================================================================
  // SECTION 2: AI PARSER PROMPT, JSON EXTRACTION & FALLBACK ADVERSARIAL TESTING
  // ============================================================================
  setSection('aiPromptAndJson');
  console.log('\n================================================================================');
  console.log('SECTION 2: AI PARSER PROMPT, JSON EXTRACTION & FALLBACK ROBUSTNESS');
  console.log('================================================================================\n');

  // 2.1 Adversarial System Prompt Context
  const adversarialContext: ParsingContext = {
    currentDate: '2026-08-17',
    currentDayOfWeek: 'Segunda-feira',
    registeredSubjects: ['"Cálculo" 1', 'Algoritmos & Estruturas\n', '<Física I>']
  };
  const builtPrompt = AIParsingService.buildSystemPrompt(adversarialContext);
  assert(
    builtPrompt.includes('2026-08-17') && builtPrompt.includes('"Cálculo" 1') && builtPrompt.includes('<Física I>'),
    'T5.AI.1',
    'System prompt handles subjects with quotes, newlines, and brackets'
  );

  // 2.2 Markdown Code Fence Variations in cleanAndValidateJson
  const fenceVariations = [
    '```json\n{"items":[{"intent":"homework","subjectName":"Algoritmos","title":"Lista 1","targetDate":"2026-08-24"}],"confidence":0.9}\n```',
    '```JSON\n{"items":[{"intent":"homework","subjectName":"Algoritmos","title":"Lista 2","targetDate":"2026-08-24"}],"confidence":0.9}\n```',
    '```\n{"items":[{"intent":"homework","subjectName":"Algoritmos","title":"Lista 3","targetDate":"2026-08-24"}],"confidence":0.9}\n```',
    '   ```json   \n{"items":[{"intent":"homework","subjectName":"Algoritmos","title":"Lista 4","targetDate":"2026-08-24"}],"confidence":0.9}\n   ```   '
  ];

  for (let i = 0; i < fenceVariations.length; i++) {
    const res = AIParsingService.cleanAndValidateJson(fenceVariations[i], defaultContext);
    assert(
      res.items.length === 1 && res.items[0].title === `Lista ${i + 1}`,
      `T5.AI.Fence.${i + 1}`,
      `Fence variation ${i + 1} parsed successfully`
    );
  }

  // 2.3 Conversational Preamble and Postamble with JSON
  const preambleJson = `
    Olá! Analisei a mensagem do professor e gerei o seguinte JSON estruturado:
    \`\`\`json
    {
      "items": [
        {
          "intent": "exam",
          "subjectName": "Física I",
          "title": "Prova P2 - Física I",
          "targetDate": "2026-08-28",
          "startTime": "08:00",
          "endTime": "10:00"
        }
      ],
      "confidence": 0.98
    }
    \`\`\`
    Qualquer dúvida estou à disposição!
  `;
  const preambleRes = AIParsingService.cleanAndValidateJson(preambleJson, defaultContext);
  assert(
    preambleRes.items.length === 1 && preambleRes.items[0].intent === 'exam',
    'T5.AI.2',
    'Recovers item when JSON is wrapped with conversational preamble/postamble (via fallback or regex)'
  );

  // 2.4 Severely Corrupted / Truncated JSON Payloads (Testing Fail-Safe Immunity to Exceptions)
  const corruptedPayloads = [
    { label: 'truncated', raw: '{"items": [{"intent": "cancelled_class", "subjectName": "Cálculo 1", "title": "Aula' },
    { label: 'no_quotes', raw: '{items: [bad_json_no_quotes]}' },
    { label: 'html_proxy_error', raw: '<html><body>502 Bad Gateway from Proxy Server</body></html>' },
    { label: 'plain_text', raw: 'Plain text response: Não haverá aula de Cálculo 1 hoje dia 2026-08-17' },
    { label: 'null_string', raw: 'null' },
    { label: 'items_not_array', raw: '{"items": "this is not an array"}' },
    { label: 'items_with_null_and_primitives', raw: '{"items": [null, 123, "string", {}]}' }
  ];

  for (let i = 0; i < corruptedPayloads.length; i++) {
    const item = corruptedPayloads[i];
    try {
      const res = AIParsingService.cleanAndValidateJson(item.raw, defaultContext);
      assert(
        res !== null && typeof res === 'object' && Array.isArray(res.items) && typeof res.confidence === 'number',
        `T5.AI.Corrupt.${i + 1}`,
        `Corrupted payload "${item.label}" handled safely without unhandled exceptions`
      );
    } catch (err: any) {
      assert(
        false,
        `T5.AI.Corrupt.${i + 1}`,
        `Corrupted payload "${item.label}" threw unhandled exception: ${err?.message}`,
        err?.stack
      );
    }
  }

  // 2.5 Schema Deviation: Missing Fields & Invalid Types in Items
  const schemaDeviationJson = JSON.stringify({
    items: [
      {
        intent: 'invalid_intent_xyz', // invalid intent -> none
        subjectName: null, // null subjectName -> Geral
        title: null, // null title -> fallback title
        targetDate: 'invalid-date-format', // invalid targetDate -> context.currentDate (2026-08-17)
        startTime: 'not-a-time', // invalid startTime -> 08:00
        endTime: 'bad-time', // invalid endTime -> 10:00
        alerts: 'not-an-array' // invalid alerts -> [10080, 1440]
      }
    ],
    confidence: 'not-a-number'
  });

  const schemaRes = AIParsingService.cleanAndValidateJson(schemaDeviationJson, defaultContext);
  assert(schemaRes.items.length === 1, 'T5.AI.3', 'Parsed item despite missing/deviated fields');
  assertEqual(schemaRes.items[0].intent, 'none', 'T5.AI.4', 'Invalid intent normalizes to "none"');
  assertEqual(schemaRes.items[0].targetDate, '2026-08-17', 'T5.AI.5', 'Invalid targetDate normalizes to context date');
  assertEqual(schemaRes.items[0].alerts, [10080, 1440], 'T5.AI.6', 'Invalid alerts array normalizes to [10080, 1440]');
  assert(typeof schemaRes.confidence === 'number', 'T5.AI.7', 'Confidence defaults to a valid number');

  // 2.6 Full Offline Fallback on Bad API Key / Network Failure Simulation
  const badConfig: AIConfig = {
    provider: 'gemini',
    apiKey: 'invalid_key_that_causes_error',
    model: 'gemini-1.5-flash'
  };

  // Mock fetch failure
  const origFetch = globalThis.fetch;
  (globalThis as any).fetch = async () => ({
    ok: false,
    status: 403,
    statusText: 'Forbidden - Invalid API Key',
    json: async () => ({ error: { message: 'API key not valid' } })
  });

  const fallbackResult = await AIParsingService.parseMessage(
    'Aviso aos alunos de Cálculo 1: não teremos aula hoje (2026-08-17).',
    badConfig,
    defaultContext
  );

  // Restore fetch
  globalThis.fetch = origFetch;

  assert(
    fallbackResult.items.length === 1 &&
    fallbackResult.items[0].intent === 'cancelled_class' &&
    fallbackResult.items[0].subjectName === 'Cálculo 1',
    'T5.AI.8',
    'API failure gracefully triggers deterministic mock fallback returning accurate cancellation'
  );

  // ============================================================================
  // SECTION 3: PORTUGUESE ACADEMIC SYNTAX & COLLOQUIAL PARSING
  // ============================================================================
  setSection('portugueseSyntax');
  console.log('\n================================================================================');
  console.log('SECTION 3: PORTUGUESE ACADEMIC SYNTAX & COLLOQUIAL PARSING');
  console.log('================================================================================\n');

  // 3.1 Diverse Colloquial Portuguese Cancellations
  const cancellationMessages = [
    {
      msg: 'Prezados, informo que hoje (17/08/2026) não poderei comparecer à aula de Cálculo 1 por motivo de força maior.',
      expectedSubj: 'Cálculo 1',
      expectedDate: '2026-08-17'
    },
    {
      msg: 'Boa tarde turma, aula suspensa nesta segunda devido à greve de transporte. Matéria: Algoritmos.',
      expectedSubj: 'Algoritmos e Estruturas de Dados',
      expectedDate: '2026-08-17'
    },
    {
      msg: 'Atenção alunos de Física I: sem aula hoje. Façam a leitura do capítulo 4 do livro texto.',
      expectedSubj: 'Física I',
      expectedDate: '2026-08-17'
    },
    {
      msg: 'Estou dispensando a turma de Cálculo 1 da aula de amanhã.',
      expectedSubj: 'Cálculo 1',
      expectedDate: '2026-08-18'
    }
  ];

  for (let i = 0; i < cancellationMessages.length; i++) {
    const c = cancellationMessages[i];
    const res = AIParsingService.parseMessageMock(c.msg, defaultContext);
    assert(
      res.items.length === 1 && res.items[0].intent === 'cancelled_class',
      `T5.PT.Cancel.${i + 1}.Intent`,
      `Cancellation syntax ${i + 1} classified as cancelled_class`
    );
    assertEqual(
      res.items[0].targetDate,
      c.expectedDate,
      `T5.PT.Cancel.${i + 1}.Date`,
      `Cancellation syntax ${i + 1} date resolved correctly (${c.expectedDate})`
    );
  }

  // 3.2 Diverse Colloquial Portuguese Homework & Deadlines
  const homeworkMessages = [
    {
      msg: 'Lista 4 de Algoritmos disponível no AVA. Entrega impreterivelmente até 2026-08-30 às 23:59.',
      expectedSubj: 'Algoritmos e Estruturas de Dados',
      expectedDate: '2026-08-30',
      expectedTime: '23:59'
    },
    {
      msg: 'Trabalho prático de Física I deve ser enviado até dia 15/09/2026 às 18:00 pelo Teams.',
      expectedSubj: 'Física I',
      expectedDate: '2026-09-15',
      expectedTime: '18:00'
    },
    {
      msg: 'Pessoal de Cálculo 1, subam a Lista de Exercícios no AVA até amanhã às 22:00.',
      expectedSubj: 'Cálculo 1',
      expectedDate: '2026-08-18',
      expectedTime: '22:00'
    }
  ];

  for (let i = 0; i < homeworkMessages.length; i++) {
    const hw = homeworkMessages[i];
    const res = AIParsingService.parseMessageMock(hw.msg, defaultContext);
    assert(
      res.items.length === 1 && res.items[0].intent === 'homework',
      `T5.PT.HW.${i + 1}.Intent`,
      `Homework syntax ${i + 1} classified as homework`
    );
    assertEqual(
      res.items[0].targetDate,
      hw.expectedDate,
      `T5.PT.HW.${i + 1}.Date`,
      `Homework syntax ${i + 1} date resolved (${hw.expectedDate})`
    );
    assertEqual(
      res.items[0].startTime,
      hw.expectedTime,
      `T5.PT.HW.${i + 1}.Time`,
      `Homework syntax ${i + 1} time resolved (${hw.expectedTime})`
    );
  }

  // 3.3 Diverse Colloquial Portuguese Exam Announcements & Rescheduling
  const examMessages = [
    {
      msg: 'Revisão na próxima aula e Prova P1 de Física I remarcada para 2026-09-10 das 10:00 às 12:00.',
      expectedSubj: 'Física I',
      expectedDate: '2026-09-10',
      expectedStart: '10:00',
      expectedEnd: '12:00'
    },
    {
      msg: 'Avaliação de Cálculo 1 confirmada para 2026-09-15 das 08:00 às 10:00 na sala 302.',
      expectedSubj: 'Cálculo 1',
      expectedDate: '2026-09-15',
      expectedStart: '08:00',
      expectedEnd: '10:00'
    },
    {
      msg: 'Atenção turma de Algoritmos: Exame Final marcado para 20/12/2026 das 14:00 às 16:00.',
      expectedSubj: 'Algoritmos e Estruturas de Dados',
      expectedDate: '2026-12-20',
      expectedStart: '14:00',
      expectedEnd: '16:00'
    }
  ];

  for (let i = 0; i < examMessages.length; i++) {
    const ex = examMessages[i];
    const res = AIParsingService.parseMessageMock(ex.msg, defaultContext);
    assert(
      res.items.length === 1 && res.items[0].intent === 'exam',
      `T5.PT.Exam.${i + 1}.Intent`,
      `Exam syntax ${i + 1} classified as exam`
    );
    assertEqual(
      res.items[0].targetDate,
      ex.expectedDate,
      `T5.PT.Exam.${i + 1}.Date`,
      `Exam syntax ${i + 1} date resolved (${ex.expectedDate})`
    );
    assertEqual(
      res.items[0].startTime,
      ex.expectedStart,
      `T5.PT.Exam.${i + 1}.Start`,
      `Exam syntax ${i + 1} start time resolved (${ex.expectedStart})`
    );
    assertEqual(
      res.items[0].endTime,
      ex.expectedEnd,
      `T5.PT.Exam.${i + 1}.End`,
      `Exam syntax ${i + 1} end time resolved (${ex.expectedEnd})`
    );
  }

  // 3.4 Non-Actionable Academic Messages (Chatter, Congratulations, Notes)
  const nonActionableMessages = [
    'Bom dia a todos, o gabarito do exercício 2 já foi postado para conferência.',
    'Lembrando que o atendimento a dúvidas é toda terça às 14h na sala dos professores.',
    'Parabéns a todos pelas notas obtidas no projeto final!',
    'As notas da P1 já estão disponíveis no portal acadêmico.',
    'Desejo a todos uma excelente semana de estudos!'
  ];

  for (let i = 0; i < nonActionableMessages.length; i++) {
    const res = AIParsingService.parseMessageMock(nonActionableMessages[i], defaultContext);
    assert(
      res.items.length === 1 && res.items[0].intent === 'none',
      `T5.PT.NonAction.${i + 1}`,
      `Non-actionable message ${i + 1} classified as intent "none"`
    );
  }

  // 3.5 Ambiguous Message with Multiple Dates (e.g. Previous Date + New Exam Date)
  const multiDateMsg = 'A aula do dia 10/08 foi cancelada, então a nossa Prova P2 de Física I ficou agendada para 2026-08-28 das 08:00 às 10:00.';
  const multiDateRes = AIParsingService.parseMessageMock(multiDateMsg, defaultContext);
  assert(
    multiDateRes.items[0].intent === 'cancelled_class' || multiDateRes.items[0].intent === 'exam',
    'T5.PT.MultiDate.1',
    'Multi-date message extracts valid academic intent'
  );

  // ============================================================================
  // SECTION 4: FUZZING & INTEGRATED SYNC ENGINE UNDER ADVERSARIAL LOADS
  // ============================================================================
  setSection('fuzzingAndSync');
  console.log('\n================================================================================');
  console.log('SECTION 4: FUZZING & INTEGRATED SYNC ENGINE UNDER ADVERSARIAL LOADS');
  console.log('================================================================================\n');

  // 4.1 Fuzzing Pipeline (50 Mutated / Pseudo-random Payloads)
  const baseFragments = [
    'Aviso aos alunos de Cálculo 1: ',
    'Turma de Algoritmos: ',
    'Atenção pessoal de Física I: ',
    'Não teremos aula hoje (2026-08-17). ',
    'Lista de Exercícios 3 entrega dia 2026-08-24 às 23:59. ',
    'Prova P2 agendada para 2026-08-28 das 08:00 às 10:00. ',
    '<script>alert("xss")</script>',
    '<div><p>HTML fragment</p></div>',
    'Bom dia turma! ',
    'Amanhã temos encontro normal. '
  ];

  let fuzzPassedCount = 0;
  for (let f = 0; f < 50; f++) {
    // Generate pseudo-random combination
    const f1 = baseFragments[f % baseFragments.length];
    const f2 = baseFragments[(f * 3 + 1) % baseFragments.length];
    const f3 = baseFragments[(f * 7 + 2) % baseFragments.length];
    const rawFuzzMessage = `${f1} ${f2} ${f3}`;

    try {
      const sanitized = TeamsService.sanitizeHtmlMessage(rawFuzzMessage);
      const parsed = AIParsingService.parseMessageMock(sanitized, defaultContext);
      assert(
        parsed && Array.isArray(parsed.items) && parsed.items.length > 0,
        `T5.FUZZ.${f + 1}`,
        `Fuzz iteration ${f + 1} sanitized and parsed without throwing`
      );
      fuzzPassedCount++;
    } catch (err: any) {
      assert(false, `T5.FUZZ.${f + 1}`, `Fuzz iteration ${f + 1} threw exception: ${err?.message}`);
    }
  }

  // 4.2 Sync Engine with Extreme / Edge AIParsedItems
  const extremeItems: AIParsedItem[] = [
    {
      intent: 'cancelled_class',
      subjectName: 'Matéria Inexistente Sem Cadastro',
      title: 'Aula Cancelada',
      targetDate: '2026-08-17',
      startTime: '08:00',
      endTime: '10:00',
      alerts: [10080, 1440],
      rawSummary: 'Cancelamento sem matéria cadastrada'
    },
    {
      intent: 'homework',
      subjectName: '', // empty name
      title: 'Entrega Tarefa Sem Nome',
      targetDate: '2026-08-24',
      startTime: '23:59',
      endTime: '23:59',
      alerts: [],
      rawSummary: 'Homework sem subjectName'
    },
    {
      intent: 'exam',
      subjectName: 'Física I',
      title: 'Prova Sem GradeGroup Inicial',
      targetDate: '2026-08-28',
      startTime: '08:00',
      endTime: '10:00',
      alerts: [10080, 1440],
      rawSummary: 'Prova em subject sem gradeGroups prévios'
    },
    {
      intent: 'none',
      subjectName: 'Cálculo 1',
      title: 'Aviso Geral',
      targetDate: '2026-08-17',
      startTime: '08:00',
      endTime: '08:00',
      alerts: [],
      rawSummary: 'Mensagem informativa'
    }
  ];

  const testSubjects: Subject[] = [
    {
      id: 'subj_calc_1',
      name: 'Cálculo 1',
      color: '#0A84FF',
      passGrade: 7.0,
      maxAbsences: 15,
      workloadHours: 60,
      gradeGroups: []
    },
    {
      id: 'subj_fis_1',
      name: 'Física I',
      color: '#BF5AF2',
      passGrade: 7.0,
      maxAbsences: 15,
      workloadHours: 60
      // gradeGroups undefined
    }
  ];

  const syncResult = await SyncService.processParsedItems(
    extremeItems,
    [],
    [],
    testSubjects
  );

  assert(
    syncResult.updatedAttendances.length === 1 && syncResult.updatedAttendances[0].status === 'cancelled',
    'T5.SYNC.1',
    'Sync safely creates cancelled attendance for unmapped subject without crashing'
  );

  assert(
    syncResult.updatedEvents.length === 2, // 1 homework + 1 exam
    'T5.SYNC.2',
    'Sync safely creates homework and exam events even with missing fields'
  );

  const fisSubject = syncResult.updatedSubjects.find(s => s.id === 'subj_fis_1');
  assert(
    fisSubject && Array.isArray(fisSubject.gradeGroups) && fisSubject.gradeGroups.length === 1 && fisSubject.gradeGroups[0].items.length === 1,
    'T5.SYNC.3',
    'Sync initializes default GradeGroup when subject has none and attaches exam GradeItem'
  );

  assert(
    syncResult.syncResult.logs.length >= 4,
    'T5.SYNC.4',
    'Sync logs contain comprehensive audit trail for all 4 processed items'
  );

  // 4.3 High-Volume Batch Processing (100 Items in Single Batch)
  const massiveBatchItems: AIParsedItem[] = [];
  for (let i = 0; i < 100; i++) {
    const isHw = i % 2 === 0;
    massiveBatchItems.push({
      intent: isHw ? 'homework' : 'exam',
      subjectName: 'Cálculo 1',
      title: `${isHw ? 'Lista' : 'Prova'} Batch ${i}`,
      targetDate: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
      startTime: isHw ? '23:59' : '08:00',
      endTime: isHw ? '23:59' : '10:00',
      alerts: [10080, 1440],
      rawSummary: `Item batch ${i}`
    });
  }

  const batchSyncRes = await SyncService.processParsedItems(
    massiveBatchItems,
    syncResult.updatedEvents,
    syncResult.updatedAttendances,
    syncResult.updatedSubjects
  );

  assert(
    batchSyncRes.updatedEvents.length === 102, // 2 initial + 100 batch
    'T5.SYNC.5',
    'Processed 100 items batch successfully creating 100 new calendar events'
  );

  // ============================================================================
  // SUMMARY AND VERDICT
  // ============================================================================
  const grandTotal =
    stats.htmlSanitizer.total +
    stats.aiPromptAndJson.total +
    stats.portugueseSyntax.total +
    stats.fuzzingAndSync.total;

  const grandPassed =
    stats.htmlSanitizer.passed +
    stats.aiPromptAndJson.passed +
    stats.portugueseSyntax.passed +
    stats.fuzzingAndSync.passed;

  const grandFailed =
    stats.htmlSanitizer.failed +
    stats.aiPromptAndJson.failed +
    stats.portugueseSyntax.failed +
    stats.fuzzingAndSync.failed;

  console.log('\n================================================================================');
  console.log('  ORGANIZA TIER 5 ADVERSARIAL STRESS TEST SUMMARY');
  console.log('================================================================================');
  console.log(`  Section 1 (HTML Sanitization)        : ${stats.htmlSanitizer.passed} / ${stats.htmlSanitizer.total} Passed (${stats.htmlSanitizer.failed} Failed)`);
  console.log(`  Section 2 (AI Prompt & JSON Handling): ${stats.aiPromptAndJson.passed} / ${stats.aiPromptAndJson.total} Passed (${stats.aiPromptAndJson.failed} Failed)`);
  console.log(`  Section 3 (Portuguese Academic Syntax): ${stats.portugueseSyntax.passed} / ${stats.portugueseSyntax.total} Passed (${stats.portugueseSyntax.failed} Failed)`);
  console.log(`  Section 4 (Fuzzing & Integrated Sync): ${stats.fuzzingAndSync.passed} / ${stats.fuzzingAndSync.total} Passed (${stats.fuzzingAndSync.failed} Failed)`);
  console.log('--------------------------------------------------------------------------------');
  console.log(`  GRAND TOTAL                          : ${grandPassed} / ${grandTotal} Passed (${grandFailed} Failed)`);
  console.log(`  PASS RATE                            : ${((grandPassed / grandTotal) * 100).toFixed(2)}%`);
  console.log('================================================================================\n');

  if (failureDetails.length > 0) {
    console.log('Failure details:');
    failureDetails.forEach(f => console.log('  ', f));
  }
}

// Execute suite directly when run via tsx
runTier5AdversarialSuite().catch(err => {
  console.error('Fatal execution error in Tier 5 Adversarial Suite:', err);
  process.exit(1);
});
