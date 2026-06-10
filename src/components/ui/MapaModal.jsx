import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import Modal from './Modal'
import { montarEnderecoMapa } from '../../utils/endereco'

const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
const isAndroid = typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent)

export default function MapaModal({ endereco, onClose }) {
  const [copied, setCopied] = useState(false)
  const enderecoFormatado = montarEnderecoMapa(endereco)
  const encoded = encodeURIComponent(enderecoFormatado)

  const opcoes = [
    {
      id: 'google', label: 'Google Maps', icon: '🗺️',
      url: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
      destaque: !isIOS,
    },
    {
      id: 'waze', label: 'Waze', icon: '🚗',
      url: `https://waze.com/ul?q=${encoded}&navigate=yes`,
      destaque: isAndroid,
    },
    {
      id: 'apple', label: 'Apple Maps', icon: '🍎',
      url: isIOS ? `maps://maps.apple.com/?q=${encoded}&address=${encoded}` : `https://maps.apple.com/?q=${encoded}`,
      destaque: isIOS,
    },
  ]

  async function copiarEndereco() {
    try {
      await navigator.clipboard.writeText(enderecoFormatado)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard indisponível (HTTP, permissões) — ignora silenciosamente
    }
  }

  return (
    <Modal isOpen={!!endereco} onClose={onClose} title="📍 Abrir endereço no mapa" size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
          {enderecoFormatado}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opcoes.map(o => (
            <button key={o.id}
              className={o.destaque ? 'btn btn-primary' : 'btn btn-outline'}
              style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start', fontSize: '0.9rem', padding: '12px 16px' }}
              onClick={() => window.open(o.url, '_blank')}>
              <span style={{ fontSize: '1.2rem' }}>{o.icon}</span>
              {o.label}
              {o.destaque && <span style={{ marginLeft: 'auto', fontSize: '0.7rem', opacity: 0.85 }}>Recomendado</span>}
            </button>
          ))}
        </div>

        <button className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={copiarEndereco}>
          {copied ? <Check size={15} style={{ color: 'var(--success)' }} /> : <Copy size={15} />}
          {copied ? 'Endereço copiado!' : 'Copiar endereço'}
        </button>
      </div>
    </Modal>
  )
}
