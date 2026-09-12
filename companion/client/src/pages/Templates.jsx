import { useCallback, useState } from 'react';

import { api } from '../api.js';
import { useLoader } from '../hooks.js';
import Modal from '../components/Modal.jsx';

const formatDateTime = (value) =>
  new Date(value).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

export default function Templates({ user, isAdmin, onAuthLost }) {
  const load = useCallback(
    async () => {
      const [templates, hub] = await Promise.all([api.templates(), api.hub()]);
      return { templates: templates.templates, projects: hub.projects };
    },
    [],
  );

  const { data, error, loading, reload } = useLoader(load, onAuthLost);
  const [using, setUsing] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Silme yetkisi sunucuda da kontrol edilir; buradaki kontrol yalnizca
  // kullanilamayacak dugmeyi gostermemek icin.
  const canManage = (template) =>
    isAdmin || (Boolean(template.createdByUserId) && template.createdByUserId === user.id);

  const remove = async (template) => {
    if (!window.confirm(`"${template.name}" sablonu silinsin mi? Panolar etkilenmez.`)) {
      return;
    }

    try {
      await api.deleteTemplate(template.id);
      await reload({ silent: true });
    } catch (caught) {
      setActionError(caught.message);
    }
  };

  if (loading) {
    return <div className="loading">Sablonlar yukleniyor...</div>;
  }

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Sablonlar</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Tekrar eden etkinlikler icin hazir pano yapilari. Bir panoyu sablona cevirmek icin
            panoyu acip &ldquo;Sablon olarak kaydet&rdquo; deyin.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {actionError && <div className="alert alert-error">{actionError}</div>}

      <div className="panel">
        <div className="panel-head">
          <h2>Kayitli sablonlar</h2>
          <span className="muted small">{data ? data.templates.length : 0} adet</span>
        </div>

        {data && data.templates.length === 0 ? (
          <div className="empty">
            Henuz sablon yok. Bir etkinlik panosunu acip &ldquo;Sablon olarak kaydet&rdquo;
            dediginizde burada gorunecek.
          </div>
        ) : (
          data &&
          data.templates.map((template) => (
            <div className="row" key={template.id}>
              <div className="row-main">
                <div className="row-title">{template.name}</div>
                <div className="muted small">
                  {template.stats.lists} sutun &middot; {template.stats.labels} etiket &middot;{' '}
                  {template.stats.cards} kart
                  {template.sourceBoardName ? ` · kaynak: ${template.sourceBoardName}` : ''}
                  {template.createdBy ? ` · ${template.createdBy}` : ''} &middot;{' '}
                  {formatDateTime(template.createdAt)}
                </div>
                {template.description && (
                  <div className="muted small" style={{ marginTop: 2 }}>
                    {template.description}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => setUsing(template)}
              >
                Bu sablondan etkinlik ac
              </button>
              {canManage(template) && (
                <>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setRenaming(template)}
                  >
                    Duzenle
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => remove(template)}
                  >
                    Sil
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {using && (
        <UseTemplateModal
          template={using}
          projects={data.projects}
          onClose={() => setUsing(null)}
        />
      )}

      {renaming && (
        <RenameTemplateModal
          template={renaming}
          onClose={() => setRenaming(null)}
          onSaved={async () => {
            setRenaming(null);
            await reload({ silent: true });
          }}
        />
      )}
    </div>
  );
}

function RenameTemplateModal({ template, onClose, onSaved }) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await api.renameTemplate(template.id, name.trim(), description.trim() || null);
      await onSaved();
    } catch (caught) {
      setError(caught.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Sablonu duzenle"
      subtitle="Yalnizca sablonun adi ve aciklamasi degisir; icindeki yapiya dokunulmaz."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="rename-name">Sablon adi</label>
          <input
            id="rename-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="rename-description">Aciklama (istege bagli)</label>
          <input
            id="rename-description"
            type="text"
            value={description}
            placeholder="Orn. iki gunluk atolye duzeni"
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Vazgec
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
            {busy ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function UseTemplateModal({ template, projects, onClose }) {
  const [projectId, setProjectId] = useState(projects[0] ? projects[0].id : '');
  const [name, setName] = useState(template.name);
  const [includeCards, setIncludeCards] = useState(true);
  const [resetToFirstList, setResetToFirstList] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      setResult(
        await api.instantiateTemplate(template.id, {
          projectId,
          name: name.trim(),
          includeCards,
          resetToFirstList,
        }),
      );
    } catch (caught) {
      // Pano acildi ama icerik yarim kaldiysa sunucu linki yine de doner.
      if (caught.payload && caught.payload.partial) {
        setResult(caught.payload);
      } else {
        setError(caught.message);
      }
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <Modal title={result.partial ? 'Kismen olusturuldu' : 'Etkinlik olusturuldu'} onClose={onClose}>
        <div className={`alert ${result.partial ? 'alert-error' : 'alert-success'}`}>
          {result.partial
            ? result.error
            : `Yeni pano hazir: ${result.stats.lists} sutun, ${result.stats.labels} etiket, ${result.stats.cards} kart olusturuldu.`}
        </div>
        <div className="modal-actions">
          <a className="btn btn-primary" href={result.url} target="_blank" rel="noreferrer">
            Panoyu Planka'da ac
          </a>
          <button type="button" className="btn" onClick={onClose}>
            Kapat
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Sablondan etkinlik ac"
      subtitle={`"${template.name}" sablonundaki yapi yeni bir panoya kurulacak.`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="use-project">Hangi birimde?</label>
          <select
            id="use-project"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            required
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="use-name">Etkinlik (pano) adi</label>
          <input
            id="use-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>

        <label className="field-check">
          <input
            type="checkbox"
            checked={includeCards}
            onChange={(event) => setIncludeCards(event.target.checked)}
          />
          <span>
            Kartlar da olusturulsun
            <br />
            <span className="muted small">
              Kapatirsaniz sadece sutunlar ve etiketler kurulur, kartlari sifirdan yazarsiniz.
            </span>
          </span>
        </label>

        <label className="field-check">
          <input
            type="checkbox"
            checked={resetToFirstList}
            disabled={!includeCards}
            onChange={(event) => setResetToFirstList(event.target.checked)}
          />
          <span>
            Tum kartlar ilk sutundan bassin
            <br />
            <span className="muted small">
              Kapatirsaniz kartlar sablondaki sutunlarinda kalir.
            </span>
          </span>
        </label>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Vazgec
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !projectId}>
            {busy ? 'Olusturuluyor...' : 'Olustur'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
