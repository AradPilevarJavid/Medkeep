# MedKeep GUI

A static, client-side dashboard for the MedKeep v2 archive format. Requests are queued in FIFO order and committed to a hash chain. Data is stored unencrypted in this browser; do not use real patient data. FNV-1a detects accidental changes but does not authenticate data. Export an archive before clearing browser storage.

Use Node 24 or newer. Run `npm ci`, `npm run dev`, and open the displayed local URL. `npm run check` runs type checking, lint, formatting, unit tests and a production build. Run `npx playwright install chromium` once and `npm run test:e2e` for browser tests. `VITE_BASE=/Medkeep/ npm run build` builds for the GitHub Pages project path.

The domain layer implements archive parsing and chain verification; the data layer validates local storage and manages state; the UI renders with DOM APIs. The app makes no external requests and needs no server after its assets have loaded. Storage failures at startup use temporary in-memory state. Import replaces the current ledger and accepts files up to 5 MiB. Modern browsers with OKLCH and native dialog support are required. Large ledgers render all records; virtualization and localization are future work.
