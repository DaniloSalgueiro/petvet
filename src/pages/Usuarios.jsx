import { useState } from 'react'
import { Plus, Shield, Clock, Trash2, RotateCcw } from 'lucide-react'
import { maskCPF, maskPhone } from '../utils/masks'
import Modal from '../components/ui/Modal'
import ConfirmModal from '../components/ui/ConfirmModal'
import Tabs from '../components/ui/Tabs'
import { USUARIOS, ATIVIDADES, getUserById } from '../data/mock'
import { useAuth, markUserDeleted } from '../context/AuthContext'
import { usePersistentState } from '../hooks/usePersistentState'

const ROLE_CONFIG = {
  admin:       { label: 'Administrador', color: 'magenta' },
  veterinario: { label: 'Veterinário',   color: 'teal' },
  atendente:   { label: 'Atendente',     color: 'neutral' },
}

const MODULE_LABELS = {
  dashboard:           'Dashboard',
  pets:                'Pets & Tutores',
  prontuario:          'Prontuário',
  agenda:              'Agenda',
  estoque:             'Estoque',
  servicos:            'Serviços',
  financeiro:          'Financeiro',
  relatorios:          'Relatórios',
  bulario:             'Bulário',
  usuarios:            'Usuários',
  funcionarios:        'Funcionários',
  racas:               'Raças',
  'prontuario-config': 'Config. Prontuário',
  configuracoes:       'Configurações',
  followup:            'Follow-up',
}

const P = (view, edit, del) => ({ view, edit, delete: del })
const DEFAULT_PERMISSIONS = {
  admin: Object.fromEntries(Object.keys(MODULE_LABELS).map(m => [m, P(true, true, true)])),
  veterinario: {
    dashboard:           P(true,  false, false),
    pets:                P(true,  true,  false),
    prontuario:          P(true,  true,  false),
    agenda:              P(true,  true,  false),
    estoque:             P(true,  false, false),
    servicos:            P(true,  false, false),
    financeiro:          P(false, false, false),
    relatorios:          P(true,  false, false),
    bulario:             P(true,  true,  false),
    usuarios:            P(false, false, false),
    funcionarios:        P(false, false, false),
    racas:               P(false, false, false),
    'prontuario-config': P(false, false, false),
    configuracoes:       P(false, false, false),
    followup:            P(false, false, false),
  },
  atendente: {
    dashboard:           P(true,  false, false),
    pets:                P(true,  true,  false),
    prontuario:          P(false, false, false),
    agenda:              P(true,  true,  false),
    estoque:             P(true,  true,  false),
    servicos:            P(true,  true,  false),
    financeiro:          P(false, false, false),
    relatorios:          P(false, false, false),
    bulario:             P(false, false, false),
    usuarios:            P(false, false, false),
    funcionarios:        P(false, false, false),
    racas:               P(false, false, false),
    'prontuario-config': P(false, false, false),
    configuracoes:       P(false, false, false),
    followup:            P(false, false, false),
  },
}

const EMPTY_USER = {
  name: '', email: '', role: 'atendente', cpf: '', phone: '', crmv: '', mapa: '', active: true,
  permissions: { ...DEFAULT_PERMISSIONS.atendente },
}

const EMPTY_PROFILE = {
  name: '',
  permissions: { ...DEFAULT_PERMISSIONS.atendente },
}

