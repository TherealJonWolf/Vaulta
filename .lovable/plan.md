## Goal

Make every byte of applicant data flowing into the Sovereign Sector (institutional side) **unreadable to the server, Lovable, and admins** — only an institution that holds its passphrase can decrypt. Mirror the existing tenant vault model, but adapted for the intake flow where applicants don't have the institution's passphrase.

## Cryptographic design

Each institution sets a **Vault Passphrase** once (no recovery — same policy as tenant vault).

On setup, in the browser:

```text
salt           = 32 random bytes
KEK            = PBKDF2-SHA256(passphrase, salt, 100k iters)  → AES-256-GCM
RSA-OAEP-4096  = generated keypair
public_key     = exported SPKI (published, world-readable for that institution)
private_key    = exported PKCS8, AES-GCM-encrypted with KEK   (stored, server-opaque)
verify_blob    = AES-GCM(KEK, "VAULTA_INST_VERIFY")           (passphrase check)
```

Server stores only: `salt`, `verify_blob`, `wrapped_private_key`, `public_key`. **It never sees the passphrase, KEK, or private key.**

On intake (public `/submit/:token`):
1. Browser fetches the institution's `public_key` via an RPC scoped to the intake token.
2. For each file: generate fresh AES-256-GCM `data_key` + 12-byte IV, encrypt file → `ciphertext`.
3. Wrap `data_key` with the institution's RSA-OAEP public key → `wrapped_key`.
4. Upload `{ciphertext, iv, wrapped_key}` to `institution-documents` bucket + metadata row.
5. Encrypt structured intake fields (applicant name, ref id, document types, file names) the same way — random data key, RSA-wrapped.

On staff view (institutional dashboard):
1. Existing passphrase gate (already required for the dashboard) derives KEK and unwraps the institution private key into a session-only `CryptoKey`.
2. For each item: unwrap data key with private key → decrypt payload → render in-memory.

Server-generated content (assessment narrative, automated scores) is encrypted by the edge function using the institution's **public** key after computing — server still can't read it back, only the institution can.

## Files

### New
- `src/institutional/lib/institutionEncryption.ts` — keypair gen, wrap/unwrap, file + JSON encrypt/decrypt helpers (uses existing `src/lib/encryption.ts` + worker).
- `src/institutional/hooks/useInstitutionVault.ts` — mirror of `useVaultEncryption`: `checkPassphraseExists`, `createPassphrase`, `unlockVault`, `decryptFile`, `decryptJson`, `lockVault`. Holds session-only unwrapped private key.
- `src/institutional/components/InstitutionVaultGate.tsx` — set/unlock UI shown before the dashboard renders (extends current institutional passphrase gate).
- `supabase/functions/get-institution-public-key/index.ts` — `verify_jwt = false`; accepts intake token, returns `{ public_key, institution_id }` only if token is valid + active. No private material exposed.
- `supabase/migrations/<ts>_institution_e2e_encryption.sql`:
  - `CREATE TABLE public.institution_passphrases (institution_id uuid PK, salt text, verify_blob text, wrapped_private_key text, public_key text, created_at, updated_at)` with GRANTs + RLS (members read their own; admins of that institution write once).
  - Add nullable columns to `institution_documents`: `wrapped_key text`, `iv text`, `encryption_version text` (default `'v1-rsa-oaep-4096+aes-256-gcm'`).
  - Add nullable encrypted-payload columns to `intake_submissions`: `encrypted_payload text`, `payload_wrapped_key text`, `payload_iv text` (existing plaintext columns kept nullable for back-compat; new rows write encrypted only).
  - Add encrypted columns to `institutional_review_logs` and `manual_review_queue` for reviewer notes/narratives: `encrypted_note`, `note_wrapped_key`, `note_iv`.
  - RPC `get_institution_public_key_for_token(p_token text)` (SECURITY DEFINER) returning the public key + institution_id when the token is valid.

### Edited
- `src/pages/SubmitDocuments.tsx` — fetch public key, encrypt each file in-browser via the existing `src/lib/encryption.worker.ts`, post ciphertext + wrapped key as multipart. UI copy stays the same; only the network payload changes.
- `supabase/functions/institutional-submit/index.ts` — receive ciphertext blobs, write them to `institution-documents` bucket, persist encrypted metadata. Generate the narrative server-side, then encrypt it with the institution's public key (fetched by `institution_id`) before insert. No plaintext payload columns written for new submissions.
- `supabase/functions/download-institution-document/index.ts` — return raw ciphertext + wrapped key + iv to authorized staff; decryption happens in the browser.
- `src/institutional/pages/InstitutionalDashboard.tsx`, `InstitutionalIntake.tsx`, `ManualReviewQueue.tsx`, `DocumentsOnFile.tsx`, `ReviewActivityLog.tsx`, `FraudRiskPanel.tsx` — pull encrypted blobs, decrypt via `useInstitutionVault`, render in-memory. Show "Unlock vault to view" placeholder when locked.
- `src/institutional/lib/reviewLog.ts` — encrypt reviewer notes before insert, decrypt on read.
- `src/institutional/InstitutionalRoutes.tsx` — mount `InstitutionVaultGate` ahead of all `/institutional/*` routes that read applicant data.

### Tests
- `src/test/institutionEncryption.unit.test.ts` — roundtrip: setup → encrypt-as-applicant (public key only) → unlock → decrypt; wrong passphrase fails; tampered ciphertext throws.
- Extend `src/test/sovereignSectorEncryption.e2e.test.ts` with intake → dashboard decrypt flow (mocked Supabase).

## Security properties preserved

- Server never sees plaintext, passphrase, KEK, or private key.
- Lost passphrase = unrecoverable institution data (matches user choice).
- RLS unchanged on existing tables; new table follows the user-roles pattern + GRANT block.
- No changes to tenant vault, auth, or RBAC.
- Existing rows remain readable (plaintext columns kept nullable); only new writes are encryption-only.

## Out of scope (will not touch)

- Tenant vault, document verification pipeline, billing, MFA, Veriff, RBAC roles.
- Migrating historical plaintext rows to encrypted form — backfill is a separate task; flagged in code with a TODO.
- Multi-admin escrow or recovery codes (explicitly declined).

## Risks / open questions

- RSA-OAEP-4096 keygen in the browser is ~1–3s; acceptable one-time during passphrase setup, runs in the existing crypto worker.
- Applicants can no longer view their own submitted files post-upload (they have no decryption key) — acceptable for institutional intake, matches the "Sovereign Sector" trust model.
