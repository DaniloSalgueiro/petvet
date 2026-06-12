import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/global.css'
import './styles/layout.css'
import { migrateLocalStorageToSupabase, syncAll, loadAll } from './hooks/useSupabaseSync'
import { uploadIconePWA, initStorage } from './lib/supabase'

// Expõe funções utilitárias no console do browser para execução manual
if (typeof window !== 'undefined') {
  window.migrateLocalStorageToSupabase = migrateLocalStorageToSupabase
  window.syncAll = syncAll
  window.loadAll = loadAll
  window.uploadIconePWA = uploadIconePWA
  window.initStorage = initStorage
}

function sendManifestToSW() {
  try {
    const identidade = JSON.parse(localStorage.getItem('petvet-identidade') || '{}')
    navigator.serviceWorker.controller?.postMessage({ type: 'UPDATE_MANIFEST', payload: identidade })
  } catch {}
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('[PetVet] SW registrado:', reg.scope)
        const hadController = !!navigator.serviceWorker.controller
        if (hadController) sendManifestToSW()

        reg.update()

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'activated' && hadController) {
              window.location.reload()
            }
          })
        })
      })
      .catch(err => console.warn('[PetVet] SW erro:', err))

    navigator.serviceWorker.addEventListener('controllerchange', sendManifestToSW)
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
