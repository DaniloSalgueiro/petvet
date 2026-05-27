import { useState, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'

function loadSsCfg() {
  try { return JSON.parse(localStorage.getItem('petvet-ss-config') ?? '{}') }
  catch { return {} }
}

export default function SSLogo({ size = 24 }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [cfg, setCfg] = useState(loadSsCfg)

  useEffect(() => {
    function handler() { setCfg(loadSsCfg()) }
    window.addEventListener('petvet-ss-updated', handler)
    return () => window.removeEventListener('petvet-ss-updated', handler)
  }, [])

  const r = Math.round(size * 0.22)
  const fs = Math.round(size * 0.42)

  if (cfg.logo) {
    return (
      <img
        src={cfg.logo}
        alt={cfg.nome || 'SS'}
        style={{ width: size, height: size, borderRadius: r, objectFit: 'contain', flexShrink: 0, userSelect: 'none' }}
      />
    )
  }

  const initials = (cfg.nome || 'Salgueiro Systems')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: r,
      background: isDark
        ? 'linear-gradient(135deg, #1a1a1a 0%, #D4AF37 100%)'
        : 'linear-gradient(135deg, #1a3a6b 0%, #27B5AC 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff',
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontWeight: 700,
      fontSize: fs,
      letterSpacing: '-0.5px',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {initials}
    </div>
  )
}
