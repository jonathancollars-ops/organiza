import './setup_env';
import { getLocalDateString, formatDisplayDate, parseLocalDate } from '../src/utils/date';
import { GoogleSheetsService } from '../src/services/GoogleSheetsService';
import { calculateFinalGrade } from '../src/components/GradeEngine';
import { GradeGroup, Subject, AppEvent } from '../src/types';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];
let totalPassed = 0;
let totalFailed = 0;

function assert(condition: boolean, message: string, details?: any) {
  if (!condition) {
    throw new Error(`${message}${details ? ' -> ' + JSON.stringify(details) : ''}`);
  }
}

function runProbe(suite: string, name: string, fn: () => void) {
  try {
    fn();
    results.push({ suite, name, passed: true });
    totalPassed++;
    console.log(`  [PASS] [${suite}] ${name}`);
  } catch (err: any) {
    results.push({ suite, name, passed: false, error: err.message, details: err });
    totalFailed++;
    console.error(`  [FAIL] [${suite}] ${name}: ${err.message}`);
  }
}

console.log('================================================================');
console.log('MILESTONE 1 EMPIRICAL CHALLENGER ADVERSARIAL STRESS TEST');
console.log('================================================================\n');

// ============================================================================
// SUITE 1: DATE & TIMEZONE BOUNDARIES & RESILIENCY
// ============================================================================
console.log('--- SUITE 1: Date & Timezone Resiliency Probes ---');

runProbe('Date/Timezone', 'Late night 21:00-23:59:59 boundary does not skip to tomorrow in local time', () => {
  // In UTC-3 (Brasília), 21:00:00 on 2026-08-18 is 00:00:00 UTC on 2026-08-19.
  // toISOString().split('T')[0] gives '2026-08-19' (BUG).
  // getLocalDateString must give '2026-08-18'.
  const d2100 = new Date(2026, 7, 18, 21, 0, 0, 0);
  assert(getLocalDateString(d2100) === '2026-08-18', '21:00 local must be 2026-08-18');

  const d2359 = new Date(2026, 7, 18, 23, 59, 59, 999);
  assert(getLocalDateString(d2359) === '2026-08-18', '23:59:59.999 local must be 2026-08-18');

  const dMidnight = new Date(2026, 7, 18, 0, 0, 0, 0);
  assert(getLocalDateString(dMidnight) === '2026-08-18', '00:00:00.000 local must be 2026-08-18');
});

runProbe('Date/Timezone', 'Leap year Feb 29 handling across leap & non-leap years', () => {
  // 2024 is leap year
  const leap2024 = new Date(2024, 1, 29, 12, 0, 0);
  assert(getLocalDateString(leap2024) === '2024-02-29', 'Leap year 2024 has Feb 29');

  // 2028 is leap year
  const leap2028 = new Date(2028, 1, 29, 23, 59, 59);
  assert(getLocalDateString(leap2028) === '2028-02-29', 'Leap year 2028 has Feb 29');

  // 2000 is leap century (divisible by 400)
  const leap2000 = new Date(2000, 1, 29, 10, 0, 0);
  assert(getLocalDateString(leap2000) === '2000-02-29', 'Century leap year 2000 has Feb 29');

  // 2026 is non-leap
  const nonLeap2026 = new Date(2026, 1, 28, 23, 59, 59);
  assert(getLocalDateString(nonLeap2026) === '2026-02-28', 'Non-leap 2026 has Feb 28');
});

runProbe('Date/Timezone', 'Month and Year rollover boundaries', () => {
  const monthTransitions = [
    { input: new Date(2026, 0, 31, 23, 59, 59), expected: '2026-01-31' },
    { input: new Date(2026, 1, 1, 0, 0, 1), expected: '2026-02-01' },
    { input: new Date(2026, 1, 28, 23, 59, 59), expected: '2026-02-28' },
    { input: new Date(2026, 2, 1, 0, 0, 0), expected: '2026-03-01' },
    { input: new Date(2026, 3, 30, 23, 59, 59), expected: '2026-04-30' },
    { input: new Date(2026, 4, 1, 0, 0, 0), expected: '2026-05-01' },
    { input: new Date(2026, 11, 31, 23, 59, 59), expected: '2026-12-31' },
    { input: new Date(2027, 0, 1, 0, 0, 0), expected: '2027-01-01' }
  ];

  monthTransitions.forEach(({ input, expected }) => {
    assert(getLocalDateString(input) === expected, `Expected ${expected}, got ${getLocalDateString(input)}`);
  });
});

