# Code review process — Helpline1097-UI-NEXT

> Principle (from the AMRIT mentors): **Claude reviews code better than it writes it.**
> AI accelerates the port; disciplined review keeps it honest. This is **not** a vibe-coding project.

Two gates stand between a migrated module and `main`: an **automated anti-stub check** and an
**AI multi-lens review**, followed by human review. Both must pass; the PR's Definition of Done
checklist (`.github/PULL_REQUEST_TEMPLATE.md`) records the result.

## 1. Anti-stub gate (automated)

```bash
npm run verify:nostub
```

Fails the build if changed source files contain TODO/FIXME/XXX/HACK, `@ts-ignore`/`@ts-nocheck`,
`"not implemented"`, `debugger`, leftover `console.log/debug`, or `lorem ipsum`. Run it locally
before every PR; wire it into CI. (Pattern list lives in `scripts/verify-nostub.mjs` and is tunable.)

## 2. AI multi-lens review (before human review)

For each feature PR, run a panel of focused review passes against **the diff + the corresponding
old-app component**, using `/code-review` (routine) or a fan-out workflow (large/critical PRs —
auth, beneficiary-registration, outbound, Everwell):

1. **Parity** — fields/actions/validations/branches present in the old component but missing in the new.
2. **Anti-stub** — TODOs, dummy data, unwired handlers, dead code, fake responses (reasons about intent, backing up gate 1).
3. **API-contract** — every HTTP call matches the old service: endpoint, method, body, and the `{ statusCode, data, errorMessage }` envelope (codes `200`/`5002`/`5006`), token + `apikey` handling.
4. **Correctness / security** — bugs, RxJS/signal misuse, subscription leaks, auth/encryption regressions, XSS via `innerHTML`.
5. **Convention** — AMRIT `app-modules/` placement, standalone + signals, ZardUI-only, i18n keys, a11y, GPL header, naming.

Each finding has **severity (High/Medium/Low)**, `file:line`, and a concrete fix, and is
**adversarially verified** (a finding is "real" only if it survives a second skeptical pass).

### Gating rule
- **High** → must fix before merge.
- **Medium** → fix, or explicitly waive in the PR with a one-line justification the mentor can see.
- **Low** → tracked, batched.

The consolidated findings are pasted into the PR thread so the mentor sees what was checked and fixed.
