import React, { useState, useEffect, useRef } from 'react';
import { HarnessAPI } from '../../api/client';
import { StepName, AndreyVerdictResponse, TestRunRecord } from '../../types/harness';
import { RawJsonViewer } from './RawJsonViewer';
import { AlertTriangle, Upload, CheckCircle2, RefreshCw } from 'lucide-react';

const MAX_SECONDS = 18;
const MAX_MB = 40;

export const RunnerFlow: React.FC<{ onRunSaved: () => void; activePreset?: any }> = ({ onRunSaved, activePreset }) => {
  const [step, setStep] = useState<StepName>('INTRO');
  const [testerName, setTesterName] = useState('Механик 1');
  const [sessionLabel, setSessionLabel] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [symptomInput, setSymptomInput] = useState('');

  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [passportDuration, setPassportDuration] = useState(0);
  const [passportLatency, setPassportLatency] = useState(0);
  const [faultFile, setFaultFile] = useState<File | null>(null);
  const [faultDuration, setFaultDuration] = useState(0);

  const [deeperFiles, setDeeperFiles] = useState<File[]>([]);
  const [roundNo, setRoundNo] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [rawPassport, setRawPassport] = useState<string>('');
  const [rawFlow, setRawFlow] = useState<string>('');
  const [rawDeeper, setRawDeeper] = useState<string[]>([]);
  const [verdict, setVerdict] = useState<AndreyVerdictResponse | null>(null);

  const [ledgerBefore, setLedgerBefore] = useState<number>(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (activePreset) {
      setSessionLabel(`Стресс-тест: ${activePreset.name}`);
      setModelInput(activePreset.model || '');
      setSymptomInput(activePreset.symptom || '');
    }
  }, [activePreset]);

  useEffect(() => {
    if (isLoading) {
      setElapsedSec(0);
      timerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isLoading]);

  const inspectVideo = (file: File, callback: (duration: number) => void) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      callback(video.duration);
    };
    video.src = URL.createObjectURL(file);
  };

  const handlePassportSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      setErrorMessage(`Внимание! Размер файла ${(file.size / (1024 * 1024)).toFixed(1)} МБ превышает лимит ${MAX_MB} МБ!`);
    } else {
      setErrorMessage(null);
    }
    setPassportFile(file);
    inspectVideo(file, (d) => {
      setPassportDuration(d);
      if (d > MAX_SECONDS) {
        setErrorMessage(`Внимание! Длина видео ${d.toFixed(1)} с превышает жесткий лимит ${MAX_SECONDS} с!`);
      }
    });
  };

  const handleFaultSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      setErrorMessage(`Размер файла ${(file.size / (1024 * 1024)).toFixed(1)} МБ превышает лимит ${MAX_MB} МБ!`);
    } else {
      setErrorMessage(null);
    }
    setFaultFile(file);
    inspectVideo(file, (d) => setFaultDuration(d));
  };

  const startPassportStage = async () => {
    if (!passportFile) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const ledg = await HarnessAPI.getLedger();
      if (ledg.ok && ledg.data?.total_rub) setLedgerBefore(ledg.data.total_rub);
    } catch {}

    const t0 = Date.now();
    const res = await HarnessAPI.postPassport(passportFile, modelInput);
    const latency = Date.now() - t0;
    setPassportLatency(latency);
    setIsLoading(false);

    setRawPassport(res.rawText);

    if (!res.ok) {
      setErrorMessage(`Ошибка /api/passport: HTTP ${res.status} — ${res.rawText}`);
      return;
    }

    setStep('ANALYZING');
  };

  const executeDiagnosis = async () => {
    if (!faultFile) return;
    setIsLoading(true);
    setErrorMessage(null);

    const t0 = Date.now();
    const res = await HarnessAPI.postFlow(faultFile, symptomInput, modelInput, 0);
    const latency = Date.now() - t0;
    setIsLoading(false);

    setRawFlow(res.rawText);

    if (!res.ok) {
      setErrorMessage(`Ошибка /api/flow: HTTP ${res.status} — ${res.rawText}`);
      return;
    }

    if (res.data) {
      setVerdict(res.data);
      if (res.data.gate === 'deeper') {
        setStep('DEEPER');
      } else {
        setStep('VERDICT');
      }
      persistRun(res.data, latency);
    }
  };

  const submitDeeperRound = async () => {
    if (deeperFiles.length === 0) return;
    setIsLoading(true);
    setErrorMessage(null);

    const nextRound = roundNo + 1;
    const res = await HarnessAPI.postDeeper(deeperFiles, nextRound);
    setIsLoading(false);

    if (res.rawText) {
      setRawDeeper((prev) => [...prev, res.rawText]);
    }

    if (!res.ok) {
      setErrorMessage(`Ошибка /api/deeper (раунд ${nextRound}): HTTP ${res.status} — ${res.rawText}`);
      return;
    }

    if (res.data) {
      setVerdict(res.data);
      setRoundNo(nextRound);
      if (res.data.gate === 'verdict' || nextRound >= 2) {
        setStep('VERDICT');
      }
      setDeeperFiles([]);
    }
  };

  const persistRun = async (finalVerdict: AndreyVerdictResponse, latencyFlow: number) => {
    let costRub = 0;
    try {
      const ledgAfter = await HarnessAPI.getLedger();
      if (ledgAfter.ok && ledgAfter.data?.total_rub) {
        costRub = Math.max(0, ledgAfter.data.total_rub - ledgerBefore);
      }
    } catch {}

    const runRecord: Partial<TestRunRecord> = {
      tester_name: testerName,
      session_label: sessionLabel,
      adversarial_tag: activePreset?.tag || undefined,
      input_symptom: symptomInput,
      input_model: modelInput,
      passport_duration: passportDuration,
      passport_bytes: passportFile?.size || 0,
      fault_duration: faultDuration,
      fault_bytes: faultFile?.size || 0,
      raw_passport_json: rawPassport,
      raw_flow_json: rawFlow,
      raw_deeper_json: JSON.stringify(rawDeeper),
      derived_gate: finalVerdict.gate,
      confidence: finalVerdict.confidence,
      deeper_rounds_count: roundNo,
      causes_summary: JSON.stringify(finalVerdict.causes || []),
      diy_price_rub: finalVerdict.diy?.price_rub,
      workshop_price_text: finalVerdict.workshop?.price_text,
      required_parts: JSON.stringify(finalVerdict.required_parts || []),
      fit_constraints: JSON.stringify(finalVerdict.fit_constraints || []),
      latency_passport_ms: passportLatency,
      latency_flow_ms: latencyFlow,
      cost_rub_estimated: costRub,
    };

    await HarnessAPI.saveRun(runRecord);
    onRunSaved();
  };

  return (
    <div className="flow-container">
      {/* Шапка статуса сессии */}
      <div className="card grid-3 gap-2">
        <div>
          <label className="label">Тестировщик</label>
          <input className="input" value={testerName} onChange={(e) => setTesterName(e.target.value)} />
        </div>
        <div>
          <label className="label">Метка сессии / Заметка</label>
          <input className="input" placeholder="Напр. Скрип каретки BSA" value={sessionLabel} onChange={(e) => setSessionLabel(e.target.value)} />
        </div>
        <div>
          <label className="label">Модель байка (опция)</label>
          <input className="input" placeholder="Trek Marlin 7" value={modelInput} onChange={(e) => setModelInput(e.target.value)} />
        </div>
      </div>

      {isLoading && (
        <div className="card loading-card flex-center flex-col gap-2">
          <RefreshCw className="spin text-primary" size={32} />
          <div className="font-bold">Ожидание ответа бекенда Andrey...</div>
          <div className="font-mono text-lg text-primary">{elapsedSec} сек / таймаут 120 с</div>
          <div className="text-xs text-muted">Идет анализ кадров (deepseek-flash) и мультимодального контекста (gemini-3.8-flash)</div>
        </div>
      )}

      {errorMessage && (
        <div className="card alert-error">
          <div className="flex gap-2">
            <AlertTriangle size={20} />
            <div className="font-bold">Сбой запроса</div>
          </div>
          <div className="font-mono text-xs mt-2 overflow-auto">{errorMessage}</div>
        </div>
      )}

      {/* ШАГ 1: INTRO / ВЫБОР РЕЖИМА */}
      {step === 'INTRO' && (
        <div className="card text-center flex-col flex-center gap-3">
          <h2 className="title-md">Реальный прогон Andrey (Два видео)</h2>
          <p className="text-sm text-muted max-w-md">
            1-й шаг: ~10 с <b>НЕМОЕ</b> видео байка целиком (/api/passport).<br />
            2-й шаг: ~10 с видео <b>СО ЗВУКОМ</b> неисправности (/api/flow).
          </p>
          <button className="btn btn-primary" onClick={() => setStep('PASSPORT')}>
            Начать диагностику
          </button>
        </div>
      )}

      {/* ШАГ 2: ПАСПОРТ БАЙКА */}
      {step === 'PASSPORT' && (
        <div className="card flex-col gap-3">
          <div className="flex-between">
            <h3 className="font-bold">Шаг 1: Немое видео паспорта (~10 с)</h3>
            <span className="badge">POST /api/passport</span>
          </div>

          <div className="upload-box">
            <input type="file" accept="video/*" onChange={handlePassportSelect} />
            {passportFile ? (
              <div className="text-sm text-success flex-center gap-1">
                <CheckCircle2 size={16} /> {passportFile.name} ({(passportFile.size / 1024 / 1024).toFixed(1)} МБ, {passportDuration.toFixed(1)} с)
              </div>
            ) : (
              <div className="text-sm text-muted flex-center gap-1">
                <Upload size={16} /> Выберите или запишите ролик паспорта
              </div>
            )}
          </div>

          <button className="btn btn-primary" disabled={!passportFile || isLoading} onClick={startPassportStage}>
            Отправить паспорт
          </button>
        </div>
      )}

      {/* ШАГ 3: ВИДЕО ДЕФЕКТА */}
      {step === 'ANALYZING' && (
        <div className="card flex-col gap-3">
          <div className="flex-between">
            <h3 className="font-bold">Шаг 2: Видео неисправности СО ЗВУКОМ</h3>
            <span className="badge">POST /api/flow</span>
          </div>

          <div>
            <label className="label">Текст симптома (поломки)</label>
            <input 
              className="input" 
              placeholder="Цепь проскакивает под нагрузкой" 
              value={symptomInput} 
              onChange={(e) => setSymptomInput(e.target.value)} 
            />
          </div>

          <div className="upload-box">
            <input type="file" accept="video/*" onChange={handleFaultSelect} />
            {faultFile ? (
              <div className="text-sm text-success flex-center gap-1">
                <CheckCircle2 size={16} /> {faultFile.name} ({(faultFile.size / 1024 / 1024).toFixed(1)} МБ, {faultDuration.toFixed(1)} с)
              </div>
            ) : (
              <div className="text-sm text-muted flex-center gap-1">
                <Upload size={16} /> Загрузите ролик поломки со звуком работы узла
              </div>
            )}
          </div>

          <button className="btn btn-primary" disabled={!faultFile || isLoading} onClick={executeDiagnosis}>
            Запустить полную диагностику
          </button>
        </div>
      )}

      {/* ШАГ 4: УТОЧНЕНИЕ DEEPER */}
      {step === 'DEEPER' && (
        <div className="card alert-warning flex-col gap-3">
          <div className="flex-between">
            <div className="font-bold text-warning flex-center gap-1">
              <AlertTriangle size={18} /> ШЛЮЗ: DEEPER (Уверенность &lt; 80% — Цены скрыты)
            </div>
            <span className="badge badge-warning">Раунд {roundNo + 1} из 2</span>
          </div>

          <div className="text-sm">
            Бекенд запросил макро-фотографии:
            <ul className="list-disc ml-5 mt-1 font-semibold">
              {verdict?.deeper?.map((item, idx) => <li key={idx}>{item}</li>)}
            </ul>
          </div>

          <div className="upload-box">
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              onChange={(e) => setDeeperFiles(Array.from(e.target.files || []))} 
            />
            <div className="text-sm text-muted">
              {deeperFiles.length > 0 ? `Выбрано фото: ${deeperFiles.length}` : 'Прикрепите 1-2 четких фото узла'}
            </div>
          </div>

          <div className="flex gap-2">
            <button className="btn btn-warning flex-1" disabled={deeperFiles.length === 0 || isLoading} onClick={submitDeeperRound}>
              Отправить фото уточнения
            </button>
            <button className="btn btn-secondary" onClick={() => setStep('VERDICT')}>
              Принудительный вердикт
            </button>
          </div>
        </div>
      )}

      {/* ШАГ 5: ИТОГОВЫЙ ВЕРДИКТ */}
      {step === 'VERDICT' && verdict && (
        <div className="card flex-col gap-3">
          <div className="flex-between">
            <h3 className="title-md">Вердикт Andrey</h3>
            <span className={`badge ${verdict.gate === 'verdict' ? 'badge-success' : 'badge-warning'}`}>
              Gate: {verdict.gate.toUpperCase()} ({verdict.confidence}%)
            </span>
          </div>

          <div className="verdict-summary grid-2 gap-2">
            <div className="card-sub">
              <div className="text-xs text-muted">Диагностированная причина</div>
              <div className="font-bold text-base mt-1">
                {verdict.causes?.[0]?.label || 'Причина не выделена'}
              </div>
              <div className="text-xs mt-1 text-primary">Код CRM: {verdict.causes?.[0]?.job_code || 'Н/Д'}</div>
            </div>

            <div className="card-sub">
              <div className="text-xs text-muted">Цены CRM (только от сервера)</div>
              {verdict.gate === 'verdict' ? (
                <div className="mt-1">
                  <div>DIY гайд: <b>{verdict.diy?.price_text || `${verdict.diy?.price_rub} ₽`}</b></div>
                  <div>Мастерская: <b>{verdict.workshop?.price_text || 'Не указана'}</b></div>
                </div>
              ) : (
                <div className="text-xs text-danger font-semibold mt-1">
                  Цены строго заблокированы (Gate: deeper)
                </div>
              )}
            </div>
          </div>

          <button className="btn btn-secondary self-start" onClick={() => { setStep('INTRO'); setVerdict(null); }}>
            Новый прогон
          </button>
        </div>
      )}

      {/* СЫРЫЕ JSON ДЛЯ КОНТРОЛЯ */}
      <RawJsonViewer title="/api/flow" jsonText={rawFlow} />
      <RawJsonViewer title="/api/passport" jsonText={rawPassport} />
    </div>
  );
};
