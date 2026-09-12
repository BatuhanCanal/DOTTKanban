# DOTT Kanban

Topluluk etkinliklerini herkesin görebileceği şekilde yönetmek için kurulan Kanban sistemi.

İki parçadan oluşur:

| Parça | Ne işe yarar | Kim yazdı |
|---|---|---|
| **Planka** | Asıl Kanban aracı: birimler (proje), etkinlikler (pano), sütunlar, kartlar, yorumlar, dosyalar | Açık kaynak, resmî Docker imajı — **hiç değiştirilmedi** |
| **Companion** | Planka'da olmayan özellikler: **şablonlar**, **kategori (çoklu eksen) görünümü** ve **zaman çizelgesi (Gantt)** | Bu depo |

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
| Görevin bitiş tarihi | **Card.dueDate** |
| Görevin başlangıç tarihi | Planka'da **yok** — companion saklar (bkz. Tarihler ve zaman çizelgesi) |

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
  - *Zaman çizelgesi*: tarihi olan kartlar bir zaman ekseninde, Gantt benzeri çubuklar
    olarak görünür. Satırlar durum sütunlarına göre gruplanır, dikey kırmızı çizgi bugünü
    gösterir. Çubuğun rengi kartın kategorisinden (etiketinden) gelir.
  - Her kartta diğer eksenin bilgisi rozet olarak görünür, böylece iki eksen aynı anda okunur.
  - Kart başlığına tıklayınca kart Planka'da açılır — yorum, dosya, atama gibi işler orada yapılır.
