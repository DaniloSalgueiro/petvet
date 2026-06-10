import { useState, useRef, useEffect, useCallback } from 'react'
import Modal from './ui/Modal'
import { detectarAutorizacao, processarTranscricao } from '../utils/voiceCommands'

const SpeechRecognitionAPI = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null
const SUPPORTS_SPEECH = !!SpeechRecognitionAPI
const SUPPORTS_MEDIA_RECORDER = typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined'

const QUALIDADE_BITRATE = { baixa: 32000, media: 64000, alta: 128000 }

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function dataAtualFormatada() {
  const d = new Date()
  return d.toLocaleDateString('pt-BR').replace(/\//g, '-') + '_' + d.toLocaleTimeString('pt-BR').replace(/:/g, '-')
}

/**
 * Componente de gravação e transcrição de consulta veterinária.
 *
 * Fluxo: idle -> aguardando_autorizacao -> gravando <-> pausado -> (finaliza -> idle)
 */
export default function GravacaoConsulta({
  disabled,
  tutorNome,
  comandosVoz,
  settings,
  onComando,
  onTranscricao,
  onAddAnexo,
}) {
  const [estado, setEstado] = useState('idle')
  const [tempo, setTempo] = useState(0)
  const [ultimaFrase, setUltimaFrase] = useState('')
  const [autSegundos, setAutSegundos] = useState(30)
  const [aviso, setAviso] = useState(null)

  const estadoRef = useRef(estado)
  useEffect(() => { estadoRef.current = estado }, [estado])

  const recognitionRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const autTimerRef = useRef(null)
  const finalizarRef = useRef(null)

  useEffect(() => () => limparTudo(), []) // eslint-disable-line react-hooks/exhaustive-deps

  function limparTudo() {
    clearInterval(timerRef.current)
    clearInterval(autTimerRef.current)
    try { recognitionRef.current?.abort() } catch { /* ignore */ }
    recognitionRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    try { audioCtxRef.current?.close() } catch { /* ignore */ }
    audioCtxRef.current = null
  }

  function montarStreamGravacao(micStream) {
    const sensibilidade = Number(settings?.sensibilidade) || 1
    if (sensibilidade === 1 || typeof window.AudioContext === 'undefined') return micStream
    try {
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(micStream)
      const gain = ctx.createGain()
      gain.gain.value = sensibilidade
      const dest = ctx.createMediaStreamDestination()
      source.connect(gain)
      gain.connect(dest)
      audioCtxRef.current = ctx
      return dest.stream
    } catch {
      return micStream
    }
  }

  function criarMediaRecorder(stream) {
    if (!SUPPORTS_MEDIA_RECORDER) return null
    const bitrate = QUALIDADE_BITRATE[settings?.qualidadeAudio] ?? QUALIDADE_BITRATE.media
    let mr
    try {
      mr = new MediaRecorder(stream, { mimeType: 'audio/webm', audioBitsPerSecond: bitrate })
    } catch {
      mr = new MediaRecorder(stream)
    }
    chunksRef.current = []
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    return mr
  }

  function pegarBlobAtual(mimeType) {
    const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
    chunksRef.current = []
    return blob
  }

  function criarReconhecimento() {
    if (!SUPPORTS_SPEECH) return null
    const rec = new SpeechRecognitionAPI()
    rec.lang = settings?.idioma || 'pt-BR'
    rec.continuous = true
    rec.interimResults = true
    return rec
  }

  // ---- FASE 1: solicitar microfone e iniciar autorização ----
  async function iniciarGravacao() {
    if (disabled) return
    setAviso(null)
    let micStream
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setAviso('Não foi possível acessar o microfone. Verifique as permissões do navegador.')
      return
    }
    streamRef.current = micStream

    if (!SUPPORTS_SPEECH) {
      setAviso('Seu navegador não suporta reconhecimento de voz. Use o Chrome para esta função. A gravação de áudio continua disponível, sem transcrição automática.')
      iniciarGravacaoPrincipal(micStream)
      return
    }

    iniciarFaseAutorizacao(micStream)
  }

  function iniciarFaseAutorizacao(micStream) {
    setEstado('aguardando_autorizacao')
    setAutSegundos(30)

    const recStream = montarStreamGravacao(micStream)
    const mr = criarMediaRecorder(recStream)
    mediaRecorderRef.current = mr
    mr?.start()

    const rec = criarReconhecimento()
    recognitionRef.current = rec
    if (rec) {
      rec.onresult = e => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (!e.results[i].isFinal) continue
          const texto = e.results[i][0].transcript
          const status = detectarAutorizacao(texto)
          if (status === 'autorizado') {
            confirmarAutorizacao(true)
          } else if (status === 'negado') {
            confirmarAutorizacao(false)
          }
        }
      }
      rec.onend = () => {
        if (estadoRef.current === 'aguardando_autorizacao') {
          try { rec.start() } catch { /* já iniciado */ }
        }
      }
      rec.onerror = () => { /* ignora e deixa onend reiniciar */ }
      try { rec.start() } catch { /* ignore */ }
    }

    autTimerRef.current = setInterval(() => {
      setAutSegundos(s => {
        if (s <= 1) {
          confirmarAutorizacao(false, 'Tempo esgotado para autorização.')
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  async function confirmarAutorizacao(autorizado, motivo) {
    if (estadoRef.current !== 'aguardando_autorizacao') return
    clearInterval(autTimerRef.current)
    try { recognitionRef.current?.abort() } catch { /* ignore */ }
    recognitionRef.current = null

    const mr = mediaRecorderRef.current
    const mimeType = mr?.mimeType
    await new Promise(resolve => {
      if (!mr || mr.state === 'inactive') return resolve()
      mr.onstop = resolve
      mr.stop()
    })

    if (!autorizado) {
      const blob = chunksRef.current.length ? pegarBlobAtual(mimeType) : null
      limparTudo()
      setEstado('idle')
      setAviso(motivo || 'Gravação não autorizada pelo tutor. A gravação foi interrompida.')
      void blob // descarta áudio de uma autorização negada
      return
    }

    // Salva o áudio da fase de autorização
    const blob = pegarBlobAtual(mimeType)
    if (blob.size > 0) {
      try {
        const dataUrl = await blobToDataUrl(blob)
        onAddAnexo?.({
          id: `ax${Date.now()}${Math.random().toString(36).slice(2)}`,
          nome: `Autorização_tutor_${dataAtualFormatada()}.webm`,
          tipo: blob.type || 'audio/webm',
          tamanho: blob.size,
          dataAdicionado: new Date().toISOString(),
          dataUrl,
        })
      } catch { /* ignore */ }
    }

    iniciarGravacaoPrincipal(streamRef.current)
  }

  // ---- FASE 2: gravação principal ----
  function iniciarGravacaoPrincipal(micStream) {
    setEstado('gravando')
    setTempo(0)
    setUltimaFrase('')

    const recStream = montarStreamGravacao(micStream)
    const mr = criarMediaRecorder(recStream)
    mediaRecorderRef.current = mr
    mr?.start()

    iniciarReconhecimentoPrincipal()

    timerRef.current = setInterval(() => setTempo(t => t + 1), 1000)
  }

  function iniciarReconhecimentoPrincipal() {
    if (!SUPPORTS_SPEECH) return
    const rec = criarReconhecimento()
    recognitionRef.current = rec
    rec.onresult = e => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const texto = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          processarFraseFinal(texto)
        } else {
          interim += texto
        }
      }
      if (interim) setUltimaFrase(interim.trim().slice(-50))
    }
    rec.onend = () => {
      if (estadoRef.current === 'gravando') {
        try { rec.start() } catch { /* já iniciado */ }
      }
    }
    rec.onerror = () => { /* ignora e deixa onend reiniciar */ }
    try { rec.start() } catch { /* ignore */ }
  }

  function processarFraseFinal(texto) {
    const limpo = texto.trim()
    if (!limpo) return
    setUltimaFrase(limpo.slice(-50))
    onTranscricao?.(limpo)

    const comandos = processarTranscricao(limpo, comandosVoz)
    for (const cmd of comandos) onComando?.(cmd)
  }

  function pausar() {
    if (estadoRef.current !== 'gravando') return
    clearInterval(timerRef.current)
    try { recognitionRef.current?.abort() } catch { /* ignore */ }
    recognitionRef.current = null
    try { mediaRecorderRef.current?.pause() } catch { /* ignore */ }
    setEstado('pausado')
  }

  function continuarGravacao() {
    if (estadoRef.current !== 'pausado') return
    setEstado('gravando')
    try { mediaRecorderRef.current?.resume() } catch { /* ignore */ }
    iniciarReconhecimentoPrincipal()
    timerRef.current = setInterval(() => setTempo(t => t + 1), 1000)
  }

  async function finalizarGravacao() {
    clearInterval(timerRef.current)
    clearInterval(autTimerRef.current)
    try { recognitionRef.current?.abort() } catch { /* ignore */ }
    recognitionRef.current = null

    const mr = mediaRecorderRef.current
    const mimeType = mr?.mimeType
    await new Promise(resolve => {
      if (!mr || mr.state === 'inactive') return resolve()
      mr.onstop = resolve
      try { mr.stop() } catch { resolve() }
    })

    const blob = chunksRef.current.length ? pegarBlobAtual(mimeType) : null
    if (blob && blob.size > 0 && (settings?.salvarAudioAuto ?? true)) {
      try {
        const dataUrl = await blobToDataUrl(blob)
        onAddAnexo?.({
          id: `ax${Date.now()}${Math.random().toString(36).slice(2)}`,
          nome: `Gravacao_consulta_${dataAtualFormatada()}.webm`,
          tipo: blob.type || 'audio/webm',
          tamanho: blob.size,
          dataAdicionado: new Date().toISOString(),
          dataUrl,
        })
      } catch { /* ignore */ }
    }

    limparTudo()
    setEstado('idle')
    setTempo(0)
    setUltimaFrase('')
  }
  finalizarRef.current = finalizarGravacao

  function cancelarAutorizacao() {
    confirmarAutorizacao(false, 'Gravação cancelada.')
  }

  if (disabled) return null

  return (
    <div>
      {estado === 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" className="btn btn-outline" onClick={iniciarGravacao}>
            🎤 Iniciar gravação
          </button>
          {aviso && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--warning)', margin: 0 }}>{aviso}</p>
          )}
          {!SUPPORTS_MEDIA_RECORDER && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--danger)', margin: 0 }}>
              Este navegador não suporta gravação de áudio.
            </p>
          )}
        </div>
      )}

      {/* Modal de autorização do tutor */}
      <Modal
        isOpen={estado === 'aguardando_autorizacao'}
        onClose={cancelarAutorizacao}
        title="🎙️ Autorização de gravação"
        size="sm"
        closeOnOverlay={false}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Peça ao tutor:
          </p>
          <p style={{ fontSize: '1rem', fontStyle: 'italic', padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 8 }}>
            "{tutorNome ? `${tutorNome}, ` : ''}você autoriza a gravação desta consulta?"
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Aguardando resposta do tutor... <strong>{autSegundos}s</strong>
          </p>
          {!SUPPORTS_SPEECH && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--warning)' }}>
              Reconhecimento de voz indisponível — confirme manualmente.
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={cancelarAutorizacao}>Cancelar</button>
            {!SUPPORTS_SPEECH && (
              <button className="btn btn-primary" onClick={() => confirmarAutorizacao(true)}>Tutor autorizou</button>
            )}
          </div>
        </div>
      </Modal>

      {/* Barra flutuante de gravação ativa */}
      {(estado === 'gravando' || estado === 'pausado') && (
        <div style={{
          position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1300,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
          boxShadow: 'var(--shadow-lg)', padding: '10px 18px', display: 'flex', alignItems: 'center',
          gap: 14, maxWidth: '94vw', flexWrap: 'wrap',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: estado === 'gravando' ? 'var(--danger)' : 'var(--text-muted)', fontSize: '0.8125rem' }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: estado === 'gravando' ? 'var(--danger)' : 'var(--text-muted)',
              animation: estado === 'gravando' ? 'petvet-pulse 1s infinite' : 'none',
            }} />
            {estado === 'gravando' ? '● REC' : '⏸ PAUSADO'}
          </span>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: '0.9rem' }}>{formatDuration(tempo)}</span>
          {ultimaFrase && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              "{ultimaFrase}"
            </span>
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            {estado === 'gravando'
              ? <button type="button" className="btn btn-outline btn-sm" onClick={pausar}>⏸ Pausar</button>
              : <button type="button" className="btn btn-outline btn-sm" onClick={continuarGravacao}>▶ Continuar</button>}
            <button type="button" className="btn btn-primary btn-sm" onClick={finalizarGravacao}>⏹ Finalizar</button>
          </div>
        </div>
      )}
    </div>
  )
}

export { SUPPORTS_SPEECH, SUPPORTS_MEDIA_RECORDER }
