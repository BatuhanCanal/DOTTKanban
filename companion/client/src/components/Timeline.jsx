import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { colorOf } from '../colors.js';

/**
 * Zaman cizelgesi (Gantt benzeri gorunum).
 *
 * Planka kartta yalnizca BITIS tarihi tutar; baslangic tarihi companion'in
 * kendi veritabanindan gelir (bkz. server/routes/boards.js). Bu yuzden:
 *   - baslangici olan kart  -> baslangictan bitise uzanan bir cubuk,
 *   - yalnizca bitisi olan  -> o gune konmus bir kilometre tasi isareti.
 *
 * Hesaplar "takvim gunu" uzerinden yapilir (saat/dakika yok): bir gantt
 * cubugunun iki ucu gun hassasiyetinde anlamlidir ve boylece saat dilimi
 * kaymalari da devre disi kalir.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LABEL_WIDTH = 240;
const NO_LABEL = '__etiketsiz__';

// Yakınlaştırma basamaklari (piksel/gun). Aralik uzunluguna gore otomatik
// secilir; kullanici +/- ile bu merdivende yukari asagi gezinir.
const ZOOM_STEPS = [3, 5, 7, 10, 13, 18, 26, 36, 50];

const pad = (n) => String(n).padStart(2, '0');

/** Herhangi bir tarih degerini yerel takvim gunune ('YYYY-AA-GG') cevirir. */
function dayOf(value) {
  if (!value) return null;
  if (DAY_PATTERN.test(value)) return value;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Gun dizgisini sayiya cevirir; iki gun arasi fark = cikarma. */
function dayNumber(day) {
  const [year, month, date] = day.split('-').map(Number);
  return Math.round(Date.UTC(year, month - 1, date) / DAY_MS);
}

const dayFromNumber = (n) => new Date(n * DAY_MS);

const dayString = (n) => {
  const d = dayFromNumber(n);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** Aralik uzadikca gun genisligi daralir; cok aylik plan da ekrana sigar. */
function autoZoomIndex(span) {
  if (span <= 45) return 6; // 26 px/gun
  if (span <= 100) return 4; // 13
  if (span <= 220) return 2; // 7
  return 0; // 3
}

const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralik',
];

const formatDay = (day) => {
  const date = dayFromNumber(dayNumber(day));
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
};

/** "Ayse Yilmaz" -> "AY" (avatar yerine bas harfler) */
function initials(user) {
  const source = (user.name || user.username || '').trim();

  if (!source) return '?';

  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0].toLocaleUpperCase('tr-TR'))
    .join('');
}

