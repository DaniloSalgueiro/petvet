import { useState, useRef } from 'react'

export default function CropModal({ src, onSave, onClose, shape = 'circle' }) {
  const SIZE = 280
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const startRef = useRef({ mx: 0, my: 0, px: 0, py: 0 })

  function onDown(e) {
    e.preventDefault()
    dragging.current = true
    const pt = e.touches ? e.touches[0] : e
    startRef.current = { mx: pt.clientX, my: pt.clientY, px: pos.x, py: pos.y }
  }
  function onMove(e) {
    if (!dragging.current) return
    e.preventDefault()
    const pt = e.touches ? e.touches[0] : e
    setPos({ x: startRef.current.px + (pt.clientX - startRef.current.mx), y: startRef.current.py + (pt.clientY - startRef.current.my) })
  }
  function onUp() { dragging.current = false }

  function handleSave() {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = SIZE; canvas.height = SIZE
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, SIZE, SIZE)
      const sf = Math.max(SIZE / img.naturalWidth, SIZE / img.naturalHeight)
      ctx.save()
      ctx.translate(SIZE / 2 + pos.x, SIZE / 2 + pos.y)
      ctx.scale(scale, scale)
      ctx.drawImage(img, -img.naturalWidth * sf / 2, -img.naturalHeight * sf / 2, img.naturalWidth * sf, img.naturalHeight * sf)
      ctx.restore()
      onSave(canvas.toDataURL('image/jpeg', 0.87))
    }
    img.src = src
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, width: 360, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: 'var(--shadow-lg)' }}>
        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Ajustar Foto</h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>Arraste para reposicionar e use o controle para zoom.</p>
        <div style={{ width: SIZE, height: SIZE, overflow: 'hidden', borderRadius: shape === 'circle' ? '50%' : '12px', border: '3px solid var(--teal)', cursor: 'grab', position: 'relative', alignSelf: 'center', background: 'var(--surface-2)', userSelect: 'none' }}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}>
          <img src={src} alt="crop" draggable={false}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover',
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, transformOrigin: 'center', pointerEvents: 'none' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', minWidth: 36 }}>Zoom</span>
          <input type="range" min="0.8" max="3" step="0.05" value={scale} onChange={e => setScale(+e.target.value)} style={{ flex: 1, accentColor: 'var(--teal)' }} />
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>{Math.round(scale * 100)}%</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>Salvar foto</button>
        </div>
      </div>
    </div>
  )
}
