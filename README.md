# DOTT Kanban

Topluluk etkinliklerini herkesin görebileceği şekilde yönetmek için kurulan Kanban sistemi.

İki parçadan oluşur:

| Parça | Ne işe yarar | Kim yazdı |
|---|---|---|
| **Planka** | Asıl Kanban aracı: birimler (proje), etkinlikler (pano), sütunlar, kartlar, yorumlar, dosyalar | Açık kaynak, resmî Docker imajı — **hiç değiştirilmedi** |
| **Companion** | Planka'da olmayan iki özellik: **şablonlar** ve **kategori (çoklu eksen) görünümü** | Bu depo |

Companion, Planka'nın kaynak koduna dokunmaz; yalnızca Planka'nın REST API'sini kullanan
ayrı bir servistir. Bu sayede **Planka'yı güncellemek companion'ı bozmaz** — Planka'yı
istediğiniz zaman `docker compose pull planka` ile yeni sürüme çekebilirsiniz.

## Kavram eşlemesi

| İstenen | Planka'daki karşılığı |
|---|---|
| Birim klasörü (Yazılım, Etkinlik, Sosyal Medya...) | **Project** |
| Etkinlik panosu | **Board** |
| Durum sütunları (Yapılacak / Devam Ediyor / Tamamlandı) | **List** |
| Görev | **Card** |
| Kategori (Yiyecek, İçecek, Teknik, Tanıtım...) | **Label** (bir karta birden fazla atanabilir) |

Bir kart aynı anda hem bir **durumda** (list) hem de birden fazla **kategoride** (label)
olabildiği için, aynı pano iki farklı eksene göre gruplanarak gösterilebiliyor.

## Kurulum

Gereken: Docker ve Docker Compose.

```bash
cp .env.example .env
```

`.env` dosyasını açıp en azından şunları değiştirin:

- `PLANKA_SECRET_KEY` — `openssl rand -hex 32` ile üretin
- `PLANKA_ADMIN_EMAIL` / `PLANKA_ADMIN_PASSWORD` — ilk yönetici hesabı
- `PLANKA_BASE_URL` — sunucuya kurunca kendi adresiniz (örn. `https://kanban.dott.example.com`)

Sonra:

```bash
docker compose up -d
```

- Planka: <http://localhost:3000>
- DOTT Kanban (companion): <http://localhost:3001>

İlk girişte Planka kullanım şartlarını kabul etmenizi ister; bu yüzden **her yeni hesap
ilk girişini Planka üzerinden yapmalıdır.** Sonrasında aynı hesapla companion'a girilebilir.

### İlk yapılandırma (Planka içinde, bir kez)

1. Yönetici hesabıyla Planka'ya girin.
2. Her birim için bir **proje** açın (Yazılım, Etkinlik, Sosyal Medya...).
3. Topluluk üyeleri için kullanıcı açın ve ilgili projelere üye olarak ekleyin.
4. Bir etkinlik panosu açıp sütunlarını (Yapılacak / Devam Ediyor / Tamamlandı) ve
   kategori etiketlerini (Yiyecek, İçecek, Teknik...) oluşturun.

## Kullanım

**Companion (localhost:3001)**

- **Etkinlikler** — birimler ve içindeki etkinlik panoları listelenir.
- **Görünümler** — bir panoyu açtığınızda iki sekme vardır:
  - *Duruma göre*: klasik Kanban (sütunlar = Yapılacak/Devam/Tamamlandı). Kart sürüklemek
    kartın durumunu Planka'da değiştirir.
  - *Kategoriye göre*: aynı kartlar, bu kez etikete göre gruplanır (Yiyecek, İçecek...).
    Kart sürüklemek kartın etiketini değiştirir. Bir kart birden fazla etiketliyse birden
    fazla sütunda görünür.
  - Her kartta diğer eksenin bilgisi rozet olarak görünür, böylece iki eksen aynı anda okunur.
  - Kart başlığına tıklayınca kart Planka'da açılır — yorum, dosya, atama gibi işler orada yapılır.
- **Şablon olarak kaydet** — açık panonun sütunlarını, etiketlerini, kartlarını ve kart içi
  kontrol listelerini şablon olarak saklar. Panoda hiçbir şey değişmez.
- **Şablonlar** — kayıtlı şablonlar listelenir. "Bu şablondan etkinlik aç" ile seçilen birimde
  yeni bir pano kurulur. Seçenekler: kartlar da oluşturulsun mu, kartlar ilk sütundan mı başlasın.

Şablona **alınmayanlar** (bilerek): son tarihler, tamamlanma işaretleri, kişi atamaları,
yorumlar ve ekler. Yeni etkinlik temiz başlar.

## Yapı

```
docker-compose.yml     planka + postgres + companion
.env.example           ayarlar şablonu
companion/
  server/              Express API
    planka.js          Planka REST API istemcisi (Planka ile tek temas noktası)
    board-data.js      pano verisini görünüm ve şablon biçimine çevirir
    routes/            hub, boards (görünüm + kart taşıma), templates
    db.js              şablonlar için SQLite (Node'un yerleşik node:sqlite modülü)
  client/              React + Vite arayüz
```

Companion'ın kendi kullanıcı sistemi yoktur: herkes **kendi Planka hesabıyla** girer ve tüm
istekler o kullanıcı adına yapılır. Böylece yetkiler Planka'daki yetkilerle birebir aynıdır ve
yapılan değişiklikler Planka'nın geçmişinde doğru kişiye yazılır. Companion hiçbir parola saklamaz.

## Bakım

```bash
# Planka'yı güncelle (companion'a dokunmadan)
docker compose pull planka && docker compose up -d planka

# Companion'da değişiklik yaptıktan sonra
docker compose up -d --build companion

# Logları izle
docker compose logs -f companion

# Her şeyi sil (veriler dahil!)
docker compose down -v
```

Veriler iki yerde durur: Planka'nın verisi `db-data`/`planka-data` volume'lerinde,
companion'ın şablonları `companion-data` volume'ünde (`/app/data/companion.db`).
Yedek alırken üçünü birden alın.

## Bilinen sınırlar

- Companion, Planka arayüzünün **içine** gömülü değildir (Planka'da eklenti sistemi yok);
  ayrı bir sayfadır. Companion'daki her panodan tek tıkla Planka'ya geçilir.
- Kategori görünümünde bir sütun içindeki kart sırası kalıcı değildir — Planka bir kartın
  "şu etiket içindeki sırası" diye bir bilgi tutmaz. Sütunlar arası taşıma (asıl işlev) kalıcıdır.
- Planka'nın REST API'si sürümler arası kırılabilir. Kırılırsa bakılacak tek dosya
  `companion/server/planka.js`.
