import React from 'react';
import { 
  Tv, VolumeX, Shuffle, Clock, FileWarning, 
  UserX, Copy, Layers, WifiOff, FileText, Image, Music 
} from 'lucide-react';

interface Preset {
  tag: string;
  name: string;
  desc: string;
  icon: any;
  symptom?: string;
  model?: string;
}

const PRESETS: Preset[] = [
  { tag: 'screen_rec', name: 'Съемка с экрана', desc: 'Видео чужого ролика с монитора', icon: Tv },
  { tag: 'silent_fault', name: 'Тихий ролик дефекта', desc: 'Звук отсутствует или занулен', icon: VolumeX },
  { tag: 'wrong_model', name: 'Неверная модель', desc: 'Видео шоссейника + текст Stels 300', icon: Shuffle, model: 'Stels Navigator 300' },
  { tag: 'too_long', name: 'Длинное видео (>18с)', desc: 'Проверка клиентского отсечения', icon: Clock },
  { tag: 'oversize_mb', name: 'Тяжелый файл (>40МБ)', desc: 'Проверка ошибки HTTP 413', icon: FileWarning },
  { tag: 'non_bike', name: 'Не-велосипед', desc: 'Съемка лица, кота или машины', icon: UserX },
  { tag: 'duplicate_file', name: 'Один файл на 2 шага', desc: 'Паспорт отправлен вместо дефекта', icon: Copy },
  { tag: 'duplicate_req', name: 'Двойная отправка', desc: 'Параллельный дубль запроса', icon: Layers },
  { tag: 'network_abort', name: 'Обрыв загрузки', desc: 'Тест разрыва сессии клиентом', icon: WifiOff },
  { tag: 'empty_symptom', name: 'Пустой симптом', desc: 'Диагностика строго по видео', icon: FileText, symptom: '' },
  { tag: 'photo_as_video', name: 'Фото вместо видео', desc: 'Подмена формата на одиночный кадр', icon: Image },
  { tag: 'loud_music', name: 'Музыка вместо звука', desc: 'Рок-музыка перекрывает узел', icon: Music },
];

export const AdversarialGrid: React.FC<{ onSelectPreset: (p: Preset) => void }> = ({ onSelectPreset }) => {
  return (
    <div className="card flex-col gap-3">
      <div>
        <h3 className="title-md">Матрица стресс-тестов (12 негативных пресетов)</h3>
        <p className="text-xs text-muted">
          Запуск проверки пограничных и состязательных сценариев в один клик с записью тега в базу
        </p>
      </div>

      <div className="grid-3 gap-2">
        {PRESETS.map((p) => {
          const Icon = p.icon;
          return (
            <button 
              key={p.tag} 
              className="preset-btn flex-col items-start p-3 text-left" 
              onClick={() => onSelectPreset(p)}
            >
              <div className="flex-center gap-1 font-bold text-sm text-primary">
                <Icon size={16} /> {p.name}
              </div>
              <div className="text-xs text-muted mt-1">{p.desc}</div>
              <span className="badge badge-secondary mt-2 font-mono text-2xs">{p.tag}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
