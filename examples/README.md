# Example API responses (real, from the live server)

These are **actual** responses captured from `https://hi5.bike/Andrey` on 2026-10-07.
Use them to build the UI against the real shapes — the live `openapi.json` does **not**
describe response bodies (its `responses` schemas are generic `{}`).

| file | request |
|---|---|
| `capture.json`   | `GET /api/capture` |
| `blueprint.json` | `GET /api/blueprint?model=Scott%20Big%20Jon&use_web=false` |
| `verdict.json`   | `POST /api/verdict` `{"symptom":"chain slips under load","model":"Scott Big Jon","use_model":false}` |

Notes for the builder:
- `verdict.json` here shows the **`deeper` gate** (confidence 75 % < 80 %): `diy` and
  `workshop` are `null` and **no prices** are returned — render the `deeper` photo asks instead.
- At ≥ 80 % the same endpoint returns `gate:"verdict"` with a populated `diy`
  (`label`, `tier`, `price_text`, `price_rub`) and `workshop` (`detail`, `price_text`).
- `blueprint.json` shows `gate:"pass"` with most spec fields empty (fat-bike KB gaps) —
  render only the non-empty fields.