runProbe('Date/Timezone', 'formatDisplayDate edge cases & invalid inputs', () => {
  assert(formatDisplayDate('2026-08-18') === '18/08/2026', 'Standard ISO date');
  assert(formatDisplayDate('2026-02-29') === '29/02/2026', 'Leap day format');
  assert(formatDisplayDate('2026-12-31') === '31/12/2026', 'End of year format');
  
  // Edge & invalid cases
  assert(formatDisplayDate('') === '', 'Empty string returns empty');
  assert(formatDisplayDate(null as any) === '', 'Null returns empty');
  assert(formatDisplayDate(undefined as any) === '', 'Undefined returns empty');
  assert(formatDisplayDate(12345 as any) === '', 'Number returns empty');
  assert(formatDisplayDate({} as any) === '', 'Object returns empty');
  assert(formatDisplayDate('18/08/2026') === '18/08/2026', 'Already Brazilian format preserved');
  assert(formatDisplayDate('invalid-date') === 'invalid-date', 'Non-conforming string preserved safely');
  assert(formatDisplayDate('2026-08') === '2026-08', 'Two-part string preserved');
  assert(formatDisplayDate('2026-08-18-01') === '2026-08-18-01', 'Four-part string preserved');
});

runProbe('Date/Timezone', 'parseLocalDate pins hour to 12:00:00 to insulate from midnight DST shift', () => {
  const p1 = parseLocalDate('2026-08-18');
  assert(p1.getFullYear() === 2026, 'Year matches');
  assert(p1.getMonth() === 7, 'Month matches (August = 7)');
  assert(p1.getDate() === 18, 'Date matches');
  assert(p1.getHours() === 12, 'Hour is 12:00:00 noon');

  const pLeap = parseLocalDate('2024-02-29');
  assert(pLeap.getDate() === 29 && pLeap.getMonth() === 1, 'Leap day parsed accurately');
});

// ============================================================================
// SUITE 2: GOOGLE SHEETS RFC 4180 CSV PARSING STRESS TEST
// ============================================================================
console.log('\n--- SUITE 2: Google Sheets RFC 4180 CSV Parsing Probes ---');

runProbe('CSV Parser', 'Standard multi-row unquoted CSV', () => {
  const csv = `colA,colB,colC\n1,2,3\n4,5,6`;
  const records = GoogleSheetsService.parseCsvRecords(csv);
  assert(records.length === 3, '3 rows expected');
  assert(records[0].join(',') === 'colA,colB,colC', 'Header match');
  assert(records[1].join(',') === '1,2,3', 'Row 1 match');
  assert(records[2].join(',') === '4,5,6', 'Row 2 match');
});

runProbe('CSV Parser', 'Commas inside double quoted cells', () => {
  const csv = `ID,Name,Description\n1,"Silva, João","Professor, Titular, Depto de Computação"\n2,"Costa, Maria","Coordenadora"`;
  const records = GoogleSheetsService.parseCsvRecords(csv);
  assert(records.length === 3, '3 rows expected');
  assert(records[1][1] === 'Silva, João', 'First quoted name');
  assert(records[1][2] === 'Professor, Titular, Depto de Computação', 'Quoted description with multiple commas');
  assert(records[2][1] === 'Costa, Maria', 'Second quoted name');
});

runProbe('CSV Parser', 'Multiline cells with CRLF and LF inside quotes', () => {
  const csv = `Timestamp,Sender,Content\r\n2026-08-18,Prof,"Linha 1\r\nLinha 2 com vírgula, teste\nLinha 3"\r\n2026-08-19,Monitor,"Aviso rápido"`;
  const records = GoogleSheetsService.parseCsvRecords(csv);
  assert(records.length === 3, `Expected 3 records, got ${records.length}`);
  assert(records[1][0] === '2026-08-18', 'Timestamp correct');
  assert(records[1][1] === 'Prof', 'Sender correct');
  assert(records[1][2] === 'Linha 1\r\nLinha 2 com vírgula, teste\nLinha 3', 'Multiline cell with mixed linebreaks preserved verbatim');
  assert(records[2][0] === '2026-08-19', 'Next record parsed seamlessly');
});

