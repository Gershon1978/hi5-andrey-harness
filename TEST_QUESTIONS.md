# Andrey — TESTING: my questions + what I want you to BUILD

> **NOTE TO GEMINI:** all of my questions are attached to you **in this file**. This is the whole brief.
> Answer **Part 1**, then **build** what **Part 2** describes.

Attached together with this file: `SPEC.md`, `DESIGN_STANDARD.md`, `BUILD_DIRECTIVES.md`, `api.ts`,
`verdict.sample.json`, `capture.sample.json`, `blueprint.sample.json`, `health.sample.json`.

---

# PART 1 — Questions on testing Andrey

## What Andrey is (so you do not have to guess)
- **Backend, LIVE:** FastAPI at `https://hi5.bike/Andrey`. It takes a ~10 s **SILENT** video of the whole
  bike (passport / identification), then a ~10 s **WITH-SOUND** video of the fault (diagnosis).
  Limits from `/api/health`: `max_video_seconds: 18`, `max_upload_mb: 40`, `frame_count: 12`.
  Models: vision `gemini-3.8-flash`, frames `deepseek-flash`, dialogue `gemini-3.8-flash`.
- **Endpoints:** `GET /api/health`, `GET /api/capture`, `GET /api/blueprint?model=`,
  `POST /api/passport`, `POST /api/verdict`, `POST /api/flow`, `POST /api/deeper`, `POST /api/handoff`,
  `GET /api/ledger`, `/api/basket`, `/api/basket/add`, `/api/services`, `POST /api/book`.
  **Every `/api/*` route is gated behind an `X-Andrey-Token` header (401 without it).**
- **The gate:** confidence `>= 80` → `gate:"verdict"` (show the DIY price and the workshop price range).
  `confidence < 80` → `gate:"deeper"` → **NO PRICES AT ALL**, ask for 1–2 close-up photos, max 2 rounds,
  then force the best cause.
