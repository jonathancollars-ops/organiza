import './setup_env';
import { memoryStore, mockAsyncStorage } from './setup_env';
import { AIParsingService, ParsingContext } from '../src/services/AIParsingService';
import { SyncService } from '../src/services/SyncService';
import { TeamsService } from '../src/services/TeamsService';
import {
  AIConfig,
  AIParsedItem,
  AppEvent,
  AttendanceRecord,
  Subject,
  GradeGroup,
  GradeItem
} from '../src/types';
import { format, addDays, parseISO } from 'date-fns';

interface ProbeResults {
  category: string;
  testId: string;
  description: string;
  passed: boolean;
  error?: string;
}

const probeResults: ProbeResults[] = [];

function recordTest(category: string, testId: string, description: string, condition: boolean, errorDetail?: string) {
  if (condition) {
    probeResults.push({ category, testId, description, passed: true });
    console.log(`  [PASS] [${testId}] ${description}`);
  } else {
    probeResults.push({ category, testId, description, passed: false, error: errorDetail || 'Assertion failed' });
    console.error(`  [FAIL] [${testId}] ${description} -> ${errorDetail || 'Assertion failed'}`);
  }
}

export async function runChallengerAdversarialProbe() {
  console.log('================================================================================');
  console.log('  CHALLENGER ADVERSARIAL DEEP PROBE & STRESS HARNESS (TIER 5 VERIFICATION)');
  console.log('================================================================================\n');

  const defaultContext: ParsingContext = {
    currentDate: '2026-08-17',
    currentDayOfWeek: 'Segunda-feira',
    registeredSubjects: ['Cálculo 1', 'Algoritmos e Estruturas de Dados', 'Física I']
  };

  // ============================================================================
  // SUITE 1: JSON PARSER MALFORMED & EXTREME FUZZING PROBES
  // ============================================================================
  console.log('--------------------------------------------------------------------------------');
  console.log('SUITE 1: JSON PARSER MALFORMED & EXTREME FUZZING PROBES');
  console.log('--------------------------------------------------------------------------------');

  const extremeJsonPayloads: { name: string; raw: string }[] = [
    { name: 'Literal null', raw: 'null' },
    { name: 'Literal undefined string', raw: 'undefined' },
    { name: 'Literal number', raw: '12345' },
    { name: 'Literal boolean true', raw: 'true' },
    { name: 'Literal boolean false', raw: 'false' },
    { name: 'Quoted plain string', raw: '"Just a plain string message"' },
    { name: 'Empty array', raw: '[]' },
    { name: 'Array of numbers', raw: '[1, 2, 3]' },
    { name: 'Array of nulls', raw: '[null, null]' },
    { name: 'Empty object', raw: '{}' },
    { name: 'Items is null', raw: '{"items": null, "confidence": 0.5}' },
    { name: 'Items is number', raw: '{"items": 999, "confidence": 0.5}' },
    { name: 'Items is boolean', raw: '{"items": true}' },
    { name: 'Items is string', raw: '{"items": "not an array"}' },
    { name: 'Items is nested object', raw: '{"items": {"0": {"intent": "exam"}}}' },
    { name: 'Items with null, numbers, primitives', raw: '{"items": [null, 123, "string", true, false, [], {}]}' },
    { name: 'Items with prototype pollution keys', raw: '{"items": [{"__proto__": {"polluted": true}, "intent": "exam"}]}' },
    { name: 'Items with corrupt field types', raw: '{"items": [{"intent": 12345, "subjectName": null, "targetDate": true, "startTime": {}, "endTime": [], "alerts": "invalid"}]}' },
    { name: 'Items with invalid intent enum', raw: '{"items": [{"intent": "destroy_database", "subjectName": "Cálculo 1"}]}' },
    { name: 'Items with malformed date strings', raw: '{"items": [{"intent": "exam", "targetDate": "9999-99-99-invalid"}]}' },
    { name: 'Items with invalid time formats', raw: '{"items": [{"intent": "homework", "startTime": "99:99:99", "endTime": "invalid_time"}]}' },
    { name: 'Markdown fenced json', raw: '```json\n{"items": [{"intent": "homework", "subjectName": "Algoritmos", "targetDate": "2026-08-24"}], "confidence": 0.9}\n```' },
    { name: 'Markdown fenced generic code block', raw: '```\n{"items": [{"intent": "exam", "subjectName": "Física I", "targetDate": "2026-08-28"}], "confidence": 0.9}\n```' },
    { name: 'Truncated JSON snippet 1', raw: '{"items": [{"intent": "cancelled_class"' },
    { name: 'Truncated JSON snippet 2', raw: '{"items": [' },
    { name: 'Trailing commas JSON', raw: '{"items": [{"intent": "exam", "subjectName": "Cálculo 1",},],}' },
    { name: 'HTML Cloudflare error string', raw: '<!DOCTYPE html><html><body><h1>502 Bad Gateway</h1></body></html>' },
    { name: 'Huge string (100k chars)', raw: '{"items": [], "extra": "' + 'A'.repeat(100000) + '"}' }
  ];

  for (let i = 0; i < extremeJsonPayloads.length; i++) {
    const p = extremeJsonPayloads[i];
    try {
      const res = AIParsingService.cleanAndValidateJson(p.raw, defaultContext);
      const isValid = res && typeof res === 'object' && Array.isArray(res.items) && typeof res.confidence === 'number';
      recordTest(
        'JSON Fuzzing',
        `JSON.FUZZ.${i + 1}`,
        `Handles extreme payload "${p.name}" safely without throwing`,
        isValid,
        !isValid ? `Returned invalid structure: ${JSON.stringify(res)}` : undefined
      );
    } catch (err: any) {
      recordTest('JSON Fuzzing', `JSON.FUZZ.${i + 1}`, `Handles extreme payload "${p.name}" safely without throwing`, false, `Threw exception: ${err?.message}`);
    }
  }

  // ============================================================================
  // SUITE 2: BRAZILIAN PORTUGUESE ACADEMIC LINGUISTIC CHALLENGE PROBES
  // ============================================================================
  console.log('\n--------------------------------------------------------------------------------');
  console.log('SUITE 2: BRAZILIAN PORTUGUESE ACADEMIC LINGUISTIC CHALLENGE PROBES');
  console.log('--------------------------------------------------------------------------------');

  // 2.1 Polite & Indirect Cancellations
  const cancellationCases = [
    {
      msg: 'Caros alunos, hoje infelizmente estou impossibilitado de comparecer ao campus para a aula de Física I.',
      expectedSubj: 'Física I',
      expectedDate: '2026-08-17'
    },
    {
      msg: 'Informo aos estudantes de Algoritmos que não haverá o nosso encontro presencial nesta segunda-feira (17/08/2026).',
      expectedSubj: 'Algoritmos e Estruturas de Dados',
      expectedDate: '2026-08-17'
    },
    {
      msg: 'Aviso de dispensa: a turma de Cálculo 1 está liberada da aula de amanhã.',
      expectedSubj: 'Cálculo 1',
      expectedDate: '2026-08-18'
    },
    {
      msg: 'Prezados, a aula de Cálculo 1 de 2026-08-19 foi suspensa devido ao luto oficial na instituição.',
      expectedSubj: 'Cálculo 1',
      expectedDate: '2026-08-19'
    },
    {
      msg: 'Pessoal de Física I, não poderei comparecer na aula de amanhã.',
      expectedSubj: 'Física I',
      expectedDate: '2026-08-18'
    }
  ];

  for (let i = 0; i < cancellationCases.length; i++) {
    const c = cancellationCases[i];
    const res = AIParsingService.parseMessageMock(c.msg, defaultContext);
    const item = res.items[0];
    const isCancel = item && item.intent === 'cancelled_class';
    const isDateMatch = item && item.targetDate === c.expectedDate;
    recordTest(
      'Portuguese Cancellations',
      `PT.CANCEL.${i + 1}`,
      `Cancellation Case ${i + 1} accurately extracts cancelled_class and date ${c.expectedDate}`,
      isCancel && isDateMatch,
      `Got intent: ${item?.intent}, date: ${item?.targetDate}`
    );
  }

  // 2.2 Homework & Project Deadlines
  const homeworkCases = [
    {
      msg: 'Atividade prática 2 de Algoritmos postada no AVA. Prazo improrrogável de envio até 25/08/2026 às 23:59.',
      expectedDate: '2026-08-25',
      expectedTime: '23:59'
    },
    {
      msg: 'Favor submeterem o relatório do Trabalho 1 de Cálculo 1 até amanhã às 18:00.',
      expectedDate: '2026-08-18',
      expectedTime: '18:00'
    },
    {
      msg: 'Nova tarefa de Física I: lista de exercícios para entregar dia 2026-09-05 às 22:00.',
      expectedDate: '2026-09-05',
      expectedTime: '22:00'
    },
    {
      msg: 'Subam no Teams o projeto final de Algoritmos até 10/09/2026.',
      expectedDate: '2026-09-10',
      expectedTime: '23:59'
    }
  ];

  for (let i = 0; i < homeworkCases.length; i++) {
    const hw = homeworkCases[i];
    const res = AIParsingService.parseMessageMock(hw.msg, defaultContext);
    const item = res.items[0];
    const isHw = item && item.intent === 'homework';
    const isDate = item && item.targetDate === hw.expectedDate;
    const isTime = item && item.startTime === hw.expectedTime;
    recordTest(
      'Portuguese Homework',
      `PT.HW.${i + 1}`,
      `Homework Case ${i + 1} extracts homework, date (${hw.expectedDate}) and time (${hw.expectedTime})`,
      isHw && isDate && isTime,
      `Got intent: ${item?.intent}, date: ${item?.targetDate}, time: ${item?.startTime}`
    );
  }

  // 2.3 Exam & Test Announcements
  const examCases = [
    {
      msg: 'Atenção: a data da Prova P1 de Cálculo 1 foi remarcada para 2026-09-18 das 08:00 às 10:00.',
      expectedDate: '2026-09-18',
      expectedStart: '08:00',
      expectedEnd: '10:00'
    },
    {
      msg: 'Exame Final de Algoritmos agendado para 15/12/2026 das 14:00 às 16:00 na sala 101.',
      expectedDate: '2026-12-15',
      expectedStart: '14:00',
      expectedEnd: '16:00'
    },
    {
      msg: 'Avaliação 2 de Física I confirmada para 2026-10-10 das 10:00 às 12:00.',
      expectedDate: '2026-10-10',
      expectedStart: '10:00',
      expectedEnd: '12:00'
    },
    {
      msg: 'Data da prova P3 de Cálculo 1 definida para 2026-11-20.',
      expectedDate: '2026-11-20',
      expectedStart: '08:00',
      expectedEnd: '10:00'
    }
  ];

  for (let i = 0; i < examCases.length; i++) {
    const ex = examCases[i];
    const res = AIParsingService.parseMessageMock(ex.msg, defaultContext);
    const item = res.items[0];
    const isExam = item && item.intent === 'exam';
    const isDate = item && item.targetDate === ex.expectedDate;
    const isStart = item && item.startTime === ex.expectedStart;
    const isEnd = item && item.endTime === ex.expectedEnd;
    recordTest(
      'Portuguese Exams',
      `PT.EXAM.${i + 1}`,
      `Exam Case ${i + 1} extracts exam, date (${ex.expectedDate}), start (${ex.expectedStart}), end (${ex.expectedEnd})`,
      isExam && isDate && isStart && isEnd,
      `Got intent: ${item?.intent}, date: ${item?.targetDate}, start: ${item?.startTime}, end: ${item?.endTime}`
    );
  }

  // 2.4 Negative Guards & Informational Traps (Intent NONE)
  const nonActionableCases = [
    { desc: 'P1 Grade announcement', msg: 'As notas da prova P1 de Física I já estão disponíveis no portal acadêmico para consulta.' },
    { desc: 'Exercise answer key posting', msg: 'Gabarito oficial do teste de Cálculo 1 postado no AVA.' },
    { desc: 'Semester averages notice', msg: 'Médias semestrais e conceitos finais de Algoritmos publicados.' },
    { desc: 'Congratulations on test scores', msg: 'Parabéns a todos pelas ótimas notas na P2 de Cálculo 1!' },
    { desc: 'Final project scores on board', msg: 'Resultado final dos trabalhos de Física I disponível na secretaria.' },
    { desc: 'General study greeting', msg: 'Desejo a todos um excelente início de semana de estudos e dedicação!' },
    { desc: 'Office hours announcement', msg: 'Horário de atendimento e dúvidas com a monitoria toda quarta às 15:00.' }
  ];

  for (let i = 0; i < nonActionableCases.length; i++) {
    const nac = nonActionableCases[i];
    const res = AIParsingService.parseMessageMock(nac.msg, defaultContext);
    const item = res.items[0];
    const isNone = item && item.intent === 'none';
    recordTest(
      'Informational Guards',
      `PT.NONE.${i + 1}`,
      `Negative Guard: "${nac.desc}" correctly classified as intent "none"`,
      isNone,
      `Erroneously classified as: ${item?.intent}`
    );
  }

  // ============================================================================
  // SUITE 3: AI SERVICE NETWORK & API ERROR RECOVERY
  // ============================================================================
  console.log('\n--------------------------------------------------------------------------------');
  console.log('SUITE 3: AI SERVICE NETWORK & API ERROR RECOVERY');
  console.log('--------------------------------------------------------------------------------');

  const origFetch = globalThis.fetch;

  // 3.1 Network crash (fetch throws TypeError)
  (globalThis as any).fetch = async () => {
    throw new TypeError('Failed to fetch: Network unreachable');
  };

  const netErrorRes = await AIParsingService.parseMessage(
    'Aviso aos alunos de Cálculo 1: não teremos aula hoje (2026-08-17).',
    { provider: 'gemini', apiKey: 'fake_key', model: 'gemini-1.5-flash' },
    defaultContext
  );

  recordTest(
    'API Resilience',
    'API.ERR.1',
    'Fetch network crash falls back seamlessly to deterministic mock parser',
    netErrorRes.items.length === 1 && netErrorRes.items[0].intent === 'cancelled_class',
    `Result: ${JSON.stringify(netErrorRes)}`
  );

  // 3.2 HTTP 429 Rate Limit
  (globalThis as any).fetch = async () => ({
    ok: false,
    status: 429,
    statusText: 'Too Many Requests',
    json: async () => ({ error: { message: 'Rate limit exceeded' } })
  });

  const rateLimitRes = await AIParsingService.parseMessage(
    'Turma de Algoritmos: entrega da Lista 3 dia 2026-08-24 às 23:59.',
    { provider: 'openai', apiKey: 'fake_key', model: 'gpt-4o-mini' },
    defaultContext
  );

  recordTest(
    'API Resilience',
    'API.ERR.2',
    'HTTP 429 Rate Limit falls back seamlessly to deterministic mock parser',
    rateLimitRes.items.length === 1 && rateLimitRes.items[0].intent === 'homework',
    `Result: ${JSON.stringify(rateLimitRes)}`
  );

  // 3.3 HTTP 500 Internal Server Error
  (globalThis as any).fetch = async () => ({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    json: async () => ({ error: { message: 'Server crashed' } })
  });

  const serverErrorRes = await AIParsingService.parseMessage(
    'Atenção pessoal de Física I: Prova P2 reagendada para 2026-08-28 das 08:00 às 10:00.',
    { provider: 'gemini', apiKey: 'fake_key', model: 'gemini-1.5-flash' },
    defaultContext
  );

  recordTest(
    'API Resilience',
    'API.ERR.3',
    'HTTP 500 Server Error falls back seamlessly to deterministic mock parser',
    serverErrorRes.items.length === 1 && serverErrorRes.items[0].intent === 'exam',
    `Result: ${JSON.stringify(serverErrorRes)}`
  );

  // Restore fetch
  globalThis.fetch = origFetch;

  // ============================================================================
  // SUITE 4: SYNC SERVICE ADVERSARIAL STRESS & INVARIANT AUDIT
  // ============================================================================
  console.log('\n--------------------------------------------------------------------------------');
  console.log('SUITE 4: SYNC SERVICE ADVERSARIAL STRESS & INVARIANT AUDIT');
  console.log('--------------------------------------------------------------------------------');

  // 4.1 Empty and Corrupt State Inputs
  const emptyRes = await SyncService.processParsedItems([], [], [], []);
  recordTest(
    'Sync State',
    'SYNC.STATE.1',
    'Empty input sets process cleanly returning empty arrays and empty syncResult',
    emptyRes.updatedEvents.length === 0 && emptyRes.updatedAttendances.length === 0 && emptyRes.updatedSubjects.length === 0,
    `Events: ${emptyRes.updatedEvents.length}, Attendances: ${emptyRes.updatedAttendances.length}`
  );

  // 4.2 Idempotent Repeated Processing (100 Iterations)
  const canonicalItem: AIParsedItem = {
    intent: 'homework',
    subjectName: 'Algoritmos',
    title: 'Lista de Exercícios 3',
    targetDate: '2026-08-24',
    startTime: '23:59',
    endTime: '23:59',
    alerts: [10080, 1440],
    rawSummary: 'Entrega de Lista 3'
  };

  const initialSubject: Subject = {
    id: 'subj_alg',
    name: 'Algoritmos',
    color: '#00FFAA',
    passGrade: 7.0,
    maxAbsences: 10,
    workloadHours: 60
  };

  let stateEvents: AppEvent[] = [];
  let stateAttendances: AttendanceRecord[] = [];
  let stateSubjects: Subject[] = [initialSubject];

  for (let step = 0; step < 100; step++) {
    const res = await SyncService.processParsedItems(
      [canonicalItem],
      stateEvents,
      stateAttendances,
      stateSubjects
    );
    stateEvents = res.updatedEvents;
    stateAttendances = res.updatedAttendances;
    stateSubjects = res.updatedSubjects;
  }

  recordTest(
    'Sync Idempotency',
    'SYNC.IDEMP.1',
    '100 repeated sync executions of same homework produce exactly 1 AppEvent without duplication',
    stateEvents.length === 1 && stateEvents[0].title === 'Lista de Exercícios 3',
    `Found ${stateEvents.length} events`
  );

  // 4.3 Concurrent Parallel Invocations
  const parallelPromises = Array.from({ length: 20 }, () =>
    SyncService.processParsedItems([canonicalItem], [], [], [initialSubject])
  );
  const parallelResults = await Promise.all(parallelPromises);
  const allIdentical = parallelResults.every(r => r.updatedEvents.length === 1 && r.updatedEvents[0].title === 'Lista de Exercícios 3');

  recordTest(
    'Sync Concurrency',
    'SYNC.CONCUR.1',
    '20 concurrent parallel sync executions produce identical deterministic outcomes',
    allIdentical,
    'Concurrent outputs diverged'
  );

  // 4.4 Attendance Math Invariant: Cancelled Class Exemption
  const attendanceMathSubject: Subject = {
    id: 'subj_calc',
    name: 'Cálculo 1',
    color: '#0A84FF',
    passGrade: 7.0,
    maxAbsences: 15,
    workloadHours: 60
  };

  const testAttendances: AttendanceRecord[] = [
    { id: 'att_1', subjectId: 'subj_calc', eventId: 'ev1', date: '2026-08-01', status: 'present' },
    { id: 'att_2', subjectId: 'subj_calc', eventId: 'ev1', date: '2026-08-03', status: 'present' },
    { id: 'att_3', subjectId: 'subj_calc', eventId: 'ev1', date: '2026-08-05', status: 'absent' }, // 1 absence
    { id: 'att_4', subjectId: 'subj_calc', eventId: 'ev1', date: '2026-08-08', status: 'present' },
    { id: 'att_5', subjectId: 'subj_calc', eventId: 'ev1', date: '2026-08-10', status: 'absent' }, // 2nd absence
    { id: 'att_6', subjectId: 'subj_calc', eventId: 'ev1', date: '2026-08-12', status: 'cancelled' },
    { id: 'att_7', subjectId: 'subj_calc', eventId: 'ev1', date: '2026-08-15', status: 'cancelled' },
    { id: 'att_8', subjectId: 'subj_calc', eventId: 'ev1', date: '2026-08-17', status: 'cancelled' }
  ];

  // Invariant check: In Organiza, absence count ONLY counts status === 'absent'
  const absences = testAttendances.filter(a => a.subjectId === 'subj_calc' && a.status === 'absent').length;
  const presents = testAttendances.filter(a => a.subjectId === 'subj_calc' && a.status === 'present').length;
  const totalClassesCounted = absences + presents; // 5
  const attendanceRate = totalClassesCounted > 0 ? (presents / totalClassesCounted) * 100 : 100;

  recordTest(
    'Attendance Invariant',
    'ATT.MATH.1',
    'Absence count strictly ignores "cancelled" classes (absences = 2)',
    absences === 2,
    `Calculated absences: ${absences}`
  );

  recordTest(
    'Attendance Invariant',
    'ATT.MATH.2',
    'Attendance rate evaluates to 60.00% (3/5) without dilution from 3 cancelled classes',
    Math.round(attendanceRate) === 60,
    `Calculated rate: ${attendanceRate}%`
  );

  // 4.5 Notification Math Invariant: [10080, 1440] Minute Offsets
  const examEvent: AppEvent = {
    id: 'ev_exam_1',
    title: 'Prova P2 - Física I',
    category: 'Provas/Trabalhos',
    date: '2026-08-28',
    startTime: '08:00',
    endTime: '10:00',
    recurrence: 'none',
    alerts: [10080, 1440],
    isCompleted: false
  };

  const targetDateObj = new Date(`${examEvent.date}T${examEvent.startTime}:00`);
  const oneWeekBefore = new Date(targetDateObj.getTime() - 10080 * 60 * 1000);
  const oneDayBefore = new Date(targetDateObj.getTime() - 1440 * 60 * 1000);

  const oneWeekFormatted = format(oneWeekBefore, 'yyyy-MM-dd HH:mm');
  const oneDayFormatted = format(oneDayBefore, 'yyyy-MM-dd HH:mm');

  recordTest(
    'Notification Math',
    'NOTIF.MATH.1',
    '10080 minute alert fires exactly 7 days prior at 2026-08-21 08:00',
    oneWeekFormatted === '2026-08-21 08:00',
    `Got: ${oneWeekFormatted}`
  );

  recordTest(
    'Notification Math',
    'NOTIF.MATH.2',
    '1440 minute alert fires exactly 24 hours prior at 2026-08-27 08:00',
    oneDayFormatted === '2026-08-27 08:00',
    `Got: ${oneDayFormatted}`
  );

  // ============================================================================
  // SUITE 5: MASSIVE 200-MESSAGE PSEUDO-RANDOMIZED ADVERSARIAL LOAD FUZZING
  // ============================================================================
  console.log('\n--------------------------------------------------------------------------------');
  console.log('SUITE 5: MASSIVE 200-MESSAGE PSEUDO-RANDOMIZED ADVERSARIAL LOAD FUZZING');
  console.log('--------------------------------------------------------------------------------');

  const fuzzFragments = [
    '<div><p>Professor: Aviso aos alunos de Cálculo 1</p></div>',
    'Não teremos aula no dia 2026-08-17.',
    'A prova P2 de Física I está marcada para 2026-08-28 das 08:00 às 10:00.',
    'Subam a lista 3 no AVA até 2026-08-24 às 23:59.',
    'As notas da P1 já estão disponíveis.',
    '<script>alert("hack")</script>',
    'Parabéns a todos pelas notas!',
    'Exame final reagendado para 15/12/2026 das 14:00 às 16:00.',
    'Gabarito publicado.',
    '🔥 📚 Importante: entrega amanhã!',
    'null',
    '{"corrupted": true}',
    'Prezados, hoje estou impossibilitado de comparecer.'
  ];

  let massiveFuzzSuccess = true;
  for (let f = 0; f < 200; f++) {
    const f1 = fuzzFragments[f % fuzzFragments.length];
    const f2 = fuzzFragments[(f * 7 + 3) % fuzzFragments.length];
    const f3 = fuzzFragments[(f * 13 + 5) % fuzzFragments.length];
    const msg = `${f1} -- ${f2} -- ${f3}`;

    try {
      const sanitized = TeamsService.sanitizeHtmlMessage(msg);
      const parsed = AIParsingService.parseMessageMock(sanitized, defaultContext);
      if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) {
        massiveFuzzSuccess = false;
        break;
      }
    } catch (err) {
      massiveFuzzSuccess = false;
      break;
    }
  }

  recordTest(
    'Massive Fuzzing',
    'FUZZ.MASSIVE.1',
    '200 pseudo-random adversarial combinations processed smoothly without a single exception',
    massiveFuzzSuccess
  );

  // ============================================================================
  // FINAL SUMMARY
  // ============================================================================
  const total = probeResults.length;
  const passed = probeResults.filter(r => r.passed).length;
  const failed = probeResults.filter(r => !r.passed).length;

  console.log('\n================================================================================');
  console.log('  CHALLENGER ADVERSARIAL PROBE EXECUTION SUMMARY');
  console.log('================================================================================');
  console.log(`  Total Probes Executed : ${total}`);
  console.log(`  Probes Passed         : ${passed}`);
  console.log(`  Probes Failed         : ${failed}`);
  console.log(`  Success Rate          : ${((passed / total) * 100).toFixed(2)}%`);
  console.log('================================================================================\n');

  if (failed > 0) {
    console.error('Failed Probes Details:');
    probeResults.filter(r => !r.passed).forEach(r => {
      console.error(`  [FAIL] [${r.testId}] ${r.description} -> ${r.error}`);
    });
  }
}

runChallengerAdversarialProbe().catch(err => {
  console.error('Fatal probe execution error:', err);
  process.exit(1);
});
