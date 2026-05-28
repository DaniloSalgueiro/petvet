import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/global.css'
import './styles/layout.css'
import { migrateLocalStorageToSupabase, syncAll } from './hooks/useSupabaseSync'

// Expõe funções de migração no console do browser para execução manual
// Uso: await migrateLocalStorageToSupabase()   (migração única com proteção contra repetição)
//      await syncAll()                          (sync forçado de todos os dados)
if (typeof window !== 'undefined') {
  window.migrateLocalStorageToSupabase = migrateLocalStorageToSupabase
  window.syncAll = syncAll
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[PetVet] SW registrado:', reg.scope))
      .catch(err => console.warn('[PetVet] SW erro:', err))
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
