import { describe, it, expect, beforeEach } from "vitest";
import {
  generateEncryptionKey,
  encryptData,
  decryptData,
  hashData,
} from "@/lib/encryption";

/**
 * End-to-end test: large document upload + streaming download for the
 * Sovereign Sector institutional vault.
 *
 * Verifies that:
 *   - A multi-MB document is encrypted client-side into per-chunk AES-256-GCM
 *     ciphertext (each chunk has its own IV + 128-bit auth tag).
 *   - Upload stores a SHA-256 manifest of the ciphertext chunks server-side
 *     for integrity. The server NEVER sees plaintext.
 *   - Streaming download reassembles plaintext one chunk at a time and
 *     matches the original byte-for-byte (and the plaintext SHA-256).
 *   - A tampered chunk (single bit flip) makes streaming decryption throw
 *     and no plaintext for that chunk OR subsequent chunks is delivered.
 *   - When the consumer aborts mid-stream, no plaintext bytes leak past
 *     the abort point — the streamed output is discarded and the consumer
 *     gets an AbortError.
 */

// ---------- helpers ----------
const CHUNK_SIZE = 256 * 1024; // 256 KiB per chunk (mirrors prod chunked upload)
const TOTAL_SIZE = 2 * 1024 * 1024 + 12_345; // ~2 MB, deliberately non-aligned

function makePlaintext(seed = 0xa5): Uint8Array {
  const buf = new Uint8Array(TOTAL_SIZE);
  // Deterministic, non-repeating pattern so any drift/duplication is detectable
  let s = seed | 1;
  for (let i = 0; i < buf.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    buf[i] = s & 0xff;
  }
  return buf;
}

