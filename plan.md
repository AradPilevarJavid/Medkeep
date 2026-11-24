# MedKeep GUI — Implementation Plan

Status: approved, in progress (audit updated 2026-11-24)
Branch: `gui`
Worktree: `/home/arad/myprojects/Medkeep.worktrees/gui`

## 1. Decisions

| Area | Decision |
|---|---|
| Stack | Vanilla TypeScript + Vite (no framework) |
| Data | Client-side only: `localStorage` + import/export of `MEDKEEP v2` `.db` archives |
| Visual | Dual light/dark, system default, manual toggle, no flash |
| Language | English only, LTR (copy centralized for future i18n) |
| Scope | Single-page dashboard |
| Existing code | Reuse and harden the untracked `web/assets/js/*` modules |
| First run | Empty state + "Load demo data" button |
| Deploy | GitHub Pages static build |
| Gates | Vitest + Testing Library, ESLint + typescript-eslint strict, Prettier, `tsc --noEmit`, Playwright + axe |

## 2. Goals and non-goals

**Goals**

- A polished, trustworthy single-page dashboard over the real hash-chain and FIFO queue: add request -> process one/all -> verify -> export/import.
- Correct, accessible, fast, and safe by construction: no `innerHTML`, validated boundaries, WCAG 2.2 AA, reduced-motion support.
- Zero runtime dependencies beyond Zod; no network calls; works offline once loaded.
- A maintainable TypeScript codebase with strict types and real tests.

**Non-goals**

- No Django/DRF, no Next.js, no backend, no auth, no multi-user.
- Not a clinical system. FNV-1a is integrity checking, not authentication. The UI must say so.
- No virtualized table, no service worker, no i18n in v1 (documented as future work).

## 3. Verified toolchain (registry checked 2026-11-23)

| Package | Pin | Note |
|---|---|---|
| `vite` | 8.3.8 | Node `^20.19 \|\| >=22.12` |
| `vitest` | 5.1.1 | peers `vite ^6.4 \|\| ^7 \|\| ^8` |
| `typescript` | 6.0.3 | **not 7.x**: `typescript-eslint@8.73` peers `typescript >=4.8.4 <6.1.0` |
| `typescript-eslint` | 8.73.0 | peers `eslint ^8.57 \|\| ^9 \|\| ^10` |
| `eslint` | 10.15.0 | flat config |
| `@eslint/js` | 10.0.1 | recommended rules |
| `zod` | 4.6.7 | boundary validation |
| `@playwright/test` | 1.65.1 | e2e |
| `@axe-core/playwright` | 4.14.0 | accessibility assertions |
| `jsdom` | 31.0.1 | Node `^22.22.2 \|\| ^24.15 \|\| >=26` |
| `@testing-library/dom` | 10.4.2 | DOM tests |
| `@vitest/coverage-v8` | 5.1.1 | coverage |
| `prettier` / `eslint-config-prettier` | 3.10.1 / 10.1.8 | format/lint |
| `@fontsource-variable/inter` / `@fontsource-variable/jetbrains-mono` | 5.3.0 | self-hosted fonts, bundled |

**Node.** Local `26.13.1` satisfies every engine. CI pins **Node 24 LTS** (`.nvmrc` = `24`, `engines.node >=24`). Node 22 works only at `>=22.22.2`.

## 4. Repository changes

Work happens in the `gui` worktree. The untracked `web/` and `tests/frontend/` in the main checkout do not follow worktrees, so they are copied in as the starting point.

- `web/` becomes a self-contained Vite app; the C++ tree and `CMakeLists.txt` stay untouched.
- Root `.gitignore` gains `node_modules/`, `web/dist/`, `web/coverage/`, `web/.vite/`, `test-results/`, `playwright-report/`.
- The old `tests/frontend/*.test.mjs` cases are ported to Vitest and removed.

## 5. Target file tree

