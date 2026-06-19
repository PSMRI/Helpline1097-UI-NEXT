# Helpline1097-UI-NEXT

Angular 20 rewrite of the AMRIT **Helpline 1097** (National AIDS Helpline) front-end —
migrating from Angular 4 to **Angular 20 + Zard UI + Tailwind CSS v4**.
Tracking issue: [PSMRI/AMRIT#128](https://github.com/PSMRI/AMRIT/issues/128).

## Setup

```bash
git clone --recurse-submodules <repo-url>
cd Helpline1097-UI-NEXT
npm install
cp src/environments/environment.dev.ts src/environments/environment.ts   # git-ignored local default
npm start
```

`npm start` (default `development` config) talks to the shared dev backend through the proxy
(`proxy.conf.js`) — the backend has no CORS headers for `localhost`, so direct calls are blocked.
Other configs: `--configuration local` (localhost backend), `dev`, `test`, `production`.

Already cloned without submodules:

```bash
git submodule update --init --recursive
```

## Notes

- **Common-UI** (shared Zard UI kit) is a git submodule at `./Common-UI`, imported via the `@common-ui/*` path alias (→ `Common-UI/v2/*`), e.g. `@common-ui/ui/button`.
- Standalone components, zoneless change detection, AMRIT `app-modules/` structure.
- The dev server proxies API calls to the AMRIT dev backend — see `proxy.conf.js`.

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Dev server (with API proxy) |
| `npm run build` | Production build |
| `npm test` | Unit tests |
| `npm run verify:nostub` | Anti-stub check |
| `npm run license:check` | GPL-3.0 header check |

## License

GPL-3.0 — part of AMRIT. See `LICENSE`.