export default function UsuariosPage() {
  const { user: currentUser, hasRole, hasPermission, resetPassword } = useAuth()

  if (!hasPermission('usuarios', 'view')) {
    return (
      <div className="page">
        <div className="page-header">
          <h2 className="page-title">Gestão de Usuários</h2>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '64px 24px' }}>
          <Shield size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
          <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Acesso restrito</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 6 }}>
            Você não tem permissão para acessar este módulo.
          </p>
        </div>
      </div>
    )
  }

  const [usuarios, setUsuarios] = usePersistentState('petvet-usuarios', USUARIOS)
  const [perfis, setPerfis] = usePersistentState('petvet-perfis', [])
  const [atividades] = useState(ATIVIDADES)
  const [activeTab, setActiveTab] = useState('usuarios')

  // User modal state
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_USER)
  const [formError, setFormError] = useState('')
  const [selectedProfile, setSelectedProfile] = useState('')
  const [selectedUserForLog, setSelectedUserForLog] = useState(null)

  // Reset senha modal
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)

  // Delete user modal
  const [deleteTarget, setDeleteTarget] = useState(null)

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [editingProfile, setEditingProfile] = useState(null)
  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE)
  const [deleteProfileTarget, setDeleteProfileTarget] = useState(null)

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY_USER, permissions: { ...DEFAULT_PERMISSIONS.atendente } })
    setSelectedProfile('')
    setFormError('')
    setShowModal(true)
  }

  function openEdit(u) {
    setEditing(u)
    setForm({ ...u })
    setSelectedProfile('')
    setFormError('')
    setShowModal(true)
  }

  function save() {
    if (!form.name || !form.email) { setFormError('Nome e e-mail são obrigatórios.'); return }
    const dupEmail = usuarios.find(u => u.id !== editing?.id && u.email.toLowerCase() === form.email.toLowerCase())
    if (dupEmail) { setFormError(`Já existe um usuário com o e-mail "${form.email}".`); return }
    const sort = arr => [...arr].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    if (editing) {
      setUsuarios(prev => sort(prev.map(u => u.id === editing.id
        ? { ...form, id: editing.id, initials: initials(form.name) }
        : u)))
    } else {
      setUsuarios(prev => sort([...prev, {
        ...form, id: `u${Date.now()}`, initials: initials(form.name), lastLogin: null,
      }]))
    }
    setShowModal(false)
  }

  function toggleActive(id) {
    setUsuarios(prev => prev.map(u => u.id === id ? { ...u, active: !u.active } : u))
  }

  function applyRoleDefaults(role) {
    setForm(f => ({ ...f, role, permissions: { ...DEFAULT_PERMISSIONS[role] } }))
    setSelectedProfile('')
  }

  function applyProfile(profileId) {
    setSelectedProfile(profileId)
    if (!profileId) return
    const p = perfis.find(p => p.id === profileId)
    if (p) setForm(f => ({ ...f, permissions: { ...p.permissions } }))
  }

  function getPerm(mod, level) {
    const p = form.permissions[mod]
    if (!p || typeof p === 'boolean') return level === 'view' ? !!p : false
    return p[level] ?? false
  }

  function setPermLevel(mod, level, val) {
    if (form.role === 'admin') return
    setSelectedProfile('')
    setForm(f => {
      const cur = f.permissions[mod]
      const curObj = (!cur || typeof cur === 'boolean') ? { view: !!cur, edit: false, delete: false } : cur
      return { ...f, permissions: { ...f.permissions, [mod]: { ...curObj, [level]: val } } }
    })
  }

  function openResetSenha(u) { setResetTarget(u); setShowResetModal(true) }

  function confirmReset() {
    if (resetTarget) resetPassword(resetTarget.id)
    setShowResetModal(false)
    setResetTarget(null)
  }

  // Profile CRUD
  function openAddProfile() {
    setEditingProfile(null)
    setProfileForm({ ...EMPTY_PROFILE, permissions: { ...DEFAULT_PERMISSIONS.atendente } })
    setShowProfileModal(true)
  }

  function openEditProfile(p) {
    setEditingProfile(p)
    setProfileForm({ ...p })
    setShowProfileModal(true)
  }

  function saveProfile() {
    if (!profileForm.name.trim()) return
    if (editingProfile) {
      setPerfis(prev => prev.map(p => p.id === editingProfile.id ? { ...profileForm, id: editingProfile.id } : p))
    } else {
      setPerfis(prev => [...prev, { ...profileForm, id: `pf${Date.now()}` }])
    }
    setShowProfileModal(false)
  }

  function getProfilePerm(mod, level) {
    const p = profileForm.permissions[mod]
    if (!p || typeof p === 'boolean') return level === 'view' ? !!p : false
    return p[level] ?? false
  }

  function setProfilePermLevel(mod, level, val) {
    setProfileForm(f => {
      const cur = f.permissions[mod]
      const curObj = (!cur || typeof cur === 'boolean') ? { view: !!cur, edit: false, delete: false } : cur
      return { ...f, permissions: { ...f.permissions, [mod]: { ...curObj, [level]: val } } }
    })
  }

  const userAtividades = selectedUserForLog
    ? atividades.filter(a => a.userId === selectedUserForLog).sort((a, b) => b.date.localeCompare(a.date))
    : []

  const tabs = [
    { id: 'usuarios',   label: 'Usuários',               count: usuarios.length },
    { id: 'perfis',     label: 'Perfis',                  count: perfis.length },
    { id: 'atividades', label: 'Histórico de Atividades', count: atividades.length },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Gestão de Usuários</h2>
          <p className="page-subtitle">{usuarios.filter(u => u.active).length} usuários ativos</p>
        </div>
        {activeTab === 'usuarios' && (
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Novo Usuário</button>
        )}
        {activeTab === 'perfis' && (
          <button className="btn btn-primary" onClick={openAddProfile}><Plus size={16} /> Novo Perfil</button>
        )}
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* LISTA DE USUÁRIOS */}
      {activeTab === 'usuarios' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...usuarios].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(u => {
            const roleCfg = ROLE_CONFIG[u.role]
            return (
              <div key={u.id} className={`card user-card${u.active ? '' : ' inactive'}`}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: u.active ? 'linear-gradient(135deg, var(--teal), var(--magenta))' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: u.active ? '#fff' : 'var(--text-muted)', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0 }}>
                  {u.initials}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{u.name}</span>
                    <span className={`badge badge-${roleCfg.color}`}>{roleCfg.label}</span>
                    {!u.active && <span className="badge badge-danger">Inativo</span>}
                    {u.crmv && <span className="badge badge-neutral">CRMV {u.crmv}</span>}
                    {u.mapa && <span className="badge badge-neutral">MAPA {u.mapa}</span>}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 3 }}>
                    {u.email}
                    {u.lastLogin && ` · Último acesso: ${new Date(u.lastLogin).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                    {Object.entries(u.permissions).filter(([, v]) => {
                      if (!v || typeof v === 'boolean') return !!v
                      return v.view || v.edit || v.delete
                    }).map(([mod]) => (
                      <span key={mod} style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: 99, background: 'var(--teal-light)', color: 'var(--teal-dark)', fontWeight: 600 }}>
                        {MODULE_LABELS[mod]}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="user-card-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedUserForLog(u.id); setActiveTab('atividades') }} title="Ver histórico">
                    <Clock size={15} />
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => openEdit(u)}>Editar</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => openResetSenha(u)} title="Resetar senha para 123456" style={{ color: 'var(--text-muted)' }}>
                    <RotateCcw size={15} />
                  </button>
                  {u.id !== currentUser?.id && (
                    <>
                      <button
                        className={u.active ? 'btn btn-outline-danger btn-sm' : 'btn btn-outline btn-sm'}
                        onClick={() => toggleActive(u.id)}
                      >
                        {u.active ? 'Desativar' : 'Reativar'}
                      </button>
                      <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setDeleteTarget(u)} title="Excluir usuário">
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* PERFIS */}
      {activeTab === 'perfis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {perfis.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
              <Shield size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ fontSize: '0.875rem' }}>Nenhum perfil criado. Clique em "Novo Perfil" para começar.</p>
            </div>
          )}
          {perfis.map(p => (
            <div key={p.id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{p.name}</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                  {Object.entries(p.permissions).filter(([, v]) => {
                    if (!v || typeof v === 'boolean') return !!v
                    return v.view || v.edit || v.delete
                  }).map(([mod]) => (
                    <span key={mod} style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: 99, background: 'var(--teal-light)', color: 'var(--teal-dark)', fontWeight: 600 }}>
                      {MODULE_LABELS[mod]}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="btn btn-outline btn-sm" onClick={() => openEditProfile(p)}>Editar</button>
                <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setDeleteProfileTarget(p)} title="Excluir perfil">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* HISTÓRICO */}
      {activeTab === 'atividades' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="form-select" style={{ maxWidth: 220 }} value={selectedUserForLog ?? ''} onChange={e => setSelectedUserForLog(e.target.value || null)}>
              <option value="">Todos os usuários</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            {selectedUserForLog && (
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedUserForLog(null)}>Limpar filtro</button>
            )}
          </div>

          <div className="table-wrapper">
            <table>
              <thead><tr><th>Data / Hora</th><th>Usuário</th><th>Módulo</th><th>Ação</th></tr></thead>
              <tbody>
                {(selectedUserForLog ? userAtividades : [...atividades].sort((a, b) => b.date.localeCompare(a.date))).map(at => {
                  const u = getUserById(at.userId)
                  return (
                    <tr key={at.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        {new Date(at.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg, var(--teal), var(--magenta))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.65rem', fontWeight: 800, flexShrink: 0 }}>
                            {u?.initials}
                          </div>
                          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{u?.name ?? '—'}</span>
                        </div>
                      </td>
                      <td><span className="badge badge-teal" style={{ fontSize: '0.7rem' }}>{at.module}</span></td>
                      <td style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{at.action}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Criar/Editar Usuário */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Usuário' : 'Novo Usuário'} size="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={save}>Salvar</button>
          </>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {formError && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fff5f5', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '0.875rem', fontWeight: 500 }}>
              {formError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Nome completo *</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">E-mail *</label>
              <input type="email" className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">CPF</label>
              <input className="form-input" value={form.cpf ?? ''} onChange={e => setForm(f => ({ ...f, cpf: maskCPF(e.target.value) }))} placeholder="000.000.000-00" />
            </div>
            <div className="form-group">
              <label className="form-label">Telefone</label>
              <input className="form-input" value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: maskPhone(e.target.value) }))} placeholder="(11) 99999-9999" />
            </div>
            <div className="form-group">
              <label className="form-label">Perfil</label>
              <select className="form-select" value={form.role} onChange={e => applyRoleDefaults(e.target.value)}>
                <option value="admin">Administrador</option>
                <option value="veterinario">Veterinário</option>
                <option value="atendente">Atendente</option>
              </select>
            </div>
            {form.role === 'veterinario' && (
              <>
                <div className="form-group">
                  <label className="form-label">CRMV</label>
                  <input className="form-input" value={form.crmv ?? ''} onChange={e => setForm(f => ({ ...f, crmv: e.target.value }))} placeholder="SP-00000" />
                </div>
                <div className="form-group">
                  <label className="form-label">MAPA</label>
                  <input className="form-input" value={form.mapa ?? ''} onChange={e => setForm(f => ({ ...f, mapa: e.target.value }))} placeholder="MAPA-00000" />
                </div>
              </>
            )}
          </div>

          {!editing && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 8 }}>
              A senha inicial padrão será <strong>123456</strong>. O usuário deverá alterá-la no primeiro acesso.
            </p>
          )}

          <hr className="divider" />

          {perfis.length > 0 && form.role !== 'admin' && (
            <div className="form-group">
              <label className="form-label">Aplicar perfil de permissões</label>
              <select className="form-select" value={selectedProfile} onChange={e => applyProfile(e.target.value)}>
                <option value="">— Selecionar perfil —</option>
                {perfis.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 10 }}>
              Permissões por módulo
              {form.role === 'admin' && <span className="badge badge-magenta" style={{ marginLeft: 8, fontSize: '0.7rem' }}>Acesso total</span>}
            </p>
            <PermissionMatrix
              getP={(mod, level) => form.role === 'admin' || getPerm(mod, level)}
              setP={setPermLevel}
              disabled={form.role === 'admin'}
            />
          </div>
        </div>
      </Modal>

      {/* Modal Criar/Editar Perfil */}
      <Modal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} title={editingProfile ? 'Editar Perfil' : 'Novo Perfil'} size="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowProfileModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={saveProfile} disabled={!profileForm.name.trim()}>Salvar</button>
          </>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Nome do perfil *</label>
            <input className="form-input" value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Recepcionista, Auxiliar Veterinário..." />
          </div>

          <hr className="divider" />

          <div>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 10 }}>Permissões por módulo</p>
            <PermissionMatrix
              getP={getProfilePerm}
              setP={setProfilePermLevel}
              disabled={false}
            />
          </div>
        </div>
      </Modal>

      {/* Modal Reset Senha */}
      <Modal isOpen={showResetModal} onClose={() => { setShowResetModal(false); setResetTarget(null) }} title={`Resetar senha — ${resetTarget?.name}`} size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => { setShowResetModal(false); setResetTarget(null) }}>Cancelar</button>
            <button className="btn btn-primary" onClick={confirmReset}>Confirmar reset</button>
          </>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            A senha de <strong>{resetTarget?.name}</strong> será redefinida para <code style={{ fontWeight: 700, background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4 }}>123456</code>.
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            O usuário será obrigado a alterar a senha no próximo acesso.
          </p>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          markUserDeleted(deleteTarget.id)
          setUsuarios(prev => prev.filter(u => u.id !== deleteTarget.id))
          setDeleteTarget(null)
        }}
        message={`Excluir o usuário "${deleteTarget?.name}"? O item será excluído permanentemente. Confirmar?`}
      />

      <ConfirmModal
        isOpen={!!deleteProfileTarget}
        onClose={() => setDeleteProfileTarget(null)}
        onConfirm={() => { setPerfis(prev => prev.filter(p => p.id !== deleteProfileTarget.id)); setDeleteProfileTarget(null) }}
        message={`Excluir o perfil "${deleteProfileTarget?.name}"? O item será excluído permanentemente. Confirmar?`}
      />
    </div>
  )
}

function PermissionMatrix({ getP, setP, disabled }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--surface-2)' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Módulo</th>
            <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Visualizar</th>
            <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Incluir/Editar</th>
            <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Excluir</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(MODULE_LABELS).map(([mod, label], idx) => (
            <tr key={mod} style={{ borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}>
              <td style={{ padding: '9px 12px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</td>
              {['view', 'edit', 'delete'].map(level => (
                <td key={level} style={{ padding: '9px 12px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={getP(mod, level)}
                    onChange={e => setP(mod, level, e.target.checked)}
                    disabled={disabled}
                    style={{ accentColor: 'var(--teal)', width: 16, height: 16, cursor: disabled ? 'default' : 'pointer' }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function initials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}
