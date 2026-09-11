import './setup_env';
import fs from 'fs';
import path from 'path';
import { getTimeoutSignal } from '../src/utils/network';

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

async function runTestSuite() {
  console.log('================================================================');
  console.log('🌐 HERMES RUNTIME RESILIENCE & NETWORK TIMEOUT SIGNAL TESTS');
  console.log('================================================================');

  // 1. Standard Environment Test
  console.log('\n--- 1. Standard Environment (Node / Native AbortSignal) ---');
  const signal1 = getTimeoutSignal(100);
  assert(signal1 !== undefined && signal1 !== null, 'getTimeoutSignal returns non-null signal');
  assert(signal1 instanceof AbortSignal, 'getTimeoutSignal returns an instance of AbortSignal');
  assert(signal1.aborted === false, 'Signal is initially not aborted');

  // 2. Hermes Environment Simulation: AbortSignal.timeout is undefined
  console.log('\n--- 2. Hermes Engine Simulation (AbortSignal.timeout is undefined) ---');
  const originalTimeout = (AbortSignal as any).timeout;
  try {
    // Simulate Hermes where AbortSignal exists but AbortSignal.timeout is undefined
    (AbortSignal as any).timeout = undefined;

    const hermesSignal = getTimeoutSignal(40);
    assert(hermesSignal !== undefined && hermesSignal !== null, 'Hermes fallback returns a valid AbortSignal');
    assert(hermesSignal.aborted === false, 'Hermes fallback signal is initially not aborted');

    // Wait for timeout to fire
    await new Promise(resolve => setTimeout(resolve, 80));
    assert(hermesSignal.aborted === true, 'Hermes fallback signal aborts after specified delay');

    // Test when AbortSignal.timeout throws in runtime
    (AbortSignal as any).timeout = () => {
      throw new TypeError('Hermes runtime mock error');
    };
    const throwingSignal = getTimeoutSignal(30);
    assert(throwingSignal !== undefined, 'Safely falls back when AbortSignal.timeout throws');
    assert(throwingSignal.aborted === false, 'Signal is initially active');

    await new Promise(resolve => setTimeout(resolve, 60));
    assert(throwingSignal.aborted === true, 'Falling-back signal aborts correctly');
  } finally {
    (AbortSignal as any).timeout = originalTimeout;
  }

  // 3. Static Audit: Zero bare AbortSignal.timeout calls in src/
  console.log('\n--- 3. Static Audit: No Unsafe AbortSignal.timeout in src/ ---');
  const srcDir = path.resolve(__dirname, '../src');

  function scanDir(dir: string, fileList: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(full, fileList);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        fileList.push(full);
      }
    }
    return fileList;
  }

  const srcFiles = scanDir(srcDir);
  const unsafeMatches: string[] = [];

  for (const file of srcFiles) {
    const code = fs.readFileSync(file, 'utf8');
    const lines = code.split('\n');
    lines.forEach((line, idx) => {
      // Ignore comments
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      // Check for bare AbortSignal.timeout(
      if (line.includes('AbortSignal.timeout(') && !line.includes('//')) {
        unsafeMatches.push(`${path.relative(srcDir, file)}:L${idx + 1}`);
      }
    });
  }

  assert(
    unsafeMatches.length === 0,
    `Zero bare AbortSignal.timeout calls in src/ (found: ${unsafeMatches.length})`,
    unsafeMatches.join(', ')
  );

  // 4. Verify AIParsingService and GoogleSheetsService use getTimeoutSignal
  console.log('\n--- 4. AIParsingService and GoogleSheetsService Usage ---');
  const aiParsingContent = fs.readFileSync(path.resolve(__dirname, '../src/services/AIParsingService.ts'), 'utf8');
  assert(
    aiParsingContent.includes('getTimeoutSignal(90000)'),
    'AIParsingService uses getTimeoutSignal(90000) for document parsing'
  );
  assert(
    aiParsingContent.includes('getTimeoutSignal(15000)'),
    'AIParsingService uses getTimeoutSignal(15000) for API calls'
  );

  const googleSheetsContent = fs.readFileSync(path.resolve(__dirname, '../src/services/GoogleSheetsService.ts'), 'utf8');
  assert(
    googleSheetsContent.includes('getTimeoutSignal(15000)'),
    'GoogleSheetsService uses getTimeoutSignal(15000)'
  );

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed}/${passed + failed} Passed (${failed} Failed)`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
