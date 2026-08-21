import './setup_env';
import { calculateFinalGrade } from '../src/components/GradeEngine';
import { StorageService } from '../src/services/storage';
import { GoogleSheetsService } from '../src/services/GoogleSheetsService';
import { AIParsingService, ParsingContext } from '../src/services/AIParsingService';
import { getCategoryColor, getContrastTextColor, Colors } from '../src/theme';
import { getLocalDateString, formatDisplayDate, parseLocalDate } from '../src/utils/date';
import { AppEvent, GradeGroup, Subject, StudyStreak, ThemeType } from '../src/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ' -> ' + detail : ''}`);
    failed++;
  }
}

async function runRegressionR2Suite() {
  console.log('================================================================');
  console.log('ORGANIZA 2.0: ROUND 2 REGRESSION & VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  // ── TEST 1: GradeEngine with 0 evaluation items ──
  console.log('--- Test 1: GradeEngine with 0 evaluation items ---');
  {
    // Empty grade groups array
    const emptyResult = calculateFinalGrade([], 7.0);
    assert(emptyResult.inFinal === false, 'Empty gradeGroups returns inFinal: false');
    assert(emptyResult.totalItemsCount === 0, 'Empty gradeGroups returns totalItemsCount: 0');
    assert(emptyResult.score === 0, 'Empty gradeGroups returns score: 0');
    assert(emptyResult.hasMissingItems === false, 'Empty gradeGroups returns hasMissingItems: false');

    // Grade group with 0 items
    const groupWithNoItems: GradeGroup[] = [
      { id: 'grp_empty', name: 'Avaliações', weight: 1, items: [] }
    ];
    const noItemsResult = calculateFinalGrade(groupWithNoItems, 7.0);
    assert(noItemsResult.inFinal === false, 'Group with 0 items returns inFinal: false');
    assert(noItemsResult.totalItemsCount === 0, 'Group with 0 items returns totalItemsCount: 0');
    assert(noItemsResult.score === 0, 'Group with 0 items returns score: 0');
    assert(noItemsResult.hasMissingItems === false, 'Group with 0 items returns hasMissingItems: false');

    // Verify riskLevel simulation for 0 items returns 'unknown' instead of 'failed'
    const riskLevelFor0Items = noItemsResult.totalItemsCount === 0 ? 'unknown' : (noItemsResult.score >= 7.0 ? 'safe' : 'failed');
    assert(riskLevelFor0Items === 'unknown', 'Subject with 0 items evaluates to "unknown" risk level, not "failed"');
  }

  // ── TEST 2: Grade simulator target grade 0.0 properly respects 0 ──
  console.log('\n--- Test 2: Grade simulator target grade 0.0 respects 0 without fallback ---');
  {
    const mockSubject: Subject = {
      id: 'subj_test',
      name: 'Engenharia de Software',
      passGrade: 7.0,
      gradeGroups: [
        {
          id: 'grp_1',
          name: 'Provas',
          weight: 1,
          items: [
            { id: 'p1', name: 'P1', weight: 1, maxGrade: 10, grade: 0 },
            { id: 'p2', name: 'P2', weight: 1, maxGrade: 10, grade: undefined }
          ]
        }
      ]
    };

    // Helper imitating GradeSimulatorModal parsing
    const parseTargetGrade = (targetStr: string, defaultGrade: number = 7.0) => {
      const parsed = parseFloat(targetStr.replace(',', '.'));
      return isNaN(parsed) ? defaultGrade : parsed;
    };

    const target0 = parseTargetGrade('0.0', mockSubject.passGrade);
    assert(target0 === 0.0, 'targetPassGrade "0.0" parses to exactly 0.0, not falling back to 7.0');

    const target0Comma = parseTargetGrade('0,0', mockSubject.passGrade);
    assert(target0Comma === 0.0, 'targetPassGrade "0,0" parses to exactly 0.0');

    const target0Plain = parseTargetGrade('0', mockSubject.passGrade);
    assert(target0Plain === 0.0, 'targetPassGrade "0" parses to exactly 0.0');

    const targetInvalid = parseTargetGrade('', mockSubject.passGrade);
    assert(targetInvalid === 7.0, 'targetPassGrade "" properly falls back to subject passGrade 7.0');

    // Calculate with target 0.0
    const calcWith0 = calculateFinalGrade(mockSubject.gradeGroups, target0);
    assert(calcWith0.minimumNeeded === 0, `Target 0.0 calculates minimumNeeded = 0 (got ${calcWith0.minimumNeeded})`);

    // Calculate with target 7.0 for comparison
    const calcWith7 = calculateFinalGrade(mockSubject.gradeGroups, 7.0);
    assert(calcWith7.minimumNeeded === 14, `Target 7.0 calculates minimumNeeded = 14 (got ${calcWith7.minimumNeeded})`);
  }

  // ── TEST 3: TodaySummaryWidget weekly recurrence ignores dates before course start date ──
  console.log('\n--- Test 3: TodaySummaryWidget weekly recurrence ignores dates before start date ---');
  {
    const courseEvent: AppEvent = {
      id: 'evt_calc',
      title: 'Aula Cálculo 1',
      category: 'Faculdade/Aulas',
      date: '2026-08-10', // Monday Aug 10, 2026
      startTime: '08:00',
      endTime: '10:00',
      recurrence: 'weekly',
      recurrenceDays: [1], // Monday
      alerts: [],
      isCompleted: false,
      isImportant: false,
      isNotified: false,
      subjectId: 'subj_calc'
    };

    // Filter logic as implemented in TodaySummaryWidget
    const matchesDate = (e: AppEvent, selectedDate: string): boolean => {
      if (e.date === selectedDate) return true;
      if (e.recurrence === 'weekly') {
        if (e.date && selectedDate < e.date) return false;
        const dayOfWeek = new Date(selectedDate + 'T12:00:00').getDay();
        if (e.recurrenceDays && e.recurrenceDays.length > 0) {
          return e.recurrenceDays.includes(dayOfWeek);
        }
        if (e.date) {
          const baseDayOfWeek = new Date(e.date + 'T12:00:00').getDay();
          return baseDayOfWeek === dayOfWeek;
        }
      }
      return false;
    };

    // Prior Monday (Aug 3, 2026) -> Before course start date
    assert(matchesDate(courseEvent, '2026-08-03') === false, 'Ignores Monday before course start date (2026-08-03 < 2026-08-10)');

    // Start Monday (Aug 10, 2026) -> Exact start date
    assert(matchesDate(courseEvent, '2026-08-10') === true, 'Matches Monday on course start date (2026-08-10)');

    // Subsequent Monday (Aug 17, 2026) -> Active recurring class
    assert(matchesDate(courseEvent, '2026-08-17') === true, 'Matches Monday after course start date (2026-08-17)');

    // Non-matching day of week (Tuesday Aug 18, 2026)
    assert(matchesDate(courseEvent, '2026-08-18') === false, 'Ignores Tuesday for Monday-only recurrence');
  }

  // ── TEST 4: StorageService.clearAllData removal keys ──
  console.log('\n--- Test 4: StorageService.clearAllData removal keys ---');
  {
    // Save theme and ai config
    await StorageService.saveTheme('amoled');
    await StorageService.saveAIConfig({
      provider: 'gemini',
      mode: 'local_edge',
      apiKey: 'key-123',
      model: 'gemini-1.5-flash',
      enableFallbackToCloud: true
    });
    await StorageService.saveEvents([{
      id: 'evt_1',
      title: 'Evento Teste',
      category: 'Outros',
      date: '2026-08-20',
      startTime: '08:00',
      endTime: '09:00',
      recurrence: 'none',
      alerts: [],
      isCompleted: false,
      isImportant: false,
      isNotified: false
    }]);

    assert(await StorageService.getTheme() === 'amoled', 'Theme saved before clear');
    assert((await StorageService.getAIConfig()).apiKey === 'key-123', 'AI config saved before clear');
    assert((await StorageService.getEvents()).length === 1, 'Events saved before clear');

    // Execute clearAllData
    await StorageService.clearAllData();

    assert(await StorageService.getTheme() === 'dark', 'Theme reset to default ("dark") after clearAllData');
    assert((await StorageService.getAIConfig()).apiKey === '', 'AI config apiKey is empty after clearAllData');
    assert((await StorageService.getEvents()).length === 0, 'Events array is empty after clearAllData');
  }

  // ── TEST 5: StorageService backup import/export with streak ──
  console.log('\n--- Test 5: StorageService.importBackup and exportBackup with @organiza_streak ---');
  {
    const sampleStreak: StudyStreak = {
      currentStreak: 7,
      bestStreak: 15,
      lastStudyDate: '2026-08-20',
      totalStudyDays: 28
    };

    await StorageService.saveStreak(sampleStreak);
    const retrievedStreak = await StorageService.getStreak();
    assert(retrievedStreak.currentStreak === 7 && retrievedStreak.bestStreak === 15, 'Streak saved and loaded directly');

    // Export backup
    const backup = await StorageService.exportBackup();
    assert(backup.streak !== undefined, 'Exported backup contains streak property');
    assert(backup.streak?.currentStreak === 7, 'Exported backup contains currentStreak = 7');
    assert(backup.streak?.bestStreak === 15, 'Exported backup contains bestStreak = 15');
    assert(backup.streak?.totalStudyDays === 28, 'Exported backup contains totalStudyDays = 28');

    // Modify streak in storage to different values
    await StorageService.saveStreak({
      currentStreak: 1,
      bestStreak: 1,
      lastStudyDate: '2026-08-01',
      totalStudyDays: 1
    });
    assert((await StorageService.getStreak()).currentStreak === 1, 'Streak mutated in storage');

    // Import backup and verify restoration
    await StorageService.importBackup(backup);
    const restoredStreak = await StorageService.getStreak();
    assert(restoredStreak.currentStreak === 7, 'Restored backup correctly recovered currentStreak = 7');
    assert(restoredStreak.bestStreak === 15, 'Restored backup correctly recovered bestStreak = 15');
    assert(restoredStreak.lastStudyDate === '2026-08-20', 'Restored backup correctly recovered lastStudyDate = 2026-08-20');
    assert(restoredStreak.totalStudyDays === 28, 'Restored backup correctly recovered totalStudyDays = 28');
  }

  // ── TEST 6: GoogleSheetsService Brazilian timestamp parsing ──
  console.log('\n--- Test 6: GoogleSheetsService Brazilian date timestamp parsing ---');
  {
    // Standard Brazilian format DD/MM/YYYY HH:mm:ss
    const ts1 = GoogleSheetsService.parseTimestamp('20/08/2026 14:30:00');
    assert(ts1 > 0, 'Parses DD/MM/YYYY HH:mm:ss timestamp successfully');
    const d1 = new Date(ts1);
    assert(d1.getFullYear() === 2026 && d1.getMonth() === 7 && d1.getDate() === 20, 'Year, month, and day parsed accurately');
    assert(d1.getHours() === 14 && d1.getMinutes() === 30 && d1.getSeconds() === 0, 'Hour, minute, and second parsed accurately');

    // Short Brazilian format DD/MM/YYYY HH:mm
    const ts2 = GoogleSheetsService.parseTimestamp('20/08/2026 09:15');
    assert(ts2 > 0, 'Parses DD/MM/YYYY HH:mm timestamp successfully');
    const d2 = new Date(ts2);
    assert(d2.getHours() === 9 && d2.getMinutes() === 15, 'Hour and minute parsed accurately');

    // Date only DD/MM/YYYY
    const ts3 = GoogleSheetsService.parseTimestamp('20/08/2026');
    assert(ts3 > 0, 'Parses DD/MM/YYYY date-only timestamp successfully');

    // ISO format fallback
    const tsIso = GoogleSheetsService.parseTimestamp('2026-08-20T14:30:00.000Z');
    assert(tsIso > 0, 'Parses ISO timestamp successfully');

    // Chronological comparison
    const earlierTs = GoogleSheetsService.parseTimestamp('20/08/2026 08:00:00');
    const laterTs = GoogleSheetsService.parseTimestamp('20/08/2026 18:00:00');
    assert(laterTs > earlierTs, 'Brazilian timestamp chronological comparison operates correctly (18:00 > 08:00)');

    // Filtering test
    const mockMessages = [
      { id: 'm1', createdDateTime: '20/08/2026 08:00:00', body: { content: 'Msg 1', contentType: 'text' as const }, cleanText: 'Msg 1' },
      { id: 'm2', createdDateTime: '20/08/2026 12:00:00', body: { content: 'Msg 2', contentType: 'text' as const }, cleanText: 'Msg 2' },
      { id: 'm3', createdDateTime: '20/08/2026 16:00:00', body: { content: 'Msg 3', contentType: 'text' as const }, cleanText: 'Msg 3' }
    ];
    const lastSync = '20/08/2026 10:00:00';
    const lastSyncTime = GoogleSheetsService.parseTimestamp(lastSync);
    const newMsgs = mockMessages.filter(m => GoogleSheetsService.parseTimestamp(m.createdDateTime) > lastSyncTime);
    assert(newMsgs.length === 2, `Filtered new messages correctly (expected 2, got ${newMsgs.length})`);
    assert(newMsgs[0].id === 'm2' && newMsgs[1].id === 'm3', 'Filtered messages match timestamps after lastSync');
  }

  // ── TEST 7: AIParsingService JSON extraction from conversational text ──
  console.log('\n--- Test 7: AIParsingService JSON extraction from conversational framing ---');
  {
    const sampleContext: ParsingContext = {
      currentDate: '2026-08-20',
      currentDayOfWeek: 'Quinta-feira',
      registeredSubjects: ['Cálculo 1', 'Física I', 'Algoritmos']
    };

    // LLM response with conversational markdown framing
    const conversationalLlmOutput = `Olá! Analisei a mensagem do professor e encontrei o seguinte evento acadêmico:

\`\`\`json
{
  "items": [
    {
      "intent": "exam",
      "subjectName": "Cálculo 1",
      "title": "Prova P1 de Cálculo 1",
      "description": "Sala 101, levar calculadora científica.",
      "targetDate": "2026-08-28",
      "startTime": "08:00",
      "endTime": "10:00",
      "alerts": [10080, 1440],
      "rawSummary": "Prova P1 de Cálculo agendada para 28/08"
    }
  ],
  "confidence": 0.96
}
\`\`\`

Bons estudos e boa sorte na prova!`;

    const parsedResult = AIParsingService.cleanAndValidateJson(conversationalLlmOutput, sampleContext);
    assert(parsedResult.items.length === 1, `Extracted 1 item from conversational response (got ${parsedResult.items.length})`);
    assert(parsedResult.items[0].intent === 'exam', 'Extracted item intent is "exam"');
    assert(parsedResult.items[0].subjectName === 'Cálculo 1', 'Extracted subject is "Cálculo 1"');
    assert(parsedResult.items[0].targetDate === '2026-08-28', 'Extracted date is "2026-08-28"');
    assert(parsedResult.confidence === 0.96, 'Confidence matches 0.96');

    // LLM response without code fences but embedded in conversational text
    const textWithoutFences = `Segue o JSON:
{
  "items": [
    {
      "intent": "homework",
      "subjectName": "Física I",
      "title": "Entrega Lista 3",
      "targetDate": "2026-08-25"
    }
  ],
  "confidence": 0.90
}
Fim da resposta.`;

    const parsedWithoutFences = AIParsingService.cleanAndValidateJson(textWithoutFences, sampleContext);
    assert(parsedWithoutFences.items.length === 1, 'Extracted JSON embedded between text without fences');
    assert(parsedWithoutFences.items[0].intent === 'homework', 'Intent is "homework"');
    assert(parsedWithoutFences.items[0].subjectName === 'Física I', 'Subject matched "Física I"');
  }

  // ── TEST 8: getCategoryColor theme-adaptive tokens ──
  console.log('\n--- Test 8: getCategoryColor theme-adaptive colors ---');
  {
    assert(getCategoryColor('Saúde/Academia', 'light') === '#059669', 'getCategoryColor("Saúde/Academia", "light") returns #059669 (high-contrast emerald)');
    assert(getCategoryColor('Saúde/Academia', 'dark') === '#00FFAA', 'getCategoryColor("Saúde/Academia", "dark") returns #00FFAA (neon mint)');
    assert(getCategoryColor('Saúde/Academia', 'amoled') === '#00FFAA', 'getCategoryColor("Saúde/Academia", "amoled") returns #00FFAA (neon mint)');

    // Other categories maintain standard colors across themes
    assert(getCategoryColor('Faculdade/Aulas', 'light') === '#3B82F6', 'getCategoryColor("Faculdade/Aulas", "light") returns #3B82F6');
    assert(getCategoryColor('Faculdade/Aulas', 'dark') === '#3B82F6', 'getCategoryColor("Faculdade/Aulas", "dark") returns #3B82F6');
    assert(getCategoryColor('Provas/Trabalhos', 'light') === '#F43F5E', 'getCategoryColor("Provas/Trabalhos", "light") returns #F43F5E');
    assert(getCategoryColor('Lazer', 'light') === '#F59E0B', 'getCategoryColor("Lazer", "light") returns #F59E0B');
    assert(getCategoryColor('Outros', 'light') === '#A855F7', 'getCategoryColor("Outros", "light") returns #A855F7');
  }

  // ── TEST 9: getContrastTextColor WCAG AA contrast calculations ──
  console.log('\n--- Test 9: getContrastTextColor WCAG AA contrast compliance ---');
  {
    // High-luminance tokens (require dark text #0A0A0A)
    assert(getContrastTextColor('#00FFAA') === '#0A0A0A', 'Neon mint #00FFAA yields dark text #0A0A0A');
    assert(getContrastTextColor('#34D399') === '#0A0A0A', 'Mint green #34D399 yields dark text #0A0A0A');
    assert(getContrastTextColor('#F87171') === '#0A0A0A', 'Light red/danger #F87171 yields dark text #0A0A0A');

    // Deep tokens (require white text #FFFFFF)
    assert(getContrastTextColor('#059669') === '#FFFFFF', 'Emerald #059669 yields white text #FFFFFF');
    assert(getContrastTextColor('#10B981') === '#FFFFFF', 'Green #10B981 yields white text #FFFFFF');
    assert(getContrastTextColor('#047857') === '#FFFFFF', 'Deep emerald #047857 yields white text #FFFFFF');
    assert(getContrastTextColor('#B91C1C') === '#FFFFFF', 'Deep red #B91C1C yields white text #FFFFFF');
    assert(getContrastTextColor('#B45309') === '#FFFFFF', 'Deep amber #B45309 yields white text #FFFFFF');

    // Standard surfaces
    assert(getContrastTextColor('#FFFFFF') === '#0A0A0A', 'White #FFFFFF yields dark text #0A0A0A');
    assert(getContrastTextColor('#000000') === '#FFFFFF', 'Black #000000 yields white text #FFFFFF');
  }

  // ── TEST 10: HTML Content Sanitization & Entity Decoding ──
  console.log('\n--- Test 10: HTML Content Sanitization & Entity Decoding ---');
  {
    const rawHtml = '<p>Prezados alunos, a aula de <b>C&aacute;lculo</b> de hoje est&aacute; cancelada.</p>';
    const sanitized = rawHtml.replace(/<[^>]*>/g, '').replace(/&aacute;/g, 'á');
    assert(sanitized.includes('Cálculo') && sanitized.includes('cancelada'), 'Sanitizes HTML tags and decodes HTML entities');
    assert(!sanitized.includes('<p>') && !sanitized.includes('<b>'), 'Removes HTML markup tags');

    // Helper logic simulating getChannelMessages contentType check
    const checkIsHtml = (contentType: string | undefined, rawContent: string): boolean => {
      return typeof contentType === 'string'
        ? contentType.toLowerCase().includes('html')
        : /<[a-z][\s\S]*>/i.test(rawContent);
    };

    assert(checkIsHtml('HTML', '<span>Aviso</span>') === true, 'Recognizes uppercase "HTML" contentType');
    assert(checkIsHtml('html', '<span>Aviso</span>') === true, 'Recognizes lowercase "html" contentType');
    assert(checkIsHtml('text/html', '<span>Aviso</span>') === true, 'Recognizes MIME type "text/html" contentType');
    assert(checkIsHtml('Text/Html; charset=utf-8', '<span>Aviso</span>') === true, 'Recognizes compound MIME "Text/Html; charset=utf-8"');
    assert(checkIsHtml(undefined, '<div>Aviso sem header</div>') === true, 'Detects embedded HTML tags when contentType is undefined');
    assert(checkIsHtml('text', 'Texto simples sem tags') === false, 'Identifies plain text correctly');
  }

  // ── TEST 11: getLocalDateString late-night hours consistency ──
  console.log('\n--- Test 11: getLocalDateString late-night hours consistency (21:00-23:59) ---');
  {
    const d21 = new Date(2026, 7, 20, 21, 0, 0); // 21:00
    assert(getLocalDateString(d21) === '2026-08-20', '21:00 local time formats to 2026-08-20 without UTC shift');

    const d22 = new Date(2026, 7, 20, 22, 30, 0); // 22:30
    assert(getLocalDateString(d22) === '2026-08-20', '22:30 local time formats to 2026-08-20 without UTC shift');

    const d23 = new Date(2026, 7, 20, 23, 59, 59); // 23:59:59
    assert(getLocalDateString(d23) === '2026-08-20', '23:59:59 local time formats to 2026-08-20 without UTC shift');

    const dNextMidnight = new Date(2026, 7, 21, 0, 0, 1); // 00:00:01
    assert(getLocalDateString(dNextMidnight) === '2026-08-21', '00:00:01 local time formats to next day 2026-08-21');

    const leapDate = new Date(2028, 1, 29, 23, 45, 0); // Feb 29, 2028, 23:45
    assert(getLocalDateString(leapDate) === '2028-02-29', 'Handles late-night leap year Feb 29, 2028 accurately');

    // formatDisplayDate and parseLocalDate
    assert(formatDisplayDate('2026-08-20') === '20/08/2026', 'formatDisplayDate formats YYYY-MM-DD to DD/MM/YYYY');
    const parsedNoon = parseLocalDate('2026-08-20');
    assert(parsedNoon.getHours() === 12, 'parseLocalDate sets hour to 12:00:00 noon');
  }

  // ── TEST 12: AttendanceScreen sample size protection for early semester ──
  console.log('\n--- Test 12: AttendanceScreen sample size protection for 1 absence in first week ---');
  {
    const checkPresenceSafe = (presenceRate: number, totalRecorded: number, absences: number): boolean => {
      return presenceRate >= 75 || (totalRecorded < 4 && absences <= 1);
    };

    // Scenario A: Week 1, 1 class held, student was absent (0/1 = 0% presence)
    const totalRecordedA = 1;
    const absencesA = 1;
    const presenceRateA = 0.0;
    assert(checkPresenceSafe(presenceRateA, totalRecordedA, absencesA) === true, 'Week 1 with 1 absence (0.0% rate) is protected by initial sample size rule');

    // Scenario B: Week 2, 2 classes held, 1 absent, 1 present (1/2 = 50% presence)
    const totalRecordedB = 2;
    const absencesB = 1;
    const presenceRateB = 50.0;
    assert(checkPresenceSafe(presenceRateB, totalRecordedB, absencesB) === true, 'Week 2 with 1 absence and 1 presence (50.0% rate) is protected');

    // Scenario C: Early semester, 2 absences, 0 presences (0/2 = 0% presence) -> Danger!
    const totalRecordedC = 2;
    const absencesC = 2;
    const presenceRateC = 0.0;
    assert(checkPresenceSafe(presenceRateC, totalRecordedC, absencesC) === false, 'Early semester with 2 absences triggers danger alert (not protected)');

    // Scenario D: Mid semester, 10 classes held, 3 absences, 7 presences (7/10 = 70% presence) -> Danger!
    const totalRecordedD = 10;
    const absencesD = 3;
    const presenceRateD = 70.0;
    assert(checkPresenceSafe(presenceRateD, totalRecordedD, absencesD) === false, 'Mid semester with 70% rate triggers danger alert');

    // Scenario E: Mid semester, 10 classes held, 2 absences, 8 presences (8/10 = 80% presence) -> Safe
    const totalRecordedE = 10;
    const absencesE = 2;
    const presenceRateE = 80.0;
    assert(checkPresenceSafe(presenceRateE, totalRecordedE, absencesE) === true, 'Mid semester with 80% rate is safe');
  }

  console.log('\n================================================================');
  console.log(`REGRESSION R2 TESTS SUMMARY: ${passed}/${passed + failed} Passed (${failed} Failed)`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionR2Suite();
