# Kurulum ve Bakım

Bu rehber Evrakdar Filiz sürümünü kendi bilgisayarınıza ya da sunucunuza kurmayı anlatır.

## Gereken

- Docker (Windows ve Mac için [Docker Desktop](https://www.docker.com/products/docker-desktop/), Linux için Docker Engine)
- En az 2 çekirdek işlemci, 4 GB bellek, 20 GB boş disk
- İlk kurulum için internet bağlantısı

## Bilgisayara kurulum

Depoyu indirin ve klasörün içinde kurulum dosyasını çalıştırın.

Windows (PowerShell):

```powershell
git clone https://github.com/evrakdar/evrakdar-filiz.git
cd evrakdar-filiz
powershell -ExecutionPolicy Bypass -File kur.ps1
```

Linux ve macOS:

```bash
git clone https://github.com/evrakdar/evrakdar-filiz.git
cd evrakdar-filiz
sh kur.sh
```

Git yoksa GitHub sayfasındaki **Code > Download ZIP** ile indirip klasörü açabilirsiniz.

Kurulum sırasında:

1. Kurumunuzun adı sorulur. Ekranda görünür.
2. Gizli anahtarlar rastgele üretilip `.env.production` dosyasına yazılır. Bu dosyayı kimseyle paylaşmayın.
3. Sistem hazırlanır. İlk seferde 5-15 dakika sürebilir.
4. Başlangıç hesapları oluşturulur: `admin`, `editor` ve `user`. Üçünün de şifresi `1234`.

Bitince tarayıcıdan **http://localhost:3000** adresini açıp giriş yapın. Sistem bu aşamada yalnız kurulduğu bilgisayardan açılır. Hazır şifreyle girenler ekranda uyarı görür, **Şifremi Değiştir** düğmesiyle kendi şifrelerini belirler.

3000 ya da 3001 portu doluysa kurulumu başka portla başlatın:

```powershell
$env:WEB_PORT="3100"; $env:API_PORT="3101"; powershell -ExecutionPolicy Bypass -File kur.ps1
```

```bash
WEB_PORT=3100 API_PORT=3101 sh kur.sh
```

## Okul ağından erişim

Sunucu olarak kullanılan bilgisayarın ağ adresi örneğin `192.168.1.50` olsun. `.env.production` dosyasında şu satırları değiştirin:

```text
PUBLIC_WEB_URL="http://192.168.1.50:3000"
PUBLIC_API_URL="http://192.168.1.50:3001"
WEB_BIND="0.0.0.0:3000"
API_BIND="0.0.0.0:3001"
```

Sonra kurulum dosyasını yeniden çalıştırın. Mevcut verileriniz korunur.

Sistem ağa açıldığında `1234` ile giriş kendiliğinden kapanır. Şifresini değiştirmemiş hesaplara kurulum sırasında yeni şifre üretilir ve ekrana **bir kez** yazılır, not alın. Bu hesaplar ilk girişte kendi şifrelerini belirlemeden sisteme giremez.

Şifreler ağ üzerinde şifresiz gider. Bu yüzden yalnız güvendiğiniz bir iç ağda böyle kullanın. Dışarıdan erişim için aşağıdaki HTTPS adımını uygulayın.

## İnternete açmak (HTTPS)

İki alan adı ayarlayın, örneğin `belge.okulunuz.k12.tr` ve `api.belge.okulunuz.k12.tr`. `.env.production` dosyasında:

```text
PUBLIC_WEB_URL="https://belge.okulunuz.k12.tr"
PUBLIC_API_URL="https://api.belge.okulunuz.k12.tr"
WEB_BIND="127.0.0.1:3000"
API_BIND="127.0.0.1:3001"
TRUST_PROXY="1"
```

Önüne bir ters vekil koyun. Caddy örneği (sertifikayı kendisi alır):

```text
belge.okulunuz.k12.tr {
  reverse_proxy 127.0.0.1:3000
}

api.belge.okulunuz.k12.tr {
  reverse_proxy 127.0.0.1:3001
}
```

Sonra kurulum dosyasını yeniden çalıştırın. Hazır şifreler için okul ağındaki kural burada da geçerlidir.

## Günlük işlemler

Aşağıdaki komutları Evrakdar klasörünün içinde çalıştırın. Her komutun başına şunu ekleyin:

```bash
docker compose -f docker/docker-compose.prod.yml --env-file .env.production
```

| İş | Komutun devamı |
| --- | --- |
| Durdurmak | `stop` |
| Yeniden başlatmak | `start` |
| Çalışıyor mu bakmak | `ps` |
| Hata kayıtlarına bakmak | `logs --tail 100 api` |

Sağlık kontrolü için tarayıcıdan `http://localhost:3001/health` adresini açın. `{"status":"ok","database":"ok"}` görmelisiniz.

Bilgisayar yeniden açıldığında Docker çalışıyorsa sistem kendiliğinden açılır.

## Yedekleme

Belgeler sunucunun diskinde durur. Veritabanını ve dosyaları ayrı ayrı yedekleyin. Düzenli çalıştırıp yedekleri başka bir diske alın.

```bash
# Veritabanı
docker compose -f docker/docker-compose.prod.yml --env-file .env.production exec -T postgres pg_dump --clean --if-exists -U evrakdar evrakdar > yedek-veritabani.sql

# Dosyalar
docker run --rm -v evrakdar-prod_files-data:/data -v "$PWD":/yedek alpine tar czf /yedek/yedek-dosyalar.tar.gz -C /data .
```

Geri yükleme. Sistemdeki mevcut veriler yedektekilerle değişir:

```bash
# Veritabanı
docker compose -f docker/docker-compose.prod.yml --env-file .env.production exec -T postgres psql -U evrakdar evrakdar < yedek-veritabani.sql

# Dosyalar
docker run --rm -v evrakdar-prod_files-data:/data -v "$PWD":/yedek alpine tar xzf /yedek/yedek-dosyalar.tar.gz -C /data
```

## Güncelleme

Önce yedek alın. Sonra:

```bash
git pull
sh kur.sh        # Windows: powershell -ExecutionPolicy Bypass -File kur.ps1
```

Veritabanı değişiklikleri kendiliğinden uygulanır, verileriniz korunur.

## Yönetici şifresini unuttum

Başka bir yönetici hesabı varsa **Tüm Kullanıcılar ve Yetkilendirme** ekranından yeni şifre verebilir. Yoksa yeni bir yönetici açın. Kullanıcı adını ve şifreyi değiştirin, şifre en az 12 karakter olmalı:

```bash
docker compose -f docker/docker-compose.prod.yml --env-file .env.production run --rm -e SEED_ADMIN_USERNAME=yonetici2 -e SEED_ADMIN_PASSWORD=BurayaGucluBirSifre api npx prisma db seed
```

## Tamamen kaldırmak

Aşağıdaki komut **tüm belgeleri ve kullanıcıları siler**, geri dönüşü yoktur:

```bash
docker compose -f docker/docker-compose.prod.yml --env-file .env.production down -v
```

## Dosyaları bulutta tutmak (isteğe bağlı)

Dosyalar varsayılan olarak sunucunun diskinde durur. AWS S3, Cloudflare R2, Backblaze B2 gibi S3 uyumlu bir hizmet kullanmak isterseniz `.env.production` dosyasına şunları ekleyip kurulum dosyasını yeniden çalıştırın:

```text
STORAGE_DRIVER="s3"
S3_ENDPOINT="https://s3.ornek-hizmet.com"
S3_BUCKET="evrakdar"
S3_ACCESS_KEY="..."
S3_SECRET_KEY="..."
```

Daha önce diske yüklenmiş dosyalar kendiliğinden taşınmaz. Bu ayarı kurulumun başında yapın.

## Sorun giderme

| Belirti | Çözüm |
| --- | --- |
| "Docker çalışmıyor" | Docker Desktop'ı açın, hazır olana kadar bekleyin. |
| "port is already allocated" | Başka bir program o portu kullanıyor. Yukarıdaki gibi başka portla kurun. Daha önce kurulum başladıysa `.env.production` içindeki port satırlarını da değiştirin. |
| Giriş ekranı "Sisteme ulaşılamadı" diyor | `.env.production` içindeki `PUBLIC_API_URL` tarayıcının ulaşabileceği bir adres olmalı. Değiştirdiyseniz kurulum dosyasını yeniden çalıştırın. |
| "Çok fazla başarısız giriş denemesi" | 15 dakika bekleyin. |
| Dosya yüklenmiyor | Sınır 20 MB'tır. Türler: PDF, Word, Excel, PowerPoint, metin, PNG, JPG. Devam ederse API kayıtlarına bakın. |
