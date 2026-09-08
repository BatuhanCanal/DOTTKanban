import { useState } from 'react';

import { api, ApiError } from '../api.js';

export default function Login({ onSuccess }) {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [termsInfo, setTermsInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setTermsInfo(null);
    setBusy(true);

    try {
      await api.login(emailOrUsername.trim(), password);
      await onSuccess();
    } catch (caught) {
      if (caught instanceof ApiError && caught.payload.error === 'terms_required') {
        setTermsInfo(caught.payload);
      } else {
        setError(caught.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>
          DOTT <span style={{ color: 'var(--accent)' }}>Kanban</span>
        </h1>
        <p className="sub">Planka hesabinizla giris yapin.</p>

        {error && <div className="alert alert-error">{error}</div>}

        {termsInfo && (
          <div className="alert alert-info">
            {termsInfo.message}{' '}
            <a href={termsInfo.plankaUrl} target="_blank" rel="noreferrer">
              Planka'yi ac
            </a>
          </div>
        )}

        <div className="field">
          <label htmlFor="login-user">Kullanici adi veya e-posta</label>
          <input
            id="login-user"
            type="text"
            autoComplete="username"
            value={emailOrUsername}
            onChange={(event) => setEmailOrUsername(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="login-pass">Sifre</label>
          <input
            id="login-pass"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Giris yapiliyor...' : 'Giris yap'}
        </button>

        <p className="small muted" style={{ marginTop: 16, marginBottom: 0 }}>
          Hesabiniz yoksa toplulugun Planka yoneticisinden hesap acmasini isteyin.
        </p>
      </form>
    </div>
  );
}
