# -*- coding: utf-8 -*-
"""Run the 30 scenarios through the text-based mechanic, log transcripts."""
import json
import sys

from test_harness import TextMechanic
from test_scenarios import SCENARIOS
from mechanic.guide_schema import badge_for

# two generic AR-guided turns appended to every scenario (to reach 5 turns)
EXTRA_TURNS = [
    {"a": "yes", "s": "показывает узел крупным планом, вращает/покачивает, детали видны"},
    {"a": "yes", "s": "показывает ещё ближе, всё чётко видно"},
]


def run_scenario(sc):
    m = TextMechanic(sc["vehicle"])
    log = []
    log.append("=" * 60)
    log.append("### %s [%s]" % (sc["name"], sc["vehicle"]))
    log.append("VIDEO: " + sc["video"])
    try:
        step = m.start(sc["video"])
    except Exception as e:
        log.append("[MECH] ERROR on start: %s" % e)
        return "\n".join(log)
    log.append("[MECH] %s  (expect=%s badge=%r)" % (step.instruction, step.expect, badge_for(step)))
    final = None
    for i, t in enumerate(sc["turns"] + EXTRA_TURNS):
        if i >= 7:
            break
        if m.expect == "ask":
            ans = t.get("a", "no")
            out = m.answer(ans)
            log.append("[USER] отвечает: " + ans)
        else:
            scene = t.get("s", "показывает проблемное место")
            out = m.view(scene)
            log.append("[USER] показывает: " + scene)
        if out.done:
            if getattr(out, "abort", False):
                log.append("[MECH] ⚠️ АБОРТ (пользователь не следует инструкциям): " + (out.diagnosis_ru or ""))
                final = out
                break
            pr, codes = m.price_range(out.service_name_ru or "", out.diagnosis_ru or "")
            log.append("[MECH] ✅ ДИАГНОЗ: " + (out.diagnosis_ru or out.step.instruction))
            log.append("[MECH] УСЛУГА: " + (out.service_name_ru or "-"))
            log.append("[MECH] ЗАПЧАСТИ: " + (out.parts_ru or "-"))
            log.append("[MECH] ЦЕНА: %s (jobs: %s)" % (json.dumps(pr, ensure_ascii=False), ",".join(codes)))
            final = out
            break
        log.append("[MECH] %s  (expect=%s badge=%r seen=%s)" %
                   (out.step.instruction, out.step.expect, badge_for(out.step), out.seen))
    if not final:
        log.append("[MECH] (не завершил диагностику за %d ходов)" % len(sc["turns"]))
    return "\n".join(log)


def main():
    out = []
    for i, sc in enumerate(SCENARIOS):
        res = run_scenario(sc)
        out.append(res)
        print("[progress] %d/30 done: %s" % (i + 1, sc["name"]), flush=True)
    text = "\n\n".join(out)
    with open("test_results.txt", "w", encoding="utf-8") as f:
        f.write(text)
    print(text)


if __name__ == "__main__":
    main()
