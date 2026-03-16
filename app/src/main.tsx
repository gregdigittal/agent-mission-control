import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
// Initialise i18n before rendering — must be imported before App
import './i18n/index.js';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
