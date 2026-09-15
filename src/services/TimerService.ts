import AsyncStorage from '@react-native-async-storage/async-storage';
import { SavedTimerState, ActiveTimerState } from '../types';
import { safeSetItem } from './storage';

export const TIMER_STATE_KEY = '@organiza_timer_state';
export const ACTIVE_TIMER_KEY = '@organiza_active_timer';

/**
 * Converte SavedTimerState (arquitetura Timestamp Diff) para ActiveTimerState
 * para manter 100% de compatibilidade com telas e serviços existentes.
 */
export function toActiveTimerState(saved: SavedTimerState | null): ActiveTimerState | null {
  if (!saved) return null;

  const now = saved.lastSavedTimestamp || Date.now();
  const targetDuration = saved.targetDuration ?? saved.initialDuration ?? (saved.mode === 'pomodoro' ? 25 * 60 : 0);

  if (saved.mode === 'pomodoro') {
    const remaining = saved.remainingSeconds !== undefined
      ? saved.remainingSeconds
      : Math.max(0, targetDuration - saved.accumulatedSeconds);

    return {
      mode: 'pomodoro',
      isRunning: saved.isRunning,
      startedAt: now - (saved.accumulatedSeconds * 1000),
      targetEndTime: saved.isRunning ? now + (remaining * 1000) : undefined,
      remainingSeconds: remaining,
      initialDuration: targetDuration,
      subjectId: saved.subjectId,
      isBreak: saved.isBreak,
    };
  } else {
    return {
      mode: 'stopwatch',
      isRunning: saved.isRunning,
      startedAt: now - (saved.accumulatedSeconds * 1000),
      targetEndTime: undefined,
      remainingSeconds: saved.accumulatedSeconds,
      initialDuration: 0,
      subjectId: saved.subjectId,
      isBreak: false,
    };
  }
}

/**
 * Converte ActiveTimerState existente para SavedTimerState.
 */
export function fromActiveTimerState(active: ActiveTimerState | null): SavedTimerState | null {
  if (!active) return null;

  const now = Date.now();
  if (active.mode === 'pomodoro') {
    const targetDuration = active.initialDuration || 25 * 60;
    let accumulated = 0;
    if (active.isRunning && active.targetEndTime) {
      const remaining = Math.max(0, Math.round((active.targetEndTime - now) / 1000));
      accumulated = Math.max(0, targetDuration - remaining);
    } else {
      accumulated = Math.max(0, targetDuration - active.remainingSeconds);
    }

    return {
      mode: 'pomodoro',
      isRunning: active.isRunning,
      accumulatedSeconds: accumulated,
      lastSavedTimestamp: now,
      targetDuration,
      remainingSeconds: Math.max(0, targetDuration - accumulated),
      initialDuration: targetDuration,
      subjectId: active.subjectId,
      isBreak: active.isBreak,
    };
  } else {
    const elapsed = active.isRunning
      ? Math.max(0, Math.floor((now - active.startedAt) / 1000))
      : active.remainingSeconds;

    return {
      mode: 'stopwatch',
      isRunning: active.isRunning,
      accumulatedSeconds: elapsed,
      lastSavedTimestamp: now,
      targetDuration: 0,
      remainingSeconds: elapsed,
      initialDuration: 0,
      subjectId: active.subjectId,
      isBreak: false,
    };
  }
}

/**
 * Salva o estado atual do timer no AsyncStorage com tratamento defensivo.
 * Formato: { mode: 'pomodoro' | 'stopwatch', isRunning: boolean, accumulatedSeconds: number, lastSavedTimestamp: number }
 */
