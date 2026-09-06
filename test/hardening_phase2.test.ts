import './setup_env';
import { SecuritySanitizer } from '../src/services/SecuritySanitizer';
import { AIParsingService } from '../src/services/AIParsingService';
import { StorageService } from '../src/services/storage';
import { AIConfig } from '../src/types';

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

async function runTests() {
  console.log('================================================================');
  console.log('🛡️ PHASE 2 HARDENING: INPUT BOUNDARIES & AI ISOLATION TESTS');
  console.log('================================================================\n');

  console.log('--- 1. String Sanitization & Anti-XSS (Titles & Notes) ---');
  {
    // A. Title Sanitization
    const maliciousTitle = '<script>alert("xss")</script> Cálculo 1 \x00\x08\x1F';
    const cleanTitle = (SecuritySanitizer as any).sanitizeTitle?.(maliciousTitle);
    assert(cleanTitle === 'Cálculo 1', 'sanitizeTitle removes script tags and ASCII control characters', `Got: "${cleanTitle}"`);

    const titleWithHtml = '<b>Álgebra</b> Linear &amp; Geometria';
    const cleanHtml = (SecuritySanitizer as any).sanitizeTitle?.(titleWithHtml);
    assert(cleanHtml === 'Álgebra Linear & Geometria', 'sanitizeTitle removes HTML tags and decodes entities', `Got: "${cleanHtml}"`);

    // Unpaired UTF-16 surrogates check (e.g. \uD800 alone)
    const brokenSurrogate = 'Matéria \uD800 Inválida';
    const cleanSurrogate = (SecuritySanitizer as any).sanitizeTitle?.(brokenSurrogate);
    assert(!cleanSurrogate?.includes('\uD800'), 'sanitizeTitle strips unpaired UTF-16 surrogates', `Got: "${cleanSurrogate}"`);

    // Length capping
    const longTitle = 'A'.repeat(200);
    const cappedTitle = (SecuritySanitizer as any).sanitizeTitle?.(longTitle, 120);
    assert(cappedTitle?.length === 120, 'sanitizeTitle caps excessive string length to 120 chars');

    // B. Notes Sanitization (Preserving linebreaks)
    const multiLineNotes = '<script>bad()</script>Sala 302\nProf. Carlos\nE-mail: carlos@univ.br';
    const cleanNotes = (SecuritySanitizer as any).sanitizeNotes?.(multiLineNotes);
    assert(
      cleanNotes === 'Sala 302\nProf. Carlos\nE-mail: carlos@univ.br',
      'sanitizeNotes preserves legitimate line breaks while stripping dangerous tags',
      `Got: "${cleanNotes}"`
    );
  }

  console.log('\n--- 2. Numerical Sanitization & Bounded Ranges ---');
  {
    // A. Floating numbers (Grades, Weights)
    const cleanGrade = (SecuritySanitizer as any).sanitizeNumber?.('8,5', 0, 10, 7.0);
    assert(cleanGrade === 8.5, 'sanitizeNumber handles comma as decimal separator');

    const negativeGrade = (SecuritySanitizer as any).sanitizeNumber?.(-4.5, 0, 10, 7.0);
    assert(negativeGrade === 0, 'sanitizeNumber clamps negative numbers to minimum (0)');

    const excessiveGrade = (SecuritySanitizer as any).sanitizeNumber?.(999, 0, 10, 7.0);
    assert(excessiveGrade === 10, 'sanitizeNumber clamps excessive numbers to maximum (10)');

    const nanGrade = (SecuritySanitizer as any).sanitizeNumber?.('not_a_number', 0, 10, 7.0);
    assert(nanGrade === 7.0, 'sanitizeNumber falls back to default on NaN');

    const infinityGrade = (SecuritySanitizer as any).sanitizeNumber?.(Infinity, 0, 10, 7.0);
    assert(infinityGrade === 7.0, 'sanitizeNumber falls back to default on Infinity');

    // B. Integers (Absences, Durations, Hours)
    const excessiveAbsences = (SecuritySanitizer as any).sanitizeInteger?.(99999, 0, 1000, 15);
    assert(excessiveAbsences === 1000, 'sanitizeInteger clamps disproportionate absences to 1000');

    const negativeAbsences = (SecuritySanitizer as any).sanitizeInteger?.(-12, 0, 1000, 15);
    assert(negativeAbsences === 0, 'sanitizeInteger clamps negative absences to 0');

    const floatAbsences = (SecuritySanitizer as any).sanitizeInteger?.(15.7, 0, 1000, 15);
    assert(floatAbsences === 16, 'sanitizeInteger rounds decimal input to clean integer');
  }

  console.log('\n--- 3. API Key Redaction & Masking ---');
  {
    const mockGeminiKey = 'AIzaSyD-1234567890abcdefghijklmnopqrstuvwxyz';
    const mockOpenAiKey = 'sk-proj-1234567890abcdefghijklmnopqrstuvwxyz';
    const logText = `Error calling Gemini at URL https://api?key=${mockGeminiKey} with auth Bearer ${mockOpenAiKey}`;
    
    const redacted = (SecuritySanitizer as any).redactApiKeys?.(logText);
    assert(!redacted?.includes(mockGeminiKey), 'redactApiKeys removes Gemini API key from text');
    assert(!redacted?.includes(mockOpenAiKey), 'redactApiKeys removes OpenAI API key from text');
    assert(redacted?.includes('[REDACTED_API_KEY]'), 'redactApiKeys inserts [REDACTED_API_KEY] placeholder');
  }

  console.log('\n--- 4. Gemini AI Offline Resilience & Error Guidance ---');
  {
    const originalFetch = globalThis.fetch;
    const mockApiKey = 'AIzaSyD-TESTINGKEY1234567890abcdef';

    // Simulate Offline / Network Failure
    globalThis.fetch = async () => {
      const err = new TypeError('Network request failed');
      throw err;
    };

    try {
      // Test callGemini offline handling
      let callGeminiCaught = false;
      let callGeminiMsg = '';
      try {
        await AIParsingService.callGemini('Mensagem teste', mockApiKey, 'gemini-1.5-flash', 'Prompt');
      } catch (err: any) {
        callGeminiCaught = true;
        callGeminiMsg = err.message || '';
      }

      assert(callGeminiCaught, 'callGemini throws caught error when offline');
      assert(
        callGeminiMsg.includes('Conecte-se à internet para usar a IA'),
        'callGemini returns friendly offline message ("Conecte-se à internet para usar a IA")',
        `Got: "${callGeminiMsg}"`
      );
      assert(!callGeminiMsg.includes(mockApiKey), 'callGemini error message does not leak API key');

      // Test parseAcademicDocument offline handling
      let docCaught = false;
      let docMsg = '';
      const dummyConfig: AIConfig = { provider: 'gemini', mode: 'gemini_cloud', apiKey: mockApiKey };
      try {
        await AIParsingService.parseAcademicDocument('base64', 'application/pdf', 'transcript', dummyConfig);
      } catch (err: any) {
        docCaught = true;
        docMsg = err.message || '';
      }

      assert(docCaught, 'parseAcademicDocument throws caught error when offline');
      assert(
        docMsg.includes('Conecte-se à internet para usar a IA'),
        'parseAcademicDocument returns friendly offline message',
        `Got: "${docMsg}"`
      );
      assert(!docMsg.includes(mockApiKey), 'parseAcademicDocument error message does not leak API key');

      // Test parseMessage offline resilience (should fallback to mock without unhandled rejection)
      const parseResult = await AIParsingService.parseMessage('Aviso: Aula cancelada amanhã', dummyConfig, {
        currentDate: '2026-09-06',
        currentDayOfWeek: 'Domingo',
        registeredSubjects: ['Cálculo 1']
      });

      assert(Array.isArray(parseResult.items), 'parseMessage returns fallback items array when offline');
      assert(parseResult.items.length > 0, 'parseMessage fallback parses event successfully');

    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  console.log('\n--- 5. Key Isolation & Header-based API Authentication ---');
  {
    const originalFetch = globalThis.fetch;
    const testKey = 'AIzaSyD-TESTINGKEY1234567890abcdef';
    let interceptedUrl = '';
    let interceptedHeaders: Record<string, string> = {};

    globalThis.fetch = async (url: any, options: any) => {
      interceptedUrl = String(url);
      interceptedHeaders = options?.headers || {};
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"items":[],"confidence":1}' }] } }]
        })
      } as any;
    };

    try {
      await AIParsingService.callGemini('Teste', testKey, 'gemini-1.5-flash', 'Prompt');
      assert(!interceptedUrl.includes(testKey), 'Gemini URL does not contain API key as query param (?key=...)');
      assert(
        interceptedHeaders['x-goog-api-key'] === testKey,
        'Gemini API key is passed securely via x-goog-api-key HTTP header'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  console.log('\n--- 6. Backup Credential Isolation (Zero Secret Leakage) ---');
  {
    const secretApiKey = 'AIzaSyD-CONFIDENTIAL-KEY-9876543210';
    // Save AI Config with sensitive API key in SecureStore
    await StorageService.saveAIConfig({
      provider: 'gemini',
      mode: 'gemini_cloud',
      apiKey: secretApiKey,
      model: 'gemini-1.5-flash'
    });

    // Generate backup
    const backup = await StorageService.exportBackup();
    const backupJson = JSON.stringify(backup);

    assert(!backupJson.includes(secretApiKey), 'exportBackup JSON does NOT contain the SecureStore API key');
    assert(!backupJson.includes('AIzaSyD-'), 'exportBackup JSON contains no Gemini API key pattern');
    assert((backup as any).aiConfig === undefined, 'exportBackup does not include raw aiConfig credential object');
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed}/${passed + failed} Tests Passed (${failed} Failed)`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
