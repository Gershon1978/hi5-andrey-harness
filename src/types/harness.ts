export type StepName = 
  | 'INTRO' 
  | 'CHOICE' 
  | 'PASSPORT' 
  | 'ANALYZING' 
  | 'VERDICT' 
  | 'DEEPER' 
  | 'TICKET' 
  | 'PARTS';

export interface AndreyCause {
  label: string;
  confidence: number;
  job_code?: string;
}

export interface AndreyVerdictResponse {
  gate: 'verdict' | 'deeper';
  confidence: number;
  causes?: AndreyCause[];
  diy?: {
    label: string;
    tier: string;
    price_text: string;
    price_rub: number;
  };
  workshop?: {
    price_text: string;
  };
  deeper?: string[];
  warnings?: string[];
  required_parts?: string[];
  fit_constraints?: string[];
}

export interface TestRunRecord {
  run_id: string;
  created_at: string;
  tester_name: string;
  session_label?: string;
  adversarial_tag?: string;
  input_symptom: string;
  input_model: string;
  raw_passport_json?: string;
  raw_flow_json?: string;
  raw_deeper_json?: string;
  raw_handoff_json?: string;
  derived_gate?: string;
  confidence: number;
  deeper_rounds_count: number;
  causes_summary: string;
  diy_price_rub?: number;
  workshop_price_text?: string;
  required_parts?: string;
  fit_constraints?: string;
  latency_passport_ms: number;
  latency_flow_ms: number;
  cost_rub_estimated: number;
  http_error_code?: number;
  raw_error_body?: string;
  ground_truth_label?: 'VERNO' | 'NEVERNO' | 'SPORNO' | 'BROKEN';
  ground_truth_job?: string;
  expert_note?: string;
  reviewed_at?: string;
}
