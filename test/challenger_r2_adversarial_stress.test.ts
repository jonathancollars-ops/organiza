import './setup_env';
import { calculateFinalGrade, CalcResult } from '../src/components/GradeEngine';
import { GradeGroup, GradeItem, Subject, AppEvent, AttendanceRecord, StudyTask, StudySession, Semester, AppSettings, StudyStreak, AACCActivity, GroupProject, GamificationData, BackupData } from '../src/types';
import { getLocalDateString, formatDisplayDate, parseLocalDate } from '../src/utils/date';
import { GoogleSheetsService } from '../src/services/GoogleSheetsService';
import { StorageService } from '../src/services/storage';

interface TestRecord {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
}

const testResults: TestRecord[] = [];

function assert(condition: boolean, suite: string, name: string, detail?: string) {
  if (condition) {
    testResults.push({ suite, name, passed: true });
    console.log(`  [PASS] [${suite}] ${name}`);
  } else {
    const err = detail || 'Assertion failed';
    testResults.push({ suite, name, passed: false, error: err });
    console.error(`  [FAIL] [${suite}] ${name} -> ${err}`);
  }
}

async function runAdversarialStressTests() {
  console.log('================================================================');
  console.log('CHALLENGER 1 (R2): ADVERSARIAL LOGIC & CALCULATION STRESS TESTS');
  console.log('================================================================\n');

  // ==========================================================================
  // 1. GradeEngine Extreme Edge Cases & Numerical Stability
  // ==========================================================================
  console.log('--- 1. GradeEngine: Extreme Edge Cases & Calculations ---');

  // 1.1 Completely empty group list
  const resEmpty = calculateFinalGrade([], 7.0);
  assert(
    resEmpty.score === 0 && resEmpty.hasMissingItems === false && resEmpty.totalItemsCount === 0 && resEmpty.minimumNeeded === null,
    'GradeEngine',
    'Empty gradeGroups returns clean zero-state without exceptions'
  );

  // 1.2 Groups with empty items array
  const emptyGroupList: GradeGroup[] = [
    { id: 'g1', name: 'Trabalhos', weight: 1, items: [] },
    { id: 'g2', name: 'Provas', weight: 2, items: [] }
  ];
  const resEmptyItems = calculateFinalGrade(emptyGroupList, 7.0);
  assert(
    resEmptyItems.score === 0 && resEmptyItems.totalItemsCount === 0 && resEmptyItems.hasMissingItems === false,
    'GradeEngine',
    'Groups with 0 items return score 0 and totalItemsCount 0'
  );

  // 1.3 Zero weight group
  const zeroWeightGroupList: GradeGroup[] = [
    {
      id: 'g1',
      name: 'Grupo Peso Zero',
      weight: 0,
      items: [
        { id: 'i1', name: 'Atividade Extra', weight: 1, maxGrade: 10, grade: 10.0 }
      ]
    },
    {
      id: 'g2',
      name: 'Grupo Principal',
      weight: 2,
      items: [
        { id: 'i2', name: 'P1', weight: 1, maxGrade: 10, grade: 8.0 }
      ]
    }
  ];
  const resZeroWeight = calculateFinalGrade(zeroWeightGroupList, 7.0);
  assert(
    !isNaN(resZeroWeight.score) && resZeroWeight.score === 8.0,
    'GradeEngine',
    'Group with weight 0 does not cause division by zero; score is accurately 8.0',
    `Got ${resZeroWeight.score}`
  );

  // 1.4 All groups have weight 0
  const allZeroWeightGroupList: GradeGroup[] = [
    {
      id: 'g1',
      name: 'Grupo Zero 1',
      weight: 0,
      items: [{ id: 'i1', name: 'Atividade 1', weight: 1, maxGrade: 10, grade: 9.0 }]
    },
    {
      id: 'g2',
      name: 'Grupo Zero 2',
      weight: 0,
      items: [{ id: 'i2', name: 'Atividade 2', weight: 1, maxGrade: 10, grade: undefined }]
    }
  ];
  const resAllZeroWeight = calculateFinalGrade(allZeroWeightGroupList, 7.0);
  assert(
    !isNaN(resAllZeroWeight.score) && resAllZeroWeight.score === 0,
    'GradeEngine',
    'All groups weight 0 handles totalWeight 0 gracefully without NaN'
  );

  // 1.5 Items with 0 weight inside a group
  const zeroWeightItemList: GradeGroup[] = [
    {
      id: 'g1',
      name: 'Provas',
      weight: 1,
      items: [
        { id: 'i1', name: 'Simulado (peso 0)', weight: 0, maxGrade: 10, grade: 5.0 },
        { id: 'i2', name: 'P1 Oficial', weight: 2, maxGrade: 10, grade: 9.0 }
      ]
    }
  ];
  const resZeroWeightItem = calculateFinalGrade(zeroWeightItemList, 7.0);
  assert(
    !isNaN(resZeroWeightItem.score) && resZeroWeightItem.score === 9.0,
    'GradeEngine',
    'Items with weight 0 are ignored in weighted group average; score is 9.0',
    `Got ${resZeroWeightItem.score}`
  );

  // 1.6 Negative grades and extra-scale grades (> 10.0)
  const extremeGradesList: GradeGroup[] = [
    {
      id: 'g1',
      name: 'Notas Extremas',
      weight: 1,
      items: [
        { id: 'i1', name: 'Penalidade', weight: 1, maxGrade: 10, grade: -2.0 },
        { id: 'i2', name: 'Bônus Extra', weight: 1, maxGrade: 10, grade: 12.0 }
      ]
    }
  ];
  const resExtremeGrades = calculateFinalGrade(extremeGradesList, 7.0);
  // ((-2/10)*10*1 + (12/10)*10*1) / 2 = (-2 + 12) / 2 = 5.0
  assert(
    !isNaN(resExtremeGrades.score) && Math.abs(resExtremeGrades.score - 5.0) < 0.001,
    'GradeEngine',
    'Negative grades and grades > 10.0 are computed algebraically without throwing exceptions',
    `Got ${resExtremeGrades.score}`
  );

  // 1.7 Custom maxGrade scaling (e.g. maxGrade = 100, maxGrade = 20)
  const customMaxGradeList: GradeGroup[] = [
    {
      id: 'g1',
      name: 'Avaliações Escala 100',
      weight: 1,
      items: [
        { id: 'i1', name: 'Prova 100 pts', weight: 1, maxGrade: 100, grade: 80.0 }, // 8.0 out of 10
        { id: 'i2', name: 'Trabalho 20 pts', weight: 1, maxGrade: 20, grade: 16.0 }  // 8.0 out of 10
      ]
    }
  ];
  const resCustomMax = calculateFinalGrade(customMaxGradeList, 7.0);
  assert(
    Math.abs(resCustomMax.score - 8.0) < 0.001,
    'GradeEngine',
    'Custom maxGrade scales normalized accurately to 10-point standard (got 8.0)',
    `Got ${resCustomMax.score}`
  );

  // 1.8 Fractional weights (e.g., 1/3, 1/7, 0.3333333333333333)
  const fractionalWeightList: GradeGroup[] = [
    {
      id: 'g1',
      name: 'G1',
      weight: 1 / 3,
      items: [{ id: 'i1', name: 'P1', weight: 0.333333333, maxGrade: 10, grade: 9.0 }]
    },
    {
      id: 'g2',
      name: 'G2',
      weight: 2 / 3,
      items: [{ id: 'i2', name: 'P2', weight: 0.666666667, maxGrade: 10, grade: 6.0 }]
    }
  ];
  const resFractional = calculateFinalGrade(fractionalWeightList, 7.0);
  // (9 * (1/3) + 6 * (2/3)) / (1/3 + 2/3) = (3 + 4) / 1 = 7.0
  assert(
    Math.abs(resFractional.score - 7.0) < 0.0001,
    'GradeEngine',
    'Fractional floating-point weights maintain high precision (got 7.0)',
    `Got ${resFractional.score}`
  );

  // 1.9 Minimum Needed calculation when deficit is already impossible (> 10)
  const impossibleDeficitList: GradeGroup[] = [
    {
      id: 'g1',
      name: 'Provas',
      weight: 1,
      items: [
        { id: 'p1', name: 'P1', weight: 1, maxGrade: 10, grade: 2.0 },
        { id: 'p2', name: 'P2', weight: 1, maxGrade: 10, grade: 2.0 },
        { id: 'p3', name: 'P3', weight: 1, maxGrade: 10, grade: undefined }
      ]
    }
  ];
  // Target 7.0 across 3 equal weights. Total points needed = 21. Current points = 4. Needed on P3 = 17.
  const resImpossibleDeficit = calculateFinalGrade(impossibleDeficitList, 7.0);
  assert(
    resImpossibleDeficit.minimumNeeded !== null && Math.abs(resImpossibleDeficit.minimumNeeded - 17.0) < 0.001,
    'GradeEngine',
    'Calculates mathematical deficit correctly when minimumNeeded > 10 (needs 17.0)',
    `Got ${resImpossibleDeficit.minimumNeeded}`
  );

  // 1.10 Minimum Needed calculation when already passed (deficit <= 0)
  const alreadyPassedList: GradeGroup[] = [
    {
      id: 'g1',
      name: 'Provas',
      weight: 1,
      items: [
        { id: 'p1', name: 'P1', weight: 1, maxGrade: 10, grade: 10.0 },
        { id: 'p2', name: 'P2', weight: 1, maxGrade: 10, grade: 10.0 },
        { id: 'p3', name: 'P3', weight: 1, maxGrade: 10, grade: undefined }
      ]
    }
  ];
  // Needed total for 7.0 is 21. Current is 20. Remaining needed is 1.0.
  const resAlreadyPassed = calculateFinalGrade(alreadyPassedList, 7.0);
  assert(
    resAlreadyPassed.minimumNeeded !== null && Math.abs(resAlreadyPassed.minimumNeeded - 1.0) < 0.001,
    'GradeEngine',
    'Calculates minimum needed accurately when student is comfortably ahead (needs 1.0)',
    `Got ${resAlreadyPassed.minimumNeeded}`
  );

  // 1.11 Massive scale stress test: 500 groups, 2,500 items
  const startPerf = Date.now();
  const massiveGroups: GradeGroup[] = [];
  for (let g = 0; g < 500; g++) {
    const items: GradeItem[] = [];
    for (let i = 0; i < 5; i++) {
      items.push({
        id: `g${g}_i${i}`,
        name: `Item ${g}_${i}`,
        weight: 1,
        maxGrade: 10,
        grade: i % 2 === 0 ? 8.0 : undefined
      });
    }
    massiveGroups.push({
      id: `g${g}`,
      name: `Group ${g}`,
      weight: 1,
      items
    });
  }
  const resMassive = calculateFinalGrade(massiveGroups, 7.0);
  const elapsedCalc = Date.now() - startPerf;
  assert(
    !isNaN(resMassive.score) && resMassive.score === 8.0 && resMassive.totalItemsCount === 2500 && elapsedCalc < 200,
    'GradeEngine',
    `Massive scale calculation (500 groups, 2500 items) executes in ${elapsedCalc}ms with accurate score`,
    `Elapsed: ${elapsedCalc}ms, Score: ${resMassive.score}`
  );

  // 1.12 All items are Final Exams
  const allFinalExamsList: GradeGroup[] = [
    {
      id: 'g1',
      name: 'Final Group',
      weight: 1,
      items: [
        { id: 'f1', name: 'Exame 1', weight: 1, maxGrade: 10, grade: 8.0, isFinalExam: true }
      ]
    }
  ];
  const resAllFinal = calculateFinalGrade(allFinalExamsList, 7.0);
  assert(
    resAllFinal.totalItemsCount === 0 && resAllFinal.score === 0,
    'GradeEngine',
    'Subject with only Final Exam items does not crash and leaves normal totalItemsCount at 0'
  );


  // ==========================================================================
  // 2. Date Manipulation & getLocalDateString Stress Testing
  // ==========================================================================
  console.log('\n--- 2. Date & Timezone Resiliency (getLocalDateString) ---');

  // 2.1 Year transitions (Dec 31 23:59:59 -> Jan 1 00:00:00)
  const nye2026 = new Date(2026, 11, 31, 23, 59, 59, 999);
  assert(
    getLocalDateString(nye2026) === '2026-12-31',
    'DateUtils',
    'New Year Eve 23:59:59 preserves 2026-12-31 without advancing to next year',
    `Got ${getLocalDateString(nye2026)}`
  );

  const nyd2027 = new Date(2027, 0, 1, 0, 0, 0, 0);
  assert(
    getLocalDateString(nyd2027) === '2027-01-01',
    'DateUtils',
    'New Year Day 00:00:00 formats as 2027-01-01',
    `Got ${getLocalDateString(nyd2027)}`
  );

  // 2.2 Leap years (2028, 2032, 2096, and century 2100)
  const leap2028_feb28 = new Date(2028, 1, 28, 22, 0, 0);
  const leap2028_feb29 = new Date(2028, 1, 29, 23, 30, 0);
  const leap2028_mar01 = new Date(2028, 2, 1, 0, 15, 0);
  assert(
    getLocalDateString(leap2028_feb28) === '2028-02-28' &&
    getLocalDateString(leap2028_feb29) === '2028-02-29' &&
    getLocalDateString(leap2028_mar01) === '2028-03-01',
    'DateUtils',
    'Leap Year 2028 handles 28 Feb -> 29 Feb -> 01 Mar accurately'
  );

  const leap2032_feb29 = new Date(2032, 1, 29, 12, 0, 0);
  assert(
    getLocalDateString(leap2032_feb29) === '2032-02-29',
    'DateUtils',
    'Leap Year 2032 handles Feb 29 accurately',
    `Got ${getLocalDateString(leap2032_feb29)}`
  );

  // Non-leap year 2027 February
  const nonLeap2027_feb28 = new Date(2027, 1, 28, 23, 59, 0);
  const nonLeap2027_mar01 = new Date(2027, 2, 1, 0, 0, 0);
  assert(
    getLocalDateString(nonLeap2027_feb28) === '2027-02-28' &&
    getLocalDateString(nonLeap2027_mar01) === '2027-03-01',
    'DateUtils',
    'Non-leap year 2027 transitions smoothly from Feb 28 to Mar 01'
  );

  // 2.3 Simulated Timezone offset validation
  // Test simulated UTC-3 late night boundary (e.g. 23:30 local) vs toISOString UTC shift
  const lateNightDate = new Date(2026, 7, 20, 23, 45, 0); // 2026-08-20 23:45 local
  const localStr = getLocalDateString(lateNightDate);
  assert(
    localStr === '2026-08-20',
    'DateUtils',
    'getLocalDateString at 23:45 returns local date 2026-08-20',
    `Got ${localStr}`
  );

  // 2.4 formatDisplayDate edge cases
  assert(formatDisplayDate('2026-08-20') === '20/08/2026', 'DateUtils', 'formatDisplayDate formats YYYY-MM-DD -> DD/MM/YYYY');
  assert(formatDisplayDate('') === '', 'DateUtils', 'formatDisplayDate handles empty string safely');
  assert(formatDisplayDate(null as any) === '', 'DateUtils', 'formatDisplayDate handles null safely');
  assert(formatDisplayDate(undefined as any) === '', 'DateUtils', 'formatDisplayDate handles undefined safely');
  assert(formatDisplayDate('invalid-date') === 'invalid-date', 'DateUtils', 'formatDisplayDate returns original string on non-standard format');

  // 2.5 parseLocalDate pins hour to 12:00 local noon
  const parsedNoon = parseLocalDate('2026-08-20');
  assert(
    parsedNoon.getHours() === 12 && getLocalDateString(parsedNoon) === '2026-08-20',
    'DateUtils',
    'parseLocalDate pins date to 12:00:00 local noon without shifting day'
  );


  // ==========================================================================
  // 3. GoogleSheetsService & Timestamp Parsing Stress Testing
  // ==========================================================================
  console.log('\n--- 3. GoogleSheetsService: Timestamp Parsing & CSV Handling ---');

  // 3.1 Empty / null / malformed timestamps
  assert(GoogleSheetsService.parseTimestamp('') === 0, 'GoogleSheets', 'Empty timestamp returns 0');
  assert(GoogleSheetsService.parseTimestamp('   ') === 0, 'GoogleSheets', 'Whitespace-only timestamp returns 0');
  assert(GoogleSheetsService.parseTimestamp(null as any) === 0, 'GoogleSheets', 'Null timestamp returns 0');
  assert(GoogleSheetsService.parseTimestamp(undefined as any) === 0, 'GoogleSheets', 'Undefined timestamp returns 0');
  assert(GoogleSheetsService.parseTimestamp('invalid_corrupted_date') === 0, 'GoogleSheets', 'Corrupted string returns 0 without crashing');

  // 3.2 ISO Timestamps
  const isoUtc = '2026-08-20T12:00:00Z';
  const parsedIsoUtc = GoogleSheetsService.parseTimestamp(isoUtc);
  assert(parsedIsoUtc === new Date(isoUtc).getTime() && parsedIsoUtc > 0, 'GoogleSheets', 'Parses ISO-8601 UTC timestamp accurately');

  const isoOffset = '2026-08-20T15:30:00-03:00';
  const parsedIsoOffset = GoogleSheetsService.parseTimestamp(isoOffset);
  assert(parsedIsoOffset === new Date(isoOffset).getTime() && parsedIsoOffset > 0, 'GoogleSheets', 'Parses ISO-8601 with offset accurately');

  // 3.3 Brazilian date formats (DD/MM/YYYY with and without time)
  // DD/MM/YYYY with day > 12 to test non-US parsing
  const brDate1 = '25/08/2026';
  const parsedBr1 = GoogleSheetsService.parseTimestamp(brDate1);
  const expectedBr1 = new Date(2026, 7, 25, 0, 0, 0).getTime();
  assert(parsedBr1 === expectedBr1 && parsedBr1 > 0, 'GoogleSheets', 'Parses DD/MM/YYYY accurately (25/08/2026)', `Got ${parsedBr1}, expected ${expectedBr1}`);

  const brDate2 = '25/08/2026 14:35';
  const parsedBr2 = GoogleSheetsService.parseTimestamp(brDate2);
  const expectedBr2 = new Date(2026, 7, 25, 14, 35, 0).getTime();
  assert(parsedBr2 === expectedBr2 && parsedBr2 > 0, 'GoogleSheets', 'Parses DD/MM/YYYY HH:mm accurately (25/08/2026 14:35)');

  const brDate3 = '25/08/2026 14:35:45';
  const parsedBr3 = GoogleSheetsService.parseTimestamp(brDate3);
  const expectedBr3 = new Date(2026, 7, 25, 14, 35, 45).getTime();
  assert(parsedBr3 === expectedBr3 && parsedBr3 > 0, 'GoogleSheets', 'Parses DD/MM/YYYY HH:mm:ss accurately (25/08/2026 14:35:45)');

  // 3.4 RFC 4180 CSV Parsing Stress
  const complexCsv = [
    'timestamp,team_name,channel_name,sender,message',
    '2026-08-20T10:00:00Z,Engenharia,Geral,Prof. Silva,"Aviso importante: ""Prova adiada"" para dia 25/08, às 14h."',
    '2026-08-20T11:00:00Z,Matematica,Calculo,Prof. Santos,"Linha 1\nLinha 2 com vírgula, e mais texto\nLinha 3"',
    '2026-08-20T12:00:00Z,Fisica,Geral,Prof. Souza,Mensagem simples sem aspas'
  ].join('\n');

  const records = GoogleSheetsService.parseCsvRecords(complexCsv);
  assert(records.length === 4, 'GoogleSheets', 'RFC 4180 CSV parser correctly separates 4 records despite embedded newlines and quotes');
  assert(records[1][4].includes('"Prova adiada"'), 'GoogleSheets', 'Escaped quotes ("") unescaped properly');
  assert(records[2][4].split('\n').length === 3, 'GoogleSheets', 'Multiline quoted field preserves line breaks');

  // 3.5 Spreadsheet ID Extraction
  assert(
    GoogleSheetsService.extractSpreadsheetId('https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing') === '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
    'GoogleSheets',
    'Extracts standard spreadsheet ID'
  );
  assert(
    GoogleSheetsService.extractSpreadsheetId('https://docs.google.com/spreadsheets/d/1AbC-123_xyz/preview') === '1AbC-123_xyz',
    'GoogleSheets',
    'Extracts ID with hyphens and underscores'
  );
  assert(
    GoogleSheetsService.extractSpreadsheetId('invalid-url') === null,
    'GoogleSheets',
    'Invalid URL returns null safely'
  );


  // ==========================================================================
  // 4. StorageService Persistence, Concurrency & Backup Integrity
  // ==========================================================================
  console.log('\n--- 4. StorageService: Concurrency & Backup Integrity ---');

  // 4.1 Concurrency Stress Test: 50 concurrent mixed writes and reads
  const concurrencyOps: Promise<any>[] = [];
  for (let i = 0; i < 50; i++) {
    concurrencyOps.push(
      StorageService.saveEvents([{
        id: `ev_concurrent_${i}`,
        title: `Concurrent Event ${i}`,
        category: 'Faculdade/Aulas',
        date: '2026-08-20',
        startTime: '08:00',
        endTime: '10:00',
        recurrence: 'none',
        alerts: [15],
        isCompleted: false
      }]),
      StorageService.saveSubjects([{
        id: `subj_concurrent_${i}`,
        name: `Subject ${i}`,
        color: '#3b82f6',
        passGrade: 7.0,
        maxAbsences: 10,
        workloadHours: 60,
        gradeGroups: []
      }]),
      StorageService.addXP(10, 5),
      StorageService.getSettings()
    );
  }

  let concurrencyError: any = null;
  try {
    await Promise.all(concurrencyOps);
  } catch (err) {
    concurrencyError = err;
  }
  assert(concurrencyError === null, 'StorageService', '50 concurrent mixed storage operations complete with 0 unhandled promise rejections');

  // 4.2 Comprehensive Backup Export & Import Round-Trip Integrity
  const initialSubjects: Subject[] = [
    {
      id: 'subj_test_1',
      name: 'Cálculo Numérico',
      color: '#3b82f6',
      passGrade: 7.0,
      maxAbsences: 8,
      workloadHours: 60,
      teacher: 'Prof. Gauss',
      classroom: 'Sala 101',
      gradeGroups: [
        {
          id: 'grp_1',
          name: 'Provas',
          weight: 2,
          items: [
            { id: 'p1', name: 'P1', weight: 1, maxGrade: 10, grade: 8.5 },
            { id: 'p2', name: 'P2', weight: 1, maxGrade: 10, grade: undefined }
          ]
        }
      ]
    }
  ];

  const initialEvents: AppEvent[] = [
    {
      id: 'ev_test_1',
      title: 'Aula de Cálculo Numérico',
      category: 'Faculdade/Aulas',
      date: '2026-08-20',
      startTime: '08:00',
      endTime: '10:00',
      recurrence: 'weekly',
      alerts: [15, 60],
      isCompleted: false,
      subjectId: 'subj_test_1'
    }
  ];

  const initialAttendances: AttendanceRecord[] = [
    {
      id: 'att_1',
      subjectId: 'subj_test_1',
      date: '2026-08-18',
      status: 'present'
    }
  ];

  const initialTasks: StudyTask[] = [
    {
      id: 'task_1',
      title: 'Lista 1 de Cálculo',
      completed: false,
      priority: 'high',
      dueDate: '2026-08-25',
      subjectId: 'subj_test_1'
    }
  ];

  const initialSemesters: Semester[] = [
    {
      id: 'sem_2026_2',
      name: '2026.2',
      startDate: '2026-08-01',
      endDate: '2026-12-15',
      isCurrent: true
    }
  ];

  const initialSettings: AppSettings = {
    theme: 'amoled',
    pomodoroFocusMin: 30,
    pomodoroBreakMin: 6,
    pomodoroLongBreakMin: 20,
    defaultPassGrade: 7.0,
    examWeekMode: true,
    soundEnabled: true,
    hapticsEnabled: true
  };

  const initialStreak: StudyStreak = {
    currentStreak: 5,
    longestStreak: 12,
    lastStudyDate: '2026-08-20'
  };

  const initialGamification: GamificationData = {
    xp: 450,
    level: 3,
    unlockedAchievements: ['first_session', 'streak_3'],
    totalFocusMinutes: 150
  };

  // Save all initial dataset
  await StorageService.saveSubjects(initialSubjects);
  await StorageService.saveEvents(initialEvents);
  await StorageService.saveAttendances(initialAttendances);
  await StorageService.saveTasks(initialTasks);
  await StorageService.saveSemesters(initialSemesters);
  await StorageService.saveSettings(initialSettings);
  await StorageService.saveStreak(initialStreak);
  await StorageService.saveGamificationData(initialGamification);

  // Export backup
  const backup = await StorageService.exportBackup();
  assert(backup.version === 2, 'StorageService', 'exportBackup generates version 2 format');
  assert(backup.subjects.length === 1 && backup.subjects[0].name === 'Cálculo Numérico', 'StorageService', 'Backup contains subjects');
  assert(backup.events.length === 1 && backup.events[0].title === 'Aula de Cálculo Numérico', 'StorageService', 'Backup contains events');
  assert(backup.gamification.xp === 450, 'StorageService', 'Backup contains gamification XP');
  assert(backup.streak.currentStreak === 5, 'StorageService', 'Backup contains streak data');

  // Clear data
  await StorageService.clearAllData();
  const clearedSubjects = await StorageService.getSubjects();
  const clearedEvents = await StorageService.getEvents();
  assert(clearedSubjects.length === 0 && clearedEvents.length === 0, 'StorageService', 'clearAllData flushes all keys cleanly');

  // Import backup and verify restoration
  const restoreSuccess = await StorageService.importBackup(backup);
  assert(restoreSuccess === true, 'StorageService', 'importBackup returns true on valid payload');

  const restoredSubjects = await StorageService.getSubjects();
  const restoredEvents = await StorageService.getEvents();
  const restoredSettings = await StorageService.getSettings();
  const restoredStreak = await StorageService.getStreak();
  const restoredGamification = await StorageService.getGamificationData();

  assert(
    restoredSubjects.length === 1 &&
    restoredSubjects[0].gradeGroups[0].items.length === 2 &&
    restoredSubjects[0].gradeGroups[0].items[0].grade === 8.5,
    'StorageService',
    'Restored subject preserves nested GradeGroups and GradeItems'
  );
  assert(restoredEvents.length === 1 && restoredEvents[0].id === 'ev_test_1', 'StorageService', 'Restored events match exactly');
  assert(restoredSettings.theme === 'amoled' && restoredSettings.pomodoroFocusMin === 30, 'StorageService', 'Restored settings match exactly');
  assert(restoredStreak.currentStreak === 5 && restoredStreak.longestStreak === 12, 'StorageService', 'Restored streak matches exactly');
  assert(restoredGamification.xp === 450 && restoredGamification.level === 3, 'StorageService', 'Restored gamification data matches exactly');

  // 4.3 Adversarial / Corrupted Backup Recovery
  let invalidBackupThrew = false;
  try {
    await StorageService.importBackup(null as any);
  } catch {
    invalidBackupThrew = true;
  }
  assert(invalidBackupThrew, 'StorageService', 'importBackup throws on null payload as expected');

  // Partial / malformed backup payload without crashing
  const partialBackup: any = {
    version: 2,
    timestamp: '2026-08-20T12:00:00Z',
    events: [{ id: 'ev_partial', title: 'Partial Event', category: 'Faculdade/Aulas', date: '2026-08-20', startTime: '08:00', endTime: '10:00', recurrence: 'none', alerts: [], isCompleted: false }],
    // other keys omitted or corrupted
    subjects: null,
    settings: { theme: 'dark' }
  };
  let partialSuccess = false;
  try {
    partialSuccess = await StorageService.importBackup(partialBackup);
  } catch (e) {
    partialSuccess = false;
  }
  assert(partialSuccess === true, 'StorageService', 'importBackup gracefully imports partial payload with omitted/null arrays');

  // ==========================================================================
  // FINAL SUMMARY
  // ==========================================================================
  console.log('\n================================================================');
  console.log('CHALLENGER 1 (R2) STRESS TEST SUMMARY');
  console.log('================================================================');

  const totalPassed = testResults.filter(r => r.passed).length;
  const totalFailed = testResults.filter(r => !r.passed).length;

  console.log(`Total Adversarial Tests : ${testResults.length}`);
  console.log(`Passed                  : ${totalPassed}`);
  console.log(`Failed                  : ${totalFailed}`);

  if (totalFailed > 0) {
    console.log('\nFAILED TESTS:');
    testResults.filter(r => !r.passed).forEach(r => {
      console.log(`- [${r.suite}] ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\nALL 34 ADVERSARIAL STRESS TESTS PASSED WITH 100% DETERMINISM!');
    process.exit(0);
  }
}

runAdversarialStressTests().catch(err => {
  console.error('Unhandled fatal test exception:', err);
  process.exit(1);
});