- **Sıralama** — Kanban görünümlerinde sütun içindeki kart sırası seçilebilir: *Pano sırası*
  (Planka'daki gerçek sıra) veya *bitiş tarihine göre* (yakından uzağa / uzaktan yakına).
  Tarihi olmayan kartlar her iki yönde de sona gider. Tarihe göre sıralanmışken kart
  sürükleme kapanır: bırakılan yer Planka'daki sıraya karşılık gelmediği için kart yanlış
  yere düşerdi.
- **Şablon olarak kaydet** — açık panonun sütunlarını, etiketlerini, kartlarını ve kart içi
  kontrol listelerini şablon olarak saklar. Panoda hiçbir şey değişmez.
- **Şablonlar** — kayıtlı şablonlar listelenir. "Bu şablondan etkinlik aç" ile seçilen birimde
  yeni bir pano kurulur. Seçenekler: kartlar da oluşturulsun mu, kartlar ilk sütundan mı başlasın.

Şablona **alınmayanlar** (bilerek): son tarihler, tamamlanma işaretleri, kişi atamaları,
yorumlar ve ekler. Yeni etkinlik temiz başlar.

## Tarihler ve zaman çizelgesi

Planka kartlarda **yalnızca bitiş tarihi** tutar; başlangıç tarihi diye bir alanı yoktur.
Gantt çubuğunun iki ucu olması gerektiği için başlangıç tarihini companion kendi
veritabanında saklar — tıpkı şablonlarda olduğu gibi, Planka'nın koduna dokunmadan.

| Tarih | Nerede durur | Sonucu |
|---|---|---|
| **Bitiş** | Planka (kartın kendi alanı) | Planka'nın kartında, filtrelerinde ve bildirimlerinde de görünür |
| **Başlangıç** | Companion (`card_dates` tablosu) | Yalnızca companion'da görünür; Planka'da karşılığı yoktur |

İkisi de companion'dan düzenlenir: bir çubuğa (veya karttaki tarih rozetine) tıklayın.
Bitiş tarihi kullanıcının kendi Planka oturumuyla yazılır, böylece değişiklik Planka'nın
geçmişinde doğru kişiye işlenir. Başlangıç tarihi yazılmadan önce sunucu, kullanıcının o
kartı gerçekten görebildiğini Planka'ya sorar — yoksa giriş yapmış herkes erişemediği bir
panonun kartına tarih yazabilirdi.

Çizelgede bir kart:

- **başlangıcı ve bitişi varsa** → iki tarih arasında uzanan bir çubuk,
- **yalnızca bitişi varsa** → o güne konmuş bir elmas işareti (başlangıç verince çubuğa döner),
- **hiç tarihi yoksa** → çizelgede görünmez; kaç kartın tarihsiz olduğu altta yazar.

Geçmiş tarihli ve tamamlanmamış kartlar kırmızı çerçeveyle, tamamlanmış olanlar soluk gösterilir.

Şablonlara **hiçbir tarih alınmaz** (bitiş de başlangıç da): yeni etkinlik temiz başlar.

> Not: başlangıç tarihleri companion'ın veritabanında durduğu için yedeklemede
> `companion.db` artık yalnızca şablonları değil bu tarihleri de taşır — `scripts/yedek-al.sh`
> zaten üçünü birden alıyor.

## Yapı

```
docker-compose.yml     planka + postgres + companion
.env.example           ayarlar şablonu
scripts/
  yedek-al.sh          üç veri deposunu birden yedekler
companion/
  server/              Express API
    planka.js          Planka REST API istemcisi (Planka ile tek temas noktası)
    auth.js            Planka hesabıyla giriş, token doğrulama, yönetici kontrolü
    rate-limit.js      giriş denemesi sayacı (kaba kuvvete karşı)
    board-data.js      pano verisini görünüm ve şablon biçimine çevirir
    routes/            hub, boards (görünüm + kart taşıma + tarihler), templates
    db.js              şablonlar ve başlangıç tarihleri için SQLite (node:sqlite)
  client/              React + Vite arayüz
    components/
      Timeline.jsx     zaman çizelgesi (Gantt benzeri görünüm)
```

## Kimlik doğrulama ve yetki

Uygulamaya **yalnızca Planka hesabı olanlar** girebilir; giriş yapmayan hiç kimse hiçbir veri göremez.

Companion'ın kendi kullanıcı sistemi yoktur: herkes **kendi Planka hesabıyla** girer ve tüm
istekler o kullanıcı adına yapılır. Böylece yetkiler Planka'daki yetkilerle birebir aynıdır ve
yapılan değişiklikler Planka'nın geçmişinde doğru kişiye yazılır. Companion hiçbir parola saklamaz.

Nasıl işliyor:

- Giriş yapılınca Planka'dan alınan token `httpOnly` + `SameSite=Lax` bir çerezde tutulur
  (JavaScript okuyamaz, siteler arası isteklerde gönderilmez).
- **Her istekte** çerezteki token Planka'ya doğrulatılır (`GET /api/users/me`), 60 saniyelik
  bir önbellekle. Çerezin varlığına güvenmek yetmez: şablon uçları gibi Planka'ya hiç gitmeyen
  uçlarda uydurma bir çerezle gelen birine kapıyı açardı. Planka'da silinen veya parolası
  değişen bir hesap en geç 60 saniye içinde düşer.
- Giriş denemeleri sayılır: aynı hesap+IP için 5, aynı IP için 30 başarısız denemeden
  sonra 10 dakika beklenir. Parola doğrulaması Planka'ya devredildiği için, sınır
  koymazsak Planka'nın önünde açık bir parola deneme kapısı bırakmış olurduk.
- Pano, liste ve kart yetkileri tamamen Planka'nındır — kullanıcı Planka'da üye olmadığı
  bir projeyi companion'da da göremez.
- **Şablonlar** companion'ın kendi verisidir, o yüzden kuralı burada koyduk: giriş yapmış
  herkes şablonları **görür ve kullanır** (topluluk içi paylaşım için), ama bir şablonu
  **yalnızca onu oluşturan kişi veya Planka yöneticisi** silebilir/yeniden adlandırabilir.
  Sahibi kayıtlı olmayan eski şablonlara yalnızca yönetici dokunabilir.

Planka'da açık kayıt (self-registration) yoktur: hesapları yönetici açar. Yani "hesabı olan"
kümesini siz belirlersiniz.

> **Ters vekil arkasında yayına alıyorsanız** `.env` içinde `COMPANION_TRUST_PROXY=1` yapın.
> Yoksa companion her isteği nginx'in IP'sinden geliyormuş gibi görür ve giriş hız sınırı
> tüm topluluğu tek kovaya koyar. Aynı şekilde `COMPANION_COOKIE_SECURE=true` yapın.
> Companion açılışta bu iki ayarı kontrol eder ve eksikse log'a uyarı yazar.

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

### Yedekleme

Veri **üç** ayrı yerde durur ve üçü birden alınmazsa yedek işe yaramaz: Planka'nın veritabanı
(`db-data`), Planka'ya yüklenen dosyalar (`planka-data`) ve companion'ın şablonları
(`companion-data`). Script üçünü birden alır:

```bash
./scripts/yedek-al.sh              # -> ./yedekler/2026-09-12_1723/
./scripts/yedek-al.sh /mnt/yedek   # başka bir hedefe
```

Servisler çalışırken çalıştırılabilir: Postgres için `pg_dump`, SQLite için `VACUUM INTO`
kullanılır, ikisi de tutarlı bir anlık görüntü verir. Düzenli yedek için crontab'a ekleyin:

```
0 3 * * * cd /opt/dott-kanban && ./scripts/yedek-al.sh /mnt/yedek >> /var/log/dott-yedek.log 2>&1
```

Çıkan dizini **başka bir makineye veya diske** kopyalayın; aynı sunucuda duran yedek yedek değildir.

**Geri yükleme** (her şeyin silineceğini unutmayın):

```bash
docker compose down
docker compose up -d postgres && sleep 5
zcat yedekler/<damga>/planka-db.sql.gz | docker compose exec -T postgres psql -U postgres -d planka
docker compose up -d planka
zcat yedekler/<damga>/planka-data.tar.gz | docker compose exec -T planka tar -C /app/data -xf -
docker compose up -d companion
docker compose cp yedekler/<damga>/companion.db companion:/app/data/companion.db
docker compose restart companion
```

## Bilinen sınırlar

- Companion, Planka arayüzünün **içine** gömülü değildir (Planka'da eklenti sistemi yok);
  ayrı bir sayfadır. Companion'daki her panodan tek tıkla Planka'ya geçilir.
- Kategori görünümünde bir sütun içindeki kart sırası kalıcı değildir — Planka bir kartın
  "şu etiket içindeki sırası" diye bir bilgi tutmaz. Sütunlar arası taşıma (asıl işlev) kalıcıdır.
- Başlangıç tarihleri yalnızca companion'da görünür; Planka'nın kendi kart ekranında
  bitiş tarihi vardır ama başlangıç yoktur. Planka'da bir kart silinirse companion'daki
  başlangıç tarihi satırı öksüz kalır — zararsızdır, görünüm her zaman Planka'dan gelen
  kart listesiyle eşleştirilir.
- Planka'nın REST API'si sürümler arası kırılabilir. Kırılırsa bakılacak tek dosya
  `companion/server/planka.js`.
