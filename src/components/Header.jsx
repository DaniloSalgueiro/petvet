import { useEffect, useRef } from 'react'
import { Sun, Moon, Bell, X, MessageCircle } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useFollowup } from '../context/FollowupContext'
import { useAuth } from '../context/AuthContext'

const PAGE_TITLES = {
  dashboard:  'Dashboard',
  pets:       'Pets & Tutores',
  prontuario: 'Prontuário',
  agenda:     'Agenda',
  estoque:    'Estoque',
  servicos:   'Serviços',
  financeiro: 'Financeiro',
  usuarios:   'Gestão de Usuários',
}

function elapsed(isoStr) {
  const ms = Date.now() - new Date(isoStr).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min} min atrás`
  const h = Math.floor(min / 60)
  return `${h}h${min % 60 > 0 ? ` ${min % 60}min` : ''} atrás`
}

export default function Header({ currentPage, actions }) {
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()
  const { pendentes, showPanel, setShowPanel, enviarWhatsApp } = useFollowup()
  const panelRef = useRef(null)

  useEffect(() => {
    if (!showPanel) return
    function onClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setShowPanel(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [showPanel, setShowPanel])

  return (
    <header className="top-header">
      <h1 className="header-title">{PAGE_TITLES[currentPage] ?? ''}</h1>

      <div className="header-actions">
        {actions}

        <div style={{ position: 'relative' }} ref={panelRef}>
          <button
            className="btn btn-ghost btn-icon"
            title="Notificações de follow-up"
            onClick={() => setShowPanel(v => !v)}
            style={{ position: 'relative' }}
          >
            <Bell size={18} />
            {pendentes.length > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2,
                width: 16, height: 16, borderRadius: '50%',
                background: 'var(--danger, #e53e3e)',
                color: '#fff', fontSize: '0.625rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1, pointerEvents: 'none',
              }}>
                {pendentes.length > 9 ? '9+' : pendentes.length}
              </span>
            )}
          </button>

          {showPanel && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 1200,
              width: 340, maxHeight: 480,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, boxShadow: 'var(--shadow-lg, 0 8px 32px rgba(0,0,0,.18))',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}>
              {/* Header do painel */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderBottom: '1px solid var(--border)',
                flexShrink: 0,
              }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Follow-ups Pendentes
                  {pendentes.length > 0 && (
                    <span style={{
                      marginLeft: 8, background: 'var(--danger, #e53e3e)', color: '#fff',
                      borderRadius: 10, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700,
                    }}>{pendentes.length}</span>
                  )}
                </span>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowPanel(false)} style={{ padding: 4 }}>
                  <X size={16} />
                </button>
              </div>

              {/* Lista */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {pendentes.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    Nenhum follow-up pendente
                  </div>
                ) : pendentes.map(item => {
                  const tutor = item.tutorObj
                  const pet   = item.petObj
                  const petNome  = pet?.nome  || item.petNome  || '—'
                  const tutorNome = tutor?.nome || item.tutorNome || '—'
                  const telefone  = tutor?.telefone || tutor?.celular || ''
                  return (
                    <div key={item.agendamentoId} style={{
                      padding: '12px 16px', borderBottom: '1px solid var(--border)',
                      display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {pet?.foto ? (
                          <img src={pet.foto} alt={petNome} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{
                            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                            background: 'var(--teal-light)', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', color: 'var(--teal)', fontWeight: 700, fontSize: '1rem',
                          }}>
                            {petNome[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {petNome}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Tutor: {tutorNome}
                            {telefone && <span style={{ marginLeft: 6, fontFamily: 'monospace' }}>{telefone}</span>}
                          </div>
                          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                            Concluído {elapsed(item.concluidoEm)}
                          </div>
                        </div>
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ alignSelf: 'flex-end', gap: 6 }}
                        onClick={() => enviarWhatsApp(item, user?.name)}
                      >
                        <MessageCircle size={14} /> Enviar WhatsApp
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <button
          className="btn btn-ghost btn-icon"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </header>
  )
}