```
Medkeep.worktrees/gui/
├── plan.md
├── .gitignore
├── .github/workflows/pages.yml
└── web/
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── vite.config.ts
    ├── eslint.config.mjs
    ├── .prettierrc.json
    ├── .nvmrc
    ├── playwright.config.ts
    ├── public/
    │   ├── theme-init.js
    │   └── favicon.svg
    ├── src/
    │   ├── main.ts
    │   ├── domain/
    │   │   ├── types.ts
    │   │   ├── fnv1a.ts
    │   │   ├── chain.ts
    │   │   ├── archive.ts
    │   │   ├── schema.ts
    │   │   └── seed.ts
    │   ├── data/
    │   │   ├── storage.ts
    │   │   └── store.ts
    │   ├── ui/
    │   │   ├── app.ts
    │   │   ├── dom.ts
    │   │   ├── copy.ts
    │   │   ├── theme.ts
    │   │   ├── toast.ts
    │   │   └── components/
    │   │       ├── top-bar.ts
    │   │       ├── kpi-card.ts
    │   │       ├── status-pill.ts
    │   │       ├── composer.ts
    │   │       ├── queue.ts
    │   │       ├── records.ts
    │   │       ├── integrity-panel.ts
    │   │       ├── dialogs.ts
    │   │       └── empty-state.ts
    │   ├── lib/
    │   │   ├── format.ts
    │   │   ├── download.ts
    │   │   └── focus.ts
    │   └── styles/
    │       ├── tokens.css
    │       ├── reset.css
    │       ├── base.css
    │       ├── layout.css
    │       ├── components.css
    │       └── main.css
    └── tests/
        ├── unit/
        ├── ui/
        ├── types/
        └── e2e/
```

## 6. Domain layer — port and harden

Port `web/assets/js/*` to typed TypeScript without changing the byte format.

- **`fnv1a.ts`** — exact domain-separated construction; `BigInt` masking; test vector `30d909a7a87b317c` must stay green.
- **`chain.ts`** — `appendRecord` returns a frozen new array; `verifyRecords` returns a discriminated `Result` (`{ ok: true; value } | { ok: false; error }`), never throws for invalid data.
- **`archive.ts`** — preserve `MEDKEEP\t2`, tab fields, hex encoding, header/order/digest validation. Parse returns a typed `ParsedArchive`.
- **`schema.ts`** — Zod 4 schemas for `RecordEntry`, `PendingRequest`, `DashboardState`. Validate every value crossing a boundary: `localStorage` JSON, imported archive object, file text length.
- **`types.ts`** — `Result<T, E>`, `RecordEntry`, `PendingRequest`, `DashboardState`, `Verification`. No `any`.
- **`storage.ts`** — `loadState` / `saveState` / `clearState`, Zod-validated, explicit error strings, `QuotaExceededError` handling.
- **`store.ts`** — single state behind `getState` / `subscribe`; actions: `init`, `addRequest`, `processNext`, `processAll`, `replaceArchive`, `loadSeed`, `resetAll`, `verify`, `exportArchive`. Every commit persists then notifies; failures surface as typed errors, not silent losses.
- **`seed.ts`** — fictional demo dataset behind an explicit "Load demo data" action only.

Preserved rules: positive strictly-increasing IDs, max content length `20_000`, empty content allowed in archives but blocked in the composer, archive integrity re-verified before load.

## 7. Design system

**Themes.** `data-theme="light|dark"` on `<html>`; default from `prefers-color-scheme`; persisted in `localStorage` (`medkeep.theme`); set by `public/theme-init.js` before CSS to prevent flash; `color-scheme` set per theme.

**Tokens (OKLCH), semantic only** — components never use raw hex:

| Token | Light | Dark |
|---|---|---|
| `--bg` | `oklch(0.985 0.004 200)` | `oklch(0.18 0.015 240)` |
| `--surface` | `oklch(1 0 0)` | `oklch(0.22 0.018 240)` |
| `--surface-2` | `oklch(0.97 0.006 200)` | `oklch(0.26 0.02 240)` |
| `--border` | `oklch(0.9 0.008 200)` | `oklch(0.32 0.02 240)` |
| `--text` | `oklch(0.25 0.02 230)` | `oklch(0.95 0.005 240)` |
| `--muted` | `oklch(0.52 0.015 230)` | `oklch(0.7 0.015 240)` |
| `--primary` | `oklch(0.55 0.12 200)` | `oklch(0.72 0.12 195)` |
| `--ok` | `oklch(0.6 0.13 150)` | `oklch(0.75 0.14 150)` |
| `--warn` | `oklch(0.75 0.14 80)` | `oklch(0.8 0.14 85)` |
| `--danger` | `oklch(0.58 0.19 25)` | `oklch(0.68 0.17 25)` |
| `--ring` | primary @ 45% | primary @ 60% |

Plus spacing (4 -> 64), radii (8/12/16/pill), elevation, and a named z-index scale (`base/content/sticky/dialog/toast`). Text meets AA; UI borders and focus meet 3:1.

**Typography.** Self-hosted variable fonts via Fontsource: Inter (UI) + JetBrains Mono (IDs/digests). Only the Latin subset is imported. `font-display: swap` comes from Fontsource; a metric-compatible fallback stack is declared. Fluid scale via `clamp()` (12-36px), ~68ch measure, tabular monospace digests.

