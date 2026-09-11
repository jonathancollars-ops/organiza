/**
 * Universal, Hermes-safe AbortSignal generator with automatic timeout.
 * 
 * In React Native Hermes engine (Android standalone/release builds),
 * static method `AbortSignal.timeout` is not implemented (undefined),
 * causing runtime TypeErrors ("undefined is not a function").
 * 
 * This utility safely delegates to `AbortSignal.timeout(ms)` when supported,
 * falling back to an AbortController with setTimeout for universal compatibility.
 */
export function getTimeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function') {
    try {
      return (AbortSignal as any).timeout(ms);
    } catch {
      // fallback defensivo caso a chamada falhe em runtime
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => {
    try {
      controller.abort();
    } catch {
      // Ignored safely
    }
  }, ms);

  // Unref timer in Node environments if available so it doesn't hold the event loop open
  if (typeof timer === 'object' && timer !== null && typeof (timer as any).unref === 'function') {
    (timer as any).unref();
  }

  return controller.signal;
}
