import { useCallback, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, Link } from 'react-router-dom';

import { api, ApiError } from './api.js';
import Login from './pages/Login.jsx';
import Hub from './pages/Hub.jsx';
import Board from './pages/Board.jsx';
import Templates from './pages/Templates.jsx';
import Admin from './pages/Admin.jsx';
import TumZamanCizelgesi from './pages/TumZamanCizelgesi.jsx';

export default function App() {
  const [session, setSession] = useState(null); // { user, isAdmin, plankaUrl }
  const [checking, setChecking] = useState(true);

  /* Tema seçimi: üst bardaki seçici, localStorage'a yazar. CORS yok,
     hemen HTML köünginte data-theme'i güncelleyip CSS token'ları değişir. */
  const GECERLI_TEMALAR = { 'siyah-beyaz': 'Siyah beyaz', minecraft: 'Minecraft', sims: 'The Sims' };
  const [tema, setTema] = useState(document.documentElement.dataset.theme || 'siyah-beyaz');

  const temaDegistir = (event) => {
    const yeni = event.target.value;
    if (!GECERLI_TEMALAR[yeni]) return;
    document.documentElement.dataset.theme = yeni;
    try {
      localStorage.setItem('dott-tema', yeni);
    } catch {
      /* private/mods: localStorage kapalı olabilir; tema oturuma özgü kalsın */
    }
    setTema(yeni);
  };

  const refreshSession = useCallback(async () => {
    try {
      setSession(await api.me());
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setSession(null);
      } else {
        throw error;
      }
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    refreshSession().catch(() => setChecking(false));
  }, [refreshSession]);

  // Oturum herhangi bir istekte duserse giris ekranina don.
  const handleAuthLost = useCallback(() => setSession(null), []);

  if (checking) {
    return <div className="loading">Yukleniyor...</div>;
  }

  if (!session) {
    return <Login onSuccess={refreshSession} />;
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            DOTT <span>Kanban</span>
          </Link>
          <nav>
            <NavLink to="/" end>
              Etkinlikler
            </NavLink>
            <NavLink to="/sablonlar">Şablonlar</NavLink>
            <NavLink to="/zaman-cizelgesi">Zaman Çizelgesi</NavLink>
            {session.isAdmin && <NavLink to="/admin">Etiket Türleri</NavLink>}
          </nav>
          <div className="spacer" />
          <select
            className="sort-select tema-secici"
            value={tema}
            onChange={temaDegistir}
            aria-label="Görünüm (tema)"
            title="Görünüm teması"
          >
            {Object.entries(GECERLI_TEMALAR).map(([k, v]) => (
              <option key={k} value={k}>{k === 'sims' ? 'The Sims' : GECERLI_TEMALAR[k]}</option>
            ))}
          </select>
          <a
            className="btn btn-sm"
            href={session.plankaUrl}
            target="_blank"
            rel="noreferrer"
            title="Kartları düzenlemek, yorum yazmak ve dosya eklemek için Planka'yı kullanın"
          >
            <span className="icon icon-sm">open_in_new</span>
            Planka'yı aç
          </a>
          <span className="user-chip">{session.user.name || session.user.username}</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={async () => {
              await api.logout();
              setSession(null);
            }}
          >
            <span className="icon icon-sm">logout</span>
            Çıkış
          </button>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Hub onAuthLost={handleAuthLost} />} />
        <Route
          path="/pano/:boardId"
          element={<Board plankaUrl={session.plankaUrl} onAuthLost={handleAuthLost} />}
        />
        <Route
          path="/sablonlar"
          element={
            <Templates user={session.user} isAdmin={session.isAdmin} onAuthLost={handleAuthLost} />
          }
        />
        <Route path="/zaman-cizelgesi" element={<TumZamanCizelgesi plankaUrl={session.plankaUrl} onAuthLost={handleAuthLost} />} />
        <Route
          path="/admin"
          element={
            session.isAdmin ? (
              <Admin onAuthLost={handleAuthLost} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
