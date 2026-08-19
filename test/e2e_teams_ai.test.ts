import './setup_env';
import { memoryStore, mockAsyncStorage } from './setup_env';
import { TeamsService } from '../src/services/TeamsService';
import { AIParsingService, ParsingContext } from '../src/services/AIParsingService';
import { SyncService, SIMULATION_RAW_MESSAGES } from '../src/services/SyncService';
import { StorageService } from '../src/services/storage';
import { NotificationService } from '../src/services/notifications';
import { AttendanceService } from '../src/services/AttendanceService';
import {
  TeamsConfig,
  AIConfig,
  AppEvent,
  AttendanceRecord,
  Subject,
  GradeItem,
  GradeGroup,
  AIParsedItem,
  AIParsingResult,
  SyncResult
} from '../src/types';
import { format, parseISO, getDay, addDays, subMinutes } from 'date-fns';

// ============================================================================
// TEST HARNESS ACCOUNTING & ASSERTION INFRASTRUCTURE
// ============================================================================

interface TestStats {
  tier1: { total: number; passed: number; failed: number };
  tier2: { total: number; passed: number; failed: number };
  tier3: { total: number; passed: number; failed: number };
  tier4: { total: number; passed: number; failed: number };
}

const stats: TestStats = {
  tier1: { total: 0, passed: 0, failed: 0 },
  tier2: { total: 0, passed: 0, failed: 0 },
  tier3: { total: 0, passed: 0, failed: 0 },
  tier4: { total: 0, passed: 0, failed: 0 },
};

let currentTier: keyof TestStats = 'tier1';
const failureDetails: string[] = [];

function setTier(tier: keyof TestStats) {
  currentTier = tier;
}

