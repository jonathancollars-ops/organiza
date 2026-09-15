import './setup_env';
import { TimerService, saveTimerState, restoreTimerState, getTimerState, clearTimerState, toActiveTimerState, fromActiveTimerState, TIMER_STATE_KEY } from '../src/services/TimerService';
import { StorageService } from '../src/services/storage';
import { SavedTimerState, ActiveTimerState } from '../src/types';
import { mockAsyncStorage } from './setup_env';

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

async function runTimerServiceTimestampDiffTests(): Promise<void> {
  console.log('================================================================');
  console.log('⏱️  LUMEN: TIMER SERVICE TIMESTAMP DIFF & PERSISTENCE TESTS');
  console.log('================================================================');

  // Limpeza inicial
  await clearTimerState();

  // ==========================================================================
  // SUITE 1: Persistência Básica do Estado do Timer
  // ==========================================================================
  console.log('\n--- SUITE 1: Persistência Básica do Estado do Timer ---');

  await test('Salva o estado no formato { mode, isRunning, accumulatedSeconds, lastSavedTimestamp }', async () => {
    const fixedNow = 1750000000000;
    const sampleState: SavedTimerState = {
      mode: 'stopwatch',
      isRunning: false,
      accumulatedSeconds: 125,
      lastSavedTimestamp: fixedNow,
      subjectId: 'subj_math_1',
    };

    const saved = await saveTimerState(sampleState);
    assertEqual(saved, true, 'saveTimerState retorna true');

    const raw = await mockAsyncStorage.getItem(TIMER_STATE_KEY);
    assert(raw !== null, 'TIMER_STATE_KEY foi escrito no AsyncStorage');
    const parsed = JSON.parse(raw!);
    assertEqual(parsed.mode, 'stopwatch', 'Modo gravado é stopwatch');
    assertEqual(parsed.isRunning, false, 'isRunning gravado é false');
    assertEqual(parsed.accumulatedSeconds, 125, 'accumulatedSeconds é 125');
    assertEqual(parsed.lastSavedTimestamp, fixedNow, 'lastSavedTimestamp é mantido');
    assertEqual(parsed.subjectId, 'subj_math_1', 'subjectId é mantido');

    const retrieved = await getTimerState();
    assert(retrieved !== null, 'getTimerState retorna objeto');
    assertEqual(retrieved?.accumulatedSeconds, 125, 'accumulatedSeconds corresponde');
  });

  await test('clearTimerState remove completamente o registro do AsyncStorage', async () => {
    await clearTimerState();
    const state = await getTimerState();
    assertEqual(state, null, 'getTimerState retorna null após limpeza');
  });

  // ==========================================================================
  // SUITE 2: Arquitetura Timestamp Diff no Cronômetro (Stopwatch)
  // ==========================================================================
  console.log('\n--- SUITE 2: Cronômetro (Stopwatch) & Timestamp Diff ---');

  await test('Cronômetro em execução: adiciona segundosDecorridos = (now - lastSavedTimestamp) / 1000', async () => {
    const originalTime = Date.now();
    const elapsedSimulated = 45; // 45 segundos decorridos
    const pastTimestamp = originalTime - (elapsedSimulated * 1000);

    // Estado antes de fechar o app / ir para segundo plano
    const stateBeforeBackground: SavedTimerState = {
      mode: 'stopwatch',
      isRunning: true,
      accumulatedSeconds: 100, // já tinha 100s
      lastSavedTimestamp: pastTimestamp,
    };

    await mockAsyncStorage.setItem(TIMER_STATE_KEY, JSON.stringify(stateBeforeBackground));

    // Restauração com Timestamp Diff
    const restored = await restoreTimerState();

    assert(restored !== null, 'restoreTimerState retorna estado restaurado');
    assertEqual(restored?.mode, 'stopwatch', 'Modo permanece stopwatch');
    assertEqual(restored?.isRunning, true, 'isRunning continua true');

    // accumulatedSeconds esperado: 100 + 45 = 145s (com margem de tolerância de 1s para o relógio da máquina de teste)
    const diff = Math.abs((restored?.accumulatedSeconds ?? 0) - 145);
    assert(diff <= 1, `accumulatedSeconds calibrado com precisão: obtido ${restored?.accumulatedSeconds}, esperado ~145`);

    // lastSavedTimestamp foi renovado para Date.now()
    assert(restored!.lastSavedTimestamp >= originalTime, 'lastSavedTimestamp atualizado para o instante da restauração');

    // Confirma que a nova calibração foi salva no storage
    const inStorage = await getTimerState();
    assertEqual(inStorage?.accumulatedSeconds, restored?.accumulatedSeconds, 'Estado persistido atualizado no storage');
  });

  await test('Cronômetro pausado: NÃO soma tempo decorrido ao accumulatedSeconds', async () => {
    const pastTimestamp = Date.now() - 300000; // 5 minutos atrás

    const pausedState: SavedTimerState = {
      mode: 'stopwatch',
      isRunning: false,
      accumulatedSeconds: 250,
      lastSavedTimestamp: pastTimestamp,
    };

    await saveTimerState(pausedState);

    const restored = await restoreTimerState();
    assert(restored !== null, 'Estado recuperado');
    assertEqual(restored?.isRunning, false, 'isRunning continua false');
    assertEqual(restored?.accumulatedSeconds, 250, 'accumulatedSeconds congelado exatamente em 250s');
  });

  // ==========================================================================
  // SUITE 3: Arquitetura Timestamp Diff no Pomodoro
  // ==========================================================================
  console.log('\n--- SUITE 3: Pomodoro & Dedução de Tempo Restante ---');

  await test('Pomodoro em execução: soma ao accumulatedSeconds e deduz de remainingSeconds', async () => {
    const targetDuration = 1500; // 25 min (1500s)
    const simulatedElapsed = 300; // 5 minutos em segundo plano (300s)
    const pastTimestamp = Date.now() - (simulatedElapsed * 1000);

    const pomodoroBeforeBg: SavedTimerState = {
      mode: 'pomodoro',
      isRunning: true,
      accumulatedSeconds: 200, // já tinha 200s estudados
      lastSavedTimestamp: pastTimestamp,
      targetDuration,
      remainingSeconds: 1300,
    };

    await mockAsyncStorage.setItem(TIMER_STATE_KEY, JSON.stringify(pomodoroBeforeBg));

    const restored = await restoreTimerState();

    assert(restored !== null, 'Pomodoro restaurado');
    assertEqual(restored?.mode, 'pomodoro', 'Modo é pomodoro');
    assertEqual(restored?.isRunning, true, 'Continua executando pois ainda não atingiu o limite');

    // accumulatedSeconds: 200 + 300 = 500s
    const accDiff = Math.abs((restored?.accumulatedSeconds ?? 0) - 500);
    assert(accDiff <= 1, `accumulatedSeconds acumulou tempo decorrido: obtido ${restored?.accumulatedSeconds}, esperado ~500`);

    // remainingSeconds: 1500 - 500 = 1000s
    const remDiff = Math.abs((restored?.remainingSeconds ?? 0) - 1000);
    assert(remDiff <= 1, `remainingSeconds foi reduzido proporcionalmente: obtido ${restored?.remainingSeconds}, esperado ~1000`);
  });

  await test('Pomodoro que estourou o limite em segundo plano: pausa e finaliza automaticamente', async () => {
    const targetDuration = 1500; // 25 min (1500s)
    // Simula que ficou 35 minutos fora (2100s > 1500s)
    const pastTimestamp = Date.now() - (2100 * 1000);

    const overflowPomodoro: SavedTimerState = {
      mode: 'pomodoro',
      isRunning: true,
      accumulatedSeconds: 100,
      lastSavedTimestamp: pastTimestamp,
      targetDuration,
      remainingSeconds: 1400,
    };

    await mockAsyncStorage.setItem(TIMER_STATE_KEY, JSON.stringify(overflowPomodoro));

    const restored = await restoreTimerState();

    assert(restored !== null, 'Pomodoro overflow restaurado');
    assertEqual(restored?.mode, 'pomodoro', 'Modo é pomodoro');
    assertEqual(restored?.isRunning, false, 'isRunning configurado como false (pausado/finalizado)');
    assertEqual(restored?.accumulatedSeconds, targetDuration, 'accumulatedSeconds travado na duração total (1500s)');
    assertEqual(restored?.remainingSeconds, 0, 'remainingSeconds travado em 0 (ciclo finalizado)');

    // Persistência também reflete que o ciclo finalizou
    const persisted = await getTimerState();
    assertEqual(persisted?.isRunning, false, 'Persistência no storage agora marca isRunning: false');
    assertEqual(persisted?.remainingSeconds, 0, 'Persistência no storage marca remainingSeconds: 0');
  });

  await test('Pomodoro pausado antes de segundo plano: tempo permanece intacto', async () => {
    const pastTimestamp = Date.now() - 600000;

    const pausedPomodoro: SavedTimerState = {
      mode: 'pomodoro',
      isRunning: false,
      accumulatedSeconds: 600,
      lastSavedTimestamp: pastTimestamp,
      targetDuration: 1500,
      remainingSeconds: 900,
    };

    await saveTimerState(pausedPomodoro);

    const restored = await restoreTimerState();
    assertEqual(restored?.isRunning, false, 'isRunning permanece false');
    assertEqual(restored?.accumulatedSeconds, 600, 'accumulatedSeconds permanece 600s');
    assertEqual(restored?.remainingSeconds, 900, 'remainingSeconds permanece 900s');
  });

  // ==========================================================================
  // SUITE 4: Resiliência Defensiva e Edge Cases de Relógio
  // ==========================================================================
  console.log('\n--- SUITE 4: Resiliência Defensiva e Anomalias de Clock ---');

  await test('Retrocesso de relógio do sistema (Date.now() < lastSavedTimestamp) não subtrai tempo', async () => {
    // Simula anomalia onde lastSavedTimestamp está 1 hora no futuro
    const futureTimestamp = Date.now() + 3600000;

    const glitchState: SavedTimerState = {
      mode: 'stopwatch',
      isRunning: true,
      accumulatedSeconds: 300,
      lastSavedTimestamp: futureTimestamp,
    };

    await mockAsyncStorage.setItem(TIMER_STATE_KEY, JSON.stringify(glitchState));

    const restored = await restoreTimerState();
    assert(restored !== null, 'Estado restaurado mesmo com retrocesso de relógio');
    assertEqual(restored?.accumulatedSeconds, 300, 'accumulatedSeconds não foi reduzido (Math.max(0, ...) clamp)');
  });

  await test('JSON corrompido em TIMER_STATE_KEY não lança exceção e retorna null', async () => {
    await mockAsyncStorage.setItem(TIMER_STATE_KEY, '{{malformed:json,,,');
    const result = await restoreTimerState();
    assertEqual(result, null, 'restoreTimerState trata JSON corrompido retornando null de forma segura');
  });

  await test('Objeto com modo desconhecido retorna null', async () => {
    await mockAsyncStorage.setItem(TIMER_STATE_KEY, JSON.stringify({ mode: 'unsupported_mode', isRunning: true }));
    const result = await restoreTimerState();
    assertEqual(result, null, 'Modo inválido retorna null');
  });

  // ==========================================================================
  // SUITE 5: Interoperabilidade e Delegação com StorageService
  // ==========================================================================
  console.log('\n--- SUITE 5: Interoperabilidade & StorageService ---');

  await test('toActiveTimerState converte SavedTimerState para ActiveTimerState com targetEndTime', () => {
    const fixedNow = 1750000000000;
    const saved: SavedTimerState = {
      mode: 'pomodoro',
      isRunning: true,
      accumulatedSeconds: 300,
      lastSavedTimestamp: fixedNow,
      targetDuration: 1500,
      remainingSeconds: 1200,
      subjectId: 'subj_math',
    };

    const active = toActiveTimerState(saved);
    assert(active !== null, 'activeTimerState gerado com sucesso');
    assertEqual(active?.mode, 'pomodoro', 'Modo é pomodoro');
    assertEqual(active?.isRunning, true, 'isRunning é true');
    assertEqual(active?.remainingSeconds, 1200, 'remainingSeconds é 1200');
    assertEqual(active?.initialDuration, 1500, 'initialDuration é 1500');
    assertEqual(active?.targetEndTime, fixedNow + (1200 * 1000), 'targetEndTime calculado a partir de lastSavedTimestamp + remaining');
  });

  await test('fromActiveTimerState converte ActiveTimerState existente para SavedTimerState', () => {
    const active: ActiveTimerState = {
      mode: 'pomodoro',
      isRunning: true,
      startedAt: Date.now() - 300000,
      targetEndTime: Date.now() + 1200000,
      remainingSeconds: 1200,
      initialDuration: 1500,
      subjectId: 'subj_cs_101',
    };

    const saved = fromActiveTimerState(active);
    assert(saved !== null, 'SavedTimerState gerado com sucesso');
    assertEqual(saved?.mode, 'pomodoro', 'Modo é pomodoro');
    assertEqual(saved?.isRunning, true, 'isRunning é true');
    assertEqual(saved?.targetDuration, 1500, 'targetDuration preservado');
  });

  await test('StorageService delega saveTimerState e restoreTimerState corretamente', async () => {
    const state: SavedTimerState = {
      mode: 'stopwatch',
      isRunning: true,
      accumulatedSeconds: 50,
      lastSavedTimestamp: Date.now(),
    };

    const saved = await StorageService.saveTimerState(state);
    assertEqual(saved, true, 'StorageService.saveTimerState salva com sucesso');

    const restored = await StorageService.restoreTimerState();
    assert(restored !== null, 'StorageService.restoreTimerState recupera o estado');
    assertEqual(restored?.mode, 'stopwatch', 'Modo stopwatch restaurado');

    await StorageService.clearTimerState();
    const cleared = await StorageService.getSavedTimerState();
    assertEqual(cleared, null, 'StorageService.clearTimerState limpa com sucesso');
  });

  console.log('\n================================================================');
  console.log(`TIMER SERVICE TESTS SUMMARY: ${passedTests}/${totalTests} Tests Passed (${failedTests} Failed)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTimerServiceTimestampDiffTests().catch(err => {
  console.error('Fatal error in timer service tests:', err);
  process.exit(1);
});