**Layout.** Max width 1200px, 12-column grid; container queries on cards; `dvh` and safe-area aware; `scrollbar-gutter: stable`; no horizontal scroll at 320px or 400% zoom.

**Motion.** 120-200ms ease tokens; every transition/animation gated behind `@media (prefers-reduced-motion: no-preference)`; no state depends on motion.

## 8. Information architecture (single page)

```
Skip link
Top bar:  MedKeep · "Offline medical record ledger" | theme toggle | Import · Export · More
Hero:     Chain status pill + last verified time + integrity disclaimer
KPI row:  Records · Pending · Integrity · Archive size
Main grid:
  Left:   New request composer (textarea, char count, Add)
          Queue panel (count, Next/Process all, ordered list, empty state)
  Right:  Integrity panel (Verify now, result, FNV-1a caveat)
Records:  Search field + count · record cards (newest first) · empty/no-match states
Footer:   Privacy note · data is local · clear data · "Load demo data" when empty
Dialogs:  Import archive · Confirm reset/clear · Confirm load demo
Toasts:   polite status / assertive error, single announcer region
```

Search is mirrored to `?q=` so a copied link preserves the filtered view; theme stays in `localStorage`.

## 9. Components and states

- `AppShell`, `TopBar`, `ThemeToggle`, `StatusPill`, `KpiCard`.
- `Composer` — labeled `<textarea>`, live character counter, inline validation, submit disabled while invalid, `Ctrl/Cmd+Enter` adds.
- `QueuePanel` — ordered list, "Next" tag on head, `Process next` / `Process all`, disabled when empty, confirmation for "Process all" when the queue is long.
- `RecordsPanel` — search by ID/digest/content, newest first, digest copy button with toast confirmation, "(empty record)" rendering.
- `IntegrityPanel` — recompute on demand, timestamp, success/failure detail, permanent "integrity != authentication" note.
- `ImportDialog` — native `<dialog>`, file input, size cap, parse/validate, destructive-replace confirmation, inline errors.
- `ConfirmDialog` — generic destructive-action confirm with focus return.
- `EmptyState` — explains the queue/chain and offers "Load demo data".
- `ToastRegion` — one live region; `role="status"` for info/success, `role="alert"` for errors; dismissible; auto-dismiss pauses on hover/focus.

Every view defines four states: **initializing, empty, error, ready**. Storage-unavailable falls back to in-memory mode with a persistent warning banner.

## 10. Accessibility (WCAG 2.2 AA)

- Landmarks (`header/nav/main/footer`), one `h1`, ordered headings, skip link to `#main-content`.
- Native elements first; `<dialog>` for modals with focus trap/return; visible focus ring via `--ring`; no `outline: none` without replacement.
- Every control has an accessible name; icon-only buttons use `aria-label`; real `<label>`s (never placeholder-only); errors wired with `aria-describedby` + `aria-invalid`.
- Live regions for toasts and verification results; copy action announces success.
- Contrast AA for text, 3:1 for borders/focus/status; status never conveyed by color alone.
- Target size >= 24px (aim 44px), keyboard-complete flows, no single-character shortcuts, reduced-motion and forced-colors support.
- axe checks in component and e2e tests; manual keyboard pass in the DoD.

## 11. Security, privacy, CSP

- All user text rendered via `textContent` / `el()`; `innerHTML` is forbidden by lint.
- Validate every boundary with Zod; cap import file size and content length; reject malformed/tampered archives.
- CSP injected at build time via a Vite `transformIndexHtml` plugin (GitHub Pages cannot send headers): `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'`. The theme bootstrap is an external same-origin script, so no inline script is required.
- No analytics, no third-party requests, no secrets.
- Privacy notice: records are stored unencrypted in this browser's `localStorage`; FNV-1a detects accidental tampering but is not cryptographic; do not use with real patient data. Export and "Clear all data" are always available.

## 12. Performance budgets

- JS <= ~60 KB gzip (app + Zod), CSS <= ~20 KB gzip, fonts <= ~120 KB total with only the UI font preloaded.
- No render-blocking third-party resources; module scripts; reserved card geometry (no CLS); LCP < 2.5s on a mid-tier mobile profile; INP < 200ms.
- Re-render coalesced through `requestAnimationFrame`; verification memoized per state revision.
- Records render in full (expected small); virtualization documented as future work above ~500 rows.

## 13. Testing and quality gates

**Unit (Vitest, node):** FNV-1a vectors, chain append/verify/tamper, archive round-trip incl. UTF-8/tabs/newlines/empty, schema rejection, storage quota/parse failures, store actions and persistence ordering.

