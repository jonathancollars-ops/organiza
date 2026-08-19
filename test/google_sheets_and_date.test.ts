import './setup_env';
import { getLocalDateString, formatDisplayDate, parseLocalDate } from '../src/utils/date';
import { GoogleSheetsService } from '../src/services/GoogleSheetsService';
import { calculateFinalGrade } from '../src/components/GradeEngine';
import { GradeGroup } from '../src/types';

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

async function runTestSuite() {
  console.log('================================================================');
  console.log('LOGIC, DATE & GOOGLE SHEETS UNIT TEST SUITE');
  console.log('================================================================');

  // ── 1. Date & Timezone Resiliency ──
  console.log('\n--- 1. Date & Timezone Resiliency (getLocalDateString) ---');
  
  // Specific local dates
  const d1 = new Date(2026, 7, 18, 22, 30, 0); // Aug 18, 2026, 22:30 local
  assert(getLocalDateString(d1) === '2026-08-18', 'Formats 22:30 local time without advancing day', `Got ${getLocalDateString(d1)}`);

  const d2 = new Date(2026, 7, 18, 23, 59, 59); // Aug 18, 2026, 23:59:59 local
  assert(getLocalDateString(d2) === '2026-08-18', 'Formats 23:59:59 local time accurately', `Got ${getLocalDateString(d2)}`);

  const d3 = new Date(2028, 1, 29, 12, 0, 0); // Feb 29, 2028 (leap year)
  assert(getLocalDateString(d3) === '2028-02-29', 'Handles leap year Feb 29 correctly', `Got ${getLocalDateString(d3)}`);

  // formatDisplayDate
  assert(formatDisplayDate('2026-08-18') === '18/08/2026', 'Formats YYYY-MM-DD to DD/MM/YYYY');
  assert(formatDisplayDate('') === '', 'Handles empty date string gracefully');

  // parseLocalDate
  const parsedD = parseLocalDate('2026-08-18');
  assert(parsedD.getHours() === 12, 'parseLocalDate pins hour to 12:00:00 local noon');

  // ── 2. GoogleSheetsService RFC 4180 CSV Parsing ──
  console.log('\n--- 2. GoogleSheetsService RFC 4180 CSV Parsing ---');

  const standardCsv = `timestamp,team_name,channel_name,sender,message\n2026-08-18T10:00:00Z,Engenharia,Geral,Prof. Silva,Aula de hoje cancelada`;
  const parsedStandard = GoogleSheetsService.parseCsvRecords(standardCsv);
  assert(parsedStandard.length === 2, 'Standard CSV parses 2 rows');
  assert(parsedStandard[1][4] === 'Aula de hoje cancelada', 'Message field parsed correctly');

  // Quoted commas
  const commaCsv = `col1,col2,col3\n"Val 1, with comma",Val2,"Val3, also comma"`;
  const parsedComma = GoogleSheetsService.parseCsvRecords(commaCsv);
  assert(parsedComma[1][0] === 'Val 1, with comma', 'Handles commas inside quotes');
  assert(parsedComma[1][2] === 'Val3, also comma', 'Handles trailing quoted field with comma');

  // Quoted embedded newlines (Multiline)
  const multilineCsv = `timestamp,team_name,channel_name,sender,message\n2026-08-18T10:00:00Z,Engenharia,Geral,Prof. Silva,"Prezados alunos,\nA aula de amanhã está cancelada.\nAtenciosamente,\nProf. Silva"`;
  const parsedMultiline = GoogleSheetsService.parseCsvRecords(multilineCsv);
  assert(parsedMultiline.length === 2, 'Multiline CSV preserves single row for multiline quoted message', `Got ${parsedMultiline.length} rows`);
  assert(parsedMultiline[1][4].includes('Prezados alunos,\nA aula de amanhã'), 'Preserves embedded linebreaks within field');

  // Escaped quotes ("")
  const escapedQuotesCsv = `col1,col2\n"He said ""Hello world""",simple`;
  const parsedEscaped = GoogleSheetsService.parseCsvRecords(escapedQuotesCsv);
  assert(parsedEscaped[1][0] === 'He said "Hello world"', 'Handles escaped double quotes ("")');

  // Spreadsheet ID extraction
  const url1 = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0';
  assert(GoogleSheetsService.extractSpreadsheetId(url1) === '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms', 'Extracts spreadsheet ID from edit URL');

  const url2 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT_SAMPLE_ID/pubhtml';
  assert(GoogleSheetsService.extractSpreadsheetId(url2) === 'e', 'Handles /d/ path segment');

  // ── 3. Grade Calculation Parity ──
  console.log('\n--- 3. Grade Calculation Parity (Omit Ungraded Assessments) ---');

  const gradeGroupsWithFutureItems: GradeGroup[] = [
    {
      id: 'grp_1',
      name: 'Avaliações',
      weight: 1,
      items: [
        { id: 'p1', name: 'P1', weight: 1, maxGrade: 10, grade: 10.0 },
        { id: 'p2', name: 'P2', weight: 1, maxGrade: 10, grade: undefined } // future exam!
      ]
    }
  ];

  const calc = calculateFinalGrade(gradeGroupsWithFutureItems, 7.0);
  assert(calc.score === 10.0, 'Calculates 10.0 when P1=10 and P2 is not yet graded (does not falsely divide by 2)', `Got ${calc.score}`);
  assert(calc.hasMissingItems === true, 'Identifies that P2 is pending');
  assert(calc.missingItemsCount === 1, 'Counts 1 missing assessment');
  assert(calc.minimumNeeded === 4.0, `Calculates minimum needed on P2 to pass with 7.0 (needs 4.0, got ${calc.minimumNeeded})`);

  console.log('\n================================================================');
  console.log(`TESTS SUMMARY: ${passed}/${passed + failed} Passed (${failed} Failed)`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runTestSuite();
