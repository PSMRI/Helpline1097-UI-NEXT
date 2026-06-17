# Migration decisions & conventions — Helpline1097-UI-NEXT

Tracking issue: PSMRI/AMRIT#128. Full roadmap: `Helpline1097-UI-Migration-Roadmap.pdf`.

## Resolved

| # | Decision | Choice |
|---|---|---|
| Target | Framework | **Angular 20** (standalone, lazy routes, signals) |
| Folder | Structure | **AMRIT `src/app/app-modules/…` convention** (aligned with 104-NEXT & MMU), standalone internals — no NgModules |
| UI | Library | **ZardUI**, consumed from the **Common-UI** git submodule (`Common-UI/v2/ui/*`); Tailwind v4 |
| Shared-first | Component ownership | Anything reusable across AMRIT front-ends is built/PR'd into **Common-UI**, not duplicated here (A7) |
| HTTP | Layer | `HttpClient` + functional interceptors (auth, apikey, loader, error/session) |
| Czentrix | Telephony | **Out of scope for now** — stubbed behind an interface (per mentor) |
| Quality | Anti-stub gate | `npm run verify:nostub` + per-PR Definition of Done + AI multi-lens review (A1–A3) |

## Adopted from the 104 plan (process) — applies to 1097

- **A1** anti-stub CI check · **A2** PR template / DoD · **A3** 5-lens AI review → see `code-review-process.md`.
- **A4** Build a reusable **DataTable + ConfirmDialog first** (Phase 2) — 28+ legacy md2 tables depend on it.
- **A5** Keep **`SessionStorageService` AES/CryptoJS encryption byte-compatible** with MMU/104 (Phase 1).
- **A6** **Piramal blue/white** theme tokens in `styles.css` (provisional values set — confirm exact palette, D3).
- **A7** Contribute genuinely-shared shell/auth/dialog to **Common-UI**, not per-app.

## 1097 ≠ 104 (do NOT copy 104's specifics)

| Aspect | 104 | **1097** |
|---|---|---|
| Response envelope | `{ response, error }` | **`{ statusCode, data, errorMessage }`** (200/5002/5006) |
| Roles | 9 clinical roles | **CO / Supervisor / Admin** |
| Domain | case-sheet, CDSS, SNOMED, prescription, screenings, SIO | **Everwell** adherence outbound, grievance, CO counselling/feedback/info/referral, demographic reports |
| i18n | static `assets/i18n` | **API-driven** (`getLanguageList`) |
| Env bases | ip104 + commonAPI + telephoneServer | commonAPI + ip1097 + **adminAPI** + telephoneServer |

## Open — to confirm with mentor (drtechie)

- ~~**D2 — Change detection**~~ **RESOLVED → zoneless.** `provideZonelessChangeDetection()`; zone.js removed from polyfills/deps. Evidence: the old app uses **zero** manual change detection and its zone-dependent surface is dominated by ordinary HTTP subscriptions (~419) with almost no exotic async (jQuery is being removed) — easiest category to make zoneless-correct during a full rewrite. **Guardrail:** all async-updated component state MUST be a `signal` or `async` pipe — no plain-field assignment inside `.subscribe()`; enforced by the AI review convention lens + the per-PR "view updates" check.
- **D3 — Theme palette:** exact Piramal blue/white token values (coordinate with Gopi + Aarti).
- **Backend API path prefixes** for the dev proxy (confirm against a known-good UAT endpoint).