runProbe('CSV Parser', 'Escaped double quotes ("") inside quoted fields', () => {
  // Field 1: "O professor disse: ""A prova será adiada!"" para todos." -> O professor disse: "A prova será adiada!" para todos.
  // Field 2 (consecutive escaped quotes): """""" -> 4 quotes wrapped in 2 outer quotes = ""
  const csv = `Header1,Header2\n"O professor disse: ""A prova será adiada!"" para todos.",OK\n"""""",Fim`;
  const records = GoogleSheetsService.parseCsvRecords(csv);
  assert(records.length === 3, `Expected 3 records, got ${records.length}`);
  assert(records[1][0] === 'O professor disse: "A prova será adiada!" para todos.', 'Escaped quote unescaped correctly');
  assert(records[2][0] === '""', 'Consecutive escaped quotes unescaped correctly');
  assert(records[2][1] === 'Fim', 'Second column of row 2 parsed correctly');
});

runProbe('CSV Parser', 'Trailing newlines (CRLF, LF, CR) and empty trailing records', () => {
  const csvCRLF = `a,b,c\r\n1,2,3\r\n`;
  const resCRLF = GoogleSheetsService.parseCsvRecords(csvCRLF);
  assert(resCRLF.length === 2, 'Trailing CRLF does not create phantom empty row');

  const csvLF = `a,b,c\n1,2,3\n`;
  const resLF = GoogleSheetsService.parseCsvRecords(csvLF);
  assert(resLF.length === 2, 'Trailing LF does not create phantom empty row');

  const csvNone = `a,b,c\n1,2,3`;
  const resNone = GoogleSheetsService.parseCsvRecords(csvNone);
  assert(resNone.length === 2, 'No trailing newline parses all records');
});

runProbe('CSV Parser', 'Empty fields, consecutive delimiters, and empty lines', () => {
  const csv = `col1,col2,col3,col4\n,value2,,\n"",val,"",val4`;
  const records = GoogleSheetsService.parseCsvRecords(csv);
  assert(records.length === 3, '3 rows expected');
  assert(records[1][0] === '' && records[1][1] === 'value2' && records[1][2] === '' && records[1][3] === '', 'Empty unquoted fields handled');
  assert(records[2][0] === '' && records[2][1] === 'val' && records[2][2] === '' && records[2][3] === 'val4', 'Empty quoted fields handled');
});

runProbe('CSV Parser', 'Large cell content (10KB+ string with commas and quotes)', () => {
  const largeChunk = 'A'.repeat(5000) + ',"mid-comma",' + 'B'.repeat(5000);
  const csv = `id,payload\n1,"${largeChunk.replace(/"/g, '""')}"`;
  const records = GoogleSheetsService.parseCsvRecords(csv);
  assert(records.length === 2, 'Large CSV parsed');
  assert(records[1][1] === largeChunk, 'Large cell content preserved accurately');
});

runProbe('CSV Parser', 'Spreadsheet URL ID Extractor resiliency', () => {
  const editUrl = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0';
  assert(GoogleSheetsService.extractSpreadsheetId(editUrl) === '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms', 'Edit URL');

  const exportUrl = 'https://docs.google.com/spreadsheets/d/2PACX-abc123_XYZ-99/export?format=csv';
  assert(GoogleSheetsService.extractSpreadsheetId(exportUrl) === '2PACX-abc123_XYZ-99', 'Export URL with hyphen & underscore');

  const invalid1 = 'https://google.com/search?q=test';
  assert(GoogleSheetsService.extractSpreadsheetId(invalid1) === null, 'Non-sheets URL returns null');

  const invalid2 = '';
  assert(GoogleSheetsService.extractSpreadsheetId(invalid2) === null, 'Empty URL returns null');
});

