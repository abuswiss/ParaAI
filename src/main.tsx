import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { checkSupabaseEnv } from './utils/envCheck'
import App from './App'

// Check environment configuration during startup
const envCheck = checkSupabaseEnv();
if (!envCheck.valid && import.meta.env.DEV) {
  console.warn('⚠️ Environment configuration issues detected:');
  console.warn(envCheck.debugInfo);
  console.warn('The application may not function correctly without proper environment variables.');
  
  // Display a more visible warning in the console
  console.log('%c⚠️ ENVIRONMENT CONFIGURATION ERROR', 'background: #f44336; color: white; font-size: 16px; padding: 4px 8px;');
  console.log('%cSee .env.example for required variables', 'font-size: 14px; color: #f44336;');
}

// Initialize app after environment validation
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
