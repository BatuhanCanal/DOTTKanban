#!/usr/bin/env bash
#
# DOTT Kanban yedekleme.
#
# Veri UC ayri yerde durur; ucu birden alinmazsa yedek ise yaramaz:
#   1. postgres  -> Planka'nin tum verisi (projeler, panolar, kartlar, yorumlar)
#   2. planka-data -> yuklenen dosyalar ve kart ekleri
#   3. companion-data -> companion'in sablonlari (SQLite)
#
# Kullanim:  ./scripts/yedek-al.sh [hedef-dizin]
# Varsayilan hedef: ./yedekler
#
# Servisler bu deponun docker-compose.yml'inde degil de baska bir compose
# dosyasindaysa (orn. companion mevcut bir Planka kurulumuna eklendiyse), o
# dizini COMPOSE_DIR ile verin:
#   COMPOSE_DIR=/opt/planka ./scripts/yedek-al.sh /mnt/yedek
#
# Servisler CALISIRKEN calistirilabilir: postgres icin pg_dump, SQLite icin
# "VACUUM INTO" kullanilir; ikisi de tutarli bir anlik goruntu verir.

set -euo pipefail

# Yedek dosyalari komutun calistirildigi dizine gore yazilir, docker compose
# ise COMPOSE_DIR'de calistirilir (varsayilan: bu deponun koku).
HEDEF_KOK="$PWD"
cd "${COMPOSE_DIR:-$(dirname "$0")/..}"

HEDEF="${1:-$HEDEF_KOK/yedekler}"
case "$HEDEF" in /*) ;; *) HEDEF="$HEDEF_KOK/$HEDEF" ;; esac
DAMGA="$(date +%Y-%m-%d_%H%M)"
DIZIN="$HEDEF/$DAMGA"

if ! docker compose ps --status running --services | grep -qx postgres; then
  echo "HATA: $(pwd) dizinindeki compose yiginida calisan bir 'postgres' servisi yok." >&2
  echo "      Yigin baska bir dizindeyse: COMPOSE_DIR=/o/dizin $0 $*" >&2
  exit 1
fi

mkdir -p "$DIZIN"
echo "Yedek dizini: $DIZIN"

# 1. Planka veritabani -----------------------------------------------------
echo "-> postgres (Planka verisi)"
docker compose exec -T postgres pg_dump -U postgres -d planka --clean --if-exists \
  | gzip > "$DIZIN/planka-db.sql.gz"

# 2. Planka dosyalari (ekler, avatarlar) -----------------------------------
echo "-> planka-data (yuklenen dosyalar)"
docker compose exec -T planka tar -C /app/data -cf - . | gzip > "$DIZIN/planka-data.tar.gz"

# 3. Companion sablonlari --------------------------------------------------
# VACUUM INTO, WAL modundaki bir SQLite'i durdurmadan tutarli sekilde kopyalar.
echo "-> companion-data (sablonlar)"
docker compose exec -T companion node -e "
  const { DatabaseSync } = require('node:sqlite');
  const fs = require('fs');
  fs.rmSync('/tmp/yedek.db', { force: true });
  new DatabaseSync(process.env.DATABASE_PATH).exec(\"VACUUM INTO '/tmp/yedek.db'\");
"
docker compose exec -T companion cat /tmp/yedek.db > "$DIZIN/companion.db"
docker compose exec -T companion rm -f /tmp/yedek.db

echo
echo "Bitti:"
du -sh "$DIZIN"/* | sed 's/^/  /'
echo
echo "Bu dizini baska bir makineye/diske kopyalayin; ayni sunucuda durursa yedek sayilmaz."
