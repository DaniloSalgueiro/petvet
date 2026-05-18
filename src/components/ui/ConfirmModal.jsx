import Modal from './Modal'

export default function ConfirmModal({ isOpen, onClose, onConfirm, message = 'O item será excluído permanentemente. Confirmar?' }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirmar exclusão" size="sm"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            style={{ background: 'var(--danger, #e53e3e)', borderColor: 'var(--danger, #e53e3e)' }}
            onClick={() => { onConfirm(); onClose() }}
          >
            Excluir
          </button>
        </>
      }>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{message}</p>
    </Modal>
  )
}