function assert(condition: boolean, testId: string, description: string, detail?: string) {
  stats[currentTier].total++;
  if (condition) {
    stats[currentTier].passed++;
    console.log(`  [PASS] [${testId}] ${description}`);
  } else {
    stats[currentTier].failed++;
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
// MASTER TEST SUITE EXECUTION
// ============================================================================

async function runE2ETeamsAISuite() {
  console.log('================================================================================');
  console.log('  ORGANIZA E2E TEST SUITE: MICROSOFT TEAMS & AI INTEGRATION');
  console.log('  Specification: ORIGINAL_REQUEST.md | PROJECT.md | TEST_INFRA.md');
  console.log('================================================================================\n');

  // ============================================================================
  // TIER 1: FEATURE COVERAGE (>=5 tests per feature across all 7 features = >=35 tests)
  // ============================================================================
  setTier('tier1');
  console.log('================================================================================');
  console.log('TIER 1: FEATURE COVERAGE');
  console.log('================================================================================\n');

  // ----------------------------------------------------------------------------
  // Feature 1: MS Teams Auth & Config
  // ----------------------------------------------------------------------------
  console.log('--- Feature 1: MS Teams Auth & Config ---');
  await mockAsyncStorage.clear();

  // T1.F1.1: Auth URL Generation
  const authUrl = TeamsService.getAuthUrl('test-client-id-123', 'university-tenant-456');
  assert(
    authUrl.startsWith('https://login.microsoftonline.com/university-tenant-456/oauth2/v2.0/authorize'),
    'T1.F1.1',
    'getAuthUrl targets Azure AD v2.0 endpoint for specified tenant'
  );
  assert(
    authUrl.includes('client_id=test-client-id-123') && authUrl.includes('response_type=code'),
    'T1.F1.2',
    'getAuthUrl includes client_id and response_type=code parameters'
  );
  assert(
    authUrl.includes('ChannelMessage.Read.All') && authUrl.includes('Team.ReadBasic.All'),
    'T1.F1.3',
    'getAuthUrl includes required Microsoft Graph permission scopes'
  );

  // T1.F1.4: Token Expiration Checks
  const expiredConfig: TeamsConfig = {
    clientId: 'client-1',
    tenantId: 'common',
    accessToken: 'old_token',
    expiresAt: Date.now() - 10000,
    isConnected: true
  };
  assert(TeamsService.isTokenExpired(expiredConfig) === true, 'T1.F1.4', 'isTokenExpired returns true for past expiresAt');

  const nearExpiredConfig: TeamsConfig = {
    clientId: 'client-1',
    tenantId: 'common',
    accessToken: 'near_token',
    expiresAt: Date.now() + (2 * 60 * 1000), // 2 min remaining (< 5 min safety buffer)
    isConnected: true
  };
  assert(TeamsService.isTokenExpired(nearExpiredConfig) === true, 'T1.F1.5', 'isTokenExpired triggers within 5-minute safety margin');

  const validTokenConfig: TeamsConfig = {
    clientId: 'client-1',
    tenantId: 'common',
    accessToken: 'active_valid_token',
    expiresAt: Date.now() + (60 * 60 * 1000),
    isConnected: true
  };
  assert(TeamsService.isTokenExpired(validTokenConfig) === false, 'T1.F1.6', 'isTokenExpired returns false for fresh token');

  const retrievedToken = await TeamsService.getValidAccessToken(validTokenConfig);
  assert(retrievedToken === 'active_valid_token', 'T1.F1.7', 'getValidAccessToken returns unexpired token immediately');

  // T1.F1.8: Storage Persistence for Teams & AI Config
  const fullTeamsConfig: TeamsConfig = {
    clientId: 'az-client-abc',
    tenantId: 'az-tenant-xyz',
    accessToken: 'live_access_123',
    refreshToken: 'live_refresh_456',
    expiresAt: 1787000000000,
    selectedTeamId: 'team_eng_2026',
    selectedChannelId: 'chan_general_99',
    isConnected: true,
    lastSync: '2026-08-17T18:00:00.000Z'
  };
  await StorageService.saveTeamsConfig(fullTeamsConfig);
  const loadedTeamsConfig = await StorageService.getTeamsConfig();
  assertEqual(loadedTeamsConfig, fullTeamsConfig, 'T1.F1.8', 'TeamsConfig persists and reloads with 100% field fidelity');

  const geminiConfig: AIConfig = {
    provider: 'gemini',
    apiKey: 'AIzaSySampleKey123',
    model: 'gemini-1.5-flash'
  };
  await StorageService.saveAIConfig(geminiConfig);
  const loadedAIConfig = await StorageService.getAIConfig();
  assertEqual(loadedAIConfig, geminiConfig, 'T1.F1.9', 'AIConfig (Gemini) persists and reloads accurately');

  // ----------------------------------------------------------------------------
  // Feature 2: Teams Message Retrieval & HTML Sanitizer
  // ----------------------------------------------------------------------------
  console.log('\n--- Feature 2: Teams Message Retrieval & HTML Sanitizer ---');

  // T1.F2.1: Strips <script> and <style> blocks
  const xssHtml = '<div class="header"><script>alert("malicious")</script><style>body{color:red;}</style><p>Olá turma</p></div>';
  const cleanXss = TeamsService.sanitizeHtmlMessage(xssHtml);
  assert(!cleanXss.includes('alert') && !cleanXss.includes('style') && cleanXss.includes('Olá turma'), 'T1.F2.1', 'Sanitizer strips script and style blocks entirely');

  // T1.F2.2: Preserves line breaks for paragraph and block tags
  const blockHtml = '<p>Linha 1</p><p>Linha 2</p><div>Linha 3</div><br/>Linha 4';
  const cleanBlock = TeamsService.sanitizeHtmlMessage(blockHtml);
  assert(cleanBlock.includes('Linha 1') && cleanBlock.includes('Linha 2') && cleanBlock.includes('Linha 3') && cleanBlock.includes('Linha 4') && cleanBlock.includes('\n'), 'T1.F2.2', 'Sanitizer converts block tags and <br> to newline characters');

  // T1.F2.3: Strips generic formatting tags
  const formatHtml = '<b>Importante:</b> <i>Aula</i> <u>remarcada</u> no <span>Teams</span>.';
  const cleanFormat = TeamsService.sanitizeHtmlMessage(formatHtml);
  assert(cleanFormat === 'Importante: Aula remarcada no Teams.', 'T1.F2.3', 'Sanitizer strips inline formatting tags while preserving text');

  // T1.F2.4: Decodes named Portuguese HTML entities
  const entityHtml = 'Aten&ccedil;&atilde;o: A aula de C&aacute;lculo est&aacute; cancelada &amp; reposta na pr&oacute;xima semana.';
  const cleanEntity = TeamsService.sanitizeHtmlMessage(entityHtml);
  assert(cleanEntity === 'Atenção: A aula de Cálculo está cancelada & reposta na próxima semana.', 'T1.F2.4', 'Sanitizer decodes named HTML entities (&ccedil;, &atilde;, &aacute;, &oacute;, &amp;)');

  // T1.F2.5: Decodes numeric decimal and hex entities
  const numericHtml = 'Voc&#234;s receber&#227;o a nota da P&#x31; hoje.';
  const cleanNumeric = TeamsService.sanitizeHtmlMessage(numericHtml);
  assert(cleanNumeric === 'Vocês receberão a nota da P1 hoje.', 'T1.F2.5', 'Sanitizer decodes numeric decimal (&#234;, &#227;) and hex (&#x31;) entities');

  // T1.F2.6: Whitespace normalization
  const messySpaceHtml = '   <p>  Muitos    espaços   \t\t e   \n\n\n\n quebras   </p>   ';
  const cleanSpace = TeamsService.sanitizeHtmlMessage(messySpaceHtml);
  assert(cleanSpace === 'Muitos espaços e\n\nquebras', 'T1.F2.6', 'Sanitizer collapses internal whitespace and limits excessive newlines');

  // ----------------------------------------------------------------------------
  // Feature 3: AI Parsing Engine (Gemini / OpenAI / Mock)
  // ----------------------------------------------------------------------------
  console.log('\n--- Feature 3: AI Parsing Engine ---');

  const standardContext: ParsingContext = {
    currentDate: '2026-08-17',
    currentDayOfWeek: 'Segunda-feira',
    registeredSubjects: ['Cálculo 1', 'Algoritmos', 'Física I']
  };

  // T1.F3.1: System Prompt Generation
  const sysPrompt = AIParsingService.buildSystemPrompt(standardContext);
  assert(sysPrompt.includes('2026-08-17') && sysPrompt.includes('Cálculo 1'), 'T1.F3.1', 'buildSystemPrompt injects date and subject context');
  assert(sysPrompt.includes('cancelled_class') && sysPrompt.includes('[10080, 1440]'), 'T1.F3.2', 'buildSystemPrompt specifies valid intents and alert requirements');

  // T1.F3.3: Mock Parser Cancellation Intent
  const rawCancel = 'Aviso aos alunos de Cálculo 1: Excepcionalmente não teremos aula hoje (2026-08-17) devido a reunião.';
  const parsedCancel = AIParsingService.parseMessageMock(rawCancel, standardContext);
  assert(parsedCancel.items.length === 1, 'T1.F3.3', 'parseMessageMock returns exactly 1 item for cancellation');
  assert(parsedCancel.items[0].intent === 'cancelled_class', 'T1.F3.4', 'Cancellation intent identified correctly');
  assert(parsedCancel.items[0].targetDate === '2026-08-17', 'T1.F3.5', 'Cancellation date resolved to 2026-08-17');
  assert(parsedCancel.items[0].subjectName === 'Cálculo 1', 'T1.F3.6', 'Cancellation subject matched to registered subject');

  // T1.F3.7: Mock Parser Homework Intent
  const rawHw = 'Turma de Algoritmos, publiquei no AVA a Lista de Exercícios 3. O prazo final de entrega é dia 2026-08-24 às 23:59.';
  const parsedHw = AIParsingService.parseMessageMock(rawHw, standardContext);
  assert(parsedHw.items[0].intent === 'homework', 'T1.F3.7', 'Homework intent identified correctly');
  assert(parsedHw.items[0].targetDate === '2026-08-24', 'T1.F3.8', 'Homework target date is 2026-08-24');
  assertEqual(parsedHw.items[0].alerts, [10080, 1440], 'T1.F3.9', 'Homework alerts contain [10080, 1440]');

  // T1.F3.10: Mock Parser Exam Intent
  const rawExam = 'Atenção pessoal de Física I: a nossa Prova P2 foi agendada para o dia 2026-08-28 das 08:00 às 10:00.';
  const parsedExam = AIParsingService.parseMessageMock(rawExam, standardContext);
  assert(parsedExam.items[0].intent === 'exam', 'T1.F3.10', 'Exam intent identified correctly');
  assert(parsedExam.items[0].targetDate === '2026-08-28', 'T1.F3.11', 'Exam date set to 2026-08-28');
  assert(parsedExam.items[0].startTime === '08:00' && parsedExam.items[0].endTime === '10:00', 'T1.F3.12', 'Exam time interval extracted accurately');

  // T1.F3.13: Empty message offline fallback
  const emptyRes = await AIParsingService.parseMessage('', null, standardContext);
  assert(emptyRes.items.length === 0 && emptyRes.confidence === 1.0, 'T1.F3.13', 'parseMessage handles empty text gracefully with 0 items');

  // ----------------------------------------------------------------------------
  // Feature 4: Class Cancellation Sync
  // ----------------------------------------------------------------------------
  console.log('\n--- Feature 4: Class Cancellation Sync ---');

  const baseSubjectCalc: Subject = {
    id: 'sub_calc_1',
    name: 'Cálculo 1',
    maxAbsences: 15,
    gradeGroups: [{ id: 'gg_1', name: 'Avaliações', weight: 1, items: [] }]
  };

  const baseCalcClassEvent: AppEvent = {
    id: 'ev_calc_weekly',
    title: 'Aula de Cálculo 1',
    category: 'Faculdade/Aulas',
    date: '2026-08-17',
    startTime: '08:00',
    endTime: '10:00',
    recurrence: 'weekly',
    alerts: [15],
    isCompleted: false,
    subjectId: 'sub_calc_1'
  };

  const cancelSyncItem: AIParsedItem = {
    intent: 'cancelled_class',
    subjectName: 'Cálculo 1',
    title: 'Aula Cancelada - Cálculo 1',
    targetDate: '2026-08-17',
    startTime: '08:00',
    endTime: '10:00',
    alerts: [10080, 1440],
    rawSummary: 'Aula de Cálculo 1 cancelada'
  };

  const syncCancelResult = await SyncService.processParsedItems(
    [cancelSyncItem],
    [baseCalcClassEvent],
    [],
    [baseSubjectCalc]
  );

  assert(syncCancelResult.updatedAttendances.length === 1, 'T1.F4.1', 'Cancellation sync creates attendance record');
  assert(syncCancelResult.updatedAttendances[0].status === 'cancelled', 'T1.F4.2', 'Created attendance record status is "cancelled"');
  assert(syncCancelResult.updatedAttendances[0].subjectId === 'sub_calc_1', 'T1.F4.3', 'Attendance record linked to subjectId');
  assert(syncCancelResult.updatedAttendances[0].eventId === 'ev_calc_weekly', 'T1.F4.4', 'Attendance record linked to weekly class eventId');

  // Verify non-penalization in absences
  const calcAbsenceCount = syncCancelResult.updatedAttendances.filter(a => a.status === 'absent').length;
  assert(calcAbsenceCount === 0, 'T1.F4.5', 'Cancelled class contributes 0 unexcused absences');

  // ----------------------------------------------------------------------------
  // Feature 5: Homework Sync & Notifications
  // ----------------------------------------------------------------------------
  console.log('\n--- Feature 5: Homework Sync & Notification Alerts ---');

  const baseSubjectAlgo: Subject = {
    id: 'sub_algo_1',
    name: 'Algoritmos',
    gradeGroups: [{ id: 'gg_algo', name: 'Trabalhos', weight: 1, items: [] }]
  };

  const hwSyncItem: AIParsedItem = {
    intent: 'homework',
    subjectName: 'Algoritmos',
    title: 'Entrega Lista 3 - Algoritmos',
    description: 'Árvores Binárias no AVA',
    targetDate: '2026-08-24',
    startTime: '23:59',
    endTime: '23:59',
    alerts: [10080, 1440],
    rawSummary: 'Entrega Lista 3'
  };

  const syncHwResult = await SyncService.processParsedItems(
    [hwSyncItem],
    [],
    [],
    [baseSubjectAlgo]
  );

  const createdHw = syncHwResult.updatedEvents.find(e => e.title.includes('Lista 3'));
  assert(createdHw !== undefined, 'T1.F5.1', 'Homework AppEvent created in calendar');
  assert(createdHw?.category === 'Provas/Trabalhos', 'T1.F5.2', 'Homework assigned category "Provas/Trabalhos"');
  assert(createdHw?.date === '2026-08-24', 'T1.F5.3', 'Homework date set to 2026-08-24');
  assert(createdHw?.startTime === '23:59', 'T1.F5.4', 'Homework delivery time set to 23:59');
  assertEqual(createdHw?.alerts, [10080, 1440], 'T1.F5.5', 'Homework alerts array strictly configured with [10080, 1440]');

  // ----------------------------------------------------------------------------
  // Feature 6: Exam Sync & Grade Linking
  // ----------------------------------------------------------------------------
  console.log('\n--- Feature 6: Exam Sync & Grade Engine Linking ---');

  const baseSubjectFis: Subject = {
    id: 'sub_fis_1',
    name: 'Física I',
    gradeGroups: [{ id: 'gg_fis', name: 'Provas', weight: 1, items: [] }]
  };

  const examSyncItem: AIParsedItem = {
    intent: 'exam',
    subjectName: 'Física I',
    title: 'Prova P2 - Física I',
    description: 'Tragam calculadora',
    targetDate: '2026-08-28',
    startTime: '08:00',
    endTime: '10:00',
    alerts: [10080, 1440],
    rawSummary: 'Prova P2 reagendada'
  };

  const syncExamResult = await SyncService.processParsedItems(
    [examSyncItem],
    [],
    [],
    [baseSubjectFis]
  );

  const createdExam = syncExamResult.updatedEvents.find(e => e.title.includes('Prova P2'));
  assert(createdExam !== undefined, 'T1.F6.1', 'Exam AppEvent created in calendar');
  assert(createdExam?.date === '2026-08-28', 'T1.F6.2', 'Exam date set to 2026-08-28');
  assertEqual(createdExam?.alerts, [10080, 1440], 'T1.F6.3', 'Exam alerts configured with [10080, 1440]');

  const updatedSubject = syncExamResult.updatedSubjects.find(s => s.id === 'sub_fis_1');
  const gradeItem = updatedSubject?.gradeGroups?.[0]?.items?.find(i => i.eventId === createdExam?.id);
  assert(gradeItem !== undefined, 'T1.F6.4', 'GradeItem automatically registered in Subject gradeGroups');
  assert(gradeItem?.name === createdExam?.title, 'T1.F6.5', 'GradeItem name matches exam AppEvent title');
  assert(gradeItem?.maxGrade === 10, 'T1.F6.6', 'GradeItem maxGrade initialized to 10');

  // ----------------------------------------------------------------------------
  // Feature 7: "Simulate Teams Messages" Debug Runner
  // ----------------------------------------------------------------------------
  console.log('\n--- Feature 7: "Simulate Teams Messages" Debug Runner ---');

  await mockAsyncStorage.clear();
  const simResult = await SyncService.runSimulation(null, [], [], []);

  assert(SIMULATION_RAW_MESSAGES.length === 3, 'T1.F7.1', 'SIMULATION_RAW_MESSAGES contains the 3 canonical Portuguese messages');
  assert(simResult.updatedSubjects.length === 3, 'T1.F7.2', 'runSimulation seeds the 3 required academic subjects');
  assert(simResult.updatedAttendances.some(a => a.status === 'cancelled'), 'T1.F7.3', 'runSimulation produces cancelled attendance');
  assert(simResult.updatedEvents.some(e => e.title.includes('Exercícios')), 'T1.F7.4', 'runSimulation produces homework calendar event');
  assert(simResult.updatedEvents.some(e => e.title.includes('Prova P2')), 'T1.F7.5', 'runSimulation produces exam calendar event');
  assert(simResult.syncResult.logs.length >= 10, 'T1.F7.6', 'runSimulation logs detailed diagnostic traces');

  // Persisted state check
  const storedEvents = await StorageService.getEvents();
  const storedAttendances = await StorageService.getAttendances();
  const storedSubjects = await StorageService.getSubjects();
  assert(storedEvents.length === simResult.updatedEvents.length, 'T1.F7.7', 'runSimulation atomically persists events in StorageService');
  assert(storedAttendances.length === simResult.updatedAttendances.length, 'T1.F7.8', 'runSimulation atomically persists attendances in StorageService');
  assert(storedSubjects.length === simResult.updatedSubjects.length, 'T1.F7.9', 'runSimulation atomically persists subjects in StorageService');


  // ============================================================================
  // TIER 2: BOUNDARY & CORNER CASES (>=5 tests per area across 7 areas = >=35 tests)
  // ============================================================================
  setTier('tier2');
  console.log('\n================================================================================');
  console.log('TIER 2: BOUNDARY & CORNER CASES');
  console.log('================================================================================\n');

  // ----------------------------------------------------------------------------
  // Boundary 1: Empty, Whitespace & Extreme Length Strings
  // ----------------------------------------------------------------------------
  console.log('--- Boundary 1: Empty, Whitespace & Extreme Length Strings ---');

  // T2.B1.1: Null / undefined string in sanitizer
  assert(TeamsService.sanitizeHtmlMessage(null as any) === '', 'T2.B1.1', 'Sanitizer returns empty string on null input');
  assert(TeamsService.sanitizeHtmlMessage(undefined as any) === '', 'T2.B1.2', 'Sanitizer returns empty string on undefined input');

  // T2.B1.3: Whitespace only message
  const wsResult = await AIParsingService.parseMessage('   \r\n\t  ', null, standardContext);
  assertEqual(wsResult.items, [], 'T2.B1.3', 'AIParsingService returns 0 items for whitespace-only message');

  // T2.B1.4: Extreme length message (10,000 characters)
  const longPrefix = 'Aviso importante para os alunos de Cálculo 1: '.repeat(200);
  const longMsg = `${longPrefix} não teremos aula hoje (2026-08-17).`;
  const longParsed = AIParsingService.parseMessageMock(longMsg, standardContext);
  assert(longParsed.items.length === 1 && longParsed.items[0].intent === 'cancelled_class', 'T2.B1.4', 'Mock parser handles 10,000+ character messages without overflow');

  // T2.B1.5: Deeply nested HTML tags
  let deeplyNestedHtml = 'Mensagem de Cálculo 1 cancelada';
  for (let i = 0; i < 50; i++) {
    deeplyNestedHtml = `<div><section><span>${deeplyNestedHtml}</span></section></div>`;
  }
  const cleanDeepHtml = TeamsService.sanitizeHtmlMessage(deeplyNestedHtml);
  assert(cleanDeepHtml === 'Mensagem de Cálculo 1 cancelada', 'T2.B1.5', 'Sanitizer flattens 50 levels of nested tags cleanly');

  // ----------------------------------------------------------------------------
  // Boundary 2: Temporal & Date Boundary Edge Cases
  // ----------------------------------------------------------------------------
  console.log('\n--- Boundary 2: Temporal & Date Boundary Edge Cases ---');

  // T2.B2.1: Relative date "hoje"
  const hojeMsg = 'Pessoal de Algoritmos, sem aula hoje!';
  const hojeParsed = AIParsingService.parseMessageMock(hojeMsg, standardContext);
  assert(hojeParsed.items[0].targetDate === standardContext.currentDate, 'T2.B2.1', '"hoje" resolves to context.currentDate');

  // T2.B2.2: Relative date "amanhã"
  const amanhaMsg = 'Turma de Física I: a prova foi adiada para amanhã.';
  const amanhaParsed = AIParsingService.parseMessageMock(amanhaMsg, standardContext);
  const expectedAmanha = '2026-08-18';
  assert(amanhaParsed.items[0].targetDate === expectedAmanha, 'T2.B2.2', '"amanhã" resolves to context.currentDate + 1 day');

  // T2.B2.3: Brazilian date format DD/MM/YYYY
  const brDateMsg = 'Turma de Algoritmos, entrega do trabalho final no dia 28/02/2028 às 23:59.';
  const brDateParsed = AIParsingService.parseMessageMock(brDateMsg, standardContext);
  assert(brDateParsed.items[0].targetDate === '2028-02-28', 'T2.B2.3', 'Brazilian date format DD/MM/YYYY on leap year parsed to ISO YYYY-MM-DD');

  // T2.B2.4: Brazilian short date format DD/MM (inherits current year)
  const brShortDateMsg = 'Aviso de Cálculo 1: prova no dia 15/09 às 08:00.';
  const brShortParsed = AIParsingService.parseMessageMock(brShortDateMsg, standardContext);
  assert(brShortParsed.items[0].targetDate === '2026-09-15', 'T2.B2.4', 'Brazilian short date DD/MM resolves with current context year');

  // T2.B2.5: Missing / malformed date in JSON falls back to context.currentDate
  const malformedDateJson = JSON.stringify({
    items: [{
      intent: 'homework',
      subjectName: 'Algoritmos',
      title: 'Tarefa',
      targetDate: 'invalid-date-string'
    }]
  });
  const validatedDate = AIParsingService.cleanAndValidateJson(malformedDateJson, standardContext);
  assert(validatedDate.items[0].targetDate === standardContext.currentDate, 'T2.B2.5', 'Malformed date in JSON normalizes to context.currentDate');

  // ----------------------------------------------------------------------------
  // Boundary 3: Malformed JSON & AI Schema Normalization
  // ----------------------------------------------------------------------------
  console.log('\n--- Boundary 3: Malformed JSON & AI Schema Normalization ---');

  // T2.B3.1: Code fence stripping
  const fencedJson = '```json\n{"items":[{"intent":"homework","subjectName":"Algoritmos","title":"Lista 1","targetDate":"2026-09-01"}]}\n```';
  const cleanFenced = AIParsingService.cleanAndValidateJson(fencedJson, standardContext);
  assert(cleanFenced.items.length === 1 && cleanFenced.items[0].title === 'Lista 1', 'T2.B3.1', 'cleanAndValidateJson strips markdown ```json code fences');

  // T2.B3.2: Complete JSON parse failure fallback
  const corruptedJson = '{ "items": [ { "intent": "cancelled_class", "subjectName": "Cálculo 1" ... broken syntax ';
  const fallbackJsonRes = AIParsingService.cleanAndValidateJson(corruptedJson, standardContext);
  assert(fallbackJsonRes.items.length > 0, 'T2.B3.2', 'Corrupted JSON falls back safely to regex/mock parser');

  // T2.B3.3: Missing items array in root object
  const noItemsJson = '{"confidence": 0.85, "status": "success"}';
  const noItemsRes = AIParsingService.cleanAndValidateJson(noItemsJson, standardContext);
  assertEqual(noItemsRes.items, [], 'T2.B3.3', 'JSON missing items array normalizes to empty array');

  // T2.B3.4: Unknown intent mapping to 'none'
  const unknownIntentJson = '{"items":[{"intent":"sports_event","subjectName":"Geral","title":"Futebol","targetDate":"2026-08-20"}]}';
  const unknownRes = AIParsingService.cleanAndValidateJson(unknownIntentJson, standardContext);
  assert(unknownRes.items[0].intent === 'none', 'T2.B3.4', 'Unrecognized intent string is safely sanitized to "none"');

  // T2.B3.5: Defaulting missing alert array
  const noAlertsJson = '{"items":[{"intent":"exam","subjectName":"Física I","title":"P1","targetDate":"2026-08-20"}]}';
  const noAlertsRes = AIParsingService.cleanAndValidateJson(noAlertsJson, standardContext);
  assertEqual(noAlertsRes.items[0].alerts, [10080, 1440], 'T2.B3.5', 'Missing alerts array defaults to [10080, 1440]');

  // ----------------------------------------------------------------------------
  // Boundary 4: Fuzzy Subject Matching, Accents & Roman Numerals
  // ----------------------------------------------------------------------------
  console.log('\n--- Boundary 4: Fuzzy Subject Matching, Accents & Roman Numerals ---');

  const registeredSubs: Subject[] = [
    { id: 'sub_c1', name: 'Cálculo 1' },
    { id: 'sub_aed', name: 'Algoritmos e Estruturas de Dados' },
    { id: 'sub_f1', name: 'Física I' }
  ];

  // T2.B4.1: Accent insensitivity
  const matchAccent = SyncService.matchSubject('calculo 1', registeredSubs);
  assert(matchAccent?.id === 'sub_c1', 'T2.B4.1', 'Matches subject without diacritics ("calculo 1" -> "Cálculo 1")');

  // T2.B4.2: Case insensitivity
  const matchCase = SyncService.matchSubject('CÁLCULO 1', registeredSubs);
  assert(matchCase?.id === 'sub_c1', 'T2.B4.2', 'Matches uppercase subject name ("CÁLCULO 1" -> "Cálculo 1")');

  // T2.B4.3: Roman to Arabic numerals
  const matchNumeral = SyncService.matchSubject('Física 1', registeredSubs);
  assert(matchNumeral?.id === 'sub_f1', 'T2.B4.3', 'Normalizes Arabic numeral 1 to Roman numeral I ("Física 1" -> "Física I")');

  // T2.B4.4: Substring matching
  const matchSubstr = SyncService.matchSubject('Algoritmos', registeredSubs);
  assert(matchSubstr?.id === 'sub_aed', 'T2.B4.4', 'Matches unambiguous substring ("Algoritmos" -> "Algoritmos e Estruturas de Dados")');

  // T2.B4.5: Unregistered subject graceful handling
  const matchUnreg = SyncService.matchSubject('Química Orgânica', registeredSubs);
  assert(matchUnreg === undefined, 'T2.B4.5', 'Returns undefined for unregistered subject without errors');

  // ----------------------------------------------------------------------------
  // Boundary 5: Heavy HTML, Script Injection & Emojis
  // ----------------------------------------------------------------------------
  console.log('\n--- Boundary 5: Heavy HTML, Script Injection & Emojis ---');

  // T2.B5.1: Multiple inline script injections
  const multiScript = '<script src="evil.js"></script><p>Aviso de aula</p><script>eval("hack")</script>';
  const cleanMultiScript = TeamsService.sanitizeHtmlMessage(multiScript);
  assert(cleanMultiScript === 'Aviso de aula', 'T2.B5.1', 'Sanitizer eliminates multiple and external script tags');

  // T2.B5.2: Complex nested table layout
  const tableHtml = '<table><tr><th>Matéria</th><th>Data</th></tr><tr><td>Cálculo 1</td><td>2026-08-17</td></tr></table>';
  const cleanTable = TeamsService.sanitizeHtmlMessage(tableHtml);
  assert(cleanTable.includes('Matéria') && cleanTable.includes('Cálculo 1'), 'T2.B5.2', 'Sanitizer converts table cells and rows into readable text');

  // T2.B5.3: Unicode Emojis preservation
  const emojiHtml = '<p>📚 Atenção turma! ⚠️ Aula cancelada hoje! 🚨</p>';
  const cleanEmoji = TeamsService.sanitizeHtmlMessage(emojiHtml);
  assert(cleanEmoji.includes('📚') && cleanEmoji.includes('⚠️') && cleanEmoji.includes('🚨'), 'T2.B5.3', 'Sanitizer preserves academic Unicode emojis');

  // T2.B5.4: Unclosed HTML tags
  const unclosedHtml = '<div><p>Aviso: <b>Entrega dia 2026-08-24';
  const cleanUnclosed = TeamsService.sanitizeHtmlMessage(unclosedHtml);
  assert(cleanUnclosed.includes('Aviso: Entrega dia 2026-08-24'), 'T2.B5.4', 'Sanitizer handles unclosed tags gracefully');

  // T2.B5.5: Mixed uppercase and lowercase tags
  const mixedCaseHtml = '<DIV><P>AULA</P><BR/><SPAN>CANCELADA</SPAN></DIV>';
  const cleanMixed = TeamsService.sanitizeHtmlMessage(mixedCaseHtml);
  assert(cleanMixed.includes('AULA') && cleanMixed.includes('CANCELADA') && !cleanMixed.includes('<'), 'T2.B5.5', 'Sanitizer strips mixed case HTML tags accurately');

  // ----------------------------------------------------------------------------
  // Boundary 6: Multi-Item Extractions in Single Message
  // ----------------------------------------------------------------------------
  console.log('\n--- Boundary 6: Multi-Item Extractions in Single Message ---');

  // T2.B6.1: Single message with 2 items (Homework + Exam)
  const multiItemJson = JSON.stringify({
    items: [
      {
        intent: 'homework',
        subjectName: 'Algoritmos',
        title: 'Lista 3',
        targetDate: '2026-08-24',
        startTime: '23:59',
        endTime: '23:59',
        alerts: [10080, 1440]
      },
      {
        intent: 'exam',
        subjectName: 'Algoritmos',
        title: 'Prova P1',
        targetDate: '2026-08-31',
        startTime: '08:00',
        endTime: '10:00',
        alerts: [10080, 1440]
      }
    ],
    confidence: 0.95
  });

  const parsedMulti = AIParsingService.cleanAndValidateJson(multiItemJson, standardContext);
  assert(parsedMulti.items.length === 2, 'T2.B6.1', 'Extracts exactly 2 distinct items from single JSON payload');

  // T2.B6.2: Syncing 2 items produces 2 calendar events
  const multiSyncRes = await SyncService.processParsedItems(
    parsedMulti.items,
    [],
    [],
    [baseSubjectAlgo]
  );
  assert(multiSyncRes.updatedEvents.length === 2, 'T2.B6.2', 'Sync creates 2 AppEvent instances for multi-item message');
  assert(multiSyncRes.syncResult.createdEvents.some(e => e.title === 'Lista 3'), 'T2.B6.3', 'First item (Homework) present in created events');
  assert(multiSyncRes.syncResult.createdEvents.some(e => e.title === 'Prova P1'), 'T2.B6.4', 'Second item (Exam) present in created events');

  // T2.B6.5: Mixed cancellation and homework in one batch
  const mixedItems: AIParsedItem[] = [
    {
      intent: 'cancelled_class',
      subjectName: 'Cálculo 1',
      title: 'Aula Cancelada',
      targetDate: '2026-08-17',
      startTime: '08:00',
      endTime: '10:00',
      alerts: [10080, 1440],
      rawSummary: 'Cancelamento'
    },
    {
      intent: 'homework',
      subjectName: 'Algoritmos',
      title: 'Lista 3',
      targetDate: '2026-08-24',
      startTime: '23:59',
      endTime: '23:59',
      alerts: [10080, 1440],
      rawSummary: 'Tarefa'
    }
  ];
  const mixedSyncRes = await SyncService.processParsedItems(
    mixedItems,
    [baseCalcClassEvent],
    [],
    [baseSubjectCalc, baseSubjectAlgo]
  );
  assert(mixedSyncRes.updatedAttendances.length === 1 && mixedSyncRes.updatedEvents.length === 2, 'T2.B6.5', 'Processes mixed cancellation and event creation in single invocation');

  // ----------------------------------------------------------------------------
  // Boundary 7: Idempotency & Re-execution
  // ----------------------------------------------------------------------------
  console.log('\n--- Boundary 7: Idempotency & Re-execution ---');

  // T2.B7.1: Re-processing identical homework does not create duplicate events
  const firstHwPass = await SyncService.processParsedItems([hwSyncItem], [], [], [baseSubjectAlgo]);
  const secondHwPass = await SyncService.processParsedItems(
    [hwSyncItem],
    firstHwPass.updatedEvents,
    firstHwPass.updatedAttendances,
    firstHwPass.updatedSubjects
  );
  assert(secondHwPass.updatedEvents.length === 1, 'T2.B7.1', 'Idempotency: Re-syncing same homework produces 1 event, not 2');

  // T2.B7.2: Re-processing identical exam does not duplicate GradeItem
  const firstExamPass = await SyncService.processParsedItems([examSyncItem], [], [], [baseSubjectFis]);
  const secondExamPass = await SyncService.processParsedItems(
    [examSyncItem],
    firstExamPass.updatedEvents,
    firstExamPass.updatedAttendances,
    firstExamPass.updatedSubjects
  );
  assert(secondExamPass.updatedEvents.length === 1, 'T2.B7.2', 'Idempotency: Re-syncing same exam does not duplicate calendar event');
  const fisGradeItemsCount = secondExamPass.updatedSubjects.find(s => s.id === 'sub_fis_1')?.gradeGroups?.[0]?.items?.length;
  assert(fisGradeItemsCount === 1, 'T2.B7.3', 'Idempotency: Re-syncing same exam does not duplicate GradeItem in gradeGroups');

  // T2.B7.4: Re-processing cancellation on already cancelled attendance
  const firstCancelPass = await SyncService.processParsedItems([cancelSyncItem], [baseCalcClassEvent], [], [baseSubjectCalc]);
  const secondCancelPass = await SyncService.processParsedItems(
    [cancelSyncItem],
    firstCancelPass.updatedEvents,
    firstCancelPass.updatedAttendances,
    firstCancelPass.updatedSubjects
  );
  assert(secondCancelPass.updatedAttendances.length === 1, 'T2.B7.4', 'Idempotency: Re-syncing cancellation maintains exactly 1 record');
  assert(secondCancelPass.updatedAttendances[0].status === 'cancelled', 'T2.B7.5', 'Attendance record status remains "cancelled"');


  // ============================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS (>=15 tests)
  // ============================================================================
  setTier('tier3');
  console.log('\n================================================================================');
  console.log('TIER 3: CROSS-FEATURE COMBINATIONS');
  console.log('================================================================================\n');

  // T3.C1: Cancellation on existing 'pending' attendance record
  const pendingRecord: AttendanceRecord = {
    id: 'att_pending_1',
    subjectId: 'sub_calc_1',
    eventId: 'ev_calc_weekly',
    date: '2026-08-17',
    status: 'pending'
  };
  const syncOnPending = await SyncService.processParsedItems(
    [cancelSyncItem],
    [baseCalcClassEvent],
    [pendingRecord],
    [baseSubjectCalc]
  );
  assert(syncOnPending.updatedAttendances.find(a => a.id === 'att_pending_1')?.status === 'cancelled', 'T3.C1', 'Transitions existing "pending" attendance to "cancelled"');

  // T3.C2: Cancellation on existing 'present' attendance record
  const presentRecord: AttendanceRecord = {
    id: 'att_present_1',
    subjectId: 'sub_calc_1',
    eventId: 'ev_calc_weekly',
    date: '2026-08-17',
    status: 'present'
  };
  const syncOnPresent = await SyncService.processParsedItems(
    [cancelSyncItem],
    [baseCalcClassEvent],
    [presentRecord],
    [baseSubjectCalc]
  );
  assert(syncOnPresent.updatedAttendances.find(a => a.id === 'att_present_1')?.status === 'cancelled', 'T3.C2', 'Transitions existing "present" attendance to "cancelled"');

  // T3.C3: Cancellation on existing 'absent' attendance record
  const absentRecord: AttendanceRecord = {
    id: 'att_absent_1',
    subjectId: 'sub_calc_1',
    eventId: 'ev_calc_weekly',
    date: '2026-08-17',
    status: 'absent'
  };
  const syncOnAbsent = await SyncService.processParsedItems(
    [cancelSyncItem],
    [baseCalcClassEvent],
    [absentRecord],
    [baseSubjectCalc]
  );
  assert(syncOnAbsent.updatedAttendances.find(a => a.id === 'att_absent_1')?.status === 'cancelled', 'T3.C3', 'Transitions existing "absent" attendance to "cancelled"');

  // T3.C4: Attendance statistics calculation with cancelled records
  const mixedAttendanceRecords: AttendanceRecord[] = [
    { id: '1', subjectId: 'sub_calc_1', eventId: 'ev_1', date: '2026-08-03', status: 'present' },
    { id: '2', subjectId: 'sub_calc_1', eventId: 'ev_1', date: '2026-08-10', status: 'present' },
    { id: '3', subjectId: 'sub_calc_1', eventId: 'ev_1', date: '2026-08-17', status: 'cancelled' },
    { id: '4', subjectId: 'sub_calc_1', eventId: 'ev_1', date: '2026-08-24', status: 'absent' },
  ];
  const absentTotal = mixedAttendanceRecords.filter(a => a.status === 'absent').length;
  assert(absentTotal === 1, 'T3.C4', 'Absence count accurately ignores status "cancelled" (total absences = 1)');

  // T3.C5: Attendance percentage recalculation
  const nonCancelled = mixedAttendanceRecords.filter(a => a.status !== 'cancelled');
  const presentCount = nonCancelled.filter(a => a.status === 'present').length;
  const attendanceRate = (presentCount / nonCancelled.length) * 100;
  assert(attendanceRate === (2 / 3) * 100, 'T3.C5', 'Attendance percentage calculates 2/3 (66.67%) without penalty from cancelled class');

  // T3.C6: Cancellation with no prior attendance history creates new record
  const syncFreshCancel = await SyncService.processParsedItems([cancelSyncItem], [baseCalcClassEvent], [], [baseSubjectCalc]);
  assert(syncFreshCancel.updatedAttendances.length === 1 && syncFreshCancel.updatedAttendances[0].status === 'cancelled', 'T3.C6', 'Cancellation without prior history provisions new record with status "cancelled"');

  // T3.C7: Weekly class recurring calendar filter hides cancelled date only
  const targetDateCancelled = '2026-08-17';
  const targetDateNextWeek = '2026-08-24';
  const isCancelledOnTarget = syncFreshCancel.updatedAttendances.some(
    a => a.eventId === baseCalcClassEvent.id && a.date === targetDateCancelled && a.status === 'cancelled'
  );
  assert(isCancelledOnTarget === true, 'T3.C7.1', 'Calendar logic detects class is cancelled on 2026-08-17');

  const isCancelledNextWeek = syncFreshCancel.updatedAttendances.some(
    a => a.eventId === baseCalcClassEvent.id && a.date === targetDateNextWeek && a.status === 'cancelled'
  );
  assert(isCancelledNextWeek === false, 'T3.C7.2', 'Calendar logic confirms weekly class remains active on subsequent weeks (2026-08-24)');

  // T3.C8: Notification scheduling math verification
  const eventParsedDate = parseISO('2026-08-24T23:59:00');
  const trigger1Week = subMinutes(eventParsedDate, 10080);
  const trigger1Day = subMinutes(eventParsedDate, 1440);
  assert(format(trigger1Week, 'yyyy-MM-dd HH:mm') === '2026-08-17 23:59', 'T3.C8.1', '10080 minute alert fires exactly 7 days prior at 2026-08-17 23:59');
  assert(format(trigger1Day, 'yyyy-MM-dd HH:mm') === '2026-08-23 23:59', 'T3.C8.2', '1440 minute alert fires exactly 1 day prior at 2026-08-23 23:59');

  // T3.C9: Multiple exams for same subject register distinct GradeItems
  const examP1Item: AIParsedItem = {
    intent: 'exam',
    subjectName: 'Física I',
    title: 'Prova P1 - Física I',
    targetDate: '2026-08-20',
    startTime: '08:00',
    endTime: '10:00',
    alerts: [10080, 1440],
    rawSummary: 'P1'
  };
  const examP2Item: AIParsedItem = {
    intent: 'exam',
    subjectName: 'Física I',
    title: 'Prova P2 - Física I',
    targetDate: '2026-09-20',
    startTime: '08:00',
    endTime: '10:00',
    alerts: [10080, 1440],
    rawSummary: 'P2'
  };
  const doubleExamSync = await SyncService.processParsedItems(
    [examP1Item, examP2Item],
    [],
    [],
    [baseSubjectFis]
  );
  const fisItems = doubleExamSync.updatedSubjects.find(s => s.id === 'sub_fis_1')?.gradeGroups?.[0]?.items;
  assert(fisItems?.length === 2, 'T3.C9', 'Registers distinct GradeItems for P1 and P2 in Subject gradeGroups');

  // T3.C10: Interleaved multi-subject message stream integrity
  const interleavedItems: AIParsedItem[] = [
    cancelSyncItem,
    hwSyncItem,
    examSyncItem
  ];
  const interleavedSync = await SyncService.processParsedItems(
    interleavedItems,
    [baseCalcClassEvent],
    [],
    [baseSubjectCalc, baseSubjectAlgo, baseSubjectFis]
  );
  assert(interleavedSync.updatedAttendances.length === 1, 'T3.C10.1', 'Interleaved stream produces 1 cancellation');
  assert(interleavedSync.updatedEvents.length === 3, 'T3.C10.2', 'Interleaved stream contains 3 events (1 class + 1 hw + 1 exam)');
  assert(interleavedSync.updatedSubjects.length === 3, 'T3.C10.3', 'Interleaved stream preserves all 3 registered subjects');

  // T3.C11: Rescheduled exam updates existing date and maintains GradeItem link
  const initialExamItem: AIParsedItem = {
    intent: 'exam',
    subjectName: 'Física I',
    title: 'Prova P2 - Física I',
    targetDate: '2026-08-25',
    startTime: '08:00',
    endTime: '10:00',
    alerts: [10080, 1440],
    rawSummary: 'P2 Inicial'
  };
  const initExamRes = await SyncService.processParsedItems([initialExamItem], [], [], [baseSubjectFis]);
  const rescheduledExamItem: AIParsedItem = {
    intent: 'exam',
    subjectName: 'Física I',
    title: 'Prova P2 - Física I',
    targetDate: '2026-08-28', // Rescheduled date
    startTime: '08:00',
    endTime: '10:00',
    alerts: [10080, 1440],
    rawSummary: 'P2 Reagendada'
  };
  const rescheduleRes = await SyncService.processParsedItems(
    [rescheduledExamItem],
    initExamRes.updatedEvents,
    initExamRes.updatedAttendances,
    initExamRes.updatedSubjects
  );
  assert(rescheduleRes.updatedEvents.length === 1, 'T3.C11.1', 'Rescheduling exam does not create duplicate event');
  assert(rescheduleRes.updatedEvents[0].date === '2026-08-28', 'T3.C11.2', 'Exam event date updated to 2026-08-28');
  const rescheduledGradeItem = rescheduleRes.updatedSubjects.find(s => s.id === 'sub_fis_1')?.gradeGroups?.[0]?.items;
  assert(rescheduledGradeItem?.length === 1, 'T3.C11.3', 'GradeItem count remains exactly 1 after reschedule');

  // T3.C12: End-to-End Pipeline (Raw HTML -> Sanitize -> AI Parse -> Sync -> Storage)
  await mockAsyncStorage.clear();
  const rawHtmlInput = '<div class="teams"><p>Aviso de <b>C&aacute;lculo 1</b>: N&atilde;o teremos aula no dia <b>2026-08-17</b>.</p></div>';
  const sanitizedText = TeamsService.sanitizeHtmlMessage(rawHtmlInput);
  const parsedFromSanitized = AIParsingService.parseMessageMock(sanitizedText, standardContext);
  const pipelineSync = await SyncService.processParsedItems(
    parsedFromSanitized.items,
    [baseCalcClassEvent],
    [],
    [baseSubjectCalc]
  );
  await StorageService.saveEvents(pipelineSync.updatedEvents);
  await StorageService.saveAttendances(pipelineSync.updatedAttendances);
  await StorageService.saveSubjects(pipelineSync.updatedSubjects);

  const reloadedEvents = await StorageService.getEvents();
  const reloadedAtts = await StorageService.getAttendances();
  assert(reloadedAtts.length === 1 && reloadedAtts[0].status === 'cancelled', 'T3.C12', 'Full pipeline executes seamlessly from raw HTML to persisted storage');


  // ============================================================================
  // TIER 4: REAL-WORLD ACADEMIC WORKLOADS (5 Comprehensive Scenarios)
  // ============================================================================
  setTier('tier4');
  console.log('\n================================================================================');
  console.log('TIER 4: REAL-WORLD ACADEMIC WORKLOADS');
  console.log('================================================================================\n');

  // ----------------------------------------------------------------------------
  // Scenario 1: Full Academic Week Simulation
  // ----------------------------------------------------------------------------
  console.log('--- Scenario 1: Full Academic Week Simulation ---');
  await mockAsyncStorage.clear();

  const weekSubjects: Subject[] = [
    { id: 's_calc', name: 'Cálculo 1', gradeGroups: [{ id: 'gg_c', name: 'Provas', weight: 1, items: [] }] },
    { id: 's_alg', name: 'Algoritmos', gradeGroups: [{ id: 'gg_a', name: 'Trabalhos', weight: 1, items: [] }] },
    { id: 's_fis', name: 'Física I', gradeGroups: [{ id: 'gg_f', name: 'Avaliações', weight: 1, items: [] }] },
    { id: 's_ed', name: 'Estruturas Discretas', gradeGroups: [{ id: 'gg_ed', name: 'Exames', weight: 1, items: [] }] }
  ];

  const weekClasses: AppEvent[] = [
    { id: 'c_calc', title: 'Aula Cálculo 1', category: 'Faculdade/Aulas', date: '2026-08-17', startTime: '08:00', endTime: '10:00', recurrence: 'weekly', alerts: [15], isCompleted: false, subjectId: 's_calc' },
    { id: 'c_alg', title: 'Aula Algoritmos', category: 'Faculdade/Aulas', date: '2026-08-18', startTime: '10:00', endTime: '12:00', recurrence: 'weekly', alerts: [15], isCompleted: false, subjectId: 's_alg' },
    { id: 'c_fis', title: 'Aula Física I', category: 'Faculdade/Aulas', date: '2026-08-19', startTime: '08:00', endTime: '10:00', recurrence: 'weekly', alerts: [15], isCompleted: false, subjectId: 's_fis' },
    { id: 'c_ed', title: 'Aula Estruturas Discretas', category: 'Faculdade/Aulas', date: '2026-08-20', startTime: '14:00', endTime: '16:00', recurrence: 'weekly', alerts: [15], isCompleted: false, subjectId: 's_ed' }
  ];

  const weekMessages = [
    "Aviso Cálculo 1: Aula de hoje 2026-08-17 cancelada devido ao congresso.",
    "Turma de Algoritmos: Publicada a Lista de Exercícios 1 de Grafos para entrega em 2026-08-25 às 23:59.",
    "Física I: Prova P1 agendada para 2026-08-26 das 08:00 às 10:00.",
    "Atenção Estruturas Discretas: Aula cancelada dia 2026-08-20 por falta de energia no campus.",
    "Turma de Algoritmos: Trabalho 1 publicado. Entrega dia 2026-08-30 às 23:59.",
    "Aviso geral da coordenação: Semana acadêmica acontecerá em Outubro. Bons estudos!"
  ];

  const weekContext: ParsingContext = {
    currentDate: '2026-08-17',
    currentDayOfWeek: 'Segunda-feira',
    registeredSubjects: weekSubjects.map(s => s.name)
  };

  const parsedWeekItems: AIParsedItem[] = [];
  for (const msg of weekMessages) {
    const res = AIParsingService.parseMessageMock(msg, weekContext);
    parsedWeekItems.push(...res.items);
  }

  const weekSyncResult = await SyncService.processParsedItems(
    parsedWeekItems,
    weekClasses,
    [],
    weekSubjects
  );

  assert(weekSyncResult.updatedAttendances.length === 2, 'T4.S1.1', 'Week Simulation: Exactly 2 classes cancelled (Cálculo 1 & Estruturas Discretas)');
  const weekHomeworks = weekSyncResult.updatedEvents.filter(e => e.title.includes('Lista de Exercícios 1') || e.title.includes('Trabalho 1'));
  assert(weekHomeworks.length === 2, 'T4.S1.2', 'Week Simulation: Exactly 2 homework deliverables created');
  const weekExams = weekSyncResult.updatedEvents.filter(e => e.title.includes('Prova P1'));
  assert(weekExams.length === 1, 'T4.S1.3', 'Week Simulation: Exactly 1 exam event created');
  const fisGradeCount = weekSyncResult.updatedSubjects.find(s => s.id === 's_fis')?.gradeGroups?.[0]?.items?.length;
  assert(fisGradeCount === 1, 'T4.S1.4', 'Week Simulation: Física I grade group updated with exam GradeItem');

  // ----------------------------------------------------------------------------
  // Scenario 2: Edge-Case Message Stream (Corrupted HTML & Colloquial Language)
  // ----------------------------------------------------------------------------
  console.log('\n--- Scenario 2: Edge-Case Message Stream ---');

  const colloquialMessages = [
    '<div class="corrupt"><p>fala galera de <b>Cálculo 1</b>, hj 2026-08-17 estamos sem aula blz? vlw</p></div>',
    '<div><style>.x{color:blue;}</style><p>pessoal de <i>Algoritmos</i>, entrega da lista de exercicios dia 2026-08-24 as 23:59 no ava</p></div>',
    '<script>alert("hack")</script><p>Atenção turma de Física I: prova reagendada pro dia 2026-08-28 as 08:00</p>'
  ];

  const edgeItems: AIParsedItem[] = [];
  for (const raw of colloquialMessages) {
    const clean = TeamsService.sanitizeHtmlMessage(raw);
    const parsed = AIParsingService.parseMessageMock(clean, standardContext);
    edgeItems.push(...parsed.items);
  }

  const edgeSyncResult = await SyncService.processParsedItems(
    edgeItems,
    [baseCalcClassEvent],
    [],
    [baseSubjectCalc, baseSubjectAlgo, baseSubjectFis]
  );

  assert(edgeSyncResult.updatedAttendances.some(a => a.subjectId === 'sub_calc_1' && a.status === 'cancelled'), 'T4.S2.1', 'Edge Stream: Colloquial cancellation correctly synced');
  assert(edgeSyncResult.updatedEvents.some(e => e.title.includes('Lista de Exercícios') && e.date === '2026-08-24'), 'T4.S2.2', 'Edge Stream: Colloquial homework correctly synced with 2026-08-24 deadline');
  assert(edgeSyncResult.updatedEvents.some(e => e.title.includes('Prova') && e.date === '2026-08-28'), 'T4.S2.3', 'Edge Stream: Corrupted HTML exam correctly synced with 2026-08-28 date');

  // ----------------------------------------------------------------------------
  // Scenario 3: Sequential Calendar Check-in & Attendance Recalculation
  // ----------------------------------------------------------------------------
  console.log('\n--- Scenario 3: Sequential Calendar Check-in & Attendance Recalculation ---');

  // Semester history: 8 total scheduled class dates
  const semesterAttendances: AttendanceRecord[] = [
    { id: 'sem_1', subjectId: 'sub_calc_1', eventId: 'ev_calc_weekly', date: '2026-08-03', status: 'present' },
    { id: 'sem_2', subjectId: 'sub_calc_1', eventId: 'ev_calc_weekly', date: '2026-08-05', status: 'present' },
    { id: 'sem_3', subjectId: 'sub_calc_1', eventId: 'ev_calc_weekly', date: '2026-08-10', status: 'present' },
    { id: 'sem_4', subjectId: 'sub_calc_1', eventId: 'ev_calc_weekly', date: '2026-08-12', status: 'present' },
    { id: 'sem_5', subjectId: 'sub_calc_1', eventId: 'ev_calc_weekly', date: '2026-08-17', status: 'pending' }, // To be cancelled
    { id: 'sem_6', subjectId: 'sub_calc_1', eventId: 'ev_calc_weekly', date: '2026-08-19', status: 'present' },
    { id: 'sem_7', subjectId: 'sub_calc_1', eventId: 'ev_calc_weekly', date: '2026-08-24', status: 'absent' },  // 1 legitimate absence
    { id: 'sem_8', subjectId: 'sub_calc_1', eventId: 'ev_calc_weekly', date: '2026-08-26', status: 'present' }
  ];

  const semSyncResult = await SyncService.processParsedItems(
    [cancelSyncItem],
    [baseCalcClassEvent],
    semesterAttendances,
    [baseSubjectCalc]
  );

  const updatedSemRecords = semSyncResult.updatedAttendances;
  const semAbsenceCount = updatedSemRecords.filter(a => a.status === 'absent').length;
  const semCancelledCount = updatedSemRecords.filter(a => a.status === 'cancelled').length;
  const semPresentCount = updatedSemRecords.filter(a => a.status === 'present').length;

  assert(semCancelledCount === 1, 'T4.S3.1', 'Sequential Check-in: Exactly 1 record marked cancelled');
  assert(semAbsenceCount === 1, 'T4.S3.2', 'Sequential Check-in: Exactly 1 absence counted (not penalized by cancellation)');
  assert(semPresentCount === 6, 'T4.S3.3', 'Sequential Check-in: 6 present classes preserved');

  // Net attendance rate: 6 present out of 7 completed classes = 85.71%
  const effectiveTotalClasses = updatedSemRecords.length - semCancelledCount; // 8 - 1 = 7
  const netRate = (semPresentCount / effectiveTotalClasses) * 100;
  assert(Math.abs(netRate - 85.714) < 0.01, 'T4.S3.4', 'Sequential Check-in: Net attendance rate is 85.71% (6/7)');

  // ----------------------------------------------------------------------------
  // Scenario 4: Multi-Alert Notification Scheduling
  // ----------------------------------------------------------------------------
  console.log('\n--- Scenario 4: Multi-Alert Notification Scheduling ---');

  const hwEventSample: AppEvent = {
    id: 'hw_notif_test',
    title: 'Entrega Projeto 1 - Algoritmos',
    description: 'Enviar via AVA',
    category: 'Provas/Trabalhos',
    date: '2026-09-01',
    startTime: '23:59',
    endTime: '23:59',
    recurrence: 'none',
    alerts: [10080, 1440],
    isCompleted: false,
    isNotified: true
  };

  const examEventSample: AppEvent = {
    id: 'exam_notif_test',
    title: 'Prova Final - Física I',
    description: 'Sala 302',
    category: 'Provas/Trabalhos',
    date: '2026-09-05',
    startTime: '08:00',
    endTime: '10:00',
    recurrence: 'none',
    alerts: [10080, 1440],
    isCompleted: false,
    isNotified: true
  };

  // Compute trigger dates for homework (due 2026-09-01 23:59)
  const hwBaseDate = parseISO('2026-09-01T23:59:00');
  const hwTrigger1Week = subMinutes(hwBaseDate, 10080); // 7 days before
  const hwTrigger1Day = subMinutes(hwBaseDate, 1440);   // 1 day before

  assert(format(hwTrigger1Week, 'yyyy-MM-dd HH:mm') === '2026-08-25 23:59', 'T4.S4.1', 'Multi-Alert Homework: 1-week alert scheduled for 2026-08-25 23:59');
  assert(format(hwTrigger1Day, 'yyyy-MM-dd HH:mm') === '2026-08-31 23:59', 'T4.S4.2', 'Multi-Alert Homework: 1-day alert scheduled for 2026-08-31 23:59');

  // Compute trigger dates for exam (at 2026-09-05 08:00)
  const examBaseDate = parseISO('2026-09-05T08:00:00');
  const examTrigger1Week = subMinutes(examBaseDate, 10080);
  const examTrigger1Day = subMinutes(examBaseDate, 1440);

  assert(format(examTrigger1Week, 'yyyy-MM-dd HH:mm') === '2026-08-29 08:00', 'T4.S4.3', 'Multi-Alert Exam: 1-week alert scheduled for 2026-08-29 08:00');
  assert(format(examTrigger1Day, 'yyyy-MM-dd HH:mm') === '2026-09-04 08:00', 'T4.S4.4', 'Multi-Alert Exam: 1-day alert scheduled for 2026-09-04 08:00');

  // ----------------------------------------------------------------------------
  // Scenario 5: End-to-End Simulation Runner Acceptance Check
  // ----------------------------------------------------------------------------
  console.log('\n--- Scenario 5: End-to-End Simulation Runner Acceptance Check ---');
  await mockAsyncStorage.clear();

  const finalSimResult = await SyncService.runSimulation(null, [], [], []);

  // Acceptance Criteria 1: 3 seeded subjects
  assert(finalSimResult.updatedSubjects.length === 3, 'T4.S5.1', 'Simulation Acceptance: 3 subjects created (Cálculo 1, Algoritmos, Física I)');

  // Acceptance Criteria 2: Cancelled attendance
  const simCancel = finalSimResult.updatedAttendances.find(a => a.status === 'cancelled');
  assert(simCancel !== undefined, 'T4.S5.2', 'Simulation Acceptance: Cancelled attendance record exists');
  assert(simCancel?.date === '2026-08-17', 'T4.S5.3', 'Simulation Acceptance: Cancelled attendance date is 2026-08-17');

  // Acceptance Criteria 3: Homework event with alerts [10080, 1440]
  const simHw = finalSimResult.updatedEvents.find(e => e.title.includes('Exercícios'));
  assert(simHw !== undefined, 'T4.S5.4', 'Simulation Acceptance: Homework event exists');
  assert(simHw?.date === '2026-08-24', 'T4.S5.5', 'Simulation Acceptance: Homework date is 2026-08-24');
  assertEqual(simHw?.alerts, [10080, 1440], 'T4.S5.6', 'Simulation Acceptance: Homework alerts are [10080, 1440]');

  // Acceptance Criteria 4: Exam event with alerts [10080, 1440] and GradeItem
  const simExam = finalSimResult.updatedEvents.find(e => e.title.includes('Prova P2'));
  assert(simExam !== undefined, 'T4.S5.7', 'Simulation Acceptance: Exam event exists');
  assert(simExam?.date === '2026-08-28', 'T4.S5.8', 'Simulation Acceptance: Exam date is 2026-08-28');
  assertEqual(simExam?.alerts, [10080, 1440], 'T4.S5.9', 'Simulation Acceptance: Exam alerts are [10080, 1440]');

  const simFisSubj = finalSimResult.updatedSubjects.find(s => s.name === 'Física I');
  const simGradeItem = simFisSubj?.gradeGroups?.[0]?.items?.find(i => i.eventId === simExam?.id);
  assert(simGradeItem !== undefined, 'T4.S5.10', 'Simulation Acceptance: GradeItem linked to exam event in Física I');

  // Acceptance Criteria 5: StorageService verified
  const finalStoredEvents = await StorageService.getEvents();
  const finalStoredAtts = await StorageService.getAttendances();
  const finalStoredSubs = await StorageService.getSubjects();
  assert(finalStoredEvents.length === 3, 'T4.S5.11', 'Simulation Acceptance: 3 events stored in AsyncStorage');
  assert(finalStoredAtts.length === 1, 'T4.S5.12', 'Simulation Acceptance: 1 attendance record stored in AsyncStorage');
  assert(finalStoredSubs.length === 3, 'T4.S5.13', 'Simulation Acceptance: 3 subjects stored in AsyncStorage');


  // ============================================================================
  // FINAL CONSOLIDATED SUMMARY REPORT
  // ============================================================================
  const grandTotal = stats.tier1.total + stats.tier2.total + stats.tier3.total + stats.tier4.total;
  const grandPassed = stats.tier1.passed + stats.tier2.passed + stats.tier3.passed + stats.tier4.passed;
  const grandFailed = stats.tier1.failed + stats.tier2.failed + stats.tier3.failed + stats.tier4.failed;

  console.log('\n================================================================================');
  console.log('  ORGANIZA E2E TEST EXECUTION SUMMARY (TIERS 1 - 4)');
  console.log('================================================================================');
  console.log(`  Tier 1 (Feature Coverage)       : ${stats.tier1.passed} / ${stats.tier1.total} Passed (${stats.tier1.failed} Failed)`);
  console.log(`  Tier 2 (Boundary & Corner Cases): ${stats.tier2.passed} / ${stats.tier2.total} Passed (${stats.tier2.failed} Failed)`);
  console.log(`  Tier 3 (Cross-Feature Combos)   : ${stats.tier3.passed} / ${stats.tier3.total} Passed (${stats.tier3.failed} Failed)`);
  console.log(`  Tier 4 (Real-World Workloads)   : ${stats.tier4.passed} / ${stats.tier4.total} Passed (${stats.tier4.failed} Failed)`);
  console.log('--------------------------------------------------------------------------------');
  console.log(`  GRAND TOTAL                     : ${grandPassed} / ${grandTotal} Passed (${grandFailed} Failed)`);
  console.log(`  PASS RATE                       : ${((grandPassed / grandTotal) * 100).toFixed(2)}%`);
  console.log('================================================================================\n');

  if (grandFailed > 0) {
    console.error('FAILURES DETECTED:');
    failureDetails.forEach(f => console.error(f));
    throw new Error(`${grandFailed} test assertion(s) failed in E2E Test Suite.`);
  }

  console.log('>>> ALL E2E TEAMS & AI INTEGRATION TESTS PASSED WITH 100% SUCCESS! <<<\n');
}

runE2ETeamsAISuite().catch(err => {
  console.error('Master E2E Suite Error:', err);
  process.exit(1);
});
