import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { SignalRow } from "./FraudRiskPanel";

// Supabase client is imported transitively by FraudRiskPanel; stub it so the
// test never touches the network. The component path under test injects its
// own `fetcher`, so the live client is never invoked here.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({}) },
}));

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const baseSignal = {
  code: "S1",
  label: "Document mismatch",
  severity: "high" as const,
  weight: 12,
  detail: "Detail line",
  evidence_ref: { source: "documents", file_name: "f.pdf" },
};

const evidence = (tag: string) => ({
  recorded_at: new Date("2024-01-01T00:00:00Z").toISOString(),
  fields: [
    { key: "File", value: `file-${tag}.pdf` },
    { key: "Marker", value: tag },
  ],
});

describe("SignalRow integration — rapid expand/collapse shows only the latest evidence", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("renders only the latest fetch's evidence after rapid expand → collapse → expand", async () => {
    const first = deferred<ReturnType<typeof evidence>>();
    const second = deferred<ReturnType<typeof evidence>>();
    const calls: AbortSignal[] = [];
    let callIdx = 0;

    const fetcher = vi.fn(async (_s: typeof baseSignal, _u: string | null | undefined, sig?: AbortSignal) => {
      if (sig) calls.push(sig);
      const idx = callIdx++;
      return idx === 0 ? first.promise : second.promise;
    });

    // Parent owns the cache so we can verify what makes it into shared state.
    let cached: ReturnType<typeof evidence> | undefined;
    const onCache = vi.fn((ev: ReturnType<typeof evidence>) => { cached = ev; });

    const { container } = render(
      <SignalRow signal={baseSignal} userId="u1" onCache={onCache} fetcher={fetcher as any} />
    );

    const trigger = container.querySelector("button")!;

    // Rapid sequence: expand, collapse, expand again, before debounce flushes.
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    fireEvent.click(trigger);

    // Flush the debounce (180ms in component).
    await act(async () => { vi.advanceTimersByTime(200); });

    // Only one fetch should have been started — the latest expand.
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Simulate an earlier (stale) result arriving FIRST, then the real one.
    // The race-guard must ignore the stale result entirely.
    await act(async () => {
      first.resolve(evidence("stale"));
      second.resolve(evidence("fresh"));
      // Flush any pending microtasks and timers caused by promise resolution.
      await vi.runAllTimersAsync();
    });

    expect(onCache).toHaveBeenCalled();

    // Cache must hold the fresh value only.
    expect(cached?.fields.find((f) => f.key === "Marker")?.value).toBe("fresh");
    expect(onCache).toHaveBeenLastCalledWith(
      expect.objectContaining({
        fields: expect.arrayContaining([{ key: "Marker", value: "fresh" }]),
      })
    );

    // Stale value must never have been written to the cache.
    const allCachedMarkers = onCache.mock.calls
      .map((c) => (c[0] as ReturnType<typeof evidence>).fields.find((f) => f.key === "Marker")?.value)
      .filter(Boolean);
    expect(allCachedMarkers).not.toContain("stale");
  });

  it("does not start any fetch when the user expands then collapses before debounce flushes", async () => {
    const fetcher = vi.fn();
    const { container } = render(
      <SignalRow signal={baseSignal} userId="u1" fetcher={fetcher as any} />
    );
    const trigger = container.querySelector("button")!;

    fireEvent.click(trigger); // expand
    fireEvent.click(trigger); // collapse — both within debounce window

    await act(async () => { vi.advanceTimersByTime(200); });

    expect(fetcher).not.toHaveBeenCalled();
  });
});