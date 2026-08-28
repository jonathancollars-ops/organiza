import './setup_env';
import { formatNotificationTimeNotice, NotificationService } from '../src/services/notifications';
import { AppUpdateService } from '../src/services/AppUpdateService';
import { mockNotifications, mockAsyncStorage } from './setup_env';
import { AppEvent } from '../src/types';
import { APP_VERSION } from '../src/utils/version';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
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

async function test(name: string, fn: () => Promise<void> | void) {
  console.log(`\n--- Test: ${name} ---`);
  await fn();
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('🔔 NOTIFICATIONS TIME FORMATTER, VIBRATION & UPDATE TEST SUITE');
  console.log('================================================================');

  // ==========================================================================
  // SUITE 1: formatNotificationTimeNotice Humanized Time Formatting
  // ==========================================================================
  console.log('\n--- SUITE 1: formatNotificationTimeNotice Unit Tests ---');

  await test('minutesBefore = 0 ➔ "Começando agora!"', () => {
    const result = formatNotificationTimeNotice(0, '08:00');
    assert(result === 'Começando agora!', '0 minutesBefore returns "Começando agora!"');
  });

  await test('minutesBefore = -5 (negative) ➔ "Começando agora!"', () => {
    const result = formatNotificationTimeNotice(-5, '08:00');
    assert(result === 'Começando agora!', 'Negative minutesBefore returns "Começando agora!"');
  });

  await test('minutesBefore = 15 ➔ "Começa em 15 minutos (08:00)"', () => {
    const result = formatNotificationTimeNotice(15, '08:00');
    assert(result === 'Começa em 15 minutos (08:00)', '15 minutesBefore returns "Começa em 15 minutos (08:00)"');
  });

  await test('minutesBefore = 30 ➔ "Começa em 30 minutos (14:30)"', () => {
    const result = formatNotificationTimeNotice(30, '14:30');
    assert(result === 'Começa em 30 minutos (14:30)', '30 minutesBefore returns "Começa em 30 minutos (14:30)"');
  });

  await test('minutesBefore = 60 ➔ "Começa em 1 hora (08:00)"', () => {
    const result = formatNotificationTimeNotice(60, '08:00');
    assert(result === 'Começa em 1 hora (08:00)', '60 minutesBefore returns "Começa em 1 hora (08:00)"');
  });

  await test('minutesBefore = 90 ➔ "Começa em 1h 30min (08:00)"', () => {
    const result = formatNotificationTimeNotice(90, '08:00');
    assert(result === 'Começa em 1h 30min (08:00)', '90 minutesBefore returns "Começa em 1h 30min (08:00)"');
  });

  await test('minutesBefore = 120 ➔ "Começa em 2 horas (08:00)"', () => {
    const result = formatNotificationTimeNotice(120, '08:00');
    assert(result === 'Começa em 2 horas (08:00)', '120 minutesBefore returns "Começa em 2 horas (08:00)"');
  });

  await test('minutesBefore = 180 ➔ "Começa em 3 horas (10:00)"', () => {
    const result = formatNotificationTimeNotice(180, '10:00');
    assert(result === 'Começa em 3 horas (10:00)', '180 minutesBefore returns "Começa em 3 horas (10:00)"');
  });

  await test('minutesBefore = 1440 ➔ "Começa amanhã às 08:00"', () => {
    const result = formatNotificationTimeNotice(1440, '08:00');
    assert(result === 'Começa amanhã às 08:00', '1440 minutesBefore (24h) returns "Começa amanhã às 08:00"');
  });

  await test('minutesBefore = 2880 ➔ "Começa em 2 dias (08:00)"', () => {
    const result = formatNotificationTimeNotice(2880, '08:00');
    assert(result === 'Começa em 2 dias (08:00)', '2880 minutesBefore (48h) returns "Começa em 2 dias (08:00)"');
  });

  await test('minutesBefore = 4320 ➔ "Começa em 3 dias (08:00)"', () => {
    const result = formatNotificationTimeNotice(4320, '08:00');
    assert(result === 'Começa em 3 dias (08:00)', '4320 minutesBefore (72h) returns "Começa em 3 dias (08:00)"');
  });

  await test('minutesBefore = 10080 ➔ "Começa em 1 semana (08:00)"', () => {
    const result = formatNotificationTimeNotice(10080, '08:00');
    assert(result === 'Começa em 1 semana (08:00)', '10080 minutesBefore (7 days) returns "Começa em 1 semana (08:00)"');
  });

  // ==========================================================================
  // SUITE 2: Notification Channel & Vibration Pattern Verification
  // ==========================================================================
  console.log('\n--- SUITE 2: Notification Channel & Vibration Pattern ---');

  await test('NotificationService.requestPermissions configures Android vibration pattern and channel', async () => {
    let capturedChannelId: string | null = null;
    let capturedChannelConfig: any = null;

    const origSetChannel = mockNotifications.setNotificationChannelAsync;
    mockNotifications.setNotificationChannelAsync = async (id: string, config: any) => {
      capturedChannelId = id;
      capturedChannelConfig = config;
    };

    const origPlatform = (require('react-native').Platform as any).OS;
    (require('react-native').Platform as any).OS = 'android';

    try {
      const granted = await NotificationService.requestPermissions();
      assert(granted === true, 'requestPermissions returns true on granted permission');
      assert(capturedChannelId === 'default', 'Channel ID is configured as "default"');
      assert(capturedChannelConfig !== null, 'Channel configuration is passed');
      assert(capturedChannelConfig.name === 'Lumen Acadêmico', 'Channel name is "Lumen Acadêmico"');
      assert(capturedChannelConfig.enableVibrate === true, 'Channel has enableVibrate: true');
      assert(Array.isArray(capturedChannelConfig.vibrationPattern), 'Channel vibrationPattern is an array');
      assert(
        JSON.stringify(capturedChannelConfig.vibrationPattern) === JSON.stringify([0, 250, 250, 250]),
        'Channel vibrationPattern matches [0, 250, 250, 250]'
      );
      assert(capturedChannelConfig.lightColor === '#00FFAA', 'Channel lightColor is #00FFAA (Lumen mint)');
    } finally {
      (require('react-native').Platform as any).OS = origPlatform;
      mockNotifications.setNotificationChannelAsync = origSetChannel;
    }
  });

  await test('scheduleEventNotifications schedules payload with title, vibration pattern and sound', async () => {
    const scheduledPayloads: any[] = [];
    const origSchedule = mockNotifications.scheduleNotificationAsync;
    mockNotifications.scheduleNotificationAsync = async (payload: any) => {
      scheduledPayloads.push(payload);
      return `notif_${Date.now()}`;
    };

    const futureDate = new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];
    const testEvent: AppEvent = {
      id: 'evt_test_exam_123',
      title: 'P1 Cálculo Numérico',
      description: 'Sala 102 - Levar calculadora',
      category: 'Provas/Trabalhos',
      date: `${futureDate}T08:00:00.000Z`,
      startTime: '08:00',
      endTime: '10:00',
      alerts: [15, 60, 1440],
      isNotified: true,
      recurrence: 'none'
    };

    try {
      await NotificationService.scheduleEventNotifications(testEvent);

      assert(scheduledPayloads.length === 3, 'Scheduled 3 notifications for 3 alerts');

      // Check first payload (15 min alert)
      const p15 = scheduledPayloads[0];
      assert(p15.content.title.includes('📝 P1 Cálculo Numérico'), 'Title contains exam emoji 📝 and title');
      assert(p15.content.sound === true, 'Payload specifies sound: true');
      assert(Array.isArray(p15.content.vibrate), 'Payload contains vibrate array');
      assert(
        JSON.stringify(p15.content.vibrate) === JSON.stringify([0, 250, 250, 250]),
        'Vibration pattern is strictly [0, 250, 250, 250]'
      );
      assert(p15.content.body.includes('Começa em 15 minutos (08:00)'), 'Body includes humanized time notice');
      assert(p15.content.body.includes('Sala 102 - Levar calculadora'), 'Body includes event description');
      assert(p15.content.data?.eventId === 'evt_test_exam_123', 'Payload data contains matching eventId');
      assert(p15.trigger.channelId === 'default', 'Trigger targets "default" notification channel');
    } finally {
      mockNotifications.scheduleNotificationAsync = origSchedule;
    }
  });

  await test('scheduleEventNotifications assigns appropriate emojis for different categories', async () => {
    const scheduledPayloads: any[] = [];
    const origSchedule = mockNotifications.scheduleNotificationAsync;
    mockNotifications.scheduleNotificationAsync = async (payload: any) => {
      scheduledPayloads.push(payload);
      return `notif_${Date.now()}`;
    };

    const futureDate = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];

    const gymEvent: AppEvent = {
      id: 'evt_gym_1',
      title: 'Treino de Pernas',
      category: 'Saúde/Academia',
      date: `${futureDate}T07:00:00.000Z`,
      startTime: '07:00',
      alerts: [15],
      isNotified: true,
      recurrence: 'none'
    };

    const coffeeEvent: AppEvent = {
      id: 'evt_coffee_1',
      title: 'Café com amigos',
      category: 'Lazer',
      date: `${futureDate}T16:00:00.000Z`,
      startTime: '16:00',
      alerts: [15],
      isNotified: true,
      recurrence: 'none'
    };

    try {
      await NotificationService.scheduleEventNotifications(gymEvent);
      await NotificationService.scheduleEventNotifications(coffeeEvent);

      assert(scheduledPayloads.length === 2, 'Scheduled 2 category notifications');
      assert(scheduledPayloads[0].content.title.startsWith('💪'), 'Health/Gym event uses 💪 emoji');
      assert(scheduledPayloads[1].content.title.startsWith('☕'), 'Leisure event uses ☕ emoji');
    } finally {
      mockNotifications.scheduleNotificationAsync = origSchedule;
    }
  });

  // ==========================================================================
  // SUITE 3: AppUpdateService Update Checks & Download Flow
  // ==========================================================================
  console.log('\n--- SUITE 3: AppUpdateService Update Checks & Download Flow ---');

  await test('checkForUpdates detects newer version with .apk asset', async () => {
    const origFetch = (globalThis as any).fetch;
    try {
      (globalThis as any).fetch = async () => ({
        ok: true,
        json: async () => ({
          tag_name: 'v3.9.0',
          name: 'Lumen v3.9.0 - Grande Atualização',
          body: 'Novos recursos de notificações e performance.',
          html_url: 'https://github.com/jonathancollars-ops/organiza/releases/tag/v3.9.0',
          assets: [
            {
              name: 'lumen-v3.9.0-release.apk',
              browser_download_url: 'https://github.com/jonathancollars-ops/organiza/releases/download/v3.9.0/lumen.apk'
            }
          ],
          published_at: '2026-08-28T12:00:00Z'
        })
      });

      const updateInfo = await AppUpdateService.checkForUpdates(true);
      assert(updateInfo !== null, 'checkForUpdates returned valid object');
      assert(updateInfo?.hasUpdate === true, 'hasUpdate is true');
      assert(updateInfo?.latestVersion === '3.9.0', 'latestVersion is 3.9.0');
      assert(updateInfo?.currentVersion === APP_VERSION, `currentVersion matches app version ${APP_VERSION}`);
      assert(
        updateInfo?.downloadUrl === 'https://github.com/jonathancollars-ops/organiza/releases/download/v3.9.0/lumen.apk',
        'downloadUrl correctly resolved to the .apk asset'
      );
      assert(updateInfo?.releaseName === 'Lumen v3.9.0 - Grande Atualização', 'releaseName matches payload');
    } finally {
      (globalThis as any).fetch = origFetch;
    }
  });

  await test('checkForUpdates detects when current version is up to date (no update)', async () => {
    const origFetch = (globalThis as any).fetch;
    try {
      (globalThis as any).fetch = async () => ({
        ok: true,
        json: async () => ({
          tag_name: 'v1.0.0', // Older version
          name: 'Lumen v1.0.0',
          body: 'Versão antiga.',
          html_url: 'https://github.com/jonathancollars-ops/organiza/releases/tag/v1.0.0',
          assets: []
        })
      });

      const updateInfo = await AppUpdateService.checkForUpdates(true);
      assert(updateInfo !== null, 'checkForUpdates returned valid object');
      assert(updateInfo?.hasUpdate === false, 'hasUpdate is false when version is older/equal');
      assert(updateInfo?.latestVersion === '1.0.0', 'latestVersion is 1.0.0');
      assert(updateInfo?.currentVersion === APP_VERSION, `currentVersion is ${APP_VERSION}`);
    } finally {
      (globalThis as any).fetch = origFetch;
    }
  });

  await test('checkForUpdates falls back to html_url when release has no .apk asset', async () => {
    const origFetch = (globalThis as any).fetch;
    try {
      (globalThis as any).fetch = async () => ({
        ok: true,
        json: async () => ({
          tag_name: 'v4.0.0',
          name: 'Lumen v4.0.0 Web Release',
          body: 'Notas da release.',
          html_url: 'https://github.com/jonathancollars-ops/organiza/releases/tag/v4.0.0',
          assets: [
            {
              name: 'source_code.tar.gz',
              browser_download_url: 'https://github.com/jonathancollars-ops/organiza/archive/v4.0.0.tar.gz'
            }
          ]
        })
      });

      const updateInfo = await AppUpdateService.checkForUpdates(true);
      assert(updateInfo !== null, 'checkForUpdates returned valid object');
      assert(updateInfo?.hasUpdate === true, 'hasUpdate is true');
      assert(
        updateInfo?.downloadUrl === 'https://github.com/jonathancollars-ops/organiza/releases/tag/v4.0.0',
        'downloadUrl falls back to html_url when no .apk asset is found'
      );
    } finally {
      (globalThis as any).fetch = origFetch;
    }
  });

  await test('AppUpdateService.ignoreVersion and throttling behaviors', async () => {
    const origFetch = (globalThis as any).fetch;
    try {
      (globalThis as any).fetch = async () => ({
        ok: true,
        json: async () => ({
          tag_name: 'v3.9.5',
          name: 'Lumen v3.9.5',
          body: 'Notas.',
          html_url: 'https://github.com/jonathancollars-ops/organiza/releases/tag/v3.9.5',
          assets: []
        })
      });

      // Ignore version 3.9.5
      await AppUpdateService.ignoreVersion('3.9.5');

      // Unforced check should return null because version is ignored
      const ignoredCheck = await AppUpdateService.checkForUpdates(false);
      assert(ignoredCheck === null, 'Unforced check returns null when version is ignored');

      // Forced check should bypass ignoredVersion
      const forcedCheck = await AppUpdateService.checkForUpdates(true);
      assert(forcedCheck !== null && forcedCheck.hasUpdate === true, 'Forced check bypasses ignoredVersion filter');
    } finally {
      (globalThis as any).fetch = origFetch;
    }
  });

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passedTests}/${totalTests} Tests Passed (${failedTests} Failed)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error in tests:', err);
  process.exit(1);
});
