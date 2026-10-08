import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

export const RawJsonViewer: React.FC<{ title: string; jsonText?: string }> = ({ title, jsonText }) => {
  const [copied, setCopied] = useState(false);

  if (!jsonText) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  let formatted = jsonText;
  try {
    formatted = JSON.stringify(JSON.parse(jsonText), null, 2);
  } catch {}

  return (
    <div className="card raw-viewer">
      <div className="raw-header">
        <span className="flex-center gap-1 font-mono text-sm">
          <Terminal size={14} /> {title} (Сырой JSON сервера)
        </span>
        <button className="btn-sm btn-ghost" onClick={handleCopy}>
          {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
      <pre className="code-block font-mono text-xs">{formatted}</pre>
    </div>
  );
};
