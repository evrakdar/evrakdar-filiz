# Kullanım Rehberi

## Roller

| | Yönetici | Düzenleyici | Kullanıcı |
| --- | :---: | :---: | :---: |
| Belgeleri görmek, aramak, indirmek | ✅ | ✅ | ✅ |
| Favorilere eklemek | ✅ | ✅ | ✅ |
| Dosya yüklemek, kağıt belge kaydetmek | ✅ | ✅ | ➖ |
| Belge bilgilerini düzeltmek, dosyayı değiştirmek | ✅ | ✅ | ➖ |
| Klasör ve belge taşımak, kopyalamak, silmek | ✅ | ✅ | ➖ |
| Silineni geri almak, kalıcı silmek | ✅ | ✅ | ➖ |
| Kullanıcı eklemek, rol vermek | ✅ | ➖ | ➖ |
| Birim eklemek, düzenlemek | ✅ | ➖ | ➖ |
| Yönetici Paneli | ✅ | ➖ | ➖ |

Hangi rolün neler yapabildiği yönetici menüsündeki **Roller ve Yetkiler** sayfasında görünür. Roller bu üçüyle sınırlıdır. Kendi rollerinizi tanımlamak ve yetkileri tek tek seçmek Fidan ve Çınar paketlerindedir.

Gizli belgeyi yalnız yöneticiler, oluşturan kişi, sorumlu kişi ve sorumlu birimdeki kişiler görebilir, değiştirebilir ve silebilir. Görme yetkisi olmayanlar için bu belge listelerde, aramada ve çöp kutusunda hiç görünmez.

## İlk açılışta yapılacaklar

1. `admin` kullanıcı adı ve `1234` şifresiyle girin.
2. Sol alttaki **Şifremi Değiştir** düğmesiyle kendi şifrenizi belirleyin.
3. **Birimler** ekranından kurumunuzun birimlerini düzenleyin.
4. **Tüm Kullanıcılar ve Yetkilendirme** ekranını açın. Kullanmayacaksanız `editor` ve `user` hesaplarını **Pasifleştir** düğmesiyle kapatın.
5. **Yeni kullanıcı** düğmesiyle çalışma arkadaşlarınızı ekleyin. Her birine rol ve birim seçin. Kişiden ilk girişinde kendi şifresini belirlemesi istenir.
6. **Dosya ve Klasörler** ekranında hazır gelen klasörleri kurumunuza göre düzenleyin.
7. **Veri Girişi** ekranından ilk belgenizi yükleyin.

## Ana sayfa

Giriş yapınca ana klasörleri kart olarak görürsünüz. Karta tıklayınca içindeki alt klasörler ve belgeler listelenir. Sol üstteki kısa logoya basınca her zaman ana sayfaya dönersiniz.

Üstteki kutudan belge adı, sorumlu birim, sorumlu kişi, açıklama ve dijital belgelerin içindeki yazılara göre arama yapabilirsiniz. Taranmış belgelerin içinde arama yapılmaz. Tür, birim, tarih ve boyuta göre filtreleyebilirsiniz.

## Belge eklemek

**Veri Girişi** ekranında iki yol vardır:

- **Dosya ile doküman yükle:** Dosyayı seçersiniz. En fazla 20 MB. PDF, Word, Excel, PowerPoint, metin, PNG ve JPG kabul edilir.
- **Kağıt belge (dosya yok):** Dolapta duran bir belgeyi sisteme yazar. Dosyası yoktur ama aramada ve tarih takibinde görünür. Dosyası sonra eklenebilir.

Doldurulacak alanlar:

| Alan | Anlamı |
| --- | --- |
| Doküman adı | Listede görünecek ad |
| Doküman türü | Rapor, sunum, kılavuz, form, tutanak, diğer |
| Klasör | Belgenin duracağı yer |
| Sorumlu birim | Belgeden sorumlu birim |
| Sorumlu kişi | Belgeden sorumlu olan kişi. Seçilmezse belgeyi ekleyen kişi olur. Sonradan **Bilgileri Düzenle** ile değişir. |
| Geçerlilik tarihi | Süresi varsa son geçerlilik tarihi. "Tarihi Geçecek Olanlar" listesi buna bakar. |
| Erişim | **Kurum içi:** giriş yapan herkes görür. **Gizli:** yalnız yöneticiler, oluşturan kişi, sorumlu kişi ve sorumlu birim görür. |
| Açıklama | Aramada da kullanılan serbest not |

