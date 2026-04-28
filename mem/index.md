# Project Memory

## Core
Supabase (Edge Functions, RLS, Storage), Stripe, Veriff, jsPDF. Strict RBAC.
Zero-Knowledge E2E encryption. Vault Passphrase (PBKDF2-SHA256 -> AES-256-GCM) required for ALL accounts.
Strict tenant (/app/*) vs institutional (/institutional/*) isolation. No shared state.
Design (Tenant): High-security cyberpunk. Dark #0A0E14, cyan #00F5FF. Orbitron/Inter.
Design (Institutional): Professional, minimal. White bg, dark navy text, neutral blue.
Tone: Vaulta™ brand. StoryBrand-aligned. NEVER use "military-grade", "approved", or "denied".
Free tier: 3 docs limit enforced via real-time check. Premium: Unlimited.

## Memories
- [Aesthetic design](mem://design/aesthetic) — High-security cyberpunk visual aesthetic (dark/cyan) for tenant vault
- [Brand identity](mem://branding/identity) — Brand guidelines, neutral non-promissory tone, tryvaulta.com
- [Compliance encryption](mem://security/compliance-and-encryption) — E2E, Zero-Knowledge principles, compliance standards
- [Institution ingestion](mem://features/institution-ingestion) — Sovereign Sector vault logic for auto-verified ingestion
- [Authentication MFA](mem://security/authentication-mfa-details) — TOTP MFA and SHA-256 hashed recovery codes
- [AI Oracle](mem://features/ai-oracle-details) — Tiered AI Oracle system limits and premium capabilities
- [Security dashboard UI](mem://features/security-dashboard/overview) — Security dashboard audit trail UI
- [Document verification](mem://features/vault/document-management) — 9-layer document verification pipeline rules
- [Payments architecture](mem://technical/payments-architecture) — Stripe session management, 3-document limit enforcement
- [Subscription plans](mem://monetization/subscription-plans) — Premium vault limits and subscription enforcement
- [Compliance audit UI](mem://features/compliance-audit/dashboard) — Real-time compliance auditing system UI
- [Encryption implementation](mem://security/encryption-implementation) — PBKDF2-SHA256 derived keys, AES-256-GCM requirements
- [User Trust Score](mem://features/user-trust-score) — Trust score algorithms, limits, decay, and document weighting
- [Threat simulation](mem://features/security/threat-simulation) — Threat Simulation UI interaction and visual flow
- [Email service](mem://technical/integrations/email-service) — Resend integration for admin fraud notifications
- [Veriff identity](mem://features/identity-verification/veriff) — Government ID checks and liveness detection via Veriff
- [Brand story](mem://branding/brand-story) — Brand page components and '9 Layers of Protection' rail UI
- [PWA installation](mem://features/pwa-installation) — Progressive Web App installation flows and UI
- [Document translation](mem://features/vault/document-translation) — Base64 OCR translation logic and UI
- [Operational boundaries](mem://compliance/operational-boundaries) — Platform scope (trust-signals, not guarantor)
- [Housing qualification](mem://features/housing-qualification) — Landing page housing qualification messaging
- [Data consistency engine](mem://security/data-consistency-engine) — 16 rules, probabilistic jitter, and cross-account correlation
- [RBAC](mem://security/role-based-access-control) — RBAC rules and app_role enum (admin, landlord, lender, applicant)
- [Admin security dashboard](mem://features/admin-security-dashboard) — Admin dashboard UI, unlocking users, and visibility
- [Password recovery](mem://auth/password-recovery-flow) — /reset-password logic bypassing vault redirection
- [Account lockout](mem://security/account-lockout-policy) — Mandatory 6-failed-login account lockout and warnings
- [Subscription bypass](mem://technical/payments/subscription-bypass) — Hardcoded TEST_ACCOUNTS whitelist for premium bypass
- [Upload monitoring](mem://features/admin-security-dashboard/upload-monitoring) — document_upload_events and progressive warning system
- [MIME type constraints](mem://technical/storage/mime-type-constraints) — application/octet-stream requirement for encrypted blobs
- [Document audit panel](mem://features/admin-security-dashboard/document-audit-panel) — Read-only verification results UI (8-check pipeline)
- [Subscription errors](mem://technical/api/subscription-error-handling) — useSubscription 401/403 interception, free-tier fallback
- [Landlord portal](mem://features/landlord-portal) — /landlord dashboard, data masking, and possession workflow
- [Profile sharing](mem://features/vault/profile-sharing) — Secure tokenized link sharing logic for applicant profiles
- [47-layer stack](mem://security/posture/forty-seven-layer-stack) — 47-layer cybersecurity stack breakdown
- [Trust indicators](mem://marketing/social-proof-and-trust-indicators) — Dynamic testimonials, enterprise-grade compliance badges
- [Lender dashboard](mem://features/lender-dashboard) — /lender dashboard controls (SOX, GLBA, FCRA) and persistent notes
- [Trust narrative](mem://features/trust-narrative) — Plain-language 4-sentence institutional assessment summaries
- [Trust narrative history](mem://features/trust-narrative/history-and-versioning) — Assessment history timeline and score deltas
- [Authentication policy](mem://security/authentication-policy) — Mandatory email verification and password complexity rules
- [Backend automation](mem://technical/backend-automation) — Scheduled maintenance cron and Webhooks (Stripe, Veriff)
- [Onboarding tours](mem://features/onboarding-and-notifications) — 7-step Framer Motion vault tour and notification center
- [Client PDF generation](mem://technical/frontend/pdf-generation) — jsPDF client-side generation for branded reports
- [Institutional isolation](mem://technical/architecture/institutional-isolation) — Strict separation between /app/* and /institutional/* contexts
- [Document intake system](mem://features/institutional/document-intake-system) — Public /submit/:token document intake page logic
- [Dashboard pipeline](mem://features/institutional/dashboard-pipeline) — 4-column kanban assessment pipeline for institutions
- [Institutional compliance](mem://features/compliance/institutional-verification-and-certification) — Interactive compliance badges and certificates
- [Server PDF generation](mem://technical/pdf-generation/institutional-assessment-records) — Server-side PDF generation for institutional records
- [Real-time alerts](mem://features/admin-security-dashboard/real-time-alerts) — Background push notifications for critical security events
- [Institutional personalization](mem://features/institutional/personalization) — Custom branding, logos, and display names for institutions
- [Role-based redirection](mem://auth/role-based-redirection) — Role-aware routing to /institutional or /vault
- [Sign-out strategy](mem://technical/auth/sign-out-strategy) — Global sign-out with local fallback on error
- [Intake reference IDs](mem://features/institutional/intake-reference-ids) — Internal institution ID mapping for intake links
- [Institutional passphrase gate](mem://security/institutional/passphrase-gate) — Zero-knowledge Vault Passphrase requirement for institutional dashboard
- [Document possession workflow](mem://features/compliance/document-possession-workflow) — Explicit consent-based document transfer and audit logic
- [Multi-bucket architecture](mem://technical/storage/multi-bucket-architecture) — Storage partition rules across 3 dedicated Supabase buckets
- [User personalization](mem://features/vault/user-personalization) — Custom vault names, accent colors, and profile fields
- [Security headers](mem://security/hardening/headers) — Security response headers and .well-known/security.txt
- [Branding isolation](mem://security/database/branding-isolation) — get_institution_branding function for public assets
- [Institutional aesthetic](mem://design/institutional-aesthetic) — Minimalist professional styling for /institutional/* routes
- [SOC module](mem://features/admin-security-dashboard/soc-module) — SOC-style admin incident queue and event timelines
- [Malware mitigation](mem://security/malware-mitigation-strategy) — Malware prevention via 9-layer verification and encrypted blobs
- [Manual review queue](mem://features/institutional/manual-review-queue) — Human-in-the-loop queue for 60-75% AI confidence docs
- [AI Oracle auth](mem://technical/api/ai-oracle-auth-requirement) — Auth and ANON_KEY header requirements for ai-oracle-premium
- [Image upload constraints](mem://technical/storage/image-upload-constraints) — multipart/form-data 5MB limit for logo/profile images
- [AI operational guardrails](mem://security/posture/ai-operational-guardrails) — AI privacy boundaries, no hallucinations, and test document limits
- [Realtime publication](mem://security/realtime-publication-policy) — Exclusion of sensitive/PII tables from supabase_realtime
- [Technical overview](mem://documentation/technical-overview) — Vaulta_Technical_Product_Overview.md location
- [MFA admin reset](mem://technical/auth/mfa-admin-reset) — admin-reset-mfa edge function for force-deleting TOTP factors
- [Decision-grade review](mem://features/institutional/decision-grade-review) — Risk badges, Judge's Bench, decision narrative panel, Verified Income seal
- [Intake expiry window](mem://features/institutional/intake-expiry) — Configurable 24/48/72h intake window with tenant countdown
- [Adverse action notice](mem://features/institutional/adverse-action-notice) — Server-side FCRA-aligned PDF with embedded signature, "Notice Issued" badge