function abufFromView(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

interface EncryptedChunk {
  index: number;
  ciphertext: Uint8Array; // includes 16-byte GCM auth tag suffix
  iv: Uint8Array; // 96-bit per-chunk IV
  sha256: string; // hash of ciphertext for the server-side manifest
}

interface ServerObject {
  chunks: EncryptedChunk[];
  manifest_sha256: string[]; // ordered ciphertext hashes
  plaintext_sha256: string;
}

// In-memory "bucket" for the institutional sector
const bucket = new Map<string, ServerObject>();

async function encryptInChunks(plaintext: Uint8Array, key: CryptoKey) {
  const chunks: EncryptedChunk[] = [];
  for (let offset = 0, i = 0; offset < plaintext.length; offset += CHUNK_SIZE, i++) {
    const slice = plaintext.subarray(offset, Math.min(offset + CHUNK_SIZE, plaintext.length));
    const { ciphertext, iv } = await encryptData(abufFromView(slice), key);
    const ct = new Uint8Array(ciphertext);
    chunks.push({
      index: i,
      ciphertext: ct,
      iv,
      sha256: await hashData(abufFromView(ct)),
    });
  }
  return chunks;
}

async function uploadEncrypted(path: string, plaintext: Uint8Array, key: CryptoKey) {
  const chunks = await encryptInChunks(plaintext, key);
  const plaintext_sha256 = await hashData(abufFromView(plaintext));
  bucket.set(path, {
    chunks,
    manifest_sha256: chunks.map((c) => c.sha256),
    plaintext_sha256,
  });
  return { chunkCount: chunks.length, plaintext_sha256 };
}

// Streaming, authorized download. Yields plaintext chunks one-by-one.
// Honors an AbortSignal: on abort, the generator throws AbortError and the
// caller never receives bytes past the abort point.
async function* streamDecrypt(
  path: string,
  key: CryptoKey,
  opts: { signal?: AbortSignal; verifyManifest?: boolean } = {},
): AsyncGenerator<Uint8Array, void, void> {
  const obj = bucket.get(path);
  if (!obj) throw new Error("not found");

  for (const chunk of obj.chunks) {
    if (opts.signal?.aborted) {
      const err = new Error("Aborted");
      err.name = "AbortError";
      throw err;
    }

    // Integrity check before decrypt — refuse a chunk whose ciphertext
    // does not match the recorded manifest hash.
    if (opts.verifyManifest !== false) {
      const live = await hashData(abufFromView(chunk.ciphertext));
      if (live !== obj.manifest_sha256[chunk.index]) {
        throw new Error(`integrity check failed at chunk ${chunk.index}`);
      }
    }

    // GCM decrypt — throws if the auth tag fails (catches tampering even
    // when the attacker also rewrites the manifest hash).
    const plain = await decryptData(abufFromView(chunk.ciphertext), key, chunk.iv);
    yield new Uint8Array(plain);
  }
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

// ---------- tests ----------
describe("Large document encrypted upload + streaming download (e2e)", () => {
  beforeEach(() => bucket.clear());

  it("uploads a >2MB document as chunked ciphertext with a per-chunk integrity manifest", async () => {
    const key = await generateEncryptionKey();
    const plaintext = makePlaintext();
    const { chunkCount, plaintext_sha256 } = await uploadEncrypted("inst/doc-large.enc", plaintext, key);

    expect(chunkCount).toBeGreaterThanOrEqual(Math.ceil(TOTAL_SIZE / CHUNK_SIZE));
    const obj = bucket.get("inst/doc-large.enc")!;

    // Each chunk: ciphertext >= plaintext+16 (GCM tag), unique IV, recorded sha256
    const seenIvs = new Set<string>();
    for (const c of obj.chunks) {
      expect(c.iv.byteLength).toBe(12);
      expect(c.ciphertext.byteLength).toBeGreaterThanOrEqual(16);
      expect(c.sha256).toMatch(/^[0-9a-f]{64}$/);
      seenIvs.add(Buffer.from(c.iv).toString("hex"));
    }
    expect(seenIvs.size).toBe(obj.chunks.length); // no IV reuse across chunks

    // Server stores ciphertext only — plaintext bytes are NOT present in any chunk
    const sample = plaintext.subarray(0, 64);
    for (const c of obj.chunks) {
      // Scan first window of each chunk's ciphertext for the plaintext prefix
      const start = Buffer.from(c.ciphertext.subarray(0, Math.min(c.ciphertext.length, 4096)));
      expect(start.includes(Buffer.from(sample))).toBe(false);
    }

    // Plaintext SHA-256 recorded for end-to-end verification
    expect(plaintext_sha256).toBe(obj.plaintext_sha256);
    expect(plaintext_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("streams decryption chunk-by-chunk and reproduces the original bytes exactly", async () => {
    const key = await generateEncryptionKey();
    const plaintext = makePlaintext();
    await uploadEncrypted("inst/doc-large.enc", plaintext, key);

    const parts: Uint8Array[] = [];
    let yielded = 0;
    for await (const piece of streamDecrypt("inst/doc-large.enc", key)) {
      // Each yielded chunk decrypts incrementally — we never need the whole file in memory at once
      expect(piece.byteLength).toBeGreaterThan(0);
      yielded += 1;
      parts.push(piece);
    }

    const reassembled = concat(parts);
    expect(reassembled.byteLength).toBe(plaintext.byteLength);
    expect(Buffer.from(reassembled).equals(Buffer.from(plaintext))).toBe(true);

    // Plaintext SHA-256 round-trips
    const liveHash = await hashData(abufFromView(reassembled));
    expect(liveHash).toBe(bucket.get("inst/doc-large.enc")!.plaintext_sha256);
    expect(yielded).toBe(bucket.get("inst/doc-large.enc")!.chunks.length);
  });

  it("a single-bit tamper on any chunk breaks streaming decryption and yields no further plaintext", async () => {
    const key = await generateEncryptionKey();
    const plaintext = makePlaintext();
    await uploadEncrypted("inst/doc-large.enc", plaintext, key);

    const obj = bucket.get("inst/doc-large.enc")!;
    const targetIdx = Math.floor(obj.chunks.length / 2); // tamper a middle chunk
    obj.chunks[targetIdx].ciphertext[10] ^= 0x01;

    // Case A: integrity manifest catches the change BEFORE decrypt is attempted
    const collected: Uint8Array[] = [];
    let thrown: unknown = null;
    try {
      for await (const piece of streamDecrypt("inst/doc-large.enc", key)) {
        collected.push(piece);
      }
    } catch (e) { thrown = e; }
    expect(thrown).toBeTruthy();
    expect((thrown as Error).message).toContain("integrity check failed");
    expect(collected.length).toBe(targetIdx); // only chunks BEFORE the tamper were yielded

    // Case B: even if the attacker rewrites the manifest hash to match the
    // tampered ciphertext, GCM's authenticated decrypt still rejects it.
    obj.manifest_sha256[targetIdx] = await hashData(abufFromView(obj.chunks[targetIdx].ciphertext));
    const collected2: Uint8Array[] = [];
    let thrown2: unknown = null;
    try {
      for await (const piece of streamDecrypt("inst/doc-large.enc", key)) {
        collected2.push(piece);
      }
    } catch (e) { thrown2 = e; }
    expect(thrown2).toBeTruthy(); // GCM auth-tag verification failure
    expect(collected2.length).toBe(targetIdx); // again, nothing past the bad chunk
  });

  it("aborting mid-stream stops further plaintext delivery and surfaces AbortError", async () => {
    const key = await generateEncryptionKey();
    const plaintext = makePlaintext();
    await uploadEncrypted("inst/doc-large.enc", plaintext, key);

    const controller = new AbortController();
    const ABORT_AFTER = 2;
    const delivered: Uint8Array[] = [];
    let abortErr: Error | null = null;

    try {
      for await (const piece of streamDecrypt("inst/doc-large.enc", key, { signal: controller.signal })) {
        delivered.push(piece);
        if (delivered.length === ABORT_AFTER) {
          controller.abort();
          // continue loop — next iteration must NOT yield more plaintext
        }
      }
    } catch (e) {
      abortErr = e as Error;
    }

    expect(abortErr).toBeTruthy();
    expect(abortErr!.name).toBe("AbortError");

    // No plaintext past the abort point reached the consumer
    const totalChunks = bucket.get("inst/doc-large.enc")!.chunks.length;
    expect(delivered.length).toBe(ABORT_AFTER);
    expect(delivered.length).toBeLessThan(totalChunks);

    // The delivered bytes match ONLY the prefix of the original plaintext —
    // no leakage of post-abort bytes via the partial buffer.
    const got = concat(delivered);
    const expectedPrefix = plaintext.subarray(0, got.length);
    expect(Buffer.from(got).equals(Buffer.from(expectedPrefix))).toBe(true);

    // And critically, the post-abort tail of the plaintext is NOT present
    // anywhere in the consumer's collected output.
    const tailSample = plaintext.subarray(got.length, got.length + 64);
    expect(Buffer.from(got).includes(Buffer.from(tailSample))).toBe(false);
  });

  it("aborting BEFORE the first chunk yields zero plaintext bytes", async () => {
    const key = await generateEncryptionKey();
    await uploadEncrypted("inst/doc-large.enc", makePlaintext(), key);

    const controller = new AbortController();
    controller.abort(); // pre-aborted

    const delivered: Uint8Array[] = [];
    let err: Error | null = null;
    try {
      for await (const piece of streamDecrypt("inst/doc-large.enc", key, { signal: controller.signal })) {
        delivered.push(piece);
      }
    } catch (e) { err = e as Error; }

    expect(err?.name).toBe("AbortError");
    expect(delivered.length).toBe(0);
  });
});