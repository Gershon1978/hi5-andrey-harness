import React, { useState, useEffect } from 'react';
import { HarnessAPI } from '../../api/client';
import { TestRunRecord } from '../../types/harness';
import { GitCompare, ArrowRightLeft, FileCode } from 'lucide-react';
import { RawJsonViewer } from '../runner/RawJsonViewer';

export const RunComparator: React.FC = () => {
  const [runs, setRuns] = useState<TestRunRecord[]>([]);
  const [runAId, setRunAId] = useState<string>('');
  const [runBId, setRunBId] = useState<string>('');
  const [showJsonA, setShowJsonA] = useState(false);
  const [showJsonB, setShowJsonB] = useState(false);

  useEffect(() => {
    HarnessAPI.getRuns().then((allRuns) => {
      setRuns(allRuns);
      if (allRuns.length >= 2) {
        setRunAId(allRuns[0].run_id);
        setRunBId(allRuns[1].run_id);
      } else if (allRuns.length === 1) {
        setRunAId(allRuns[0].run_id);
      }
    });
  }, []);

  const runA = runs.find((r) => r.run_id === runAId) || null;
  const runB = runs.find((r) => r.run_id === runBId) || null;

  const parseJsonSafe = (raw?: string) => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  };

  const causesA = parseJsonSafe(runA?.causes_summary);
  const causesB = parseJsonSafe(runB?.causes_summary);

  const swapRuns = () => {
    const temp = runAId;
    setRunAId(runBId);
    setRunBId(temp);
  };

  return (
    <div className="card flex-col gap-4">
      <div className="flex-between">
        <div>
          <h2 className="brand-title flex-center gap-1">
            <GitCompare size={20} className="text-primary" /> Сравнение двух запусков (Side-by-Side Comparator)
          </h2>
          <p className="text-xs text-muted">
            Параллельный аудит двух прогонов: расхождения вердиктов, уверенности, цен и латентности
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm flex-center gap-1"
          onClick={swapRuns}
          disabled={!runA || !runB}
          title="Поменять местами"
        >
          <ArrowRightLeft size={14} /> Поменять A ⇄ B
        </button>
      </div>

      {/* Селекторы запусков */}
      <div className="grid-2 gap-3">
        <div className="card-sub flex-col gap-2">
          <label className="label">Запуск A (Базовый)</label>
          <select
            className="input font-mono text-xs"
            value={runAId}
            onChange={(e) => setRunAId(e.target.value)}
          >
            <option value="">-- Выберите запуск A --</option>
            {runs.map((r) => (
              <option key={`a-${r.run_id}`} value={r.run_id}>
                {new Date(r.created_at).toLocaleTimeString()} | {r.input_symptom ? `«${r.input_symptom.slice(0, 25)}»` : 'Без симптома'} | {r.confidence}% ({r.run_id.slice(0, 8)})
              </option>
            ))}
          </select>
          {runA && (
            <div className="text-xs text-muted flex-between">
              <span>{runA.session_label || 'Обычный прогон'}</span>
              <span className="font-mono">{runA.tester_name}</span>
            </div>
          )}
        </div>

        <div className="card-sub flex-col gap-2">
          <label className="label">Запуск B (Сравниваемый)</label>
          <select
            className="input font-mono text-xs"
            value={runBId}
            onChange={(e) => setRunBId(e.target.value)}
          >
            <option value="">-- Выберите запуск B --</option>
            {runs.map((r) => (
              <option key={`b-${r.run_id}`} value={r.run_id}>
                {new Date(r.created_at).toLocaleTimeString()} | {r.input_symptom ? `«${r.input_symptom.slice(0, 25)}»` : 'Без симптома'} | {r.confidence}% ({r.run_id.slice(0, 8)})
              </option>
            ))}
          </select>
          {runB && (
            <div className="text-xs text-muted flex-between">
              <span>{runB.session_label || 'Обычный прогон'}</span>
              <span className="font-mono">{runB.tester_name}</span>
            </div>
          )}
        </div>
      </div>

      {!runA || !runB ? (
        <div className="upload-box text-muted text-xs">
          Выберите два запуска в выпадающих списках выше для построения диффа параметров.
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Параметр</th>
                <th style={{ width: '39%' }}>Запуск A ({runA.run_id.slice(0, 8)})</th>
                <th style={{ width: '39%' }}>Запуск B ({runB.run_id.slice(0, 8)})</th>
              </tr>
            </thead>
            <tbody>
              {/* Входные данные */}
              <tr>
                <td className="font-bold text-muted">Симптом / Модель</td>
                <td>
                  <div className="font-bold">{runA.input_symptom || '—'}</div>
                  <div className="text-xs text-muted">{runA.input_model || 'Модель не указана'}</div>
                </td>
                <td>
                  <div className="font-bold">{runB.input_symptom || '—'}</div>
                  <div className="text-xs text-muted">{runB.input_model || 'Модель не указана'}</div>
                </td>
              </tr>

              {/* Шлюз (Gate) */}
              <tr>
                <td className="font-bold text-muted">Шлюз (Gate)</td>
                <td>
                  <span className={`badge ${runA.derived_gate === 'verdict' ? 'badge-success' : 'badge-warning'}`}>
                    {runA.derived_gate || '—'}
                  </span>
                </td>
                <td>
                  <span className={`badge ${runB.derived_gate === 'verdict' ? 'badge-success' : 'badge-warning'}`}>
                    {runB.derived_gate || '—'}
                  </span>
                  {runA.derived_gate !== runB.derived_gate && (
                    <span className="badge badge-danger ml-1">Дифф шлюза</span>
                  )}
                </td>
              </tr>

              {/* Уверенность (Confidence) */}
              <tr>
                <td className="font-bold text-muted">Уверенность (Confidence)</td>
                <td>
                  <span className="metric-val font-mono text-primary text-sm">{runA.confidence}%</span>
                </td>
                <td>
                  <span className="metric-val font-mono text-primary text-sm">{runB.confidence}%</span>
                  {runA.confidence !== runB.confidence && (
                    <span className="text-xs font-mono text-muted ml-2">
                      (Δ {(runB.confidence - runA.confidence > 0 ? '+' : '')}{(runB.confidence - runA.confidence).toFixed(1)}%)
                    </span>
                  )}
                </td>
              </tr>

              {/* Причины (Causes) */}
              <tr>
                <td className="font-bold text-muted">Причины (Causes & CRM)</td>
                <td>
                  {causesA.length === 0 ? (
                    <span className="text-muted text-xs">—</span>
                  ) : (
                    <div className="flex-col gap-1">
                      {causesA.map((c: any, idx: number) => (
                        <div key={idx} className="text-xs card-sub p-1">
                          <div className="font-bold">{c.label}</div>
                          <div className="text-muted flex-between">
                            <span>Код: {c.job_code || 'нет'}</span>
                            <span className="font-mono">{c.confidence}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  {causesB.length === 0 ? (
                    <span className="text-muted text-xs">—</span>
                  ) : (
                    <div className="flex-col gap-1">
                      {causesB.map((c: any, idx: number) => (
                        <div key={idx} className="text-xs card-sub p-1">
                          <div className="font-bold">{c.label}</div>
                          <div className="text-muted flex-between">
                            <span>Код: {c.job_code || 'нет'}</span>
                            <span className="font-mono">{c.confidence}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>

              {/* Цены (Prices) */}
              <tr>
                <td className="font-bold text-muted">Цены (DIY / Мастерская)</td>
                <td>
                  <div className="font-mono text-xs">
                    DIY: {runA.diy_price_rub !== null && runA.diy_price_rub !== undefined ? `${runA.diy_price_rub} ₽` : '—'}
                  </div>
                  <div className="text-xs text-muted">Мастерская: {runA.workshop_price_text || '—'}</div>
                </td>
                <td>
                  <div className="font-mono text-xs">
                    DIY: {runB.diy_price_rub !== null && runB.diy_price_rub !== undefined ? `${runB.diy_price_rub} ₽` : '—'}
                  </div>
                  <div className="text-xs text-muted">Мастерская: {runB.workshop_price_text || '—'}</div>
                </td>
              </tr>

              {/* Раунды углубления (Deeper rounds) */}
              <tr>
                <td className="font-bold text-muted">Раунды Deeper</td>
                <td className="font-mono">{runA.deeper_rounds_count}</td>
                <td className="font-mono">
                  {runB.deeper_rounds_count}
                  {runA.deeper_rounds_count !== runB.deeper_rounds_count && (
                    <span className="badge badge-warning ml-2">Разное число</span>
                  )}
                </td>
              </tr>

              {/* Задержка (Latency) */}
              <tr>
                <td className="font-bold text-muted">Задержка сети (Latency)</td>
                <td className="font-mono text-xs">
                  <div>Паспорт: {runA.latency_passport_ms || 0} мс</div>
                  <div>Диагностика: {runA.latency_flow_ms || 0} мс</div>
                  <div className="font-bold text-primary">Итого: {(runA.latency_passport_ms || 0) + (runA.latency_flow_ms || 0)} мс</div>
                </td>
                <td className="font-mono text-xs">
                  <div>Паспорт: {runB.latency_passport_ms || 0} мс</div>
                  <div>Диагностика: {runB.latency_flow_ms || 0} мс</div>
                  <div className="font-bold text-primary">Итого: {(runB.latency_passport_ms || 0) + (runB.latency_flow_ms || 0)} мс</div>
                </td>
              </tr>

              {/* Стоимость (Cost ₽) */}
              <tr>
                <td className="font-bold text-muted">Стоимость вызова (₽)</td>
                <td className="font-mono text-success font-bold">
                  {(runA.cost_rub_estimated || 0).toFixed(2)} ₽
                </td>
                <td className="font-mono text-success font-bold">
                  {(runB.cost_rub_estimated || 0).toFixed(2)} ₽
                </td>
              </tr>

              {/* Разметка эксперта */}
              <tr>
                <td className="font-bold text-muted">Экспертная оценка</td>
                <td>
                  {runA.ground_truth_label ? (
                    <span className={`badge badge-${runA.ground_truth_label === 'VERNO' ? 'success' : 'danger'}`}>
                      {runA.ground_truth_label} ({runA.ground_truth_job || 'без кода'})
                    </span>
                  ) : (
                    <span className="text-muted text-xs">Не размечен</span>
                  )}
                </td>
                <td>
                  {runB.ground_truth_label ? (
                    <span className={`badge badge-${runB.ground_truth_label === 'VERNO' ? 'success' : 'danger'}`}>
                      {runB.ground_truth_label} ({runB.ground_truth_job || 'без кода'})
                    </span>
                  ) : (
                    <span className="text-muted text-xs">Не размечен</span>
                  )}
                </td>
              </tr>

              {/* Сырые ответы */}
              <tr>
                <td className="font-bold text-muted">Сырой JSON</td>
                <td>
                  <button
                    className="btn btn-secondary btn-sm flex-center gap-1"
                    onClick={() => setShowJsonA(!showJsonA)}
                  >
                    <FileCode size={12} /> {showJsonA ? 'Скрыть' : 'Показать JSON A'}
                  </button>
                  {showJsonA && (
                    <div className="mt-2">
                      <RawJsonViewer title="Ответ Flow (A)" jsonText={runA.raw_flow_json} />
                    </div>
                  )}
                </td>
                <td>
                  <button
                    className="btn btn-secondary btn-sm flex-center gap-1"
                    onClick={() => setShowJsonB(!showJsonB)}
                  >
                    <FileCode size={12} /> {showJsonB ? 'Скрыть' : 'Показать JSON B'}
                  </button>
                  {showJsonB && (
                    <div className="mt-2">
                      <RawJsonViewer title="Ответ Flow (B)" jsonText={runB.raw_flow_json} />
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
