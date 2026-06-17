# Helpline1097-UI-NEXT

Angular 20 rewrite of the AMRIT **Helpline 1097** (National AIDS Helpline) front-end —
migrating from Angular 4 to **Angular 20 + Zard UI + Tailwind CSS v4**.
Tracking issue: [PSMRI/AMRIT#128](https://github.com/PSMRI/AMRIT/issues/128).

## Setup

```bash
git clone --recurse-submodules <repo-url>
cd Helpline1097-UI-NEXT
npm install
npm start
```

Already cloned without submodules:

```bash
git submodule update --init --recursive
```

## Notes

- **Common-UI** (shared Zard UI kit) is a git submodule at `./Common-UI`, imported via the `Common-UI/*` path alias.
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
