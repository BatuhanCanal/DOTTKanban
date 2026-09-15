#!/usr/bin/env python3
"""
DOTT Kanban — blok doku üreteci (keskin piksel, harmanlama yok).

DURUM: KULLANILMIYOR. Vanilla Mojang dokulari shu an asagi dosyada:
    scripts/doku-indir.sh
Bu uretici, resmi dokulari depoya koymak istenirse (Mojang telifi) yerine
gorecek yedek olarak duruyor.
#!/usr/bin/env python3
DOTT Kanban — blok dokusu üreteci (keskin piksel, harmanlama yok).

NEDEN YENİDEN YAZILDI:
  İlk sürüm gürültüyü "yumuşak" üretiyordu: küçük bir ızgarayı bilineer
  enterpolasyonla 16x16'ya büyütüyordu. Sonuç, komşu piksellerin birbirine çok
  yakın tonlarda olduğu bir doku oluyordu. 128px'e büyütülünce bu, düz ve
  bulanık bir leke gibi görünüyordu — Minecraft dokusuna benzemiyordu.

  Gerçek Minecraft dokuları böyle değildir: her piksel, bloğa ait KÜÇÜK bir ton
  paletinden SEÇİLİR. Pikseller arasında ara değer yoktur; bu yüzden büyütülünce
  keskin, "çıtır" görünürler.

  Bu sürüm de öyle yapıyor: her blok için 4-6 tonluk bir palet tanımlanır ve her
  piksel bu paletten bir ton alır. Enterpolasyon yok, harmanlama yok.

TON PALETLERİ:
  Mümkün olduğunca referans görsellerden ölçüldü (renkler uydurulmadı):
    - altın    : Downloads/assets/images.jpg   (parlak sarı aralığı)
    - kuvars   : Downloads/assets/images.png   (kırık beyaz aralığı)
    - koyu 4 blok: kullanıcının verdiği palet görselinden medyanla ölçülen
                   temel renk + ondan türeyen tonlar

Kullanim:
    python3 scripts/blok-dokulari-uret.py
"""

import math
import random
from pathlib import Path

from PIL import Image

SIZE = 16
OUT_DIR = Path(__file__).resolve().parent.parent / "companion" / "client" / "public" / "textures"

# --- Ton paletleri ----------------------------------------------------------
# Her blok: (koyu -> açık sıralı ton listesi, ağırlıklar). Ağırlıklar gerçek
# dokulardaki dağılıma benzer olsun diye verilir: ara tonlar baskın, uç tonlar
# seyrektir. Tek ton baskın olsaydı doku düz görünürdü.

TURR = {
    # Blackstone: nötr koyu gri, belirgin çatlak/leke karışımı
    "blackstone": {
        "tons": [0x222422, 0x292B29, 0x313331, 0x383A38, 0x404240],
        "agirlik": [12, 22, 34, 22, 10],
    },
    # Gilded Blackstone: koyu slate mavi zemin + altın benekler
    "gilded-blackstone": {
        "tons": [0x1A2530, 0x22303D, 0x2C3B4B, 0x37485A, 0x435668],
        "agirlik": [12, 24, 34, 21, 9],
        "benek": [0xA87C12, 0xD9A11F, 0xF4BE2E, 0xFFD95C],
    },
    # Quartz Pillar: kırık beyaz, dikey şeritli
    "quartz-pillar": {
        "tons": [0xCFCDC8, 0xDDDFDE, 0xE9E2D9, 0xEEE6DE, 0xF1EFEE],
        "agirlik": [10, 22, 26, 24, 18],
    },
    # Gold Block: neredeyse düz altın, hafif parlaklık farkları
    "gold-block": {
        "tons": [0xD49633, 0xFABD24, 0xF6CD27, 0xFFE048, 0xFFEC4F],
        "agirlik": [6, 16, 34, 28, 16],
    },
    # Soul Soil: koyu kahve, burgu/halka deseni
    "soul-soil": {
        "tons": [0x2E2721, 0x3A3129, 0x453A32, 0x4C4039, 0x584A41],
        "agirlik": [14, 24, 26, 22, 14],
    },
    # Soul Sand: kahve, dalgalı çizgiler
    "soul-sand": {
        "tons": [0x332A1E, 0x3F3425, 0x4A3C2C, 0x514231, 0x5E4C38],
        "agirlik": [13, 23, 27, 23, 14],
    },
}


def ton(rng, tanim, kayma=0):
    """
    Paleden bir ton seçer.

    kayma: desen gereği tonu bir kademe koyulaştırmak/açmak için kullanılır
    (örneğin gölgede kalan şerit). Palede kalır — yeni renk uydurulmaz.
    """
    tons = tanim["tons"]
    agirlik = tanim["agirlik"]
    secim = rng.choices(range(len(tons)), weights=agirlik)[0]
    return tons[min(max(secim + kayma, 0), len(tons) - 1)]


def bos_izgara():
    return [[None] * SIZE for _ in range(SIZE)]


def yaz(tuval, x, y, renk):
    if 0 <= x < SIZE and 0 <= y < SIZE:
        tuval[y][x] = renk


def png(tuval):
    img = Image.new("RGB", (SIZE, SIZE))
    for y in range(SIZE):
        for x in range(SIZE):
            c = tuval[y][x] or 0x000000
            img.putpixel((x, y), ((c >> 16) & 255, (c >> 8) & 255, c & 255))
    return img


# --- Bloklar ----------------------------------------------------------------


