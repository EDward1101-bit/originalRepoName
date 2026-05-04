import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { AuthProvider } from './AuthContext.tsx';
import { LanguageProvider } from './LanguageContext.tsx';
import './index.css';

// Global error catcher for debugging
window.onerror = function (message, source, lineno, colno, _error) {
  const container = document.getElementById('root');
  if (container) {
    container.innerHTML = `
      <div style="background: #ffffff; color: #ef4444; padding: 40px; font-family: sans-serif; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
        <h1 style="font-size: 32px; margin-bottom: 20px; color: #1e293b;">Runtime Error Detected:</h1>
        <p style="font-size: 18px; line-height: 1.6; max-width: 800px; color: #1e293b;">${message}</p>
        <p style="font-size: 14px; color: #64748b; margin-top: 10px;">${source}:${lineno}:${colno}</p>
      </div>
    `;
  }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
