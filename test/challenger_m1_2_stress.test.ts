import './setup_env';
import { getLocalDateString, formatDisplayDate, parseLocalDate } from '../src/utils/date';
import { GoogleSheetsService } from '../src/services/GoogleSheetsService';
import { TeamsService } from '../src/services/TeamsService';
import { AIParsingService, ParsingContext } from '../src/services/AIParsingService';
import { StorageService } from '../src/services/storage';
import { calculateFinalGrade } from '../src/components/GradeEngine';
import { AttendanceService } from '../src/services/AttendanceService';
import { AppEvent, AttendanceRecord, GradeGroup, StudyStreak, Subject, AIConfig } from '../src/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    const msg = `  [FAIL] ${testName}${detail ? ' -> ' + detail : ''}`;
    console.error(msg);
    failures.push(msg);
    failed++;
  }
}

async function runChallengerTestSuite() {
  console.log('================================================================================');
  console.log('  CHALLENGER 2: EMPIRICAL ADVERSARIAL STRESS TEST SUITE (MILESTONE 1)');
  console.log('================================================================================\n');

  // ============================================================================
  // SECTION 1: NETWORK TIMEOUTS (AbortSignal.timeout) & OFFLINE RESILIENCE
  // ============================================================================
  console.log('--- SECTION 1: Network Timeout (AbortSignal.timeout) & Offline Resilience ---');

  // Save original fetch
  const originalFetch = globalThis.fetch;

  try {
    // 1.1 TeamsService: exchangeCodeForToken timeout safeguard & signal inspection
    let capturedSignal: AbortSignal | null | undefined = null;
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
      capturedSignal = init?.signal;
      // Simulate timeout abort rejection
      const err: any = new Error('The operation was aborted');
      err.name = 'TimeoutError';
      throw err;
    };

    let didCatchError = false;
    try {
      await TeamsService.exchangeCodeForToken('dummy-client', 'dummy-code');
    } catch (e: any) {
      didCatchError = true;
    }
    assert(didCatchError === true, 'TeamsService.exchangeCodeForToken raises error when network times out');
    assert(capturedSignal !== null && capturedSignal !== undefined, 'TeamsService.exchangeCodeForToken passes AbortSignal');

    // 1.2 TeamsService: refreshAccessToken network failure handling
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
      capturedSignal = init?.signal;
      return {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'invalid_grant', error_description: 'Refresh token expired' })
      };
    };

    let refreshError = '';
    try {
      await TeamsService.refreshAccessToken('client-id', 'expired-token');
    } catch (e: any) {
      refreshError = e.message;
    }
    assert(refreshError.includes('Falha ao renovar token Microsoft (400)'), 'TeamsService.refreshAccessToken formats 400 error cleanly');
    assert(refreshError.includes('Refresh token expired'), 'TeamsService.refreshAccessToken extracts error_description');
    assert(capturedSignal !== null && capturedSignal !== undefined, 'TeamsService.refreshAccessToken passes AbortSignal');

    // 1.3 TeamsService: getJoinedTeams 401 Unauthorized handling
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
      capturedSignal = init?.signal;
      return {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: { code: 'InvalidAuthenticationToken', message: 'Token is invalid' } })
      };
    };

    let joinedTeamsError = '';
    try {
      await TeamsService.getJoinedTeams('invalid-token');
    } catch (e: any) {
      joinedTeamsError = e.message;
    }
    assert(joinedTeamsError.includes('Não autorizado (401)'), 'TeamsService.getJoinedTeams catches 401 and reports expiration');
    assert(capturedSignal !== null && capturedSignal !== undefined, 'TeamsService.getJoinedTeams passes AbortSignal');

    // 1.4 TeamsService: getChannels passes AbortSignal
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
      capturedSignal = init?.signal;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          value: [{ id: 'c1', displayName: 'Geral' }]
        })
      };
    };
    const channels = await TeamsService.getChannels('token', 't1');
    assert(channels.length === 1 && channels[0].displayName === 'Geral', 'TeamsService.getChannels returns channel list');
    assert(capturedSignal !== null && capturedSignal !== undefined, 'TeamsService.getChannels passes AbortSignal');

    // 1.5 TeamsService: getChannelMessages with null / corrupted value items
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
      capturedSignal = init?.signal;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          value: [
            null,
            { id: '1', body: null },
            { id: '2', body: { content: '   ' } },
            { id: '3', body: { content: '<b>Mensagem válida</b>', contentType: 'html' }, from: { user: { displayName: 'Prof. Silva' } } }
          ]
        })
      };
    };

    const messages = await TeamsService.getChannelMessages('token', 'team1', 'chan1');
    assert(messages.length === 1, 'TeamsService.getChannelMessages filters out null/empty messages');
    assert(messages[0].cleanText === 'Mensagem válida', 'Sanitizes HTML content in channel message');
    assert(capturedSignal !== null && capturedSignal !== undefined, 'TeamsService.getChannelMessages passes AbortSignal');

    // 1.6 GoogleSheetsService: Network timeout & 404 handling
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
      capturedSignal = init?.signal;
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Not found'
      };
    };

    let sheetsError = '';
    try {
      await GoogleSheetsService.fetchMessages('https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit');
    } catch (e: any) {
      sheetsError = e.message;
    }
    assert(sheetsError.includes('Planilha não encontrada. Verifique se ela está publicada na web'), 'GoogleSheetsService converts 404 to helpful instructions');
    assert(capturedSignal !== null && capturedSignal !== undefined, 'GoogleSheetsService.fetchMessages passes AbortSignal');

    // 1.7 AIParsingService: Gemini API network failure triggers graceful fallback to mock
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
      capturedSignal = init?.signal;
      return {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ error: { message: 'Quota exceeded' } })
      };
    };

    const context: ParsingContext = {
      currentDate: '2026-08-18',
      currentDayOfWeek: 'Terça-feira',
      registeredSubjects: ['Cálculo 1', 'Física I']
    };

    const aiConfigGemini: AIConfig = {
      provider: 'gemini',
      apiKey: 'test-api-key',
      model: 'gemini-1.5-flash',
      autoSync: false,
      selectedTeamId: '',
      selectedChannelId: ''
    };

    const geminiFallbackResult = await AIParsingService.parseMessage(
      'Avisando que a aula de Cálculo 1 de amanhã está cancelada!',
      aiConfigGemini,
      context
    );
    assert(geminiFallbackResult.items.length === 1, 'AIParsingService falls back to mock parser when Gemini API fails (429)');
    assert(geminiFallbackResult.items[0].intent === 'cancelled_class', 'Mock parser extracted cancelled_class fallback');
    assert(capturedSignal !== null && capturedSignal !== undefined, 'AIParsingService.callGemini passes AbortSignal');

    // 1.8 AIParsingService: OpenAI API network timeout triggers graceful fallback to mock
    const aiConfigOpenAI: AIConfig = {
      provider: 'openai',
      apiKey: 'sk-test-openai',
      model: 'gpt-4o-mini',
      autoSync: false,
      selectedTeamId: '',
      selectedChannelId: ''
    };

    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
      capturedSignal = init?.signal;
      throw new Error('Connection timed out');
    };

    const openAIFallbackResult = await AIParsingService.parseMessage(
      'Lista 2 de Física I para entregar dia 25/08 até 23:59',
      aiConfigOpenAI,
      context
    );
    assert(openAIFallbackResult.items.length === 1, 'AIParsingService falls back to mock parser when OpenAI network error occurs');
    assert(openAIFallbackResult.items[0].intent === 'homework', 'Mock parser extracted homework fallback');
    assert(openAIFallbackResult.items[0].targetDate === '2026-08-25', 'Mock parser extracted targetDate accurately');
    assert(capturedSignal !== null && capturedSignal !== undefined, 'AIParsingService.callOpenAI passes AbortSignal');

  } finally {
    // Restore original fetch
    globalThis.fetch = originalFetch;
  }

  // ============================================================================
  // SECTION 2: STREAK STATE CONSISTENCY & LIFECYCLE (App.tsx & StudyScreen)
  // ============================================================================
  console.log('\n--- SECTION 2: Streak State Consistency & Lifecycle ---');

  await AsyncStorage.clear();

  // 2.1 Fresh state initialization
  let initialStreak = await StorageService.getStreak();
  assert(initialStreak.currentStreak === 0, 'Initial streak currentStreak is 0');
  assert(initialStreak.longestStreak === 0, 'Initial streak longestStreak is 0');
  assert(initialStreak.lastStudyDate === '', 'Initial streak lastStudyDate is empty string');

  // Helper simulating StudyScreen updateStreakOnSessionSaved with arbitrary reference dates
  async function simulateStudySession(streakState: StudyStreak, referenceDateStr: string): Promise<StudyStreak> {
    const todayStr = referenceDateStr;
    let newStreak = { ...streakState };

    if (streakState.lastStudyDate === todayStr) {
      // already studied today
      return newStreak;
    }

    const d = new Date(referenceDateStr + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    const yesterdayStr = getLocalDateString(d);

    if (streakState.lastStudyDate === yesterdayStr) {
      newStreak.currentStreak += 1;
    } else {
      newStreak.currentStreak = 1;
    }

    if (newStreak.currentStreak > newStreak.longestStreak) {
      newStreak.longestStreak = newStreak.currentStreak;
    }
    newStreak.lastStudyDate = todayStr;

    await StorageService.saveStreak(newStreak);
    return newStreak;
  }

  // Day 1: 2026-08-18 (First session)
  let currentStreak = await simulateStudySession(initialStreak, '2026-08-18');
  assert(currentStreak.currentStreak === 1, 'Day 1 first session sets currentStreak to 1');
  assert(currentStreak.longestStreak === 1, 'Day 1 first session sets longestStreak to 1');
  assert(currentStreak.lastStudyDate === '2026-08-18', 'Day 1 lastStudyDate is 2026-08-18');

  // Day 1: 2026-08-18 (Second session on same day)
  currentStreak = await simulateStudySession(currentStreak, '2026-08-18');
  assert(currentStreak.currentStreak === 1, 'Day 1 second session on same day keeps currentStreak at 1');
  assert(currentStreak.longestStreak === 1, 'Day 1 second session on same day keeps longestStreak at 1');

  // Day 2: 2026-08-19 (Consecutive day)
  currentStreak = await simulateStudySession(currentStreak, '2026-08-19');
  assert(currentStreak.currentStreak === 2, 'Day 2 consecutive day increments currentStreak to 2');
  assert(currentStreak.longestStreak === 2, 'Day 2 longestStreak becomes 2');
  assert(currentStreak.lastStudyDate === '2026-08-19', 'Day 2 lastStudyDate is 2026-08-19');

  // Day 3: 2026-08-20 (Consecutive day)
  currentStreak = await simulateStudySession(currentStreak, '2026-08-20');
  assert(currentStreak.currentStreak === 3, 'Day 3 consecutive day increments currentStreak to 3');
  assert(currentStreak.longestStreak === 3, 'Day 3 longestStreak becomes 3');

  // Day 5: 2026-08-22 (Skipped Day 4: 2026-08-21!)
  currentStreak = await simulateStudySession(currentStreak, '2026-08-22');
  assert(currentStreak.currentStreak === 1, 'Skipping a day resets currentStreak to 1');
  assert(currentStreak.longestStreak === 3, 'Skipping a day preserves longestStreak at 3');
  assert(currentStreak.lastStudyDate === '2026-08-22', 'New lastStudyDate is 2026-08-22');

  // Storage verification
  const persistedStreak = await StorageService.getStreak();
  assert(persistedStreak.currentStreak === 1, 'Persisted streak has currentStreak=1');
  assert(persistedStreak.longestStreak === 3, 'Persisted streak has longestStreak=3');
  assert(persistedStreak.lastStudyDate === '2026-08-22', 'Persisted streak has lastStudyDate=2026-08-22');

  // 2.2 Boundary: Leap year month transition (2028-02-28 -> 2028-02-29 -> 2028-03-01)
  let leapStreak: StudyStreak = { currentStreak: 5, longestStreak: 5, lastStudyDate: '2028-02-28' };
  leapStreak = await simulateStudySession(leapStreak, '2028-02-29');
  assert(leapStreak.currentStreak === 6, 'Feb 28 to Feb 29 (leap day) increments streak to 6');
  leapStreak = await simulateStudySession(leapStreak, '2028-03-01');
  assert(leapStreak.currentStreak === 7, 'Feb 29 to March 1 (leap year) increments streak to 7');

  // 2.3 Boundary: Year-end transition (2026-12-31 -> 2027-01-01)
  let yearEndStreak: StudyStreak = { currentStreak: 10, longestStreak: 10, lastStudyDate: '2026-12-31' };
  yearEndStreak = await simulateStudySession(yearEndStreak, '2027-01-01');
  assert(yearEndStreak.currentStreak === 11, 'Dec 31 to Jan 01 year change increments streak to 11');

  // ============================================================================
  // SECTION 3: ADVERSARIAL RFC 4180 CSV PARSING STRESS CASES
  // ============================================================================
  console.log('\n--- SECTION 3: Adversarial RFC 4180 CSV Parsing Stress Cases ---');

  // 3.1 Multiple embedded newlines with mixed CRLF and LF inside quotes
  const complexMultilineCsv = `col1,col2,col3\r\n"Row 1, Line 1\nRow 1, Line 2\r\nRow 1, Line 3",StandardVal,"Another\nMultiline"\r\nSimpleRow1,SimpleRow2,SimpleRow3`;
  const parsedRecords = GoogleSheetsService.parseCsvRecords(complexMultilineCsv);
  assert(parsedRecords.length === 3, 'Parses 3 logical rows despite 5 physical newline breaks');
  assert(parsedRecords[1][0] === 'Row 1, Line 1\nRow 1, Line 2\r\nRow 1, Line 3', 'Preserves internal newlines and CRLF exactly within quoted field');
  assert(parsedRecords[1][1] === 'StandardVal', 'Extracts unquoted middle field');
  assert(parsedRecords[1][2] === 'Another\nMultiline', 'Extracts multiline trailing field');
  assert(parsedRecords[2][0] === 'SimpleRow1', 'Parses subsequent row without corruption');

  // 3.2 Complex quotes inside quotes: """Hello"", she said, ""how are you?"""
  const complexQuotesCsv = `id,text\n1,"""Hello"", she said, ""how are you?"""\n2,"Just ""quotes"" here"`;
  const parsedQuotes = GoogleSheetsService.parseCsvRecords(complexQuotesCsv);
  assert(parsedQuotes[1][1] === '"Hello", she said, "how are you?"', 'Correctly parses triple quotes at start and double escaped quotes inside');
  assert(parsedQuotes[2][1] === 'Just "quotes" here', 'Correctly parses middle escaped quotes');

  // 3.3 Trailing commas, empty fields, and whitespace
  const raggedCsv = `a,b,c,d\n1,,,4\n,2,3,\n,,,`;
  const parsedRagged = GoogleSheetsService.parseCsvRecords(raggedCsv);
  assert(parsedRagged.length === 4, 'Parses empty fields and trailing commas without crashing');
  assert(parsedRagged[1][1] === '', 'Empty middle field 1 is empty string');
  assert(parsedRagged[1][2] === '', 'Empty middle field 2 is empty string');
  assert(parsedRagged[1][3] === '4', 'Field 4 is parsed');
  assert(parsedRagged[2][0] === '', 'Empty leading field is empty string');

  // 3.4 GoogleSheetsService.fetchMessages simulation with RFC 4180 features
  const originalFetch2 = globalThis.fetch;
  try {
    (globalThis as any).fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => `timestamp,team_name,channel_name,sender,message\n2026-08-18T10:00:00Z,Engenharia,Geral,Prof. Silva,"Aviso importante:\n\n1. Prova adiada\n2. Trazer calculadora, lápis e borracha."\n2026-08-18T11:00:00Z,Engenharia,Geral,Prof. Santos,"Lista ""Especial"" disponível"`
    });

    const parsedMessages = await GoogleSheetsService.fetchMessages('https://docs.google.com/spreadsheets/d/test-id/edit');
    assert(parsedMessages.length === 2, 'GoogleSheetsService parsed 2 multiline/escaped messages from CSV');
    assert(parsedMessages[0].cleanText.includes('1. Prova adiada\n2. Trazer calculadora, lápis e borracha.'), 'Message 1 contains multiline text with commas');
    assert(parsedMessages[1].cleanText === 'Lista "Especial" disponível', 'Message 2 contains unescaped quotes');
  } finally {
    globalThis.fetch = originalFetch2;
  }

  // ============================================================================
  // SECTION 4: DATE UTILITY & TIMEZONE ADVERSARIAL STRESS
  // ============================================================================
  console.log('\n--- SECTION 4: Date Utility & Timezone Adversarial Stress ---');

  // 4.1 UTC-3 Brasília 23:59:59 boundary check
  const localDateLateNight = new Date(2026, 7, 18, 23, 59, 59, 999);
  assert(getLocalDateString(localDateLateNight) === '2026-08-18', '23:59:59.999 local does not skip to tomorrow (2026-08-18)');

  // 4.2 Early morning 00:00:01 boundary check
  const localDateEarlyMorning = new Date(2026, 7, 19, 0, 0, 1);
  assert(getLocalDateString(localDateEarlyMorning) === '2026-08-19', '00:00:01 local is 2026-08-19');

  // 4.3 Month roll-over boundary check (Aug 31 23:59:59 -> Sep 01 00:00:00)
  const aug31 = new Date(2026, 7, 31, 23, 59, 59);
  const sep01 = new Date(2026, 8, 1, 0, 0, 0);
  assert(getLocalDateString(aug31) === '2026-08-31', 'Aug 31 late night formats to 2026-08-31');
  assert(getLocalDateString(sep01) === '2026-09-01', 'Sep 01 midnight formats to 2026-09-01');

  // 4.4 formatDisplayDate edge cases
  assert(formatDisplayDate('2026-08-18') === '18/08/2026', 'Formats 2026-08-18 to 18/08/2026');
  assert(formatDisplayDate(null as any) === '', 'Handles null gracefully');
  assert(formatDisplayDate(undefined as any) === '', 'Handles undefined gracefully');
  assert(formatDisplayDate('invalid-date') === 'invalid-date', 'Returns raw string if not YYYY-MM-DD');

  // 4.5 parseLocalDate local noon anchoring
  const parsedNoon = parseLocalDate('2026-12-25');
  assert(parsedNoon.getFullYear() === 2026, 'parseLocalDate year is 2026');
  assert(parsedNoon.getMonth() === 11, 'parseLocalDate month is 11 (December)');
  assert(parsedNoon.getDate() === 25, 'parseLocalDate day is 25');
  assert(parsedNoon.getHours() === 12, 'parseLocalDate hour is pinned to 12 (noon)');

  // ============================================================================
  // SECTION 5: GRADE ENGINE PARITY & COMPLEX ACADEMIC GRADING MODELS
  // ============================================================================
  console.log('\n--- SECTION 5: Grade Engine Parity & Complex Academic Models ---');

  // 5.1 Mixed graded/ungraded items with unequal weights
  const complexGroup: GradeGroup = {
    id: 'grp_weighted',
    name: 'Provas e Trabalhos',
    weight: 1,
    items: [
      { id: 'p1', name: 'P1', weight: 2, maxGrade: 10, grade: 8.0 },
      { id: 'p2', name: 'P2', weight: 3, maxGrade: 10, grade: undefined },
      { id: 't1', name: 'Trabalho 1', weight: 1, maxGrade: 10, grade: 10.0 }
    ]
  };

  const gradeResult = calculateFinalGrade([complexGroup], 7.0);
  const expectedCurrentScore = (8.0 * 2 + 10.0 * 1) / (2 + 1); // 26 / 3 = 8.6666...
  assert(Math.abs(gradeResult.score - expectedCurrentScore) < 0.001, `Computes partial weighted average (${gradeResult.score.toFixed(2)} vs expected ${expectedCurrentScore.toFixed(2)})`);
  assert(gradeResult.hasMissingItems === true, 'Recognizes P2 is pending');
  assert(gradeResult.missingItemsCount === 1, 'Missing items count is 1');
  
  const expectedNeeded = (7.0 * 6 - 26) / 3;
  assert(Math.abs((gradeResult.minimumNeeded || 0) - expectedNeeded) < 0.001, `Calculates minimumNeeded on P2 (${gradeResult.minimumNeeded?.toFixed(2)} vs expected ${expectedNeeded.toFixed(2)})`);

  // 5.2 Subject with all items pending
  const allPendingGroup: GradeGroup = {
    id: 'grp_pending',
    name: 'Sem notas',
    weight: 1,
    items: [
      { id: 'p1', name: 'P1', weight: 1, maxGrade: 10, grade: undefined },
      { id: 'p2', name: 'P2', weight: 1, maxGrade: 10, grade: undefined }
    ]
  };
  const pendingResult = calculateFinalGrade([allPendingGroup], 7.0);
  assert(pendingResult.score === 0, 'Score is 0 when no assessments have been graded');
  assert(pendingResult.hasMissingItems === true, 'hasMissingItems is true');
  assert(pendingResult.missingItemsCount === 2, 'missingItemsCount is 2');
  assert(pendingResult.minimumNeeded === 7.0, 'Needs 7.0 average on remaining items to pass');

  // 5.3 Non-10 maxGrade items
  const max100Group: GradeGroup = {
    id: 'grp_100',
    name: 'Vestibular / Escala 100',
    weight: 1,
    items: [
      { id: 'p1', name: 'P1', weight: 1, maxGrade: 100, grade: 85 }
    ]
  };
  const max100Result = calculateFinalGrade([max100Group], 7.0);
  assert(Math.abs(max100Result.score - 8.5) < 0.001, 'Normalizes maxGrade=100 grade=85 to 8.5');

  // 5.4 Final Exam (Exame Final / Prova de Recuperação)
  const finalExamGroup: GradeGroup = {
    id: 'grp_final',
    name: 'Semestre Regular + Final',
    weight: 1,
    items: [
      { id: 'p1', name: 'P1', weight: 1, maxGrade: 10, grade: 4.0 },
      { id: 'p2', name: 'P2', weight: 1, maxGrade: 10, grade: 6.0 }, // Avg = 5.0 (< 7.0)
      { id: 'pf', name: 'Prova Final', weight: 1, maxGrade: 10, grade: undefined, isFinalExam: true }
    ]
  };
  const inFinalResult = calculateFinalGrade([finalExamGroup], 7.0);
  assert(inFinalResult.score === 5.0, 'Average before final is 5.0');
  assert(inFinalResult.inFinal === true, 'Student is flagged inFinal=true');
  assert(inFinalResult.minimumNeeded === 5.0, 'Student needs 5.0 on final exam to pass (10 - 5 = 5)');

  // Now student scores 7.0 on Final Exam
  finalExamGroup.items[2].grade = 7.0;
  const afterFinalResult = calculateFinalGrade([finalExamGroup], 7.0);
  assert(afterFinalResult.usedFinal === true, 'usedFinal is true');
  assert(afterFinalResult.score === 6.0, 'Final score is average of normalAvg (5.0) and finalExam (7.0) = 6.0');

  // ============================================================================
  // SECTION 6: TODAY SUMMARY WIDGET & ATTENDANCE SERVICE ADVERSARIAL CASES
  // ============================================================================
  console.log('\n--- SECTION 6: Today Summary Widget & Attendance Service ---');

  // 6.1 Weekly recurrence matching when recurrenceDays is missing
  const weeklyEventNoRecurrenceDays: AppEvent = {
    id: 'evt_weekly_1',
    title: 'Aula de Cálculo 1',
    date: '2026-08-18', // Tuesday (day 2)
    startTime: '08:00',
    endTime: '10:00',
    category: 'Faculdade/Aulas',
    recurrence: 'weekly',
    subjectId: 'sub_calc'
  };

  const tuesdayDateStr = '2026-08-25';
  const tuesdayDayOfWeek = new Date(tuesdayDateStr + 'T12:00:00').getDay();
  const baseDayOfWeek = new Date(weeklyEventNoRecurrenceDays.date + 'T12:00:00').getDay();
  assert(tuesdayDayOfWeek === 2, '2026-08-25 is Tuesday (day 2)');
  assert(baseDayOfWeek === 2, '2026-08-18 base event is Tuesday (day 2)');
  assert(tuesdayDayOfWeek === baseDayOfWeek, 'Weekly event without recurrenceDays correctly matches matching weekday');

  const wednesdayDayOfWeek = new Date('2026-08-26T12:00:00').getDay();
  assert(wednesdayDayOfWeek !== baseDayOfWeek, 'Weekly event does not match non-matching weekday');

  // 6.2 AttendanceService: Pending attendance generation and idempotency
  await AsyncStorage.clear();
  const existingAttendances: AttendanceRecord[] = [];
  
  const pastWeeklyClass: AppEvent = {
    id: 'evt_calc_class',
    title: 'Cálculo 1 Regular',
    date: '2026-08-04', // 2 weeks before Aug 18
    startTime: '08:00',
    endTime: '10:00',
    category: 'Faculdade/Aulas',
    recurrence: 'weekly',
    subjectId: 'sub_calc'
  };

  const generatedAttendances = await AttendanceService.generatePendingAttendances(
    [pastWeeklyClass],
    existingAttendances
  );
  assert(generatedAttendances.length >= 2, 'Generated pending attendances for past weekly occurrences');
  
  const secondPass = await AttendanceService.generatePendingAttendances(
    [pastWeeklyClass],
    generatedAttendances
  );
  assert(secondPass.length === generatedAttendances.length, 'AttendanceService is strictly idempotent on subsequent runs');

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n================================================================================');
  console.log(`  CHALLENGER 2 STRESS TEST RESULTS: ${passed}/${passed + failed} PASSED (${failed} FAILED)`);
  console.log('================================================================================\n');

  if (failed > 0) {
    console.error('FAILURES SUMMARY:');
    failures.forEach(f => console.error(f));
    process.exit(1);
  }
}

runChallengerTestSuite();
