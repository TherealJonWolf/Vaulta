/**
 * Typed client for the encryption Web Worker.
 *
 * Falls back to the synchronous helpers in `./encryption.ts` when running
 * in environments without `Worker` (vitest/jsdom, SSR) so existing tests
 * keep working unchanged.
 */

import {
  deriveKeyFromPassword as deriveSync,
  encryptData as encryptSync,
  decryptData as decryptSync,
} from "./encryption";
import type { WorkerRequest, WorkerResponse } from "./encryption.worker";

type Pending = {
  resolve: (value: WorkerResponse) => void;
  reject: (err: unknown) => void;
};

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();
let workerUsable = typeof Worker !== "undefined";

function getWorker(): Worker | null {
  if (!workerUsable) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./encryption.worker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("message", (ev: MessageEvent<WorkerResponse>) => {
      const p = pending.get(ev.data.id);
      if (!p) return;
      pending.delete(ev.data.id);
      p.resolve(ev.data);
    });
    worker.addEventListener("error", () => {
      // Fail open: disable worker and reject in-flight requests so callers
      // fall back to the synchronous path on next call.
      workerUsable = false;
      worker = null;
      for (const [, p] of pending) p.reject(new Error("encryption_worker_error"));
      pending.clear();
    });
    return worker;
  } catch {
    workerUsable = false;
    return null;
  }
}

type WorkerRequestBody =
  | { type: "derive"; password: string; salt: Uint8Array }
  | { type: "encrypt"; data: ArrayBuffer; key: CryptoKey }
  | { type: "decrypt"; data: ArrayBuffer; key: CryptoKey; iv: Uint8Array };

function call(req: WorkerRequestBody, transfer: Transferable[] = []): Promise<WorkerResponse> {
  const w = getWorker();
  if (!w) return Promise.reject(new Error("no_worker"));
  const id = nextId++;
  return new Promise<WorkerResponse>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    try {
      w.postMessage({ id, ...req } as WorkerRequest, transfer);
    } catch (err) {
      pending.delete(id);
      reject(err);
    }
  });
}

export async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  try {
    const res = await call({ type: "derive", password, salt });
    if (res.ok && res.type === "derive") return res.key;
    throw new Error(!res.ok ? res.error : "bad_response");
  } catch {
    return deriveSync(password, salt);
  }
}

export async function encryptData(
  data: ArrayBuffer,
  key: CryptoKey,
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array; tag: ArrayBuffer }> {
  try {
    const res = await call({ type: "encrypt", data, key }, [data]);
    if (res.ok && res.type === "encrypt") {
      return { ciphertext: res.ciphertext, iv: res.iv, tag: res.ciphertext.slice(-16) };
    }
    throw new Error(!res.ok ? res.error : "bad_response");
  } catch {
    return encryptSync(data, key);
  }
}

export async function decryptData(
  ciphertext: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array,
): Promise<ArrayBuffer> {
  try {
    const res = await call({ type: "decrypt", data: ciphertext, key, iv }, [ciphertext]);
    if (res.ok && res.type === "decrypt") return res.plaintext;
    throw new Error(!res.ok ? res.error : "bad_response");
  } catch {
    return decryptSync(ciphertext, key, iv);
  }
}