def blackstone():
    """
    Blackstone: düz gürültü + seyrek koyu çatlaklar.

    Her piksel bağımsız seçilir (enterpolasyon yok). Çatlaklar 1-3 piksellik
    yatay/dikey kısa çizgiler halinde eklenir; gerçek dokuda da çatlaklar
    böyle kısa ve düzensizdir.
    """
    rng = random.Random(1101)
    tanim = TURR["blackstone"]
    tuval = bos_izgara()

    for y in range(SIZE):
        for x in range(SIZE):
            tuval[y][x] = ton(rng, tanim)

    for _ in range(10):
        x, y = rng.randrange(SIZE), rng.randrange(SIZE)
        uzunluk = rng.randint(1, 3)
        yatay = rng.random() < 0.5

        for i in range(uzunluk):
            px, py = (x + i, y) if yatay else (x, y + i)
            yaz(tuval, px, py, ton(rng, tanim, kayma=-2))

    return png(tuval)


def gilded_blackstone():
    """
    Gilded Blackstone: koyu zemin + altın benekler.

    Benekler tek piksel değil, 1-4 piksellik kümeler: tek tek dağılmış noktalar
    "kum" gibi durur, küme halinde olanlar ise gerçek dokudaki altın parçalarına
    benzer.
    """
    rng = random.Random(2202)
    tanim = TURR["gilded-blackstone"]
    tuval = bos_izgara()

    for y in range(SIZE):
        for x in range(SIZE):
            tuval[y][x] = ton(rng, tanim)

    for _ in range(9):
        cx, cy = rng.randrange(SIZE), rng.randrange(SIZE)
        benek = tanim["benek"]

        for _ in range(rng.randint(1, 4)):
            x = min(SIZE - 1, max(0, cx + rng.randint(-1, 1)))
            y = min(SIZE - 1, max(0, cy + rng.randint(-1, 1)))
            yaz(tuval, x, y, rng.choice(benek))

    return png(tuval)


def quartz_pillar():
    """
    Quartz Pillar: dikey şeritler + yatay ek yerleri.

    Şerit deseni 4 piksellik bir çevrim: iki açık, bir orta, bir koyu. Eşit
    genişlikte şeritler olsaydı doku çizgili kumaş gibi dururdu; gerçek blokta
    şeritler düzensizdir. Ayrıca blok birleşim yerlerinde görünen yatay
    çizgiler eklenir.
    """
    rng = random.Random(3301)
    tanim = TURR["quartz-pillar"]
    tuval = bos_izgara()

    desen = [1, 1, 0, -1]

    for y in range(SIZE):
        for x in range(SIZE):
            tuval[y][x] = ton(rng, tanim, kayma=desen[x % len(desen)])

    for y in (0, 8):
        for x in range(SIZE):
            yaz(tuval, x, y, ton(rng, tanim, kayma=-2))

    return png(tuval)


def gold_block():
    """
    Gold Block: neredeyse düz, 4x4'lük bloklarda çok hafif ton farkı.

    Gerçek altın bloğu çok düzdür; fazla gürültü verirsek taş gibi görünür.
    Yüzeydeki çok hafif "yansıma" hissi, 4x4 karelerin hafif ton farkıyla
    verilir.
    """
    rng = random.Random(4401)
    tanim = TURR["gold-block"]
    tuval = bos_izgara()

    for y in range(SIZE):
        for x in range(SIZE):
            kare = (1 if (x // 4 + y // 4) % 2 == 0 else 0) - (1 if y >= 12 else 0)
            tuval[y][x] = ton(rng, tanim, kayma=kare)

    return png(tuval)


def soul_soil():
    """
    Soul Soil: iç içe geçen halka/burgu deseni.

    Halka, merkeze olan uzaklığın sinüzoidal eşiğiyle çizilir; eşiği aşan
    pikseller bir kademe koyu olur. Gerçek dokudaki burgu böyle görünür.
    """
    rng = random.Random(5502)
    tanim = TURR["soul-soil"]
    tuval = bos_izgara()

    cx, cy = 7.5 + rng.uniform(-1, 1), 7.5 + rng.uniform(-1, 1)

    for y in range(SIZE):
        for x in range(SIZE):
            uzaklik = math.hypot(x - cx, y - cy)
            halka = math.sin(uzaklik * 1.9)
            kayma = -1 if halka > 0.72 else (1 if halka < -0.6 else 0)
            tuval[y][x] = ton(rng, tanim, kayma=kayma)

    return png(tuval)


def soul_sand():
    """
    Soul Sand: dalgalı çizgiler.

    Çizgiler aşağı doğru ilerlerken yatayda salınır (sinüs). Sinüs yerine düz
    dikey çizgiler olsaydı doku "çizgili kağıt" gibi dururdu.
    """
    rng = random.Random(6601)
    tanim = TURR["soul-sand"]
    tuval = bos_izgara()

    for y in range(SIZE):
        kaydirma = round(2.5 * math.sin(y / 2.4))

        for x in range(SIZE):
            dalga = (x + kaydirma) % 6
            kayma = -1 if dalga == 0 else (1 if dalga == 3 else 0)
            tuval[y][x] = ton(rng, tanim, kayma=kayma)

    return png(tuval)


DOKULAR = {
    "blackstone": blackstone,
    "gilded-blackstone": gilded_blackstone,
    "quartz-pillar": quartz_pillar,
    "gold-block": gold_block,
    "soul-soil": soul_soil,
    "soul-sand": soul_sand,
}


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for ad, uret in DOKULAR.items():
        img = uret()
        yol = OUT_DIR / f"{ad}.png"
        img.save(yol, "PNG", optimize=True)

        renkler = len(set(img.getdata()))
        print(f"  {ad:20s} 16x16  farkli ton: {renkler:2d}  -> {yol.name}")

    print(f"\n{len(DOKULAR)} doku uretildi (keskin piksel, harmanlama yok) -> {OUT_DIR}")


if __name__ == "__main__":
    main()