**UI (Vitest + jsdom + Testing Library):** composer validation and submit, queue processing, records filter, digest copy, theme persistence, import dialog error/success, toast live-region roles, confirm focus return.

**Type tests:** `expectTypeOf` for `Result` narrowing and Zod `z.infer` outputs.

**E2E (Playwright + axe):** add -> process next -> process all -> verify -> export -> import; demo load; theme persistence across reload; keyboard-only path; no axe violations in light and dark.

**Commands**

```
npm run dev        # vite
npm run build      # tsc --noEmit && vite build
npm run preview
npm run typecheck  # tsc --noEmit
npm run lint       # eslint . --max-warnings=0
npm run lint:fix
npm run format     # prettier --write
npm run format:check
npm run test       # vitest run --coverage
npm run test:watch
npm run test:e2e   # build && playwright test
npm run check      # typecheck + lint + format:check + test + build
```

All gates must pass before completion.

## 14. GitHub Pages deployment

- `vite.config.ts`: `base = process.env.VITE_BASE ?? '/'`.
- `.github/workflows/pages.yml`: trigger on pushes to `master`/`main` touching `web/**`; checkout, `actions/setup-node` (Node 24, npm cache on `web/package-lock.json`), `npm ci` in `web`, `VITE_BASE=/Medkeep/ npm run build`, `configure-pages`, `upload-pages-artifact` (`web/dist`), `deploy-pages`. `permissions: pages: write, id-token: write`, `concurrency: pages`.
- Verify the built site under `/Medkeep/` (asset URLs, fonts, favicon respect `base`). No SPA fallback needed.

## 15. Phased execution

0. Bootstrap — copy `web/assets/js` + `tests/frontend`, add configs, install and verify versions.
1. Domain port — typed ports of fnv1a/chain/archive/seed/types/schema/format; Vitest green.
2. Data layer — storage and store actions with tests.
3. Design foundation — tokens, reset/base/layout CSS, fonts, theme-init, index.html, CSP plugin.
4. UI build — dom helpers, copy, components, app orchestration, all states, toasts, dialogs.
5. Accessibility and polish — keyboard/focus, live regions, contrast, reduced motion, responsive/zoom, empty/error copy.
6. Import/export and privacy — file import validation, export download, reset/clear confirms, privacy notice.
7. E2E and axe — Playwright flows in both themes; fix findings.
8. Deploy — Pages workflow, build under `/Medkeep/`, verify artifact.
9. Docs — `plan.md`, `web/README.md`, root README GUI section.

## 16. Definition of done

- `npm run check`, Playwright, and axe pass; no `any`, no `@ts-ignore`, no unexplained lint suppressions.
- Light and dark themes, system default, no flash, persistence verified.
- Full offline flow works: add -> process -> verify -> export -> re-import.
- WCAG 2.2 AA spot checks pass: keyboard-only operation, visible focus, AA contrast, live announcements, 320px/400% reflow, reduced motion.
- Bundle/font budgets met; no third-party network requests; CSP present and non-breaking.
- Privacy and "integrity != authentication" notices visible.
- GitHub Pages build works under the project subpath.
- `plan.md` and `web/README.md` describe architecture, commands, and limits.

## 17. Risks and open items

- **Medical-data optics** — demo content must be clearly fictional; keep the local-storage privacy warning prominent.
- **GitHub Pages CSP limits** — headers unavailable; the build-time `<meta>` CSP must be validated in the Pages artifact.
- **Font licensing** — Inter and JetBrains Mono are OFL; Fontsource ships the licenses.
- **OKLCH support** — acceptable for modern browsers; document the floor.
- **URL-synced search** — keep only if it stays simple; drop otherwise.
- **TypeScript 6.0** — pinned below 6.1 because typescript-eslint does not yet accept 6.1+/7.x.

## 18. Implementation audit

The dashboard, persistence, archive flow, themes, Pages workflow and quality commands are implemented. Automated tests cover the main ledger journey, demo confirmation, invalid imports, keyboard entry, 320px reflow, theme persistence and axe checks in both themes. The light primary color was darkened from the original token to meet text contrast.

Remaining work before the full definition of done can be claimed:

- Complete manual keyboard, focus, 400% zoom, contrast and reduced-motion checks across all dialog and error states.
- Measure LCP and INP on a representative mobile profile and verify Pages assets and CSP in a deployed project-subpath site.
- Finish the planned typed-result API, immutable chain array, render coalescing, full copy centralization, and the remaining component and boundary tests.
- Review storage recovery and unavailable-storage behavior in all failure states, including failures after startup.