- **Prices come ONLY from the server** (CRM job groups: DIY guide Простая 50 ₽ / Обычная 100 ₽ /
  Экспертная 150 ₽; workshop = the job's own base…difficult range). Multi-fault = single highest tier.
  If the DIY repair fails, the whole AI-guide fee is credited as a discount on a workshop visit.
- **Telemetry already exists.** `/api/ledger` returns per-stage cost in rubles AND a funnel:
  `s0_entry_photo`, `s0_entry_text`, `s0_entry_video`, `s1_identified`, `identify_ok`, `s2_first_answer`,
  `diagnosis_delivered`, `s3_mode_chosen`, `s4_cta_tap`, `chat_intent_book`, `basket_attach`,
  `booking_attempt`, `booking_ok`, `booking_with_context`, `booking_failed`,
  `media_refused_screen_capture`, `media_processing_failed`.
- **Front-end:** a React/Vite/TS SPA (built in AI Studio, GitHub-backed) with the state machine
  `INTRO → CHOICE → PASSPORT → ANALYZING → VERDICT → DEEPER(≤2) → TICKET` plus a `PARTS` branch.
- **A real sample verdict:** symptom "chain slips under load" → ONE cause
  «Износ цепи (растяжение выше нормы)» at **75 %**, `gate:"deeper"`, jobs
  `[{s12_chain, Замена цепи, group Обычная, price_text "600 ₽ – 1 000 ₽"}]`,
  `deeper:["Фото цепи на большой передней звезде"]`. Note: that diagnosis came from a **keyword**,
  with **neither video** uploaded — which is exactly the kind of thing I want to be able to prove or disprove.

## The questions
1. **The highest-risk failure is a WRONG FITMENT / wrong part**, or a wrong diagnosis that costs an
   unnecessary workshop visit. How do we test for that with a small team and a limited budget?
2. **How do we build a ground-truth eval set** for bike + audio diagnosis? Who labels it, how many cases,
   and what is the sampling frame (bikes, fault families, recording conditions)? How do we avoid only
   testing the faults we can already name?
3. **How do we validate the 80 % gate itself** — is the reported "confidence" calibrated?
   What experiment actually proves that?
4. **How do we test the video/audio path** (the silent 10 s clip, the noisy fault clip) rather than only
   the text path?
5. **What can be automated in CI** versus what must be a human/expert panel? Include the SPA states and
   the API contract.
6. **Cheap adversarial / robustness tests** to run: screen-recordings instead of real bikes, silent clips,
   wrong-model uploads, >18 s clips, >40 MB files, slow network, duplicate submissions, non-bike videos,
   adversarial audio.
7. **Cost control** — how do we test hard without burning the Gemini bill? (The ledger already meters
   rubles per stage.)

Order the answers by **information per ruble**. For each test: the test, exactly what to measure, the
pass/fail bar, the sample size, the effort. Finish with (a) the **3 tests to run first with only one
week**, (b) what is **simply not testable** and must be accepted as risk, and (c) anything in this design
you consider **untestable or badly specified**.

---

# PART 2 — What I want you to BUILD: the **Andrey Test Harness**

Build a **separate** app — a test bench for Andrey. **Do not touch the production repo
(`hi5-andrey-ui`)**; this is a new, independent app whose only job is to test the brain.

## P0 — It must be as REAL as Andrey, or the results are worthless
- **The exact same two-video flow:** (1) a ~10 s **SILENT** clip of the whole bike →
  `POST /api/passport`; then the fork; then (2) a ~10 s clip **WITH SOUND** of the fault →
  `POST /api/flow`. Plus the `DEEPER` photo round (max 2) and the `TICKET` handoff.
- **The same state machine** as production: `INTRO → CHOICE → PASSPORT → ANALYZING → VERDICT → DEEPER(≤2)
  → TICKET` and the `PARTS` branch — so the test measures the product, not a simplified form.
- **The same multipart contract:** FormData field name **`files`** (not `files[]`), plus `symptom`,
  `model`, `round_no`, `use_web`.
- **The same hard limits:** `max_video_seconds 18`, `max_upload_mb 40`. The harness must **refuse or warn**
  on files outside them rather than silently send them.
- **Real files only.** Allow: file upload **and** an optional in-page camera capture, so the same harness
  can be driven from a phone in a real workshop. No mocked or synthetic responses.

## P1 — A smooth connection to Andrey
- One **server-side proxy** to `ANDREY_BASE` (`https://hi5.bike/Andrey`) that injects
  `X-Andrey-Token` server-side. **The token must never reach the browser.** Set both as Build secrets.
- **Timeout ≥ 120 s** on every call (video flows take 60 s+); show elapsed seconds while waiting. Never
  leave the UI stuck; always surface the raw error text.
- A **connection panel**: a `GET /api/health` button that prints the live limits/models, and a
  `GET /api/ledger` button for the current cost + funnel. This is the harness's "is the brain alive" check.
- Handle and record: 401 (token), 422 (validation), 413/400 (file too big), timeouts, network drops.

## P2 — Store EVERY run (this is the point of the harness)
Each run must be persisted, **durably**, and be re-openable later. Store at minimum:
- `run_id`, ISO timestamp, who ran it, and a free-text **label/note** for the session;
- **inputs:** both video files (keep the blob or a Drive reference + sha256 + size + duration), the
  `symptom` text, the `model` text, the file type/MIME, and any adversarial flag;
- **outputs, raw and untouched:** the full JSON of `/api/passport`, `/api/flow`, `/api/deeper`,
  `/api/handoff` — plus the derived `gate`, `confidence`, `round_no`, every `causes[]`
  (`label`, `confidence`, `job_code`), `diy` (`label`, `tier`, `price_text`, `price_rub`),
  `workshop.price_text`, `deeper[]`, `warnings[]`, `required_parts`, `fit_constraints`;
- **metrics:** per-call latency (ms), and the **cost in rubles** taken from `/api/ledger`;
- **errors:** HTTP status + raw body for every failed call.
Pick the store that actually works in **AI Studio Build** and say why (Google Sheets is native there;
a server-side SQLite or JSON store is fine **if it survives a restart** — state your choice and its
limitation). **Nothing may be lost on reload, and the store must be exportable.**

## P3 — Re-analyse the results (the second point of the harness)
A results screen that can answer, without re-running anything:
- **Gate calibration:** distribution of `confidence` for runs where we know the right answer — is 80 %
  really 80 %? Show a reliability curve (bucket by confidence: 50–59, 60–69, 70–79, 80–89, 90–100) with
  the observed correct-rate per bucket. This is the single most valuable chart in the app.
- **Cause analysis:** a table of `causes[].label` frequency, `job_code` frequency, and the mapping from
  cause → the workshop's eventual verdict. Flag **any cause that ever produced a part/price**.
- **Wrong-fit rate:** the headline number — of the runs where we have a ground truth, how many produced a
  wrong part or a wrong job? Slice it by bike, by fault family, and by recording condition.
- **Cost & latency:** total ₽, ₽ per run, ₽ per detected fault, p50/p95 latency, and the `/api/ledger`
  funnel counters side by side with our own counts (a mismatch means our harness is losing calls).
- **Deeper pressure:** how often the gate fell to `deeper`, how many rounds, and how often the 2-round cap
  was hit — i.e. how often Andrey simply could not decide.
- Filter and sort by every column; **export CSV + JSON**; a "compare two runs side by side" view
  (useful for A/B-ing the same video against two different `symptom` strings or model names).

## P4 — Batch / replay: build the eval set
- A **batch mode**: import a list of pre-recorded video **pairs** (passport + fault) with a fixed
  symptom/model, run them back-to-back unattended, and store every result as a normal run.
- Each pair carries its own metadata — bike, fault family, recording condition, and (optionally) the
  **expected answer** — so that a batch **is** the ground-truth eval set.
- The batch must be **resumable** (stop / continue where it left off) and **cost-capped**: a maximum ₽
  for the batch, read from `/api/ledger`, and it stops when the cap is hit.
- A batch summary: N runs, ₽ spent, gate distribution, wrong-fit rate against the expected answers, and
  the short list of runs that need a human eye.

## P5 — Human labelling (accuracy needs a human)
- After each run, a one-tap label — `ВЕРНО / НЕВЕРНО / СПОРНО / НЕ РАБОТАЕТ` — plus a free note and an
  optional expert cause code from our CRM job codes.
- A **"to review" queue** containing only unlabelled runs, so a mechanic can label 20 runs fast on a phone.
- Accuracy = labelled-correct ÷ labelled-total, and it must always be shown **with its denominator**
  (never a bare percentage).

## P6 — Never invent anything
- Always show the **raw server JSON**.
- Never hardcode a price, a cause or a job. If the server returns nothing, the harness shows nothing.
- It must be able to say plainly: "the API failed", "the file was rejected", "the gate fell to `deeper`".

## The adversarial matrix — one-click presets
One labelled preset button per case, which runs the flow and records which check it exercised:
1. screen-recording of a bike video (not a real bike at all) · 2. silent problem clip (no audio) ·
3. wrong `model` text (does not match the video) · 4. clip longer than 18 s · 5. file larger than 40 MB ·
6. non-bike video (a face, a car) · 7. the same file sent as both clips · 8. duplicate submission (the same
run sent twice) · 9. slow network / abort mid-upload · 10. empty `symptom` · 11. a photo where a video is
required · 12. a clip with loud music instead of a voice.

## Constraints
- Separate app. Do **not** modify `hi5-andrey-ui` and do **not** create a repo for the production UI.
- Secrets server-side only: `ANDREY_BASE`, `ANDREY_TOKEN`. The browser must never see the token.
- **Russian UI labels** (the testers are Russian mechanics); English is fine for code and the schema.
- Mobile-friendly: a mechanic must be able to run a case and label it one-handed on a phone.
- Do **not** add fake demo data to make the UI look full. An empty harness is a correct harness.

## What I want from you, in this order
1. **First the STRUCTURE — no code.** The file tree, the screens, the data model (the exact table and its
   columns), the routes (including the proxy), the build order, and the list of secrets. State explicitly
   what you store where, and **what will be lost on a restart**.
2. State your assumptions and the **two or three decisions I must approve** before you build.
3. **Then build it** in Google AI Studio — and tell me how to point it at the token and run the first case.


