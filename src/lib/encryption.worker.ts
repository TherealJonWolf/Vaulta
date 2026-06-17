/**
 * Web Worker that performs PBKDF2 key derivation and AES-256-GCM
 * encrypt/decrypt off the main UI thread.
 *
 * Behaviour is byte-identical to the synchronous helpers in
 * `./encryption.ts` — same PBKDF2 params (100k iterations, SHA-256),
 * same 96-bit IV, same 128-bit auth tag.
 */

/// <reference lib="webworker" />

export type WorkerRequest =
  | { id: number; type: "derive"; password: string; salt: Uint8Array }
  | { id: number; type: "encrypt"; data: ArrayBuffer; key: CryptoKey }
  | { id: number; type: "decrypt"; data: ArrayBuffer; key: CryptoKey; iv: Uint8Array };

export type WorkerResponse =
  | { id: number; ok: true; type: "derive"; key: CryptoKey }
  | { id: number; ok: true; type: "encrypt"; ciphertext: ArrayBuffer; iv: Uint8Array }
  | { id: number; ok: true; type: "decrypt"; plaintext: ArrayBuffer }
  | { id: number; ok: false; error: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

async function derive(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const passBuf = new TextEncoder().encode(password);
  const material = await crypto.subtle.importKey("raw", passBuf, "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 100000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

async function encrypt(data: ArrayBuffer, key: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource, tagLength: 128 },
    key,
    data,
  );
  return { ciphertext, iv };
}

async function decrypt(data: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource, tagLength: 128 }, key, data);
}

ctx.addEventListener("message", async (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  try {
    if (msg.type === "derive") {
      const key = await derive(msg.password, msg.salt);
      const res: WorkerResponse = { id: msg.id, ok: true, type: "derive", key };
      ctx.postMessage(res);
    } else if (msg.type === "encrypt") {
      const { ciphertext, iv } = await encrypt(msg.data, msg.key);
      const res: WorkerResponse = { id: msg.id, ok: true, type: "encrypt", ciphertext, iv };
      ctx.postMessage(res, [ciphertext]);
    } else if (msg.type === "decrypt") {
      const plaintext = await decrypt(msg.data, msg.key, msg.iv);
      const res: WorkerResponse = { id: msg.id, ok: true, type: "decrypt", plaintext };
      ctx.postMessage(res, [plaintext]);
    }
  } catch (err) {
    const res: WorkerResponse = {
      id: (msg as { id: number }).id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    ctx.postMessage(res);
  }
});

export {};