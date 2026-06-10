import { useState, useRef, useEffect } from 'react'

export default function CropModal({ src, onSave, onClose, shape = 'circle' }) {
  const SIZE = 280

  const canvasRef = useRef(null)
  const imgRef    = useRef(null)
  const dragging  = useRef(false)
  const startRef  = useRef({ mx: 0, my: 0, ox: 0, oy: 0 })

  const [scale,  setScale]  = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  // FIX 1: calcular zoom inicial para mostrar a imagem inteira — sem auto-save
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      const scaleInicial = Math.min(SIZE / img.naturalWidth, SIZE / img.naturalHeight) * 0.85
      const ox = (SIZE - img.naturalWidth  * scaleInicial) / 2
      const oy = (SIZE - img.naturalHeight * scaleInicial) / 2
      setScale(scaleInicial)
      setOffset({ x: ox, y: oy })
    }
    img.src = src
  }, [src])

  // Redesenhar canvas a cada mudança de escala/posição
  useEffect(() => {
    if (!canvasRef.current || !imgRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    ctx.clearRect(0, 0, SIZE, SIZE)
    ctx.fillStyle = '#888'
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.drawImage(imgRef.current, offset.x, offset.y,
      imgRef.current.naturalWidth * scale, imgRef.current.naturalHeight * scale)
  }, [scale, offset])

  function onDown(e) {
    e.preventDefault()
    dragging.current = true
    const pt = e.touches ? e.touches[0] : e
    startRef.current = { mx: pt.clientX, my: pt.clientY, ox: offset.x, oy: offset.y }
  }

  function onMove(e) {
    if (!dragging.current) return
    e.preventDefault()
    const pt = e.touches ? e.touches[0] : e
    setOffset({
      x: startRef.current.ox + (pt.clientX - startRef.current.mx),
      y: startRef.current.oy + (pt.clientY - startRef.current.my),
    })
  }

  function onUp() { dragging.current = false }

  function handleScaleChange(newScale) {
    // Zoom centrado no meio do canvas (equivale ao transformOrigin: center do CSS)
    const cx = SIZE / 2, cy = SIZE / 2
    const ratio = newScale / scale
    setOffset(o => ({
      x: cx - (cx - o.x) * ratio,
      y: cy - (cy - o.y) * ratio,
    }))
    setScale(newScale)
  }

  // FIX 2: salvar APENAS aqui — nenhum outro lugar chama onSave
  function handleSave() {
    if (!imgRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.drawImage(imgRef.current, offset.x, offset.y,
      imgRef.current.naturalWidth * scale, imgRef.current.naturalHeight * scale)
    onSave(canvas.toDataURL('image/jpeg', 0.87))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, width: 360, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: 'var(--shadow-lg)' }}>
        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Ajustar Foto</h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>Arraste para reposicionar e use o controle para zoom.</p>

        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          style={{ borderRadius: shape === 'circle' ? '50%' : '12px', border: '3px solid var(--teal)', cursor: 'grab', alignSelf: 'center', display: 'block', touchAction: 'none', userSelect: 'none' }}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', minWidth: 36 }}>Zoom</span>
          <input type="range" min="0.1" max="3" step="0.05" value={scale}
            onChange={e => handleScaleChange(+e.target.value)}
            style={{ flex: 1, accentColor: 'var(--teal)' }} />
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
