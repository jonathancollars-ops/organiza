import './setup_env';
import { GamificationService, BASE_ACHIEVEMENTS, GamificationManager } from '../src/services/GamificationService';
import { StorageService } from '../src/services/storage';
import { GamificationData, Achievement } from '../src/types';
import { LEVEL_THRESHOLDS, LEVEL_TITLES, getLevelTitle } from '../src/components/AchievementsModal';

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

async function runGamificationTests(): Promise<void> {
  console.log('================================================================');
  console.log('🏆 LUMEN: GAMIFICATION, LEVEL PROGRESSION (1-50) & CLAIM ALL TESTS');
  console.log('================================================================');

  // ==========================================================================
  // SUITE 1: Curva de Níveis e Progressão Matemática (Níveis 1 a 50)
  // ==========================================================================
  console.log('\n--- SUITE 1: Curva de Níveis e Progressão Matemática (1 ao 50) ---');

  await test('Nível 1 requer exatamente 0 XP', () => {
    assertEqual(GamificationService.calculateXPForLevel(1), 0, 'calculateXPForLevel(1) === 0');
    assertEqual(GamificationService.calculateLevelFromXP(0), 1, 'calculateLevelFromXP(0) === 1');
  });

  await test('Progressão estritamente monotônica crescente de XP dos Níveis 1 a 50', () => {
    for (let lvl = 1; lvl < 50; lvl++) {
      const currentXP = GamificationService.calculateXPForLevel(lvl);
      const nextXP = GamificationService.calculateXPForLevel(lvl + 1);
      assert(nextXP > currentXP, `Nível ${lvl + 1} (${nextXP} XP) requer estritamente mais XP que Nível ${lvl} (${currentXP} XP)`);
    }
  });

  await test('Progressão e desbloqueio de níveis de 1 até 50', () => {
    for (let lvl = 1; lvl <= 50; lvl++) {
      const thresholdXP = LEVEL_THRESHOLDS[lvl];
      assert(thresholdXP !== undefined && thresholdXP >= 0, `Nível ${lvl} possui threshold definido (${thresholdXP})`);
      const testXP = thresholdXP === 0 ? 0 : thresholdXP + 1;
      const calculatedLevel = GamificationService.calculateLevelFromXP(testXP);
      assertEqual(
        calculatedLevel,
        lvl,
        `XP ${testXP} correspondente ao patamar do Nível ${lvl} desbloqueia com precisão o Nível ${lvl}`
      );
    }
  });

  await test('Marcos exatos da fórmula de níveis e transições de level-up', () => {
    const milestones = [
      { xp: 0, expectedLevel: 1 },
      { xp: 99, expectedLevel: 1 },
      { xp: 100, expectedLevel: 2 },
      { xp: 282, expectedLevel: 2 },
      { xp: 283, expectedLevel: 3 },
      { xp: 519, expectedLevel: 3 },
      { xp: 520, expectedLevel: 4 },
      { xp: 801, expectedLevel: 5 },
      { xp: 34301, expectedLevel: 50 },
    ];

    for (const m of milestones) {
      const lvl = GamificationService.calculateLevelFromXP(m.xp);
      assertEqual(lvl, m.expectedLevel, `XP ${m.xp} resulta no Nível ${m.expectedLevel}`);
    }
  });

  await test('Robustez matemática da fórmula contra NaN, Infinity e valores negativos', () => {
    assertEqual(GamificationService.calculateXPForLevel(0), 0, 'Nível 0 retorna 0 XP');
    assertEqual(GamificationService.calculateXPForLevel(-5), 0, 'Nível negativo retorna 0 XP');
    assertEqual(GamificationService.calculateLevelFromXP(-100), 1, 'XP negativo retorna Nível 1');
    assertEqual(GamificationService.calculateLevelFromXP(0), 1, '0 XP retorna Nível 1');

    // Validação com valores altos (1 milhão de XP)
    const highXPLevel = GamificationService.calculateLevelFromXP(1_000_000);
    assert(Number.isFinite(highXPLevel) && !isNaN(highXPLevel), 'XP de 1 milhão não gera NaN nem Infinity');
    assert(highXPLevel > 50, `1 milhão de XP atinge nível alto (${highXPLevel} > 50)`);
  });

  await test('LEVEL_THRESHOLDS contém 52 patamares correspondentes à curva do GamificationService', () => {
    assertEqual(LEVEL_THRESHOLDS.length, 52, 'LEVEL_THRESHOLDS possui 52 elementos (níveis 0 a 51)');
    for (let lvl = 0; lvl < LEVEL_THRESHOLDS.length; lvl++) {
      const expected = GamificationService.calculateXPForLevel(lvl);
      assertEqual(
        LEVEL_THRESHOLDS[lvl],
        expected,
        `LEVEL_THRESHOLDS[${lvl}] === ${expected}`
      );
    }
  });

  await test('LEVEL_TITLES possui patentes acadêmicas válidas para todos os Níveis de 1 a 50', () => {
    for (let lvl = 1; lvl <= 50; lvl++) {
      const title = LEVEL_TITLES[lvl];
      assert(typeof title === 'string' && title.trim().length > 0, `Nível ${lvl} possui título definido ("${title}")`);
    }
    assertEqual(LEVEL_TITLES[1], 'Calouro Iniciante 🎓', 'Nível 1 é Calouro Iniciante');
    assertEqual(LEVEL_TITLES[50], 'Lenda Acadêmica Suprema 👑🌌', 'Nível 50 é Lenda Acadêmica Suprema');

    // Teste do helper getLevelTitle
    assertEqual(getLevelTitle(1), 'Calouro Iniciante 🎓', 'getLevelTitle(1) retorna título do nível 1');
    assertEqual(getLevelTitle(50), 'Lenda Acadêmica Suprema 👑🌌', 'getLevelTitle(50) retorna título do nível 50');
    assertEqual(getLevelTitle(55), 'Lenda Acadêmica Suprema (Nv. 55) 🌌', 'getLevelTitle(55) gera título dinâmico além de 50');
    assertEqual(getLevelTitle(0), 'Calouro Iniciante 🎓', 'getLevelTitle(0) retorna fallback nível 1');
  });

  // ==========================================================================
  // SUITE 2: Coleta Unitária de XP e Prevenção de Resgate Duplicado
  // ==========================================================================
  console.log('\n--- SUITE 2: Coleta Unitária e Prevenção de Resgate Duplicado ---');

  await test('Resgate unitário de XP registra claimedAchievements e credita pontuação', async () => {
    // Reset data
    const initial: GamificationData = {
      xp: 0,
      level: 1,
      unlockedAchievements: [],
      claimedAchievements: [],
      totalFocusMinutes: 0,
      processedEventIds: []
    };
    await StorageService.saveGamificationData(initial);

    const updated = await StorageService.claimAchievementXP('first_study', 50);
    assertEqual(updated.xp, 50, 'XP aumenta de 0 para 50');
    assert(updated.claimedAchievements?.includes('first_study') === true, 'claimedAchievements inclui "first_study"');
    assert(updated.unlockedAchievements?.includes('first_study') === true, 'unlockedAchievements inclui "first_study"');
  });

  await test('Prevenção de Resgate Duplicado: chamar claimAchievementXP novamente não concede XP', async () => {
    const beforeData = await StorageService.getGamificationData();
    assertEqual(beforeData.xp, 50, 'XP antes da tentativa repetida é 50');

    // Tentativa duplicada com a mesma conquista
    const duplicateClaim = await StorageService.claimAchievementXP('first_study', 50);
    assertEqual(duplicateClaim.xp, 50, 'XP permanece em 50 (sem duplicação)');
    assertEqual(duplicateClaim.claimedAchievements?.length, 1, 'claimedAchievements não duplica entradas');

    // Verificação de persistência no StorageService
    const stored = await StorageService.getGamificationData();
    assertEqual(stored.xp, 50, 'StorageService preserva XP sem duplicação');
  });

  await test('Resgate de conquista subsequente soma XP e recalcula nível de forma atômica', async () => {
    // Adiciona 200 XP (50 + 200 = 250 XP -> Nível 2)
    const updated = await StorageService.claimAchievementXP('study_10h', 200);
    assertEqual(updated.xp, 250, 'XP totaliza 250');
    assertEqual(updated.level, 2, 'Nível atualizado automaticamente para 2 (>= 100 XP)');
    assertEqual(updated.claimedAchievements?.length, 2, 'Dois achievements resgatados');
    assert(updated.claimedAchievements?.includes('first_study') === true, 'Inclui first_study');
    assert(updated.claimedAchievements?.includes('study_10h') === true, 'Inclui study_10h');
  });

  await test('Validações defensivas de claimAchievementXP com entradas anômalas', async () => {
    const current = await StorageService.getGamificationData();
    const currentXP = current.xp;

    // ID vazio
    const emptyIdRes = await StorageService.claimAchievementXP('', 100);
    assertEqual(emptyIdRes.xp, currentXP, 'ID vazio não altera XP');

    // XP negativo
    const negRes = await StorageService.claimAchievementXP('test_neg', -100);
    assertEqual(negRes.xp, currentXP, 'XP negativo não subtrai pontos');

    // XP NaN
    const nanRes = await StorageService.claimAchievementXP('test_nan', NaN);
    assertEqual(nanRes.xp, currentXP, 'XP NaN é sanitizado para 0');
  });

  // ==========================================================================
  // SUITE 3: Ação de "Resgatar Tudo" (claimAllAchievementsXP)
  // ==========================================================================
  console.log('\n--- SUITE 3: Ação de "Resgatar Tudo" (claimAllAchievementsXP) ---');

  await test('Resgatar Tudo recolhe todas as pendências e atualiza XP e nível em batch', async () => {
    // Reset state
    const cleanState: GamificationData = {
      xp: 0,
      level: 1,
      unlockedAchievements: [],
      claimedAchievements: [],
      totalFocusMinutes: 0,
      processedEventIds: []
    };
    await StorageService.saveGamificationData(cleanState);

    const pendingAchievements = [
      { id: 'first_study', xp: 50 },
      { id: 'study_10h', xp: 200 },
      { id: 'perfect_attendance', xp: 100 },
      { id: 'study_night', xp: 100 }
    ];

    const result = await StorageService.claimAllAchievementsXP(pendingAchievements);
    // Total XP = 50 + 200 + 100 + 100 = 450
    assertEqual(result.xp, 450, 'XP total é somado corretamente para 450');
    // Level para 450 XP: calculateLevelFromXP(450) = 3
    assertEqual(result.level, 3, 'Nível avança automaticamente para 3');
    assertEqual(result.claimedAchievements?.length, 4, 'Todos os 4 IDs estão em claimedAchievements');
    for (const ach of pendingAchievements) {
      assert(result.claimedAchievements?.includes(ach.id) === true, `claimedAchievements inclui ${ach.id}`);
      assert(result.unlockedAchievements?.includes(ach.id) === true, `unlockedAchievements inclui ${ach.id}`);
    }
  });

  await test('Resgatar Tudo é estritamente idempotente quando executado repetidamente', async () => {
    const pendingAchievements = [
      { id: 'first_study', xp: 50 },
      { id: 'study_10h', xp: 200 },
      { id: 'perfect_attendance', xp: 100 },
      { id: 'study_night', xp: 100 }
    ];

    // Executa novamente
    const secondCall = await StorageService.claimAllAchievementsXP(pendingAchievements);
    assertEqual(secondCall.xp, 450, 'XP não é incrementado em segunda chamada de Resgatar Tudo');
    assertEqual(secondCall.claimedAchievements?.length, 4, 'Total de claimedAchievements permanece 4');
  });

  await test('Resgatar Tudo ignora conquistas já resgatadas e credita apenas pendências novas', async () => {
    // Estado com 450 XP e 4 achievements resgatados
    const newPendingWithOld = [
      { id: 'first_study', xp: 50 },          // Já resgatado
      { id: 'study_10h', xp: 200 },           // Já resgatado
      { id: 'level_5', xp: 150 },             // Novo pendente
      { id: 'bonus_marathon', xp: 300 }       // Novo pendente
    ];

    const updated = await StorageService.claimAllAchievementsXP(newPendingWithOld);
    // XP anterior 450 + 150 + 300 = 900 XP
    assertEqual(updated.xp, 900, 'XP aumenta de 450 para 900 (apenas 450 dos novos pendentes adicionados)');
    // 900 XP atinge nível 5 (nível 5 requer 800 XP)
    assert(updated.level >= 5, `Nível atinge nível 5 ou superior (${updated.level} >= 5)`);
    assertEqual(updated.claimedAchievements?.length, 6, 'Total de 6 conquistas resgatadas');
    assert(updated.claimedAchievements?.includes('level_5') === true, 'claimedAchievements inclui level_5');
    assert(updated.claimedAchievements?.includes('bonus_marathon') === true, 'claimedAchievements inclui bonus_marathon');
  });

  await test('Resgatar Tudo com array vazio retorna estado atual intacto', async () => {
    const before = await StorageService.getGamificationData();
    const after = await StorageService.claimAllAchievementsXP([]);
    assertEqual(after.xp, before.xp, 'XP não sofre alteração com array vazio');
    assertEqual(after.claimedAchievements?.length, before.claimedAchievements?.length, 'Contagem de claimed preservada');
  });

  // ==========================================================================
  // SUITE 4: Proteção Anti-Exploit / Anti-Farming do GamificationManager
  // ==========================================================================
  console.log('\n--- SUITE 4: Proteção Anti-Exploit do GamificationManager ---');

  await test('safeAwardStudyXP impede premiação duplicada da mesma sessão de estudos', async () => {
    const sessionId = 'session_anti_exploit_99';
    const firstCall = await GamificationManager.safeAwardStudyXP(sessionId, 30);
    assertEqual(firstCall, true, 'Primeira concessão de XP de estudo é bem-sucedida');

    const dataAfterFirst = await StorageService.getGamificationData();
    const xpAfterFirst = dataAfterFirst.xp;

    const secondCall = await GamificationManager.safeAwardStudyXP(sessionId, 30);
    assertEqual(secondCall, false, 'Segunda concessão com mesmo sessionId é bloqueada');

    const dataAfterSecond = await StorageService.getGamificationData();
    assertEqual(dataAfterSecond.xp, xpAfterFirst, 'XP não aumenta na tentativa de re-execução da mesma sessão');
  });

  await test('safeAwardAttendanceXP impede premiação duplicada da mesma presença/aula', async () => {
    const attendanceId = 'att_anti_exploit_88';
    const firstCall = await GamificationManager.safeAwardAttendanceXP(attendanceId);
    assertEqual(firstCall, true, 'Primeiro registro de presença concede XP');

    const dataAfterFirst = await StorageService.getGamificationData();
    const xpAfterFirst = dataAfterFirst.xp;

    const secondCall = await GamificationManager.safeAwardAttendanceXP(attendanceId);
    assertEqual(secondCall, false, 'Tentativa de farming da mesma presença é bloqueada');

    const dataAfterSecond = await StorageService.getGamificationData();
    assertEqual(dataAfterSecond.xp, xpAfterFirst, 'XP de presença não é duplicado');
  });

  await test('safeAwardGenericXP com eventId impede repetição indevida de XP de tarefas', async () => {
    const eventId = 'task_anti_exploit_77';
    const firstResult = await GamificationManager.safeAwardGenericXP(25, eventId);
    const xpAfterFirst = firstResult.xp;

    const secondResult = await GamificationManager.safeAwardGenericXP(25, eventId);
    assertEqual(secondResult.xp, xpAfterFirst, 'Tarefa já pontuada não rende XP repetido');
  });

  console.log('\n================================================================');
  console.log(`GAMIFICATION & LEVELS SUMMARY: ${passedTests}/${totalTests} Tests Passed (${failedTests} Failed)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runGamificationTests().catch(err => {
  console.error('Fatal error in gamification tests:', err);
  process.exit(1);
});
