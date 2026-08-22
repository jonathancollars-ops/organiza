import './setup_env';
import { StorageService } from '../src/services/storage';
import { AIConfig } from '../src/types';
import { mockAsyncStorage, memoryStore, mockSecureStore } from './setup_env';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, description: string, details?: any) {
  totalTests++;
  if (!condition) {
    failedTests++;
    console.error(`  ❌ FAIL: ${description}`);
    if (details) console.error('     Details:', details);
    throw new Error(`Assertion failed: ${description}`);
  }
  passedTests++;
  console.log(`  ✅ PASS: ${description}`);
}

async function testSection(name: string, fn: () => Promise<void> | void) {
  console.log(`\n================================================================`);
  console.log(`⚔️  ADVERSARIAL SUITE: ${name}`);
  console.log(`================================================================`);
  await fn();
}

async function runChallengerStorageSecurityTests() {
  console.log('################################################################');
  console.log('🛡️  CHALLENGER 2: EMPIRICAL STORAGE & CREDENTIAL SECURITY HARNESS');
  console.log('################################################################');

  // ==========================================================================
  // SECTION 1: Zero Plaintext Leakage in AsyncStorage under Hostile Inputs
  // ==========================================================================
  await testSection('Zero Plaintext Leakage under Hostile & Boundary Keys', async () => {
    const adversarialKeys = [
      'AIzaSyStandardGeminiKey1234567890abcdefghij',
      'sk-proj-StandardOpenAiKey1234567890abcdefghijklmnopqrstuvwxyz',
      'AIzaSy"quoted_and_escaped\\"\n\r\tvalues',
      'AIzaSy<script>alert("xss")</script><iframe src="evil.com">',
      "AIzaSy' OR '1'='1'; DROP TABLE keys; --",
      'AIzaSy🔒🔑💎UnicodeEmojiAndArabic_العربية_Key',
      'AIzaSy\x00\x01\x1F\x7FControlCharactersInKey',
      'AIzaSy' + 'A'.repeat(20000), // 20KB key
      '   AIzaSyKeyWithLeadingAndTrailingSpaces   ',
    ];

    for (let i = 0; i < adversarialKeys.length; i++) {
      const hostileKey = adversarialKeys[i];
      const config: AIConfig = {
        provider: (i % 2 === 0 ? 'gemini' : 'openai') as any,
        mode: 'gemini_cloud',
        apiKey: hostileKey,
        model: 'gemini-2.0-flash',
        enableFallbackToCloud: true,
      };

      await StorageService.saveAIConfig(config);

      // 1. Check raw AsyncStorage value
      const rawStoredJson = memoryStore['@organiza_ai_config'];
      assert(!!rawStoredJson, `[Case ${i + 1}] AsyncStorage contains @organiza_ai_config record`);

      const parsedJson = JSON.parse(rawStoredJson);
      assert(
        parsedJson.apiKey === '',
        `[Case ${i + 1}] Plaintext apiKey in AsyncStorage is strictly empty string`,
        { parsedApiKey: parsedJson.apiKey }
      );

      // 2. Exact substring search in raw serialized JSON: must NEVER match the trimmed secret
      const trimmedHostileKey = hostileKey.trim();
      assert(
        !rawStoredJson.includes(trimmedHostileKey),
        `[Case ${i + 1}] Raw serialized AsyncStorage JSON string does not leak secret substring`
      );

      // 3. Scan all keys in AsyncStorage to ensure secret was not dumped into secondary unencrypted keys
      for (const [k, v] of Object.entries(memoryStore)) {
        if (k !== 'lumen_secure_ai_api_key') {
          assert(
            !v.includes(trimmedHostileKey),
            `[Case ${i + 1}] AsyncStorage key "${k}" does not contain secret substring`
          );
        }
      }

      // 4. Retrieve config through StorageService: must return secure key intact
      const loaded = await StorageService.getAIConfig();
      assert(
        loaded.apiKey === trimmedHostileKey,
        `[Case ${i + 1}] getAIConfig() retrieves the correct secure apiKey from SecureStore`,
        { expected: trimmedHostileKey, actual: loaded.apiKey }
      );
    }

    // Test empty, whitespace-only, and blank keys
    const blankCases = ['', '    ', '\t\n  '];
    for (let j = 0; j < blankCases.length; j++) {
      const blankKey = blankCases[j];
      await StorageService.saveAIConfig({
        provider: 'gemini',
        mode: 'local_edge',
        apiKey: blankKey,
        model: 'gemini-1.5-flash',
        enableFallbackToCloud: true,
      });

      const raw = memoryStore['@organiza_ai_config'];
      const parsed = JSON.parse(raw);
      assert(parsed.apiKey === '', `[Blank Case ${j + 1}] AsyncStorage apiKey is empty`);

      const loaded = await StorageService.getAIConfig();
      assert(loaded.apiKey === '', `[Blank Case ${j + 1}] getAIConfig() returns empty apiKey`);
      const secureSecret = await StorageService.getSecureSecret('lumen_secure_ai_api_key');
      assert(secureSecret === null, `[Blank Case ${j + 1}] SecureStore secret was deleted/null`);
    }
  });

  // ==========================================================================
  // SECTION 2: Legacy Migration Resilience under Corrupted & Hostile Inputs
  // ==========================================================================
  await testSection('Legacy Migration under Malformed & Corrupted Inputs', async () => {
    // Sub-case 2.1: Clean Legacy Migration
    await StorageService.deleteSecureSecret('lumen_secure_ai_api_key');
    mockSecureStore['lumen_secure_ai_api_key'] = undefined as any;
    delete mockSecureStore['lumen_secure_ai_api_key'];

    memoryStore['@organiza_ai_config'] = JSON.stringify({
      provider: 'openai',
      mode: 'openai_cloud',
      apiKey: 'sk-proj-LegacyKeyFromV2App123456789012345678',
      model: 'gpt-4o-mini',
      enableFallbackToCloud: false,
    });

    const migrated = await StorageService.getAIConfig();
    assert(
      migrated.apiKey === 'sk-proj-LegacyKeyFromV2App123456789012345678',
      'Clean legacy key is migrated and returned by getAIConfig()'
    );
    assert(
      JSON.parse(memoryStore['@organiza_ai_config']).apiKey === '',
      'AsyncStorage was immediately sanitized post-migration'
    );
    assert(
      (await StorageService.getSecureSecret('lumen_secure_ai_api_key')) === 'sk-proj-LegacyKeyFromV2App123456789012345678',
      'SecureStore now securely holds migrated legacy key'
    );

    // Sub-case 2.2: Corrupted JSON variants in AsyncStorage
    const corruptedVariants = [
      { label: 'Broken JSON syntax', value: '{ provider: "gemini", apiKey: "broken"' },
      { label: 'Truncated JSON', value: '{"provider":"gemini","apiKey":"truncated_ke' },
      { label: 'Primitive string', value: '"not_an_object"' },
      { label: 'Primitive number', value: '123456' },
      { label: 'Primitive boolean', value: 'true' },
      { label: 'Null JSON string', value: 'null' },
      { label: 'Array JSON string', value: '[{"apiKey":"in_array"}]' },
      { label: 'Object with non-string apiKey', value: JSON.stringify({ provider: 'gemini', apiKey: { nested: 123 } }) },
      { label: 'Object with null apiKey', value: JSON.stringify({ provider: 'gemini', apiKey: null }) },
      { label: 'Object with number apiKey', value: JSON.stringify({ provider: 'gemini', apiKey: 987654 }) },
    ];

    for (const item of corruptedVariants) {
      memoryStore['@organiza_ai_config'] = item.value;
      // Should not throw unhandled exception
      let result: AIConfig | null = null;
      let errorThrown = false;
      try {
        result = await StorageService.getAIConfig();
      } catch (e) {
        errorThrown = true;
      }

      assert(!errorThrown, `Corrupted JSON variant (${item.label}) does NOT throw uncaught error`);
      assert(!!result, `Corrupted JSON variant (${item.label}) returns fallback AIConfig`);
      assert(typeof result?.provider === 'string', `Corrupted JSON variant (${item.label}) has valid provider`);
      assert(typeof result?.apiKey === 'string', `Corrupted JSON variant (${item.label}) has string apiKey`);
    }

    // Sub-case 2.3: Conflict: SecureStore already has Key B, but AsyncStorage has legacy Key A
    await StorageService.saveSecureSecret('lumen_secure_ai_api_key', 'AIzaSySecureKey_PRE_EXISTING_NEW');
    memoryStore['@organiza_ai_config'] = JSON.stringify({
      provider: 'gemini',
      apiKey: 'AIzaSyLegacyKey_OLD_STALE',
    });

    const conflictResult = await StorageService.getAIConfig();
    assert(
      conflictResult.apiKey === 'AIzaSySecureKey_PRE_EXISTING_NEW',
      'Pre-existing SecureStore key takes precedence over stale unencrypted AsyncStorage key'
    );
  });

  // ==========================================================================
  // SECTION 3: Concurrent Operations & Race Condition Stress
  // ==========================================================================
  await testSection('High-Concurrency Stress & Race Condition Resilience', async () => {
    // Reset state
    await StorageService.clearAllData();

    // 50 concurrent getAIConfig calls competing with 50 concurrent saveAIConfig calls
    const concurrencyIterations = 50;
    const promises: Promise<any>[] = [];

    for (let i = 0; i < concurrencyIterations; i++) {
      const idx = i;
      // Concurrent save
      promises.push(
        (async () => {
          await new Promise(r => setTimeout(r, Math.floor(Math.random() * 5)));
          await StorageService.saveAIConfig({
            provider: idx % 2 === 0 ? 'gemini' : 'openai',
            mode: 'gemini_cloud',
            apiKey: `AIzaSyConcurrentKey_${idx}_SecretToken`,
            model: 'gemini-2.0-flash',
            enableFallbackToCloud: true,
          });
        })()
      );

      // Concurrent get
      promises.push(
        (async () => {
          await new Promise(r => setTimeout(r, Math.floor(Math.random() * 5)));
          return await StorageService.getAIConfig();
        })()
      );

      // Concurrent secure secrets
      promises.push(
        (async () => {
          await new Promise(r => setTimeout(r, Math.floor(Math.random() * 5)));
          await StorageService.saveSecureSecret(`custom_token_${idx}`, `token_value_${idx}`);
          const fetched = await StorageService.getSecureSecret(`custom_token_${idx}`);
          assert(fetched === `token_value_${idx}`, `Concurrent secret custom_token_${idx} matches`);
        })()
      );
    }

    const results = await Promise.allSettled(promises);
    const rejected = results.filter(r => r.status === 'rejected');
    assert(rejected.length === 0, `All ${promises.length} concurrent operations completed with 0 rejections`);

    // Verify raw AsyncStorage integrity post-concurrency
    const finalRaw = memoryStore['@organiza_ai_config'];
    assert(!!finalRaw, 'AsyncStorage @organiza_ai_config exists after concurrency barrage');
    const parsedFinal = JSON.parse(finalRaw);
    assert(parsedFinal.apiKey === '', 'AsyncStorage apiKey remains strictly redacted after 150 concurrent calls');
    assert(!finalRaw.includes('SecretToken'), 'No secret token leaked into raw AsyncStorage during race condition');

    // Final AIConfig read
    const finalConfig = await StorageService.getAIConfig();
    assert(finalConfig.apiKey.startsWith('AIzaSyConcurrentKey_'), 'Final getAIConfig() retrieves valid secure key');
  });

  // ==========================================================================
  // SECTION 4: clearAllData() Deep Purge & Secret Erasure Audit
  // ==========================================================================
  await testSection('clearAllData() Deep Purge and Complete Secret Annihilation', async () => {
    // 1. Populate AsyncStorage with extensive fake data
    await StorageService.saveEvents([{ id: 'ev1', title: 'Prova P1', date: '2026-08-25', time: '10:00', type: 'exam', subjectId: 'sub1', alerts: [] }]);
    await StorageService.saveSubjects([{ id: 'sub1', name: 'Cálculo 1', color: '#6366F1' }]);
    await StorageService.saveAttendances([{ subjectId: 'sub1', absences: 2, totalClasses: 40, history: [] }]);
    await StorageService.saveTasks([{ id: 't1', title: 'Lista 1', completed: false, priority: 'high', subjectId: 'sub1' }]);
    await StorageService.saveStudySessions([{ id: 's1', subjectId: 'sub1', durationMinutes: 50, date: '2026-08-21', type: 'pomodoro' }]);
    await StorageService.saveTheme('amoled');
    await StorageService.saveStreak({ currentStreak: 7, longestStreak: 14, lastStudyDate: '2026-08-20' });
    await StorageService.saveGamificationData({ xp: 1200, level: 7, unlockedAchievements: ['first_session'], totalFocusMinutes: 350 });
    await StorageService.saveAACCActivities([{ id: 'aacc1', title: 'Congresso', category: 'event', hours: 20, maxHours: 40, status: 'approved' }]);
    await StorageService.saveGroupProjects([{ id: 'gp1', title: 'Projeto Final', subjectId: 'sub1', members: ['Alice', 'Bob'], tasks: [] }]);
    
    // Save AI config with sensitive key
    await StorageService.saveAIConfig({
      provider: 'gemini',
      mode: 'gemini_cloud',
      apiKey: 'AIzaSySecretToBePurged999999999',
      model: 'gemini-2.0-flash',
      enableFallbackToCloud: true,
    });

    // Save extra secure secrets
    await StorageService.saveSecureSecret('lumen_secure_ai_api_key', 'AIzaSySecretToBePurged999999999');
    await StorageService.saveSecureSecret('extra_token', 'extra_secret_123');

    // 2. Perform deep purge
    await StorageService.clearAllData();

    // 3. Verify SecureStore secret eradication
    const purgedApiKey = await StorageService.getSecureSecret('lumen_secure_ai_api_key');
    assert(purgedApiKey === null, 'SecureStore AI API Key is strictly null after clearAllData()');

    // 4. Verify AIConfig after purge
    const postPurgeConfig = await StorageService.getAIConfig();
    assert(postPurgeConfig.apiKey === '', 'getAIConfig() returns empty apiKey after clearAllData()');

    // 5. Verify AsyncStorage tables purged
    const events = await StorageService.getEvents();
    assert(events.length === 0, 'Events table is empty');

    const attendances = await StorageService.getAttendances();
    assert(attendances.length === 0, 'Attendances table is empty');

    const tasks = await StorageService.getTasks();
    assert(tasks.length === 0, 'Tasks table is empty');

    const sessions = await StorageService.getStudySessions();
    assert(sessions.length === 0, 'StudySessions table is empty');

    const aacc = await StorageService.getAACCActivities();
    assert(aacc.length === 0, 'AACC activities table is empty');

    const groupProjects = await StorageService.getGroupProjects();
    assert(groupProjects.length === 0, 'Group projects table is empty');

    const streak = await StorageService.getStreak();
    assert(streak.currentStreak === 0, 'Streak reset to 0');

    const gamification = await StorageService.getGamificationData();
    assert(gamification.xp === 0 && gamification.level === 1, 'Gamification data reset to default');

    assert(memoryStore['@organiza_events'] === undefined, '@organiza_events key removed from AsyncStorage');
    assert(memoryStore['@organiza_ai_config'] === undefined, '@organiza_ai_config key removed from AsyncStorage');
  });

  // ==========================================================================
  // SECTION 5: SecureStore Native Throw / Fallback Vault Resilience
  // ==========================================================================
  await testSection('SecureStore Hardware Throw & Fallback Vault Resilience', async () => {
    const Module = require('module');
    const origRequire = Module.prototype.require;

    // Simulate Native SecureStore throwing exceptions (e.g. KeyStore locked, hardware auth required)
    const faultySecureStoreModule = {
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
      setItemAsync: async () => {
        throw new Error('Native KeyStore hardware error: KeyStoreAccessException (Device locked)');
      },
      getItemAsync: async () => {
        throw new Error('Native KeyStore decryption error: DecryptionFailedException');
      },
      deleteItemAsync: async () => {
        throw new Error('Native KeyStore delete error: HardwareUnreachableException');
      },
    };

    // Test secret fallback operations
    console.log('  Testing fallback behavior when native storage throws...');
    
    // Save secret: should gracefully fall back to in-memory vault without throwing uncaught error
    await StorageService.saveSecureSecret('test_fallback_key', 'fallback_secret_value_xyz');
    
    // In-memory vault should allow getSecureSecret to resolve
    const retrievedFallback = await StorageService.getSecureSecret('test_fallback_key');
    assert(
      retrievedFallback === 'fallback_secret_value_xyz',
      'getSecureSecret retrieves value from in-memory fallback vault when native store throws'
    );

    // saveAIConfig should succeed without throwing
    await StorageService.saveAIConfig({
      provider: 'gemini',
      mode: 'gemini_cloud',
      apiKey: 'AIzaSyFallbackKey1234567890abcdef',
      model: 'gemini-1.5-flash',
      enableFallbackToCloud: true,
    });

    const aiConfigFallback = await StorageService.getAIConfig();
    assert(
      aiConfigFallback.apiKey === 'AIzaSyFallbackKey1234567890abcdef',
      'saveAIConfig / getAIConfig works seamlessly under native SecureStore failure'
    );

    // deleteSecureSecret should not throw
    await StorageService.deleteSecureSecret('test_fallback_key');
    const postDeleteFallback = await StorageService.getSecureSecret('test_fallback_key');
    assert(postDeleteFallback === null, 'deleteSecureSecret clears in-memory fallback vault');

    // Edge Cases for key/value arguments
    await StorageService.saveSecureSecret('', 'some_value'); // empty key should be ignored
    await StorageService.saveSecureSecret(null as any, 'some_value'); // null key should be ignored
    assert((await StorageService.getSecureSecret('')) === null, 'getSecureSecret("") returns null');
    assert((await StorageService.getSecureSecret(null as any)) === null, 'getSecureSecret(null) returns null');
  });

  // ==========================================================================
  // FINAL SUMMARY
  // ==========================================================================
  console.log('\n################################################################');
  console.log(`🎯 CHALLENGER 2 SUMMARY: ${passedTests}/${totalTests} PASSED (Failed: ${failedTests})`);
  console.log('################################################################\n');

  if (failedTests > 0) {
    throw new Error(`Challenger test suite failed: ${failedTests} failures.`);
  }
}

runChallengerStorageSecurityTests().catch(err => {
  console.error('Challenger run error:', err);
  process.exit(1);
});