export async function saveTimerState(state: SavedTimerState | null): Promise<boolean> {
  try {
    if (!state) {
      await AsyncStorage.removeItem(TIMER_STATE_KEY);
      await AsyncStorage.removeItem(ACTIVE_TIMER_KEY);
      return true;
    }

    const safeAccumulated = Number.isFinite(state.accumulatedSeconds)
      ? Math.max(0, Math.floor(state.accumulatedSeconds))
      : 0;

    const safeLastTimestamp = Number.isFinite(state.lastSavedTimestamp) && state.lastSavedTimestamp > 0
      ? state.lastSavedTimestamp
      : Date.now();

    const targetDuration = Number.isFinite(state.targetDuration)
      ? Math.max(0, Number(state.targetDuration))
      : Number.isFinite(state.initialDuration)
        ? Math.max(0, Number(state.initialDuration))
        : state.mode === 'pomodoro' ? 25 * 60 : 0;

    const remainingSeconds = Number.isFinite(state.remainingSeconds)
      ? Math.max(0, Number(state.remainingSeconds))
      : (state.mode === 'pomodoro' ? Math.max(0, targetDuration - safeAccumulated) : safeAccumulated);

    const sanitizedState: SavedTimerState = {
      mode: state.mode,
      isRunning: Boolean(state.isRunning),
      accumulatedSeconds: safeAccumulated,
      lastSavedTimestamp: safeLastTimestamp,
      targetDuration,
      remainingSeconds,
      initialDuration: targetDuration,
      ...(state.subjectId ? { subjectId: state.subjectId } : {}),
      ...(state.isBreak !== undefined ? { isBreak: state.isBreak } : {}),
    };

    const jsonValue = JSON.stringify(sanitizedState);
    const success = await safeSetItem(TIMER_STATE_KEY, jsonValue);

    // Sincroniza com ACTIVE_TIMER_KEY para compatibilidade transparente
    const activeCompat = toActiveTimerState(sanitizedState);
    if (activeCompat) {
      await safeSetItem(ACTIVE_TIMER_KEY, JSON.stringify(activeCompat));
    } else {
      await AsyncStorage.removeItem(ACTIVE_TIMER_KEY);
    }

    return success;
  } catch (error) {
    console.error('[TimerService] Erro ao salvar timer state:', error);
    return false;
  }
}

/**
 * Lê o estado armazenado sem aplicar avanço de tempo ou mutação.
 */
export async function getTimerState(): Promise<SavedTimerState | null> {
  try {
    const raw = await AsyncStorage.getItem(TIMER_STATE_KEY);
    if (raw && typeof raw === 'string' && raw.trim() !== '' && raw !== 'null') {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && (parsed.mode === 'pomodoro' || parsed.mode === 'stopwatch')) {
          return parsed as SavedTimerState;
        }
      } catch (err) {
        console.error('[TimerService] JSON corrompido em TIMER_STATE_KEY:', err);
        return null;
      }
      return null;
    }

    // Fallback: se TIMER_STATE_KEY ainda não foi gravado, tenta migrar de ACTIVE_TIMER_KEY legado
    const activeRaw = await AsyncStorage.getItem(ACTIVE_TIMER_KEY);
    if (activeRaw && typeof activeRaw === 'string' && activeRaw.trim() !== '' && activeRaw !== 'null') {
      try {
        const legacyActive = JSON.parse(activeRaw);
        if (legacyActive && typeof legacyActive === 'object' && (legacyActive.mode === 'pomodoro' || legacyActive.mode === 'stopwatch')) {
          return fromActiveTimerState(legacyActive as ActiveTimerState);
        }
      } catch {
        return null;
      }
    }

    return null;
  } catch (err) {
    console.error('[TimerService] Erro ao obter timer state:', err);
    return null;
  }
}

/**
 * Restaura o estado do timer aplicando a arquitetura de "Timestamp Diff".
 * 
 * LÓGICA CRÍTICA:
 * Se o estado recuperado indicar que isRunning === true:
 * 1. Calcula: segundosDecorridos = (Date.now() - lastSavedTimestamp) / 1000
 * 2. Soma esses segundosDecorridos ao accumulatedSeconds (e deduz do remainingSeconds se for Pomodoro).
 * 3. Se for Pomodoro e o tempo estourar o limite (accumulatedSeconds >= targetDuration),
 *    configura o estado como pausado/finalizado (isRunning = false, remainingSeconds = 0, accumulatedSeconds = targetDuration).
 * 4. Atualiza lastSavedTimestamp para Date.now() e persiste o novo estado calibrado.
 */
