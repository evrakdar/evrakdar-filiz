# Güvenlik

## Açık bildirme

Bir güvenlik açığı bulursanız lütfen herkese açık bir issue açmayın. GitHub üzerindeki
**Security > Report a vulnerability** bölümünden gizli olarak bildirin. Bildirime nasıl
tekrar üretileceğini ve etkisini ekleyin.

## Kurulum yapanlar için kontrol listesi

- `kur.sh` ve `kur.ps1` gizli anahtarları rastgele üretir. Elle kuruyorsanız `JWT_SECRET` ve `POSTGRES_PASSWORD` için yeni rastgele değerler kullanın.
- `.env` ve `.env.production` dosyalarını paylaşmayın, sürüm kontrolüne eklemeyin.
- İnternete açacaksanız yalnız HTTPS üzerinden yayınlayın (Caddy, Nginx ya da Traefik ile).
- Veritabanı portunu açmayın. Kurulum dosyası bunu dışarı yayınlamaz.
- `SEED_DEMO_USERS` ve `SEED_RESET` üretimde kapalı kalmalıdır. İlk kurulum adımı bu ayarlarla üretimde çalışmayı reddeder.
- Başlangıç hesaplarının şifresi `1234`'tür ve herkesçe bilinir. Sistem yalnız kurulduğu bilgisayardan açıkken kullanılabilir. Ağa açıldığında bu şifreyle giriş kapanır; yine de ağa açmadan önce değiştirin.
- Kullanmadığınız başlangıç hesaplarını kapatın.
- Veritabanını ve dosyaları düzenli yedekleyin.

## Dışarıya giden bilgi

Kurulan sistem hiçbir yere bilgi göndermez. İstatistik, kullanım sayacı, otomatik güncelleme denetimi ya da uzaktan erişim yoktur. Belgeler ve kullanıcılar yalnız sizin kurduğunuz yerde durur. Yalnız ilk kurulum ve güncelleme sırasında gerekli yazılım parçaları internetten indirilir. Dosyaları bulutta tutma ayarını açarsanız dosyalar seçtiğiniz hizmete gider.

## Bilinen sınırlar

- Oturum anahtarı tarayıcıda `localStorage` içinde tutulur; süre `JWT_EXPIRES_IN` ile sınırlıdır. Şifre değiştirmek açık oturumları kapatmaz, süresi dolunca biter. Hesabı kapatmak ise anında geçerlidir.
- Giriş denemesi sınırı tek sunucu belleğindedir; sunucu yeniden başlayınca sıfırlanır.
- Filiz sürümü işlem kaydı (kim ne yaptı) tutmaz.
- Belge yazıları okunabilir arama metni olarak veritabanında tutulur. Veritabanı yedeklerini de belgeler kadar koruyun.
