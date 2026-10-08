import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Корневой элемент #root не найден в DOM');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
