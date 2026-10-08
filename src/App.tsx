import React, { useState, useEffect } from 'react';
import { RunnerFlow } from './components/runner/RunnerFlow';
import { ReviewQueue } from './components/review/ReviewQueue';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { BatchManager } from './components/batch/BatchManager';
import { AdversarialGrid } from './components/presets/AdversarialGrid';
import { HarnessAPI } from './api/client';
import { Activity, ClipboardList, BarChart2, Layers, ShieldAlert, Cpu } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'RUNNER' | 'REVIEW' | 'ANALYTICS' | 'BATCH' | 'PRESETS'>('RUNNER');
  const [activePreset, setActivePreset] = useState<any>(null);
  const [isBrainAlive, setIsBrainAlive] = useState<boolean | null>(null);
  const [liveLedgerRub, setLiveLedgerRub] = useState<number | null>(null);

  const checkConnection = async () => {
    try {
      const h = await HarnessAPI.getHealth();
      setIsBrainAlive(h.ok);
      const l = await HarnessAPI.getLedger();
      if (l.ok && l.data?.total_rub !== undefined) {
        setLiveLedgerRub(l.data.total_rub);
      }
    } catch {
      setIsBrainAlive(false);
    }
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectPreset = (p: any) => {
    setActivePreset(p);
    setActiveTab('RUNNER');
  };

  return (
    <div className="app-shell">
      {/* Верхний бар со статусом бекенда */}
      <header className="header">
        <div className="flex-center gap-2">
          <div className="brand-logo">H5</div>
          <div>
            <h1 className="brand-title">Andrey Test Harness</h1>
            <div className="brand-subtitle">Тестовый стенд и калибровка шлюза</div>
          </div>
        </div>

        <div className="flex-center gap-3">
          <div className="flex-center gap-1 text-xs">
            <Cpu size={14} className={isBrainAlive ? 'text-success' : 'text-danger'} />
            <span>Бекенд:</span>
            <span className={`font-bold ${isBrainAlive ? 'text-success' : 'text-danger'}`}>
              {isBrainAlive === null ? 'Проверка...' : isBrainAlive ? 'В СЕТИ' : 'НЕДОСТУПЕН'}
            </span>
          </div>

          <div className="flex-center gap-1 text-xs">
            <span>Баланс Ledger:</span>
            <span className="font-mono font-bold text-primary">
              {liveLedgerRub !== null ? `${liveLedgerRub.toFixed(1)} ₽` : '—'}
            </span>
          </div>
        </div>
      </header>

      {/* Навигация */}
      <nav className="nav-bar">
        <button className={`nav-item ${activeTab === 'RUNNER' ? 'active' : ''}`} onClick={() => setActiveTab('RUNNER')}>
          <Activity size={16} /> Прогон
        </button>
        <button className={`nav-item ${activeTab === 'REVIEW' ? 'active' : ''}`} onClick={() => setActiveTab('REVIEW')}>
          <ClipboardList size={16} /> Очередь разметки
        </button>
        <button className={`nav-item ${activeTab === 'ANALYTICS' ? 'active' : ''}`} onClick={() => setActiveTab('ANALYTICS')}>
          <BarChart2 size={16} /> Калибровка и Аналитика
        </button>
        <button className={`nav-item ${activeTab === 'PRESETS' ? 'active' : ''}`} onClick={() => setActiveTab('PRESETS')}>
          <ShieldAlert size={16} /> Стресс-тесты
        </button>
        <button className={`nav-item ${activeTab === 'BATCH' ? 'active' : ''}`} onClick={() => setActiveTab('BATCH')}>
          <Layers size={16} /> Пакетный Eval
        </button>
      </nav>

      {/* Основная рабочая область */}
      <main className="main-content">
        {activeTab === 'RUNNER' && (
          <RunnerFlow onRunSaved={checkConnection} activePreset={activePreset} />
        )}
        {activeTab === 'REVIEW' && <ReviewQueue />}
        {activeTab === 'ANALYTICS' && <AnalyticsView />}
        {activeTab === 'PRESETS' && <AdversarialGrid onSelectPreset={handleSelectPreset} />}
        {activeTab === 'BATCH' && <BatchManager />}
      </main>
    </div>
  );
};
