import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext.tsx' // <-- Importer
import './lib/mapbox'; // <-- Importer
import setupAxiosInterceptors from './utils/axios-config'; // <-- Configuration axios globale

// Configurer les intercepteurs axios au démarrage de l'application
setupAxiosInterceptors();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider> {/* <-- Envelopper App */}
      <App />
    </AuthProvider>
  </React.StrictMode>,
)