# Helpline1097-UI-NEXT

Angular 20 + Zard UI + Tailwind CSS v4 rewrite of the AMRIT **Helpline 1097** (National AIDS Helpline)
front-end. This repository is the migration target for the legacy
[Helpline1097-UI](https://github.com/PSMRI/Helpline1097-UI) (Angular 4.4.4). See the migration
roadmap (`Helpline1097-UI-Migration-Roadmap.pdf`) for the full plan. Tracking issue:
[PSMRI/AMRIT#128](https://github.com/PSMRI/AMRIT/issues/128).

## Stack

| Concern        | Choice                                                            |
| -------------- | ----------------------------------------------------------------- |
| Framework      | Angular 20 (standalone components, lazy routes)                   |
| UI library     | Zard UI (shadcn-style), consumed from the **Common-UI** submodule |
| Styling        | Tailwind CSS v4 (`@tailwindcss/postcss`, `tailwindcss-animate`)   |
| Icons          | `@ng-icons/core` + `@ng-icons/lucide`                             |
| Variants / cn  | `class-variance-authority`, `clsx`, `tailwind-merge`              |
| Toasts         | `ngx-sonner`                                                      |
| HTTP           | `HttpClient` + functional interceptors (Phase 1)                  |

## Getting started

```bash
git clone --recurse-submodules <repo-url>
cd Helpline1097-UI-NEXT
npm install              # .npmrc sets legacy-peer-deps (see note below)
npm start                # ng serve on http://localhost:4200 with the dev proxy
```

If you already cloned without submodules:

```bash
git submodule update --init --recursive
```

> **Peer deps:** `@ng-icons` publishes peer ranges ahead of Angular's release cadence, while
> Common-UI pins exact versions against Angular 20. `.npmrc` enables `legacy-peer-deps` so installs
> resolve cleanly.

## Backend / proxy

Local dev talks to the shared AMRIT dev backend via a proxy (avoids CORS):

- Target: `https://amritwprdev.piramalswasthya.org`
- Config: `proxy.conf.js` (wired into `angular.json` → `serve.options.proxyConfig`)
- Dev API base URLs are origin-relative (`/`) in `src/environments/environment.development.ts`,
  so every request is same-origin and forwarded by the proxy.

> The proxy `context` list and the dev base URLs are seeded from the legacy app's API path
> segments. **Confirm/extend them against the backend's real path layout when wiring the first
> real endpoints (Phase 1/3).**

## Common-UI (shared component library)

Reusable, cross-product UI lives in the [Common-UI](https://github.com/PSMRI/Common-UI) repo
(branch `feat/v2-ui-zardui`), included here as a git **submodule** at `./Common-UI` and imported
via the `Common-UI/*` path alias, e.g.:

```ts
import { ZardButtonComponent } from 'Common-UI/v2/ui/button';
```

**Rule:** any component reusable by other AMRIT front-ends is built/PR'd into Common-UI, not
duplicated here. The Zard kit currently ships: button, dialog, form, input, loader, pagination,
table, toast. Missing primitives (select, datepicker, tooltip, icon, tabs, radio, checkbox, …)
are built in Common-UI during Phase 2.

## Project structure

Follows the AMRIT `app-modules/` convention (aligned with Helpline104-NEXT & MMU); standalone
internals, one feature folder = one lazy `*.routes.ts`.

```
src/app/
  app-modules/
    core/            # app-wide singletons: auth/ http/ services/ models/ components/ directives/
    login/           # login, captcha, set-password, set-security-questions, reset-password
    role-selection/  # multi-role-screen, service-role-selection
    dashboard/       # dashboard + navigation/row-header/user-id + widgets
    call/            # CO inbound: registration → services → updates → closure (router, no jQuery)
    outbound/        # worklists, allocate/search/reallocate
    everwell/        # Everwell adherence outbound + guidelines upload
    grievance/       # grievance + outbound allocation/worklist/resolution
    supervisor/      # quality-audit, agent-status, force-logout, sms-template, configs, reports
    admin/           # users, roles, language/service/screen masters, service-provider
    reports/         # demographic + call-type reports, exports
    feedback/        # consumes Common-UI v2/feedback
  shared/            # reusable, no business logic: components/ pipes/ utils/
  app.config.ts      # providers (router, HttpClient + interceptors)
  app.routes.ts      # top-level lazy routes
Common-UI/           # git submodule (shared Zard UI kit)
proxy.conf.js        # dev proxy → AMRIT dev backend
scripts/             # verify-nostub.mjs (anti-stub gate)
docs/                # decisions.md, code-review-process.md
src/environments/    # environment.ts (prod) + environment.development.ts (dev)
```

## Scripts

| Command          | Description                |
| ---------------- | -------------------------- |
| `npm start`      | Dev server + proxy         |
| `npm run build`  | Production build           |
| `npm run watch`  | Dev build, watch mode      |
| `npm test`       | Unit tests (Karma/Jasmine) |
| `npm run verify:nostub` | Anti-stub gate (run before every PR) |

## License

GPL-3.0 — part of AMRIT. See `LICENSE`.
