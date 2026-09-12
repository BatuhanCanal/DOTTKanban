import { useMemo } from 'react';

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
const LABEL_WIDTH = 220;
const ROW_HEIGHT = 30;

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

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/**
 * Gun genisligi: aralik uzadikca daralir, boylece cok aylik bir plan da
 * yatay kaydirma cilesine donusmeden ekrana sigar.
 */
function pixelsPerDay(span) {
  if (span <= 45) return 26;
  if (span <= 100) return 13;
  if (span <= 220) return 7;
  return 4;
}

const MONTHS = [
  'Ocak', 'Subat', 'Mart', 'Nisan', 'Mayis', 'Haziran',
  'Temmuz', 'Agustos', 'Eylul', 'Ekim', 'Kasim', 'Aralik',
];

const formatDay = (day) => {
  const date = dayFromNumber(dayNumber(day));
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
};

export default function Timeline({ board, plankaUrl, onEditDates }) {
  const model = useMemo(() => {
    const listById = Object.fromEntries(board.lists.map((list) => [list.id, list]));
    const labelById = Object.fromEntries(board.labels.map((label) => [label.id, label]));

    const dated = [];
    let undatedCount = 0;

    for (const card of board.cards) {
      const due = dayOf(card.dueDate);
      const start = dayOf(card.startDate);

      if (!due && !start) {
        undatedCount += 1;
        continue;
      }

      dated.push({
        card,
        // Yalnizca baslangici olup bitisi olmayan kart da cizelgede yer alir:
        // o gun tek gunluk bir cubuk olarak gorunur.
        start: start || due,
        end: due || start,
        isMilestone: !start,
        // Renk once kategoriden (etiket), yoksa durum sutunundan gelir. Ikisi de
        // renksizse gri yerine vurgu rengi: gri, "tamamlandi" gorunumuyle karisir.
        color: card.labelIds.length
          ? colorOf(labelById[card.labelIds[0]]?.color, 'var(--accent)')
          : colorOf(listById[card.listId]?.color, 'var(--accent)'),
      });
    }

    if (dated.length === 0) {
      return { rows: [], undatedCount, isEmpty: true };
    }

    const bugun = today();
    const starts = dated.map((item) => dayNumber(item.start));
    const ends = dated.map((item) => dayNumber(item.end));

    // Bugun her zaman gorunur olsun: "gecmis" ve "gelecek" bir arada okunur.
    const first = Math.min(...starts, dayNumber(bugun)) - 2;
    const last = Math.max(...ends, dayNumber(bugun)) + 2;
    const span = last - first + 1;
    const ppd = pixelsPerDay(span);

    // Satirlar durum sutunlarina gore gruplanir; grup ici siralama tarihe gore.
    const groups = board.lists
      .map((list) => ({
        id: list.id,
        title: list.name,
        items: dated
          .filter((item) => item.card.listId === list.id)
          .sort((a, b) => dayNumber(a.start) - dayNumber(b.start)),
      }))
      .filter((group) => group.items.length > 0);

    // Ay bantlari (baslik satiri).
    const months = [];

    for (let n = first; n <= last; n += 1) {
      const date = dayFromNumber(n);
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
      }
    }

    // Baslik satirindaki gun etiketleri: genis olcekte her gun, dar olcekte
    // yalnizca hafta baslari yazilir (yoksa rakamlar ust uste biner).
    const ticks = [];
    // Arka plandaki hafta cizgileri ve hafta sonu golgesi ayri bir katmanda
    // cizilir; boylece tum satirlarin boyunca uzanirlar.
    const weekLines = [];
    const weekends = [];

    for (let n = first; n <= last; n += 1) {
      const date = dayFromNumber(n);
      const offset = (n - first) * ppd;
      const isMonday = date.getUTCDay() === 1;
      const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;

      if (ppd >= 20 || isMonday) {
        ticks.push({ offset, label: String(date.getUTCDate()), isMonday });
      }

      if (isMonday) {
        weekLines.push(offset);
      }

      if (isWeekend && ppd >= 10) {
        weekends.push({ offset, width: ppd });
      }
    }

    return {
      groups,
      months,
      ticks,
      weekLines,
      weekends,
      first,
      span,
      ppd,
      width: span * ppd,
      todayOffset: (dayNumber(bugun) - first) * ppd,
      undatedCount,
      isEmpty: false,
    };
  }, [board]);

  if (model.isEmpty) {
    return (
      <div className="alert alert-info">
        Bu panoda tarihi olan kart yok. Bir karta Planka'da bitis tarihi verin ya da buradaki
        &ldquo;Duruma gore&rdquo; gorunumunden kartin tarihlerini duzenleyin; tarihli kartlar
        burada zaman ekseninde gorunecek.
      </div>
    );
  }

  const { groups, months, ticks, weekLines, weekends, first, ppd, width, todayOffset, undatedCount } =
    model;

  return (
    <>
      <div className="tl-scroll">
        <div className="tl-inner" style={{ width: LABEL_WIDTH + width }}>
          <div className="tl-head">
            <div className="tl-label tl-head-label">Gorev</div>
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

          {/* Arka plan izgarasi: hafta sonlari ve hafta baslangic cizgileri. */}
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
          </div>

          {todayOffset >= 0 && (
            <div className="tl-today" style={{ left: LABEL_WIDTH + todayOffset }}>
              <span>bugun</span>
            </div>
          )}

          {groups.map((group) => (
            <div key={group.id}>
              <div className="tl-group">
                <div className="tl-label tl-group-label">{group.title}</div>
                <div className="tl-track" style={{ width }} />
              </div>

              {group.items.map((item) => {
                const startAt = (dayNumber(item.start) - first) * ppd;
                const days = dayNumber(item.end) - dayNumber(item.start) + 1;
                const overdue =
                  !item.card.isDueCompleted && item.card.dueDate && dayOf(item.card.dueDate) < today();

                return (
                  <div className="tl-row" key={item.card.id} style={{ height: ROW_HEIGHT }}>
                    <div className="tl-label" title={item.card.name}>
                      <a
                        href={`${plankaUrl}/cards/${item.card.id}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Karti Planka'da ac"
                      >
                        {item.card.name}
                      </a>
                    </div>

                    <div className="tl-track" style={{ width }}>
                      {item.isMilestone ? (
                        <button
                          type="button"
                          className={`tl-milestone ${item.card.isDueCompleted ? 'is-done' : ''} ${
                            overdue ? 'is-overdue' : ''
                          }`}
                          style={{ left: startAt + ppd / 2, background: item.color }}
                          onClick={() => onEditDates(item.card)}
                          title={`${item.card.name} — bitis ${formatDay(item.end)} (baslangic verilmemis)`}
                        />
                      ) : (
                        <button
                          type="button"
                          className={`tl-bar ${item.card.isDueCompleted ? 'is-done' : ''} ${
                            overdue ? 'is-overdue' : ''
                          }`}
                          style={{ left: startAt, width: Math.max(days * ppd, 6), background: item.color }}
                          onClick={() => onEditDates(item.card)}
                          title={`${item.card.name} — ${formatDay(item.start)} → ${formatDay(item.end)} (${days} gun)`}
                        >
                          {days * ppd > 60 && <span>{item.card.name}</span>}
                        </button>
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
          <i className="tl-swatch" /> baslangic → bitis
        </span>
        <span>
          <i className="tl-swatch tl-swatch-diamond" /> yalnizca bitis tarihi var
        </span>
        <span>
          <i className="tl-swatch tl-swatch-done" /> tamamlandi
        </span>
        <span>Cubuga tiklayinca tarihleri duzenlersiniz.</span>
        {undatedCount > 0 && <span>{undatedCount} kartin tarihi yok, cizelgede gorunmuyor.</span>}
      </div>
    </>
  );
}
