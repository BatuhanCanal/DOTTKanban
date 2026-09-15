import { useState } from 'react';

import { api } from '../api.js';
import Modal from './Modal.jsx';

/** Görev eklerken varsayılan süre: bugün → bugün+7 (kullanıcı kuralı). */
const VARSAYILAN_SURE_GUN = 7;

const bugun = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const sonra = (gun) => {
  const d = new Date();
  d.setDate(d.getDate() + gun);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * "Görev ekle" formu.
 *
 * Kurallar:
 *   - Panoya BAĞLI ve en az bir etiketi olan türler ZORUNLUDUR: eksik tür
 *     varken kayıt yazılamaz (sunucu da doğrular).
 *   - Bağlı etiketi hiç olmayan türler formda görünmez (şart anlamsız olurdu).
 *   - Hiç bağlı tür yoksa görev yalnızca ad + tarih ile kaydedilir.
 *   - Varsayılan tarih aralığı: bugün → bugün + 7 gün; sonradan her görevin
 *     tarihleri seçilip değiştirilebilir (sağ üstten, sürükleyerek vs.).
 */
export default function AddTaskModal({ board, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [listId, setListId] = useState(board.lists[0]?.id || '');
  const [secimler, setSecimler] = useState({}); // groupId -> labelId
  const [trStart, setTrStart] = useState(bugun());
  const [trBitis, setTrBitis] = useState(sonra(VARSAYILAN_SURE_GUN));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const labelById = Object.fromEntries(board.labels.map((label) => [label.id, label]));

  // Zorunlu türler: panoya BAĞLI ve bu epin'de en az bir etiketi var.
  const zorunluTurler = (board.labelGroups || []).filter((group) =>
    (group.labelIds || []).some((id) => Boolean(labelById[id])),
  );

  // Eksik türler: seçilmemiş / hatalı seçim.
  const eksikTurler = zorunluTurler.filter((group) => {
    const secim = secimler[group.id];
    return !secim || !group.labelIds.includes(secim);
  });

  const submit = async (event) => {
    event.preventDefault();
    setError(null);

    if (eksikTurler.length > 0) {
      setError(`Şu etiket türleri atanmalıdır: ${eksikTurler.map((g) => g.name).join(', ')}`);
      return;
    }

    setBusy(true);

    try {
      await api.createKart(board.id, {
        name: name.trim(),
        listId,
        assignments: secimler,
        startDate: trStart,
        dueDate: trBitis,
      });
      await onSaved();
    } catch (caught) {
      setError(caught.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Görev ekle"
      subtitle="Panoya bağlı tüm etiket türlerini seçmelisiniz (Ekip, Tür...). Eksik tür varsa kayıt tamamlanmaz."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="task-name">Görev adı</label>
          <input
            id="task-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn. Poster hazırla"
            required
            autoFocus
          />
        </div>

        <div className="field">
          <label htmlFor="task-list">Hedef sütun</label>
          <select id="task-list" value={listId} onChange={(e) => setListId(e.target.value)}>
            {board.lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </select>
        </div>

        {/* Zorunlu türler: panoya bağlı VE en az bir etiketi olan自如 türler. */}
        {zorunluTurler.map((group) => (
          <div className="field" key={group.id}>
            <label htmlFor={`grup-${group.id}`}>
              {group.name} <span className="muted small">(zorunlu)</span>
            </label>
            <select
              id={`grup-${group.id}`}
              value={secimler[group.id] || ''}
              onChange={(e) =>
                setSecimler((mevcut) => ({ ...mevcut, [group.id]: e.target.value }))
              }
            >
              <option value="">Seçin...</option>
              {group.labelIds
                .filter((id) => labelById[id])
                .map((id) => (
                  <option key={id} value={id}>
                    {labelById[id]?.name}
                  </option>
                ))}
            </select>
          </div>
        ))}

        {zorunluTurler.length === 0 && (
          <div className="alert alert-info">
            Bu panoya bağlı etiket türü yok. Görev yalnızca ad ve tarih ile
            kayıtlacaktır (etiket türleri olmadan).
          </div>
        )}

        <div className="field">
          <label htmlFor="task-start">Başlangıç tarihi</label>
          <input
            id="task-start"
            type="date"
            value={trStart}
            max={trBitis}
            onChange={(e) => setTrStart(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="task-due">Bitiş tarihi</label>
          <input
            id="task-due"
            type="date"
            value={trBitis}
            min={trStart}
            onChange={(e) => setTrBitis(e.target.value)}
          />
          <span className="muted small">
            Varsayılan aralınız: bugün → bugün + 7 gün; sonra zaman çizelgesinde
            görevi sürükleyip veya tıklayarak değiştirin.
          </span>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Vazgeç
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || eksikTurler.length > 0}
          >
            {busy ? 'Kayıt ediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
