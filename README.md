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

## 🚀 Yayınlama (ücretsiz): Sunucu + Setup.exe + İndirme Sitesi

```
 Kullanıcılar ──► Yanki-Setup.exe ──┐                       ┌──► Senin bilgisayarında çalışan Yankı sunucusu
 Tarayıcıdan girenler ──────────────┼──► Cloudflare tüneli ─┘     (Sunucuyu-Baslat.bat)
 İndirme sitesi (Vercel) ───────────┘    (ücretsiz https adresi)
                  ▲
   Güncel adres: GitHub'daki server.json (betik her açılışta otomatik yazar)
```

- **Sunucu:** kendi bilgisayarında çalışır. Cloudflare'in ücretsiz tüneli onu internete açar; hesap da kart da gerekmez.
- **Adres değişirse:** tünel adresi her açılışta değişir. `Sunucuyu-Baslat.bat` yeni adresi GitHub'a yazar, kurulu uygulamalar ve indirme sitesi oradan okur. Kullanıcıların oturumu açık kalır.
- **Dikkat:** başlatma penceresi açık ve bilgisayar uyanık olduğu sürece Yankı çalışır.
- **İleride:** ücretli veya ücretsiz bir sunucuya geçersen (Railway, Oracle Free vb.), `yanki-adres` dalındaki `server.json`'a yeni adresi yazman yeterli. Exe'yi yeniden dağıtman gerekmez. `Dockerfile` ve `railway.json` hazır duruyor.

### 1) Kodu GitHub'a yükle
github.com'da **Public** bir `yanki` deposu aç ve bu klasörü yükle (GitHub Desktop → Add local repository → Publish, "Keep this code private" kapalı).

### 2) Sunucuyu başlat
1. `Sunucuyu-Baslat.bat` dosyasına çift tıkla.
2. İlk seferde iki şey sorar: GitHub depo adın (ör. `ahmet/yanki`) ve bir GitHub anahtarı (token). Token'ın nasıl alınacağını pencerede adım adım yazar.
3. Yeşil kutuda `https://….trycloudflare.com` adresi çıkar ve GitHub'a otomatik yazılır.

### 3) Setup.exe'yi üret
GitHub → **Actions** → **Masaüstü Sürümü** → **Run workflow** → sürüm `1.0.0`. Birkaç dakika sonra **Releases**'te `Yanki-Setup.exe` hazır olur. Sunucu adresini girmene gerek yok; uygulama güncel adresi kendisi bulur.

### 4) İndirme sitesini Vercel'e koy
`site/config.js` içine `githubRepo`'yu yaz ve GitHub'a gönder. Sonra Vercel → **Add New → Project** → depo → **Root Directory: `site`** → **Deploy**.

## 🔄 Güncelleme nasıl çalışır?

| Ne değişti? | Ne yaparsın? | Kullanıcı ne görür? |
|---|---|---|
| Arayüz veya sunucu (`public/`, `server.js`). Güncellemelerin neredeyse hepsi bu | Yeni dosyaları klasöre koy, `Sunucuyu-Baslat.bat` penceresini kapatıp tekrar aç. Kodu GitHub'a da gönder | Sağ üstte yeşil **Güncelle** butonu çıkar, tıklayınca yeni sürüm yüklenir |
| Masaüstü uygulamasının kendisi (`desktop/`) | GitHub'a gönder → **Actions → Masaüstü Sürümü → Run workflow**, öncekinden büyük bir numara ver (`1.0.1`) | Uygulama yeni sürümü arka planda indirir, **Güncelle** butonu çıkar, tıklayınca yeniden başlar |

> ⚠️ Kurulum dosyası dijital olarak imzalı değil. İlk kurulumda Windows "Bilgisayarınız korundu" diyebilir; kullanıcılar **Ek bilgi → Yine de çalıştır** demeli.
> 🔒 `tools/host-config.json` içinde GitHub anahtarın durur. Bu dosyayı kimseyle paylaşma; zaten GitHub'a yüklenmez (`.gitignore`).

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
