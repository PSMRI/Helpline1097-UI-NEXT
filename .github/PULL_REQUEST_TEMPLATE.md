<!--
  Helpline1097-UI-NEXT — Pull Request
  Every migration PR must satisfy the Definition of Done below before review.
-->

## What & why
<!-- One or two lines. Link the tracking issue. -->
Part of PSMRI/AMRIT#128.

## Old → new
<!-- Which legacy component(s)/service(s) does this port? Attach old-vs-new screenshots for UI. -->

## Definition of Done
- [ ] **Feature parity** — every screen/field/action from the old component is present (old vs new screenshots attached).
- [ ] **No stubs** — `npm run verify:nostub` passes; no TODO/placeholder/dummy data; every button/link wired to a real action.
- [ ] **API verified** — each HTTP call diffed against the old service: same endpoint, method, body shape, and **`{ statusCode, data, errorMessage }`** handling (incl. `5002`/`5006` paths). UAT call tested (screenshot/log attached).
- [ ] **Forms** — all old template-driven validations reproduced (Reactive Forms or ngModel as agreed); error messages match.
- [ ] **State** — focused signal stores / `inject()`; no `dataService` god-object pattern; subscriptions cleaned up.
- [ ] **Roles/privileges** — screen visibility honours `Previlege[]` filtered to service **`1097`** (roles: CO / Supervisor / Admin).
- [ ] **i18n** — visible strings use the app's API-driven language set (`getLanguageList`); no hardcoded English.
- [ ] **Theme** — Piramal blue/white tokens; ZardUI components only; no stray Material/`md-*`/Bootstrap.
- [ ] **Shared-first** — anything reusable across AMRIT front-ends is added to **Common-UI**, not duplicated here.
- [ ] **Accessibility** — labels, focus order, keyboard nav, `aria-*` on dialogs/tables.
- [ ] **Responsive** — verified at mobile + desktop breakpoints.
- [ ] **Tests** — unit tests for services/stores; happy-path + one error-path per component.
- [ ] **Build** — `ng build` (prod) clean; `ng serve` clean; lint/prettier clean.
- [ ] **AI review passed** — the code-review pass ran; all High/Medium findings resolved or explicitly waived with reason.
