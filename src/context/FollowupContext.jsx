import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

export const DEFAULT_FOLLOWUP_CONFIG = {
  ativo: false,
  tempoMinutos: 60,
  linksGoogle: [],
  linksInstagram: [],
  mensagemModelo:
    'Olá {tutor}! 🐾 Esperamos que {pet} esteja bem após a consulta de hoje na {clinica}!\n\n' +
    'Ficamos muito felizes em atender vocês. Se puder, deixe sua avaliação no Google — ajuda muito:\n' +
    '⭐ {links_google}\n\n' +
    'Siga também nossas redes sociais para dicas e novidades:\n' +
    '📸 {links_instagram}\n\n' +
    'Qualquer dúvida estamos à disposição! 🐾',
  somAtivo: true,
}

const QUEUE_KEY  = 'petvet-followup-queue'
const CONFIG_KEY = 'petvet-followup-config'

function readConfig() {
  try { return { ...DEFAULT_FOLLOWUP_CONFIG, ...JSON.parse(localStorage.getItem(CONFIG_KEY) ?? '{}') } }
  catch { return { ...DEFAULT_FOLLOWUP_CONFIG } }
}
function readQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') } catch { return [] }
}
function writeQueue(q) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)) }

function getPetsList() {
  try { return JSON.parse(localStorage.getItem('petvet-pets') ?? 'null') } catch { return null }
}
function getTutoresList() {
  try { return JSON.parse(localStorage.getItem('petvet-tutores') ?? 'null') } catch { return null }
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.frequency.value = 880; o.type = 'sine'
    g.gain.setValueAtTime(0.3, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.5)
  } catch {}
}

function cleanPhone(raw) {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  return '55' + digits
}

const FollowupContext = createContext(null)

export function FollowupProvider({ children }) {
  const [pendentes, setPendentes] = useState([])
  const [showPanel, setShowPanel] = useState(false)
  const prevCountRef = useRef(0)

  const checkQueue = useCallback(() => {
    const cfg = readConfig()
    if (!cfg.ativo) { setPendentes([]); return }
    const queue = readQueue()
    const now = Date.now()
    const ready = queue.filter(item => {
      if (item.enviado) return false
      const elapsed = (now - new Date(item.concluidoEm).getTime()) / 60000
      return elapsed >= cfg.tempoMinutos
    })
    const tutores = getTutoresList()
    const petsList = getPetsList()
    const enriched = ready.map(item => ({
      ...item,
      tutorObj: tutores?.find(t => t.id === item.tutorId) ?? null,
      petObj:   petsList?.find(p => p.id === item.petId) ?? null,
    }))
    if (enriched.length > prevCountRef.current && cfg.somAtivo) playBeep()
    prevCountRef.current = enriched.length
    setPendentes(enriched)
  }, [])

  useEffect(() => {
    checkQueue()
    const id = setInterval(checkQueue, 60000)
    return () => clearInterval(id)
  }, [checkQueue])

  function enqueueFollowup(apt) {
    const cfg = readConfig()
    if (!cfg.ativo) return
    const queue = readQueue()
    if (queue.find(q => q.agendamentoId === apt.id)) return
    const entry = {
      agendamentoId: apt.id,
      petId:    apt.petId   ?? null,
      tutorId:  apt.tutorId ?? null,
      petNome:  apt.petNome  || apt.pet   || '',
      tutorNome: apt.tutorNome || apt.tutor || '',
      concluidoEm: new Date().toISOString(),
      enviado:    false,
      enviadoEm:  null,
      enviadoPor: null,
    }
    writeQueue([...queue, entry])
    checkQueue()
  }

  function buildMensagem(item, overrideCfg) {
    const cfg = overrideCfg || readConfig()
    let identidade = {}
    try { identidade = JSON.parse(localStorage.getItem('petvet-identidade') ?? '{}') } catch {}
    const clinica = identidade.nomeP || 'Emporium Vazpet'
    const tutor = item.tutorObj?.nome || item.tutorNome || 'Tutor'
    const pet   = item.petObj?.nome   || item.petNome   || 'Pet'
    const linksGoogle    = (cfg.linksGoogle    || []).join('\n')
    const linksInstagram = (cfg.linksInstagram || []).join('\n')
    return (cfg.mensagemModelo || '')
      .replace(/\{tutor\}/g, tutor)
      .replace(/\{pet\}/g, pet)
      .replace(/\{clinica\}/g, clinica)
      .replace(/\{links_google\}/g, linksGoogle)
      .replace(/\{links_instagram\}/g, linksInstagram)
  }

  function enviarWhatsApp(item, userName) {
    const phone = cleanPhone(item.tutorObj?.telefone || item.tutorObj?.celular || '')
    const url   = `https://wa.me/${phone}?text=${encodeURIComponent(buildMensagem(item))}`
    window.open(url, '_blank')
    const updated = readQueue().map(q =>
      q.agendamentoId === item.agendamentoId
        ? { ...q, enviado: true, enviadoEm: new Date().toISOString(), enviadoPor: userName || 'sistema' }
        : q
    )
    writeQueue(updated)
    setPendentes(p => p.filter(x => x.agendamentoId !== item.agendamentoId))
    prevCountRef.current = Math.max(0, prevCountRef.current - 1)
  }

  function reabrirWhatsApp(item) {
    const phone = cleanPhone(item.tutorObj?.telefone || item.tutorObj?.celular || '')
    const url   = `https://wa.me/${phone}?text=${encodeURIComponent(buildMensagem(item))}`
    window.open(url, '_blank')
  }

  return (
    <FollowupContext.Provider value={{ pendentes, showPanel, setShowPanel, enqueueFollowup, enviarWhatsApp, reabrirWhatsApp, buildMensagem, readQueue, writeQueue, readConfig }}>
      {children}
    </FollowupContext.Provider>
  )
}

export function useFollowup() { return useContext(FollowupContext) }
