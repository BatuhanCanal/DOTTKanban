#!/usr/bin/env bash
#
# Blok dokularını indirir ve client/public/textures/ altına yazar.
#
# KAYNAK
#   InventivetalentDev/minecraft-assets — Minecraft .jar dosyalarından
#   ayıklanmış resmî vanilya dokuları. Dal adı = Minecraft sürümü.
#
#   https://github.com/InventivetalentDev/minecraft-assets
#
# KULLANILAN BLOKLAR (Block Palette #9727'nin adlandırduğu bloklar):
#   blackstone.png            Blackstone
#   gilded-blackstone.png     Gilded Blackstone (altin pulu dis tas)
#   quartz-block.png          Quartz Block (kucuk kuvars blogu)
#   gold-block.png            Gold Block (altin blogu)
#   soul-soil.png             Soul Soil (ruh topragi)
#   soul-sand.png             Soul Sand (ruh kumu)
#
# LISANS: Dokular Mojang'un teliflidir. Resmi KIstin:
#   - E-devlete/public arbive icin YAPMA (mojang.com/terms).
#   Buradaki amaç yerel/topluluk iç kullanım.
#
# Kullanim:
#   ./scripts/doku-indir.sh
#   ./scripts/doku-indir.sh 1.20.4     # baska bir Minecraft sürümü
#
set -euo pipefail

DOKU_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/companion/client/public/textures"
SURUM="${1:-1.21.11}"
KAYNAK="https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/${SURUM}/assets/minecraft/textures/block"

# KULLANILAN BLOKLAR (Block Palette #9727'nin adlandırdığı bloklar).
# Biçim: "yerel_azı : gidecek_dosya" — tarayıcı tablo adları zaten alt çizgili.
BLOKLAR=(
  "blackstone.png|blackstone.png"
  "gilded-blackstone.png|gilded_blackstone.png"
  "quartz-block.png|quartz_block_side.png"
  "gold-block.png|gold_block.png"
  "soul-soil.png|soul_soil.png"
  "soul-sand.png|soul_sand.png"
)

echo "Minecraft ${SURUM} vanilya dokuları indiriliyor..."
echo "  kaynak: ${KAYNAK}"
echo "  hedef : ${DOKU_DIR}"
echo

mkdir -p "$DOKU_DIR"

for esle in "${BLOKLAR[@]}"; do
  dosya="${esle%%|*}"
  yukari="${esle#*|}"   # Minecraft'ta dosya adlari alt cizgili

  curl -sL --fail -o "${DOKU_DIR}/${dosya}" \
    "${KAYNAK}/${yukari}" \
    || { echo "  HATA: ${yukari} inilemedi (HTTP $? — sürümde yok olabilir)"; exit 1; }

  printf '  %-24s <- %s
' "${dosya}" "${yukari}"
done

echo
echo "Doğrulanıyor (16x16 olmalı):"
python3 - "$DOKU_DIR" <<'PY'
import sys, glob
from pathlib import Path

dizin = Path(sys.argv[1])
for f in sorted(dizin.glob('*.png')):
    from PIL import Image
    im = Image.open(f)
    isim = f"{f.name:24s}"
    durum = "16x16 OK" if im.size == (16, 16) else f"UYARI: {im.size[0]}x{im.size[1]}"
    print(f"  {isim} {durum}")
PY

echo
echo "Tamam. Sunucuda görünmesi için arayüzü yeniden derleyin:"
echo "  cd companion/client && npm run build"
