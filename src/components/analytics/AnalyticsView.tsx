import React, { useState, useEffect } from 'react';
import { HarnessAPI } from '../../api/client';
import { TestRunRecord } from '../../types/harness';
import { BarChart3, ShieldAlert, DollarSign, Download } from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const [runs, setRuns] = useState<TestRunRecord[]>([]);
  const [calibration, setCalibration] = useState<any[]>([]);

  useEffect(() => {
    HarnessAPI.getRuns().then(setRuns);
    HarnessAPI.getCalibration().then(setCalibration);
  }, []);

  const totalRuns = runs.length;
  const reviewedRuns = runs.filter((r) => r.ground_truth_label !== null && r.ground_truth_label !== undefined);
  const correctRuns = runs.filter((r) => r.ground_truth_label === 'VERNO').length;
  const wrongFitRuns = runs.filter((r) => r.ground_truth_label === 'NEVERNO').length;

  const totalCostRub = runs.reduce((acc, r) => acc + (r.cost_rub_estimated || 0), 0);
  const deeperStallCount = runs.filter((r) => r.deeper_rounds_count >= 2).length;

  return (
    <div className="flex-col gap-4">
      {/* Метрики верхнего уровня */}
      <div className="grid-4 gap-2">
        <div className="card metric-card">
          <span className="text-xs text-muted">Точность диагноза</span>
          <div className="metric-val text-primary">
            {reviewedRuns.length > 0 
              ? `${((correctRuns / reviewedRuns.length) * 100).toFixed(1)}%` 
              : '—'}
          </div>
          <span className="text-xs text-muted">Знаменатель: {correctRuns} / {reviewedRuns.length}</span>
        </div>

        <div className="card metric-card">
          <span className="text-xs text-muted">Ошибочный подбор (Wrong-Fit)</span>
          <div className="metric-val text-danger">
            {reviewedRuns.length > 0 
              ? `${((wrongFitRuns / reviewedRuns.length) * 100).toFixed(1)}%` 
              : '—'}
          </div>
          <span className="text-xs text-muted">Знаменатель: {wrongFitRuns} / {reviewedRuns.length}</span>
        </div>

        <div className="card metric-card">
          <span className="text-xs text-muted">Всего затрат (по Ledger)</span>
          <div className="metric-val text-success">{totalCostRub.toFixed(1)} ₽</div>
          <span className="text-xs text-muted">
            {totalRuns > 0 ? (totalCostRub / totalRuns).toFixed(2) : 0} ₽ / запуск
          </span>
        </div>

        <div className="card metric-card">
          <span className="text-xs text-muted">Тупики Deeper (2 раунда)</span>
          <div className="metric-val text-warning">{deeperStallCount}</div>
          <span className="text-xs text-muted">Не смогли принять решение</span>
        </div>
      </div>

      {/* Калибровочная кривая ворот 80% */}
      <div className="card flex-col gap-3">
        <div className="flex-between">
          <div>
            <h3 className="font-bold flex-center gap-1">
              <BarChart3 size={18} /> Калибровка шлюза 80% (Reliability Curve)
            </h3>
            <p className="text-xs text-muted">
              Действительно ли confidence 80% соответствует 80% правильных ответов?
            </p>
          </div>
          <a href="/api/harness/export/json" download className="btn-sm btn-secondary flex-center gap-1">
            <Download size={14} /> Экспорт JSON
          </a>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Бин уверенности</th>
                <th>Проверено кейсов</th>
                <th>Верных диагнозов</th>
                <th>Реальная точность</th>
                <th>Статус калибровки</th>
              </tr>
            </thead>
            <tbody>
              {calibration.map((bin) => {
                const observedRate = bin.total > 0 ? (bin.correct / bin.total) * 100 : 0;
                const isOverconfident = bin.min >= 80 && observedRate < 80 && bin.total >= 3;

                return (
                  <tr key={bin.range}>
                    <td className="font-mono font-bold">{bin.range}%</td>
                    <td>{bin.total}</td>
                    <td>{bin.correct}</td>
                    <td className="font-mono font-bold">{bin.total > 0 ? `${observedRate.toFixed(1)}%` : '—'}</td>
                    <td>
                      {bin.total === 0 ? (
                        <span className="text-muted text-xs">Нет данных</span>
                      ) : isOverconfident ? (
                        <span className="badge badge-danger">Завышенная уверенность</span>
                      ) : (
                        <span className="badge badge-success">Откалиброван</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Таблица последних запусков */}
      <div className="card flex-col gap-2">
        <h3 className="font-bold text-sm">Журнал всех прогонов ({runs.length})</h3>
        <div className="table-wrapper max-h-96">
          <table className="table text-xs">
            <thead>
              <tr>
                <th>Время</th>
                <th>Симптом</th>
                <th>Шлюз</th>
                <th>Confidence</th>
                <th>Код CRM</th>
                <th>Оценка</th>
                <th>Затраты</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.run_id}>
                  <td className="font-mono">{new Date(r.created_at).toLocaleTimeString()}</td>
                  <td>{r.input_symptom || '—'}</td>
                  <td>
                    <span className={`badge ${r.derived_gate === 'verdict' ? 'badge-success' : 'badge-warning'}`}>
                      {r.derived_gate || '—'}
                    </span>
                  </td>
                  <td className="font-mono">{r.confidence ? `${r.confidence}%` : '—'}</td>
                  <td className="font-mono">{JSON.parse(r.causes_summary || '[]')[0]?.job_code || '—'}</td>
                  <td>
                    {r.ground_truth_label ? (
                      <span className={`badge badge-${r.ground_truth_label === 'VERNO' ? 'success' : 'danger'}`}>
                        {r.ground_truth_label}
                      </span>
                    ) : (
                      <span className="text-muted">Не проверен</span>
                    )}
                  </td>
                  <td className="font-mono">{r.cost_rub_estimated?.toFixed(2) || '0.00'} ₽</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
