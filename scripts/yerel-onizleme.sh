#!/usr/bin/env bash
#
# DOTT Kanban — Docker'sız yerel önizleme.
#
# Ne yapar:
#   1) Arayüz derlenmemişse derler,
#   2) sahte Planka'yı (companion/dev/planka-mock.js) başlatır,
#   3) companion'ı sahte Planka'ya yönlendirip başlatır,
#   4) Ctrl+C ile çıkınca ikisini birden kapatır.
#
# GEREKSİNİM: yalnızca Node. Docker, PostgreSQL veya sudo gerekmez.
#
# NOT: Sahte Planka verileri bellekte tutar — çıkınca sıfırlanır. Companion'ın
# kendi veritabanı (şablonlar, başlangıç tarihleri, etiket türleri) ise diskte
# kalır: companion/data/onizleme.db
#
# Kullanım:
#   ./scripts/yerel-onizleme.sh
#
set -euo pipefail

KOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$KOK/companion"

MOCK_PORT="${MOCK_PORT:-1337}"
PORT="${PORT:-3001}"

if ! command -v node > /dev/null 2>&1; then
  echo "HATA: node bulunamadı." >&2
  exit 1
fi

# --- 1) Arayüz derlenmiş mi? ------------------------------------------------
if [ ! -f client/dist/index.html ]; then
  echo "Arayüz derlenmemiş, derleniyor..."
  npm --prefix client install
  npm --prefix client run build
fi

# Sunucu bağımlılıkları (express, cookie-parser)
if [ ! -d node_modules/express ]; then
  echo "Sunucu bağımlılıkları kuruluyor..."
  npm install --omit=dev
fi

# --- 2) Sahte Planka --------------------------------------------------------
MOCK_PORT="$MOCK_PORT" node dev/planka-mock.js &
MOCK_PID=$!

# Çıkışta iki süreci de kapat. (companion ön planda çalıştığı için Ctrl+C
# doğrudan ona gider; bu tuzak sahte sunucuyu da temizler.)
temizle() {
  kill "$MOCK_PID" 2> /dev/null || true
  echo
  echo "Kapatıldı."
}
trap temizle EXIT

# Sahte sunucunun açılmasını bekle
for _ in $(seq 1 20); do
  if curl -sf "http://localhost:${MOCK_PORT}/api/users/me" > /dev/null 2>&1 || \
     curl -s -o /dev/null "http://localhost:${MOCK_PORT}/api/projects"; then
    break
  fi
  sleep 0.2
done

echo
echo "──────────────────────────────────────────────────────────"
echo "  Companion : http://localhost:${PORT}"
echo "  (Planka bağlantısı: sahte Planka :${MOCK_PORT})"
echo
echo "  Giriş: herhangi bir kullanıcı adı + şifre"
echo "    admin / admin  → yönetici (Etiket Türleri menüsü görünür)"
echo "    ayse  / 1234   → normal üye"
echo "──────────────────────────────────────────────────────────"
echo "  İpucu: Gantt'ta çubuk (elmas değil) görmek için karta BAŞLANGIÇ tarihi"
echo "         verin — karttaki tarih rozetine tıklayıp doldurun. Başlangıç yoksa"
echo "         kart tek günlük elmas işareti olarak çizilir (Planka başlangıç tutmaz,"
echo "         o tarih companion'da saklanır)."
echo "  İpucu: Elmas/sütun gruplamasını 'Ekip' ve 'Etkinlik Türü' olarak ikiye"
echo "         ayırmak için önce /admin sayfasından etiket türlerini tanımlayın."
echo "──────────────────────────────────────────────────────────"
echo

# --- 3) Companion -----------------------------------------------------------
PLANKA_INTERNAL_URL="http://localhost:${MOCK_PORT}" \
PLANKA_PUBLIC_URL="http://localhost:${MOCK_PORT}" \
DATABASE_PATH="$KOK/companion/data/onizleme.db" \
PORT="$PORT" \
node server/index.js
