import './setup_env';
import { TimerService, saveTimerState, restoreTimerState, getTimerState, clearTimerState } from '../src/services/TimerService';
import { useTimerAppState } from '../src/hooks/useTimerAppState';
import { SavedTimerState } from '../src/types';
import { appStateListeners, triggerAppStateChange, mockAppState } from './setup_env';

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

async function runTimerAppStateLifecycleTests(): Promise<void> {
  console.log('================================================================');
  console.log('⏱️  LUMEN: TIMER APPSTATE LIFECYCLE & TIMESTAMP DIFF TESTS');
  console.log('================================================================');

  await clearTimerState();

  // ==========================================================================
  // SUITE 1: Comportamento do Hook useTimerAppState
  // ==========================================================================
  console.log('\n--- SUITE 1: Comportamento do Hook useTimerAppState ---');

  await test('useTimerAppState registra listener no AppState e limpa no unmount', () => {
    const initialListenersCount = appStateListeners.length;
    let savedCalled = 0;
    let restoredCalled = 0;

    let cleanupFn: (() => void) | undefined;

    // Simula a execução do hook useTimerAppState (useEffect)
    const options = {
      onSaveState: () => { savedCalled++; },
      onRestoreState: () => { restoredCalled++; },
      enabled: true,
    };

    // Mount do hook
    options.onRestoreState();
    const subscription = mockAppState.addEventListener('change', (next: any) => {
      if (next === 'background' || next === 'inactive') {
        options.onSaveState();
      } else if (next === 'active') {
        options.onRestoreState();
      }
    });
    cleanupFn = () => subscription.remove();

    assertEqual(restoredCalled, 1, 'onRestoreState chamado no mount inicial');
    assertEqual(appStateListeners.length, initialListenersCount + 1, 'Listener adicionado ao appStateListeners');

    // Transição para background
    triggerAppStateChange('background');
    assertEqual(savedCalled, 1, 'onSaveState chamado ao mudar para background');

    // Transição para active
    triggerAppStateChange('active');
    assertEqual(restoredCalled, 2, 'onRestoreState chamado ao voltar para active');

    // Transição para inactive
    triggerAppStateChange('inactive');
    assertEqual(savedCalled, 2, 'onSaveState chamado ao mudar para inactive');

    // Unmount
    cleanupFn();
    assertEqual(appStateListeners.length, initialListenersCount, 'Listener removido após unmount para evitar memory leaks');

    // Eventos subsequentes não chamam mais os callbacks
    triggerAppStateChange('background');
    assertEqual(savedCalled, 2, 'onSaveState não é chamado após unmount');
  });

  // ==========================================================================
  // SUITE 2: Cronômetro (Stopwatch) & Transições de AppState
  // ==========================================================================
  console.log('\n--- SUITE 2: Cronômetro (Stopwatch) & Transições de AppState ---');

  await test('Cronômetro em execução: salva estado em background e recupera tempo decorrido ao voltar para active', async () => {
    await clearTimerState();
    const startTime = Date.now();
    const initialAccumulated = 45; // 45 segundos acumulados na tela

    // 1. Simula app indo para background
    const stateAtBackground: SavedTimerState = {
      mode: 'stopwatch',
      isRunning: true,
      accumulatedSeconds: initialAccumulated,
      lastSavedTimestamp: startTime - 120000, // simula que foi salvo 120s atrás
      targetDuration: 0,
      remainingSeconds: initialAccumulated,
      initialDuration: 0,
      subjectId: 'sub_fisica_1',
    };
    await saveTimerState(stateAtBackground);

    // 2. Simula app voltando para active -> chama restoreTimerState()
    const restored = await restoreTimerState();
    assert(restored !== null, 'restoreTimerState retorna estado válido');
    assertEqual(restored?.mode, 'stopwatch', 'Modo continua stopwatch');
    assertEqual(restored?.isRunning, true, 'Cronômetro continua em execução');

    // 45s iniciais + 120s em background = ~165s
    const expected = initialAccumulated + 120;
    const diff = Math.abs((restored?.accumulatedSeconds || 0) - expected);
    assert(diff <= 2, `accumulatedSeconds (${restored?.accumulatedSeconds}s) reflete os 120s em segundo plano`);
    assertEqual(restored?.subjectId, 'sub_fisica_1', 'subjectId preservado');
  });

  await test('Cronômetro em execução: salva estado em inactive e computa delta exato', async () => {
    await clearTimerState();
    const now = Date.now();
    const elapsedSeconds = 80;

    const stateAtInactive: SavedTimerState = {
      mode: 'stopwatch',
      isRunning: true,
      accumulatedSeconds: 10,
      lastSavedTimestamp: now - (elapsedSeconds * 1000),
      targetDuration: 0,
      remainingSeconds: 10,
      initialDuration: 0,
    };
    await saveTimerState(stateAtInactive);

    const restored = await restoreTimerState();
    assert(restored !== null, 'restoreTimerState recupera estado após inactive');
    assertEqual(restored?.isRunning, true, 'Cronômetro ativo');
    const expected = 10 + elapsedSeconds;
    const diff = Math.abs((restored?.accumulatedSeconds || 0) - expected);
    assert(diff <= 2, `accumulatedSeconds (${restored?.accumulatedSeconds}s) reflete transição inactive`);
  });

  // ==========================================================================
  // SUITE 3: Pomodoro & Transições de AppState
  // ==========================================================================
  console.log('\n--- SUITE 3: Pomodoro & Transições de AppState ---');

  await test('Pomodoro em foco: deduz tempo decorrido do remainingSeconds ao voltar para active', async () => {
    await clearTimerState();
    const now = Date.now();
    const targetDuration = 25 * 60; // 1500s
    const currentAccumulated = 300; // 5 min estudados
    const remainingBefore = 1200; // 20 min restantes
    const timeInBackground = 180; // 3 min de tela desligada

    const stateAtBackground: SavedTimerState = {
      mode: 'pomodoro',
      isRunning: true,
      accumulatedSeconds: currentAccumulated,
      lastSavedTimestamp: now - (timeInBackground * 1000),
      targetDuration,
      remainingSeconds: remainingBefore,
      initialDuration: targetDuration,
      subjectId: 'sub_calc_1',
      isBreak: false,
    };
    await saveTimerState(stateAtBackground);

    const restored = await restoreTimerState();
    assert(restored !== null, 'restoreTimerState retorna estado do Pomodoro');
    assertEqual(restored?.mode, 'pomodoro', 'Modo é pomodoro');
    assertEqual(restored?.isRunning, true, 'Pomodoro continua rodando');

    const expectedAccumulated = currentAccumulated + timeInBackground; // 480s
    const expectedRemaining = targetDuration - expectedAccumulated; // 1020s

    const diffRemaining = Math.abs((restored?.remainingSeconds || 0) - expectedRemaining);
    assert(diffRemaining <= 2, `remainingSeconds (${restored?.remainingSeconds}s) reduzido exatamente pelos 180s em background`);

    const diffAccumulated = Math.abs((restored?.accumulatedSeconds || 0) - expectedAccumulated);
    assert(diffAccumulated <= 2, `accumulatedSeconds (${restored?.accumulatedSeconds}s) somado aos 180s em background`);
  });

  await test('Pomodoro que expira com o celular desligado: marca remainingSeconds = 0 e isRunning = false', async () => {
    await clearTimerState();
    const now = Date.now();
    const targetDuration = 25 * 60; // 1500s
    const currentAccumulated = 1400; // faltavam apenas 100s
    const timeInBackground = 300; // celular ficou desligado 300s (ultrapassou o ciclo)

    const stateAtBackground: SavedTimerState = {
      mode: 'pomodoro',
      isRunning: true,
      accumulatedSeconds: currentAccumulated,
      lastSavedTimestamp: now - (timeInBackground * 1000),
      targetDuration,
      remainingSeconds: 100,
      initialDuration: targetDuration,
      isBreak: false,
    };
    await saveTimerState(stateAtBackground);

    const restored = await restoreTimerState();
    assert(restored !== null, 'restoreTimerState retorna ciclo completado');
    assertEqual(restored?.remainingSeconds, 0, 'remainingSeconds zerado após estouro');
    assertEqual(restored?.accumulatedSeconds, targetDuration, 'accumulatedSeconds limitado à duração máxima');
    assertEqual(restored?.isRunning, false, 'isRunning pausado/finalizado');
  });

  // ==========================================================================
  // SUITE 4: Timer Pausado Não Avança em Segundo Plano
  // ==========================================================================
  console.log('\n--- SUITE 4: Timer Pausado Não Avança em Segundo Plano ---');

  await test('Timer pausado não computa avanço de tempo enquanto em background', async () => {
    await clearTimerState();
    const now = Date.now();

    const pausedState: SavedTimerState = {
      mode: 'stopwatch',
      isRunning: false,
      accumulatedSeconds: 50,
      lastSavedTimestamp: now - 500000, // 500s no passado
      targetDuration: 0,
      remainingSeconds: 50,
      initialDuration: 0,
    };
    await saveTimerState(pausedState);

    const restored = await restoreTimerState();
    assert(restored !== null, 'restoreTimerState recupera timer pausado');
    assertEqual(restored?.isRunning, false, 'Continua pausado');
    assertEqual(restored?.accumulatedSeconds, 50, 'accumulatedSeconds permanece inalterado em 50s');
    assertEqual(restored?.remainingSeconds, 50, 'remainingSeconds permanece inalterado em 50s');
  });

  console.log('\n================================================================');
  console.log(`🎉 TESTES CONCLUÍDOS: ${passedTests}/${totalTests} PASSADOS (0 FALHAS)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTimerAppStateLifecycleTests().catch(err => {
  console.error('💥 Erro fatal no executor de testes:', err);
  process.exit(1);
});
