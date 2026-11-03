// ════════ Yankı — Ücretsiz barındırma (kendi bilgisayarın + Cloudflare tüneli) ════════
// 1) Yankı sunucusunu başlatır
// 2) Cloudflare'in ücretsiz tünelini açar (hesap/kart gerekmez) → herkese açık https adresi
// 3) Bu adresi GitHub deposundaki server.json'a yazar → kurulu uygulamalar ve indirme sitesi yeni adresi otomatik bulur
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.join(__dirname, '..');
const BIN_DIR = path.join(__dirname, 'bin');
const CFG_FILE = path.join(__dirname, 'host-config.json');
const PORT = process.env.PORT || 3000;
const BRANCH = 'yanki-adres';
const isWin = process.platform === 'win32';
const C = { g: '\x1b[32m', y: '\x1b[33m', r: '\x1b[31m', c: '\x1b[36m', b: '\x1b[1m', x: '\x1b[0m' };
const log = (m) => console.log(m);

const ask = (q) => new Promise((res) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); res(a.trim()); }); });
const readCfg = () => { try { return JSON.parse(fs.readFileSync(CFG_FILE, 'utf8')); } catch { return null; } };

async function setup() {
  let cfg = readCfg();
  if (cfg) return cfg;
  log(`\n${C.b}${C.c}━━━ Yankı ilk kurulum ━━━${C.x}\n`);
  log('Kurulu uygulamaların seni otomatik bulabilmesi için sunucu adresini GitHub deponda saklayacağız.');
  log(`(Bu adımı atlamak için iki soruyu da boş geçip Enter'a basabilirsin.)\n`);
  const repo = await ask(`${C.b}GitHub deponun adı${C.x} (örnek: ahmet/yanki): `);
  let token = '';
  if (repo) {
    log(`\n${C.y}GitHub anahtarı (token) nasıl alınır:${C.x}`);
    log('  1. https://github.com/settings/personal-access-tokens/new adresini aç');
    log('  2. Token name: yanki   •   Expiration: No expiration (ya da 1 yıl)');
    log(`  3. Repository access: "Only select repositories" → ${repo.split('/')[1] || 'yanki'} deposunu seç`);
    log('  4. Permissions → Repository permissions → Contents: "Read and write"');
    log('  5. En alttaki "Generate token" → çıkan github_pat_... ile başlayan yazıyı kopyala\n');
    token = await ask(`${C.b}Token'ı yapıştır${C.x} (sağ tık = yapıştır): `);
  }
  cfg = { repo, token };
  fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2));
  log(`${C.g}✔ Ayarlar kaydedildi (tools/host-config.json). Değiştirmek için bu dosyayı silmen yeterli.${C.x}\n`);
  return cfg;
}

async function ensureCloudflared() {
  if (process.env.CLOUDFLARED_PATH) return process.env.CLOUDFLARED_PATH;
  const file = path.join(BIN_DIR, isWin ? 'cloudflared.exe' : 'cloudflared');
  if (fs.existsSync(file)) return file;
  fs.mkdirSync(BIN_DIR, { recursive: true });
  const asset = isWin ? 'cloudflared-windows-amd64.exe' : process.platform === 'darwin' ? null : process.arch === 'arm64' ? 'cloudflared-linux-arm64' : 'cloudflared-linux-amd64';
  if (!asset) throw new Error('macOS için: "brew install cloudflared" ile kur ve tekrar dene.');
  log(`${C.c}⬇ Cloudflare tünel programı indiriliyor (bir kereliğine, ~30 MB)…${C.x}`);
  const r = await fetch(`https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`);
  if (!r.ok) throw new Error('İndirilemedi: ' + r.status);
  const total = Number(r.headers.get('content-length')) || 0;
  const out = fs.createWriteStream(file + '.part');
  let got = 0;
  for await (const chunk of r.body) { out.write(chunk); got += chunk.length; if (total) process.stdout.write(`\r   %${Math.floor((got / total) * 100)} `); }
  await new Promise((res) => out.end(res));
  fs.renameSync(file + '.part', file);
  if (!isWin) fs.chmodSync(file, 0o755);
  log(`\r${C.g}✔ İndirildi${C.x}          `);
  return file;
}

