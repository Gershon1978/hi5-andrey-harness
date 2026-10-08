# Build directives (for the AI Studio Build agent)

Owner-approved. **Read `README.md`, then `SPEC.md` (the contract for this harness) — then act.**
This file is the task list; keep it in sync when you act.

## ROUND 1 — current tasks

**Goal: make the harness actually run, then close the two holes the spec promises but the
generated code does not have yet.** This is a *working-app* round, not a redesign round.

1. **P0 — unblock `npm install`.** It currently fails:
   `npm error gyp ERR! find VS` … `Could not find any Visual Studio installation` … `not ok`.
   `better-sqlite3@11.x` has **no prebuilt binary for Node 26** and this box has no MSVC
   toolchain. **Do NOT try to install Visual Studio or any build tools.** Replace the driver,
   in this priority order:
   - `node:sqlite` — built into **Node ≥ 22.5**, zero dependencies, same synchronous API shape. **Preferred.**
   - `sql.js` (wazm) — if the runtime Node is older than 22.5.
   - A JSON/JSONL store — last resort.
   `server/storage/db.ts` must stay the **only** module that touches the driver, and the schema
   in `SPEC.md` (the `runs` / `batches` column list) must not change — the whole point of this
   tool is that the columns are stable. Acceptance: `npm install` exits **0** with no `gyp`
   output, and `npm run dev` brings up both processes.
2. **Make `tsc` pass.** `tsconfig.json` sets `noUnusedLocals` and `noUnusedParameters` to `true`
   and the generated code violates both (e.g. `BatchManager.tsx` imports `AlertCircle`,
   `FileSpreadsheet`; `App.tsx` imports `Activity`, `ClipboardList`, `BarChart2`, `Layers`,
   `ShieldAlert`). **Do not relax the tsconfig** — fix the code (use the icons or drop the imports).
   Acceptance: `npm run build` (`tsc && vite build`) exits 0.
3. **Wire BATCH.** `BatchManager.handleStart()` only flips local state — it never calls the API,
   and `server/index.ts` has no batch route. Add `POST /api/harness/batch/start`: walk the JSON
   manifest **sequentially**, read `/api/ledger` **before each item**, stop the batch when the ₽
   hard cap is reached, write one `batches` row + one `runs` row per case, and stream progress so
   the UI can show `n/total`. The cap must be enforced **server-side**.
4. **Add the comparator.** The spec promises a screen that puts two `run_id`s side by side:
   causes, confidence, gate, prices, deeper rounds, latency, ₽. It is missing — build it.
5. **`GET /api/harness/analytics/calibration`** is referenced by `AnalyticsView` but does not
   exist. It must return the **5 confidence bins** (`0–20 / 20–40 / 40–60 / 60–80 / 80–100`) with
   `n` per bin **and** the success rate per bin, so the reliability curve is drawn with its
   denominators visible. Accuracy must never be shown without its `n`.
6. **Secrets stay server-side.** `ANDREY_BASE` and `ANDREY_TOKEN` come from AI Studio
   **Settings → Secrets** (see `README.md`). The proxy adds the `X-Andrey-Token` header; the
   browser must never see the token, and nothing secret may be committed — **this repo is public**.
7. **Upgrade `multer` to 2.x** (1.4.5-lts is flagged with known vulnerabilities).
8. **Do not change**: `SPEC.md`, `TEST_QUESTIONS.md`, `examples/*`, the media limits (18 s /
   40 MB / FormData field `files`), or the `runs` column list. **Do not create a new repo.**

**Verify before you reply:** `npm install` → `npm run build` → `npm run dev`, then
`GET http://localhost:3001/api/proxy/health` must return the live brain's `{"ok":true, ...}`,
and one real two-video run must land in the DB and appear in REVIEW. Then overwrite
`AGENT_REPLY.md` with the commit SHA, the driver you chose and why, the files changed, and those
command results pasted verbatim.

## Known-good context (do not re-litigate)

- The brain gates **every** `/api/*` route behind `X-Andrey-Token` and answers **401** without it.
  Real token ↔ `ANDREY_API_TOKEN` in `/root/aim/app/.env` on the brain server.
- Limits: **18 s** max video, **40 MB** max upload, 130 s upstream timeout, FormData field name
  **`files`**. The brain enforces these; the client check is a courtesy, not a guard.
- The 12 adversarial presets in `SPEC.md` §6 each carry an **expected** outcome — the harness
  records the observed one, it must never assert a verdict of its own.
- This tool is a **measuring instrument**: it stores what the brain returned (raw JSON included)
  and what a human said the truth was. It must never "fix" a number, smooth a result, or hide a
  failure. `gate:"deeper"` responses are **successes** to record, not errors to retry.
