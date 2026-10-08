import React, { useState } from 'react';
import { Play, Pause, AlertCircle, FileSpreadsheet } from 'lucide-react';

export const BatchManager: React.FC = () => {
  const [costCapRub, setCostCapRub] = useState(500);
  const [manifestText, setManifestText] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [spentRub, setSpentRub] = useState(0);

  const handleStart = () => {
    if (!manifestText.trim()) {
      alert('Вставьте JSON-манифест пар видео!');
      return;
    }
    setIsRunning(true);
  };

  return (
    <div className="card flex-col gap-3">
      <div>
        <h3 className="title-md">Пакетный запуск эталонного датасета (Batch Eval)</h3>
        <p className="text-xs text-muted">
          Автоматический прогон сотен пар видео с жестким лимитом бюджета по /api/ledger
        </p>
      </div>

      <div className="grid-2 gap-2">
        <div>
          <label className="label">Финансовый лимит на пакет (₽)</label>
          <input 
            type="number" 
            className="input font-mono" 
            value={costCapRub} 
            onChange={(e) => setCostCapRub(Number(e.target.value))} 
          />
        </div>
        <div>
          <label className="label">Израсходовано бюджета</label>
          <div className="metric-val text-warning">{spentRub.toFixed(2)} / {costCapRub} ₽</div>
        </div>
      </div>

      <div>
        <label className="label">JSON Манифест пар (passport_path, fault_path, expected_job)</label>
        <textarea 
          className="textarea font-mono text-xs" 
          rows={6} 
          placeholder='[{"passport": "case1_pass.mp4", "fault": "case1_fault.mp4", "symptom": "хруст", "expected": "s12_chain"}]'
          value={manifestText}
          onChange={(e) => setManifestText(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <button 
          className={`btn ${isRunning ? 'btn-danger' : 'btn-primary'} flex-center gap-1`}
          onClick={() => (isRunning ? setIsRunning(false) : handleStart())}
        >
          {isRunning ? <Pause size={16} /> : <Play size={16} />}
          {isRunning ? 'Приостановить пакет' : 'Запустить пакетное тестирование'}
        </button>
      </div>
    </div>
  );
};
