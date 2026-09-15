#!/usr/bin/env python3
"""Arayaz full Türkçe karakter görüntü yazılarını tamamla.

Kural: sadece TAM string eşleşmesi. Zaman damga URL/ident dokunulmaz.
"""

from pathlib import Path

KOK = Path(__file__).resolve().parent.parent / "companion"

DUZELT = [
    # App.jsx
    ("client/src/App.jsx", ">Sablonlar<", ">Şablonlar<"),
    ("client/src/App.jsx", "Etiket Turleri", "Etiket Türleri"),
    ("client/src/App.jsx", "Planka'yi ac", "Planka'yı aç"),
    ("client/src/App.jsx", "Kartlari duzenlemek, yorum yazmak ve dosya eklemek icin Planka'yi kullanin",
     "Kartları düzenlemek, yorum yazmak ve dosya eklemek için Planka'yı kullanın"),
    ("client/src/App.jsx", "Cikis", "Çıkış"),

    # Login.jsx
    ('client/src/pages/Login.jsx', 'Planka hesabinizla giris yapin.', 'Planka hesabınızla giriş yapın.'),
    ('client/src/pages/Login.jsx', 'Kullanici adi veya e-posta', 'Kullanıcı adı veya e-posta'),
    ('client/src/pages/Login.jsx', '>Sifre<', '>Şifre<'),
    ('client/src/pages/Login.jsx', 'Giris yapiliyor...', 'Giriş yapılıyor...'),
    ('client/src/pages/Login.jsx', '{busy ? ', '{busy ? '),
    ('client/src/pages/Login.jsx', 'Giris yap', 'Giriş yap'),
    ('client/src/pages/Login.jsx',
     'Hesabiniz yoksa toplulugun Planka yoneticisinden hesap acmasini isteyin.',
     'Hesabınız yoksa topluluğun Planka yöneticisinden hesap açmasını isteyin.'),

    # Hub.jsx
    ('client/src/pages/Hub.jsx', 'Birimler yukleniyor...', 'Birimler yükleniyor...'),
    ('client/src/pages/Hub.jsx', 'Her birim bir klasor, her etkinlik o klasorde bir pano.',
     'Her birim bir klasör, her etkinlik o klasörde bir pano.'),
    ('client/src/pages/Hub.jsx', 'Henuz birim yok.', 'Henüz birim yok.'),
    ('client/src/pages/Hub.jsx', "Planka'yi acip bir proje (birim) olusturun, burada gorunecek.",
     "Planka'yı açıp bir proje (birim) oluşturun, burada görünecek."),
    ('client/src/pages/Hub.jsx',
     'Bu birimde henuz pano yok. Sablonlar sayfasindan hazir bir sablondan',
     'Bu birimde henüz pano yok. Şablonlar sayfasından hazır bir şablondan'),
    ('client/src/pages/Hub.jsx', 'Gorunumler', 'Görünümler'),

    # Board.jsx
    ('client/src/pages/Board.jsx', 'Pano yukleniyor...', 'Pano yükleniyor...'),
    ('client/src/pages/Board.jsx', 'Duruma göre', 'Duruma göre'),
    ('client/src/pages/Board.jsx', '>Kategoriye gore<', '>Kategoriye göre<'),
    ("client/src/pages/Board.jsx", " gore\n            </button>", " göre\n            </button>"),
    ('client/src/pages/Board.jsx', 'Zaman cizelgesi', 'Zaman çizelgesi'),
    ('client/src/pages/Board.jsx', 'Sablon olarak kaydet', 'Şablon olarak kaydet'),
    ("client/src/pages/Board.jsx", "Planka'da ac", "Planka'da aç"),
    ('client/src/pages/Board.jsx', 'Pano sirasi', 'Pano sırası'),
    ('client/src/pages/Board.jsx', 'Bitis tarihi (once yakin)', 'Bitiş tarihi (önce yakın)'),
    ('client/src/pages/Board.jsx', 'Bitis tarihi (once uzak)', 'Bitiş tarihi (önce uzak)'),
    ('client/src/pages/Board.jsx', 'Etkinliklere don', 'Etkinliklere dön'),
    ('client/src/pages/Board.jsx', 'Karti Planka', "Kartı Planka"),
    ('client/src/pages/Board.jsx', 'Tarihlere göre siralanmişken kart sürükleme kapalidir',
     'Tarihe göre sıralanmışken kart sürükleme kapalıdır'),
    ('client/src/pages/Board.jsx', 'Sira degistirmek icin', 'Sırayı değiştirmek için'),
    ('client/src/pages/Board.jsx', 'Pano sirasina', 'Pano sırasına'),
    ('client/src/pages/Board.jsx', 'karşılık gelmez', 'karşılık gelmez'),
    ('client/src/pages/Board.jsx', 'karsilik gelmez', 'karşılık gelmez'),
    ('client/src/pages/Board.jsx', 'karsilik dogmu', 'karşılık gelmez'),
    ('client/src/pages/Board.jsx', 'henuz etiket yok', 'henüz etiket yok'),
    ('client/src/pages/Board.jsx', 'kolonlara', 'sütunlara'),
    ('client/src/pages/Board.jsx', 'gorunecek', 'görünecek'),
    ('client/src/pages/Board.jsx', 'TEK etiket tasir (tek ekib / tek tur kurah)',
     'TEK etiket taşır (tek ekibi / tek tür kuralı)'),
    ('client/src/pages/Board.jsx', 'Baslangic tarihi', 'Başlangıç tarihi'),
    ("client/src/pages/Board.jsx", "teraselir", "sürükleme"),
    ("client/src/pages/Board.jsx", 'cubugun sol ucu', 'çubuğun sol ucu'),
    ("client/src/pages/Board.jsx", 'Bos birakirsaniz kart', 'Boş bırakırsanız kart'),
    ("client/src/pages/Board.jsx", 'cizelgede tek bir isaret', 'çizelgede tek bir işaret'),
    ("client/src/pages/Board.jsx", 'Bitis tarihi', 'Bitiş tarihi'),
    ("client/src/pages/Board.jsx", "Planka'ya yazilir", "Planka'ya yazılır"),
    ("client/src/pages/Board.jsx", 'Kartta', 'Kartta'),
    ('client/src/pages/Board.jsx', 'gorunumlerinde de gorunur', 'görünümünde de görünür'),
    ('client/src/pages/Board.jsx', 'Saat secmek isterseniz', 'Saat seçmek isterseniz'),
    ('client/src/pages/Board.jsx', 'Planka\'da acin', "Planka'da açın"),
    ('client/src/pages/Board.jsx', 'bitis tarihinden sonra olamaz,', 'bitiş tarihinden sonra olamaz.'),
    ('client/src/pages/Board.jsx', 'sandı mu', 'sıralama'),
    ('client/src/pages/Board.jsx', '>sablonu (kaydett) sözümü<', '>şablonu kaydedildi<'),
    ('client/src/pages/Board.jsx', 'Bu şablonu kaynagı', 'Şablon kaydendi'),
    ('client/src/pages/Board.jsx', 'Şablon kaydedildi', 'Şablon kaydedildi'),
    ('client/src/pages/Templates.jsx', 'sablonu silinsin mi?', 'şablonu silinsin mi?'),
    ('client/src/pages/Templates.jsx', 'Sablonlar yukleniyor...', 'Şablonlar yükleniyor...'),
    ('client/src/pages/Templates.jsx', '>Sablonlar<', '>Şablonlar<'),
    ('client/src/pages/Templates.jsx', 'Tekrar eden etkinlikler icin hazir pano yapilari.',
     'Tekrar eden etkinlikler için hazır pano yapıları.'),
    ('client/src/pages/Templates.jsx', 'Bir panoyu sablona cevirmek icin',
     'Bir panoyu şablona çevirmek için'),
    ('client/src/pages/Templates.jsx', 'Kayitli sablonlar', 'Kayıtlı şablonlar'),
    ('client/src/pages/Templates.jsx', 'Henuz sablon yok', 'Henüz şablon yok'),
    ('client/src/pages/Templates.jsx', 'dediginizde burada gorunecek.', 'dediğinizde burada görünecek.'),
    ('client/src/pages/Templates.jsx', 'sutun &middot;', 'sütun &middot;'),
    ('client/src/pages/Templates.jsx', 'Bu sablondan etkinlik ac', 'Bu şablondan etkinlik aç'),
    ('client/src/pages/Templates.jsx', '>Duzenle<', '>Düzenle<'),
    ('client/src/pages/Templates.jsx', 'Sablonu duzenle', 'Şablonu düzenle'),
    ('client/src/pages/Templates.jsx', 'Yalnizca sablonun adi ve aciklamasi degisir; icindeki yapiya',
     'Yalnızca şablonun adı ve açıklaması değişir; içindeki yapıya'),
    ('client/src/pages/Templates.jsx', 'Aciklama (istege bagli)', 'Açıklama (isteğe bağlı)'),
    ('client/src/pages/Templates.jsx', 'Orn. iki gunluk atolye duzeni', 'Örn. iki günlük atölye düzeni'),
    ('client/src/pages/Templates.jsx', 'Kismen olusturuldu', 'Kısmen oluşturuldu'),
    ('client/src/pages/Templates.jsx', 'Etkinlik olusturuldu', 'Etkinlik oluşturuldu'),
    ('client/src/pages/Templates.jsx', 'Yeni pano hazir', 'Yeni pano hazır'),
    ('client/src/pages/Templates.jsx', 'sutun, ', 'sütun, '),
    ("client/src/pages/Templates.jsx", 'Sablondan etkinlik ac', 'Şablondan etkinlik aç'),
    ('client/src/pages/Templates.jsx', 'sablonundaki yapi yeni', 'şablonundaki yapı'),
    ('client/src/pages/Templates.jsx', 'Etkinlik (pano) adi', 'Etkinlik (pano) adı'),
    ('client/src/pages/Templates.jsx', 'Kartlar da olusturulsun', 'Kartlar da oluşturulsun'),
    ('client/src/pages/Templates.jsx',
     'Kapatirsaniz sadece sutunlar ve etiketler kurulur, kartlari sifirdan yazarsiniz.',
     'Kapatırsanız sadece sütunlar ve etiketler kurulur, kartları sıfırdan yazarsınız.'),
    ('client/src/pages/Templates.jsx', 'Tum kartlar ilk sutundan bassin',
     'Tüm kartlar ilk sütundan başlasın'),
    ('client/src/pages/Templates.jsx', 'Kapatirsaniz kartlar sablondaki sutunlarinda kalir.',
     'Kapatırsanız kartlar şablondaki sütunlarında kalır.'),
    ('client/src/pages/Templates.jsx', 'Vazgec', 'Vazgeç'),
    ('client/src/pages/Templates.jsx', 'Olusturuluyor...', 'Oluşturuluyor...'),
    ('client/src/pages/Templates.jsx', '>Olustur<', '>Oluştur<'),

    # Admin.jsx
    ('client/src/pages/Admin.jsx', 'Etiket Turleri', 'Etiket Türleri'),
    ('client/src/pages/Admin.jsx', 'Panodaki etiketleri turlere', 'Panodaki etiketleri türlere'),
    ('client/src/pages/Admin.jsx', 'Yeni tur', 'Yeni tür'),
    ('client/src/pages/Admin.jsx', 'Yeniden adlandir', 'Yeniden adlandır'),
    ('client/src/pages/Admin.jsx', 'Etiket bagla', 'Etiket bağla'),
    ('client/src/pages/Admin.jsx', 'Bu turde henuz etiket yok', 'Bu türde henüz etiket yok'),
    ('client/src/pages/Admin.jsx', 'Tur adi', 'Tür adı'),
    ('client/src/pages/Admin.jsx', 'Orn. Ekip, Etkinlik Turu', 'Örn. Ekip, Etkinlik Türü'),
    ('client/src/pages/Admin.jsx', 'Etkinlik Turu', 'Etkinlik Türü'),
    ('client/src/pages/Admin.jsx', 'Olusturuluyor...', 'Oluşturuluyor...'),
    ('client/src/pages/Admin.jsx', '>Olustur<', '>Oluştur<'),
    ('client/src/pages/Admin.jsx', 'Yeni ad', 'Yeni ad'),
    ('client/src/pages/Admin.jsx', 'Pano secin...', 'Pano seçin...'),
    ('client/src/pages/Admin.jsx', 'Henuz etiket yok', 'Henüz etiket yok'),
    ('client/src/pages/Admin.jsx', 'Once Planka', 'Önce Planka'),
    ('client/src/pages/Admin.jsx', 'Yeni etiket turu', 'Yeni etiket türü'),
    ('client/src/pages/Admin.jsx', 'Vazgec', 'Vazgeç'),
    ('client/src/pages/Admin.jsx', 'Kaydediliyor...', 'Kaydediliyor...'),
    ('client/src/pages/Admin.jsx', 'silmek istediginize emin misiniz?', 'silmek istediğinize emin misiniz?'),
    ('client/src/pages/Admin.jsx', 'Bu ad pano sayfasinda', 'Bu ad pano sayfasında'),
    ('client/src/pages/Admin.jsx', 'secin, sonra o panodaki', 'seçin, sonra o panodaki'),
    ('client/src/pages/Admin.jsx', 'en fazla bir syyon', 'ekleyin'),

    # Timeline.jsx
    ('client/src/components/Timeline.jsx', "'Subat'", "'Şubat'"),
    ('client/src/components/Timeline.jsx', "'Mayis'", "'Mayıs'"),
    ('client/src/components/Timeline.jsx', "'Agustos'", "'Ağustos'"),
    ('client/src/components/Timeline.jsx', "'Eylul'", "'Eylül'"),
    ('client/src/components/Timeline.jsx', "'Kasim'", "'Kasım'"),
    ('client/src/components/Timeline.jsx', '>Gorev<', '>Görev<'),
    ('client/src/components/Timeline.jsx', '>Olcek<', '>Ölçek<'),
    ('client/src/components/Timeline.jsx', 'sigdir', 'sığdır'),
    ('client/src/components/Timeline.jsx', 'Uzaklastir', 'Uzaklaştır'),
    ('client/src/components/Timeline.jsx', 'Yakinlastir', 'Yakınlaştır'),
    ('client/src/components/Timeline.jsx', 'Tamamlananlari gizle', 'Tamamlananları gizle'),
    ('client/src/components/Timeline.jsx', 'Tamamlananlari goster', 'Tamamlananları göster'),
    ('client/src/components/Timeline.jsx', 'Bugune git', 'Bugüne git'),
    ('client/src/components/Timeline.jsx', 'gecikmis', 'gecikmiş'),
    ('client/src/components/Timeline.jsx', 'tarihli gorev', 'tarihli görev'),
    ('client/src/components/Timeline.jsx', 'baslangic &rarr; bitis', 'başlangıç → bitiş'),
    ('client/src/components/Timeline.jsx', 'yalnizca bitis tarihi var', 'yalnızca bitiş tarihi var'),
    ('client/src/components/Timeline.jsx', 'koyu bolum: biten kontrol listesi',
     'koyu bölüm: biten kontrol listesi'),
    ('client/src/components/Timeline.jsx', 'Cubugu surukleyin', 'Çubuğu sürükleyin'),
    ('client/src/components/Timeline.jsx', 'baslangic verilmemis', 'başlangıç verilmemiş'),
    ('client/src/components/Timeline.jsx', 'Baslangic tarihini', 'Başlangıç tarihini'),
    ('client/src/components/Timeline.jsx', 'tamamlanma isaretleri', 'tamamlanma işaretleri'),
    ('client/src/components/Timeline.jsx', 'Bu panoda tarihi yok', 'Bu panoda tarihli kart yok'),
    ('client/src/components/Timeline.jsx', 'tarihlerleri yazin', 'tarihleri yazın'),

    # Sunucu (kullanıcıya görünür)
    ('server/auth.js', 'Kullanici adi ve sifre gerekli.', 'Kullanıcı adı ve şifre gerekli.'),
    ('server/auth.js', 'Cok fazla hatali deneme', 'Çok fazla hatalı deneme'),
    ('server/auth.js', 'yaklasik', 'yaklaşık'),
    ('server/auth.js', "Bu hesap Planka'ya ilk kez giriyor", "Bu hesap Planka'ya ilk kez giriyor"),
    ('server/auth.js', 'Kullanici adi veya sifre hatali.', 'Kullanıcı adı veya şifre hatalı.'),
    ('server/auth.js', 'Oturum suresi doldu', 'Oturum süresi doldu'),
    ('server/planka.js', "Planka'ya ulasilamiyor", "Planka'ya ulaşılamıyor"),
    ('server/planka.js', 'Planka API hatasi', 'Planka API hatası'),
    ('server/routes/boards.js', 'Kart bu panoda bulunamadi.', 'Kart bu panoda bulunamadı.'),
    ('server/routes/label-groups.js', 'Bu islem yalnizca yoneticilere aciktir',
     'Bu işlem yalnızca yöneticilere açıktır'),
    ('server/routes/label-groups.js', 'Tur adi en az', 'Tür adı en az'),
    ('server/routes/label-groups.js', 'Bu adla bir tur zaten var.', 'Bu adla bir tür zaten var.'),
    ('server/routes/label-groups.js', 'Tur bulunamadi.', 'Tür bulunamadı.'),
    ('server/routes/label-groups.js', 'Etiket bu panoda bulunamadi.',
     'Etiket bu panoda bulunamadı.'),
    ('server/routes/label-groups.js', 'Etiket bu turde bulunamadi.',
     'Etiket bu türde bulunamadı.'),
    ('dev/planka-mock.js', 'Sifre gerekli.', 'Şifre gerekli.'),
    ('dev/planka-mock.js', 'adresinde çalışıyor', 'adresinde çalışıyor'),
]


def apply():
    ok, miss = 0, 0
    for dosya, eski, yeni in DUZELT:
        d = KOK / dosya
        if not d.exists():
            continue
        m = d.read_text()
        if eski not in m:
            miss += 1
            continue
        d.write_text(m.replace(eski, yeni))
        ok += 1
    print(f'bitti: {ok} geçti, {miss} bulunamadı')


if __name__ == '__main__':
    apply()
