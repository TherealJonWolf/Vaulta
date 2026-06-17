# Implementation Plan — 5 Scoped Maintenance Fixes

Before touching code, here is the exact set of files I expect to read/modify for each issue. No new features, no unrelated refactors.

## 1. UI layout fix — Technical Overview / Edge Functions table

**Investigate**
- `src/pages/ApiReference.tsx` (Edge Functions / endpoints rendering)
- `src/pages/Documentation.tsx` and any institutional "technical overview" page (likely `src/institutional/pages/InstitutionalReporting.tsx` or a settings/overview page) — locate the actual table that lists `generate-trust-report`, `veriff-session`, `stripe-webhook`.

**Change (smallest possible)**
- Wrap table in `overflow-x-auto` container, add `break-all` / `whitespace-normal` / `min-w-0` on path + description cells, switch to a responsive `<dl>`-style stacked layout under `md:` breakpoint where a table is too wide.
- No content, ordering, or styling-system changes beyond what's needed to stop the clipping.

## 2. Encryption performance — move PBKDF2 + AES-GCM into a Web Worker

**Investigate**
- `src/lib/encryption.ts` (algorithms, current API)
- `src/hooks/useVaultEncryption.ts` (callers: `deriveKeyFromPassword`, `encryptData`, `decryptData`)
- Other call sites via ripgrep for `deriveKeyFromPassword|encryptData|decryptData|encryptFile|decryptFile`.

**Change**
- Add `src/lib/encryption.worker.ts` — a typed Web Worker that handles `derive`, `encrypt`, `decrypt`, `hash` messages. Keep crypto behaviour byte-identical (same PBKDF2 params, same AES-GCM 12-byte IV / 128-bit tag).
- Add `src/lib/encryptionClient.ts` — a thin typed wrapper that posts messages with request IDs and resolves promises. Exports the same function names so callers don't change.
- Update `src/lib/encryption.ts` to re-export from `encryptionClient` (keeping the existing pure functions as a fallback for tests/SSR where `Worker` is unavailable).
- `useVaultEncryption.ts` continues to call the same functions; no API change.
- Keys still flow through `CryptoKey` handles transferred via `postMessage` (structured clone supports `CryptoKey`).

**Validate**
- Existing tests in `src/test/sovereignSectorEncryption.e2e.test.ts` and `sovereignSectorLargeDocument.e2e.test.ts` continue to pass against the pure-function fallback (Node/vitest has no `Worker`).

## 3. PDF execution — delegate heavy work out of Edge runtime

**Investigate**
- `supabase/functions/issue-assessment-report/index.ts`
- `supabase/functions/adverse-action-pdf/index.ts`
- Look for existing "Railway background service" hook — likely an env var like `RAILWAY_PDF_URL` / `PDF_SERVICE_URL` or a similar dispatcher already referenced in the repo. If none exists, I will use a single `PDF_SERVICE_URL` secret as the closest equivalent (no new infra invented).

**Change**
- Refactor both edge functions so they:
  1. Authenticate + authorize (unchanged).
  2. Build the signed JSON payload (unchanged).
  3. If `PDF_SERVICE_URL` is set, `fetch` the external service with a shared-secret header and stream the returned PDF back. Otherwise fall back to the existing inline jsPDF path (preserves current behaviour when no service is configured).
- No business-logic or report-content changes.

## 4. Region routing — standardized region tag

**Investigate**
- `institutions`, `institution_documents`, and `documents` tables (column lists via `supabase--read_query`).
- Upload paths: `src/components/DocumentUpload.tsx`, `src/institutional/components/DocumentPossessionRequest.tsx`, edge function `download-institution-document`.

**Change (smallest)**
- Single migration: add nullable `region text` to `institutions` and `institution_documents` (default `null`, no backfill, no RLS change). Tables already exist; no new GRANTs needed.
- Upload code reads `institution.region` (if present) and writes it into `institution_documents.region` on insert. Storage path remains the same; the column is the routing identifier downstream consumers can honour.
- No tenant-visible behaviour change when `region` is null.

## 5. Test hardening — FraudRiskPanel + raceGuardedFetch

**Investigate**
- `src/institutional/components/FraudRiskPanel.test.tsx`
- `src/institutional/lib/raceGuardedFetch.test.ts`
- `src/test/setup.ts` for existing MSW/fetch mocking utilities.

**Change**
- Add a small `vi.fn()`-based `fetch` mock helper (no new framework). Use existing vitest + jsdom.
- Add cases: Stripe 500 + retry, Veriff timeout, Resend dropped webhook (no response), Lovable AI Gateway slow (>2s) + abort, success-after-retry. Assert fallback UI / error toasts / no double-submit for the panel; assert race-guard discards stale responses and surfaces `AbortError`.

## Validation steps after each fix
- `bunx vitest run` for the touched test files.
- Re-run `documentRequestFlow.e2e.test.ts`, `sovereignSectorEncryption.e2e.test.ts`, `sovereignSectorLargeDocument.e2e.test.ts` after the worker refactor.
- Visual check of the technical-overview page in preview at mobile + desktop widths.
- Confirm no RLS / policy / GRANT changes other than the single additive `region` column migration.

## Out of scope (will stop and report if encountered)
- Any new product surface, new route, new auth rule.
- Rewriting the encryption protocol or PDF content.
- Changing existing RLS policies.
- Introducing a new test runner, MSW, or Playwright.

Please approve and I will proceed in the order above, validating after each step.