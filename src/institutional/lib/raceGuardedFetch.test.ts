import { describe, it, expect, vi } from "vitest";
import { createRaceGuard } from "./raceGuardedFetch";

/**
 * Deferred promise helper so tests can resolve fetches in arbitrary order
 * and simulate rapid expand/collapse / signal switching.
 */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("createRaceGuard — rapid expand/collapse race protection", () => {
  it("only delivers the LATEST result to onResult when two fetches race", async () => {
    const onResult = vi.fn<(v: string) => void>();
    const guard = createRaceGuard<string>({ onResult });

    const first = deferred<string>();
    const second = deferred<string>();

    // Start first request (e.g., user expands signal A).
    const p1 = guard.run(() => first.promise);
    // Immediately start second request (e.g., user expands signal B).
    const p2 = guard.run(() => second.promise);

    // Resolve the first (stale) request LAST to maximise race chance.
    second.resolve("latest");
    first.resolve("stale");

    await Promise.all([p1, p2]);

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith("latest");
  });

  it("discards an in-flight result when cancel() is called (collapse)", async () => {
    const onResult = vi.fn<(v: string) => void>();
    const guard = createRaceGuard<string>({ onResult });

    const d = deferred<string>();
    const p = guard.run(() => d.promise);

    // User collapses the row before the fetch settles.
    guard.cancel();

    d.resolve("stale-after-collapse");
    await p;

    expect(onResult).not.toHaveBeenCalled();
  });

  it("aborts the previous request's AbortSignal when superseded", async () => {
    const guard = createRaceGuard<string>({ onResult: () => {} });
    const signals: AbortSignal[] = [];

    const d1 = deferred<string>();
    const d2 = deferred<string>();

    const p1 = guard.run((sig) => { signals.push(sig); return d1.promise; });
    const p2 = guard.run((sig) => { signals.push(sig); return d2.promise; });

    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);

    d1.resolve("a");
    d2.resolve("b");
    await Promise.all([p1, p2]);
  });

  it("delivers results from many rapid sequential fetches: only the last wins", async () => {
    const onResult = vi.fn<(v: number) => void>();
    const guard = createRaceGuard<number>({ onResult });

    const deferreds = Array.from({ length: 5 }, () => deferred<number>());
    const runs = deferreds.map((d, i) => guard.run(() => d.promise.then(() => i)));

    // Resolve out of order — earlier ones last.
    deferreds[4].resolve(4);
    deferreds[2].resolve(2);
    deferreds[0].resolve(0);
    deferreds[3].resolve(3);
    deferreds[1].resolve(1);

    await Promise.all(runs);

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith(4);
  });

  it("toggles onLoadingChange correctly across superseded requests", async () => {
    const events: boolean[] = [];
    const guard = createRaceGuard<string>({
      onResult: () => {},
      onLoadingChange: (l) => events.push(l),
    });

    const d1 = deferred<string>();
    const d2 = deferred<string>();

    const p1 = guard.run(() => d1.promise);
    const p2 = guard.run(() => d2.promise);

    d1.resolve("stale");
    d2.resolve("latest");
    await Promise.all([p1, p2]);

    // Loading must end true → false exactly once for the winning request.
    expect(events[0]).toBe(true);
    expect(events[events.length - 1]).toBe(false);
    // The superseded request must NOT have flipped loading back to false.
    const falseCount = events.filter((e) => e === false).length;
    expect(falseCount).toBe(1);
  });

  it("does not call onError when a request is superseded mid-flight", async () => {
    const onError = vi.fn();
    const guard = createRaceGuard<string>({ onResult: () => {}, onError });

    const d1 = deferred<string>();
    const d2 = deferred<string>();

    const p1 = guard.run(() => d1.promise);
    const p2 = guard.run(() => d2.promise);

    // First request fails AFTER being superseded — must not surface.
    d1.reject(new Error("network blew up"));
    d2.resolve("ok");
    await Promise.all([p1, p2]);

    expect(onError).not.toHaveBeenCalled();
  });
});