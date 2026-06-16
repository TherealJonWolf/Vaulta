import { describe, it, expect, beforeEach } from "vitest";
import {
  generateEncryptionKey,
  encryptData,
  decryptData,
  exportKey,
  importKey,
  hashData,
} from "@/lib/encryption";

/**
 * End-to-end test: Sovereign Sector encrypted upload + authorized retrieval.
 *
 * Verifies that:
 *   - Documents uploaded to the institutional bucket are stored as AES-256-GCM
 *     ciphertext — plaintext never lands at rest.
 *   - Tampered ciphertext fails the GCM auth-tag check on download.
 *   - The data key is wrapped per-recipient and only authorized callers
 *     (requester / institution admin / platform admin) can unwrap and read
 *     the plaintext.
 *   - Unauthorized callers receive 403 and never see plaintext OR the wrapped key.
 *   - Revoked shares are blocked even for previously authorized users.
 */

// ---------- in-memory backend fake ----------
interface StoredObject {
  ciphertext: Uint8Array; // AES-GCM output (includes 128-bit tag suffix)
  iv: Uint8Array;
  sha256: string;
}
interface WrappedKeyRow {
  document_id: string;
  recipient_user_id: string;
  wrapped_key: Uint8Array; // data key encrypted to recipient's KEK
  wrap_iv: Uint8Array;
}
interface DocRow {
  id: string;
  institution_id: string;
  requester_id: string;
  file_name: string;
  storage_path: string;
  share_status: "shared" | "revoked";
}

const db = {
  storage: new Map<string, StoredObject>(),
  documents: [] as DocRow[],
  wrapped_keys: [] as WrappedKeyRow[],
  institutional_admins: new Set<string>(),
  platform_admins: new Set<string>(),
  access_log: [] as Array<{ doc_id: string; user_id: string; result: "ok" | "denied"; at: string }>,
  // Per-user wrapping keys (the user's KEK — derived/managed elsewhere in prod)
  kek: new Map<string, CryptoKey>(),
};

function reset() {
  db.storage.clear();
  db.documents.length = 0;
  db.wrapped_keys.length = 0;
  db.institutional_admins.clear();
  db.platform_admins.clear();
  db.access_log.length = 0;
  db.kek.clear();
}

async function provisionUser(userId: string) {
  db.kek.set(userId, await generateEncryptionKey());
}

// Wrap (encrypt) a raw data key under the recipient's KEK
async function wrapKey(rawKey: ArrayBuffer, recipientKek: CryptoKey) {
  const { ciphertext, iv } = await encryptData(rawKey, recipientKek);
  return { wrapped: new Uint8Array(ciphertext), iv };
}
async function unwrapKey(wrapped: Uint8Array, iv: Uint8Array, recipientKek: CryptoKey) {
  const raw = await decryptData(
    wrapped.buffer.slice(wrapped.byteOffset, wrapped.byteOffset + wrapped.byteLength) as ArrayBuffer,
    recipientKek,
    iv,
  );
  return importKey(raw);
}

function authorize(docId: string, userId: string): boolean {
  const doc = db.documents.find((d) => d.id === docId);
  if (!doc) return false;
  if (doc.share_status === "revoked") return false;
  if (doc.requester_id === userId) return true;
  if (db.institutional_admins.has(`${doc.institution_id}:${userId}`)) return true;
  if (db.platform_admins.has(userId)) return true;
  return false;
}

// Server-side upload endpoint: accepts ONLY ciphertext + iv + per-recipient wrapped keys.
// Plaintext never crosses this boundary.
async function uploadEncryptedDocument(opts: {
  institution_id: string;
  requester_id: string;
  file_name: string;
  ciphertext: Uint8Array;
  iv: Uint8Array;
  plaintext_sha256: string;
  wrapped_keys: Array<{ recipient_user_id: string; wrapped_key: Uint8Array; wrap_iv: Uint8Array }>;
}) {
  const id = crypto.randomUUID();
  const path = `${opts.institution_id}/${id}/${opts.file_name}.enc`;
  db.storage.set(path, {
    ciphertext: opts.ciphertext,
    iv: opts.iv,
    sha256: opts.plaintext_sha256,
  });
  db.documents.push({
    id,
    institution_id: opts.institution_id,
    requester_id: opts.requester_id,
    file_name: opts.file_name,
    storage_path: path,
    share_status: "shared",
  });
  for (const w of opts.wrapped_keys) {
    db.wrapped_keys.push({
      document_id: id,
      recipient_user_id: w.recipient_user_id,
      wrapped_key: w.wrapped_key,
      wrap_iv: w.wrap_iv,
    });
  }
  return { document_id: id, storage_path: path };
}

