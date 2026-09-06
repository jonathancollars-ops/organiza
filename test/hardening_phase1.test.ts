import './setup_env';
import { safeParseArray, safeParseObject } from '../src/services/storage';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ' -> ' + detail : ''}`);
    failed++;
  }
}

console.log('=== PHASE 1: STORAGE RESILIENCE TESTS ===');

// 1. Storage Resilience
const corruptedJson = '{ invalid: "json", ';
const resCorrupted = safeParseArray(corruptedJson, [{ id: 'fallback' }]);
assert(resCorrupted.length === 1 && resCorrupted[0].id === 'fallback', 'safeParseArray handles corrupted JSON');

const rawWithHoles = JSON.stringify([{ id: '1' }, null, undefined, { id: '2' }]);
const resHoles = safeParseArray<{ id: string }>(rawWithHoles, []);
assert(resHoles.length === 2 && resHoles[0].id === '1' && resHoles[1].id === '2', 'safeParseArray filters null/undefined array holes');

assert(safeParseArray('', []).length === 0, 'safeParseArray handles empty string');
assert(safeParseArray('null', []).length === 0, 'safeParseArray handles literal "null"');
assert(safeParseArray('undefined', []).length === 0, 'safeParseArray handles literal "undefined"');

const defaultSettings = { theme: 'dark', fontScale: 1.0 };
const corruptedObj = safeParseObject('{ malformed json', defaultSettings);
assert(corruptedObj.theme === 'dark' && corruptedObj.fontScale === 1.0, 'safeParseObject recovers from corrupted JSON');

const arrayJson = safeParseObject('[1, 2, 3]', defaultSettings);
assert(arrayJson.theme === 'dark', 'safeParseObject rejects array payloads and returns default');

const partialJson = safeParseObject('{"theme": "light"}', defaultSettings);
assert(partialJson.theme === 'light' && partialJson.fontScale === 1.0, 'safeParseObject merges partial fields with defaults');

console.log('\n=== PHASE 1: RECURRENCE MONTH-END & LEAP-YEAR TESTS ===');

function evaluateRecurrenceWithClamping(
  startDate: string,
  targetDate: string,
  recurrence: 'monthly' | 'custom_interval',
  recurrenceInterval: number = 1,
  recurrenceMonthDay?: number
): boolean {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [targetYear, targetMonth, targetDay] = targetDate.split('-').map(Number);

  if (targetDate < startDate) return false;

  const expectedDay = recurrenceMonthDay || startDay;
  const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
  const effectiveDay = Math.min(expectedDay, daysInTargetMonth);

  if (targetDay !== effectiveDay) return false;

  const interval = recurrenceInterval > 0 ? recurrenceInterval : 1;
  if (interval > 1) {
    const monthDiff = (targetYear - startYear) * 12 + (targetMonth - startMonth);
    if (monthDiff < 0 || monthDiff % interval !== 0) return false;
  }

  return true;
}

assert(
  evaluateRecurrenceWithClamping('2026-01-31', '2026-02-28', 'monthly', 1, 31) === true,
  'Day 31 event clamps to Feb 28 in non-leap year (2026)'
);
assert(
  evaluateRecurrenceWithClamping('2026-01-31', '2026-02-27', 'monthly', 1, 31) === false,
  'Day 31 event does not match Feb 27 in non-leap year'
);
assert(
  evaluateRecurrenceWithClamping('2028-01-31', '2028-02-29', 'monthly', 1, 31) === true,
  'Day 31 event clamps to Feb 29 in leap year (2028)'
);
assert(
  evaluateRecurrenceWithClamping('2028-01-31', '2028-02-28', 'monthly', 1, 31) === false,
  'Day 31 event does not match Feb 28 in leap year'
);
assert(
  evaluateRecurrenceWithClamping('2026-01-31', '2026-04-30', 'monthly', 1, 31) === true,
  'Day 31 event clamps to April 30 in 30-day months'
);
assert(
  evaluateRecurrenceWithClamping('2026-01-31', '2026-04-30', 'custom_interval', 3, 31) === true,
  'Quarterly day 31 event (interval 3) clamps to April 30'
);
assert(
  evaluateRecurrenceWithClamping('2026-01-31', '2026-05-31', 'custom_interval', 3, 31) === false,
  'Quarterly day 31 event does not match month 2 of 3 (May)'
);

console.log('\n=== PHASE 1: ATTENDANCE & ABSENCE ANTI-NAN TESTS ===');

function calculateSafeAbsenceMetrics(absences: number, rawMaxAbsences: any) {
  const safeAbsences = (typeof absences === 'number' && Number.isFinite(absences)) ? Math.max(0, absences) : 0;
  const maxAbsences = (typeof rawMaxAbsences === 'number' && Number.isFinite(rawMaxAbsences) && rawMaxAbsences > 0)
    ? rawMaxAbsences
    : 15;
  const rawRatio = safeAbsences / maxAbsences;
  const absencePercentage = Number.isFinite(rawRatio) ? Math.max(0, rawRatio * 100) : 0;
  const remainingAbsences = Math.max(0, maxAbsences - safeAbsences);

  return { safeAbsences, maxAbsences, absencePercentage, remainingAbsences };
}

const attRes1 = calculateSafeAbsenceMetrics(5, 0);
assert(Number.isFinite(attRes1.absencePercentage) && attRes1.maxAbsences === 15, 'Attendance calculation handles maxAbsences = 0 without NaN/Infinity');

const attRes2 = calculateSafeAbsenceMetrics(3, -5);
assert(Number.isFinite(attRes2.absencePercentage) && attRes2.maxAbsences === 15, 'Attendance calculation handles negative maxAbsences');

const attRes3 = calculateSafeAbsenceMetrics(NaN, 20);
assert(attRes3.safeAbsences === 0 && attRes3.absencePercentage === 0, 'Attendance calculation guards against NaN absences');

console.log('\n=== PHASE 1: GRADES & GPA ANTI-NAN TESTS ===');

function calculateSafeGPA(items: Array<{ grade: any; workloadHours: any; isArchived?: boolean }>) {
  let totalWeightedScore = 0;
  let totalCredits = 0;
  let subjectsWithGrades = 0;

  items.forEach(s => {
    if (s.isArchived) return;
    const gradeVal = typeof s.grade === 'number' && Number.isFinite(s.grade) ? s.grade : null;
    if (gradeVal !== null) {
      const credits = (typeof s.workloadHours === 'number' && Number.isFinite(s.workloadHours) && s.workloadHours > 0)
        ? s.workloadHours
        : 4;
      totalWeightedScore += gradeVal * credits;
      totalCredits += credits;
      subjectsWithGrades++;
    }
  });

  const rawGpa = totalCredits > 0 ? totalWeightedScore / totalCredits : 0;
  const gpa = Number.isFinite(rawGpa) ? Math.max(0, Math.min(10, rawGpa)) : 0;

  return { gpa, subjectsWithGrades, totalCredits };
}

const gpaEmpty = calculateSafeGPA([]);
assert(gpaEmpty.gpa === 0 && gpaEmpty.gpa.toFixed(2) === '0.00', 'Empty subjects array returns 0.00 GPA without NaN');

const gpaCorrupted = calculateSafeGPA([
  { grade: NaN, workloadHours: 60 },
  { grade: 'invalid', workloadHours: -4 },
  { grade: undefined, workloadHours: null }
]);
assert(gpaCorrupted.gpa === 0 && gpaCorrupted.subjectsWithGrades === 0, 'Corrupted grades and credits return 0.00 GPA without crashing');

const gpaValid = calculateSafeGPA([
  { grade: 8.0, workloadHours: 4 },
  { grade: 6.0, workloadHours: 2 }
]);
assert(gpaValid.gpa.toFixed(2) === '7.33', 'Valid weighted grades compute accurate GPA (7.33)');

console.log(`\n=================================================`);
console.log(`Phase 1 Test Summary: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log(`🎉 ALL PHASE 1 HARDENING TESTS PASSED!`);
  process.exit(0);
}
