import React, { useState, useRef } from 'react';
import { Play, Pause, AlertCircle, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { HarnessAPI } from '../../api/client';

export const BatchManager: React.FC = () => {
  const [costCapRub, setCostCapRub] = useState(500);
  const [manifestText, setManifestText] = useState(
    JSON.stringify(
      [
        { passport: 'pass_stels.mp4', fault: 'fault_chain.mp4', symptom: 'Скрежет цепи на 3 передаче', model: 'Stels Navigator', expected: 's12_chain' },
        { passport: 'pass_merida.mp4', fault: 'fault_brake.mp4', symptom: 'Скрип переднего диска при торможении', model: 'Merida Big Nine', expected: 'b01_pads' },
        { passport: 'pass_trek.mp4', fault: 'fault_bb.mp4', symptom: 'Щелчки в каретке под нагрузкой', model: 'Trek Marlin 7', expected: 'c04_bottom_bracket' }
      ],
      null,
      2
    )
  );
  const [isRunning, setIsRunning] = useState(false);
  const [spentRub, setSpentRub] = useState(0);
  const [completedItems, setCompletedItems] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStart = async () => {
    let parsed: any[] = [];
    try {
      parsed = JSON.parse(manifestText.trim());
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Манифест должен содержать непустой массив объектов кейсов');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Ошибка парсинга JSON-манифеста');
      return;
    }

    setErrorMsg(null);
    setStatusMessage('Инициализация пакетного тестирования...');
    setIsRunning(true);
    setLogs([]);
    setCompletedItems(0);
    setTotalItems(parsed.length);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await HarnessAPI.startBatch(
        costCapRub,
        parsed,
        (event) => {
          if (event.type === 'started') {
            setTotalItems(event.total);
            setStatusMessage(`Пакет запущен: 0 / ${event.total} кейсов`);
          } else if (event.type === 'case_started') {
            setStatusMessage(`Обработка кейса ${event.index} из ${event.total}...`);
          } else if (event.type === 'case_completed') {
            setCompletedItems(event.index);
            setSpentRub(event.spent_rub || 0);
            setStatusMessage(`Завершен кейс ${event.index} из ${event.total}`);
            setLogs((prev) => [
              {
                index: event.index,
                symptom: event.verdict?.symptom || '—',
                gate: event.verdict?.gate || '—',
                confidence: event.verdict?.confidence || 0,
                cost: event.case_cost || 0,
                runId: event.run_id,
                label: event.ground_truth_label,
              },
              ...prev,
            ]);
          } else if (event.type === 'capped') {
            setCompletedItems(event.completed);
            setSpentRub(event.spent_rub || 0);
            setStatusMessage(`Остановлено: жесткий лимит ${costCapRub} ₽ достигнут`);
            setErrorMsg(event.message || 'Лимит бюджета ₽ достигнут!');
            setIsRunning(false);
          } else if (event.type === 'completed') {
            setCompletedItems(event.completed);
            setSpentRub(event.spent_rub || 0);
            setStatusMessage(`Пакет успешно завершен (${event.completed} из ${event.total})`);
            setIsRunning(false);
          }
        },
        controller.signal
      );
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setErrorMsg(err.message || 'Ошибка выполнения пакета');
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsRunning(false);
    setStatusMessage('Пакет остановлен пользователем');
  };

  return (
    <div className="card flex-col gap-3">
      <div className="flex-between">
        <div>
          <h3 className="title-md flex-center gap-1">
            <FileSpreadsheet size={18} className="text-primary" /> Пакетный запуск эталонного датасета (Batch Eval)
          </h3>
          <p className="text-xs text-muted">
            Последовательный прогон пар видео с жестким серверным лимитом бюджета по /api/ledger
          </p>
        </div>
        {statusMessage && (
          <span className="badge badge-secondary flex-center gap-1">
            <CheckCircle2 size={12} className="text-success" /> {statusMessage}
          </span>
        )}
      </div>

      <div className="grid-2 gap-2">
        <div>
          <label className="label">Финансовый лимит на пакет (₽)</label>
          <input
            type="number"
            className="input font-mono"
            value={costCapRub}
            disabled={isRunning}
            onChange={(e) => setCostCapRub(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label">Израсходовано бюджета</label>
          <div className="metric-val text-warning">
            {spentRub.toFixed(2)} / {costCapRub} ₽
          </div>
          {totalItems > 0 && (
            <div className="text-xs text-muted font-mono">
              Прогресс: {completedItems} / {totalItems} ({((completedItems / totalItems) * 100).toFixed(0)}%)
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="label">JSON Манифест пар (passport, fault, symptom, model, expected)</label>
        <textarea
          className="textarea font-mono text-xs"
          rows={7}
          disabled={isRunning}
          placeholder='[{"passport": "case1_pass.mp4", "fault": "case1_fault.mp4", "symptom": "хруст", "expected": "s12_chain"}]'
          value={manifestText}
          onChange={(e) => setManifestText(e.target.value)}
        />
        {errorMsg && (
          <div className="card-sub text-xs text-danger mt-1 flex-center gap-1">
            <AlertCircle size={14} /> {errorMsg}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          className={`btn ${isRunning ? 'btn-danger' : 'btn-primary'} flex-center gap-1`}
          onClick={() => (isRunning ? handleStop() : handleStart())}
        >
          {isRunning ? <Pause size={16} /> : <Play size={16} />}
          {isRunning ? 'Остановить пакет' : 'Запустить пакетное тестирование'}
        </button>
      </div>

      {logs.length > 0 && (
        <div className="card-sub flex-col gap-2 mt-2">
          <h4 className="font-bold text-xs">Лог выполнения пакета ({logs.length})</h4>
          <div className="table-wrapper max-h-60">
            <table className="table text-xs">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Симптом</th>
                  <th>Шлюз</th>
                  <th>Confidence</th>
                  <th>Стоимость</th>
                  <th>Метка</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.runId || log.index}>
                    <td className="font-mono">{log.index}</td>
                    <td>{log.symptom}</td>
                    <td>
                      <span className={`badge ${log.gate === 'verdict' ? 'badge-success' : 'badge-warning'}`}>
                        {log.gate}
                      </span>
                    </td>
                    <td className="font-mono">{log.confidence}%</td>
                    <td className="font-mono text-success">+{log.cost.toFixed(2)} ₽</td>
                    <td>
                      {log.label ? (
                        <span className={`badge badge-${log.label === 'VERNO' ? 'success' : 'danger'}`}>
                          {log.label}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
