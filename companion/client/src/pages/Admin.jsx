import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../api.js';
import { useLoader } from '../hooks.js';
import { colorOf } from '../colors.js';
import Modal from '../components/Modal.jsx';

/**
 * Etiket turleri yonetim sayfasi.
 *
 * Yoneticiler buradan "Ekip", "Etkinlik Türü" gibi türler tanımlar ve
 * panodaki etiketleri bu türlere bağlar. Boylece pano sayfasinda her tur
 * icin ayri bir gorunum sekmesi ("Ekiplere gore", "Etkinlik turune gore"...)
 * dogar.
 */

export default function Admin({ onAuthLost }) {
  const load = useCallback(() => api.labelGroups(), []);
  const { data: groups, error, loading, reload } = useLoader(load, onAuthLost);

  const [boards, setBoards] = useState([]);
  const [boardsLoading, setBoardsLoading] = useState(true);
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [boardLabels, setBoardLabels] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [assignGroup, setAssignGroup] = useState(null);

  // Panolari cek (etiket bağlamak için lazım)
  useEffect(() => {
    api.hub().then((data) => {
      const allBoards = [];
      for (const project of data.projects || []) {
        for (const board of project.boards || []) {
          allBoards.push({ id: board.id, name: board.name, projectName: project.name });
        }
      }
      setBoards(allBoards);
      setBoardsLoading(false);
    }).catch(() => setBoardsLoading(false));
  }, []);

  // Secili panonun etiketlerini cek
  useEffect(() => {
    if (!selectedBoard) return;
    api.boardLabels(selectedBoard.id).then(setBoardLabels).catch(() => setBoardLabels([]));
  }, [selectedBoard]);

  const handleAssign = async (groupId, labelId) => {
    if (!selectedBoard) return;
    await api.addLabelToGroup(groupId, selectedBoard.id, labelId);
    await reload();
  };

  const handleUnassign = async (groupId, labelId) => {
    if (!selectedBoard) return;
    await api.removeLabelFromGroup(groupId, selectedBoard.id, labelId);
    await reload();
  };

  const handleDeleteGroup = async (groupId) => {
    await api.deleteLabelGroup(groupId);
    await reload();
  };

  if (loading) {
    return <div className="loading">Etiket turleri yukleniyor...</div>;
  }

  if (error) {
    return (
      <div className="container">
        <div className="alert alert-error">{error}</div>
        <Link className="btn" to="/">Ana sayfaya don</Link>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Etiket Türleri</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Panodaki etiketleri türlere baglayarak &ldquo;Ekiplere göre&rdquo;, &ldquo;Etkinlik
            turune gore&rdquo; gibi gorunumler olusturun. Her tur, pano sayfasinda ayri bir
            sekme olarak gorunecek.
          </p>
        </div>
        <div className="spacer" />
        <button type="button" className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          + Yeni tür
        </button>
      </div>

      {groups.length === 0 && (
        <div className="panel">
          <div className="empty">
            Henuz etiket turu yok. Ornek: <strong>Ekip</strong> turu olusturup
            &ldquo;Organizasyon&rdquo;, &ldquo;Tasarım&rdquo;, &ldquo;Sosyal Medya&rdquo;
            etiketlerini bağlayın.
          </div>
        </div>
      )}

      {groups.map((group) => (
        <div className="panel" key={group.id}>
          <div className="panel-head">
            <h2>{group.name}</h2>
            <span className="muted small">{group.labels.length} etiket</span>
            <div className="spacer" />
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setEditingGroup(group)}
            >
              Yeniden adlandır
            </button>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => {
                if (window.confirm(`"${group.name}" turunu silmek istediğinize emin misiniz?`)) {
                  handleDeleteGroup(group.id);
                }
              }}
            >
              Sil
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => {
                setAssignGroup(group);
                setSelectedBoard(null);
                setBoardLabels([]);
              }}
            >
              Etiket bağla
            </button>
          </div>

          {group.labels.length === 0 ? (
            <div className="empty small">
              Bu türde henüz etiket yok. &ldquo;Etiket bağla&rdquo; ile bir panodaki
              etiketleri bu ture ekleyin.
            </div>
          ) : (
            <div className="label-list">
              {group.labels.map((item) => {
                // Bu etiketin panosunu bul (label ismini gosterebilmek icin)
                const board = boards.find((b) => b.id === item.boardId);
                // boardLabels'ta bu label varsa gercek adini kullan
                const label = boardLabels.find((l) => l.id === item.labelId);
                const labelName = label?.name || item.labelId.slice(0, 8);
                const labelColor = label?.color || null;

                return (
                  <div className="label-item" key={`${item.boardId}-${item.labelId}`}>
                    <span
                      className="label-swatch"
                      style={{ background: labelColor ? colorOf(labelColor) : 'var(--border)' }}
                    />
                    <span className="label-name">{labelName}</span>
                    <span className="muted small">{board?.name || item.boardId}</span>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => handleUnassign(group.id, item.labelId)}
                      title="Turden cikar"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {/* --- Modallar ---------------------------------------------------- */}

      {showCreateModal && (
        <CreateGroupModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            reload();
          }}
        />
      )}

      {editingGroup && (
        <RenameGroupModal
          group={editingGroup}
          onClose={() => setEditingGroup(null)}
          onRenamed={() => {
            setEditingGroup(null);
            reload();
          }}
        />
      )}

      {assignGroup && (
        <AssignLabelsModal
          group={assignGroup}
          boards={boards}
          boardsLoading={boardsLoading}
          selectedBoard={selectedBoard}
          setSelectedBoard={setSelectedBoard}
          boardLabels={boardLabels}
          onAssign={handleAssign}
          onClose={() => {
            setAssignGroup(null);
            setSelectedBoard(null);
            setBoardLabels([]);
            reload();
          }}
        />
      )}
    </div>
  );
}

/** Yeni etiket türü olusturma modali. */
function CreateGroupModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await api.createLabelGroup(name.trim());
      await onCreated();
    } catch (caught) {
      setError(caught.message);
      setBusy(false);
    }
  };

  return (
    <Modal title="Yeni etiket türü" onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="group-name">Tür adı</label>
          <input
            id="group-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn. Ekip, Etkinlik Türü"
            required
            autoFocus
          />
          <span className="muted small">
            Bu ad pano sayfasında &ldquo;Ekip gore&rdquo;, &ldquo;Etkinlik Türü gore&rdquo;
            sekli olarak gorunecek.
          </span>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Vazgeç</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Oluşturuluyor...' : 'Oluştur'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Tür adıni degistirme modali. */
function RenameGroupModal({ group, onClose, onRenamed }) {
  const [name, setName] = useState(group.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await api.renameLabelGroup(group.id, name.trim());
      await onRenamed();
    } catch (caught) {
      setError(caught.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={`"${group.name}" türünü yeniden adlandır`} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="rename-name">Yeni ad</label>
          <input
            id="rename-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Vazgeç</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Pano seçip etiket bağlama modalı. */
function AssignLabelsModal({
  group,
  boards,
  boardsLoading,
  selectedBoard,
  setSelectedBoard,
  boardLabels,
  onAssign,
  onClose,
}) {
  const [assigning, setAssigning] = useState(null);

  const alreadyAssigned = new Set(
    group.labels.filter((l) => l.boardId === selectedBoard?.id).map((l) => l.labelId),
  );

  return (
    <Modal
      title={`"${group.name}" türüne etiket bağla`}
      subtitle="Bir pano seçin, sonra o panodaki etiketleri bu ture ekleyin."
      onClose={onClose}
    >
      <div className="field">
        <label htmlFor="board-select">Pano</label>
        <select
          id="board-select"
          value={selectedBoard?.id || ''}
          onChange={(e) => {
            const board = boards.find((b) => b.id === e.target.value);
            setSelectedBoard(board || null);
          }}
          disabled={boardsLoading}
        >
          <option value="">Pano seçin...</option>
          {boards.map((board) => (
            <option key={board.id} value={board.id}>
              {board.projectName} / {board.name}
            </option>
          ))}
        </select>
      </div>

      {selectedBoard && boardLabels.length > 0 && (
        <div className="field">
          <label>Etiketler</label>
          <div className="label-pick-list">
            {boardLabels.map((label) => {
              const isAssigned = alreadyAssigned.has(label.id);
              return (
                <button
                  key={label.id}
                  type="button"
                  className={`label-pick ${isAssigned ? 'is-assigned' : ''}`}
                  disabled={isAssigned || assigning === label.id}
                  onClick={async () => {
                    setAssigning(label.id);
                    try {
                      await onAssign(group.id, label.id);
                    } finally {
                      setAssigning(null);
                    }
                  }}
                >
                  <span
                    className="label-swatch"
                    style={{ background: label.color ? colorOf(label.color) : 'var(--border)' }}
                  />
                  <span>{label.name}</span>
                  {isAssigned && <span className="muted small">bagli</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedBoard && boardLabels.length === 0 && (
        <div className="alert alert-info">
          Bu panoda henuz etiket yok. Önce Planka'da etiket olusturun.
        </div>
      )}

      <div className="modal-actions">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Tamam
        </button>
      </div>
    </Modal>
  );
}