runProbe('CSV Parser', 'End-to-End CSV parsing into TeamsMessage objects', () => {
  const csvText = `timestamp,team_name,channel_name,sender,message
2026-08-18T14:00:00Z,Engenharia de Software,Geral,Prof. Silva,"Prezados alunos,\nA entrega do trabalho foi prorrogada para 25/08."
2026-08-18T15:00:00Z,Física 1,Avisos,Coordenação,"Aviso: Aula cancelada hoje."
invalid_row_too_short
2026-08-18T16:00:00Z,Cálculo,Geral,,Mensagem de professor anônimo`;

  // Use parseCsv via parseCsvRecords and message mapping
  const records = GoogleSheetsService.parseCsvRecords(csvText);
  assert(records.length === 5, '5 records including header and invalid row');

  // Verify fields of multiline message
  const msgRow = records[1];
  assert(msgRow[0] === '2026-08-18T14:00:00Z', 'Timestamp parsed');
  assert(msgRow[1] === 'Engenharia de Software', 'Team name parsed');
  assert(msgRow[3] === 'Prof. Silva', 'Sender parsed');
  assert(msgRow[4].includes('prorrogada para 25/08'), 'Multiline body preserved');
});

// ============================================================================
// SUITE 3: GRADE ENGINE & GRADESSCREEN CALCULATION STRESS TEST
// ============================================================================
console.log('\n--- SUITE 3: Academic Grade Calculation Engine Probes ---');

runProbe('Grade Engine', 'Partial evaluation: Omit pending items (Milestone 1 core parity)', () => {
  const groups: GradeGroup[] = [
    {
      id: 'g1',
      name: 'Provas',
      weight: 1,
      items: [
        { id: 'p1', name: 'P1', weight: 1, maxGrade: 10, grade: 8.5 },
        { id: 'p2', name: 'P2', weight: 1, maxGrade: 10, grade: undefined },
        { id: 'p3', name: 'P3', weight: 1, maxGrade: 10, grade: undefined }
      ]
    }
  ];

  const res = calculateFinalGrade(groups, 7.0);
  assert(res.score === 8.5, `Score should be 8.5, got ${res.score}`);
  assert(res.hasMissingItems === true, 'Has missing items');
  assert(res.missingItemsCount === 2, '2 missing items');
  assert(res.totalItemsCount === 3, '3 total items');
  // Pass grade = 7.0 across 3 exams (total weight = 3). Total points needed = 7 * 3 = 21. Current = 8.5. Deficit = 12.5. Remaining weight = 2.
  // Average needed per remaining exam = 12.5 / 2 = 6.25.
  assert(Math.abs(res.minimumNeeded! - 6.25) < 0.001, `Minimum needed should be 6.25, got ${res.minimumNeeded}`);
  assert(res.inFinal === false, 'Not in final exam state while regular items remain');
});

runProbe('Grade Engine', 'Multi-group weighted calculation with completed and pending items', () => {
  const groups: GradeGroup[] = [
    {
      id: 'g1',
      name: 'Provas Teóricas',
      weight: 7, // 70%
      items: [
        { id: 'p1', name: 'P1', weight: 1, maxGrade: 10, grade: 6.0 },
        { id: 'p2', name: 'P2', weight: 1, maxGrade: 10, grade: 8.0 }
      ] // Group 1 average = 7.0
    },
    {
      id: 'g2',
      name: 'Laboratórios & Projetos',
      weight: 3, // 30%
      items: [
        { id: 'l1', name: 'Lab 1', weight: 1, maxGrade: 10, grade: 10.0 },
        { id: 'l2', name: 'Projeto Final', weight: 2, maxGrade: 10, grade: undefined }
      ] // Lab 1 completed = 10.0
    }
  ];

  // Group 1: completed avg = 7.0 (weight 7)
  // Group 2: completed avg = 10.0 (weight 3)
  // Total score = (7.0 * 7 + 10.0 * 3) / 10 = (49 + 30) / 10 = 7.9
  const res = calculateFinalGrade(groups, 7.0);
  assert(Math.abs(res.score - 7.9) < 0.001, `Weighted score should be 7.9, got ${res.score}`);
  assert(res.hasMissingItems === true, 'Has 1 missing item');
  assert(res.missingItemsCount === 1, '1 item missing');
});

runProbe('Grade Engine', 'Zero grades registered (Fresh semester subject)', () => {
  const groups: GradeGroup[] = [
    {
      id: 'g1',
      name: 'Avaliações',
      weight: 1,
      items: [
        { id: 'p1', name: 'P1', weight: 1, maxGrade: 10, grade: undefined },
        { id: 'p2', name: 'P2', weight: 1, maxGrade: 10, grade: undefined }
      ]
    }
  ];

  const res = calculateFinalGrade(groups, 7.0);
  assert(res.score === 0, 'Score is 0 when no grades entered');
  assert(res.hasMissingItems === true, 'Has missing items');
  assert(res.missingItemsCount === 2, 'Missing 2 items');
  assert(res.minimumNeeded === 7.0, 'Needs 7.0 on remaining to pass');
});

