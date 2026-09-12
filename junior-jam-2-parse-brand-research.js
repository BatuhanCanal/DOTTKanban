// =====================================================================
//  JUNIOR JAM — 2. ADIM: PARSE BRAND RESEARCH
//  n8n Code node. ÖNEMLİ: "Run Once for Each Item" modunda çalıştırın.
//  ("Run Once for All Items" modunda $json yalnızca ilk item'ı görür ve
//   90 markanın 89'u kaybolur.)
//
//  Görevi: modelin JSON'unu güvenli şekilde ayrıştırmak, alanları
//  doğrulamak, uydurma alıntıları elemek ve e-posta adımına hazır
//  metin blokları üretmek.
// =====================================================================

const ANGLES = ['recruitment', 'tooling', 'product_trial', 'education', 'brand_visibility'];
const CONFIDENCES = ['high', 'medium', 'low'];
const MAX_POINTS = 3;

const kaynak = $('Clean Website Text').item.json;
const content = $json.choices?.[0]?.message?.content || '';

// ---------------------------------------------------------------
// 1) Model çıktısından JSON'u çıkar.
//    Kod bloğuna, öncesine/sonrasına eklenmiş açıklamaya ve JSON'u
//    bozan kontrol karakterlerine karşı dayanıklı.
// ---------------------------------------------------------------
function extractJson(raw) {
  let s = String(raw).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  // Kontrol karakterleri JSON.parse'ı patlatır; boşlukla değiştir.
  s = Array.from(s.slice(start, end + 1))
    .map((ch) => (ch.charCodeAt(0) < 32 ? ' ' : ch))
    .join('');
  try {
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
}

const parsed = extractJson(content);
const parseFailed = parsed === null;
const p = parsed || {};

// ---------------------------------------------------------------
// 2) Alanları doğrula (modelin döndürdüğüne güvenme)
// ---------------------------------------------------------------
let confidence = String(p.confidence || '').toLowerCase().trim();
if (!CONFIDENCES.includes(confidence)) confidence = 'low';

let summary = typeof p.company_summary === 'string' ? p.company_summary.trim() : '';

const norm = (t) => String(t || '')
  .toLocaleLowerCase('tr-TR')
  .replace(/["'`“”‘’]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const kaynakMetin = norm(kaynak.cleanText);

// ---------------------------------------------------------------
// 3) Kanıt doğrulaması — halüsinasyon koruması.
//    Modelin verdiği alıntı gerçekten site metninde geçiyor mu?
//    Birebir tutmazsa kelime örtüşmesine bakılır (model alıntıyı hafif
//    değiştirmiş olabilir); %70 altındaysa madde elenir.
// ---------------------------------------------------------------
function kanitGecerliMi(kanit) {
  if (!kanit || kanit.length < 10) return false;
  if (!kaynakMetin) return false;
  if (kaynakMetin.includes(kanit)) return true;
  const kelimeler = kanit.split(' ').filter((w) => w.length > 2);
  if (kelimeler.length < 3) return false;
  const bulunan = kelimeler.filter((w) => kaynakMetin.includes(w)).length;
  return bulunan / kelimeler.length >= 0.7;
}

const hamMaddeler = Array.isArray(p.relevant_points) ? p.relevant_points : [];
const maddeler = [];
let dusurulen = 0;

for (const m of hamMaddeler) {
  const point = typeof m === 'string' ? m : (m && m.point);
  const evidence = typeof m === 'string' ? '' : (m && m.evidence);
  if (typeof point !== 'string' || !point.trim()) {
    dusurulen++;
    continue;
  }
  if (!kanitGecerliMi(norm(evidence))) {
    dusurulen++;
    continue;
  }
  maddeler.push({ point: point.trim(), evidence: String(evidence).trim() });
  if (maddeler.length >= MAX_POINTS) break;
}

// Hiçbir madde doğrulanamadıysa güveni bir kademe düşür
if (hamMaddeler.length > 0 && maddeler.length === 0 && confidence !== 'low') {
  confidence = confidence === 'high' ? 'medium' : 'low';
}

// Çekilen sayfa marka adından hiç bahsetmiyorsa muhtemelen yanlış site
const markaIlkKelime = norm(kaynak.brand).split(' ')[0];
if (kaynakMetin.length > 200 && markaIlkKelime.length > 2 && !kaynakMetin.includes(markaIlkKelime)) {
  confidence = 'low';
}

// low => marka hakkında hiçbir spesifik iddia taşınmaz
if (confidence === 'low') {
  summary = '';
  maddeler.length = 0;
}

// ---------------------------------------------------------------
// 4) Açı
// ---------------------------------------------------------------
let angle = String(p.suggested_angle || '').toLowerCase().trim();
if (!ANGLES.includes(angle)) angle = 'brand_visibility';
if (confidence === 'low') angle = 'brand_visibility';

// brand_visibility'ye düşen markaların hepsi aynı metni almasın diye
// marka adından türetilen deterministik alt varyant.
let angleVariant = '';
if (angle === 'brand_visibility') {
  const h = Array.from(String(kaynak.brand || '')).reduce((a, c) => a + c.charCodeAt(0), 0);
  angleVariant = h % 2 === 0 ? 'olcek' : 'profil';
}

// ---------------------------------------------------------------
// 5) E-posta adımına hazır metin blokları
//    (Koşulları burada çözüyoruz ki n8n ifade alanı sade kalsın.)
// ---------------------------------------------------------------
const points_text = maddeler.length
  ? maddeler.map((m) => '- ' + m.point).join('\n')
  : '- Yok';

const brand_block = confidence === 'low'
  ? 'DOĞRULANMIŞ MARKA BİLGİSİ: Yok. Kişiselleştirmeyi yalnızca etkinlik tarafından yap; marka adını sadece hitap düzeyinde kullan.'
  : [
    'DOĞRULANMIŞ MARKA BİLGİLERİ (kaynak: firmanın kendi web sitesi):',
    summary || 'Özet yok',
    'İlgili noktalar:',
    points_text,
  ].join('\n');

const angle_line = angle + (angleVariant ? ' / ' + angleVariant : '');

return {
  json: {
    brand: kaynak.brand,
    kategori: kaynak.kategori || '',

    company_summary: summary,
    relevant_points: maddeler,      // [{ point, evidence }]
    points_text,
    brand_block,                    // e-posta prompt'una doğrudan gider
    suggested_angle: angle,
    angle_variant: angleVariant,
    angle_line,                     // e-posta prompt'una doğrudan gider
    angle_reason: typeof p.angle_reason === 'string' ? p.angle_reason.trim() : '',
    confidence,

    // --- QA alanları: Sheets'e yazın, gönderim kararında kullanın ---
    parse_failed: parseFailed,
    dropped_points: dusurulen,
    needs_review: parseFailed || confidence === 'low' || dusurulen > 0,
    raw_model_output: parseFailed ? String(content).slice(0, 500) : '',
  },
};
