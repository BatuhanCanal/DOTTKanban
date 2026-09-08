import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';

import { api } from '../api.js';
import { useLoader } from '../hooks.js';
import { colorOf } from '../colors.js';
import Modal from '../components/Modal.jsx';

// Etiketi olmayan kartlarin toplandigi sanal sutun.
const NO_LABEL = '__etiketsiz__';
const POSITION_GAP = 65536;

/** Sunucudaki hesabin aynisi; sadece surukleme aninda anlik gorunum icin. */
function positionAtIndex(sortedPositions, index) {
  if (sortedPositions.length === 0) return POSITION_GAP;
  if (index <= 0) return sortedPositions[0] / 2;
  if (index >= sortedPositions.length) return sortedPositions[sortedPositions.length - 1] + POSITION_GAP;
  return (sortedPositions[index - 1] + sortedPositions[index]) / 2;
}

const formatDate = (value) =>
  new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

export default function Board({ plankaUrl, onAuthLost }) {
  const { boardId } = useParams();

  const load = useCallback(() => api.board(boardId), [boardId]);
  const { data, error, loading, reload, setData } = useLoader(load, onAuthLost);

  const [axis, setAxis] = useState('list');
  const [actionError, setActionError] = useState(null);
  const [saveOpen, setSaveOpen] = useState(false);

  const listById = useMemo(
    () => Object.fromEntries((data?.lists || []).map((list) => [list.id, list])),
    [data],
  );
  const labelById = useMemo(
    () => Object.fromEntries((data?.labels || []).map((label) => [label.id, label])),
    [data],
  );

  // Ayni kart verisi, secilen eksene gore farkli gruplanir.
  // Kategori ekseninde bir kart birden fazla sutunda gorunebilir (cok etiketliyse).
  const columns = useMemo(() => {
    if (!data) return [];

    if (axis === 'list') {
      return data.lists.map((list) => ({
        id: list.id,
        title: list.name,
        color: list.color,
        // Pozisyona gore siralanir: surukleme sonrasi iyimser guncellemede kart
        // yeni yerinde gorunsun (sunucudan taze veri gelene kadar).
        cards: data.cards
          .filter((card) => card.listId === list.id)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
      }));
    }

    return [
      ...data.labels.map((label) => ({
        id: label.id,
        title: label.name || 'Isimsiz etiket',
        color: label.color,
        cards: data.cards.filter((card) => card.labelIds.includes(label.id)),
      })),
      {
        id: NO_LABEL,
        title: 'Etiketsiz',
        color: null,
        cards: data.cards.filter((card) => card.labelIds.length === 0),
      },
    ];
  }, [data, axis]);

  const onDragEnd = async (result) => {
    const { draggableId, source, destination } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    // draggableId = "<sutunId>::<kartId>" (bir kart birden fazla sutunda olabilir)
    const cardId = draggableId.split('::')[1];
    setActionError(null);

    try {
      if (axis === 'list') {
        const targetPositions = data.cards
          .filter((card) => card.listId === destination.droppableId && card.id !== cardId)
          .map((card) => card.position ?? 0)
          .sort((a, b) => a - b);

        const position = positionAtIndex(targetPositions, destination.index);

        setData({
          ...data,
          cards: data.cards.map((card) =>
            card.id === cardId ? { ...card, listId: destination.droppableId, position } : card,
          ),
        });

        await api.moveCard(cardId, boardId, destination.droppableId, destination.index);
      } else {
        const from = source.droppableId;
        const to = destination.droppableId;

        // Kategori ekseninde sutun ici siralama Planka'da saklanmaz.
        if (from === to) return;

        setData({
          ...data,
          cards: data.cards.map((card) => {
            if (card.id !== cardId) return card;

            const labelIds = card.labelIds.filter((id) => id !== from);

            if (to !== NO_LABEL && !labelIds.includes(to)) {
              labelIds.push(to);
            }

            return { ...card, labelIds };
          }),
        });

        if (to !== NO_LABEL) {
          await api.addLabel(cardId, to);
        }

        if (from !== NO_LABEL) {
          await api.removeLabel(cardId, from);
        }
      }

      await reload({ silent: true });
    } catch (caught) {
      setActionError(caught.message);
      await reload({ silent: true });
    }
  };

  if (loading) {
    return <div className="loading">Pano yukleniyor...</div>;
  }

  if (error) {
    return (
      <div className="container">
        <div className="alert alert-error">{error}</div>
        <Link className="btn" to="/">
          Etkinliklere don
        </Link>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <div className="crumb">
            <Link to="/">Etkinlikler</Link>
            {data.board.projectName ? ` / ${data.board.projectName}` : ''}
          </div>
          <h1>{data.board.name}</h1>
        </div>

        <div className="spacer" />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="tabs">
            <button
              type="button"
              className={`tab ${axis === 'list' ? 'active' : ''}`}
              onClick={() => setAxis('list')}
            >
              Duruma gore
            </button>
            <button
              type="button"
              className={`tab ${axis === 'label' ? 'active' : ''}`}
              onClick={() => setAxis('label')}
            >
              Kategoriye gore
            </button>
          </div>

          <button type="button" className="btn" onClick={() => setSaveOpen(true)}>
            Sablon olarak kaydet
          </button>

          <a
            className="btn"
            href={`${plankaUrl}/boards/${boardId}`}
            target="_blank"
            rel="noreferrer"
          >
            Planka'da ac
          </a>
        </div>
      </div>

      {actionError && <div className="alert alert-error">{actionError}</div>}

      {axis === 'label' && data.labels.length === 0 && (
        <div className="alert alert-info">
          Bu panoda henuz etiket yok. Planka'da etiket olusturun (orn. Yiyecek, Icecek, Teknik);
          burada kategori sutunlari olarak gorunecekler.
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="board-scroll">
          <div className="board-columns">
            {columns.map((column) => (
              <div className="column" key={column.id}>
                <div className="column-head">
                  {axis === 'label' && (
                    <span
                      className="column-swatch"
                      style={{ background: column.color ? colorOf(column.color) : 'var(--border)' }}
                    />
                  )}
                  <span className="column-title">{column.title}</span>
                  <span className="column-count">{column.cards.length}</span>
                </div>

                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`column-body ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                    >
                      {column.cards.map((card, index) => (
                        <Draggable
                          key={`${column.id}::${card.id}`}
                          draggableId={`${column.id}::${card.id}`}
                          index={index}
                        >
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={`kanban-card ${dragSnapshot.isDragging ? 'is-dragging' : ''}`}
                            >
                              <div className="kanban-card-title">
                                <a
                                  href={`${plankaUrl}/cards/${card.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: 'inherit' }}
                                  title="Karti Planka'da ac"
                                >
                                  {card.name}
                                </a>
                              </div>

                              <div className="kanban-card-meta">
                                {/* Diger eksenin bilgisi rozet olarak gosterilir:
                                    durum gorunumunde kategoriler, kategori gorunumunde durum. */}
                                {axis === 'list'
                                  ? card.labelIds.map((id) => (
                                      <span
                                        key={id}
                                        className="chip"
                                        style={{ background: colorOf(labelById[id]?.color) }}
                                      >
                                        {labelById[id]?.name || 'Etiket'}
                                      </span>
                                    ))
                                  : listById[card.listId] && (
                                      <span className="chip chip-status">
                                        {listById[card.listId].name}
                                      </span>
                                    )}

                                {card.tasksTotal > 0 && (
                                  <span className="chip chip-outline">
                                    {card.tasksCompleted}/{card.tasksTotal}
                                  </span>
                                )}

                                {card.dueDate && (
                                  <span className="chip chip-outline">{formatDate(card.dueDate)}</span>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </div>
      </DragDropContext>

      <p className="muted small" style={{ marginTop: 16 }}>
        {axis === 'list'
          ? 'Kartlari surukleyerek durumunu degistirebilirsiniz. Kart basligina tiklayinca Planka’da acilir.'
          : 'Kartlari surukleyerek kategorisini (etiketini) degistirebilirsiniz. Bir kart birden fazla etikete sahipse birden fazla sutunda gorunur; sutun ici siralama bu gorunumde saklanmaz.'}
      </p>

      {saveOpen && (
        <SaveTemplateModal
          board={data.board}
          onClose={() => setSaveOpen(false)}
        />
      )}
    </div>
  );
}

function SaveTemplateModal({ board, onClose }) {
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const result = await api.saveTemplate(board.id, name.trim(), description.trim() || null);
      setSaved(result.template);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return (
      <Modal title="Sablon kaydedildi" onClose={onClose}>
        <div className="alert alert-success">
          <strong>{saved.name}</strong> sablonu kaydedildi: {saved.stats.lists} sutun,{' '}
          {saved.stats.labels} etiket, {saved.stats.cards} kart.
        </div>
        <p className="muted small">
          Yeni bir etkinlik acmak istediginizde Sablonlar sayfasindan bu sablonu kullanabilirsiniz.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Tamam
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Sablon olarak kaydet"
      subtitle="Bu panonun sutunlari, etiketleri, kartlari ve kart ici kontrol listeleri sablon olarak saklanir. Panoda hicbir sey degismez."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="tpl-name">Sablon adi</label>
          <input
            id="tpl-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="tpl-desc">Aciklama (istege bagli)</label>
          <textarea
            id="tpl-desc"
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Orn. her donem tekrarlanan tanitim etkinligi"
          />
        </div>

        <p className="muted small">
          Not: son tarihler, tamamlanma isaretleri ve kisi atamalari sablona alinmaz &mdash; yeni
          etkinlik temiz baslar.
        </p>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Vazgec
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
