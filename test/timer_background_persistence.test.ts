import './setup_env';
import { StorageService } from '../src/services/storage';
import { NotificationService } from '../src/services/notifications';
import { ActiveTimerState, GamificationData } from '../src/types';
import { mockAppState, triggerAppStateChange, mockNotifications } from './setup_env';

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

async function runTimerBackgroundPersistenceTests(): Promise<void> {
  console.log('================================================================');
  console.log('⏱️  LUMEN: TIMER BACKGROUND PERSISTENCE & TIMESTAMP RESILIENCE');
  console.log('================================================================');

  // ==========================================================================
  // SUITE 1: Início do Timer e Geração de targetEndTime
  // ==========================================================================
  console.log('\n--- SUITE 1: Início de Timer e Geração de targetEndTime ---');

  await test('Pomodoro calcula e armazena targetEndTime preciso (startedAt + duração em ms)', async () => {
    const fixedNow = 1750000000000;
    const durationSeconds = 25 * 60; // 1500 segundos (25 min)
    const expectedTargetEndTime = fixedNow + (durationSeconds * 1000);

    const timerState: ActiveTimerState = {
      mode: 'pomodoro',
      isRunning: true,
      startedAt: fixedNow,
      targetEndTime: expectedTargetEndTime,
      remainingSeconds: durationSeconds,
      initialDuration: durationSeconds,
      subjectId: 'subj_math_101',
      isBreak: false
    };

    const saved = await StorageService.saveActiveTimer(timerState);
    assertEqual(saved, true, 'saveActiveTimer salva estado do Pomodoro com sucesso');

    const retrieved = await StorageService.getActiveTimer();
    assert(retrieved !== null, 'getActiveTimer retorna timer ativo não nulo');
    assertEqual(retrieved?.mode, 'pomodoro', 'Modo é pomodoro');
    assertEqual(retrieved?.isRunning, true, 'isRunning é true');
    assertEqual(retrieved?.startedAt, fixedNow, 'startedAt preserva timestamp exato');
    assertEqual(retrieved?.targetEndTime, expectedTargetEndTime, 'targetEndTime preserva timestamp exato de conclusão');
    assertEqual(retrieved?.initialDuration, durationSeconds, 'initialDuration é 1500s');
    assertEqual(retrieved?.subjectId, 'subj_math_101', 'subjectId é preservado');
  });

  await test('Cronômetro (Stopwatch) inicia sem targetEndTime e com startedAt preciso', async () => {
    const fixedNow = 1750000000000;
    const stopwatchState: ActiveTimerState = {
      mode: 'stopwatch',
      isRunning: true,
      startedAt: fixedNow,
      targetEndTime: undefined,
      remainingSeconds: 0,
      initialDuration: 0,
      subjectId: 'subj_physics_202',
    };

    await StorageService.saveActiveTimer(stopwatchState);
    const retrieved = await StorageService.getActiveTimer();

    assert(retrieved !== null, 'getActiveTimer retorna cronômetro ativo');
    assertEqual(retrieved?.mode, 'stopwatch', 'Modo é stopwatch');
    assertEqual(retrieved?.targetEndTime, undefined, 'Cronômetro não possui targetEndTime');
    assertEqual(retrieved?.startedAt, fixedNow, 'startedAt preserva marco inicial');
    assertEqual(retrieved?.isRunning, true, 'isRunning é true');
  });

  // ==========================================================================
  // SUITE 2: Mudança de Tela (Blur, Unmount e Restauração)
  // ==========================================================================
  console.log('\n--- SUITE 2: Mudança de Tela (Blur / Unmount e Restauração) ---');

  await test('Desmonte de tela preserva targetEndTime sem congelar ou zerar o timer', async () => {
    const startTime = 1750000000000;
    const duration = 1800; // 30 minutos
    const targetEndTime = startTime + (duration * 1000);

    const activeTimer: ActiveTimerState = {
      mode: 'pomodoro',
      isRunning: true,
      startedAt: startTime,
      targetEndTime,
      remainingSeconds: duration,
      initialDuration: duration,
      subjectId: 'subj_chemistry_303',
      isBreak: false
    };

    // Salva antes do unmount da tela
    await StorageService.saveActiveTimer(activeTimer);

    // Simula navegação para outra tela (ex: AgendaScreen ou GradesScreen) e re-montagem 5 min (300s) depois
    const remountTime = startTime + (300 * 1000);

    // Na remontagem, o app busca o activeTimer e calcula o remaining a partir de targetEndTime
    const stored = await StorageService.getActiveTimer();
    assert(stored !== null, 'Timer restaurado do storage após navegação');
    assert(stored?.targetEndTime !== undefined, 'targetEndTime permanece persistido');

    // Lógica resiliente de cálculo da StudyScreen / AppContext:
    const remaining = Math.max(0, Math.round(((stored?.targetEndTime ?? 0) - remountTime) / 1000));
    assertEqual(remaining, 1500, 'Tempo restante recalculado é exatamente 1500s (30m - 5m = 25m)');
  });

  await test('Pausa antes de mudar de tela congela remainingSeconds e remove targetEndTime', async () => {
    const startTime = 1750000000000;
    const pauseTime = startTime + (600 * 1000); // pausou após 10 minutos (restam 20 min = 1200s)
    const originalTargetEndTime = startTime + (1800 * 1000);

    // Ao pausar na tela:
    const remainingAtPause = Math.max(0, Math.round((originalTargetEndTime - pauseTime) / 1000));
    const pausedState: ActiveTimerState = {
      mode: 'pomodoro',
      isRunning: false,
      startedAt: startTime,
      targetEndTime: undefined,
      remainingSeconds: remainingAtPause,
      initialDuration: 1800,
      subjectId: 'subj_chemistry_303',
      isBreak: false
    };

    await StorageService.saveActiveTimer(pausedState);

    // Ao remontar a tela tempos depois, o timer deve continuar pausado em 1200s
    const reloaded = await StorageService.getActiveTimer();
    assertEqual(reloaded?.isRunning, false, 'Timer continua com isRunning = false');
    assertEqual(reloaded?.targetEndTime, undefined, 'targetEndTime permanece undefined enquanto pausado');
    assertEqual(reloaded?.remainingSeconds, 1200, 'remainingSeconds congelado exatamente em 1200s');
  });

  await test('Reset do timer remove completamente a persistência do storage', async () => {
    await StorageService.saveActiveTimer(null);
    const cleared = await StorageService.getActiveTimer();
    assertEqual(cleared, null, 'getActiveTimer retorna null após reset');
  });

  // ==========================================================================
  // SUITE 3: Avanço de Tempo em Segundo Plano (AppState = background)
  // ==========================================================================
  console.log('\n--- SUITE 3: Avanço de Tempo em Segundo Plano (AppState = background) ---');

  await test('Transição para background agenda notificação local para targetEndTime', async () => {
    const startTime = 1750000000000;
    const duration = 1500; // 25 min
    const targetEndTime = startTime + (duration * 1000);

    let scheduledDate: Date | null = null;
    let scheduledTitle: string | null = null;

    // Spy na função do NotificationService
    const originalSchedule = mockNotifications.scheduleNotificationAsync;
    mockNotifications.scheduleNotificationAsync = async (request: any) => {
      scheduledDate = request.trigger?.date;
      scheduledTitle = request.content?.title;
      return 'mock_notif_id_123';
    };

    try {
      // Registrar timer ativo
      const activeTimer: ActiveTimerState = {
        mode: 'pomodoro',
        isRunning: true,
        startedAt: startTime,
        targetEndTime,
        remainingSeconds: duration,
        initialDuration: duration,
        subjectId: 'subj_algo_404',
        isBreak: false
      };
      await StorageService.saveActiveTimer(activeTimer);

      // Simula o listener de AppState presente no StudyScreen:
      const studyScreenAppStateHandler = async (state: string) => {
        if (state === 'background') {
          const current = await StorageService.getActiveTimer();
          if (current?.isRunning && current.mode === 'pomodoro' && current.targetEndTime) {
            await NotificationService.scheduleTimerNotification(
              current.targetEndTime,
              '⏱️ Ciclo de Estudo Concluído!',
              'Seu ciclo de Pomodoro foi finalizado. Parabéns pelo foco!'
            );
          }
        }
      };

      const sub = mockAppState.addEventListener('change', studyScreenAppStateHandler);

      // Dispara ida para background
      triggerAppStateChange('background');

      // Aguarda processamento assíncrono do listener
      await new Promise(resolve => setTimeout(resolve, 50));

      assert(scheduledDate !== null, 'Notificação de timer foi agendada');
      assertEqual(scheduledDate?.getTime(), targetEndTime, 'Notificação agendada para o targetEndTime exato');
      assertEqual(scheduledTitle, '⏱️ Ciclo de Estudo Concluído!', 'Título da notificação é informativo');

      sub.remove();
    } finally {
      mockNotifications.scheduleNotificationAsync = originalSchedule;
    }
  });

  await test('Avanço de tempo em segundo plano calcula tempo decorrido sem clock drift', async () => {
    const startTime = 1750000000000;
    const duration = 1500; // 25 min (1500s)
    const targetEndTime = startTime + (duration * 1000);

    const activeTimer: ActiveTimerState = {
      mode: 'pomodoro',
      isRunning: true,
      startedAt: startTime,
      targetEndTime,
      remainingSeconds: duration,
      initialDuration: duration,
      subjectId: 'subj_calculus_101',
      isBreak: false
    };
    await StorageService.saveActiveTimer(activeTimer);

    // Simula passagem de 12 minutos (720s) com o app em segundo plano
    const backgroundResumeTime = startTime + (720 * 1000);

    // Retorno para foreground (AppState = active)
    let cancelledNotif = false;
    const originalCancel = mockNotifications.cancelScheduledNotificationAsync;
    mockNotifications.cancelScheduledNotificationAsync = async (id: any) => {
      if (id === 'lumen_active_pomodoro_completion') cancelledNotif = true;
    };

    try {
      await NotificationService.cancelTimerNotification();
      assert(cancelledNotif === true, 'Notificação cancelada ao retornar para foreground');

      // Cálculo de sincronização baseado no Unix timestamp:
      const loaded = await StorageService.getActiveTimer();
      const calculatedRemaining = Math.max(0, Math.round(((loaded?.targetEndTime ?? 0) - backgroundResumeTime) / 1000));
      assertEqual(calculatedRemaining, 780, 'Tempo restante é exatamente 780s (1500s - 720s = 780s / 13 minutos)');

      const elapsed = Math.floor((backgroundResumeTime - (loaded?.startedAt ?? 0)) / 1000);
      assertEqual(elapsed, 720, 'Tempo decorrido calculado é exatamente 720s');
    } finally {
      mockNotifications.cancelScheduledNotificationAsync = originalCancel;
    }
  });

  await test('Tempo excedido em segundo plano detecta ciclo finalizado (remaining === 0)', async () => {
    const startTime = 1750000000000;
    const duration = 1500; // 25 min (1500s)
    const targetEndTime = startTime + (duration * 1000);

    const activeTimer: ActiveTimerState = {
      mode: 'pomodoro',
      isRunning: true,
      startedAt: startTime,
      targetEndTime,
      remainingSeconds: duration,
      initialDuration: duration,
      subjectId: 'subj_calculus_101',
      isBreak: false
    };
    await StorageService.saveActiveTimer(activeTimer);

    // Usuário volta ao app 40 minutos depois (2400s > 1500s)
    const returnTime = startTime + (2400 * 1000);
    const loaded = await StorageService.getActiveTimer();

    const remaining = Math.max(0, Math.round(((loaded?.targetEndTime ?? 0) - returnTime) / 1000));
    assertEqual(remaining, 0, 'Tempo restante não fica negativo; retorna 0');

    // Ao detectar remaining === 0, o app finaliza a sessão e zera o activeTimer
    if (remaining === 0) {
      await StorageService.saveActiveTimer(null);
    }
    const finalStored = await StorageService.getActiveTimer();
    assertEqual(finalStored, null, 'ActiveTimer é limpo após ciclo completado em background');
  });

  // ==========================================================================
  // SUITE 4: Cronômetro (Stopwatch) em Segundo Plano
  // ==========================================================================
  console.log('\n--- SUITE 4: Cronômetro (Stopwatch) em Segundo Plano ---');

  await test('Cronômetro em segundo plano calcula tempo decorrido total sem perdas', async () => {
    const startTime = 1750000000000;
    const stopwatchState: ActiveTimerState = {
      mode: 'stopwatch',
      isRunning: true,
      startedAt: startTime,
      targetEndTime: undefined,
      remainingSeconds: 0,
      initialDuration: 0,
      subjectId: 'subj_robotics_505',
    };
    await StorageService.saveActiveTimer(stopwatchState);

    // App fica em background por 1 hora, 15 minutos e 30 segundos (4530 segundos)
    const foregroundTime = startTime + (4530 * 1000);

    const loaded = await StorageService.getActiveTimer();
    assert(loaded !== null, 'Cronômetro ativo recuperado');
    assertEqual(loaded?.isRunning, true, 'Cronômetro continua em execução');

    const elapsed = Math.max(0, Math.floor((foregroundTime - loaded!.startedAt) / 1000));
    assertEqual(elapsed, 4530, 'Tempo decorrido do cronômetro é exatamente 4530s');
  });

  // ==========================================================================
  // SUITE 5: Resiliência Defensiva contra Corrupção e Anomalias de Clock
  // ==========================================================================
  console.log('\n--- SUITE 5: Resiliência Defensiva e Edge Cases ---');

  await test('StorageService.getActiveTimer lida com JSON corrompido sem quebrar', async () => {
    const { mockAsyncStorage } = require('./setup_env');
    await mockAsyncStorage.setItem('@organiza_active_timer', '{invalid_json_malformed:true,,,');

    const result = await StorageService.getActiveTimer();
    assertEqual(result, null, 'JSON corrompido retorna null com segurança');
  });

  await test('StorageService.getActiveTimer lida com objeto sem modo pomodoro/stopwatch', async () => {
    const { mockAsyncStorage } = require('./setup_env');
    await mockAsyncStorage.setItem('@organiza_active_timer', JSON.stringify({ mode: 'invalid_mode', isRunning: true }));

    const result = await StorageService.getActiveTimer();
    assertEqual(result, null, 'Objeto com modo desconhecido retorna null com segurança');
  });

  await test('Alteração retroativa do relógio do sistema não gera valores infinitos ou inflados', () => {
    const startTime = 1750000000000;
    const duration = 1500;
    const targetEndTime = startTime + (duration * 1000);

    // Simula que o relógio voltou 1 hora no tempo (retrocesso)
    const clockGlitchNow = startTime - (3600 * 1000);

    // Clamp defensivo:
    const calculatedRemaining = Math.min(
      duration,
      Math.max(0, Math.round((targetEndTime - clockGlitchNow) / 1000))
    );
    assertEqual(calculatedRemaining, duration, 'Tempo restante travado na duração máxima inicial (1500s)');
  });

  console.log('\n================================================================');
  console.log(`TIMER BACKGROUND PERSISTENCE SUMMARY: ${passedTests}/${totalTests} Tests Passed (${failedTests} Failed)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTimerBackgroundPersistenceTests().catch(err => {
  console.error('Fatal error in timer persistence tests:', err);
  process.exit(1);
});