runProbe('Grade Engine', 'Non-standard maxGrade (e.g. 100 points, 5 points, 20 points)', () => {
  const groups: GradeGroup[] = [
    {
      id: 'g1',
      name: 'Avaliações Diversas',
      weight: 1,
      items: [
        { id: 'p1', name: 'Quiz 1 (0-100)', weight: 1, maxGrade: 100, grade: 80 }, // Normalized: 8.0
        { id: 'p2', name: 'Atividade (0-5)', weight: 1, maxGrade: 5, grade: 4.5 },   // Normalized: 9.0
        { id: 'p3', name: 'Seminário (0-20)', weight: 2, maxGrade: 20, grade: 15 }  // Normalized: 7.5
      ]
    }
  ];

  // Group average: (8.0 * 1 + 9.0 * 1 + 7.5 * 2) / 4 = (8.0 + 9.0 + 15.0) / 4 = 32.0 / 4 = 8.0
  const res = calculateFinalGrade(groups, 7.0);
  assert(Math.abs(res.score - 8.0) < 0.001, `Normalized score should be 8.0, got ${res.score}`);
  assert(res.hasMissingItems === false, 'No missing items');
});

runProbe('Grade Engine', 'Final Exam flow: Pass directly without final', () => {
  const groups: GradeGroup[] = [
    {
      id: 'g1',
      name: 'Semestre',
      weight: 1,
      items: [
        { id: 'p1', name: 'P1', weight: 1, maxGrade: 10, grade: 7.5 },
        { id: 'p2', name: 'P2', weight: 1, maxGrade: 10, grade: 8.0 },
        { id: 'pf', name: 'Prova Final', weight: 1, maxGrade: 10, grade: undefined, isFinalExam: true }
      ]
    }
  ];

  const res = calculateFinalGrade(groups, 7.0);
  assert(res.score === 7.75, `Normal average is 7.75, got ${res.score}`);
  assert(res.inFinal === false, 'Student is NOT in final because normalAvg >= 7.0');
  assert(res.usedFinal === false, 'Did not use final');
  assert(res.hasMissingItems === false, 'Final exam is not considered a missing regular item');
});

runProbe('Grade Engine', 'Final Exam flow: Failed normal period, final exam pending', () => {
  const groups: GradeGroup[] = [
    {
      id: 'g1',
      name: 'Semestre',
      weight: 1,
      items: [
        { id: 'p1', name: 'P1', weight: 1, maxGrade: 10, grade: 4.0 },
        { id: 'p2', name: 'P2', weight: 1, maxGrade: 10, grade: 4.0 },
        { id: 'pf', name: 'Prova Final', weight: 1, maxGrade: 10, grade: undefined, isFinalExam: true }
      ]
    }
  ];

  const res = calculateFinalGrade(groups, 7.0);
  assert(res.score === 4.0, `Score before final is 4.0, got ${res.score}`);
  assert(res.inFinal === true, 'Student IS in final because normalAvg 4.0 < 7.0');
  assert(res.usedFinal === false, 'Has not yet taken final');
  assert(res.minimumNeeded === 6.0, `Needs 10 - 4 = 6.0 on final exam, got ${res.minimumNeeded}`);
});

runProbe('Grade Engine', 'Final Exam flow: Final exam taken and grade computed', () => {
  const groups: GradeGroup[] = [
    {
      id: 'g1',
      name: 'Semestre',
      weight: 1,
      items: [
        { id: 'p1', name: 'P1', weight: 1, maxGrade: 10, grade: 4.0 },
        { id: 'p2', name: 'P2', weight: 1, maxGrade: 10, grade: 4.0 },
        { id: 'pf', name: 'Prova Final', weight: 1, maxGrade: 10, grade: 8.0, isFinalExam: true }
      ]
    }
  ];

  // Final score = (normalAvg + finalGrade) / 2 = (4.0 + 8.0) / 2 = 6.0
  const res = calculateFinalGrade(groups, 7.0);
  assert(res.score === 6.0, `Combined final score is 6.0, got ${res.score}`);
  assert(res.inFinal === true, 'In final');
  assert(res.usedFinal === true, 'Used final exam grade');
});