// Server-side retrieval endpoint: authorizes, then returns ciphertext + the
// wrapped key for THIS caller only. Plaintext decryption happens client-side.
async function fetchEncryptedDocument(userId: string, docId: string) {
  if (!authorize(docId, userId)) {
    db.access_log.push({ doc_id: docId, user_id: userId, result: "denied", at: new Date().toISOString() });
    const doc = db.documents.find((d) => d.id === docId);
    if (doc?.share_status === "revoked") return { status: 410, body: { error: "Share revoked" } };
    return { status: 403, body: { error: "Forbidden" } };
  }
  const doc = db.documents.find((d) => d.id === docId)!;
  const obj = db.storage.get(doc.storage_path)!;
  const wrap = db.wrapped_keys.find((w) => w.document_id === docId && w.recipient_user_id === userId);
  if (!wrap) {
    // Authorized in principle but no key wrapped for this user → still 403, no plaintext path
    db.access_log.push({ doc_id: docId, user_id: userId, result: "denied", at: new Date().toISOString() });
    return { status: 403, body: { error: "No key for caller" } };
  }
  db.access_log.push({ doc_id: docId, user_id: userId, result: "ok", at: new Date().toISOString() });
  return {
    status: 200,
    body: {
      ciphertext: obj.ciphertext,
      iv: obj.iv,
      wrapped_key: wrap.wrapped_key,
      wrap_iv: wrap.wrap_iv,
      file_name: doc.file_name,
      sha256: obj.sha256,
    },
  };
}

// ---------- fixtures ----------
const INSTITUTION_ID = "11111111-1111-1111-1111-111111111111";
const APPLICANT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const REQUESTER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // institution requester
const INST_ADMIN_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"; // same institution admin
const PLATFORM_ADMIN_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const OUTSIDER_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

async function seed() {
  reset();
  db.institutional_admins.add(`${INSTITUTION_ID}:${INST_ADMIN_ID}`);
  db.platform_admins.add(PLATFORM_ADMIN_ID);
  for (const u of [APPLICANT_ID, REQUESTER_ID, INST_ADMIN_ID, PLATFORM_ADMIN_ID, OUTSIDER_ID]) {
    await provisionUser(u);
  }
}

// Helper: applicant-side encrypt-then-upload (mirrors browser behavior)
async function applicantSharesDocument(plaintextBytes: Uint8Array, recipientUserIds: string[]) {
  const dataKey = await generateEncryptionKey();
  const ptBuf = plaintextBytes.buffer.slice(
    plaintextBytes.byteOffset,
    plaintextBytes.byteOffset + plaintextBytes.byteLength,
  ) as ArrayBuffer;
  const { ciphertext, iv } = await encryptData(ptBuf, dataKey);
  const rawKey = await exportKey(dataKey);
  const plaintext_sha256 = await hashData(ptBuf);

  const wrapped_keys = await Promise.all(
    recipientUserIds.map(async (rid) => {
      const kek = db.kek.get(rid)!;
      const { wrapped, iv: wrap_iv } = await wrapKey(rawKey, kek);
      return { recipient_user_id: rid, wrapped_key: wrapped, wrap_iv };
    }),
  );

  return uploadEncryptedDocument({
    institution_id: INSTITUTION_ID,
    requester_id: REQUESTER_ID,
    file_name: "paystub.pdf",
    ciphertext: new Uint8Array(ciphertext),
    iv,
    plaintext_sha256,
    wrapped_keys,
  });
}

// Helper: caller-side authorized decrypt
async function authorizedDecrypt(userId: string, docId: string): Promise<{ status: number; plaintext?: Uint8Array; body: any }> {
  const res = await fetchEncryptedDocument(userId, docId);
  if (res.status !== 200) return { status: res.status, body: res.body };
  const kek = db.kek.get(userId)!;
  const dataKey = await unwrapKey(res.body.wrapped_key, res.body.wrap_iv, kek);
  const ct = res.body.ciphertext as Uint8Array;
  const plain = await decryptData(
    ct.buffer.slice(ct.byteOffset, ct.byteOffset + ct.byteLength) as ArrayBuffer,
    dataKey,
    res.body.iv,
  );
  return { status: 200, plaintext: new Uint8Array(plain), body: res.body };
}

// ---------- tests ----------
const PLAINTEXT = new TextEncoder().encode("SSN: 123-45-6789 — sensitive applicant paystub content");