## Belgeye bakmak

Listede bir satıra tıklayınca sağda panel açılır. PDF, resim, metin ve Word (.docx) dosyaları panelde önizlenir. Word sade görünür, sayfa düzeni tam olmayabilir. Diğer türler için **İndir** düğmesini kullanın. Bilgileri ve dosyayı buradan değiştirebilirsiniz.

## Belge bilgilerini düzeltmek

Belgeye tıklayın, sağdaki panelde **Bilgileri Düzenle** düğmesine basın. Ad, tür, sorumlu birim, geçerlilik tarihi, erişim ve açıklama değiştirilebilir. Süresi uzayan belgenin tarihini buradan güncelleyin.

## Dosyayı değiştirmek ve eski sürümler

Sağdaki panelin **Sürümler** bölümünde belgenin bütün sürümleri listelenir, her biri indirilebilir. Yeni dosyayı seçip **Dosyayı yükle** dediğinizde yeni dosya güncel olur, eskisi silinmez. Yalnız bilgi kaydı açılmış belgeye dosya da buradan eklenir.

Arama yalnız güncel sürümün içine bakar. Eski bir sürüme dönmek için onu indirip yeniden yükleyin.

## Süresi yaklaşan ve geçen belgeler

- **Tarihi Geçecek Olanlar:** önümüzdeki 30 gün içinde süresi dolacaklar.
- **Süresi Geçenler:** süresi dolmuş belgeler, listede kırmızı "Süresi geçti" işaretiyle görünür.

Bir belge geçerlilik tarihinin son gününe kadar geçerli sayılır.

## Klasör ve belge yönetimi

**Dosya ve Klasörler** ekranı bilgisayarınızdaki dosya gezgini gibi çalışır:

- Yeni klasör açabilir, yeniden adlandırabilirsiniz.
- Satırın menüsünden taşıyabilir, kopyalayabilir, silebilirsiniz.
- Birden çok satırı seçip topluca silebilirsiniz.

## Silme ve geri alma

Silinen belge ve klasörler önce **Geri Dönüşüm Kutusu**'na gider, oradan geri alınabilir. Oradan da silerseniz dosya kalıcı olarak yok olur. Kopyası olan bir dosya, kopyası durduğu sürece depoda kalır.

## Kullanıcı yönetimi

**Tüm Kullanıcılar ve Yetkilendirme** ekranında:

- **Yeni kullanıcı:** Ad, soyad, ünvan, e-posta, rol, birim ve kurala uygun şifre (kendiliğinden üretilir) girin. Ad ve soyad yazılınca boş bir kullanıcı adı önerilir, isterseniz değiştirin. Ad, soyad ve ünvanın yazımı düzeltilir: "müdür YARDIMCISI" → "Müdür Yardımcısı".
- **Güncelle:** Bilgileri düzeltin, birim değiştirin. Şifresini unutan kişiye geçici şifre verin, ilk girişinde değiştirmesi istenir.
- **Yetki:** Satırdaki kutudan rolü değiştirin. Hemen geçerli olur.
- **Pasifleştir:** Hesabı kapatır, kişi hemen giriş yapamaz olur. Son yönetici hesabı kapatılamaz.

Birim seçimi önemlidir: Gizli belgeleri sorumlu birimdeki kişiler görür.

## Birimler

**Birimler** ekranından yönetici birim ekler ve adını değiştirir. Kullanımdaki birim silinemez. Önce o birimdeki kişileri, belgeleri ve klasörleri başka bir birime aktarın.

## Hesap güvenliği

- Herkes kendi şifresini **Şifremi Değiştir** düğmesinden değiştirebilir. Şifre en az 9 karakter olmalı; en az bir büyük harf, bir küçük harf, bir rakam ve bir sembol içermeli.
- Sistem ağa açıksa `1234` ile giriş kapalıdır.
- Bir oturum 8 saat sonra kapanır, yeniden giriş istenir.
- Aynı hesaba 10 kez yanlış şifre girilirse 15 dakika beklemek gerekir.