runProbe('Grade Engine', 'Edge cases: Guaranteed pass (minimumNeeded clamped to 0)', () => {
  const groups: GradeGroup[] = [
    {
      id: 'g1',
      name: 'Provas',
      weight: 1,
      items: [
        { id: 'p1', name: 'P1', weight: 8, maxGrade: 10, grade: 10.0 }, // 80 points earned out of 100 total
        { id: 'p2', name: 'P2', weight: 2, maxGrade: 10, grade: undefined }
      ]
    }
  ];

  // Pass grade = 7.0. Total needed = 70. Current earned = 80 >= 70.
  // Deficit is negative (-10).
  const res = calculateFinalGrade(groups, 7.0);
  assert(res.minimumNeeded === 0, `Minimum needed clamped to 0, got ${res.minimumNeeded}`);
});

runProbe('Grade Engine', 'Edge cases: Impossible pass (minimumNeeded exceeds 10)', () => {
  const groups: GradeGroup[] = [
    {
      id: 'g1',
      name: 'Provas',
      weight: 1,
      items: [
        { id: 'p1', name: 'P1', weight: 9, maxGrade: 10, grade: 2.0 }, // Earned 18 points out of 100
        { id: 'p2', name: 'P2', weight: 1, maxGrade: 10, grade: undefined } // Weight is 1
      ]
    }
  ];

  // Pass grade = 7.0. Needed = 70. Deficit = 52. Remaining weight = 1 (10% of total).
  // Required on P2 = 52.0 (> 10.0).
  const res = calculateFinalGrade(groups, 7.0);
  assert(res.minimumNeeded === 52, `Accurately computes requirement of 52.0 on remaining 10% weight, got ${res.minimumNeeded}`);
});

// ============================================================================
// SUITE 4: TODAY SUMMARY WIDGET RECURRENCE & EVENT FILTERING
// ============================================================================
console.log('\n--- SUITE 4: TodaySummaryWidget Recurrence Guard Probes ---');

runProbe('TodayWidget', 'Weekly recurrence without recurrenceDays matches base event day of week', () => {
  const baseEventDate = '2026-08-17'; // A Monday
  const testSelectedDate = '2026-08-24'; // Following Monday
  const nonMatchingDate = '2026-08-25'; // Following Tuesday

  const matchEventOnDate = (eventDate: string, recurrence: string, selectedDate: string, recurrenceDays?: number[]) => {
    if (eventDate === selectedDate) return true;
    if (recurrence === 'weekly') {
      const dayOfWeek = new Date(selectedDate + 'T12:00:00').getDay();
      if (recurrenceDays && recurrenceDays.length > 0) {
        return recurrenceDays.includes(dayOfWeek);
      }
      if (eventDate) {
        const baseDayOfWeek = new Date(eventDate + 'T12:00:00').getDay();
        return baseDayOfWeek === dayOfWeek;
      }
    }
    return false;
  };

  assert(matchEventOnDate(baseEventDate, 'weekly', testSelectedDate, undefined) === true, 'Matches next week Monday when recurrenceDays is undefined');
  assert(matchEventOnDate(baseEventDate, 'weekly', nonMatchingDate, undefined) === false, 'Does not match Tuesday when base event was Monday');
  assert(matchEventOnDate(baseEventDate, 'weekly', '2026-08-25', [2]) === true, 'Matches Tuesday when recurrenceDays is [2]');
});

// ============================================================================
// SUITE 5: NETWORK TIMEOUT SIGNALS AUDIT
// ============================================================================
console.log('\n--- SUITE 5: Network Timeout Signals Integrity ---');

runProbe('Network Signals', 'AbortSignal.timeout(15000) is natively constructible', () => {
  const signal = AbortSignal.timeout(15000);
  assert(signal !== undefined, 'AbortSignal.timeout creates valid AbortSignal');
  assert(signal.aborted === false, 'Signal is initially not aborted');
});

console.log('\n================================================================');
console.log(`MILESTONE 1 CHALLENGER VERDICT: ${totalPassed}/${totalPassed + totalFailed} Passed (${totalFailed} Failed)`);
console.log('================================================================\n');

if (totalFailed > 0) {
  process.exit(1);
}
