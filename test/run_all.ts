import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const testDir = __dirname;
const files = fs.readdirSync(testDir)
  .filter(file => file.endsWith('.test.ts'))
  .sort();

console.log('================================================================');
console.log(`🚀 LUMEN 3.0 COMPLETE TEST RUNNER - ${files.length} SUITES DETECTED`);
console.log('================================================================\n');

let passedCount = 0;
let failedCount = 0;
const failedFiles: string[] = [];

for (const file of files) {
  const fullPath = path.join(testDir, file);
  console.log(`\n▶️  RUNNING: test/${file}`);
  const result = spawnSync('npx', ['tsx', fullPath], {
    stdio: 'inherit',
    shell: true,
    cwd: path.resolve(__dirname, '..')
  });

  if (result.status === 0) {
    passedCount++;
    console.log(`✔️  PASSED: test/${file}`);
  } else {
    failedCount++;
    failedFiles.push(file);
    console.error(`❌ FAILED (exit code ${result.status}): test/${file}`);
  }
}

console.log('\n================================================================');
console.log(`📊 FINAL SUMMARY: ${passedCount}/${files.length} SUITES PASSED (${failedCount} FAILED)`);
console.log('================================================================');

if (failedCount > 0) {
  console.error(`Failing suites: ${failedFiles.join(', ')}`);
  process.exit(1);
} else {
  console.log('🎉 ALL ACTIVE TEST SUITES PASSED 100% GREEN!');
  process.exit(0);
}
