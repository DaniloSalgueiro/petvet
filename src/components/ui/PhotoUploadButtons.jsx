import { useRef } from 'react'
import { FolderOpen, Camera } from 'lucide-react'

const isMobileDevice = () => /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)

export default function PhotoUploadButtons({ onFile, hasPhoto, label = 'foto' }) {
  const fileRef = useRef(null)
  const cameraRef = useRef(null)
  const mobile = isMobileDevice()

  function handleChange(e) {
    const file = e.target.files[0]
    if (!file) return
    onFile(file)
    e.target.value = ''
  }

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      {mobile && (
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleChange}
        />
      )}

      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => fileRef.current?.click()}
      >
        <FolderOpen size={13} /> {hasPhoto ? `Trocar ${label}` : `Escolher ${label}`}
      </button>

      {mobile && (
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => cameraRef.current?.click()}
        >
          <Camera size={13} /> Tirar foto
        </button>
      )}
    </div>
  )
}
