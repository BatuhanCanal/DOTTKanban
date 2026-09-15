#!/usr/bin/env bash
#
# DOTT Kanban — yerel kurulum yardımcısı.
#
# Ne yapar:
#   1) Docker var mı bakar (yoksa Arch için kurulum komutunu söyler),
#   2) .env yoksa .env.example'dan oluşturur ve SECRET_KEY'i rastgele üretir,
#   3) yönetici e-posta/şifresini sorar (boş geçilirse rastgele güçlü şifre üretir),
#   4) docker compose up -d ile Planka + Postgres + companion'ı başlatır,
#   5) giriş bilgilerini ve adresleri yazar.
#
# ÖNEMLİ: .env zaten varsa ÜZERİNE YAZMAZ — mevcut kurulumu bozmaz.
#
# Kullanım:
#   ./scripts/yerel-kur.sh
#
set -euo pipefail

KOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$KOK"

echo "DOTT Kanban — yerel kurulum"
echo "dizin: $KOK"
echo

# --- 1) Docker kontrolü ------------------------------------------------------
if ! command -v docker > /dev/null 2>&1; then
  echo "HATA: docker kurulu değil."
  echo
  echo "Arch Linux'ta kurmak için:"
  echo "  sudo pacman -S docker docker-compose"
  echo "  sudo systemctl enable --now docker"
  echo "  sudo usermod -aG docker \$USER    # sonra oturumu kapatıp açın"
  echo
  echo "Kurduktan sonra bu script'i tekrar çalıştırın."
  exit 1
fi

if ! docker info > /dev/null 2>&1; then
  echo "HATA: docker çalışıyor ama erişilemiyor (servis kapalı veya yetki yok)."
  echo "  sudo systemctl start docker"
  echo "  (grupsuz kullanıyorsanız: sudo usermod -aG docker \$USER, sonra oturumu yenileyin)"
  exit 1
fi

# compose: yeni 'docker compose' ya da eski 'docker-compose'
if docker compose version > /dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose > /dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "HATA: docker compose bulunamadı. Kurun: sudo pacman -S docker-compose"
  exit 1
fi

echo "docker: OK ($COMPOSE)"
echo

# --- 2) .env -----------------------------------------------------------------
if [ -f .env ]; then
  echo ".env zaten var — dokunulmadı."
  echo "Mevcut yönetici bilgileri:"
  grep -E '^PLANKA_ADMIN_(EMAIL|USERNAME|PASSWORD)=' .env | sed 's/^/  /' || true
  echo
  echo "NOT: .env'deki şifre yalnızca İLK kurulumda geçerlidir. Sonradan Planka"
  echo "     arayüzünden değiştirdiyseniz buradaki değer eski kalır."
  echo
else
  echo "Yönetici hesabı oluşturulacak."
  read -r -p "  E-posta [admin@dott.local]: " ADMIN_EMAIL
  ADMIN_EMAIL="${ADMIN_EMAIL:-admin@dott.local}"

  read -r -p "  Kullanıcı adı [admin]: " ADMIN_USER
  ADMIN_USER="${ADMIN_USER:-admin}"

  read -r -s -p "  Şifre (boş bırakırsanız güçlü bir şifre üretilir): " ADMIN_PASS
  echo

  if [ -z "$ADMIN_PASS" ]; then
    # openssl varsa onu, yoksa Node'u kullan (ikisi de hemen hemen her zaman var)
    if command -v openssl > /dev/null 2>&1; then
      ADMIN_PASS="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
      SECRET_KEY="$(openssl rand -hex 32)"
    else
      ADMIN_PASS="$(node -e "process.stdout.write(require('crypto').randomBytes(16).toString('base64url').slice(0,20))")"
      SECRET_KEY="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
    fi
    URETILDI=1
  else
    if command -v openssl > /dev/null 2>&1; then
      SECRET_KEY="$(openssl rand -hex 32)"
    else
      SECRET_KEY="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
    fi
    URETILDI=0
  fi

  sed \
    -e "s|^PLANKA_SECRET_KEY=.*|PLANKA_SECRET_KEY=${SECRET_KEY}|" \
    -e "s|^PLANKA_ADMIN_EMAIL=.*|PLANKA_ADMIN_EMAIL=${ADMIN_EMAIL}|" \
    -e "s|^PLANKA_ADMIN_USERNAME=.*|PLANKA_ADMIN_USERNAME=${ADMIN_USER}|" \
    -e "s|^PLANKA_ADMIN_PASSWORD=.*|PLANKA_ADMIN_PASSWORD=${ADMIN_PASS}|" \
    .env.example > .env

  chmod 600 .env
  echo
  echo ".env oluşturuldu (izinler 600 — sadece siz okuyabilirsiniz)."
  echo
  echo "  ┌──────────────────────────────────────────────────"
  echo "  │ YÖNETİCİ GİRİŞİ (bunları kaydedin)"
  echo "  │   E-posta      : ${ADMIN_EMAIL}"
  echo "  │   Kullanıcı adı: ${ADMIN_USER}"
  echo "  │   Şifre        : ${ADMIN_PASS}"
  echo "  └──────────────────────────────────────────────────"
  if [ "${URETILDI:-0}" = "1" ]; then
    echo "  (şifre üretildi — bu ekranı kaybetmeyin; .env içinde de duruyor)"
  fi
  echo
fi

# --- 3) Başlat ---------------------------------------------------------------
echo "Servisler başlatılıyor (ilk seferde imajların indirilmesi birkaç dakika sürer)..."
$COMPOSE up -d

echo
echo "Durum:"
$COMPOSE ps
echo
echo "Hazır olduğunda:"
echo "  Planka  (önce buraya girin) : http://localhost:3000"
echo "  Companion                   : http://localhost:3001"
echo
echo "İLK GİRİŞ SIRASI ÖNEMLİ:"
echo "  1) Önce http://localhost:3000 adresine yönetici bilgileriyle girin ve"
echo "     kullanım şartlarını kabul edin (Planka bunu yalnızca burada sorar)."
echo "  2) Sonra http://localhost:3001 adresine AYNI hesapla girin."
echo
echo "Logları izlemek için: $COMPOSE logs -f companion"
