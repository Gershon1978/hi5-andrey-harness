# -*- coding: utf-8 -*-
"""Test harness: a text-based twin of the AI mechanic.

Same protocol (guide_schema vocab + GuideStep + badge_for + jobs pricing) but NO
vision - the "camera" is replaced by TEXT descriptions. Tests the repair flow,
not video recognition.
"""
import io
import json
import sys
import uuid

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from pydantic import BaseModel, Field
from typing import List

from mechanic import config, jobs as jobs_mod
from mechanic.clients import gemini_client
from mechanic.guide_schema import (GuideStep, badge_for, PHONE_ACTIONS,
                                   BIKE_ACTIONS, OBJECTS, TOOLS, DIRECTIONS,
                                   FORCES, CHEMISTRY, OBSERVE)
from mechanic.schema import extract_json

VOCAB = (
    "- focus ONLY from: " + ", ".join(OBJECTS) + "\n"
    "- how ONLY from: " + ", ".join(PHONE_ACTIONS) + "\n"
    "- action ONLY from: " + ", ".join(BIKE_ACTIONS) + "\n"
    "- tool ONLY from: " + ", ".join(TOOLS.keys()) + "\n"
    "- direction ONLY from: " + ", ".join(DIRECTIONS.keys()) + "\n"
    "- force ONLY from: " + ", ".join(FORCES) + "\n"
    "- chemistry ONLY from: " + ", ".join(CHEMISTRY) + "\n"
    "- observe ONLY from: " + ", ".join(OBSERVE) + "\n"
)

# fork/shock service: prep + attention + longer -> 1.5x premium
SPECIALTY_MULT = {"s21_fork": 1.5}

# null-price fallback: benchmark a comparable job by time/complexity.
# service_name_ru keyword fragment -> job code.
FALLBACK_JOBS = {
    "электр": "x02_electronics", "мотор": "x02_electronics",
    "дисплей": "x02_electronics", "контроллер": "x02_electronics",
    "курок": "x02_electronics", "дроссель": "x02_electronics",
    "аккум": "x02_electronics", "батаре": "x02_electronics",
    "седло": "s05_fit", "подседель": "s05_fit", "штырь": "s05_fit",
    "колод": "s10_pads",
    "складыв": "s04_head_tighten", "стойка": "s04_head_tighten",
    "руль": "s04_head_tighten", "рулевой": "s04_head_tighten",
    "амортизатор": "s21_fork", "аморт": "s21_fork", "подвес": "s21_fork",
}
# default for anything unmatched (simple adjustment, ~10 min)
DEFAULT_JOB = "s07_tune"

# abort: user not following instructions (drunk / abusing / uncooperative)
MAX_FAILS = 3
ABORT_MSG = ("Похоже, сейчас не получается получить качественные данные. "
             "Не тратьте время — приезжайте в мастерскую, механик всё "
             "проверит на месте. Запишитесь на диагностику.")


class _StartOut(BaseModel):
    hypotheses: List[str] = Field(default_factory=list)
    step: GuideStep = Field(default_factory=GuideStep)


class _StepOut(BaseModel):
    done: bool = False
    seen: bool = False
    phone_action: str = ""
    abort: bool = False
    step: GuideStep = Field(default_factory=GuideStep)
    diagnosis_ru: str = ""
    service_name_ru: str = ""
    parts_ru: str = ""


def _structured(res, schema_cls):
    parsed = getattr(res, "parsed", None)
    if parsed is not None:
        return parsed
    try:
        return schema_cls.model_validate_json(extract_json(res.text or ""))
    except Exception:
        return schema_cls()


def _call(schema_cls, prompt, stage):
    from google.genai import types as gt
    scope = uuid.uuid4().hex[:10]
    res = gemini_client().generate(
        config.MODEL_DIALOGUE,
        [gt.Content(role="user", parts=[gt.Part.from_text(text=prompt)])],
        max_output_tokens=1600, thinking_budget=0,
        response_schema=schema_cls, stage=stage, scope=scope)
    return _structured(res, schema_cls)


