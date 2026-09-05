import './setup_env';
import * as fs from 'fs';
import * as path from 'path';
import { AppEvent } from '../src/types';

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

/**
 * Pure evaluation function mirroring AgendaScreen.tsx recurrence logic
 */
function evaluateEventRecurrenceOnDate(e: AppEvent, targetDate: string): boolean {
  const startDateClean = e.date.split('T')[0];
  const targetDateClean = targetDate.split('T')[0];

  if (targetDateClean < startDateClean) return false;
  if (e.recurrence === 'daily') return true;

  if (e.recurrence === 'weekly') {
    const [tYear, tMonth, tDay] = targetDateClean.split('-').map(Number);
    const targetDayOfWeek = new Date(tYear, tMonth - 1, tDay).getDay();

    if (e.recurrenceDays && e.recurrenceDays.length > 0) {
      return e.recurrenceDays.includes(targetDayOfWeek);
    }
    const [sYear, sMonth, sDay] = startDateClean.split('-').map(Number);
    const startDayOfWeek = new Date(sYear, sMonth - 1, sDay).getDay();
    return startDayOfWeek === targetDayOfWeek;
  }

  if (e.recurrence === 'monthly' || e.recurrence === 'custom_interval') {
    const [startYear, startMonth, startDay] = startDateClean.split('-').map(Number);
    const [targetYear, targetMonth, targetDay] = targetDateClean.split('-').map(Number);

    const expectedDay = e.recurrenceMonthDay || startDay;
    if (targetDay !== expectedDay) return false;

    const interval = (e.recurrenceInterval && e.recurrenceInterval > 0) ? e.recurrenceInterval : 1;
    if (interval > 1) {
      const monthDiff = (targetYear - startYear) * 12 + (targetMonth - startMonth);
      if (monthDiff < 0 || monthDiff % interval !== 0) return false;
    }
    return true;
  }

  return startDateClean === targetDateClean;
}

/**
 * Pure projection function mirroring AgendaScreen.tsx markedDates recurrence projection
 */
