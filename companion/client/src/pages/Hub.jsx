import { useCallback } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../api.js';
import { useLoader } from '../hooks.js';

export default function Hub({ onAuthLost }) {
  const load = useCallback(() => api.hub(), []);
  const { data, error, loading } = useLoader(load, onAuthLost);

  if (loading) {
    return <div className="loading">Birimler yukleniyor...</div>;
  }

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Etkinlikler</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Her birim bir klasor, her etkinlik o klasorde bir pano. Panolar Planka'da tutulur.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {data && data.projects.length === 0 && (
        <div className="panel">
          <div className="empty">
            Henuz birim yok. Planka'yi acip bir proje (birim) olusturun, burada gorunecek.
          </div>
        </div>
      )}

      {data &&
        data.projects.map((project) => (
          <div className="panel" key={project.id}>
            <div className="panel-head">
              <h2>{project.name}</h2>
              <span className="muted small">
                {project.boards.length} etkinlik
              </span>
            </div>

            {project.boards.length === 0 ? (
              <div className="empty small">
                Bu birimde henuz pano yok. Sablonlar sayfasindan hazir bir sablondan
                olusturabilirsiniz.
              </div>
            ) : (
              project.boards.map((board) => (
                <div className="row" key={board.id}>
                  <div className="row-main">
                    <div className="row-title">{board.name}</div>
                  </div>
                  <Link className="btn btn-sm btn-primary" to={`/pano/${board.id}`}>
                    Gorunumler
                  </Link>
                </div>
              ))
            )}
          </div>
        ))}
    </div>
  );
}