class TextMechanic:
    def __init__(self, vehicle):
        self.vehicle = vehicle
        self.hypotheses = []
        self.history = []
        self.focus = ""
        self.question = ""
        self.expect = "view"
        self.last = None
        self.fail_count = 0

    def _start_prompt(self, video_desc):
        return (
            "You are a senior bicycle/e-bike/scooter mechanic guiding a customer "
            "over text (no real camera). Vehicle: " + self.vehicle + ".\n"
            "You are given a TEXT DESCRIPTION of the customer's short video "
            "(including any sound).\n\n"
            "VIDEO DESCRIPTION:\n" + video_desc + "\n\n"
            "Form 2-3 hypotheses (Russian) and design the FIRST step: either an "
            "ASK (a yes/no question the customer answers, when the answer is a "
            "sensation they feel/hear) or a VIEW (ask them to show something, "
            "when you need to see it).\n\n" + VOCAB + "\n"
            "Return STRICT JSON:\n"
            '{"hypotheses":["..."],"step":{"phase":"diagnose","expect":"view",'
            '"focus":"...","how":"...","reason":"...","instruction":"...",'
            '"question":"...","action":"","object":"","tool":"","direction":"",'
            '"force":"","chemistry":"","observe":"","bbox":{"x":0.5,"y":0.4,"w":0.2,"h":0.2}}}\n'
            "- instruction: Russian, teach HOW + WHAT.\n"
            "- question: the EXACT thing you are checking.\n"
        )

    def _step_prompt(self, done_allowed=True):
        h = "; ".join(self.history[-4:]) or "(nothing yet)"
        p = (
            "You are a senior bicycle/e-bike/scooter mechanic in an interactive "
            "diagnosis over text. Vehicle: " + self.vehicle + ".\n"
            "Hypotheses: " + ("; ".join(self.hypotheses) or "(none)") + "\n"
            "Already established: " + h + "\n"
            "Current focus: " + (self.focus or "-") + "\n"
            "Current question: " + (self.question or "-") + "\n\n" + VOCAB + "\n"
        )
        if done_allowed:
            p += ("When you have a clear leading cause, set done=true and fill "
                  "diagnosis_ru (the cause), service_name_ru (a short customer-"
                  "friendly job name, 3-5 words), and parts_ru (which parts to "
                  "replace/buy). Conclude as soon as the evidence points to ONE "
                  "cause: a DEFINITIVE visible fault (corrosion, crack, puncture, "
                  "breakage, a loose or bent component) is enough on its own; "
                  "otherwise 2-3 independent confirmations of the SAME cause are "
                  "enough. Do not keep probing alternative hypotheses once a "
                  "leading cause is established.\n")
        p += ("Otherwise design the NEXT step (ask or view).\n\n"
              "Return STRICT JSON:\n"
              '{"done":false,"seen":false,"phone_action":"",'
              '"step":{"phase":"diagnose","expect":"view","focus":"...","how":"...",'
              '"reason":"...","instruction":"...","question":"...","action":"",'
              '"object":"","tool":"","direction":"","force":"","chemistry":"",'
              '"observe":"","bbox":{"x":0.5,"y":0.4,"w":0.2,"h":0.2}},'
              '"diagnosis_ru":"","service_name_ru":"","parts_ru":""}\n')
        return p

    def start(self, video_desc):
        out = _call(_StartOut, self._start_prompt(video_desc), "test_start")
        self.hypotheses = [h for h in (out.hypotheses or []) if h][:3]
        self.last = out.step
        self.focus = out.step.focus
        self.expect = out.step.expect or "view"
        self.question = out.step.question or ""
        if out.step.instruction:
            self.history.append("спросил: " + out.step.instruction)
        return out.step

    def answer(self, ans):
        p = ("The customer answered a yes/no question.\n"
             "Question: " + (self.question or "-") + "\n"
             "Answer: " + ans + "\n\n" + self._step_prompt())
        out = _call(_StepOut, p, "test_answer")
        self._apply(out)
        if (ans or "").strip().lower() in ("не знаю", "dunno", "unknown", "idk"):
            self.fail_count += 1
        if self.fail_count >= MAX_FAILS and not out.done:
            return _StepOut(done=True, abort=True, diagnosis_ru=ABORT_MSG)
        return out

    def view(self, scene_desc):
        p = ("You asked the customer to show something. They describe what the "
             "camera shows now:\n\n"
             "SCENE:\n" + scene_desc + "\n\n"
             "Decide `seen`:\n"
             "- true if they showed the requested thing, OR showed/described "
             "anything else diagnostically relevant to your hypotheses (a "
             "different part of the bike, or a verbal observation that answers "
             "your question).\n"
             "- false ONLY if they showed something irrelevant (an unrelated "
             "object, a pet, a wall, their hand) or the camera is unusable "
             "(shaking, dark, pointed away, covered by a finger) or they gave "
             "no useful information.\n"
             "Then decide the next move.\n" + self._step_prompt())
        out = _call(_StepOut, p, "test_view")
        self._apply(out)
        if not out.seen:
            self.fail_count += 1
        if self.fail_count >= MAX_FAILS and not out.done:
            return _StepOut(done=True, abort=True, diagnosis_ru=ABORT_MSG)
        return out

    def _apply(self, out):
        if out.step and out.step.instruction:
            self.history.append("увидел/сказал: " + out.step.instruction)
        if out.step and out.step.focus:
            self.focus = out.step.focus
        if out.step and out.step.question:
            self.question = out.step.question
        if out.step and out.step.expect:
            self.expect = out.step.expect
        self.last = out.step

    def price_range(self, service_name_ru, diagnosis_ru=""):
        probe = " ".join([service_name_ru, diagnosis_ru])
        # curated keyword map first (more precise than generic match_jobs)
        code = self._fallback_code(probe)
        if code:
            j = jobs_mod.BY_CODE.get(code)
        else:
            picked = jobs_mod.match_jobs(probe, limit=1)
            j = picked[0] if picked else jobs_mod.BY_CODE.get(DEFAULT_JOB)
        if not j:
            return None, []
        mult = SPECIALTY_MULT.get(j.code, 1.0)
        return {"lo": int(j.price_base * mult), "hi": int(j.price_diff * mult)}, [j.code]

    def _fallback_code(self, probe):
        pl = probe.lower()
        for frag, code in FALLBACK_JOBS.items():
            if frag in pl:
                return code
        return None

