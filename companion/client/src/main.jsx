import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.jsx';
import './styles.css';

/* Tema ilk boyamadan ONCE uygulanır (beyaz flash olmasın):
   localStorage'den okunur, varsayılanı 'siyah-beyaz'. */
const GECERLI_TEMALAR = ['siyah-beyaz', 'minecraft', 'sims'];
const kayitliTema = localStorage.getItem('dott-tema');
const tema = GECERLI_TEMALAR.includes(kayitliTema) ? kayitliTema : 'siyah-beyaz';
document.documentElement.dataset.theme = tema;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
