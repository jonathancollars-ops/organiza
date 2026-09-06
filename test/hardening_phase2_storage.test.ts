import './setup_env';
import * as fs from 'fs';
import * as path from 'path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  StorageService,
  safeSetItem,
  isDiskQuotaError,
  validateBackupSchema,
  addStorageErrorListener,
  StorageErrorEvent
} from '../src/services/storage';
import { AppEvent, Subject, AttendanceRecord, StudyStreak, BackupData } from '../src/types';

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

async function runStorageHardeningTestSuite() {
  console.log('================================================================');
  console.log('PHASE 2: STORAGE HARDENING, DISK QUOTA & BACKUP SCHEMA VALIDATION');
  console.log('================================================================\n');

  // ── 1. isDiskQuotaError Classification ──
  console.log('--- 1. Disk Quota Error Detection ---');
  assert(isDiskQuotaError(new Error('QuotaExceededError: storage limit reached')), 'Detects QuotaExceededError');
  assert(isDiskQuotaError(new Error('database or disk is full (code 13 SQLITE_FULL)')), 'Detects SQLITE_FULL');
  assert(isDiskQuotaError(new Error('insufficient storage on device')), 'Detects insufficient storage');
  assert(isDiskQuotaError(new Error('No space left on device')), 'Detects no space left on device');
  assert(isDiskQuotaError('Quota exceeded in SQLite store'), 'Detects string quota error');
  assert(!isDiskQuotaError(new Error('Network request failed')), 'Ignores unrelated network error');
  assert(!isDiskQuotaError(new Error('SyntaxError: Unexpected token')), 'Ignores syntax parse error');
  assert(!isDiskQuotaError(null), 'Handles null error safely');
  assert(!isDiskQuotaError(undefined), 'Handles undefined error safely');

  // ── 2. safeSetItem Quota & Rejection Resilience ──
  console.log('\n--- 2. safeSetItem Quota & Error Handling ---');
  
  // Normal write succeeds
  const normalWrite = await safeSetItem('@test_normal', JSON.stringify({ ok: true }));
  assert(normalWrite === true, 'safeSetItem succeeds under normal conditions');

  // Invalid parameters
  const invalidKey = await safeSetItem('', 'val');
  assert(invalidKey === false, 'safeSetItem rejects empty key safely');

  // Intercept and simulate disk quota rejection
  const { mockAsyncStorage } = await import('./setup_env');
  const originalSetItem = mockAsyncStorage.setItem;
  const capturedEvents: StorageErrorEvent[] = [];
  const unsubscribe = addStorageErrorListener(evt => {
    capturedEvents.push(evt);
  });

  const quotaError = new Error('QuotaExceededError: DOMException 22 disk is full');
  const throwingSetItem = async () => {
    throw quotaError;
  };

  mockAsyncStorage.setItem = throwingSetItem;
  if ((AsyncStorage as unknown as Record<string, unknown>)?.setItem) {
    (AsyncStorage as unknown as { setItem: unknown }).setItem = throwingSetItem;
  }
  if ((AsyncStorage as unknown as { default?: { setItem: unknown } })?.default?.setItem) {
    (AsyncStorage as unknown as { default: { setItem: unknown } }).default.setItem = throwingSetItem;
  }

  const quotaWriteResult = await safeSetItem('@test_quota', 'large_data');
  assert(quotaWriteResult === false, 'safeSetItem returns false when disk quota is exceeded');
  assert(capturedEvents.length > 0, 'Storage error listener notified on failure');
  const lastEvent = capturedEvents[capturedEvents.length - 1];
  assert(Boolean(lastEvent && lastEvent.isQuota === true), 'Error event correctly classified as isQuota: true');
  assert(Boolean(lastEvent && lastEvent.key === '@test_quota'), 'Error event contains affected storage key');

  // ── 3. StorageService Write Methods Disk Quota Resilience ──
  console.log('\n--- 3. StorageService Write Methods (saveEvents, saveSubjects, saveAttendances, saveStreak) ---');
  
  // Under simulated disk quota failure, write calls must resolve gracefully without unhandled rejections:
  let saveEventsFailed = false;
  try {
    const res = await StorageService.saveEvents([
      {
        id: 'evt_1',
        title: 'Aula de Álgebra',
        category: 'Faculdade/Aulas',
        date: '2026-09-06',
        startTime: '08:00',
        endTime: '10:00',
        recurrence: 'weekly',
        alerts: [15],
        isCompleted: false
      }
    ]);
    assert(res === false, 'saveEvents returns false under disk quota failure without throwing');
  } catch (err) {
    saveEventsFailed = true;
  }
  assert(!saveEventsFailed, 'saveEvents did not throw unhandled exception on disk full');

  let saveSubjectsFailed = false;
  try {
    const res = await StorageService.saveSubjects([
      {
        id: 'subj_1',
        name: 'Cálculo 1',
        color: '#3B82F6',
        isArchived: false
      }
    ]);
    assert(res === false, 'saveSubjects returns false under disk quota failure without throwing');
  } catch (err) {
    saveSubjectsFailed = true;
  }
  assert(!saveSubjectsFailed, 'saveSubjects did not throw unhandled exception on disk full');

  let saveAttendancesFailed = false;
  try {
    const res = await StorageService.saveAttendances([
      {
        id: 'att_1',
        subjectId: 'subj_1',
        date: '2026-09-06',
        status: 'present'
      }
    ]);
    assert(res === false, 'saveAttendances returns false under disk quota failure without throwing');
  } catch (err) {
    saveAttendancesFailed = true;
  }
  assert(!saveAttendancesFailed, 'saveAttendances did not throw unhandled exception on disk full');

  let saveStreakFailed = false;
  try {
    const res = await StorageService.saveStreak({
      currentStreak: 5,
      longestStreak: 10,
      lastStudyDate: '2026-09-06',
      totalStudyDays: 20
    });
    assert(res === false, 'saveStreak returns false under disk quota failure without throwing');
  } catch (err) {
    saveStreakFailed = true;
  }
  assert(!saveStreakFailed, 'saveStreak did not throw unhandled exception on disk full');

  // Restore AsyncStorage.setItem
  mockAsyncStorage.setItem = originalSetItem;
  if ((AsyncStorage as unknown as Record<string, unknown>)?.setItem) {
    (AsyncStorage as unknown as { setItem: unknown }).setItem = originalSetItem;
  }
  if ((AsyncStorage as unknown as { default?: { setItem: unknown } })?.default?.setItem) {
    (AsyncStorage as unknown as { default: { setItem: unknown } }).default.setItem = originalSetItem;
  }
  unsubscribe();

  // ── 4. validateBackupSchema Boundary Tests ──
  console.log('\n--- 4. validateBackupSchema Validation ---');
  
  assert(!validateBackupSchema(null).isValid, 'Rejects null input');
  assert(!validateBackupSchema(undefined).isValid, 'Rejects undefined input');
  assert(!validateBackupSchema('string').isValid, 'Rejects string input');
  assert(!validateBackupSchema(12345).isValid, 'Rejects number input');
  assert(!validateBackupSchema([]).isValid, 'Rejects array input');

  // Missing version or timestamp
  const noVersion = validateBackupSchema({ timestamp: '2026-09-06T00:00:00Z', events: [] });
  assert(!noVersion.isValid, 'Rejects payload with missing version');

  const invalidVersion = validateBackupSchema({ version: -1, timestamp: '2026-09-06T00:00:00Z', events: [] });
  assert(!invalidVersion.isValid, 'Rejects payload with negative version');

  const noTimestamp = validateBackupSchema({ version: 2, timestamp: '', events: [] });
  assert(!noTimestamp.isValid, 'Rejects payload with empty timestamp');

  // Corrupted collections
  const corruptedEvents = validateBackupSchema({
    version: 2,
    timestamp: '2026-09-06T00:00:00Z',
    events: [{ notAnEvent: true }]
  });
  assert(!corruptedEvents.isValid, 'Rejects events missing id, title, or date');

  const corruptedSubjects = validateBackupSchema({
    version: 2,
    timestamp: '2026-09-06T00:00:00Z',
    subjects: [{ id: '1' }] // missing name
  });
  assert(!corruptedSubjects.isValid, 'Rejects subjects missing name');

  const corruptedAttendances = validateBackupSchema({
    version: 2,
    timestamp: '2026-09-06T00:00:00Z',
    attendances: [{ id: 'att_1' }] // missing date
  });
  assert(!corruptedAttendances.isValid, 'Rejects attendances missing date');

  const invalidSettingsType = validateBackupSchema({
    version: 2,
    timestamp: '2026-09-06T00:00:00Z',
    settings: 'not-an-object'
  });
  assert(!invalidSettingsType.isValid, 'Rejects non-object settings');

  // Valid complete backup
  const validBackup: BackupData = {
    version: 2,
    timestamp: '2026-09-06T03:00:00.000Z',
    events: [
      {
        id: 'evt_valid_1',
        title: 'Prova de Cálculo',
        category: 'Provas/Trabalhos',
        date: '2026-09-15',
        startTime: '10:00',
        endTime: '12:00',
        recurrence: 'none',
        alerts: [1440],
        isCompleted: false
      }
    ],
    subjects: [
      {
        id: 'subj_valid_1',
        name: 'Física Geral',
        color: '#10B981',
        isArchived: false
      }
    ],
    attendances: [
      {
        id: 'att_valid_1',
        subjectId: 'subj_valid_1',
        date: '2026-09-06',
        status: 'present'
      }
    ],
    tasks: [
      {
        id: 'task_valid_1',
        title: 'Lista 3 de Exercícios',
        isCompleted: false
      }
    ],
    studySessions: [
      {
        id: 'sess_valid_1',
        subjectId: 'subj_valid_1',
        durationMs: 1800000,
        date: '2026-09-06'
      }
    ],
    semesters: [
      {
        id: '2026.2',
        name: '2026/2',
        isCurrent: true
      }
    ],
    settings: {
      theme: 'amoled',
      fullscreen: true,
      pomodoroFocusMin: 30
    },
    streak: {
      currentStreak: 3,
      longestStreak: 7,
      lastStudyDate: '2026-09-06',
      totalStudyDays: 14
    }
  };

  const validResult = validateBackupSchema(validBackup);
  assert(validResult.isValid === true, 'Valid backup passes schema validation');
  assert(validResult.errors.length === 0, 'Valid backup produces 0 validation errors');
  assert(validResult.data?.events.length === 1, 'Sanitized backup preserves events');
  assert(validResult.data?.subjects.length === 1, 'Sanitized backup preserves subjects');

  // ── 5. importBackup and exportBackup Integration ──
  console.log('\n--- 5. importBackup & exportBackup End-to-End ---');
  
  // importBackup rejects malformed payload with descriptive error
  let importThrew = false;
  try {
    await StorageService.importBackup({ corrupt: true });
  } catch (err: unknown) {
    importThrew = true;
    const msg = err instanceof Error ? err.message : String(err);
    assert(msg.includes('Formato de backup inválido'), 'importBackup throws descriptive error message');
  }
  assert(importThrew, 'importBackup rejected malformed schema before touching storage');

  // importBackup restores valid payload successfully
  const restoreSuccess = await StorageService.importBackup(validBackup);
  assert(restoreSuccess === true, 'importBackup restored valid backup successfully');

  // Verify that data was actually persisted
  const restoredEvents = await StorageService.getEvents();
  assert(restoredEvents.some(e => e.id === 'evt_valid_1'), 'Restored event retrieved from storage');

  const restoredSubjects = await StorageService.getSubjects();
  assert(restoredSubjects.some(s => s.id === 'subj_valid_1'), 'Restored subject retrieved from storage');

  const restoredStreak = await StorageService.getStreak();
  assert(restoredStreak.currentStreak === 3, 'Restored streak currentStreak retrieved from storage');

  // exportBackup produces a valid backup conforming to validateBackupSchema
  const exported = await StorageService.exportBackup();
  assert(exported.version === 2, 'exportBackup outputs version 2');
  assert(typeof exported.timestamp === 'string' && exported.timestamp.length > 0, 'exportBackup outputs valid timestamp');
  const exportValidation = validateBackupSchema(exported);
  assert(exportValidation.isValid === true, 'exportBackup output passes validateBackupSchema');

  // ── 6. Zero 'any' Static Audit ──
  console.log('\n--- 6. Zero "any" Static Audit in storage.ts ---');
  const storageFilePath = path.resolve(__dirname, '../src/services/storage.ts');
  const storageFileContent = fs.readFileSync(storageFilePath, 'utf8');

  // Check for ": any" and "as any"
  const hasColonAny = /(:\s*any\b)/.test(storageFileContent);
  const hasAsAny = /(\bas\s+any\b)/.test(storageFileContent);
  assert(!hasColonAny, 'No ": any" found in src/services/storage.ts');
  assert(!hasAsAny, 'No "as any" found in src/services/storage.ts');

  // Check for re-export in StorageService.ts
  const serviceFilePath = path.resolve(__dirname, '../src/services/StorageService.ts');
  assert(fs.existsSync(serviceFilePath), 'src/services/StorageService.ts exists as import bridge');

  console.log('\n================================================================');
  console.log(`PHASE 2 STORAGE TESTS SUMMARY: ${passed}/${passed + failed} Passed (${failed} Failed)`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStorageHardeningTestSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