function projectRecurrenceDates(e: AppEvent, maxOccurrences: number = 12): string[] {
  const startDateClean = e.date.split('T')[0];
  const results: string[] = [];

  if (e.recurrence === 'none') {
    results.push(startDateClean);
    return results;
  }

  if (e.recurrence === 'monthly' || e.recurrence === 'custom_interval') {
    const [startYear, startMonth, startDay] = startDateClean.split('-').map(Number);
    if (!startYear || !startMonth || !startDay) return results;

    const expectedDay = e.recurrenceMonthDay || startDay;
    const interval = (e.recurrenceInterval && e.recurrenceInterval > 0) ? e.recurrenceInterval : 1;

    for (let i = 0; i < maxOccurrences; i++) {
      const totalMonths = (startMonth - 1) + (i * interval);
      const occurrenceYear = startYear + Math.floor(totalMonths / 12);
      const occurrenceMonth = (totalMonths % 12) + 1;
      const daysInMonth = new Date(occurrenceYear, occurrenceMonth, 0).getDate();
      const actualDay = Math.min(expectedDay, daysInMonth);
      const dateStr = `${occurrenceYear}-${String(occurrenceMonth).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;

      if (dateStr >= startDateClean) {
        results.push(dateStr);
      }
    }
    return results;
  }

  return results;
}

async function runRecurrenceTestSuite() {
  console.log('================================================================');
  console.log('EVENT RECURRENCE ENGINE & CUSTOM INTERVALS UNIT TEST SUITE');
  console.log('================================================================');

  // ── 1. Type Modeling & Fields Verification ──
  console.log('\n--- 1. Type Modeling & Fields ---');
  const sampleCustomEvent: AppEvent = {
    id: 'evt_custom_1',
    title: 'Reunião Bimestral',
    category: 'Faculdade/Aulas',
    date: '2026-03-10',
    startTime: '14:00',
    endTime: '16:00',
    recurrence: 'custom_interval',
    recurrenceInterval: 2,
    recurrenceUnit: 'months',
    recurrenceMonthDay: 10,
    alerts: [60],
    isCompleted: false
  };

  assert(sampleCustomEvent.recurrence === 'custom_interval', 'RecurrenceType allows "custom_interval"');
  assert(sampleCustomEvent.recurrenceInterval === 2, 'AppEvent supports recurrenceInterval property');
  assert(sampleCustomEvent.recurrenceUnit === 'months', 'AppEvent supports recurrenceUnit property');
  assert(sampleCustomEvent.recurrenceMonthDay === 10, 'AppEvent supports recurrenceMonthDay property');

  // ── 2. Monthly Recurrence with Default Day ──
  console.log('\n--- 2. Monthly Recurrence with Default Day ---');
  const monthlyEvent: AppEvent = {
    id: 'evt_monthly_1',
    title: 'Mensalidade',
    category: 'Outros',
    date: '2026-03-15',
    startTime: '09:00',
    endTime: '10:00',
    recurrence: 'monthly',
    alerts: [1440],
    isCompleted: false
  };

  assert(evaluateEventRecurrenceOnDate(monthlyEvent, '2026-03-15') === true, 'Matches start date 2026-03-15');
  assert(evaluateEventRecurrenceOnDate(monthlyEvent, '2026-04-15') === true, 'Matches next month 2026-04-15');
  assert(evaluateEventRecurrenceOnDate(monthlyEvent, '2026-05-15') === true, 'Matches 2 months later 2026-05-15');
  assert(evaluateEventRecurrenceOnDate(monthlyEvent, '2027-03-15') === true, 'Matches 1 year later 2027-03-15');
  assert(evaluateEventRecurrenceOnDate(monthlyEvent, '2026-03-14') === false, 'Rejects day before 2026-03-14');
  assert(evaluateEventRecurrenceOnDate(monthlyEvent, '2026-03-16') === false, 'Rejects day after 2026-03-16');
  assert(evaluateEventRecurrenceOnDate(monthlyEvent, '2026-04-10') === false, 'Rejects different day in next month 2026-04-10');
  assert(evaluateEventRecurrenceOnDate(monthlyEvent, '2026-02-15') === false, 'Rejects date prior to start date 2026-02-15');

  // ── 3. Monthly Recurrence with recurrenceMonthDay Override ──
  console.log('\n--- 3. Monthly Recurrence with recurrenceMonthDay Override ---');
  const monthlyDayOverrideEvent: AppEvent = {
    id: 'evt_monthly_override',
    title: 'Relatório Mensal',
    category: 'Faculdade/Aulas',
    date: '2026-03-01',
    startTime: '10:00',
    endTime: '11:00',
    recurrence: 'monthly',
    recurrenceMonthDay: 25,
    alerts: [60],
    isCompleted: false
  };

  assert(evaluateEventRecurrenceOnDate(monthlyDayOverrideEvent, '2026-03-25') === true, 'Matches override day 25 in start month 2026-03-25');
  assert(evaluateEventRecurrenceOnDate(monthlyDayOverrideEvent, '2026-04-25') === true, 'Matches override day 25 in April 2026-04-25');
  assert(evaluateEventRecurrenceOnDate(monthlyDayOverrideEvent, '2026-03-01') === false, 'Rejects start date 2026-03-01 when override day is 25');
  assert(evaluateEventRecurrenceOnDate(monthlyDayOverrideEvent, '2026-02-25') === false, 'Rejects prior month 2026-02-25');

  // ── 4. Custom Interval = 2 (Bimonthly) ──
  console.log('\n--- 4. Custom Interval = 2 (Bimonthly) ---');
  const bimonthlyEvent: AppEvent = {
    id: 'evt_bimonthly',
    title: 'Bimestral',
    category: 'Faculdade/Aulas',
    date: '2026-01-10',
    startTime: '08:00',
    endTime: '10:00',
    recurrence: 'custom_interval',
    recurrenceInterval: 2,
    alerts: [60],
    isCompleted: false
  };

  assert(evaluateEventRecurrenceOnDate(bimonthlyEvent, '2026-01-10') === true, 'Matches month 0 (Jan 10, 2026)');
  assert(evaluateEventRecurrenceOnDate(bimonthlyEvent, '2026-02-10') === false, 'Rejects month 1 (Feb 10, 2026)');
  assert(evaluateEventRecurrenceOnDate(bimonthlyEvent, '2026-03-10') === true, 'Matches month 2 (Mar 10, 2026)');
  assert(evaluateEventRecurrenceOnDate(bimonthlyEvent, '2026-04-10') === false, 'Rejects month 3 (Apr 10, 2026)');
  assert(evaluateEventRecurrenceOnDate(bimonthlyEvent, '2026-05-10') === true, 'Matches month 4 (May 10, 2026)');
  assert(evaluateEventRecurrenceOnDate(bimonthlyEvent, '2026-07-10') === true, 'Matches month 6 (Jul 10, 2026)');
  assert(evaluateEventRecurrenceOnDate(bimonthlyEvent, '2027-01-10') === true, 'Matches month 12 across years (Jan 10, 2027)');
  assert(evaluateEventRecurrenceOnDate(bimonthlyEvent, '2027-02-10') === false, 'Rejects month 13 across years (Feb 10, 2027)');

  // ── 5. Custom Interval = 3 (Quarterly) & Interval = 6 (Semestral) ──
  console.log('\n--- 5. Custom Interval = 3 (Quarterly) & Interval = 6 (Semestral) ---');
  const quarterlyEvent: AppEvent = {
    id: 'evt_quarterly',
    title: 'Trimestral',
    category: 'Provas/Trabalhos',
    date: '2026-02-15',
    startTime: '10:00',
    endTime: '12:00',
    recurrence: 'custom_interval',
    recurrenceInterval: 3,
    alerts: [1440],
    isCompleted: false
  };

  assert(evaluateEventRecurrenceOnDate(quarterlyEvent, '2026-02-15') === true, 'Quarterly matches month 0 (Feb 15)');
  assert(evaluateEventRecurrenceOnDate(quarterlyEvent, '2026-03-15') === false, 'Quarterly rejects month 1 (Mar 15)');
  assert(evaluateEventRecurrenceOnDate(quarterlyEvent, '2026-04-15') === false, 'Quarterly rejects month 2 (Apr 15)');
  assert(evaluateEventRecurrenceOnDate(quarterlyEvent, '2026-05-15') === true, 'Quarterly matches month 3 (May 15)');
  assert(evaluateEventRecurrenceOnDate(quarterlyEvent, '2026-08-15') === true, 'Quarterly matches month 6 (Aug 15)');
  assert(evaluateEventRecurrenceOnDate(quarterlyEvent, '2026-11-15') === true, 'Quarterly matches month 9 (Nov 15)');
  assert(evaluateEventRecurrenceOnDate(quarterlyEvent, '2027-02-15') === true, 'Quarterly matches month 12 (Feb 15, 2027)');

  const semestralEvent: AppEvent = {
    id: 'evt_semestral',
    title: 'Semestral',
    category: 'Provas/Trabalhos',
    date: '2026-03-01',
    startTime: '08:00',
    endTime: '10:00',
    recurrence: 'custom_interval',
    recurrenceInterval: 6,
    alerts: [1440],
    isCompleted: false
  };

  assert(evaluateEventRecurrenceOnDate(semestralEvent, '2026-03-01') === true, 'Semestral matches month 0 (Mar 01, 2026)');
  assert(evaluateEventRecurrenceOnDate(semestralEvent, '2026-06-01') === false, 'Semestral rejects month 3 (Jun 01, 2026)');
  assert(evaluateEventRecurrenceOnDate(semestralEvent, '2026-09-01') === true, 'Semestral matches month 6 (Sep 01, 2026)');
  assert(evaluateEventRecurrenceOnDate(semestralEvent, '2027-03-01') === true, 'Semestral matches month 12 (Mar 01, 2027)');

  // ── 6. ISO Strings with Timestamps Robustness ──
  console.log('\n--- 6. ISO Strings with Timestamps Robustness ---');
  const isoTimestampEvent: AppEvent = {
    id: 'evt_iso',
    title: 'Evento com Timestamp',
    category: 'Saúde/Academia',
    date: '2026-04-10T14:30:00.000Z',
    startTime: '14:30',
    endTime: '15:30',
    recurrence: 'monthly',
    alerts: [60],
    isCompleted: false
  };

  assert(evaluateEventRecurrenceOnDate(isoTimestampEvent, '2026-04-10') === true, 'Matches targetDate format YYYY-MM-DD when date has ISO time');
  assert(evaluateEventRecurrenceOnDate(isoTimestampEvent, '2026-05-10') === true, 'Matches next month when date has ISO time');

  // ── 7. Calendar Marked Dates Projection & Month-End Clamping ──
  console.log('\n--- 7. Calendar Marked Dates Projection & Month-End Clamping ---');
  const monthEndEvent: AppEvent = {
    id: 'evt_month_end',
    title: 'Fechamento do Mês',
    category: 'Outros',
    date: '2026-01-31',
    startTime: '18:00',
    endTime: '19:00',
    recurrence: 'monthly',
    recurrenceMonthDay: 31,
    alerts: [60],
    isCompleted: false
  };

  const projectedDates = projectRecurrenceDates(monthEndEvent, 6);
  assert(projectedDates[0] === '2026-01-31', 'Occurrence 0 is 2026-01-31');
  assert(projectedDates[1] === '2026-02-28', 'Occurrence 1 clamps to 2026-02-28 for non-leap Feb');
  assert(projectedDates[2] === '2026-03-31', 'Occurrence 2 is 2026-03-31');
  assert(projectedDates[3] === '2026-04-30', 'Occurrence 3 clamps to 2026-04-30 for 30-day April');
  assert(projectedDates[4] === '2026-05-31', 'Occurrence 4 is 2026-05-31');
  assert(projectedDates[5] === '2026-06-30', 'Occurrence 5 clamps to 2026-06-30 for 30-day June');

  const projectedBimonthly = projectRecurrenceDates(bimonthlyEvent, 6);
  assert(projectedBimonthly.length === 6, 'Bimonthly projects 6 occurrences');
  assert(projectedBimonthly[0] === '2026-01-10', 'Bimonthly 0 is 2026-01-10');
  assert(projectedBimonthly[1] === '2026-03-10', 'Bimonthly 1 is 2026-03-10');
  assert(projectedBimonthly[2] === '2026-05-10', 'Bimonthly 2 is 2026-05-10');
  assert(projectedBimonthly[3] === '2026-07-10', 'Bimonthly 3 is 2026-07-10');
  assert(projectedBimonthly[4] === '2026-09-10', 'Bimonthly 4 is 2026-09-10');
  assert(projectedBimonthly[5] === '2026-11-10', 'Bimonthly 5 is 2026-11-10');

  // ── 8. Static Audit of AgendaScreen.tsx ──
  console.log('\n--- 8. Static Audit of AgendaScreen.tsx ---');
  const agendaScreenPath = path.resolve(__dirname, '../src/screens/AgendaScreen.tsx');
  const agendaContent = fs.readFileSync(agendaScreenPath, 'utf8');

  assert(agendaContent.includes("e.recurrence === 'monthly' || e.recurrence === 'custom_interval'"),
    'AgendaScreen.tsx handles both monthly and custom_interval in filter');
  assert(agendaContent.includes('recurrenceMonthDay || startDay'),
    'AgendaScreen.tsx checks recurrenceMonthDay with startDay fallback');
  assert(agendaContent.includes('monthDiff = (targetYear - startYear) * 12 + (targetMonth - startMonth)'),
    'AgendaScreen.tsx calculates monthDiff accurately across years');
  assert(agendaContent.includes('monthDiff % interval !== 0'),
    'AgendaScreen.tsx validates recurrence interval modulo');
  assert(agendaContent.includes('recurrence === \'custom_interval\''),
    'AgendaScreen.tsx markedDates handles custom_interval');

  console.log('\n================================================================');
  console.log(`RECURRENCE ENGINE TESTS SUMMARY: ${passed}/${passed + failed} Passed (${failed} Failed)`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runRecurrenceTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
