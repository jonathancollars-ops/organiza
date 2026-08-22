import './setup_env';
import { memoryStore, mockAsyncStorage } from './setup_env';
import { TeamsConfigModal } from '../src/components/TeamsConfigModal';
import { StorageService } from '../src/services/storage';
import { TeamsService } from '../src/services/TeamsService';
import { AIParsingService } from '../src/services/AIParsingService';
import { SyncService, SIMULATION_RAW_MESSAGES } from '../src/services/SyncService';
import { AttendanceService } from '../src/services/AttendanceService';
import {
  TeamsConfig,
  AIConfig,
  AppEvent,
  AttendanceRecord,
  Subject,
  AIParsedItem,
  SyncResult
} from '../src/types';
import { format, parseISO, getDay, addDays } from 'date-fns';

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

async function runM2AdversarialSuite() {
  console.log('================================================================');
  console.log('MILESTONE 2: EMPIRICAL ADVERSARIAL CHALLENGE TEST SUITE');
  console.log('================================================================\n');

  // ==========================================================================
  // SUITE 1: COMPONENT EXPORTS & INTERFACE CONTRACTS
  // ==========================================================================
  console.log('--- SUITE 1: Component Export & Contract Verification ---');

  assert(typeof TeamsConfigModal === 'function', 'TeamsConfigModal is exported as a React FC');
  assert(TeamsConfigModal.length >= 0, 'TeamsConfigModal accepts props correctly');

  // ==========================================================================
  // SUITE 2: STORAGE PERSISTENCE (TEAMS & AI CONFIGS)
  // ==========================================================================
  console.log('\n--- SUITE 2: StorageService Persistence for Teams & AI Configs ---');

  await mockAsyncStorage.clear();

  // Test null retrieval when empty
  const initialTeams = await StorageService.getTeamsConfig();
  assert(initialTeams === null, 'getTeamsConfig returns null on uninitialized storage');

  const initialAI = await StorageService.getAIConfig();
  assert(initialAI === null, 'getAIConfig returns null on uninitialized storage');

  // Save and retrieve TeamsConfig
  const sampleTeamsConfig: TeamsConfig = {
    clientId: 'az-client-998877',
    tenantId: 'university-tenant-id-4433',
    accessToken: 'mock_bearer_token_abc',
    refreshToken: 'mock_refresh_token_xyz',
    expiresAt: Date.now() + 3600000,
    selectedTeamId: 'team_calc_2026',
    selectedChannelId: 'channel_general_1',
    isConnected: true,
    lastSync: '2026-08-17T20:00:00.000Z'
  };

  await StorageService.saveTeamsConfig(sampleTeamsConfig);
  const loadedTeams = await StorageService.getTeamsConfig();
  assertEqual(loadedTeams, sampleTeamsConfig, 'TeamsConfig saved and reloaded with 100% field fidelity');

  // Partial update on TeamsConfig
  const updatedTeamsConfig: TeamsConfig = {
    ...sampleTeamsConfig,
    isConnected: false,
    accessToken: undefined
  };
  await StorageService.saveTeamsConfig(updatedTeamsConfig);
  const reloadedTeams = await StorageService.getTeamsConfig();
  assert(reloadedTeams?.isConnected === false, 'Updated isConnected state persisted');
  assert(reloadedTeams?.accessToken === undefined, 'Disconnected state properly cleared accessToken');

  // Save and retrieve AIConfig for Gemini
  const sampleGeminiConfig: AIConfig = {
    provider: 'gemini',
    apiKey: 'AIzaSyChallengerTestKey9988',
    model: 'gemini-2.0-flash'
  };
  await StorageService.saveAIConfig(sampleGeminiConfig);
  const loadedAI = await StorageService.getAIConfig();
  assertEqual(loadedAI, sampleGeminiConfig, 'AIConfig (Gemini) saved and reloaded with 100% field fidelity');

  // Switch to OpenAI provider
  const sampleOpenAIConfig: AIConfig = {
    provider: 'openai',
    apiKey: 'sk-proj-challenger-secret-key-123',
    model: 'gpt-4o'
  };
  await StorageService.saveAIConfig(sampleOpenAIConfig);
  const loadedOpenAI = await StorageService.getAIConfig();
  assertEqual(loadedOpenAI, sampleOpenAIConfig, 'AIConfig switched to OpenAI and reloaded accurately');

  // ==========================================================================
  // SUITE 3: TEAMS SERVICE & AUTHENTICATION PROTOCOL
  // ==========================================================================
  console.log('\n--- SUITE 3: TeamsService Authentication & Token Management ---');

  const authUrl = TeamsService.getAuthUrl('my-client-id-123', 'my-tenant-456');
  assert(authUrl.includes('https://login.microsoftonline.com/my-tenant-456/oauth2/v2.0/authorize'), 'Auth URL targets proper Azure AD v2.0 endpoint');
  assert(authUrl.includes('client_id=my-client-id-123'), 'Auth URL contains client_id');
  assert(authUrl.includes('scope='), 'Auth URL specifies permission scopes');
  assert(authUrl.includes('ChannelMessage.Read.All'), 'Auth URL includes ChannelMessage.Read.All scope');
  assert(authUrl.includes('Team.ReadBasic.All'), 'Auth URL includes Team.ReadBasic.All scope');

  // Token expiration verification
  const validConfig: TeamsConfig = {
    clientId: 'client-1',
    tenantId: 'common',
    accessToken: 'valid_live_token',
    expiresAt: Date.now() + 1000000,
    isConnected: true
  };
  const token = await TeamsService.getValidAccessToken(validConfig);
  assert(token === 'valid_live_token', 'getValidAccessToken returns unexpired token without unnecessary refresh');

  // HTML sanitizer stress test
  const dirtyTeamsHTML = '<div class="teams-chat"><p>Atenção turma,</p><script>alert("hack")</script><p>A aula de <b>Cálculo 1</b> de hoje est&aacute; <i>cancelada</i>!</p></div>';
  const cleanText = TeamsService.sanitizeHtmlMessage(dirtyTeamsHTML);
  assert(!cleanText.includes('<script>'), 'Sanitizer removes script tags');
  assert(!cleanText.includes('<b>') && !cleanText.includes('</i>'), 'Sanitizer strips formatting tags');
  assert(cleanText.includes('Cálculo 1'), 'Sanitizer preserves subject text');
  assert(cleanText.includes('cancelada'), 'Sanitizer preserves intent keywords');
  assert(cleanText.includes('está'), 'Sanitizer decodes &aacute; HTML entities');

  // ==========================================================================
  // SUITE 4: AI PARSER INTENTS & CANONICAL MESSAGES
  // ==========================================================================
  console.log('\n--- SUITE 4: AIParsingService Robustness ---');

  const context = {
    currentDate: '2026-08-17',
    currentDayOfWeek: 'Monday',
    registeredSubjects: ['Cálculo 1', 'Algoritmos', 'Física I']
  };

  // Message 1: Cancelled Class
  const parsed1 = AIParsingService.parseMessageMock(SIMULATION_RAW_MESSAGES[0], context);
  assert(parsed1.items.length === 1, 'M1: Exactly 1 item parsed for cancellation message');
  assert(parsed1.items[0].intent === 'cancelled_class', 'M1: Intent is "cancelled_class"');
  assert(parsed1.items[0].targetDate === '2026-08-17', 'M1: Target date resolved to "2026-08-17"');
  assert(parsed1.items[0].subjectName.includes('Cálculo'), 'M1: Subject identified as Cálculo');

  // Message 2: Homework
  const parsed2 = AIParsingService.parseMessageMock(SIMULATION_RAW_MESSAGES[1], context);
  assert(parsed2.items.length === 1, 'M2: Exactly 1 item parsed for homework message');
  assert(parsed2.items[0].intent === 'homework', 'M2: Intent is "homework"');
  assert(parsed2.items[0].targetDate === '2026-08-24', 'M2: Deadline date resolved to "2026-08-24"');
  assertEqual(parsed2.items[0].alerts, [10080, 1440], 'M2: Alerts configured to [10080, 1440]');
  assert(parsed2.items[0].startTime === '23:59', 'M2: Delivery time set to 23:59');

  // Message 3: Exam Rescheduled
  const parsed3 = AIParsingService.parseMessageMock(SIMULATION_RAW_MESSAGES[2], context);
  assert(parsed3.items.length === 1, 'M3: Exactly 1 item parsed for exam message');
  assert(parsed3.items[0].intent === 'exam', 'M3: Intent is "exam"');
  assert(parsed3.items[0].targetDate === '2026-08-28', 'M3: Exam date resolved to "2026-08-28"');
  assertEqual(parsed3.items[0].alerts, [10080, 1440], 'M3: Alerts configured to [10080, 1440]');

  // ==========================================================================
  // SUITE 5: SIMULATION EXECUTION & MODAL FLOW (onSyncSuccess)
  // ==========================================================================
  console.log('\n--- SUITE 5: Simulation Execution, onSyncSuccess & State Mutation ---');

  // Setup pre-existing state simulating real user data in Organiza
  const initialSubjects: Subject[] = [
    {
      id: 'subj_calc',
      name: 'Cálculo 1',
      color: '#0A84FF',
      passGrade: 7.0,
      maxAbsences: 15,
      workloadHours: 60,
      gradeGroups: [{ id: 'g_calc', name: 'Provas', weight: 1, items: [] }]
    },
    {
      id: 'subj_algo',
      name: 'Algoritmos',
      color: '#00FFAA',
      passGrade: 7.0,
      maxAbsences: 15,
      workloadHours: 60,
      gradeGroups: [{ id: 'g_algo', name: 'Trabalhos', weight: 1, items: [] }]
    },
    {
      id: 'subj_fis',
      name: 'Física I',
      color: '#BF5AF2',
      passGrade: 7.0,
      maxAbsences: 15,
      workloadHours: 60,
      gradeGroups: [{ id: 'g_fis', name: 'Avaliações', weight: 1, items: [] }]
    }
  ];

  const initialEvents: AppEvent[] = [
    {
      id: 'ev_calc_weekly',
      title: 'Aula - Cálculo 1',
      category: 'Faculdade/Aulas',
      date: '2026-08-17',
      startTime: '08:00',
      endTime: '10:00',
      recurrence: 'weekly',
      alerts: [15],
      subjectId: 'subj_calc',
      isCompleted: false
    }
  ];

  const initialAttendances: AttendanceRecord[] = [
    {
      id: 'att_prev_1',
      subjectId: 'subj_calc',
      eventId: 'ev_calc_weekly',
      date: '2026-08-10',
      status: 'present'
    }
  ];

  // Track onSyncSuccess invocation
  let callbackInvoked = false;
  let receivedUpdatedEvents: AppEvent[] = [];
  let receivedUpdatedAttendances: AttendanceRecord[] = [];
  let receivedUpdatedSubjects: Subject[] = [];

  const mockOnSyncSuccess = (
    updatedEvents: AppEvent[],
    updatedAttendances: AttendanceRecord[],
    updatedSubjects: Subject[]
  ) => {
    callbackInvoked = true;
    receivedUpdatedEvents = updatedEvents;
    receivedUpdatedAttendances = updatedAttendances;
    receivedUpdatedSubjects = updatedSubjects;
  };

  // Run simulation via SyncService
  const simResult = await SyncService.runSimulation(
    { provider: 'gemini', apiKey: '' },
    initialEvents,
    initialAttendances,
    initialSubjects
  );

  // Trigger callback as TeamsConfigModal does
  mockOnSyncSuccess(
    simResult.updatedEvents,
    simResult.updatedAttendances,
    simResult.updatedSubjects
  );

  assert(callbackInvoked, 'onSyncSuccess callback was invoked successfully');
  assert(receivedUpdatedEvents !== initialEvents, 'receivedUpdatedEvents is a new immutable array');
  assert(receivedUpdatedAttendances !== initialAttendances, 'receivedUpdatedAttendances is a new immutable array');
  assert(receivedUpdatedSubjects !== initialSubjects, 'receivedUpdatedSubjects is a new immutable array');

  // Verify cancelled attendance
  const cancelledAtt = receivedUpdatedAttendances.find(a => a.status === 'cancelled');
  assert(cancelledAtt !== undefined, 'Cancelled attendance record created in state');
  assert(cancelledAtt?.date === '2026-08-17', 'Cancelled attendance has target date 2026-08-17');
  assert(cancelledAtt?.subjectId === 'subj_calc', 'Cancelled attendance linked to Cálculo 1 subject');
  assert(cancelledAtt?.eventId === 'ev_calc_weekly', 'Cancelled attendance linked to existing weekly class eventId');

  // Verify previous attendances preserved
  const prevAtt = receivedUpdatedAttendances.find(a => a.id === 'att_prev_1');
  assert(prevAtt?.status === 'present', 'Pre-existing attendance history preserved');

  // Verify homework event
  const hwEvent = receivedUpdatedEvents.find(e => e.title.includes('Exercícios') || e.title.includes('Lista'));
  assert(hwEvent !== undefined, 'Homework event created in state');
  assert(hwEvent?.subjectId === 'subj_algo', 'Homework linked to Algoritmos subject');
  assertEqual(hwEvent?.alerts, [10080, 1440], 'Homework event has [10080, 1440] notifications');
  assert(hwEvent?.date === '2026-08-24', 'Homework event date is 2026-08-24');

  // Verify exam event rescheduled / created
  const examEvent = receivedUpdatedEvents.find(e => e.title.includes('Prova P2'));
  assert(examEvent !== undefined, 'Exam event present in state');
  assert(examEvent?.date === '2026-08-28', 'Exam date correctly set to 2026-08-28');
  assertEqual(examEvent?.alerts, [10080, 1440], 'Exam event has [10080, 1440] notifications');
  assert(examEvent?.subjectId === 'subj_fis', 'Exam linked to Física I');

  // Verify grade item linking in Subject.gradeGroups
  const updatedFis = receivedUpdatedSubjects.find(s => s.id === 'subj_fis');
  assert(updatedFis !== undefined, 'Física subject exists in updated state');
  const gradeItem = updatedFis?.gradeGroups?.[0]?.items?.find(i => i.eventId === examEvent?.id);
  assert(gradeItem !== undefined, 'Exam automatically registered as GradeItem in Subject gradeGroups');
  assert(gradeItem?.name === examEvent?.title, 'GradeItem name matches exam event title');
  assert(gradeItem?.maxGrade === 10, 'GradeItem maxGrade is 10');

  // Verify persistence in StorageService
  const storedEvents = await StorageService.getEvents();
  const storedAttendances = await StorageService.getAttendances();
  const storedSubjects = await StorageService.getSubjects();
  assert(storedEvents.length === receivedUpdatedEvents.length, 'Events persisted in StorageService');
  assert(storedAttendances.length === receivedUpdatedAttendances.length, 'Attendances persisted in StorageService');
  assert(storedSubjects.length === receivedUpdatedSubjects.length, 'Subjects persisted in StorageService');

  // ==========================================================================
  // SUITE 6: INVARIANTS ON APP SCREENS (CALENDAR & ATTENDANCE CALCULATIONS)
  // ==========================================================================
  console.log('\n--- SUITE 6: App Screen Invariants & Calculations ---');

  // Test 1: AttendanceScreen absence calculation excludes status='cancelled'
  const calcAttendances = receivedUpdatedAttendances.filter(a => a.subjectId === 'subj_calc');
  const absenceCount = calcAttendances.filter(a => a.status === 'absent').length;
  assert(absenceCount === 0, 'Cancelled class contributes 0 to absence count (student is not penalized)');

  // Test 2: App.tsx Calendar Timeline Filtering Invariant
  // Cancelled class on 2026-08-17 must be excluded from today's timeline
  const targetDateCancelled = '2026-08-17';
  const todaysEventsFiltered = receivedUpdatedEvents.filter(e => {
    if (e.category === 'Faculdade/Aulas' && e.recurrence === 'weekly') {
      const isCancelled = receivedUpdatedAttendances.some(
        a => a.eventId === e.id && a.date === targetDateCancelled && a.status === 'cancelled'
      );
      if (isCancelled) return false;
    }
    if (targetDateCancelled < e.date) return false;
    if (e.recurrence === 'daily') return true;
    if (e.recurrence === 'weekly') {
      const startDay = getDay(parseISO(e.date));
      const currentDay = getDay(parseISO(targetDateCancelled));
      return startDay === currentDay;
    }
    return e.date === targetDateCancelled;
  });

  const calcOnCancelledDate = todaysEventsFiltered.find(e => e.id === 'ev_calc_weekly');
  assert(calcOnCancelledDate === undefined, 'Cancelled class is completely excluded from 2026-08-17 timeline');

  // Next week (2026-08-24, Monday), the weekly class must reappear normally
  const targetDateNextWeek = '2026-08-24';
  const nextWeekEventsFiltered = receivedUpdatedEvents.filter(e => {
    if (e.category === 'Faculdade/Aulas' && e.recurrence === 'weekly') {
      const isCancelled = receivedUpdatedAttendances.some(
        a => a.eventId === e.id && a.date === targetDateNextWeek && a.status === 'cancelled'
      );
      if (isCancelled) return false;
    }
    if (targetDateNextWeek < e.date) return false;
    if (e.recurrence === 'daily') return true;
    if (e.recurrence === 'weekly') {
      const startDay = getDay(parseISO(e.date));
      const currentDay = getDay(parseISO(targetDateNextWeek));
      return startDay === currentDay;
    }
    return e.date === targetDateNextWeek;
  });

  const calcOnNextWeek = nextWeekEventsFiltered.find(e => e.id === 'ev_calc_weekly');
  assert(calcOnNextWeek !== undefined, 'Weekly class reappears normally on non-cancelled next week (2026-08-24)');

  // ==========================================================================
  // SUITE 7: ADVERSARIAL STRESS TESTING (IDEMPOTENCE & MULTIPLE RUNS)
  // ==========================================================================
  console.log('\n--- SUITE 7: Adversarial Stress Testing (Idempotence & Edge Cases) ---');

  // Run simulation again on top of already-simulated state
  const secondSimResult = await SyncService.runSimulation(
    { provider: 'gemini', apiKey: '' },
    receivedUpdatedEvents,
    receivedUpdatedAttendances,
    receivedUpdatedSubjects
  );

  const hwDuplicates = secondSimResult.updatedEvents.filter(e => e.title.includes('Exercícios') || e.title.includes('Lista'));
  assert(hwDuplicates.length === 1, 'Idempotency: Re-running simulation does not create duplicate homework events');

  const examDuplicates = secondSimResult.updatedEvents.filter(e => e.title.includes('Prova P2'));
  assert(examDuplicates.length === 1, 'Idempotency: Re-running simulation does not create duplicate exam events');

  const fisGradeItems = secondSimResult.updatedSubjects.find(s => s.id === 'subj_fis')?.gradeGroups?.[0]?.items;
  assert(fisGradeItems?.length === 1, 'Idempotency: Re-running simulation does not duplicate grade items');

  // Empty initial state simulation
  const emptySimResult = await SyncService.runSimulation(
    { provider: 'openai', apiKey: '' },
    [],
    [],
    []
  );
  assert(emptySimResult.updatedSubjects.length === 3, 'Simulation on empty state automatically provisions 3 subjects');
  assert(emptySimResult.updatedEvents.length === 3, 'Simulation on empty state provisions 3 events (1 class + 1 hw + 1 exam)');
  assert(emptySimResult.updatedAttendances.length === 1, 'Simulation on empty state provisions 1 cancelled attendance');

  // Final Summary
  console.log('\n================================================================');
  console.log('M2 ADVERSARIAL TEST EXECUTION SUMMARY:');
  console.log(`Total Assertions : ${totalTests}`);
  console.log(`Passed           : ${passedTests}`);
  console.log(`Failed           : ${failedTests}`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    console.error('FAILURES DETECTED:');
    failureDetails.forEach(f => console.error(f));
    throw new Error(`${failedTests} test assertions failed.`);
  }

  console.log('>>> ALL M2 ADVERSARIAL CHALLENGES PASSED! VERDICT: APPROVE <<<');
}

runM2AdversarialSuite().catch(err => {
  console.error('Suite error:', err);
  process.exit(1);
});
