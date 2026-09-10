import './setup_env';
import * as fs from 'fs';
import * as path from 'path';
import { StorageService } from '../src/services/storage';
import { GamificationService } from '../src/services/gamification';
import { LEVEL_THRESHOLDS, LEVEL_TITLES, getLevelTitle } from '../src/components/AchievementsModal';
import { GamificationData } from '../src/types';

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

async function runGamificationClaimAndLevelsTestSuite() {
  console.log('================================================================');
  console.log('GAMIFICATION LEVEL EXPANSION (1-50+) & XP CLAIM TEST SUITE');
  console.log('================================================================\n');

  // ── 1. LEVEL_THRESHOLDS Progression ──
  console.log('--- 1. LEVEL_THRESHOLDS Progression (Levels 1 to 50+) ---');

  assert(Array.isArray(LEVEL_THRESHOLDS), 'LEVEL_THRESHOLDS is an exported array');
  assert(LEVEL_THRESHOLDS.length >= 51, `LEVEL_THRESHOLDS has at least 51 entries (length: ${LEVEL_THRESHOLDS.length})`);
  assert(LEVEL_THRESHOLDS[1] === 0, 'Level 1 threshold requires 0 XP');
  assert(LEVEL_THRESHOLDS[2] === 100, 'Level 2 threshold requires 100 XP');
  assert(LEVEL_THRESHOLDS[3] === 282, `Level 3 threshold requires 282 XP (got ${LEVEL_THRESHOLDS[3]})`);
  assert(LEVEL_THRESHOLDS[50] === 34300, `Level 50 threshold requires 34,300 XP (got ${LEVEL_THRESHOLDS[50]})`);

  // Monotonically increasing check
  let isMonotonic = true;
  for (let i = 2; i < LEVEL_THRESHOLDS.length; i++) {
    if (LEVEL_THRESHOLDS[i] <= LEVEL_THRESHOLDS[i - 1]) {
      isMonotonic = false;
      break;
    }
  }
  assert(isMonotonic, 'LEVEL_THRESHOLDS is strictly monotonically increasing from level 1 upwards');

  // ── 2. LEVEL_TITLES & getLevelTitle Helper ──
  console.log('\n--- 2. LEVEL_TITLES & getLevelTitle Academic Titles ---');

  assert(typeof LEVEL_TITLES === 'object' && LEVEL_TITLES !== null, 'LEVEL_TITLES is an exported dictionary');
  assert(LEVEL_TITLES[1] === 'Calouro Iniciante 🎓', `Level 1 is Calouro Iniciante 🎓 (got ${LEVEL_TITLES[1]})`);
  assert(LEVEL_TITLES[4] === 'Sobrevivente do Cálculo 📐', `Level 4 is Sobrevivente do Cálculo 📐 (got ${LEVEL_TITLES[4]})`);
  assert(LEVEL_TITLES[5] === 'Monitor de Disciplina ⚡', `Level 5 is Monitor de Disciplina ⚡ (got ${LEVEL_TITLES[5]})`);
  assert(LEVEL_TITLES[10] === 'Veterano Exemplar 🏆', `Level 10 is Veterano Exemplar 🏆 (got ${LEVEL_TITLES[10]})`);
  assert(LEVEL_TITLES[20] === 'Pesquisador PIBIC de Destaque 🧪', `Level 20 is Pesquisador PIBIC de Destaque 🧪 (got ${LEVEL_TITLES[20]})`);
  assert(LEVEL_TITLES[25] === 'Formando de Honra 🎓', `Level 25 is Formando de Honra 🎓 (got ${LEVEL_TITLES[25]})`);
  assert(LEVEL_TITLES[30] === 'Mestre Acadêmico 🎖️', `Level 30 is Mestre Acadêmico 🎖️ (got ${LEVEL_TITLES[30]})`);
  assert(LEVEL_TITLES[39] === 'Doutor com Louvor 📜', `Level 39 is Doutor com Louvor 📜 (got ${LEVEL_TITLES[39]})`);
  assert(LEVEL_TITLES[50] === 'Lenda Acadêmica Suprema 👑🌌', `Level 50 is Lenda Acadêmica Suprema 👑🌌 (got ${LEVEL_TITLES[50]})`);

  // Test every level from 1 to 50 has a title
  let all50HaveTitles = true;
  for (let lvl = 1; lvl <= 50; lvl++) {
    if (!LEVEL_TITLES[lvl]) {
      all50HaveTitles = false;
      break;
    }
  }
  assert(all50HaveTitles, 'All levels from 1 to 50 have explicit academic titles defined');

  // getLevelTitle function tests
  assert(getLevelTitle(1) === 'Calouro Iniciante 🎓', 'getLevelTitle(1) returns Calouro Iniciante 🎓');
  assert(getLevelTitle(50) === 'Lenda Acadêmica Suprema 👑🌌', 'getLevelTitle(50) returns Lenda Acadêmica Suprema 👑🌌');
  assert(getLevelTitle(55) === 'Lenda Acadêmica Suprema (Nv. 55) 🌌', 'getLevelTitle(55) returns dynamic level title beyond 50');
  assert(getLevelTitle(0) === 'Calouro Iniciante 🎓', 'getLevelTitle(0) fallback returns Calouro Iniciante 🎓');

  // ── 3. StorageService.claimAchievementXP ──
  console.log('\n--- 3. StorageService.claimAchievementXP Single Claim & Idempotency ---');

  // Reset gamification data to fresh state
  await StorageService.saveGamificationData({
    xp: 0,
    level: 1,
    streak: 0,
    lastActiveDate: '2026-09-09',
    badges: [],
    history: [],
    claimedAchievements: []
  });

  let initialData = await StorageService.getGamificationData();
  assert(initialData.xp === 0, 'Initial XP is 0');
  assert(initialData.level === 1, 'Initial level is 1');
  assert(Array.isArray(initialData.claimedAchievements) && initialData.claimedAchievements.length === 0, 'Initial claimedAchievements is empty array');

  // Claim achievement 1 (+50 XP)
  const afterClaim1 = await StorageService.claimAchievementXP('first_event', 50);
  assert(afterClaim1.xp === 50, `XP incremented to 50 (got ${afterClaim1.xp})`);
  assert(afterClaim1.level === 1, `Level is 1 (got ${afterClaim1.level})`);
  assert(afterClaim1.claimedAchievements?.includes('first_event') === true, 'claimedAchievements contains first_event');

  // Verify persistence
  const persisted1 = await StorageService.getGamificationData();
  assert(persisted1.xp === 50, 'Persisted XP is 50');
  assert(persisted1.claimedAchievements?.includes('first_event') === true, 'Persisted claimedAchievements has first_event');

  // Idempotency: Claim the SAME achievement again
  const duplicateClaim = await StorageService.claimAchievementXP('first_event', 50);
  assert(duplicateClaim.xp === 50, 'XP did NOT increase on duplicate claim (idempotent)');
  assert(duplicateClaim.claimedAchievements?.filter(id => id === 'first_event').length === 1, 'first_event is not duplicated in claimedAchievements array');

  // Claim achievement 2 (+250 XP) -> Total XP 300 -> Level 3 (needs 282)
  const afterClaim2 = await StorageService.claimAchievementXP('attendance_master', 250);
  assert(afterClaim2.xp === 300, `XP incremented to 300 (got ${afterClaim2.xp})`);
  assert(afterClaim2.level === 3, `Level dynamically promoted to Level 3 (got ${afterClaim2.level})`);
  assert(afterClaim2.claimedAchievements?.includes('attendance_master') === true, 'claimedAchievements contains attendance_master');

  // ── 4. StorageService.claimAllAchievementsXP ──
  console.log('\n--- 4. StorageService.claimAllAchievementsXP Bulk Claim & Deduplication ---');

  // Bulk claim with 3 achievements, one of which was ALREADY claimed
  const bulkResult = await StorageService.claimAllAchievementsXP([
    { id: 'first_event', xp: 50 }, // Already claimed -> should be skipped (0 XP added)
    { id: 'study_zen_1', xp: 100 }, // New -> +100 XP
    { id: 'study_zen_2', xp: 200 }  // New -> +200 XP
  ]);

  // Previous was 300 XP. Adding 100 + 200 = 300 XP -> Total should be 600 XP.
  // At 600 XP, level should be 4 (Level 4 starts at 519 XP, Level 5 starts at 800 XP)
  assert(bulkResult.xp === 600, `Bulk claim added 300 XP, reaching 600 XP (got ${bulkResult.xp})`);
  assert(bulkResult.level === 4, `Bulk claim recalculated level to 4 (got ${bulkResult.level})`);
  assert(bulkResult.claimedAchievements?.includes('study_zen_1') === true, 'claimedAchievements includes study_zen_1');
  assert(bulkResult.claimedAchievements?.includes('study_zen_2') === true, 'claimedAchievements includes study_zen_2');

  // Calling bulk claim again with already-claimed items should not add any XP
  const bulkResultRepeat = await StorageService.claimAllAchievementsXP([
    { id: 'study_zen_1', xp: 100 },
    { id: 'study_zen_2', xp: 200 }
  ]);
  assert(bulkResultRepeat.xp === 600, 'Repeated bulk claim with already-claimed items added 0 XP (idempotent)');

  // Bulk claim with empty array
  const emptyBulk = await StorageService.claimAllAchievementsXP([]);
  assert(emptyBulk.xp === 600, 'Empty bulk claim returns current data intact');

  // ── 5. Static Inspection of AchievementsModal.tsx & Design Tokens ──
  console.log('\n--- 5. Static Codebase Audit: AchievementsModal.tsx Tokens & UI Elements ---');

  const modalPath = path.resolve(__dirname, '../src/components/AchievementsModal.tsx');
  assert(fs.existsSync(modalPath), 'AchievementsModal.tsx exists');

  const modalContent = fs.readFileSync(modalPath, 'utf8');

  // Dark token violations
  const FORBIDDEN_DARK_TOKENS = [
    '#0F1115', '#181B20', '#1F232B', '#292E38', '#2A303C',
    '#1E232D', '#3E4756', '#0A0C0E', '#121519', '#1A1E24',
    '#1E2229', '#14171C', '#2C323D'
  ];
  let foundTokens: string[] = [];
  for (const token of FORBIDDEN_DARK_TOKENS) {
    if (new RegExp(token, 'i').test(modalContent)) {
      foundTokens.push(token);
    }
  }
  assert(foundTokens.length === 0, 'AchievementsModal.tsx has 0 hardcoded dark theme tokens');

  // Verification of Interactive Claim UI
  assert(modalContent.includes('handleClaimSingle'), 'Contains handleClaimSingle handler');
  assert(modalContent.includes('handleClaimAll'), 'Contains handleClaimAll handler');
  assert(modalContent.includes('Resgatar Tudo'), 'Contains "Resgatar Tudo" bulk claim button banner');
  assert(modalContent.includes('Coletar'), 'Contains "Coletar" single claim button');
  assert(modalContent.includes('Coletado'), 'Contains "Coletado" already claimed status badge');
  assert(modalContent.includes('accessibilityRole="button"'), 'Interactive elements have accessibilityRole="button"');

  console.log('\n================================================================');
  console.log(`GAMIFICATION TESTS SUMMARY: ${passed}/${passed + failed} Passed (${failed} Failed)`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runGamificationClaimAndLevelsTestSuite();