async function gh(cfg, method, url, body) {
  const r = await fetch((process.env.GITHUB_API || 'https://api.github.com') + url, {
    method, body: body ? JSON.stringify(body) : undefined,
    headers: { Authorization: 'Bearer ' + cfg.token, Accept: 'application/vnd.github+json', 'User-Agent': 'Yanki-Host', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}
async function publishAddress(cfg, url) {
  if (!cfg.repo || !cfg.token) { log(`${C.y}ℹ GitHub ayarı yok; adres otomatik paylaşılmadı. Adresi arkadaşlarına kendin gönder.${C.x}`); return; }
  const repo = cfg.repo;
  // Adres, ana koddan ayrı bir dalda tutulur; böylece senin kod gönderimlerinle çakışmaz
  let br = await gh(cfg, 'GET', `/repos/${repo}/branches/${BRANCH}`);
  if (br.status === 404) {
    const info = await gh(cfg, 'GET', `/repos/${repo}`);
    if (!info.ok) throw new Error(`Depoya erişilemedi (${info.status}). Depo adını ve token izinlerini kontrol et.`);
    const head = await gh(cfg, 'GET', `/repos/${repo}/git/ref/heads/${info.j.default_branch}`);
    const mk = await gh(cfg, 'POST', `/repos/${repo}/git/refs`, { ref: `refs/heads/${BRANCH}`, sha: head.j.object.sha });
    if (!mk.ok) throw new Error('Adres dalı oluşturulamadı: ' + (mk.j.message || mk.status));
  } else if (!br.ok) throw new Error(`GitHub hatası (${br.status}): ${br.j.message || ''}. Token'ın "Contents: Read and write" izni var mı?`);
  const cur = await gh(cfg, 'GET', `/repos/${repo}/contents/server.json?ref=${BRANCH}`);
  const content = Buffer.from(JSON.stringify({ url, updated_at: new Date().toISOString() }, null, 2) + '\n').toString('base64');
  const put = await gh(cfg, 'PUT', `/repos/${repo}/contents/server.json`, { message: 'Sunucu adresi güncellendi', content, branch: BRANCH, sha: cur.ok ? cur.j.sha : undefined });
  if (!put.ok) throw new Error('Adres yazılamadı: ' + (put.j.message || put.status));
  log(`${C.g}✔ Adres GitHub'a yazıldı — kurulu uygulamalar birkaç saniye içinde yeni adrese bağlanacak.${C.x}`);
}

(async () => {
  const children = [];
  const stopAll = () => { for (const c of children) try { c.kill(); } catch { /* yoksay */ } process.exit(0); };
  process.on('SIGINT', stopAll); process.on('SIGTERM', stopAll);
  try {
    const cfg = await setup();
    // 1) Yankı sunucusu
    const server = spawn(process.execPath, ['--no-warnings', 'server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(server);
    server.stderr.on('data', (d) => process.stderr.write(d));
    server.on('exit', (code) => { log(`${C.r}✘ Yankı sunucusu kapandı (kod ${code}). Bu pencereyi kapatıp tekrar başlat.${C.x}`); stopAll(); });
    await new Promise((res) => server.stdout.on('data', (d) => { if (String(d).includes('çalışıyor')) res(); }));
    log(`${C.g}✔ Yankı sunucusu çalışıyor (http://localhost:${PORT})${C.x}`);

    // 2) Ücretsiz Cloudflare tüneli
    const bin = await ensureCloudflared();
    log(`${C.c}… İnternete açılıyor (Cloudflare tüneli)${C.x}`);
    const tun = spawn(bin, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${PORT}`], { stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(tun);
    tun.on('exit', (code) => { log(`${C.r}✘ Tünel kapandı (kod ${code}). İnternet bağlantını kontrol edip tekrar başlat.${C.x}`); stopAll(); });
    let announced = false;
    const onOut = async (d) => {
      const m = String(d).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (!m || announced) return;
      announced = true;
      const url = m[0];
      log(`\n${C.b}${C.g}╔══════════════════════════════════════════════════════════════╗${C.x}`);
      log(`${C.b}${C.g}  🔊 Yankı internete açıldı!${C.x}`);
      log(`${C.b}     ${url}${C.x}`);
      log(`${C.b}${C.g}╚══════════════════════════════════════════════════════════════╝${C.x}\n`);
      try { await publishAddress(cfg, url); } catch (e) { log(`${C.r}✘ ${e.message}${C.x}`); }
      log(`\n${C.y}⚠ Bu pencere açık kaldığı sürece Yankı çalışır. Kapatırsan herkesin bağlantısı kesilir.${C.x}`);
      log(`${C.y}  Bilgisayarın uyku moduna geçmesin: Ayarlar → Sistem → Güç → Uyku: "Hiçbir zaman".${C.x}\n`);
    };
    tun.stdout.on('data', onOut); tun.stderr.on('data', onOut);
  } catch (e) {
    log(`${C.r}✘ ${e.message}${C.x}`);
    stopAll();
  }
})();
