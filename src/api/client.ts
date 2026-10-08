import { AndreyVerdictResponse, TestRunRecord } from '../types/harness';

export const HarnessAPI = {
  async getHealth() {
    const res = await fetch('/api/proxy/health');
    return { ok: res.ok, status: res.status, data: await res.json() };
  },

  async getLedger() {
    const res = await fetch('/api/proxy/ledger');
    return { ok: res.ok, status: res.status, data: await res.json() };
  },

  async postPassport(file: File, model: string) {
    const form = new FormData();
    form.append('files', file);
    if (model) form.append('model', model);
    form.append('use_web', 'true');

    const res = await fetch('/api/proxy/passport', { method: 'POST', body: form });
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch {}
    return { ok: res.ok, status: res.status, data: parsed, rawText: text };
  },

  async postFlow(file: File, symptom: string, model: string, roundNo = 0) {
    const form = new FormData();
    form.append('files', file);
    if (symptom) form.append('symptom', symptom);
    if (model) form.append('model', model);
    form.append('round_no', String(roundNo));
    form.append('use_web', 'true');

    const res = await fetch('/api/proxy/flow', { method: 'POST', body: form });
    const text = await res.text();
    let parsed: AndreyVerdictResponse | null = null;
    try { parsed = JSON.parse(text); } catch {}
    return { ok: res.ok, status: res.status, data: parsed, rawText: text };
  },

  async postDeeper(files: File[], roundNo: number) {
    const form = new FormData();
    for (const f of files) form.append('files', f);
    form.append('round_no', String(roundNo));

    const res = await fetch('/api/proxy/deeper', { method: 'POST', body: form });
    const text = await res.text();
    let parsed: AndreyVerdictResponse | null = null;
    try { parsed = JSON.parse(text); } catch {}
    return { ok: res.ok, status: res.status, data: parsed, rawText: text };
  },

  async saveRun(record: Partial<TestRunRecord>) {
    const res = await fetch('/api/harness/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    return res.json();
  },

  async getRuns(filter?: 'unreviewed') {
    const url = filter ? `/api/harness/runs?filter=${filter}` : '/api/harness/runs';
    const res = await fetch(url);
    return res.json() as Promise<TestRunRecord[]>;
  },

  async reviewRun(id: string, label: string, job?: string, note?: string) {
    const res = await fetch(`/api/harness/runs/${id}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, job, note }),
    });
    return res.json();
  },

  async getCalibration() {
    const res = await fetch('/api/harness/analytics/calibration');
    return res.json() as Promise<{ range: string; min: number; max: number; total: number; correct: number }[]>;
  }
};
