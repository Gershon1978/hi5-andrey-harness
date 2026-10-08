import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const storageDir = path.resolve(process.cwd(), 'server', 'storage');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

const dbPath = path.join(storageDir, 'harness.db');
export const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    tester_name TEXT NOT NULL,
    session_label TEXT,
    adversarial_tag TEXT,
    passport_file_hash TEXT,
    passport_duration REAL,
    passport_bytes INTEGER,
    fault_file_hash TEXT,
    fault_duration REAL,
    fault_bytes INTEGER,
    input_symptom TEXT,
    input_model TEXT,
    raw_passport_json TEXT,
    raw_flow_json TEXT,
    raw_deeper_json TEXT,
    raw_handoff_json TEXT,
    derived_gate TEXT,
    confidence REAL,
    deeper_rounds_count INTEGER DEFAULT 0,
    causes_summary TEXT,
    diy_price_rub INTEGER,
    workshop_price_text TEXT,
    required_parts TEXT,
    fit_constraints TEXT,
    latency_passport_ms INTEGER,
    latency_flow_ms INTEGER,
    cost_rub_estimated REAL DEFAULT 0,
    http_error_code INTEGER,
    raw_error_body TEXT,
    ground_truth_label TEXT,
    ground_truth_job TEXT,
    expert_note TEXT,
    reviewed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS batches (
    batch_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL,
    cost_cap_rub REAL NOT NULL,
    spent_rub REAL DEFAULT 0,
    total_items INTEGER NOT NULL,
    completed_items INTEGER DEFAULT 0,
    manifest_json TEXT NOT NULL
  );
`);
