/**
 * Race-guarded async runner.
 *
 * Each call to `run(fn)` starts a new request, aborting any previously running
 * one. The resolved value is delivered to `onResult` ONLY if the request is
 * still the latest one when it finishes — so rapid expand/collapse / switching
 * can never let an older fetch overwrite a newer result.
 *
 * `cancel()` discards any in-flight request (used on collapse / unmount).
 */
export interface RaceGuard<T> {
  run: (fn: (signal: AbortSignal) => Promise<T>) => Promise<void>;
  cancel: () => void;
  /** Token of the currently-active request; -1 means none. Exposed for tests. */
  activeToken: () => number;
}

export interface RaceGuardHandlers<T> {
  onResult: (value: T) => void;
  onError?: (err: unknown) => void;
  onLoadingChange?: (loading: boolean) => void;
}

export function createRaceGuard<T>({ onResult, onError, onLoadingChange }: RaceGuardHandlers<T>): RaceGuard<T> {
  let seq = 0;
  let active = 0;
  let controller: AbortController | null = null;

  const cancel = () => {
    active = -1;
    controller?.abort();
    controller = null;
    onLoadingChange?.(false);
  };

  const run = async (fn: (signal: AbortSignal) => Promise<T>) => {
    controller?.abort();
    const c = new AbortController();
    controller = c;
    const token = ++seq;
    active = token;
    onLoadingChange?.(true);
    try {
      const value = await fn(c.signal);
      if (active !== token) return; // superseded or cancelled — discard
      onResult(value);
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      if (active !== token) return;
      onError?.(err);
    } finally {
      if (active === token) onLoadingChange?.(false);
      if (controller === c) controller = null;
    }
  };

  return { run, cancel, activeToken: () => active };
}