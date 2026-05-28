import { useState, useEffect, useRef } from 'react'
import { Download, X } from 'lucide-react'

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showButton, setShowButton] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSHint, setShowIOSHint] = useState(false)
  const hintRef = useRef(null)

  useEffect(() => {
    // Não mostrar se já está instalado como app
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true

    if (isStandalone) return

    // iOS: não dispara beforeinstallprompt — instrução manual
    const isIOSDevice = /iphone|ipad|ipod/i.test(navigator.userAgent)
    if (isIOSDevice) {
      setIsIOS(true)
      setShowButton(true)
      return
    }

    // Android / Chrome / Edge: captura o prompt nativo
    function onBeforeInstall(e) {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowButton(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', () => {
      setShowButton(false)
      setDeferredPrompt(null)
    })

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  // Fecha o hint iOS ao clicar fora
  useEffect(() => {
    if (!showIOSHint) return
    function onClickOutside(e) {
      if (hintRef.current && !hintRef.current.contains(e.target)) setShowIOSHint(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [showIOSHint])

  async function handleClick() {
    if (isIOS) {
      setShowIOSHint(v => !v)
      return
    }
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowButton(false)
      setDeferredPrompt(null)
    }
  }

  if (!showButton) return null

  return (
    <div style={{ position: 'relative' }} ref={hintRef}>
      <button
        className="btn btn-outline btn-sm"
        onClick={handleClick}
        title="Instalar app no dispositivo"
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <Download size={15} />
        <span className="install-pwa-label">Instalar app</span>
      </button>

      {showIOSHint && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0, zIndex: 1300,
          width: 240, background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: 'var(--shadow-lg)', padding: '12px 14px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>Instalar no iOS</span>
            <button className="btn btn-ghost btn-icon" style={{ padding: 2 }} onClick={() => setShowIOSHint(false)}>
              <X size={14} />
            </button>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
            Toque em <strong>Compartilhar</strong> (&#x2B06;) na barra do Safari e depois em <strong>Adicionar à Tela de Início</strong>.
          </p>
        </div>
      )}
    </div>
  )
}
