export default function Tabs({ tabs, active, onChange }) {
  return (
    <div style={wrapper} className="tabs-scroll">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{ ...btn, ...(active === tab.id ? activeBtnStyle : {}) }}
        >
          {tab.icon && <span style={{ display: 'flex', alignItems: 'center' }}>{tab.icon}</span>}
          {tab.label}
          {tab.count !== undefined && (
            <span style={{ ...countStyle, ...(active === tab.id ? activeCountStyle : {}) }}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

const wrapper = {
  display: 'flex',
  gap: '4px',
  borderBottom: '2px solid var(--border)',
  paddingBottom: '0',
  overflowX: 'auto',
  flexShrink: 0,
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
}
const btn = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '10px 16px',
  background: 'transparent', border: 'none',
  borderBottom: '2px solid transparent',
  marginBottom: '-2px',
  fontSize: '0.875rem', fontWeight: 600,
  color: 'var(--text-muted)',
  cursor: 'pointer', whiteSpace: 'nowrap',
  transition: 'color 150ms ease, border-color 150ms ease',
  borderRadius: '6px 6px 0 0',
}
const activeBtnStyle = {
  color: 'var(--teal)',
  borderBottomColor: 'var(--teal)',
  background: 'rgba(39,181,172,0.05)',
}
const countStyle = {
  background: 'var(--surface-2)',
  color: 'var(--text-muted)',
  fontSize: '0.7rem',
  fontWeight: 700,
  borderRadius: '999px',
  padding: '1px 7px',
  minWidth: '20px',
  textAlign: 'center',
}
const activeCountStyle = {
  background: 'var(--teal-light)',
  color: 'var(--teal-dark)',
}
