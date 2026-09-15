import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../api.js';
import { useLoader } from '../hooks.js';
import Timeline from '../components/Timeline.jsx';

/**
 * Tüm panoların valed: kullanicinin gorulebilir TUM panolarinin görevleri
 * (kullanıcı kuralı: tek görüntüde toplar).
 *
 * Yetkilendirme otomatik: Planka'nın /api/projects yalnızca kullanıcının ROTL
 * olduğu projeleri/panoları döndürür; burada her panonun kendi verisi
 * toplanır. Bağlı dיy (llama_ring) da burada bir algı DLC'dir.
 */

export default function TumZamanCizelgesi({ plankaUrl, onAuthLost }) {
  const load = useCallback(() => api.tumZamanCizelgesi(), []);
  const { data, error, loading } = useLoader(load, onAuthLost);

  // Gruplama seçenekleri: panonun durumlarına göre değil "tümü" özelliğine göre.
  const [grupYa, setGrupYa] = useState('pano');

  if (loading) {
    return <div className="loading">Tüm panoların görevleri yükleniyor...</div>;
  }

  if (error) {
    return (
      <div className="container">
        <div className="alert alert-error">{error}</div>
        <a className="btn" href="/">Ana sayfaya dön</a>
      </div>
    );
  }

  // data.groups === [ {id, name} ] — grup bazı eksenler.
  const gruplar = (data.groups || []).map((g) => [
    `grup:${g.id}`,
    `${g.name} göre`,
  ]);

  const grupSecenekleri = [
    ['pano', 'Panolara göre'],
    ['label', 'Etikete göre'],
    ['none', 'Gruplamadan'],
    ...gruplar,
  ];

  const toplam = data.cards.length;

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Tüm Zaman Çizelgesi</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Erişebildiğiniz tüm panoların görevleri tek ekranda; yetkilendirme
            Planka'dan otomatik gelir (member olmadığınız panolar görünmez).
          </p>
        </div>
        <div className="spacer" />
        <div className="tl-summary" style={{ marginTop: 10 }}>
          <span>{toplam} görev</span>
        </div>
      </div>

      {data &&
        <Timeline
          board={data}
          plankaUrl={plankaUrl}
          grupSecenekleri={grupSecenekleri}
          gosterPanoAdi
          saltOkunur
        />}

      <p className="muted small" style={{ marginTop: 16 }}>
        Bu ekranda görevler salt-okunurdur: tarihleri değiştirip / liste taşı for
        isteği zor olan taraf; ilgili etkinliğin panosunda yapılır (pano adının
        yanındaki linkten işersiniz).
      </p>
    </div>
  );
}
