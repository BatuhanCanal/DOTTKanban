import { useCallback, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, Link } from 'react-router-dom';

import { api, ApiError } from './api.js';
import Login from './pages/Login.jsx';
import Hub from './pages/Hub.jsx';
import Board from './pages/Board.jsx';
import Templates from './pages/Templates.jsx';

export default function App() {
  const [session, setSession] = useState(null); // { user, isAdmin, plankaUrl }
  const [checking, setChecking] = useState(true);

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
            <NavLink to="/sablonlar">Sablonlar</NavLink>
          </nav>
          <div className="spacer" />
          <a
            className="btn btn-sm"
            href={session.plankaUrl}
            target="_blank"
            rel="noreferrer"
            title="Kartlari duzenlemek, yorum yazmak ve dosya eklemek icin Planka'yi kullanin"
          >
            Planka'yi ac
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
            Cikis
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
