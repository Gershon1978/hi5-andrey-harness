# dialogue-bed/ — the AR-guidance test bed (recovered)

Rescued from the retired beta deployment (`/root/aim-beta`, Sep 17–18 2026) on 2026-10-09,
before that twin was deleted. Full archive: `/root/aim/backup_beta_20261009_031229.tar.gz`.

| file | what it is |
|---|---|
| `test_scenarios.py` | the 33 scenarios (JSON form: `../presets/scenarios.json`) |
| `test_harness.py` | the driver — plays the user, feeds each observation, captures the mechanic's reply |
| `run_tests.py` | runs the suite |
| `test_results.txt` | the Sep-18 transcript: diagnoses **and** the failure paths |
| `quick_out.txt` | one quick case + the AFC deprecation warning |

## Why it is worth reviving

It is the only thing we own that tests the **guided dialogue**, not the API. Real excerpts:

```
### B1 скрип тормозов [велосипед]
VIDEO: Пользователь крутит колесо и нажимает тормоз. Слышен резкий скрип при торможении. Передний ободной тормоз.
[MECH] Приблизьте камеру вплотную к передней тормозной колодке в момент соприкосновения с ободом.  (expect=view badge='')
[USER] показывает: крупно показаны тормозные колодки — стёрты до металла
[MECH] ✅ ДИАГНОЗ: Критический
```

…and the abort path when the user will not cooperate:

```
[USER] показывает: камера закрыта пальцем
[MECH] Уберите палец от объектива камеры и направьте её на деку самоката при хорошем освещении.
[USER] показывает: отворачивает камеру в сторону
[MECH] ⚠️ АБОРТ (пользователь не следует инструкциям): … приезжайте в мастерскую. Запишитесь на диагностику.
```

That "abort after repeated non-compliance → book the workshop" behaviour is a core promise of the
product and nothing else in the repo exercises it.

## Before it will run again

1. **AFC / SDK.** `quick_out.txt` opens with Google's warning: automatic function calling must move
   from `Models.generate_content` to `Chat.send_message`.
2. **API surface.** It targets the pre-gate brain. It now needs the `X-Andrey-Token` header
   (or to run against the same-origin relay `/Andrey/relay/api/*`).
3. **Expectations are history.** `test_results.txt` is from Sep 18 — use it to understand intent,
   never as an assertion.
