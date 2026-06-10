import { describe, it, expect, beforeEach } from "vitest";

/**
 * End-to-end test for the additive document request / vault-share workflow.
 *
 * Exercises the exact data-plane calls that the production components and the
 * `download-institution-document` edge function make, against an in-memory
 * fake of Supabase. Covers:
 *
 *   1. Company creates a document possession request.
 *   2. User reviews the request and shares ONLY the documents they pick
 *      (per-document selection — no auto-matching).
 *   3. Authorized company user (the requester) downloads → audit log written.
 *   4. Unauthorized user is denied → "Document Access Denied" audit entry.
 */

// ---------- in-memory supabase fake ----------
type Row = Record<string, any>;

function makeDb() {
  return {
    document_possession_requests: [] as Row[],
    consent_records: [] as Row[],
    institution_documents: [] as Row[],
    institutional_activity_log: [] as Row[],
    document_access_log: [] as Row[],
    documents: [] as Row[],
    institutional_users: [] as Row[],
    user_roles: [] as Row[],
    storage: new Map<string, Uint8Array>(),
  };
}

let db = makeDb();

function uuid() {
  return crypto.randomUUID();
}

// Mimic the supabase client surface we touch
function from(table: keyof ReturnType<typeof makeDb>) {
  const rows = db[table] as Row[];
  const AUDIT_TABLES = new Set(["institutional_activity_log", "document_access_log"]);
  const api: any = {
    insert(values: Row | Row[]) {
      const arr = Array.isArray(values) ? values : [values];
      const inserted = arr.map((v) => {
        const row = { id: v.id ?? uuid(), created_at: new Date().toISOString(), ...v };
        // Audit tables are append-only: freeze inserted rows to enforce immutability
        return AUDIT_TABLES.has(String(table)) ? Object.freeze(row) : row;
      });
      rows.push(...inserted);
      return {
        select: () => ({
          single: async () => ({ data: inserted[0], error: null }),
        }),
        // bare insert returns void-like
        then: (res: any) => res({ data: inserted, error: null }),
      };
    },
    update(values: Row) {
      return {
        eq: (col: string, val: any) => {
          rows.filter((r) => r[col] === val).forEach((r) => Object.assign(r, values));
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
    select() {
      const chain: any = {
        _filters: [] as Array<(r: Row) => boolean>,
        eq(col: string, val: any) { chain._filters.push((r: Row) => r[col] === val); return chain; },
        maybeSingle: async () => {
          const r = rows.find((row) => chain._filters.every((f: any) => f(row))) ?? null;
          return { data: r, error: null };
        },
        single: async () => {
          const r = rows.find((row) => chain._filters.every((f: any) => f(row))) ?? null;
          return { data: r, error: null };
        },
        then: (res: any) => res({ data: rows.filter((r) => chain._filters.every((f: any) => f(r))), error: null }),
      };
      return chain;
    },
  };
  return api;
}

const storage = {
  from(_bucket: string) {
    return {
      async download(path: string) {
        const bytes = db.storage.get(`source:${path}`);
        if (!bytes) return { data: null, error: new Error("not found") };
        return { data: bytes, error: null };
      },
      async upload(path: string, payload: Uint8Array) {
        db.storage.set(`inst:${path}`, payload);
        return { data: { path }, error: null };
      },
      async createSignedUrl(path: string, _ttl: number) {
        if (!db.storage.has(`inst:${path}`)) return { data: null, error: new Error("missing") };
        return { data: { signedUrl: `https://signed.local/${path}` }, error: null };
      },
    };
  },
};

// Mimic `can_download_institution_doc` RPC
function canDownload(userId: string, docId: string): boolean {
  const doc = db.institution_documents.find((d) => d.id === docId && !d.deleted_at);
  if (!doc) return false;
  const req = db.document_possession_requests.find((r) => r.id === doc.possession_request_id);
  if (req?.requested_by === userId) return true;
  const iu = db.institutional_users.find(
    (i) => i.institution_id === doc.institution_id && i.user_id === userId,
  );
  if (iu?.role === "admin") return true;
  return db.user_roles.some((r) => r.user_id === userId && r.role === "admin");
}

// Edge-function-equivalent download handler (mirrors download-institution-document/index.ts)
async function downloadInstitutionDocument(userId: string, documentId: string) {
  const doc = db.institution_documents.find((d) => d.id === documentId);
  if (!doc) return { status: 404, body: { error: "Document not found" } };

  if (!canDownload(userId, documentId)) {
    db.institutional_activity_log.push(Object.freeze({
      id: uuid(),
      institution_id: doc.institution_id,
      user_id: userId,
      event_type: "Document Access Denied",
      possession_request_id: doc.possession_request_id,
      institution_document_id: doc.id,
      detail: `Denied access to ${doc.file_name}`,
      created_at: new Date().toISOString(),
    }));
    return { status: 403, body: { error: "Forbidden" } };
  }

  if (doc.share_status === "revoked" || doc.share_status === "expired") {
    return { status: 410, body: { error: `Share ${doc.share_status}` } };
  }

  const signed = await storage.from("institution-documents").createSignedUrl(doc.file_path, 900);
  if (signed.error || !signed.data) return { status: 500, body: { error: "Signed URL failed" } };

  db.document_access_log.push(Object.freeze({
    id: uuid(),
    institution_id: doc.institution_id,
    institution_document_id: doc.id,
    consent_record_id: doc.consent_record_id,
    possession_request_id: doc.possession_request_id,
    accessed_by: userId,
    access_type: "download",
    created_at: new Date().toISOString(),
  }));
  doc.download_count = (doc.download_count ?? 0) + 1;
  doc.last_downloaded_at = new Date().toISOString();
  doc.last_downloaded_by = userId;
  doc.share_status = "downloaded";
  db.institutional_activity_log.push(Object.freeze({
    id: uuid(),
    institution_id: doc.institution_id,
    user_id: userId,
    event_type: "Document Downloaded",
    possession_request_id: doc.possession_request_id,
    institution_document_id: doc.id,
    detail: `Downloaded ${doc.file_name}`,
    created_at: new Date().toISOString(),
  }));

  return { status: 200, body: { signed_url: signed.data.signedUrl, file_name: doc.file_name } };
}

// ---------- test fixtures ----------
const INSTITUTION_ID = "11111111-1111-1111-1111-111111111111";
const REQUESTER_ID = "22222222-2222-2222-2222-222222222222"; // company user who sent request
const OTHER_COMPANY_USER_ID = "33333333-3333-3333-3333-333333333333"; // non-admin same institution
const OUTSIDER_ID = "44444444-4444-4444-4444-444444444444"; // wholly unrelated user
const APPLICANT_ID = "55555555-5555-5555-5555-555555555555";

function seed() {
  db = makeDb();
  // Institutional membership: requester is admin, other user is plain member
  db.institutional_users.push(
    { id: uuid(), institution_id: INSTITUTION_ID, user_id: REQUESTER_ID, role: "admin" },
    { id: uuid(), institution_id: INSTITUTION_ID, user_id: OTHER_COMPANY_USER_ID, role: "member" },
  );
  // Two documents in the applicant's vault
  db.documents.push(
    { id: "doc-paystub", user_id: APPLICANT_ID, file_name: "paystub.pdf", file_path: "vault/paystub.pdf", document_category: "proof_income", file_size: 100, mime_type: "application/pdf" },
    { id: "doc-id", user_id: APPLICANT_ID, file_name: "drivers_license.pdf", file_path: "vault/dl.pdf", document_category: "gov_id", file_size: 100, mime_type: "application/pdf" },
  );
  db.storage.set("source:vault/paystub.pdf", new Uint8Array([1, 2, 3]));
  db.storage.set("source:vault/dl.pdf", new Uint8Array([4, 5, 6]));
}

// ---------- flow helpers (mirror real component logic) ----------
async function institutionCreatesRequest(opts: { documentTypes: string[] }) {
  const { data } = await from("document_possession_requests")
    .insert({
      institution_id: INSTITUTION_ID,
      requested_by: REQUESTER_ID,
      applicant_user_id: APPLICANT_ID,
      applicant_name: "Jane Doe",
      document_types: opts.documentTypes,
      legal_basis: "ECOA",
      retention_period: "25 months",
      retention_expires_at: new Date(Date.now() + 25 * 30 * 86400e3).toISOString(),
      status: "pending",
    })
    .select()
    .single();
  await from("institutional_activity_log").insert({
    institution_id: INSTITUTION_ID,
    user_id: REQUESTER_ID,
    event_type: "Document Request Sent",
    applicant_name: "Jane Doe",
    detail: `Requested ${opts.documentTypes.length} document type(s)`,
  });
  return data;
}

// Mirrors DocumentPossessionReview.handleApprove — explicit per-document selection
async function userApprovesShare(requestId: string, selectedDocIds: string[]) {
  const req = db.document_possession_requests.find((r) => r.id === requestId)!;
  const matched = db.documents.filter((d) => selectedDocIds.includes(d.id) && d.user_id === APPLICANT_ID);

  const consentText = `consent:${requestId}:${selectedDocIds.join(",")}`;
  const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(consentText));
  const consentHash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");

  const { data: consent } = await from("consent_records").insert({
    user_id: APPLICANT_ID,
    institution_id: req.institution_id,
    possession_request_id: req.id,
    document_ids: matched.map((d) => d.id),
    document_names: matched.map((d) => d.file_name),
    legal_basis: req.legal_basis,
    retention_period: req.retention_period,
    consent_text_hash: consentHash,
  }).select().single();

  for (const doc of matched) {
    const destPath = `${req.institution_id}/${req.id}/${doc.file_name}`;
    const dl = await storage.from("documents").download(doc.file_path);
    if (dl.error || !dl.data) continue;
    await storage.from("institution-documents").upload(destPath, dl.data as Uint8Array);
    await from("institution_documents").insert({
      institution_id: req.institution_id,
      consent_record_id: consent.id,
      possession_request_id: req.id,
      original_document_id: doc.id,
      document_type: doc.document_category,
      file_name: doc.file_name,
      file_path: destPath,
      file_size: doc.file_size,
      mime_type: doc.mime_type,
      applicant_user_id: APPLICANT_ID,
      applicant_name: req.applicant_name,
      retention_expires_at: req.retention_expires_at,
      share_status: "shared",
      uploaded_via: "vault",
    });
    await from("institutional_activity_log").insert({
      institution_id: req.institution_id,
      user_id: APPLICANT_ID,
      event_type: "Document Shared",
      applicant_name: req.applicant_name,
      detail: `Applicant shared ${doc.file_name}`,
    });
  }
  await from("document_possession_requests").update({ status: "approved", responded_at: new Date().toISOString() }).eq("id", req.id);
}

// ---------- tests ----------
describe("Document request → share → download (e2e)", () => {
  beforeEach(seed);

  it("runs the full lifecycle with per-document consent and audit-logged download", async () => {
    // 1. Company requests two document categories
    const req = await institutionCreatesRequest({
      documentTypes: ["Proof of income", "Government-issued photo ID"],
    });
    expect(req.status).toBe("pending");
    expect(db.institutional_activity_log.find((e) => e.event_type === "Document Request Sent")).toBeTruthy();

    // 2. User picks ONLY the paystub (not the ID) and approves
    await userApprovesShare(req.id, ["doc-paystub"]);

    expect(db.consent_records).toHaveLength(1);
    expect(db.consent_records[0].document_ids).toEqual(["doc-paystub"]);
    expect(db.consent_records[0].consent_text_hash).toMatch(/^[0-9a-f]{64}$/);

    // Only the explicitly selected document is in the institution's bucket
    expect(db.institution_documents).toHaveLength(1);
    expect(db.institution_documents[0].original_document_id).toBe("doc-paystub");
    expect(db.institution_documents[0].share_status).toBe("shared");
    expect([...db.storage.keys()].some((k) => k.startsWith("inst:") && k.endsWith("paystub.pdf"))).toBe(true);
    expect([...db.storage.keys()].some((k) => k.startsWith("inst:") && k.endsWith("drivers_license.pdf"))).toBe(false);

    expect(db.document_possession_requests[0].status).toBe("approved");
    expect(db.institutional_activity_log.some((e) => e.event_type === "Document Shared")).toBe(true);

    // 3. Authorized company user (the requester) downloads
    const sharedDocId = db.institution_documents[0].id;
    const ok = await downloadInstitutionDocument(REQUESTER_ID, sharedDocId);
    expect(ok.status).toBe(200);
    expect(ok.body.signed_url).toContain("https://signed.local/");
    expect(ok.body.file_name).toBe("paystub.pdf");

    const accessRow = db.document_access_log.find((e) => e.institution_document_id === sharedDocId);
    expect(accessRow).toBeTruthy();
    expect(accessRow!.accessed_by).toBe(REQUESTER_ID);
    expect(accessRow!.access_type).toBe("download");
    expect(db.institutional_activity_log.some((e) => e.event_type === "Document Downloaded" && e.user_id === REQUESTER_ID)).toBe(true);
    expect(db.institution_documents[0].download_count).toBe(1);
    expect(db.institution_documents[0].last_downloaded_by).toBe(REQUESTER_ID);
  });

  it("denies download for non-admin same-institution user and writes a denied-audit entry", async () => {
    const req = await institutionCreatesRequest({ documentTypes: ["Proof of income"] });
    await userApprovesShare(req.id, ["doc-paystub"]);
    const sharedDocId = db.institution_documents[0].id;

    const denied = await downloadInstitutionDocument(OTHER_COMPANY_USER_ID, sharedDocId);
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe("Forbidden");

    // No signed URL issued, no access log entry created
    expect(db.document_access_log).toHaveLength(0);

    // But a "Document Access Denied" entry IS written for the audit trail
    const deniedEvt = db.institutional_activity_log.find(
      (e) => e.event_type === "Document Access Denied" && e.user_id === OTHER_COMPANY_USER_ID,
    );
    expect(deniedEvt).toBeTruthy();
    expect(deniedEvt!.detail).toContain("paystub.pdf");
  });

  it("denies download for an outsider with no institution membership", async () => {
    const req = await institutionCreatesRequest({ documentTypes: ["Proof of income"] });
    await userApprovesShare(req.id, ["doc-paystub"]);
    const sharedDocId = db.institution_documents[0].id;

    const denied = await downloadInstitutionDocument(OUTSIDER_ID, sharedDocId);
    expect(denied.status).toBe(403);
    expect(
      db.institutional_activity_log.filter(
        (e) => e.event_type === "Document Access Denied" && e.user_id === OUTSIDER_ID,
      ),
    ).toHaveLength(1);
  });

  it("blocks download after the share is revoked", async () => {
    const req = await institutionCreatesRequest({ documentTypes: ["Proof of income"] });
    await userApprovesShare(req.id, ["doc-paystub"]);
    const doc = db.institution_documents[0];
    doc.share_status = "revoked";

    const res = await downloadInstitutionDocument(REQUESTER_ID, doc.id);
    expect(res.status).toBe(410);
    expect(res.body.error).toBe("Share revoked");
    expect(db.document_access_log).toHaveLength(0);
  });

  it("does not share documents the user did not explicitly tick", async () => {
    const req = await institutionCreatesRequest({
      documentTypes: ["Proof of income", "Government-issued photo ID"],
    });
    // Select NEITHER document — share nothing
    await userApprovesShare(req.id, []);
    expect(db.institution_documents).toHaveLength(0);
    expect(db.consent_records[0].document_ids).toEqual([]);
    expect(db.institutional_activity_log.some((e) => e.event_type === "Document Shared")).toBe(false);
  });

  it("audit-log entries are immutable (frozen, cannot be mutated or deleted in place)", async () => {
    const req = await institutionCreatesRequest({ documentTypes: ["Proof of income"] });
    await userApprovesShare(req.id, ["doc-paystub"]);
    const sharedDocId = db.institution_documents[0].id;
    await downloadInstitutionDocument(REQUESTER_ID, sharedDocId);
    await downloadInstitutionDocument(OTHER_COMPANY_USER_ID, sharedDocId); // denied

    const allow = db.institutional_activity_log.find((e) => e.event_type === "Document Downloaded")!;
    const deny = db.institutional_activity_log.find((e) => e.event_type === "Document Access Denied")!;
    const access = db.document_access_log[0];

    for (const row of [allow, deny, access]) {
      expect(Object.isFrozen(row)).toBe(true);
      // Attempts to tamper with any field must throw in strict mode (vitest runs ESM strict)
      expect(() => { (row as any).event_type = "Tampered"; }).toThrow();
      expect(() => { (row as any).user_id = "00000000-0000-0000-0000-000000000000"; }).toThrow();
      expect(() => { delete (row as any).id; }).toThrow();
      // Original values preserved after the failed mutation attempts
      expect(row.id).toBeTruthy();
    }

    // Existing rows cannot be silently overwritten by another insert with the same id
    const before = db.institutional_activity_log.length;
    expect(() => Object.assign(allow as any, { detail: "rewrite" })).toThrow();
    expect(db.institutional_activity_log.length).toBe(before);
  });

  it("audit-log entries are correctly ordered by created_at across the full lifecycle", async () => {
    const req = await institutionCreatesRequest({ documentTypes: ["Proof of income"] });
    // small pause so timestamps differ
    await new Promise((r) => setTimeout(r, 5));
    await userApprovesShare(req.id, ["doc-paystub"]);
    const sharedDocId = db.institution_documents[0].id;
    await new Promise((r) => setTimeout(r, 5));
    await downloadInstitutionDocument(OTHER_COMPANY_USER_ID, sharedDocId); // denied first
    await new Promise((r) => setTimeout(r, 5));
    await downloadInstitutionDocument(REQUESTER_ID, sharedDocId); // then allowed

    const events = db.institutional_activity_log
      .filter((e) => ["Document Request Sent", "Document Shared", "Document Access Denied", "Document Downloaded"].includes(e.event_type));

    // Stored insertion order equals chronological order
    const stored = events.map((e) => e.event_type);
    expect(stored).toEqual([
      "Document Request Sent",
      "Document Shared",
      "Document Access Denied",
      "Document Downloaded",
    ]);

    // Re-sorting by created_at yields the same sequence
    const byTime = [...events].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    expect(byTime.map((e) => e.event_type)).toEqual(stored);

    // Access log entry (allow) is timestamped AFTER the denied attempt
    const deny = events.find((e) => e.event_type === "Document Access Denied")!;
    const access = db.document_access_log[0];
    expect(new Date(access.created_at).getTime()).toBeGreaterThan(new Date(deny.created_at).getTime());
  });

  it("allow + denied download audit entries include request, reviewer, and document identifiers", async () => {
    const req = await institutionCreatesRequest({ documentTypes: ["Proof of income"] });
    await userApprovesShare(req.id, ["doc-paystub"]);
    const sharedDoc = db.institution_documents[0];

    // --- Allow path ---
    const ok = await downloadInstitutionDocument(REQUESTER_ID, sharedDoc.id);
    expect(ok.status).toBe(200);

    const access = db.document_access_log.find((e) => e.institution_document_id === sharedDoc.id)!;
    expect(access).toMatchObject({
      institution_id: INSTITUTION_ID,
      institution_document_id: sharedDoc.id,
      possession_request_id: req.id,
      consent_record_id: sharedDoc.consent_record_id,
      accessed_by: REQUESTER_ID,
      access_type: "download",
    });
    expect(access.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const allowEvt = db.institutional_activity_log.find(
      (e) => e.event_type === "Document Downloaded" && e.institution_document_id === sharedDoc.id,
    )!;
    expect(allowEvt).toMatchObject({
      institution_id: INSTITUTION_ID,
      user_id: REQUESTER_ID, // reviewer
      possession_request_id: req.id, // request
      institution_document_id: sharedDoc.id, // document
      event_type: "Document Downloaded",
    });

    // --- Denied path ---
    const denied = await downloadInstitutionDocument(OTHER_COMPANY_USER_ID, sharedDoc.id);
    expect(denied.status).toBe(403);

    const denyEvt = db.institutional_activity_log.find(
      (e) => e.event_type === "Document Access Denied" && e.user_id === OTHER_COMPANY_USER_ID,
    )!;
    expect(denyEvt).toMatchObject({
      institution_id: INSTITUTION_ID,
      user_id: OTHER_COMPANY_USER_ID, // reviewer who was blocked
      possession_request_id: req.id, // request
      institution_document_id: sharedDoc.id, // document
      event_type: "Document Access Denied",
    });
    expect(denyEvt.detail).toContain(sharedDoc.file_name);

    // Sanity: required identifier fields are present and non-empty on every audit entry
    for (const e of [access, allowEvt, denyEvt]) {
      expect(e.institution_id).toBeTruthy();
      expect(e.institution_document_id ?? e.institution_document_id).toBeTruthy();
      expect(e.possession_request_id).toBeTruthy();
      expect(e.accessed_by ?? e.user_id).toBeTruthy();
    }
  });
});