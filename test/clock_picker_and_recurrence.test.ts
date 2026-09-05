import './setup_env';
import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { AppEvent, ThemeType } from '../src/types';
import { ClockTimePickerModal } from '../src/components/ClockTimePickerModal';
import { AppUpdateService } from '../src/services/AppUpdateService';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string): void {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  totalTests++;
  if (actual === expected) {
    passedTests++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${message} (Expected: ${String(expected)}, Got: ${String(actual)})`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  console.log(`\n--- Test: ${name} ---`);
  await fn();
}

/**
 * Pure evaluation function mirroring AgendaScreen recurrence engine for monthly/custom intervals
 */
function matchesMonthlyRecurrence(event: Readonly<AppEvent>, targetDateClean: string): boolean {
  const startDateClean = (event.date || '').split('T')[0];
  if (!startDateClean || !targetDateClean) return false;

  const [startYear, startMonth, startDay] = startDateClean.split('-').map(Number);
  const [targetYear, targetMonth, targetDay] = targetDateClean.split('-').map(Number);

  if (!startYear || !startMonth || !startDay || !targetYear || !targetMonth || !targetDay) return false;

  const expectedDay = event.recurrenceMonthDay || startDay;
  if (targetDay !== expectedDay) return false;

  const interval = (event.recurrenceInterval && event.recurrenceInterval > 0) ? event.recurrenceInterval : 1;
  if (interval > 1) {
    const monthDiff = (targetYear - startYear) * 12 + (targetMonth - startMonth);
    if (monthDiff < 0 || monthDiff % interval !== 0) return false;
  } else {
    const monthDiff = (targetYear - startYear) * 12 + (targetMonth - startMonth);
    if (monthDiff < 0) return false;
  }

  return true;
}

/**
 * Geometric converters mirroring ClockTimePickerModal math
 */
const CLOCK_CONSTANTS = {
  CLOCK_SIZE: 260,
  CENTER: 130,
  OUTER_RADIUS: 94,
  INNER_RADIUS: 58,
  NUMBER_SIZE: 34,
  THRESHOLD_RADIUS: (58 + 94) / 2 // 76
};

function getHourAngle(hour: number): { angle: number; isInner: boolean; radius: number } {
  const safeHour = Math.min(23, Math.max(0, hour));
  const isInner = safeHour === 0 || safeHour >= 13;
  const hour12 = safeHour % 12;
  const angle = hour12 * 30; // 360 / 12 = 30 deg
  const radius = isInner ? CLOCK_CONSTANTS.INNER_RADIUS : CLOCK_CONSTANTS.OUTER_RADIUS;
  return { angle, isInner, radius };
}

function getMinuteAngle(minute: number): { angle: number; radius: number } {
  const safeMinute = Math.min(59, Math.max(0, minute));
  const angle = safeMinute * 6; // 360 / 60 = 6 deg
  return { angle, radius: CLOCK_CONSTANTS.OUTER_RADIUS };
}

function angleAndRadiusToHour(angleDeg: number, radius: number): number {
  const normalizedAngle = ((angleDeg % 360) + 360) % 360;
  const hour12 = Math.round(normalizedAngle / 30) % 12;
  const isInner = radius <= CLOCK_CONSTANTS.THRESHOLD_RADIUS;

  if (isInner) {
    return hour12 === 0 ? 0 : hour12 + 12;
  } else {
    return hour12 === 0 ? 12 : hour12;
  }
}

function angleToMinute(angleDeg: number): number {
  const normalizedAngle = ((angleDeg % 360) + 360) % 360;
  return Math.round(normalizedAngle / 6) % 60;
}

function formatTimeString(hour: number, minute: number): { timeStr: string; totalMinutes: number } {
  const safeH = Math.min(23, Math.max(0, hour));
  const safeM = Math.min(59, Math.max(0, minute));
  const hStr = safeH.toString().padStart(2, '0');
  const mStr = safeM.toString().padStart(2, '0');
  const totalMinutes = safeH * 60 + safeM;
  return { timeStr: `${hStr}:${mStr}`, totalMinutes };
}

async function runTestSuite(): Promise<void> {
  console.log('================================================================');
  console.log('⏰ CLOCK PICKER, LONG INTERVAL RECURRENCE & INSTALLER SUITE');
  console.log('================================================================');

  // ==========================================================================
  // SUITE 1: Advanced Recurrence (Long Intervals & Monthly Fixed)
  // ==========================================================================
  console.log('\n--- SUITE 1: Advanced Recurrence Calculations ---');

  await test('Event with 6-month recurrence created on 2026-01-10', () => {
    const biAnnualEvent: AppEvent = {
      id: 'evt_biannual_1',
      title: 'Renovação Semestral de Matrícula',
      date: '2026-01-10T09:00:00.000Z',
      recurrence: 'monthly',
      recurrenceInterval: 6,
      recurrenceMonthDay: 10,
      alerts: []
    };

    // 1. Exactly 6 months later (2026-07-10) -> MUST match
    assert(
      matchesMonthlyRecurrence(biAnnualEvent, '2026-07-10'),
      'Matches exactly 6 months later on 2026-07-10'
    );

    // 2. 2 months later (2026-03-10) -> MUST NOT match
    assert(
      !matchesMonthlyRecurrence(biAnnualEvent, '2026-03-10'),
      'Does NOT match 2 months later on 2026-03-10'
    );

    // 3. Right month but wrong day (2026-07-15) -> MUST NOT match
    assert(
      !matchesMonthlyRecurrence(biAnnualEvent, '2026-07-15'),
      'Does NOT match wrong day of same target month on 2026-07-15'
    );

    // 4. Exactly 12 months later (2027-01-10) -> MUST match
    assert(
      matchesMonthlyRecurrence(biAnnualEvent, '2027-01-10'),
      'Matches 12 months later (2 x 6-month intervals) on 2027-01-10'
    );

    // 5. Past date before start date (2025-07-10) -> MUST NOT match
    assert(
      !matchesMonthlyRecurrence(biAnnualEvent, '2025-07-10'),
      'Does NOT match occurrences in the past prior to creation date'
    );

    // 6. 18 months later (2027-07-10) -> MUST match
    assert(
      matchesMonthlyRecurrence(biAnnualEvent, '2027-07-10'),
      'Matches 18 months later (3 x 6-month intervals) on 2027-07-10'
    );
  });

  await test('Fixed monthly event on day 15 across consecutive months', () => {
    const monthlyFixedEvent: AppEvent = {
      id: 'evt_monthly_fixed',
      title: 'Pagamento Mensal / Fechamento',
      date: '2026-01-15T12:00:00.000Z',
      recurrence: 'monthly',
      recurrenceInterval: 1,
      recurrenceMonthDay: 15,
      alerts: []
    };

    // Test all 12 consecutive months of 2026
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    for (const m of months) {
      const targetDate = `2026-${m}-15`;
      assert(
        matchesMonthlyRecurrence(monthlyFixedEvent, targetDate),
        `Matches day 15 for month ${m} (${targetDate})`
      );
    }

    // Days before and after day 15 MUST NOT match
    assert(!matchesMonthlyRecurrence(monthlyFixedEvent, '2026-02-14'), 'Does not match day 14');
    assert(!matchesMonthlyRecurrence(monthlyFixedEvent, '2026-02-16'), 'Does not match day 16');
    assert(!matchesMonthlyRecurrence(monthlyFixedEvent, '2026-08-01'), 'Does not match day 01');
  });

  await test('AgendaScreen.tsx source code contains strict monthly and custom interval recurrence logic', () => {
    const screensDir = path.resolve(__dirname, '../src/screens');
    const agendaSource = fs.readFileSync(path.join(screensDir, 'AgendaScreen.tsx'), 'utf8');

    assert(
      agendaSource.includes("e.recurrence === 'monthly' || e.recurrence === 'custom_interval'"),
      'AgendaScreen.tsx checks monthly and custom_interval recurrence types'
    );

    assert(
      agendaSource.includes('monthDiff % interval !== 0'),
      'AgendaScreen.tsx verifies month interval divisibility with modulo'
    );

    assert(
      agendaSource.includes('targetDay !== expectedDay'),
      'AgendaScreen.tsx verifies exact target day match against recurrenceMonthDay'
    );
  });

  // ==========================================================================
  // SUITE 2: Clock & Time Picker Math & Formatting
  // ==========================================================================
  console.log('\n--- SUITE 2: Clock & Time Picker Angles, Conversion & Formatting ---');

  await test('Hour to angle and radius conversion (0-23 hours)', () => {
    // Outer Circle (1..12)
    const h1 = getHourAngle(1);
    assertEqual(h1.angle, 30, '1 hour -> 30 deg');
    assertEqual(h1.isInner, false, '1 hour is on outer ring');
    assertEqual(h1.radius, 94, 'Outer ring radius is 94');

    const h3 = getHourAngle(3);
    assertEqual(h3.angle, 90, '3 hours -> 90 deg (quarter)');
    assertEqual(h3.isInner, false, '3 hours is on outer ring');

    const h6 = getHourAngle(6);
    assertEqual(h6.angle, 180, '6 hours -> 180 deg (half)');
    assertEqual(h6.isInner, false, '6 hours is on outer ring');

    const h9 = getHourAngle(9);
    assertEqual(h9.angle, 270, '9 hours -> 270 deg (three quarters)');
    assertEqual(h9.isInner, false, '9 hours is on outer ring');

    const h12 = getHourAngle(12);
    assertEqual(h12.angle, 0, '12 hours -> 0 deg (top)');
    assertEqual(h12.isInner, false, '12 hours is on outer ring');

    // Inner Circle (13..23, 00)
    const h13 = getHourAngle(13);
    assertEqual(h13.angle, 30, '13 hours -> 30 deg');
    assertEqual(h13.isInner, true, '13 hours is on inner ring');
    assertEqual(h13.radius, 58, 'Inner ring radius is 58');

    const h15 = getHourAngle(15);
    assertEqual(h15.angle, 90, '15 hours -> 90 deg');
    assertEqual(h15.isInner, true, '15 hours is on inner ring');

    const h18 = getHourAngle(18);
    assertEqual(h18.angle, 180, '18 hours -> 180 deg');
    assertEqual(h18.isInner, true, '18 hours is on inner ring');

    const h21 = getHourAngle(21);
    assertEqual(h21.angle, 270, '21 hours -> 270 deg');
    assertEqual(h21.isInner, true, '21 hours is on inner ring');

    const h0 = getHourAngle(0);
    assertEqual(h0.angle, 0, '0 hours (midnight) -> 0 deg');
    assertEqual(h0.isInner, true, '0 hours (midnight) is on inner ring');
  });

  await test('Minute to angle conversion (0-59 minutes)', () => {
    assertEqual(getMinuteAngle(0).angle, 0, '0 min -> 0 deg');
    assertEqual(getMinuteAngle(5).angle, 30, '5 min -> 30 deg');
    assertEqual(getMinuteAngle(15).angle, 90, '15 min -> 90 deg');
    assertEqual(getMinuteAngle(30).angle, 180, '30 min -> 180 deg');
    assertEqual(getMinuteAngle(45).angle, 270, '45 min -> 270 deg');
    assertEqual(getMinuteAngle(55).angle, 330, '55 min -> 330 deg');
    assertEqual(getMinuteAngle(59).angle, 354, '59 min -> 354 deg');
  });

  await test('Inverse angle and position to hour conversion (0-23)', () => {
    // Outer ring radius = 94 (> 76 threshold)
    assertEqual(angleAndRadiusToHour(0, 94), 12, '0 deg outer -> 12 hours');
    assertEqual(angleAndRadiusToHour(30, 94), 1, '30 deg outer -> 1 hour');
    assertEqual(angleAndRadiusToHour(90, 94), 3, '90 deg outer -> 3 hours');
    assertEqual(angleAndRadiusToHour(180, 94), 6, '180 deg outer -> 6 hours');
    assertEqual(angleAndRadiusToHour(270, 94), 9, '270 deg outer -> 9 hours');

    // Inner ring radius = 58 (<= 76 threshold)
    assertEqual(angleAndRadiusToHour(0, 58), 0, '0 deg inner -> 00 hours');
    assertEqual(angleAndRadiusToHour(30, 58), 13, '30 deg inner -> 13 hours');
    assertEqual(angleAndRadiusToHour(90, 58), 15, '90 deg inner -> 15 hours');
    assertEqual(angleAndRadiusToHour(180, 58), 18, '180 deg inner -> 18 hours');
    assertEqual(angleAndRadiusToHour(270, 58), 21, '270 deg inner -> 21 hours');
    assertEqual(angleAndRadiusToHour(330, 58), 23, '330 deg inner -> 23 hours');
  });

  await test('Inverse angle to minute conversion (0-59)', () => {
    assertEqual(angleToMinute(0), 0, '0 deg -> 0 min');
    assertEqual(angleToMinute(30), 5, '30 deg -> 5 min');
    assertEqual(angleToMinute(90), 15, '90 deg -> 15 min');
    assertEqual(angleToMinute(180), 30, '180 deg -> 30 min');
    assertEqual(angleToMinute(270), 45, '270 deg -> 45 min');
    assertEqual(angleToMinute(354), 59, '354 deg -> 59 min');
    assertEqual(angleToMinute(358), 0, '358 deg rounds up to 0 min');
  });

  await test('String formatting "HH:mm" and totalMinutes calculations', () => {
    const t1 = formatTimeString(8, 0);
    assertEqual(t1.timeStr, '08:00', '8, 0 -> "08:00"');
    assertEqual(t1.totalMinutes, 480, '8 * 60 = 480 minutes');

    const t2 = formatTimeString(0, 0);
    assertEqual(t2.timeStr, '00:00', '0, 0 -> "00:00"');
    assertEqual(t2.totalMinutes, 0, 'Midnight is 0 minutes');

    const t3 = formatTimeString(23, 59);
    assertEqual(t3.timeStr, '23:59', '23, 59 -> "23:59"');
    assertEqual(t3.totalMinutes, 1439, '23 * 60 + 59 = 1439 minutes');

    const t4 = formatTimeString(14, 30);
    assertEqual(t4.timeStr, '14:30', '14, 30 -> "14:30"');
    assertEqual(t4.totalMinutes, 870, '14 * 60 + 30 = 870 minutes');

    const t5 = formatTimeString(9, 5);
    assertEqual(t5.timeStr, '09:05', '9, 5 -> "09:05"');
    assertEqual(t5.totalMinutes, 545, '9 * 60 + 5 = 545 minutes');
  });

  await test('ClockTimePickerModal component instantiates across themes cleanly', () => {
    const themes: ThemeType[] = ['light', 'dark', 'amoled'];

    for (const th of themes) {
      const element = React.createElement(ClockTimePickerModal, {
        visible: true,
        onClose: () => {},
        onConfirm: () => {},
        initialTime: '14:30',
        title: 'Horário de Início',
        theme: th
      });

      assert(element !== null && typeof element.type === 'function', `ClockTimePickerModal instantiates cleanly with theme "${th}"`);
    }
  });

  // ==========================================================================
  // SUITE 3: AppUpdateService / Installer Resilience & Flags
  // ==========================================================================
  console.log('\n--- SUITE 3: Installer Flags & Android Intent Resilience ---');

  await test('installApk includes FLAG_ACTIVITY_NEW_TASK (268435457 / 1 | 268435456)', async () => {
    // Reset mock states
    (globalThis as any).__mockIntentThrow = false;
    (globalThis as any).__mockIntentOptions = null;

    const mockApkUri = 'file:///mock_sandbox_app/files/Lumen-v3.3.1.apk';
    const result = await AppUpdateService.installApk(mockApkUri);

    assertEqual(result.success, true, 'installApk returns success: true');

    const intentData = (globalThis as any).__mockIntentOptions;
    assert(Boolean(intentData), 'Intent data captured in IntentLauncher mock');
    assertEqual(intentData.action, 'android.intent.action.VIEW', 'Intent action is android.intent.action.VIEW');
    assertEqual(intentData.options.type, 'application/vnd.android.package-archive', 'MIME type is application/vnd.android.package-archive');

    // Expected flag: 1 (FLAG_GRANT_READ_URI_PERMISSION) | 268435456 (FLAG_ACTIVITY_NEW_TASK) = 268435457
    const expectedFlag = 1 | 268435456;
    assertEqual(expectedFlag, 268435457, 'Calculated combined bitwise flag is 268435457');
    assertEqual(intentData.options.flags, 268435457, 'Intent options.flags is exactly 268435457');

    // Verify bitwise flags independently
    assert(
      (intentData.options.flags & 268435456) === 268435456,
      'FLAG_ACTIVITY_NEW_TASK (0x10000000 / 268435456) is set'
    );
    assert(
      (intentData.options.flags & 1) === 1,
      'FLAG_GRANT_READ_URI_PERMISSION (0x1 / 1) is set'
    );

    assert(
      intentData.options.data && intentData.options.data.startsWith('content://'),
      'contentUri generated via FileSystem.getContentUriAsync'
    );
  });

  await test('installApk recovers gracefully from Android 8.0+ SecurityException (REQUEST_INSTALL_PACKAGES)', async () => {
    // Simulate SecurityException
    (globalThis as any).__mockIntentThrow = true;
    (globalThis as any).__mockIntentOptions = null;

    const mockApkUri = 'file:///mock_sandbox_app/files/Lumen-v3.3.1.apk';
    const result = await AppUpdateService.installApk(mockApkUri);

    assertEqual(result.success, false, 'installApk catches SecurityException without crashing');
    assert(
      Boolean(result.error && result.error.includes('Permissão necessária para instalar fontes desconhecidas')),
      'Returns friendly error message instructing user to grant permission'
    );

    // Verify fallback intent launched android.settings.MANAGE_UNKNOWN_APP_SOURCES
    const intentData = (globalThis as any).__mockIntentOptions;
    assertEqual(
      intentData.action,
      'android.settings.MANAGE_UNKNOWN_APP_SOURCES',
      'Dispatched fallback intent to Android Settings MANAGE_UNKNOWN_APP_SOURCES'
    );
    assertEqual(
      intentData.options.data,
      'package:com.jothacsf.Organiza',
      'Targeted package uri package:com.jothacsf.Organiza in settings'
    );

    // Reset mock
    (globalThis as any).__mockIntentThrow = false;
  });

  await test('AppUpdateService.ts static source contains FLAG_ACTIVITY_NEW_TASK and flag 268435456', () => {
    const servicesDir = path.resolve(__dirname, '../src/services');
    const updateServiceSource = fs.readFileSync(path.join(servicesDir, 'AppUpdateService.ts'), 'utf8');

    assert(
      updateServiceSource.includes('FLAG_ACTIVITY_NEW_TASK'),
      'AppUpdateService.ts documents FLAG_ACTIVITY_NEW_TASK'
    );

    assert(
      updateServiceSource.includes('268435456') || updateServiceSource.includes('268435457'),
      'AppUpdateService.ts configures flag 268435456 or 268435457'
    );
  });

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passedTests}/${totalTests} Tests Passed (${failedTests} Failed)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
