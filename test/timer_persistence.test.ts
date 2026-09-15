import './setup_env';
import {
  TimerService,
  saveTimerState,
  restoreTimerState,
  getTimerState,
  clearTimerState,
  pauseCurrentTimer,
  resumeCurrentTimer,
  toActiveTimerState,
  fromActiveTimerState,
  TIMER_STATE_KEY,
  ACTIVE_TIMER_KEY
} from '../src/services/TimerService';
import { StorageService } from '../src/services/storage';
import { SavedTimerState, ActiveTimerState } from '../src/types';
import { mockAsyncStorage, mockAppState, triggerAppStateChange } from './setup_env';

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
    console.error(`  ❌ [FAIL] ${message} (Esperado: ${String(expected)}, Obtido: ${String(actual)})`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  console.log(`\n--- Test: ${name} ---`);
  await fn();
}

// Utilitários de controle determinístico do relógio do sistema
let mockCurrentTime = 1750000000000;
const originalDateNow = Date.now;

function setSystemTime(timestamp: number): void {
  mockCurrentTime = timestamp;
  Date.now = () => mockCurrentTime;
}

function advanceSystemTime(ms: number): void {
  mockCurrentTime += ms;
  Date.now = () => mockCurrentTime;
}

function restoreRealTime(): void {
  Date.now = originalDateNow;
}