export async function restoreTimerState(): Promise<SavedTimerState | null> {
  try {
    const current = await getTimerState();
    if (!current) {
      return null;
    }

    const now = Date.now();
    const mode = current.mode;
    let isRunning = Boolean(current.isRunning);
    let accumulatedSeconds = Number.isFinite(current.accumulatedSeconds)
      ? Math.max(0, Math.floor(Number(current.accumulatedSeconds)))
      : 0;
    const lastSavedTimestamp = Number.isFinite(current.lastSavedTimestamp) && current.lastSavedTimestamp > 0
      ? Number(current.lastSavedTimestamp)
      : now;

    const targetDuration = Number.isFinite(current.targetDuration)
      ? Math.max(0, Number(current.targetDuration))
      : Number.isFinite(current.initialDuration)
        ? Math.max(0, Number(current.initialDuration))
        : mode === 'pomodoro' ? 25 * 60 : 0;

    let remainingSeconds = Number.isFinite(current.remainingSeconds)
      ? Math.max(0, Number(current.remainingSeconds))
      : (mode === 'pomodoro' ? Math.max(0, targetDuration - accumulatedSeconds) : accumulatedSeconds);

    if (isRunning) {
      // Diferença de tempo exata em segundos decorridos (sem drift de setInterval)
      const segundosDecorridos = Math.max(0, Math.floor((now - lastSavedTimestamp) / 1000));

      if (mode === 'stopwatch') {
        accumulatedSeconds += segundosDecorridos;
        remainingSeconds = accumulatedSeconds;
      } else if (mode === 'pomodoro') {
        accumulatedSeconds += segundosDecorridos;
        const limit = targetDuration > 0 ? targetDuration : 1500;

        if (accumulatedSeconds >= limit) {
          // Pomodoro finalizado em segundo plano/fechamento
          accumulatedSeconds = limit;
          remainingSeconds = 0;
          isRunning = false; // Pausado / finalizado conforme especificação
        } else {
          remainingSeconds = Math.max(0, limit - accumulatedSeconds);
        }
      }
    }

    const restoredState: SavedTimerState = {
      mode,
      isRunning,
      accumulatedSeconds,
      lastSavedTimestamp: now,
      targetDuration,
      remainingSeconds,
      initialDuration: targetDuration,
      ...(current.subjectId ? { subjectId: current.subjectId } : {}),
      ...(current.isBreak !== undefined ? { isBreak: current.isBreak } : {}),
    };

    // Persiste o estado calibrado com o novo timestamp
    await saveTimerState(restoredState);

    return restoredState;
  } catch (err) {
    console.error('[TimerService] Erro ao restaurar timer state com Timestamp Diff:', err);
    return null;
  }
}

/**
 * Remove completamente o estado do timer do storage.
 */
export async function clearTimerState(): Promise<boolean> {
  return await saveTimerState(null);
}

/**
 * Pausa o timer atual e congela accumulatedSeconds e remainingSeconds.
 */
export async function pauseCurrentTimer(): Promise<SavedTimerState | null> {
  const current = await restoreTimerState();
  if (!current) return null;

  const updated: SavedTimerState = {
    ...current,
    isRunning: false,
    lastSavedTimestamp: Date.now(),
  };

  await saveTimerState(updated);
  return updated;
}

/**
 * Retoma o timer atual a partir do ponto congelado.
 */
export async function resumeCurrentTimer(): Promise<SavedTimerState | null> {
  const current = await getTimerState();
  if (!current) return null;

  const now = Date.now();
  const updated: SavedTimerState = {
    ...current,
    isRunning: true,
    lastSavedTimestamp: now,
  };

  await saveTimerState(updated);
  return updated;
}

export const TimerService = {
  TIMER_STATE_KEY,
  ACTIVE_TIMER_KEY,
  saveTimerState,
  restoreTimerState,
  getTimerState,
  clearTimerState,
  pauseCurrentTimer,
  resumeCurrentTimer,
  toActiveTimerState,
  fromActiveTimerState,
};
