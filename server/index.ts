import express from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'crypto';
import { CONFIG } from './config.js';
import { db } from './storage/db.js';

const app = express();
const upload = multer({
  limits: { fileSize: 45 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const forwardToAndrey = async (
  endpoint: string,
  method: string,
  body?: FormData | string,
  headers: Record<string, string> = {}
) => {
  if (!CONFIG.ANDREY_BASE || !CONFIG.ANDREY_TOKEN) {
    throw new Error('ANDREY_BASE или ANDREY_TOKEN не заданы на сервере.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${CONFIG.ANDREY_BASE}${endpoint}`, {
      method,
      headers: {
        'X-Andrey-Token': CONFIG.ANDREY_TOKEN,
        ...headers,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const text = await res.text();
    return { status: res.status, ok: res.ok, bodyText: text };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      status: err.name === 'AbortError' ? 504 : 502,
      ok: false,
      bodyText: JSON.stringify({ error: err.message || 'Ошибка сетевого прокси' }),
    };
  }
};

// 1. Проксирование GET служебных маршрутов
app.get('/api/proxy/health', async (_req, res) => {
  const result = await forwardToAndrey('/api/health', 'GET');
  res.status(result.status).send(result.bodyText);
});

app.get('/api/proxy/ledger', async (_req, res) => {
  const result = await forwardToAndrey('/api/ledger', 'GET');
  res.status(result.status).send(result.bodyText);
});

// 2. Проксирование POST медиа-маршрутов с контрактом FormData field: 'files'
app.post('/api/proxy/passport', upload.array('files'), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  const form = new FormData();

  for (const f of files) {
    const blob = new Blob([f.buffer], { type: f.mimetype });
    form.append('files', blob, f.originalname);
  }

  if (req.body.model) form.append('model', req.body.model);
  if (req.body.use_web) form.append('use_web', String(req.body.use_web));

  const result = await forwardToAndrey('/api/passport', 'POST', form);
  res.status(result.status).send(result.bodyText);
});

app.post('/api/proxy/flow', upload.array('files'), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  const form = new FormData();

  for (const f of files) {
    const blob = new Blob([f.buffer], { type: f.mimetype });
    form.append('files', blob, f.originalname);
  }

  if (req.body.symptom) form.append('symptom', req.body.symptom);
  if (req.body.model) form.append('model', req.body.model);
  if (req.body.round_no) form.append('round_no', String(req.body.round_no));
  if (req.body.use_web) form.append('use_web', String(req.body.use_web));

  const result = await forwardToAndrey('/api/flow', 'POST', form);
  res.status(result.status).send(result.bodyText);
});

app.post('/api/proxy/deeper', upload.array('files'), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  const form = new FormData();

  for (const f of files) {
    const blob = new Blob([f.buffer], { type: f.mimetype });
    form.append('files', blob, f.originalname);
  }

  if (req.body.round_no) form.append('round_no', String(req.body.round_no));

  const result = await forwardToAndrey('/api/deeper', 'POST', form);
  res.status(result.status).send(result.bodyText);
});

// 3. Сохранение и получение запусков в SQLite
app.get('/api/harness/runs', (req, res) => {
  const filter = req.query.filter as string;
  let query = 'SELECT * FROM runs ORDER BY created_at DESC';
  if (filter === 'unreviewed') {
    query = 'SELECT * FROM runs WHERE ground_truth_label IS NULL ORDER BY created_at DESC';
  }
  const rows = db.prepare(query).all();
  res.json(rows);
});

app.post('/api/harness/runs', (req, res) => {
  const r = req.body;
  const runId = r.run_id || crypto.randomUUID();
  const createdAt = r.created_at || new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO runs (
      run_id, created_at, tester_name, session_label, adversarial_tag,
      passport_file_hash, passport_duration, passport_bytes,
      fault_file_hash, fault_duration, fault_bytes,
      input_symptom, input_model,
      raw_passport_json, raw_flow_json, raw_deeper_json, raw_handoff_json,
      derived_gate, confidence, deeper_rounds_count, causes_summary,
      diy_price_rub, workshop_price_text, required_parts, fit_constraints,
      latency_passport_ms, latency_flow_ms, cost_rub_estimated,
      http_error_code, raw_error_body
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?
    )
  `);

  stmt.run(
    runId, createdAt, r.tester_name || 'Инженер', r.session_label || null, r.adversarial_tag || null,
    r.passport_file_hash || null, r.passport_duration || 0, r.passport_bytes || 0,
    r.fault_file_hash || null, r.fault_duration || 0, r.fault_bytes || 0,
    r.input_symptom || '', r.input_model || '',
    r.raw_passport_json || null, r.raw_flow_json || null, r.raw_deeper_json || null, r.raw_handoff_json || null,
    r.derived_gate || null, r.confidence || 0, r.deeper_rounds_count || 0, r.causes_summary || '[]',
    r.diy_price_rub || null, r.workshop_price_text || null, r.required_parts || '[]', r.fit_constraints || '[]',
    r.latency_passport_ms || 0, r.latency_flow_ms || 0, r.cost_rub_estimated || 0,
    r.http_error_code || null, r.raw_error_body || null
  );

  res.status(201).json({ ok: true, run_id: runId });
});

app.patch('/api/harness/runs/:id/review', (req, res) => {
  const { id } = req.params;
  const { label, job, note } = req.body;
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    UPDATE runs 
    SET ground_truth_label = ?, ground_truth_job = ?, expert_note = ?, reviewed_at = ?
    WHERE run_id = ?
  `);
  stmt.run(label, job || null, note || null, now, id);
  res.json({ ok: true });
});

// 4. Аналитика калибровки
app.get('/api/harness/analytics/calibration', (_req, res) => {
  const rows = db.prepare(`
    SELECT confidence, ground_truth_label 
    FROM runs 
    WHERE ground_truth_label IS NOT NULL AND confidence > 0
  `).all() as { confidence: number; ground_truth_label: string }[];

  const bins = [
    { range: '50-59', min: 50, max: 59, total: 0, correct: 0 },
    { range: '60-69', min: 60, max: 69, total: 0, correct: 0 },
    { range: '70-79', min: 70, max: 79, total: 0, correct: 0 },
    { range: '80-89', min: 80, max: 89, total: 0, correct: 0 },
    { range: '90-100', min: 90, max: 100, total: 0, correct: 0 },
  ];

  for (const row of rows) {
    const c = Math.round(row.confidence);
    const isCorrect = row.ground_truth_label === 'VERNO';
    for (const b of bins) {
      if (c >= b.min && c <= b.max) {
        b.total++;
        if (isCorrect) b.correct++;
        break;
      }
    }
  }

  res.json(bins);
});

app.get('/api/harness/export/json', (_req, res) => {
  const all = db.prepare('SELECT * FROM runs ORDER BY created_at DESC').all();
  res.setHeader('Content-Disposition', 'attachment; filename="andrey_test_runs.json"');
  res.json(all);
});

app.listen(CONFIG.PORT, () => {
  console.log(`[Andrey Test Harness Server] Порт: ${CONFIG.PORT}`);
  console.log(`[Andrey Base Proxy] ${CONFIG.ANDREY_BASE ? 'Сконфигурирован' : 'ОШИБКА: ANDREY_BASE не задан'}`);
});
