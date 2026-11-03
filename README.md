# 🔊 Yankı

Kendi sunucunda çalışan, Türkçe, **tüm "Nitro" özellikleri ücretsiz** bir Discord alternatifi.

## Hızlı başlangıç (kendi bilgisayarında)

1. [Node.js 22.5 veya üstü](https://nodejs.org) kur (LTS sürümü yeterli).
2. Bu klasörde bir terminal aç ve:

```bash
npm install
npm start
```

3. Tarayıcıda **http://localhost:3000** adresini aç, hesap oluştur.
4. Arkadaş testi için ikinci bir tarayıcı (veya gizli pencere) açıp ikinci bir hesap oluştur.

> Mikrofon, kamera ve ekran paylaşımı tarayıcı kuralları gereği sadece `localhost` üzerinde veya **HTTPS** ile çalışır.

## Arkadaşlarınla internet üzerinden kullanmak

En kolay yol, ücretsiz bir HTTPS tüneli: [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) ile

```bash
cloudflared tunnel --url http://localhost:3000
```

Sana verilen `https://….trycloudflare.com` adresini arkadaşlarına gönder. Kalıcı kullanım için bir VPS'e kurup alan adı + HTTPS ekleyebilirsin:

```bash
SSL_CERT=/yol/fullchain.pem SSL_KEY=/yol/privkey.pem PORT=443 npm start
```

Farklı ağlardaki kişiler arasında sesli/görüntülü bağlantı bazı modemlerde kurulamayabilir; bu durumda bir TURN sunucusu ekle (ör. coturn):
`TURN_URL=turn:sunucun.com:3478 TURN_USER=kullanici TURN_PASS=sifre npm start`

## 🚀 Yayınlama: Sunucu + Setup.exe + İndirme Sitesi

Yapı şöyle:

```
 Kullanıcılar ──► Yanki-Setup.exe (Electron) ──┐
                                                ├──► Railway'deki Yankı sunucusu (API, sohbet, ses sinyalleri, veritabanı)
 Tarayıcıdan girenler ─────────────────────────┘
 İndirme sitesi (Vercel) ──► GitHub Releases'teki Yanki-Setup.exe
```

> **Neden sunucu Vercel'de değil?** Vercel "serverless" çalışır: istekler kısa ömürlü fonksiyonlarda işlenir, sürekli açık WebSocket bağlantısı ve kalıcı disk yoktur. Yankı'nın canlı sohbet, sesli kanal ve veritabanı için ikisine de ihtiyacı var. O yüzden sunucu Railway'de (ya da Render/Fly.io/VPS), **indirme sitesi Vercel'de** çalışır.

### 1) Kodu GitHub'a yükle
1. github.com'da yeni bir depo oluştur, örneğin `yanki`. Otomatik güncellemenin herkese çalışması için depo **Public** olmalı.
2. Bu klasörü o depoya yükle (GitHub Desktop ile "Add existing repository → Publish" en kolayı).

### 2) Sunucuyu Railway'de yayınla
1. railway.com → **New Project → Deploy from GitHub repo** → `yanki` deposunu seç. `Dockerfile` ve `railway.json` otomatik algılanır.
2. Servise tıkla → **Volumes → New Volume** → Mount path: `/data`. Bu adım şart; yoksa her güncellemede hesaplar ve mesajlar silinir.
3. **Settings → Networking → Generate Domain**. Sana `https://yanki-xxxx.up.railway.app` gibi bir adres verir. Bu adres artık senin sunucun.
4. İstersen **Variables** kısmından `MAX_UPLOAD_MB`, `TENOR_API_KEY`, `TURN_URL` vb. ekle.

### 3) Setup.exe'yi üret
1. GitHub deposunda **Settings → Secrets and variables → Actions → Variables → New repository variable**:
   - Name: `YANKI_SERVER_URL`
   - Value: Railway adresin (ör. `https://yanki-xxxx.up.railway.app`, sonunda `/` olmadan)
2. **Actions** sekmesi → **Masaüstü Sürümü** → **Run workflow** → sürüm: `1.0.0` → çalıştır.
3. Yaklaşık 5 dakika sonra **Releases** sayfasında `Yanki-Setup.exe` hazır olur. Bunu insanlara gönderebilirsin.

### 4) İndirme sitesini Vercel'de yayınla
1. `site/config.js` dosyasında `githubRepo` ve `webUrl` alanlarını doldur, GitHub'a gönder.
2. vercel.com → **Add New → Project** → depoyu seç → **Root Directory: `site`** → Framework: **Other** → **Deploy**.
3. Sitedeki "Windows için İndir" butonu her zaman en son sürümü indirir.

## 🔄 Güncelleme nasıl çalışır?

İki tür güncelleme var. Kullanıcıların ikisinde de sağ üstte yeşil **Güncelle** butonu görünür:

| Ne değişti? | Ne yaparsın? | Kullanıcı ne görür? |
|---|---|---|
| Arayüz veya sunucu (`public/`, `server.js`). Güncellemelerin neredeyse hepsi bu | Kodu GitHub'a gönder. Railway kendiliğinden yeniden yayınlar | Birkaç saniye içinde **Güncelle** butonu çıkar, tıklayınca yeni sürüm yüklenir |
| Masaüstü uygulamasının kendisi (`desktop/`) | **Actions → Masaüstü Sürümü → Run workflow** ile daha büyük bir sürüm numarası ver (ör. `1.0.1`) | Uygulama yeni sürümü arka planda indirir, sonra **Güncelle** butonu çıkar. Tıklayınca uygulama yeniden başlar ve güncellenir |

> ⚠️ Kurulum dosyası dijital olarak imzalı değil. İlk kurulumda Windows "Bilgisayarınız korundu" uyarısı gösterebilir. Kullanıcıların **Ek bilgi → Yine de çalıştır** demesi gerekir. Bu uyarının tamamen kalkması için ücretli bir kod imzalama sertifikası gerekir.

## Masaüstü uygulamasını geliştirirken çalıştırma

PowerShell'de (önce kök klasörde `npm start` ile sunucuyu çalıştır, sonra ikinci bir pencerede):

```powershell
cd desktop
npm.cmd install
$env:YANKI_SERVER_URL="http://localhost:3000"; npm.cmd start
```

## Ayarlar (ortam değişkenleri)

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `PORT` | 3000 | Sunucu portu |
| `DATA_DIR` | `./data` | Veritabanı ve yüklenen dosyalar |
| `MAX_UPLOAD_MB` | 100 | Dosya başına yükleme sınırı |
| `TENOR_API_KEY` | — | Verilirse GIF seçicide Tenor araması açılır |
| `SSL_CERT` / `SSL_KEY` | — | HTTPS için sertifika dosyaları |
| `TURN_URL` / `TURN_USER` / `TURN_PASS` | — | Zor ağlar için TURN sunucusu |

## Özellikler

**Discord'daki temel her şey:** hesap açma/giriş, sunucu oluşturma (şablonlarla), davet bağlantıları (süre/kullanım sınırı), arkadaş ekleme/istekler/engelleme, DM ve grup DM, metin/ses/duyuru kanalları, kategoriler (sürükle-bırak sıralama), roller ve yetkiler (18 yetki, rol hiyerarşisi, renkli & ayrı gösterilen roller), özel kanallar, atma/yasaklama, yavaş mod, sesli sohbet, kamera, ekran paylaşımı/yayın, kendini susturma & sağırlaştırma, moderatör susturması, DM sesli/görüntülü arama (gelen arama ekranıyla), yanıtlar, tepkiler, düzenleme/silme, sabitleme, arama, bahsetmeler (@kişi, @rol, @everyone), yazıyor göstergesi, okunmamış/bahsedilme rozetleri, Markdown + kod renklendirme, spoiler, dosya/resim/video yükleme, GIF'ler, özel sunucu emojileri, profil resmi, durum & özel durum, masaüstü bildirimleri.

**"Nitro" özellikleri — herkese bedava:** animasyonlu (GIF) avatar ve afiş, profil temaları (iki renk), 11 avatar süsü, 8 profil efekti, isim stilleri (yazı tipi + animasyonlu gradyan), 1080p60 / 1440p60 / 4K yayın, 100MB dosya, her yerde özel emoji, 4000 karakter mesaj, 7 gradyan uygulama teması + vurgu rengi, sunucu afişi, sunucu başına takma ad.

**Neden Yankı? (Discord'da olmayan veya ücretli olanlar):**
- 💣 Kendini imha eden (süreli) mesajlar
- ⏰ Zamanlanmış mesajlar (sunucu gönderir, bilgisayarın kapalı olsa bile)
- 📊 Süreli, çoklu seçimli anketler
- 🔖 Kaydedilen mesajlar (yer imleri)
- 🔊 Ücretsiz ses efektleri paneli
- 🎚️ Kişiye özel ses seviyesi, bas-konuş, gürültü engelleme, mikrofon testi, gecikme göstergesi
- 🎲 Yerleşik komutlar: `/zar`, `/yazitura`, `/8top`, `/sec`, `/anket`, `/zamanla`, `/sureli`, `/nick`, `/shrug`…
- 📜 Denetim kaydı, 🗣️ mesajı sesli okuma, ⌨️ Ctrl+K hızlı geçiş
- 🏠 Kendi sunucunda barındırma — veri sende, reklam ve takip yok
- 🇹🇷 Tamamen Türkçe arayüz ve emoji araması ("ateş", "kalp", "döner")

## Teknik

Node.js + Express + Socket.IO + yerleşik SQLite (`node:sqlite`), WebRTC (mesh, "perfect negotiation"). İstemci derleme adımı gerektirmeyen saf JavaScript. Sesli kanallar 25 kişiye kadar desteklenir (eşler arası mesh); daha büyük kanallar için ileride bir SFU (ör. LiveKit/mediasoup) eklenebilir.
