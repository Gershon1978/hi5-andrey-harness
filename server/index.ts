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
    const blob = new Blob([f.buffer as any], { type: f.mimetype });
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
    const blob = new Blob([f.buffer as any], { type: f.mimetype });
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
    const blob = new Blob([f.buffer as any], { type: f.mimetype });
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

app.get('/api/harness/runs/:id', (req, res) => {
  const { id } = req.params;
  const row = db.prepare('SELECT * FROM runs WHERE run_id = ?').get(id);
  if (!row) {
    return res.status(404).json({ error: 'Запуск не найден' });
  }
  res.json(row);
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

const getLedgerTotalRub = async (): Promise<number> => {
  try {
    const res = await forwardToAndrey('/api/ledger', 'GET');
    if (res.ok) {
      const parsed = JSON.parse(res.bodyText);
      if (typeof parsed?.ledger?.total_rub === 'number') {
        return parsed.ledger.total_rub;
      }
      if (typeof parsed?.total_rub === 'number') {
        return parsed.total_rub;
      }
    }
  } catch (err) {
    console.warn('[Ledger check failed]:', err);
  }
  return 0;
};

// 4. Пакетный запуск (Batch Eval)
app.post('/api/harness/batch/start', async (req, res) => {
  const costCapRub = Number(req.body.cost_cap_rub) || 500;
  let manifest: any[] = [];
  try {
    manifest = Array.isArray(req.body.manifest)
      ? req.body.manifest
      : JSON.parse(req.body.manifest || '[]');
  } catch {
    return res.status(400).json({ error: 'Неверный формат JSON-манифеста' });
  }

  if (!manifest.length) {
    return res.status(400).json({ error: 'Манифест пуст' });
  }

  const batchId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const totalItems = manifest.length;

  db.prepare(`
    INSERT INTO batches (batch_id, created_at, status, cost_cap_rub, spent_rub, total_items, completed_items, manifest_json)
    VALUES (?, ?, 'RUNNING', ?, 0, ?, 0, ?)
  `).run(batchId, createdAt, costCapRub, totalItems, JSON.stringify(manifest));

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (event: any) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  sendEvent({ type: 'started', batch_id: batchId, total: totalItems, cost_cap_rub: costCapRub });

  const initialLedgerRub = await getLedgerTotalRub();
  let completedItems = 0;
  let totalSpentRub = 0;

  for (let i = 0; i < manifest.length; i++) {
    const item = manifest[i];

    // Читаем ledger перед каждым кейсом и проверяем лимит
    const currentLedgerRub = await getLedgerTotalRub();
    totalSpentRub = Math.max(0, currentLedgerRub - initialLedgerRub);

    if (totalSpentRub >= costCapRub) {
      db.prepare(`
        UPDATE batches SET status = 'CAPPED', spent_rub = ?, completed_items = ? WHERE batch_id = ?
      `).run(totalSpentRub, completedItems, batchId);

      sendEvent({
        type: 'capped',
        batch_id: batchId,
        completed: completedItems,
        total: totalItems,
        spent_rub: totalSpentRub,
        cost_cap_rub: costCapRub,
        message: `Жесткий лимит ${costCapRub} ₽ достигнут (израсходовано ${totalSpentRub.toFixed(2)} ₽)`,
      });
      res.end();
      return;
    }

    sendEvent({
      type: 'case_started',
      index: i + 1,
      total: totalItems,
      spent_rub: totalSpentRub,
      item,
    });

    const form = new FormData();
    const mockBuffer = Buffer.from('mock-media-stream-for-eval');
    const blob = new Blob([mockBuffer as any], { type: 'video/mp4' });
    form.append('files', blob, item.fault || item.passport || 'case.mp4');
    if (item.symptom) form.append('symptom', item.symptom);
    if (item.model) form.append('model', item.model);
    form.append('round_no', '0');
    form.append('use_web', 'true');

    const t0 = Date.now();
    const flowResult = await forwardToAndrey('/api/flow', 'POST', form);
    const latencyFlow = Date.now() - t0;

    let verdictData: any = null;
    try {
      verdictData = JSON.parse(flowResult.bodyText);
    } catch {}

    const verdict = verdictData?.verdict || verdictData;

    const afterCaseLedger = await getLedgerTotalRub();
    const caseCost = Math.max(0, afterCaseLedger - currentLedgerRub);
    totalSpentRub = Math.max(0, afterCaseLedger - initialLedgerRub);

    const runId = crypto.randomUUID();
    const expectedJob = item.expected_job || item.expected || null;
    let groundTruthLabel: string | null = null;

    if (expectedJob && verdict?.causes) {
      const match = Array.isArray(verdict.causes) && verdict.causes.some((c: any) => c.job_code === expectedJob || c.label?.includes(expectedJob));
      groundTruthLabel = match ? 'VERNO' : 'NEVERNO';
    }

    db.prepare(`
      INSERT INTO runs (
        run_id, created_at, tester_name, session_label, adversarial_tag,
        input_symptom, input_model, raw_flow_json, derived_gate,
        confidence, deeper_rounds_count, causes_summary, diy_price_rub,
        workshop_price_text, required_parts, fit_constraints,
        latency_flow_ms, cost_rub_estimated, http_error_code, raw_error_body,
        ground_truth_label, ground_truth_job
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      runId,
      new Date().toISOString(),
      'Batch Eval',
      `Батч ${batchId.slice(0, 8)} [${i + 1}/${totalItems}]`,
      item.tag || null,
      item.symptom || '',
      item.model || '',
      flowResult.bodyText,
      verdict?.gate || (flowResult.ok ? 'verdict' : null),
      verdict?.confidence || 0,
      0,
      JSON.stringify(verdict?.causes || []),
      verdict?.diy?.price_rub || null,
      verdict?.workshop?.price_text || null,
      JSON.stringify(verdict?.parts || verdict?.required_parts || []),
      JSON.stringify(verdict?.constraints || verdict?.fit_constraints || []),
      latencyFlow,
      caseCost,
      flowResult.ok ? null : flowResult.status,
      flowResult.ok ? null : flowResult.bodyText,
      groundTruthLabel,
      expectedJob
    );

    completedItems = i + 1;
    db.prepare(`
      UPDATE batches SET spent_rub = ?, completed_items = ? WHERE batch_id = ?
    `).run(totalSpentRub, completedItems, batchId);

    sendEvent({
      type: 'case_completed',
      index: completedItems,
      total: totalItems,
      run_id: runId,
      spent_rub: totalSpentRub,
      case_cost: caseCost,
      verdict,
      ground_truth_label: groundTruthLabel,
    });
  }

  db.prepare(`
    UPDATE batches SET status = 'COMPLETED', spent_rub = ?, completed_items = ? WHERE batch_id = ?
  `).run(totalSpentRub, completedItems, batchId);

  sendEvent({
    type: 'completed',
    batch_id: batchId,
    completed: completedItems,
    total: totalItems,
    spent_rub: totalSpentRub,
  });

  res.end();
});

app.get('/api/harness/batches', (_req, res) => {
  const all = db.prepare('SELECT * FROM batches ORDER BY created_at DESC').all();
  res.json(all);
});

// 5. Аналитика калибровки
app.get('/api/harness/analytics/calibration', (_req, res) => {
  const rows = db.prepare(`
    SELECT confidence, ground_truth_label 
    FROM runs 
    WHERE ground_truth_label IS NOT NULL
  `).all() as { confidence: number; ground_truth_label: string }[];

  const bins = [
    { range: '0-20', min: 0, max: 20, n: 0, total: 0, correct: 0, success_rate: 0 },
    { range: '20-40', min: 20, max: 40, n: 0, total: 0, correct: 0, success_rate: 0 },
    { range: '40-60', min: 40, max: 60, n: 0, total: 0, correct: 0, success_rate: 0 },
    { range: '60-80', min: 60, max: 80, n: 0, total: 0, correct: 0, success_rate: 0 },
    { range: '80-100', min: 80, max: 100, n: 0, total: 0, correct: 0, success_rate: 0 },
  ];

  for (const row of rows) {
    const c = Math.max(0, Math.min(100, Number(row.confidence) || 0));
    const isCorrect = row.ground_truth_label === 'VERNO';
    for (let i = 0; i < bins.length; i++) {
      const b = bins[i];
      const inBin = i === 0 ? (c >= b.min && c <= b.max) : (c > b.min && c <= b.max);
      if (inBin) {
        b.n++;
        b.total++;
        if (isCorrect) b.correct++;
        break;
      }
    }
  }

  for (const b of bins) {
    b.success_rate = b.n > 0 ? Number((b.correct / b.n).toFixed(4)) : 0;
  }

  res.json(bins);
});

app.get('/api/harness/export/json', (_req, res) => {
  const all = db.prepare('SELECT * FROM runs ORDER BY created_at DESC').all();
  res.setHeader('Content-Disposition', 'attachment; filename="andrey_test_runs.json"');
  res.json(all);
});

export { app };

app.listen(CONFIG.PORT, '0.0.0.0', () => {
  console.log(`[Andrey Test Harness Server] Порт: ${CONFIG.PORT}`);
  console.log(`[Andrey Base Proxy] ${CONFIG.ANDREY_BASE ? 'Сконфигурирован' : 'ОШИБКА: ANDREY_BASE не задан'}`);
});
