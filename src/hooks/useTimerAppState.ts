import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export interface UseTimerAppStateOptions {
  /**
   * Callback executado imediatamente quando o aplicativo transita
   * para 'background' ou 'inactive' para persistir accumulatedSeconds e isRunning.
   */
  onSaveState: () => Promise<void> | void;

  /**
   * Callback executado quando o aplicativo retorna para 'active'
   * (ou na montagem inicial) para restaurar os dados com Timestamp Diff.
   */
  onRestoreState: () => Promise<void> | void;

  /**
   * Se falso, suspende a captura do AppState (útil para testes ou condições dinâmicas).
   * Padrão: true.
   */
  enabled?: boolean;
}

/**
 * Hook de arquitetura React Native para sincronizar o ciclo de vida do aplicativo (AppState)
 * com a persistência resiliente do timer (Cronômetro / Pomodoro) usando Timestamp Diff.
 * 
 * Garante:
 * 1. Persistência imediata do estado ao ir para 'background' ou 'inactive'.
 * 2. Restauração e sincronização visual imediata sem engasgos ao retornar para 'active'.
 * 3. Remoção do listener no unmount para evitar memory leaks.
 */
export function useTimerAppState({
  onSaveState,
  onRestoreState,
  enabled = true,
}: UseTimerAppStateOptions) {
  const onSaveRef = useRef(onSaveState);
  onSaveRef.current = onSaveState;

  const onRestoreRef = useRef(onRestoreState);
  onRestoreRef.current = onRestoreState;

  useEffect(() => {
    if (!enabled) return;

    // 1. Restauração no mount inicial do componente
    try {
      const maybePromise = onRestoreRef.current();
      if (maybePromise && typeof (maybePromise as Promise<void>).catch === 'function') {
        (maybePromise as Promise<void>).catch((err: unknown) => {
          console.warn('[useTimerAppState] Erro na restauração inicial:', err);
        });
      }
    } catch (err) {
      console.warn('[useTimerAppState] Exceção na restauração inicial:', err);
    }

    // 2. Escuta mudanças de AppState do React Native
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      try {
        if (nextAppState === 'background' || nextAppState === 'inactive') {
          await onSaveRef.current();
        } else if (nextAppState === 'active') {
          await onRestoreRef.current();
        }
      } catch (err) {
        console.warn('[useTimerAppState] Erro no listener de AppState:', err);
      }
    });

    // 3. Limpeza do listener no unmount para evitar memory leaks
    return () => {
      subscription.remove();
    };
  }, [enabled]);
}
