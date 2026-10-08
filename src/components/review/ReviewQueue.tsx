import React, { useState, useEffect } from 'react';
import { HarnessAPI } from '../../api/client';
import { TestRunRecord } from '../../types/harness';
import { Check, X, HelpCircle, AlertOctagon, MessageSquare } from 'lucide-react';

export const ReviewQueue: React.FC = () => {
  const [runs, setRuns] = useState<TestRunRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expertJob, setExpertJob] = useState('');
  const [expertNote, setExpertNote] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  const loadQueue = async () => {
    const data = await HarnessAPI.getRuns('unreviewed');
    setRuns(data);
    const all = await HarnessAPI.getRuns();
    setTotalCount(all.length);
  };

  useEffect(() => { loadQueue(); }, []);

  const handleReview = async (label: 'VERNO' | 'NEVERNO' | 'SPORNO' | 'BROKEN') => {
    const current = runs[currentIndex];
    if (!current) return;

    await HarnessAPI.reviewRun(current.run_id, label, expertJob, expertNote);
    setExpertJob('');
    setExpertNote('');
    
    // Переход к следующему в очереди
    const nextList = runs.filter((_, i) => i !== currentIndex);
    setRuns(nextList);
    if (currentIndex >= nextList.length) {
      setCurrentIndex(Math.max(0, nextList.length - 1));
    }
  };

  if (runs.length === 0) {
    return (
      <div className="card text-center p-5">
        <h3 className="title-md">Очередь разметки пуста</h3>
        <p className="text-sm text-muted mt-2">
          Все тестовые прогоны проверены экспертами. Всего в базе: {totalCount} прогонов.
        </p>
      </div>
    );
  }

  const current = runs[currentIndex];
  let causes: any[] = [];
  try { causes = JSON.parse(current.causes_summary || '[]'); } catch {}

  const reviewedCount = totalCount - runs.length;
  const accuracyDenominator = totalCount > 0 ? `${reviewedCount} / ${totalCount}` : '0 / 0';

  return (
    <div className="flex-col gap-3 max-w-2xl mx-auto">
      {/* Прогресс разметки */}
      <div className="card flex-between">
        <div>
          <span className="text-xs text-muted">Размечено механиками</span>
          <div className="font-bold font-mono text-base">{accuracyDenominator}</div>
        </div>
        <span className="badge badge-warning">В очереди: {runs.length}</span>
      </div>

      {/* Карточка одного кейса для быстрой разметки */}
      <div className="card flex-col gap-3">
        <div className="flex-between border-b pb-2">
          <span className="font-mono text-xs text-muted">ID: {current.run_id.slice(0, 8)}</span>
          <span className="badge">{current.derived_gate?.toUpperCase()} ({current.confidence}%)</span>
        </div>

        <div>
          <div className="text-xs text-muted">Заявленный симптом</div>
          <div className="font-bold text-base mt-1">«{current.input_symptom || 'Не указан'}»</div>
          {current.input_model && <div className="text-xs text-muted">Модель: {current.input_model}</div>}
        </div>

        <div className="card-sub">
          <div className="text-xs text-muted">Диагноз модели Andrey:</div>
          <div className="font-bold text-primary mt-1">{causes[0]?.label || 'Причина отсутствует'}</div>
          <div className="text-xs mt-1">Предложенный код CRM: <b>{causes[0]?.job_code || '—'}</b></div>
        </div>

        <div className="grid-2 gap-2">
          <div>
            <label className="label">Истинный код работы CRM</label>
            <input 
              className="input" 
              placeholder="s12_chain" 
              value={expertJob} 
              onChange={(e) => setExpertJob(e.target.value)} 
            />
          </div>
          <div>
            <label className="label">Заметка мастера</label>
            <input 
              className="input" 
              placeholder="Причина в петухе, не в цепи" 
              value={expertNote} 
              onChange={(e) => setExpertNote(e.target.value)} 
            />
          </div>
        </div>

        {/* Большие кнопки разметки в 1 тап */}
        <div className="grid-2 gap-2 mt-2">
          <button className="btn btn-success py-3 flex-center gap-1" onClick={() => handleReview('VERNO')}>
            <Check size={18} /> ВЕРНО
          </button>
          <button className="btn btn-danger py-3 flex-center gap-1" onClick={() => handleReview('NEVERNO')}>
            <X size={18} /> НЕВЕРНО
          </button>
          <button className="btn btn-warning py-3 flex-center gap-1" onClick={() => handleReview('SPORNO')}>
            <HelpCircle size={18} /> СПОРНО
          </button>
          <button className="btn btn-secondary py-3 flex-center gap-1" onClick={() => handleReview('BROKEN')}>
            <AlertOctagon size={18} /> НЕ РАБОТАЕТ
          </button>
        </div>
      </div>
    </div>
  );
};