export default function Timeline({
  board,
  plankaUrl,
  onEditDates,
  onShiftDates,
  grupSecenekleri,   // [[değer, etiket],...]: varsayılan pano görünümü
  gosterPanoAdi,     // tüm panolar görünümünde kartın panosunu göster
  saltOkunur,        // tüm panolar görünümü: sürükleme/tarih yaz kapalı
}) {
  const [groupBy, setGroupBy] = useState((grupSecenekleri || [['list']])[0][0]);
  const [hideDone, setHideDone] = useState(false);
  const [zoom, setZoom] = useState(null); // null = otomatik
  const [drag, setDrag] = useState(null); // yalnizca onizleme icin

  const scrollRef = useRef(null);
  const scrolledOnce = useRef(false);
  // Surukleme sonrasi gelen "click" olayini yutmak icin. React durumuna
  // bakamiyoruz: mouseup ve click ayni olay dizisinde pespese gelir, arada
  // React'in yeniden cizmesi garanti degildir - o yuzden senkron bir ref.
  const draggedRef = useRef(false);
  // Suruklemenin gercek durumu burada; asagidaki state yalnizca onizleme cizer.
  const dragRef = useRef(null);

  const bugun = today();

  const model = useMemo(() => {
    const listById = Object.fromEntries(board.lists.map((list) => [list.id, list]));
    const labelById = Object.fromEntries(board.labels.map((label) => [label.id, label]));
    const userById = Object.fromEntries(board.users.map((user) => [user.id, user]));

    const dated = [];
    let undatedCount = 0;
    let doneCount = 0;
    let overdueCount = 0;

    for (const card of board.cards) {
      const due = dayOf(card.dueDate);
      const start = dayOf(card.startDate);

      if (!due && !start) {
        undatedCount += 1;
        continue;
      }

      const overdue = Boolean(due) && due < bugun && !card.isDueCompleted && !card.isIptal;

      if (card.isDueCompleted) doneCount += 1;
      if (overdue) overdueCount += 1;

      if (hideDone && card.isDueCompleted) continue;

      dated.push({
        card,
        // Yalnizca baslangici olup bitisi olmayan kart da cizelgede yer alir:
        // o gun tek gunluk bir cubuk olarak gorunur.
        start: start || due,
        end: due || start,
        isMilestone: !start,
        overdue,
        // Renk once kategoriden (etiket), yoksa durum sutunundan gelir. Ikisi de
        // renksizse gri yerine vurgu rengi: gri, "tamamlandi" gorunumuyle karisir.
        color: card.labelIds.length
          ? colorOf(labelById[card.labelIds[0]]?.color, 'var(--accent)')
          : colorOf(listById[card.listId]?.color, 'var(--accent)'),
        members: card.memberUserIds.map((id) => userById[id]).filter(Boolean),
      });
    }

    const totals = { dated: dated.length, undatedCount, doneCount, overdueCount };

    if (dated.length === 0) {
      return { ...totals, isEmpty: true };
    }

    const first = Math.min(...dated.map((item) => dayNumber(item.start)), dayNumber(bugun)) - 2;
    const last = Math.max(...dated.map((item) => dayNumber(item.end)), dayNumber(bugun)) + 2;

    const byStart = (a, b) => dayNumber(a.start) - dayNumber(b.start);

    // Gruplama, panonun iki ekseniyle ayni mantikta: durum sutunlari ya da
    // kategoriler. Kategoriye gore gruplaninca cok etiketli bir kart birden
    // fazla satirda gorunur - Kanban'daki kategori gorunumuyle tutarli.
    let groups;

    if (groupBy === 'none') {
      groups = [{ id: 'all', title: null, items: [...dated].sort(byStart) }];
    } else if (groupBy === 'pano') {
      const groups0 = new Map();
      for (const item of dated.sort(byStart)) {
        const ad = item.card.boardName || 'Pano';
        let g = groups0.get(ad);
        if (!g) {
          g = { id: ad, title: ad, items: [] };
          groups0.set(ad, g);
        }
        g.items.push(item);
      }
      groups = [...groups0.values()]
        .map((g) => ({ ...g, items: [...g.items].sort(byStart) }))
        .filter((g) => g.items.length > 0);
    } else if (groupBy.startsWith && groupBy.startsWith('grup:')) {
      const grupId = groupBy.replace('grup:', '');
      const gruplar = (board.groups || []).filter((g) => String(g.id) === String(grupId));
      const grup = gruplar[0];
      groups = [
        {
          id: `grup:${grupId}`,
          title: grup ? grup.name : 'Grup',
          items: dated.filter((item) => item.card.groups && item.card.groups[grupId]).sort(byStart),
        },
      ].filter((g) => g.items.length > 0);
    } else if (groupBy === 'label') {
      groups = [
        ...board.labels.map((label) => ({
          id: label.id,
          title: label.name || 'Isimsiz etiket',
          color: label.color,
          items: dated.filter((item) => item.card.labelIds.includes(label.id)).sort(byStart),
        })),
        {
          id: NO_LABEL,
          title: 'Etiketsiz',
          items: dated.filter((item) => item.card.labelIds.length === 0).sort(byStart),
        },
      ].filter((group) => group.items.length > 0);
    } else {
      groups = board.lists
        .map((list) => ({
          id: list.id,
          title: list.name,
          items: dated.filter((item) => item.card.listId === list.id).sort(byStart),
        }))
        .filter((group) => group.items.length > 0);
    }

    return { ...totals, groups, first, last, span: last - first + 1, isEmpty: false };
  }, [board, groupBy, hideDone, bugun]);

  const dragging = Boolean(drag);

  const zoomIndex = zoom === null ? autoZoomIndex(model.span || 60) : zoom;
  const ppd = ZOOM_STEPS[Math.min(Math.max(zoomIndex, 0), ZOOM_STEPS.length - 1)];

  // Ay bantlari, gun etiketleri ve arka plan izgarasi yalnizca olcege ve
  // araliga baglidir; gruplama degisince yeniden hesaplanmasi gerekmez.
  const axis = useMemo(() => {
    if (model.isEmpty) return null;

    const { first, last } = model;
    const months = [];
    const ticks = [];
    const weekLines = [];
    const monthLines = [];
    const weekends = [];

    for (let n = first; n <= last; n += 1) {
      const date = dayFromNumber(n);
      const offset = (n - first) * ppd;
      const isMonday = date.getUTCDay() === 1;
      const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
      const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
      const current = months[months.length - 1];

      if (current && current.key === key) {
        current.days += 1;
      } else {
        months.push({
          key,
          days: 1,
          label: `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`,
        });

        if (n !== first) monthLines.push(offset);
      }

      // Genis olcekte her gun, dar olcekte hafta baslari, en dar olcekte
      // yalnizca ay baslari yazilir - yoksa rakamlar ust uste biner.
      if (ppd >= 20 || (isMonday && ppd >= 7) || (date.getUTCDate() === 1 && ppd < 7)) {
        ticks.push({ offset, label: String(date.getUTCDate()), isMonday });
      }

      if (isMonday) weekLines.push(offset);
      if (isWeekend && ppd >= 10) weekends.push({ offset, width: ppd });
    }

    return {
      months,
      ticks,
      weekLines,
      monthLines,
      weekends,
      width: model.span * ppd,
      todayOffset: (dayNumber(bugun) - first) * ppd,
    };
  }, [model, ppd, bugun]);

  const scrollToToday = useCallback(
    (behavior = 'smooth') => {
      if (!scrollRef.current || !axis) return;

      scrollRef.current.scrollTo({
        left: Math.max(0, LABEL_WIDTH + axis.todayOffset - scrollRef.current.clientWidth / 3),
        behavior,
      });
    },
    [axis],
  );

  // Ilk acilista bugune kaydir: uzun planlarda bugun ekranin disinda kalabilir
  // ve kullanici bos bir gecmise bakiyormus gibi olur.
  useLayoutEffect(() => {
    if (scrolledOnce.current || !axis) return;

    scrolledOnce.current = true;
    scrollToToday('auto');
  }, [axis, scrollToToday]);

  // --- Cubuk surukleme ------------------------------------------------------
  // Cubugu tutup kaydirmak iki tarihi birlikte oteler; uclarindan tutmak tek
  // tarihi degistirir. Gun hassasiyetinde yuvarlanir, birakilinca kaydedilir.
  //
  // Suruklemenin kendisi dragRef'te tutulur, React durumunda DEGIL: mouseup ve
  // click ayni olay dizisinde pespese gelir ve React'in arada yeniden cizmesi
  // garanti degildir. Durum yalnizca ekranda onizleme cizmek icin var.
  useEffect(() => {
    if (!dragging) return undefined;

    const onMove = (event) => {
      const current = dragRef.current;

      if (!current) return;

      const deltaDays = Math.round((event.clientX - current.clientX) / ppd);
      let start = dayNumber(current.origin.start);
      let end = dayNumber(current.origin.end);

      if (current.mode === 'move') {
        start += deltaDays;
        end += deltaDays;
      } else if (current.mode === 'start') {
        start = Math.min(start + deltaDays, end);
      } else {
        end = Math.max(end + deltaDays, start);
      }

      if (Math.abs(event.clientX - current.clientX) > 3) {
        current.moved = true;
        draggedRef.current = true;
      }

      current.start = dayString(start);
      current.end = dayString(end);
      setDrag({ ...current });
    };

    const onUp = () => {
      const current = dragRef.current;

      dragRef.current = null;
      setDrag(null);

      if (current && current.moved) {
        onShiftDates(current.card, {
          // Kartta olmayan bir tarih surukleme ile dogmaz: yalnizca bitisi olan
          // kart yine yalnizca bitisi olan kart olarak kalir.
          startDate: current.card.startDate ? current.start : null,
          dueDate: current.card.dueDate ? current.end : null,
        });
      }
    };

    const onKey = (event) => {
      if (event.key !== 'Escape') return;

      dragRef.current = null;
      draggedRef.current = false;
      setDrag(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [dragging, ppd, onShiftDates]);

  const startDrag = (event, item, mode) => {
    if (saltOkunur) return;
    if (event.button !== 0) return;

    event.preventDefault();
    draggedRef.current = false;
    dragRef.current = {
      cardId: item.card.id,
      card: item.card,
      mode,
      clientX: event.clientX,
      origin: { start: item.start, end: item.end },
      start: item.start,
      end: item.end,
      moved: false,
    };
    setDrag(dragRef.current);
  };

  /** Surukleme ile biten tiklamayi yutar; gercek tiklama tarih kutusunu acar. */
  const handleBarClick = (card) => {
    if (saltOkunur || !onEditDates) return;
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }

    onEditDates(card);
  };

  if (model.isEmpty) {
    return (
      <div className="alert alert-info">
        {hideDone && model.doneCount > 0
          ? 'Tamamlananlar gizliyken gosterilecek kart kalmadi. '
          : 'Bu panoda tarihi olan kart yok. Bir karta Planka’da bitis tarihi verin ya da ' +
            '“Duruma gore” gorunumunden kartin tarihlerini duzenleyin; tarihli kartlar ' +
            'burada zaman ekseninde gorunecek.'}
        {hideDone && (
          <button type="button" className="linklike" onClick={() => setHideDone(false)}>
            Tamamlananları göster
          </button>
        )}
      </div>
    );
  }

  const { groups, first } = model;
  const { months, ticks, weekLines, monthLines, weekends, width, todayOffset } = axis;

  return (
    <>
      <div className="tl-toolbar">
        <label className="tl-control">
          <span>Gruplama</span>
          <select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}>
            <option value="list">Duruma gore</option>
            <option value="label">Kategoriye gore</option>
            <option value="none">Gruplamadan</option>
          </select>
        </label>

        <div className="tl-control">
          <span>Ölçek</span>
          <div className="tl-zoom">
            <button
              type="button"
              onClick={() => setZoom(Math.max(zoomIndex - 1, 0))}
              disabled={zoomIndex === 0}
              title="Uzaklaştır"
              aria-label="Uzaklaştır"
            >
              &minus;
            </button>
            <button
              type="button"
              onClick={() => setZoom(Math.min(zoomIndex + 1, ZOOM_STEPS.length - 1))}
              disabled={zoomIndex === ZOOM_STEPS.length - 1}
              title="Yakınlaştır"
              aria-label="Yakınlaştır"
            >
              +
            </button>
            {zoom !== null && (
              <button type="button" onClick={() => setZoom(null)} title="Otomatik olcege don">
                sığdır
              </button>
            )}
          </div>
        </div>

        <label className="tl-control tl-check">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(event) => setHideDone(event.target.checked)}
          />
          <span>Tamamlananları gizle</span>
        </label>

        <button type="button" className="btn btn-sm" onClick={() => scrollToToday()}>
          Bugüne git
        </button>

        <div className="spacer" />

        <div className="tl-summary">
          <span>{model.dated} tarihli görev</span>
          {model.overdueCount > 0 && (
            <span className="is-overdue">{model.overdueCount} gecikmiş</span>
          )}
          {model.doneCount > 0 && <span>{model.doneCount} tamamlandi</span>}
          {model.undatedCount > 0 && <span className="muted">{model.undatedCount} tarihsiz</span>}
        </div>
      </div>

      <div className={`tl-scroll ${drag ? 'is-dragging' : ''}`} ref={scrollRef}>
        <div className="tl-inner" style={{ width: LABEL_WIDTH + width }}>
          <div className="tl-head">
            <div className="tl-label tl-head-label">Görev</div>
            <div className="tl-track tl-head-track" style={{ width }}>
              <div className="tl-months">
                {months.map((month) => (
                  <div key={month.key} className="tl-month" style={{ width: month.days * ppd }}>
                    <span>{month.label}</span>
                  </div>
                ))}
              </div>
              <div className="tl-ticks">
                {ticks.map((tick) => (
                  <div
                    key={tick.offset}
                    className={`tl-tick ${tick.isMonday ? 'is-week' : ''}`}
                    style={{ left: tick.offset }}
                  >
                    <span>{tick.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Arka plan izgarasi: hafta sonlari, hafta ve ay cizgileri. */}
          <div className="tl-grid" style={{ left: LABEL_WIDTH, width }}>
            {weekends.map((weekend) => (
              <div
                key={`w${weekend.offset}`}
                className="tl-weekend"
                style={{ left: weekend.offset, width: weekend.width }}
              />
            ))}
            {weekLines.map((offset) => (
              <div key={`l${offset}`} className="tl-weekline" style={{ left: offset }} />
            ))}
            {monthLines.map((offset) => (
              <div key={`m${offset}`} className="tl-monthline" style={{ left: offset }} />
            ))}
          </div>

          {todayOffset >= 0 && (
            <div className="tl-today" style={{ left: LABEL_WIDTH + todayOffset }}>
              <span>bugun</span>
            </div>
          )}

          {groups.map((group) => (
            <div key={group.id}>
              {group.title && (
                <div className="tl-group">
                  <div className="tl-label tl-group-label">
                    {groupBy === 'label' && (
                      <span
                        className="column-swatch"
                        style={{ background: group.color ? colorOf(group.color) : 'var(--border)' }}
                      />
                    )}
                    <span className="tl-group-title">{group.title}</span>
                    <span className="tl-group-count">{group.items.length}</span>
                  </div>
                  <div className="tl-track" style={{ width }} />
                </div>
              )}

              {group.items.map((item) => {
                const dragging = drag && drag.cardId === item.card.id;
                const start = dragging ? drag.start : item.start;
                const end = dragging ? drag.end : item.end;
                const left = (dayNumber(start) - first) * ppd;
                const days = dayNumber(end) - dayNumber(start) + 1;
                const barWidth = Math.max(days * ppd, 6);
                const progress =
                  item.card.tasksTotal > 0
                    ? item.card.tasksCompleted / item.card.tasksTotal
                    : null;
                const state = [
                  item.card.isIptal ? 'is-iptal' : '',
                  item.card.isDueCompleted ? 'is-done' : '',
                  item.overdue ? 'is-overdue' : '',
                  dragging ? 'is-moving' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                const hint = item.isMilestone
                  ? `${item.card.name} — bitis ${formatDay(end)} (başlangıç verilmemiş)`
                  : `${item.card.name} — ${formatDay(start)} → ${formatDay(end)} (${days} gun)`;

                return (
                  <div className="tl-row" key={`${group.id}::${item.card.id}`}>
                    <div className="tl-label">
                      <a
                        className="tl-name"
                        href={`${plankaUrl}/cards/${item.card.id}`}
                        target="_blank"
                        rel="noreferrer"
                        title={item.card.name}
                      >
                        {item.card.name}
                      </a>
                      {item.card.tasksTotal > 0 && (
                        <span className="tl-tasks" title="Kontrol listesi">
                          {item.card.tasksCompleted}/{item.card.tasksTotal}
                        </span>
                      )}
                      {gosterPanoAdi && item.card.boardName && (
                        <span className="tl-tasks" title="Panosu">
                          {item.card.projectName} · {item.card.boardName}
                        </span>
                      )}
                      {item.members.map((user) => (
                        <span
                          key={user.id}
                          className="tl-avatar"
                          title={user.name || user.username}
                        >
                          {initials(user)}
                        </span>
                      ))}
                    </div>

                    <div className="tl-track" style={{ width }}>
                      {item.isMilestone ? (
                        <button
                          type="button"
                          className={`tl-milestone ${state}`}
                          style={{ left: left + ppd / 2, background: item.color }}
                          onMouseDown={(event) => startDrag(event, item, 'move')}
                          onClick={() => handleBarClick(item.card)}
                          title={hint}
                        />
                      ) : (
                        <div
                          className={`tl-bar ${state}`}
                          style={{ left, width: barWidth, background: item.color }}
                          title={hint}
                        >
                          {progress !== null && (
                            <span className="tl-progress" style={{ width: `${progress * 100}%` }} />
                          )}

                          <button
                            type="button"
                            className="tl-bar-body"
                            onMouseDown={(event) => startDrag(event, item, 'move')}
                            onClick={() => handleBarClick(item.card)}
                          >
                            {barWidth > 60 && <span>{item.card.name}</span>}
                          </button>

                          <span
                            className="tl-handle tl-handle-start"
                            onMouseDown={(event) => startDrag(event, item, 'start')}
                            title="Başlangıç tarihini degistir"
                          />
                          <span
                            className="tl-handle tl-handle-end"
                            onMouseDown={(event) => startDrag(event, item, 'end')}
                            title="Bitis tarihini degistir"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="tl-legend muted small">
        <span>
          <i className="tl-swatch" /> başlangıç → bitiş
        </span>
        <span>
          <i className="tl-swatch tl-swatch-diamond" /> yalnızca bitiş tarihi var
        </span>
        <span>
          <i className="tl-swatch tl-swatch-done" /> tamamlandi
        </span>
        <span>
          <i className="tl-swatch tl-swatch-progress" /> koyu bölüm: biten kontrol listesi
        </span>
        <span>Çubuğu sürükleyin, uclarindan boyutlandirin veya tiklayip tarihleri yazin.</span>
      </div>
    </>
  );
}