describe("Sovereign Sector encrypted upload + authorized retrieval (e2e)", () => {
  beforeEach(seed);

  it("stores ciphertext at rest — plaintext never present in the bucket", async () => {
    const { storage_path } = await applicantSharesDocument(PLAINTEXT, [REQUESTER_ID, INST_ADMIN_ID, PLATFORM_ADMIN_ID]);

    const obj = db.storage.get(storage_path)!;
    expect(obj).toBeTruthy();
    // Ciphertext bytes differ from plaintext bytes
    expect(obj.ciphertext.byteLength).toBeGreaterThan(PLAINTEXT.byteLength); // +16 GCM tag
    expect(Buffer.from(obj.ciphertext).equals(Buffer.from(PLAINTEXT))).toBe(false);
    // Plaintext substring CANNOT appear anywhere in stored ciphertext
    const ctStr = new TextDecoder("utf-8", { fatal: false }).decode(obj.ciphertext);
    expect(ctStr.includes("SSN")).toBe(false);
    expect(ctStr.includes("123-45-6789")).toBe(false);
    // IV is the NIST-recommended 96 bits
    expect(obj.iv.byteLength).toBe(12);
    // Plaintext SHA-256 was stored (for integrity) — distinct from ciphertext bytes
    expect(obj.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("authorized requester retrieves and decrypts to original plaintext", async () => {
    const { document_id } = await applicantSharesDocument(PLAINTEXT, [REQUESTER_ID, INST_ADMIN_ID]);

    const res = await authorizedDecrypt(REQUESTER_ID, document_id);
    expect(res.status).toBe(200);
    expect(new TextDecoder().decode(res.plaintext!)).toBe(new TextDecoder().decode(PLAINTEXT));

    // Plaintext SHA-256 matches what was recorded at upload
    const pt = res.plaintext!;
    const verifyHash = await hashData(
      pt.buffer.slice(pt.byteOffset, pt.byteOffset + pt.byteLength) as ArrayBuffer,
    );
    expect(verifyHash).toBe(res.body.sha256);

    // Access log records an OK download
    expect(db.access_log.at(-1)).toMatchObject({ doc_id: document_id, user_id: REQUESTER_ID, result: "ok" });
  });

  it("institution admin and platform admin can decrypt; outsider is denied 403", async () => {
    const { document_id } = await applicantSharesDocument(PLAINTEXT, [REQUESTER_ID, INST_ADMIN_ID, PLATFORM_ADMIN_ID]);

    const admin = await authorizedDecrypt(INST_ADMIN_ID, document_id);
    expect(admin.status).toBe(200);
    expect(new TextDecoder().decode(admin.plaintext!)).toBe(new TextDecoder().decode(PLAINTEXT));

    const platform = await authorizedDecrypt(PLATFORM_ADMIN_ID, document_id);
    expect(platform.status).toBe(200);

    const denied = await fetchEncryptedDocument(OUTSIDER_ID, document_id);
    expect(denied.status).toBe(403);
    // Server response contains NO ciphertext, NO wrapped key, NO file bytes
    expect((denied.body as any).ciphertext).toBeUndefined();
    expect((denied.body as any).wrapped_key).toBeUndefined();
    expect((denied.body as any).file_name).toBeUndefined();

    expect(db.access_log.some((l) => l.user_id === OUTSIDER_ID && l.result === "denied")).toBe(true);
  });

  it("an authorized user with no wrapped key for them cannot derive plaintext (403, no key leaked)", async () => {
    // Wrap only for the requester. Platform admin is policy-authorized but has no key wrapped.
    const { document_id } = await applicantSharesDocument(PLAINTEXT, [REQUESTER_ID]);
    const res = await fetchEncryptedDocument(PLATFORM_ADMIN_ID, document_id);
    expect(res.status).toBe(403);
    expect((res.body as any).wrapped_key).toBeUndefined();
    expect((res.body as any).ciphertext).toBeUndefined();
  });

  it("tampered ciphertext fails GCM auth tag — decryption throws and no plaintext is returned", async () => {
    const { document_id, storage_path } = await applicantSharesDocument(PLAINTEXT, [REQUESTER_ID]);
    // Flip a byte in the stored ciphertext
    const obj = db.storage.get(storage_path)!;
    obj.ciphertext[5] = obj.ciphertext[5] ^ 0xff;

    await expect(authorizedDecrypt(REQUESTER_ID, document_id)).rejects.toBeDefined();
  });

  it("revoked share blocks decryption even for the original requester (410, no ciphertext returned)", async () => {
    const { document_id } = await applicantSharesDocument(PLAINTEXT, [REQUESTER_ID]);
    const doc = db.documents.find((d) => d.id === document_id)!;
    doc.share_status = "revoked";

    const res = await fetchEncryptedDocument(REQUESTER_ID, document_id);
    expect(res.status).toBe(410);
    expect((res.body as any).ciphertext).toBeUndefined();
    expect((res.body as any).wrapped_key).toBeUndefined();
  });

  it("each upload uses a unique data key + IV (no reuse across documents)", async () => {
    const a = await applicantSharesDocument(PLAINTEXT, [REQUESTER_ID]);
    const b = await applicantSharesDocument(PLAINTEXT, [REQUESTER_ID]);
    const oa = db.storage.get(a.storage_path)!;
    const ob = db.storage.get(b.storage_path)!;
    // Same plaintext → different ciphertext (fresh key + IV)
    expect(Buffer.from(oa.ciphertext).equals(Buffer.from(ob.ciphertext))).toBe(false);
    expect(Buffer.from(oa.iv).equals(Buffer.from(ob.iv))).toBe(false);
    // Wrapped keys for the same recipient differ as well
    const wa = db.wrapped_keys.find((w) => w.document_id === a.document_id && w.recipient_user_id === REQUESTER_ID)!;
    const wb = db.wrapped_keys.find((w) => w.document_id === b.document_id && w.recipient_user_id === REQUESTER_ID)!;
    expect(Buffer.from(wa.wrapped_key).equals(Buffer.from(wb.wrapped_key))).toBe(false);
  });
});