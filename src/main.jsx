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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
