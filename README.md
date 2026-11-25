# MedKeep

**An offline, tamper-evident medical-record ledger.** MedKeep pairs a C++17 command-line application with a static browser dashboard, both built on the same hash-chain archive format.

[Live dashboard](https://aradpilevarjavid.github.io/Medkeep/) · [Web app docs](web/README.md) · [Report an issue](https://github.com/AradPilevarJavid/Medkeep/issues)

> **Educational project, not a clinical system.** Records are not encrypted, and FNV-1a detects accidental changes but does not authenticate data. Do not store real patient information.

---

## Overview

MedKeep records medical notes in two stages:

1. A new note becomes a **pending request** in a FIFO queue.
2. Processing the queue **commits** the request to a singly linked hash chain.

Each committed record stores a 64-bit FNV-1a digest computed from the previous digest, the record ID, the content length, and the content itself. Changing any record invalidates its digest and every digest after it. Verification walks the chain from the newest node to the oldest, recomputes each digest, and returns records only if the whole chain is valid.

The data structures are implemented by hand, without `std::list`, `std::queue`, or a hashing library. The browser dashboard is a typed TypeScript port of the same domain rules, so archives move freely between the CLI and the web app.

| | |
|---|---|
| **Core** | C++17, CMake, no third-party libraries |
| **CLI storage** | `medkeep.db` in the working directory (`MEDKEEP` v2, tab-separated, hex-encoded) |
| **Web stack** | Vanilla TypeScript, Vite, Zod; no framework and no backend |
| **Web storage** | `localStorage` plus import/export of `.db` archives |
| **Tests** | CTest, Vitest + Testing Library, Playwright + axe |
| **Deployment** | GitHub Pages (`.github/workflows/pages.yml`) |

## Features

### Command-line application

- Manual singly linked hash chain: every record is a pair of nodes (`Hash -> Record -> previous Hash`), connected with `std::unique_ptr`.
- Manual FIFO queue with head and tail pointers, giving O(1) enqueue and dequeue.
- Domain-separated FNV-1a 64-bit hashing implemented from scratch.
- Full-chain verification before any record is displayed; output is chronological.
- Crash-safe persistence: the archive is written to a temporary file and renamed into place.
- UTF-8, tabs, newlines, and empty content survive round-trips because content is hex-encoded.
- Pending requests are persisted alongside committed records.

### Web dashboard

- Add requests, process one or all, and watch chain status update on every state change.
- Explicit **Verify now** check with timestamp and per-failure detail.
- Summary cards for records, pending requests, integrity, and archive size.
- Search committed records by ID, digest, or text; the query is mirrored to `?q=`.
- Export and import v2 archives (up to 5 MiB), load fictional demo data, or clear all local data.
- Light and dark themes with system default, persisted choice, and no flash on load.
- Keyboard-complete, WCAG 2.2 AA-oriented UI with live regions, focus management, and reduced-motion support.
- Strict Content Security Policy injected at build time; no analytics, no third-party requests.
- Zod validation at every boundary and an in-memory fallback when browser storage is unavailable.

## Quick start

### Live demo

Open <https://aradpilevarjavid.github.io/Medkeep/>. Everything runs locally in the browser; after the page loads it makes no network requests and stores all data on your device.

### Web dashboard

Requires **Node.js 24 or newer**.

```bash
cd web
npm ci
npm run dev
```

Open the URL printed by Vite. Production build and quality gates:

```bash
cd web
npm run build        # type-check and bundle to web/dist
npm run preview      # serve the production build locally
npm run check        # typecheck + lint + format + unit tests + build
npm run test:e2e     # build, then Playwright + axe
```

Install the Playwright browser once before running end-to-end tests:

```bash
npx playwright install chromium
```

To build for the GitHub Pages project path:

```bash
VITE_BASE=/Medkeep/ npm run build
```

In PowerShell, set the environment variable for the current session first:

```powershell
$env:VITE_BASE = '/Medkeep/'
npm run build
```

### CLI

Requires a C++17 compiler and **CMake 3.16+** (GCC, Clang, or MinGW).

On Arch Linux:

```bash
sudo pacman -S --needed base-devel cmake
```

Build, test, and run from the repository root:

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build
ctest --test-dir build --output-on-failure
./build/medkeep_cli
```

On Windows with a single-config generator, the executable is `build\medkeep_cli.exe`. The CLI clears the screen with the Unix `clear` command, so on Windows the menu scrolls instead and the shell may report that `clear` is not recognized.

## Using the CLI

```text
========== MedKeep ==========

1. Add a new medical record
2. Process the oldest request
3. Verify and extract records
0. Save and exit
```

- **1 — Add a new medical record:** enter one or more lines, then a line containing only `.end`. The request is appended to the queue and assigned the next ID.
- **2 — Process the oldest request:** commits exactly one request from the front of the queue to the hash chain.
- **3 — Verify and extract records:** recomputes the entire chain. On success, prints every record in chronological order with its digest; on failure, reports the first broken link.
- **0 — Save and exit:** writes the archive and closes the program.

The application loads `medkeep.db` from the current directory at startup when it exists. It saves automatically after adding or processing requests and when input ends or the program exits; verification alone does not write to disk.

Example session:

```text
1
Patient: A. Rivera
Visit: Annual physical
.end
Request #1 added to the queue.

2
The oldest request was committed to the hash chain.
```

## Using the web dashboard

The dashboard follows the same workflow as the CLI:

1. Type a note in **New request** and select **Add to queue** (or press `Ctrl`/`Cmd` + `Enter`).
2. Use **Process next** or **Process all** to commit queued requests in FIFO order.
3. Check **Integrity** to recompute the chain, or rely on the live status pill and summary cards.
4. **Export archive** to download a `MEDKEEP` v2 file, or **Import archive** to replace the current ledger.

State is stored under the `medkeep.dashboard.v1` key in `localStorage`, unencrypted and scoped to the browser profile. Imported archives are fully re-verified before they are accepted; a malformed or tampered file is rejected rather than repaired. If storage is unavailable, the app keeps working in memory and warns that changes will not survive a reload.

The dashboard needs a modern browser with OKLCH color and native `<dialog>` support. It makes no network requests at runtime and needs no server after its assets have loaded.

## How it works

### Queue and chain

```text
enqueue → [ Request #3 ] → [ Request #4 ] → [ Request #5 ] → dequeue oldest
                                  │
                                  ▼  process_next()
Hash(#5) → Record(#5) → Hash(#4) → Record(#4) → Hash(#3) → Record(#3) → null
```

The chain head is always the newest **hash** node. Traversing backwards from the head, record nodes occupy the even positions (2nd, 4th, 6th, ...). A record is added to the chain only together with its matching hash node, so a committed record is never left unhashed.

### Digest construction

The implementation hashes this byte sequence:

```text
"MedKeep/FNV1a64/v1\0" || previous_digest_ascii || id_be_u64 || content_length_be_u64 || content_bytes
```

- The domain tag includes its terminating NUL, matching a C string literal iterated as a byte array.
- `id` and `content_length` are unsigned 64-bit big-endian values.
- The first record uses an empty previous digest.
- The result is stored as 16 lowercase hexadecimal characters.

FNV-1a starts from the 64-bit offset basis, XORs each byte into the hash, and multiplies by the FNV prime with unsigned 64-bit wraparound. The web port uses `BigInt` masking so both implementations produce identical digests.

### Verification

The C++ verifier checks all of the following before returning any records:

- the structure alternates `Hash -> Record -> Hash`;
- each record node and hash node share the same ID;
- IDs are strictly increasing in insertion order;
- every stored digest equals the recomputed digest;
- the stored record count matches the traversed node count.

Any failure returns an empty result and an error naming the first broken record. The web verifier performs the equivalent forward pass over the ordered record list.

### Note on the "mutable content node" requirement

The brief mentions that some content nodes may stay mutable until another request is registered, while the verification section describes content nodes as the even-positioned nodes seen during reverse traversal. MedKeep resolves this by keeping unprocessed requests in the separate FIFO queue and inserting a record into the chain only when its hash node can be created at the same time. As a result, every record returned by extraction has passed verification.

## Archive format

MedKeep archives are line-based text files with a tab-separated, hex-encoded payload. Example:

```text
MEDKEEP	2
C	1	30d909a7a87b317c	66697273742070617469656e74
Q	2	70656e64696e67206f6e65
```

| Line | Meaning |
|---|---|
| `MEDKEEP\t2` | Required header; version 2 is the current format |
| `C\t<id>\t<digest>\t<hex content>` | Committed record |
| `Q\t<id>\t<hex content>` | Pending request |

Rules enforced when loading:

- IDs must be positive, unique, and strictly increasing across records and pending requests.
- All committed records must appear before any pending request.
- Digests must be exactly 16 hexadecimal characters and are preserved as stored.
- Content is hex-decoded as UTF-8; odd-length or non-hex payloads are rejected.
- CRLF line endings are tolerated, and blank lines are ignored.
- A tampered chain is **not** silently repaired; loading succeeds but verification fails.

The CLI writes through `medkeep.db.tmp` and renames it into place, so an interrupted save cannot leave a half-written archive. Because both front ends implement the same format and hashing rules, an archive exported from the dashboard can be opened by the CLI and vice versa.

## Repository layout

```text
.
├── CMakeLists.txt              C++ build, library, CLI, and CTest target
├── src/
│   ├── main.cpp                entry point
│   ├── application.{hpp,cpp}   interactive menu and I/O
│   ├── medkeep.{hpp,cpp}       coordination, IDs, and archive persistence
│   ├── log_chain.{hpp,cpp}     manual hash chain and FNV-1a
│   └── request_queue.{hpp,cpp} manual FIFO queue
├── tests/
│   └── test_medkeep.cpp        C++ test suite
├── web/                        Vite + TypeScript dashboard
│   ├── src/domain/             hashing, chain, archive, schemas, demo data
│   ├── src/data/               localStorage adapter and application store
│   ├── src/ui/                 components, copy, theme, toasts, dialogs
│   ├── src/lib/                formatting, downloads, focus helpers
│   ├── src/styles/             design tokens and layout
│   └── tests/                  unit, UI, type, and Playwright tests
├── .github/workflows/pages.yml GitHub Pages deployment
├── plan.md                     web dashboard implementation plan
├── PRESENTATION_FA.md          older Persian presentation notes
└── web/README.md               web-specific setup and limitations
```

> `PRESENTATION_FA.md` predates the current implementation: it describes an earlier SHA-256 draft, removed menu options, and a `process_all` method. Treat the code and this README as authoritative.

## Testing

| Suite | Command | What it covers |
|---|---|---|
| C++ | `ctest --test-dir build --output-on-failure` | Empty chain, FIFO ordering, hash links, persistence, tamper detection, UTF-8/multiline/empty content, version rejection |
| Unit (Vitest) | `cd web && npm test` | FNV-1a vectors, chain append/verify, archive round-trips, schema rejection, storage failures, store actions |
| UI (Vitest + jsdom) | included above | Composer validation, records filtering, theme persistence, toast roles |
| Type tests | included above | `Result` narrowing and schema-inferred types |
| End-to-end (Playwright + axe) | `cd web && npm run test:e2e` | Add → process → verify → export → import, demo data, theme persistence, keyboard flow, accessibility checks |

`npm run check` is the full local gate: `tsc --noEmit`, ESLint with zero warnings, Prettier check, unit tests with coverage thresholds, and a production build.

## Complexity

Let `n` be committed records and `q` pending requests.

| Operation | Complexity |
|---|---|
| Add request to queue | O(1) |
| Remove oldest request | O(1) |
| Commit one record | O(1) insertion, plus O(content length) hashing |
| Verify and extract all records | O(total content bytes + n) |
| Save or load archive | O(total archive size) |

Each record adds two linked-list nodes. Node cleanup is iterative, so destroying a long chain does not depend on recursive `unique_ptr` destruction.

## Security and privacy

MedKeep is an integrity demonstrator, not a security product.

- **FNV-1a is not cryptographic.** Its 64-bit output has weak collision resistance and no resistance to deliberate collision search.
- **A hash chain is not authentication.** Anyone who can rewrite the whole archive can recompute every digest.
- **No encryption at rest.** CLI archives and browser `localStorage` are plain text on disk.
- **No access control, audit log, signatures, or secure transport.** The web app is static and single-user.
- **Demo data is fictional.** Never enter real patient data.

A production medical-record system would also need authenticated checkpoints or digital signatures, encryption, access control, audit logging, backups, and regulatory compliance.

## Documentation

- [`plan.md`](plan.md) — architecture, design system, testing strategy, and delivery plan for the web dashboard.
- [`web/README.md`](web/README.md) — web app setup, commands, browser requirements, and privacy limits.
- [`PRESENTATION_FA.md`](PRESENTATION_FA.md) — Persian presentation notes (partially outdated; see the note above).

Bundled Inter and JetBrains Mono fonts are licensed under the SIL Open Font License; their license files are in `web/public/fonts/`.
