import { useEffect } from 'react'

export default function Modal({ isOpen, onClose, title, children, footer, size = 'md', closeOnOverlay = true }) {
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const widths = { sm: 420, md: 580, lg: 760, xl: 960, full: '95vw' }

  return (
    <div style={overlay} onClick={closeOnOverlay ? onClose : undefined}>
      <div
        style={{ ...dialog, maxWidth: widths[size] }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <div style={header}>
          <h3 style={titleStyle}>{title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Fechar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={body}>{children}</div>

        {footer && <div style={footerStyle}>{footer}</div>}
      </div>
    </div>
  )
}

const overlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.45)',
  backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: '24px',
}
const dialog = {
  background: 'var(--surface)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-lg)',
  width: '100%',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  animation: 'modalIn 150ms ease',
}
const header = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '18px 22px', borderBottom: '1px solid var(--border)', flexShrink: 0,
}
const titleStyle = {
  fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)',
  fontFamily: "'Playfair Display', serif",
}
const body = {
  padding: '22px', overflowY: 'auto', flex: 1,
}
const footerStyle = {
  padding: '14px 22px', borderTop: '1px solid var(--border)',
  display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0,
}
