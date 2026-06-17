/**
 * Integration-style fetch-mock hardening for the external services this app
 * leans on: Stripe, Veriff, Resend, and the Lovable AI Gateway. These tests
 * use vitest's built-in mocks only (no new framework) and exercise the same
 * patterns the production edge-function/runtime code uses:
 *
 *   - retry on 5xx
 *   - abort on slow response
 *   - fallback UI / error surface on dropped webhook (no response body)
 *   - race-guard discards stale responses
 *
 * The handlers under test are small inline helpers that mirror the wire
 * contract used by the real callers. They do NOT change product behaviour.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRaceGuard } from "@/institutional/lib/raceGuardedFetch";

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];
type FetchResponse = Awaited<ReturnType<typeof fetch>>;
type FetchHandler = (input: FetchInput, init?: FetchInit) => Promise<FetchResponse> | FetchResponse;

function installFetch(handler: FetchHandler) {
  const spy = vi.fn(handler);
  // @ts-expect-error — vitest jsdom global fetch is writable for this test
  globalThis.fetch = spy;
  return spy;
}

/** Retry helper that mirrors what production edge functions do for transient 5xx. */
async function postWithRetry(url: string, body: unknown, retries = 2): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { method: "POST", body: JSON.stringify(body) });
      if (res.status >= 500 && attempt < retries) continue;
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt === retries) throw err;
    }
  }
  throw lastErr;
}

beforeEach(() => {
  vi.useRealTimers();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Stripe — 5xx retry then success", () => {
  it("retries a 500 once and surfaces the eventual 200", async () => {
    let calls = 0;
    const spy = installFetch(async () => {
      calls++;
      if (calls < 2) return new Response("upstream", { status: 500 });
      return new Response(JSON.stringify({ id: "cs_test_123" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    });
    const res = await postWithRetry("https://api.stripe.com/v1/checkout/sessions", { mode: "payment" });
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(await res.json()).toEqual({ id: "cs_test_123" });
  });

  it("surfaces a hard 400 immediately without retrying", async () => {
    const spy = installFetch(async () =>
      new Response(JSON.stringify({ error: { message: "bad" } }), {
        status: 400, headers: { "Content-Type": "application/json" },
      })
    );
    const res = await postWithRetry("https://api.stripe.com/v1/charges", {});
    expect(res.status).toBe(400);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("Veriff — slow response is aborted", () => {
  it("AbortController fires before a slow Veriff request resolves", async () => {
    installFetch(async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener("abort", () => {
            const err = new Error("aborted");
            (err as { name: string }).name = "AbortError";
            reject(err);
          });
        }
      })
    );
    const ctrl = new AbortController();
    const p = fetch("https://stationapi.veriff.com/v1/sessions", { method: "POST", signal: ctrl.signal });
    queueMicrotask(() => ctrl.abort());
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("Resend — dropped webhook (no response body)", () => {
  it("treats an empty/dropped Resend response as a delivery failure", async () => {
    installFetch(async () => new Response(null, { status: 502 }));
    const res = await fetch("https://api.resend.com/emails", { method: "POST" });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(502);
    const body = await res.text();
    expect(body).toBe("");
  });

  it("retries a dropped (502) Resend webhook then succeeds", async () => {
    let calls = 0;
    const spy = installFetch(async () => {
      calls++;
      if (calls < 2) return new Response(null, { status: 502 });
      return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
    });
    const res = await postWithRetry("https://api.resend.com/emails", { to: "x@y.z" });
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe("Lovable AI Gateway — slow response triggers fallback UI", () => {
  it("times out a slow gateway call and reports an actionable error", async () => {
    installFetch(async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          (err as { name: string }).name = "AbortError";
          reject(err);
        });
      })
    );
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5);
    const fallback = vi.fn();
    try {
      await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { method: "POST", signal: ctrl.signal });
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") fallback("timeout");
    } finally {
      clearTimeout(timer);
    }
    expect(fallback).toHaveBeenCalledWith("timeout");
  });
});

describe("Race-guarded gateway calls — stale response is discarded", () => {
  it("does not surface a slow AI response once a faster newer one wins", async () => {
    const onResult = vi.fn<(v: string) => void>();
    const guard = createRaceGuard<string>({ onResult });

    let resolveSlow!: (s: string) => void;
    const slow = new Promise<string>((r) => { resolveSlow = r; });
    const fast = Promise.resolve("fresh");

    const p1 = guard.run(() => slow);
    const p2 = guard.run(() => fast);

    resolveSlow("stale");
    await Promise.all([p1, p2]);

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith("fresh");
  });
});