async function runTimerPersistenceTests(): Promise<void> {
  console.log('================================================================');
  console.log('⏱️  LUMEN: TIMER PERSISTENCE & TIMESTAMP DIFF E2E BATTERY');
  console.log('================================================================\n');

  try {
    // =========================================================================
    // CENÁRIO 1, 2 & 3: Timer iniciado (isRunning: true) com 0s, avanço de 10m
    // (600s) e restauração matemática para a interface.
    // =========================================================================
    console.log('--- CENÁRIOS 1, 2 & 3: Timer Iniciado (0s) + Avanço de 10 min (600s) ---');

    await test('Cenários 1, 2 e 3: Cronômetro iniciado em 0s no Timestamp X avança matematicamente para 600s após 10 minutos', async () => {
      await clearTimerState();

      // 1. Simula timer iniciado com 0s no Timestamp X
      const timestampX = 1750000000000;
      setSystemTime(timestampX);

      const initialRunningState: SavedTimerState = {
        mode: 'stopwatch',
        isRunning: true,
        accumulatedSeconds: 0,
        lastSavedTimestamp: timestampX,
        targetDuration: 0,
        remainingSeconds: 0,
        initialDuration: 0,
        subjectId: 'sub_calculo_1',
      };

      const saved = await saveTimerState(initialRunningState);
      assertEqual(saved, true, 'Timer iniciado com 0s salvo com sucesso no storage');

      // Verifica gravação no AsyncStorage
      const rawInStorage = await mockAsyncStorage.getItem(TIMER_STATE_KEY);
      assert(rawInStorage !== null, 'Chave TIMER_STATE_KEY gravada no AsyncStorage');
      const parsedInitial = JSON.parse(rawInStorage!);
      assertEqual(parsedInitial.accumulatedSeconds, 0, 'accumulatedSeconds inicial gravado é 0');
      assertEqual(parsedInitial.isRunning, true, 'isRunning gravado é true');
      assertEqual(parsedInitial.lastSavedTimestamp, timestampX, 'lastSavedTimestamp corresponde a Timestamp X');

      // 2. Avança o relógio do sistema em exatos 10 minutos (600 segundos)
      advanceSystemTime(600 * 1000); // 600.000 ms

      // 3. Executa a restauração com Timestamp Diff
      const restored = await restoreTimerState();

      assert(restored !== null, 'restoreTimerState retornou estado restaurado válido');
      assertEqual(restored?.mode, 'stopwatch', 'Modo mantido como stopwatch');
      assertEqual(restored?.isRunning, true, 'Timer permanece em execução (isRunning: true)');
      assertEqual(
        restored?.accumulatedSeconds,
        600,
        'Tempo acumulado saltou matematicamente para exatamente 600 segundos (10 minutos)'
      );
      assertEqual(
        restored?.remainingSeconds,
        600,
        'remainingSeconds no modo cronômetro espelha os 600 segundos decorridos'
      );
      assertEqual(
        restored?.lastSavedTimestamp,
        timestampX + 600000,
        'lastSavedTimestamp atualizado para o instante presente da restauração'
      );
      assertEqual(
        restored?.subjectId,
        'sub_calculo_1',
        'Vínculo com a disciplina sub_calculo_1 preservado'
      );

      // Valida adaptação para a camada de interface (ActiveTimerState)
      const activeState = toActiveTimerState(restored);
      assert(activeState !== null, 'toActiveTimerState converteu para ActiveTimerState com sucesso');
      assertEqual(activeState?.mode, 'stopwatch', 'ActiveTimerState modo é stopwatch');
      assertEqual(activeState?.isRunning, true, 'ActiveTimerState isRunning é true');
      assertEqual(activeState?.remainingSeconds, 600, 'Tempo retornado para a interface é de 600 segundos');

      // Confirma que o novo estado calibrado foi persistido no storage
      const persistedAfterRestore = await getTimerState();
      assertEqual(
        persistedAfterRestore?.accumulatedSeconds,
        600,
        'Estado calibrado de 600s foi salvo no storage para evitar retrabalho'
      );
    });

    // =========================================================================
    // CENÁRIO 4: Timer pausado (isRunning: false) com avanço de relógio
    // O tempo acumulado DEVE permanecer estático (não avança).
    // =========================================================================
    console.log('\n--- CENÁRIO 4: Timer Pausado (isRunning: false) com Relógio Avançado ---');

    await test('Cenário 4: Cronômetro pausado em 0s NÃO avança após 10 minutos', async () => {
      await clearTimerState();

      const timestampY = 1750005000000;
      setSystemTime(timestampY);

      const pausedZeroState: SavedTimerState = {
        mode: 'stopwatch',
        isRunning: false,
        accumulatedSeconds: 0,
        lastSavedTimestamp: timestampY,
        targetDuration: 0,
        remainingSeconds: 0,
        initialDuration: 0,
      };

      await saveTimerState(pausedZeroState);

      // Avança relógio do sistema em 10 minutos (600 segundos)
      advanceSystemTime(600 * 1000);

      // Executa restauração
      const restored = await restoreTimerState();

      assert(restored !== null, 'Estado pausado restaurado');
      assertEqual(restored?.isRunning, false, 'Timer continua pausado (isRunning: false)');
      assertEqual(
        restored?.accumulatedSeconds,
        0,
        'Segundos acumulados permanecem estáticos em 0s (não avança quando pausado)'
      );
    });

    await test('Cenário 4: Cronômetro pausado com tempo parcial acumulado (150s) permanece estático', async () => {
      await clearTimerState();

      const timestampZ = 1750010000000;
      setSystemTime(timestampZ);

      const pausedPartialState: SavedTimerState = {
        mode: 'stopwatch',
        isRunning: false,
        accumulatedSeconds: 150, // 2m30s já acumulados
        lastSavedTimestamp: timestampZ,
        targetDuration: 0,
        remainingSeconds: 150,
        initialDuration: 0,
        subjectId: 'sub_fisica_2',
      };

      await saveTimerState(pausedPartialState);

      // Avança 10 minutos (600s)
      advanceSystemTime(600 * 1000);

      const restored = await restoreTimerState();

      assert(restored !== null, 'Estado pausado restaurado');
      assertEqual(restored?.isRunning, false, 'isRunning continua false');
      assertEqual(
        restored?.accumulatedSeconds,
        150,
        'Segundos acumulados permanecem estáticos em exatos 150s sem qualquer incremento indevido'
      );
      assertEqual(
        restored?.remainingSeconds,
        150,
        'remainingSeconds permanece estático em 150s'
      );
      assertEqual(
        restored?.subjectId,
        'sub_fisica_2',
        'subjectId preservado'
      );
    });

    // =========================================================================
    // CENÁRIOS COMPLEMENTARES: Modo Pomodoro
    // =========================================================================
    console.log('\n--- SUITE COMPLEMENTAR: Pomodoro & Dedução de Tempo Restante ---');

    await test('Pomodoro em execução (alvo 25m = 1500s): avanço de 10m (600s) acumula 600s e deduz remaining para 900s', async () => {
      await clearTimerState();

      const baseTime = 1750020000000;
      setSystemTime(baseTime);

      const targetDuration = 1500; // 25 min

      const pomodoroRunning: SavedTimerState = {
        mode: 'pomodoro',
        isRunning: true,
        accumulatedSeconds: 0,
        lastSavedTimestamp: baseTime,
        targetDuration,
        remainingSeconds: targetDuration,
        initialDuration: targetDuration,
        subjectId: 'sub_quimica_1',
      };

      await saveTimerState(pomodoroRunning);

      // Avança 10 minutos (600s) em segundo plano
      advanceSystemTime(600 * 1000);

      const restored = await restoreTimerState();

      assert(restored !== null, 'Pomodoro restaurado com sucesso');
      assertEqual(restored?.mode, 'pomodoro', 'Modo é pomodoro');
      assertEqual(restored?.isRunning, true, 'Pomodoro continua em execução');
      assertEqual(
        restored?.accumulatedSeconds,
        600,
        'Pomodoro computou 600 segundos acumulados em background'
      );
      assertEqual(
        restored?.remainingSeconds,
        900,
        'Tempo restante deduzido com precisão matemática para 900s (15 min)'
      );

      // Interface
      const active = toActiveTimerState(restored);
      assertEqual(active?.remainingSeconds, 900, 'Interface recebe exatamente 900s restantes');
      assertEqual(active?.isRunning, true, 'Interface recebe isRunning = true');
    });

    await test('Pomodoro pausado com tempo restante: NÃO deduz nem avança após 10 minutos', async () => {
      await clearTimerState();

      const baseTime = 1750030000000;
      setSystemTime(baseTime);

      const pomodoroPaused: SavedTimerState = {
        mode: 'pomodoro',
        isRunning: false,
        accumulatedSeconds: 300, // 5 min feitos
        lastSavedTimestamp: baseTime,
        targetDuration: 1500,
        remainingSeconds: 1200, // 20 min restantes
        initialDuration: 1500,
      };

      await saveTimerState(pomodoroPaused);

      // Avança 10 minutos (600s)
      advanceSystemTime(600 * 1000);

      const restored = await restoreTimerState();

      assert(restored !== null, 'Pomodoro pausado restaurado');
      assertEqual(restored?.isRunning, false, 'isRunning permanece false');
      assertEqual(restored?.accumulatedSeconds, 300, 'accumulatedSeconds estático em 300s');
      assertEqual(restored?.remainingSeconds, 1200, 'remainingSeconds estático em 1200s');
    });

    await test('Pomodoro em execução com tempo excedido em segundo plano (overflow): finaliza e trava no limite', async () => {
      await clearTimerState();

      const baseTime = 1750040000000;
      setSystemTime(baseTime);

      const targetDuration = 1500; // 25 min

      const pomodoroRunning: SavedTimerState = {
        mode: 'pomodoro',
        isRunning: true,
        accumulatedSeconds: 0,
        lastSavedTimestamp: baseTime,
        targetDuration,
        remainingSeconds: targetDuration,
        initialDuration: targetDuration,
      };

      await saveTimerState(pomodoroRunning);

      // Usuário deixou o app em background por 35 minutos (2100s > 1500s)
      advanceSystemTime(2100 * 1000);

      const restored = await restoreTimerState();

      assert(restored !== null, 'Pomodoro overflow restaurado');
      assertEqual(
        restored?.accumulatedSeconds,
        1500,
        'accumulatedSeconds travado exatamente na duração alvo de 1500s'
      );
      assertEqual(
        restored?.remainingSeconds,
        0,
        'remainingSeconds zerado (ciclo concluído)'
      );
      assertEqual(
        restored?.isRunning,
        false,
        'Pomodoro finalizado passa automaticamente para isRunning = false'
      );
    });

    // =========================================================================
    // SUITE: Múltiplos Ciclos Sequenciais de Background e Foreground
    // =========================================================================
    console.log('\n--- SUITE: Múltiplos Ciclos Sequenciais Background / Foreground ---');

    await test('Múltiplas transições sucessivas acumulam tempo linearmente sem desvios', async () => {
      await clearTimerState();

      let currentTime = 1750050000000;
      setSystemTime(currentTime);

      // Início: 0s
      let state: SavedTimerState | null = {
        mode: 'stopwatch',
        isRunning: true,
        accumulatedSeconds: 0,
        lastSavedTimestamp: currentTime,
        targetDuration: 0,
        remainingSeconds: 0,
        initialDuration: 0,
      };
      await saveTimerState(state);

      // Ciclo 1: 3 minutos em background (180s)
      advanceSystemTime(180 * 1000);
      state = await restoreTimerState();
      assertEqual(state?.accumulatedSeconds, 180, 'Ciclo 1: 180s acumulados');

      // Ciclo 2: 7 minutos em background (420s)
      advanceSystemTime(420 * 1000);
      state = await restoreTimerState();
      assertEqual(state?.accumulatedSeconds, 600, 'Ciclo 2: 180s + 420s = 600s total');

      // Ciclo 3: Pausa por 5 minutos
      state = await pauseCurrentTimer();
      assertEqual(state?.isRunning, false, 'Ciclo 3: pausado com sucesso');
      advanceSystemTime(300 * 1000);
      state = await restoreTimerState();
      assertEqual(state?.accumulatedSeconds, 600, 'Ciclo 3: durante pausa mantém 600s');

      // Ciclo 4: Retoma e fica mais 4 minutos (240s) em background
      state = await resumeCurrentTimer();
      assertEqual(state?.isRunning, true, 'Ciclo 4: retomado com sucesso');
      advanceSystemTime(240 * 1000);
      state = await restoreTimerState();
      assertEqual(state?.accumulatedSeconds, 840, 'Ciclo 4: 600s + 240s = 840s total');
    });

    // =========================================================================
    // SUITE: Resiliência Defensiva e Edge Cases
    // =========================================================================
    console.log('\n--- SUITE: Resiliência Defensiva e Edge Cases ---');

    await test('Relógio retrocedido no sistema operacional (now < lastSavedTimestamp) não corrompe o timer', async () => {
      await clearTimerState();

      const futureTime = 1750060000000;
      setSystemTime(futureTime);

      const validState: SavedTimerState = {
        mode: 'stopwatch',
        isRunning: true,
        accumulatedSeconds: 500,
        lastSavedTimestamp: futureTime,
        targetDuration: 0,
        remainingSeconds: 500,
        initialDuration: 0,
      };
      await saveTimerState(validState);

      // Relógio do sistema foi adiantado/atrasado manualmente para 10 minutos atrás
      setSystemTime(futureTime - (600 * 1000));

      const restored = await restoreTimerState();
      assert(restored !== null, 'Restauração realizada sem erro');
      assertEqual(
        restored?.accumulatedSeconds,
        500,
        'accumulatedSeconds não decrementa nem fica negativo; mantém 500s seguros'
      );
    });

    await test('Storage vazio ou limpo retorna null de forma graciosa sem exceções', async () => {
      await clearTimerState();
      const emptyRestored = await restoreTimerState();
      assertEqual(emptyRestored, null, 'restoreTimerState retorna null quando não há timer ativo');
    });

    await test('JSON corrompido em TIMER_STATE_KEY não quebra a aplicação', async () => {
      await mockAsyncStorage.setItem(TIMER_STATE_KEY, '{invalid_corrupted_json_content');
      const recovered = await restoreTimerState();
      assertEqual(recovered, null, 'JSON corrompido é tratado e retorna null defensivamente');
    });

    await test('Compatibilidade transparente entre SavedTimerState e ActiveTimerState no StorageService', async () => {
      await clearTimerState();

      const fixedNow = 1750070000000;
      setSystemTime(fixedNow);

      const legacyActive: ActiveTimerState = {
        mode: 'stopwatch',
        isRunning: true,
        startedAt: fixedNow - (120 * 1000), // iniciado há 120s
        remainingSeconds: 120,
        initialDuration: 0,
        subjectId: 'sub_algebra',
      };

      // Salva via StorageService legado
      await StorageService.saveActiveTimer(legacyActive);

      // Lê via TimerService moderno
      const stateFromTimerService = await TimerService.getTimerState();
      assert(stateFromTimerService !== null, 'TimerService lê estado legado com sucesso');
      assertEqual(stateFromTimerService?.mode, 'stopwatch', 'Modo reconhecido');
      assertEqual(stateFromTimerService?.isRunning, true, 'isRunning reconhecido');
      assertEqual(stateFromTimerService?.subjectId, 'sub_algebra', 'subjectId reconhecido');

      // Avança 600s
      advanceSystemTime(600 * 1000);
      const restored = await TimerService.restoreTimerState();
      assertEqual(
        restored?.accumulatedSeconds,
        720,
        '120s legado + 600s background = 720s computados com sucesso'
      );
    });

    // =========================================================================
    // SUMÁRIO FINAL
    // =========================================================================
    console.log('\n================================================================');
    console.log(`🎉 TIMER PERSISTENCE TESTS: ${passedTests}/${totalTests} PASSADOS | ${failedTests} FALHAS`);
    console.log('================================================================\n');

    if (failedTests > 0) {
      process.exit(1);
    }
  } finally {
    restoreRealTime();
  }
}

runTimerPersistenceTests().catch(err => {
  console.error('💥 Erro fatal nos testes de persistência do timer:', err);
  process.exit(1);
});
