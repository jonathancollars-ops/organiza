import './setup_env';
import * as fs from 'fs';
import * as path from 'path';
import { StorageService, _resetInMemorySecureVaultForTesting } from '../src/services/storage';
import { AIConfig } from '../src/types';
import { memoryStore, mockSecureStore, mockSecureStoreImpl } from './setup_env';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, description: string, details?: unknown) {
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

async function runTestSuite() {
  console.log('================================================================');
  console.log('🔐 SUITE: GEMINI API KEY PERSISTENCE & COLD REBOOT RESILIENCE');
  console.log('================================================================\n');

  const testApiKey = 'AIzaSyTestApiKey_99887766554433221100_persistent';

  // ── 1. Save and Initial Retrieve ──
  console.log('--- 1. Save and Initial Retrieve ---');
  const sampleConfig: AIConfig = {
    provider: 'gemini',
    mode: 'gemini_cloud',
    apiKey: testApiKey,
    model: 'gemini-1.5-flash',
    enableFallbackToCloud: true,
  };

  const saveResult = await StorageService.saveAIConfig(sampleConfig);
  assert(saveResult === true, 'saveAIConfig succeeds');

  const initialLoad = await StorageService.getAIConfig();
  assert(initialLoad.apiKey === testApiKey, 'getAIConfig immediately returns saved apiKey');
  assert(initialLoad.provider === 'gemini', 'getAIConfig returns correct provider');
  assert(initialLoad.model === 'gemini-1.5-flash', 'getAIConfig returns correct model');

  // Verify that AsyncStorage @organiza_ai_config does NOT store plaintext apiKey
  const rawJson = memoryStore['@organiza_ai_config'];
  assert(typeof rawJson === 'string', '@organiza_ai_config exists in storage');
  const parsed = JSON.parse(rawJson);
  assert(parsed.apiKey === '', 'Plaintext apiKey in @organiza_ai_config is empty');
  assert(!rawJson.includes(testApiKey), 'Raw storage JSON never contains the unencrypted API key');

  // ── 2. Simulate Cold Start / App Reboot with In-Memory Cache Cleared ──
  console.log('\n--- 2. Cold Start Reboot Simulation (In-Memory Cache Purged) ---');
  _resetInMemorySecureVaultForTesting();

  // Load after clearing in-memory RAM cache
  const rebootConfig = await StorageService.getAIConfig();
  assert(
    rebootConfig.apiKey === testApiKey,
    'getAIConfig restores apiKey successfully after memory reset (app reboot simulation)'
  );

  // ── 3. Persistent Vault Fallback when Native SecureStore is Unavailable / Fails ──
  console.log('\n--- 3. Persistent Vault Fallback (SecureStore Outage / Expo Go Simulation) ---');
  _resetInMemorySecureVaultForTesting();

  // Save original methods
  const origGetItem = mockSecureStoreImpl.getItemAsync;
  const origSetItem = mockSecureStoreImpl.setItemAsync;

  try {
    // Simulate SecureStore failure or unpopulated store
    mockSecureStoreImpl.getItemAsync = async () => null;
    delete mockSecureStore['lumen_secure_ai_api_key'];

    // Verify that the persistent vault entry exists in AsyncStorage
    const vaultKey = '@organiza_secure_vault_lumen_secure_ai_api_key';
    assert(typeof memoryStore[vaultKey] === 'string', 'Obfuscated vault entry exists in AsyncStorage');
    assert(!memoryStore[vaultKey].includes(testApiKey), 'Vault entry is obfuscated in Base64 (not plaintext)');

    // Read config when SecureStore is completely unavailable
    const fallbackConfig = await StorageService.getAIConfig();
    assert(
      fallbackConfig.apiKey === testApiKey,
      'getAIConfig restores apiKey from persistent obfuscated vault when native SecureStore is unavailable'
    );
  } finally {
    mockSecureStoreImpl.getItemAsync = origGetItem;
    mockSecureStoreImpl.setItemAsync = origSetItem;
  }

  // ── 4. Backup Sanitization Guarantee ──
  console.log('\n--- 4. Zero Credential Leakage in exportBackup ---');
  const backup = await StorageService.exportBackup();
  const backupStr = JSON.stringify(backup);
  assert(!backupStr.includes(testApiKey), 'exportBackup JSON does not contain the Gemini API Key');
  assert(!backupStr.includes('lumen_secure_ai_api_key'), 'exportBackup does not contain secure key identifiers');
  assert(!backupStr.includes('@organiza_secure_vault_'), 'exportBackup does not contain secure vault prefixes');

  // ── 5. Empty Key / Key Deletion Cleans Up Vault ──
  console.log('\n--- 5. Empty Key & Deletion Resilience ---');
  await StorageService.saveAIConfig({
    ...sampleConfig,
    apiKey: '',
  });

  const clearedConfig = await StorageService.getAIConfig();
  assert(clearedConfig.apiKey === '', 'getAIConfig returns empty apiKey after saving empty key');

  // Check persistent vault key is deleted
  const vaultKey = '@organiza_secure_vault_lumen_secure_ai_api_key';
  assert(!memoryStore[vaultKey], 'Persistent vault entry is removed when key is cleared');
  assert(!mockSecureStore['lumen_secure_ai_api_key'], 'SecureStore entry is removed when key is cleared');

  // ── 6. Zero 'any' Static Audit ──
  console.log('\n--- 6. Zero "any" Static Audit in storage.ts ---');
  const storageFilePath = path.resolve(__dirname, '../src/services/storage.ts');
  const storageFileContent = fs.readFileSync(storageFilePath, 'utf8');
  const hasColonAny = /(:\s*any\b)/.test(storageFileContent);
  const hasAsAny = /(\bas\s+any\b)/.test(storageFileContent);
  assert(!hasColonAny, 'No ": any" found in src/services/storage.ts');
  assert(!hasAsAny, 'No "as any" found in src/services/storage.ts');

  console.log('\n================================================================');
  console.log(`PERSISTENCE SUITE SUMMARY: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
