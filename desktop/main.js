// Yankı masaüstü uygulaması — Electron ana süreci
'use strict';
const { app, BrowserWindow, ipcMain, shell, desktopCapturer, session, Tray, Menu, nativeImage, dialog, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

let autoUpdater = null;
try { ({ autoUpdater } = require('electron-updater')); } catch { /* geliştirme ortamında yoksa sorun değil */ }

// ─── Ayarlar ───
const readJSON = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } };
const BUILD_CFG = readJSON(path.join(__dirname, 'config.json'));
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
let settings = readJSON(SETTINGS_FILE);
const saveSettings = () => { try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2)); } catch { /* yoksay */ } };
const clean = (u) => String(u || '').trim().replace(/\/+$/, '');
let discovered = settings.lastDiscovered || '';
const serverUrl = () => clean(settings.serverUrl || process.env.YANKI_SERVER_URL || discovered || BUILD_CFG.serverUrl);

// Sunucu adresi değişebilir (ör. ücretsiz tünel her açılışta yeni adres alır).
// Güncel adres GitHub deposundaki server.json dosyasından okunur; adres değişince uygulama kendini yeni adrese bağlar.
let discovering = null;
function discover() {
  if (!BUILD_CFG.discoveryUrl || settings.serverUrl || process.env.YANKI_SERVER_URL) return Promise.resolve(false);
  discovering ||= (async () => {
    try {
      const r = await fetch(BUILD_CFG.discoveryUrl, { headers: { Accept: 'application/vnd.github.raw+json', 'User-Agent': 'Yanki-Desktop' }, signal: AbortSignal.timeout(7000), cache: 'no-store' });
      if (!r.ok) return false;
      const url = clean((await r.json()).url);
      if (!/^https?:\/\/\S+$/.test(url) || url === discovered) return false;
      discovered = url; settings.lastDiscovered = url; saveSettings();
      return true;
    } catch { return false; } finally { setTimeout(() => (discovering = null), 0); }
  })();
  return discovering;
}
const serverOrigin = () => { try { return new URL(serverUrl()).origin; } catch { return null; } };
const ICON = path.join(__dirname, 'build', 'icon.png');

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
app.setAppUserModelId('app.yanki.desktop');

let win = null, tray = null, quitting = false, updateState = null;
const send = (ch, data) => { if (win && !win.isDestroyed()) win.webContents.send(ch, data); };

function loadApp() {
  const url = serverUrl();
  if (!url) return win.loadFile(path.join(__dirname, 'offline.html'), { query: { mode: 'setup' } });
  win.loadURL(url + '/app/@me');
}

function createWindow() {
  const b = settings.bounds || {};
  win = new BrowserWindow({
    width: b.width || 1280, height: b.height || 800, x: b.x, y: b.y, minWidth: 940, minHeight: 560,
    backgroundColor: '#1e1f22', title: 'Yankı', icon: ICON, autoHideMenuBar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true },
  });
  if (settings.maximized) win.maximize();
  win.once('ready-to-show', () => { if (!process.argv.includes('--hidden')) win.show(); });
  loadApp();

  // Dış bağlantılar varsayılan tarayıcıda açılsın
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('file:')) return;
    try { if (new URL(url).origin === serverOrigin()) return; } catch { /* yoksay */ }
    e.preventDefault(); shell.openExternal(url);
  });
  // Sunucuya ulaşılamazsa güzel bir çevrimdışı ekranı göster
  win.webContents.on('did-fail-load', async (e, code, desc, url, isMain) => {
    if (!isMain || code === -3) return;
    if (await discover()) return loadApp();
    win.loadFile(path.join(__dirname, 'offline.html'), { query: { mode: 'offline', err: desc, url: serverUrl() } });
  });
  win.on('page-title-updated', (e) => { e.preventDefault(); win.setTitle('Yankı'); });
  const saveBounds = () => { if (!win.isMaximized() && !win.isMinimized()) settings.bounds = win.getBounds(); settings.maximized = win.isMaximized(); saveSettings(); };
  win.on('resize', saveBounds); win.on('move', saveBounds);
  win.on('close', (e) => {
    if (!quitting && settings.minimizeToTray !== false) { e.preventDefault(); win.hide(); }
  });
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.setToolTip('Yankı');
  const menu = () => Menu.buildFromTemplate([
    { label: 'Yankı\'yı Aç', click: () => { win.show(); win.focus(); } },
    { type: 'separator' },
    { label: 'Güncellemeleri Denetle', click: () => checkUpdates(true) },
    { label: 'Sunucu Adresini Değiştir', click: () => { win.show(); win.loadFile(path.join(__dirname, 'offline.html'), { query: { mode: 'setup', url: serverUrl() } }); } },
    { label: 'Kapatınca Tepsiye Küçült', type: 'checkbox', checked: settings.minimizeToTray !== false, click: (i) => { settings.minimizeToTray = i.checked; saveSettings(); } },
    { label: 'Windows Açılışında Başlat', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked, args: ['--hidden'] }) },
    { type: 'separator' },
    { label: `Sürüm ${app.getVersion()}`, enabled: false },
    { label: 'Çıkış', click: () => { quitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu());
  tray.on('click', () => { win.isVisible() && win.isFocused() ? win.hide() : (win.show(), win.focus()); });
  tray.on('right-click', () => tray.setContextMenu(menu()));
}

// ─── İzinler: mikrofon, kamera, bildirim, ekran paylaşımı sadece kendi sunucumuza ───
function setupPermissions() {
  const ok = (wc, origin) => { try { return new URL(origin || wc.getURL()).origin === serverOrigin(); } catch { return false; } };
  const ALLOWED = ['media', 'notifications', 'display-capture', 'clipboard-sanitized-write', 'clipboard-read', 'fullscreen', 'speaker-selection'];
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb, details) => cb(ALLOWED.includes(perm) && ok(wc, details.requestingUrl)));
  session.defaultSession.setPermissionCheckHandler((wc, perm, origin) => ALLOWED.includes(perm) && ok(wc, origin));

  // Ekran paylaşımı: kaynak listesini arayüze gönder, kullanıcının seçimini bekle
  let reqSeq = 0;
  const pending = new Map();
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 400, height: 225 }, fetchWindowIcons: true });
      const id = ++reqSeq;
      pending.set(id, { sources, callback });
      send('yanki:pick-source', { requestId: id, sources: sources.map((s) => ({ id: s.id, name: s.name, thumb: s.thumbnail.toDataURL(), icon: s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.toDataURL() : null })) });
    } catch (e) { callback({}); }
  });
  ipcMain.on('yanki:picked', (_e, { requestId, sourceId, audio }) => {
    const p = pending.get(requestId);
    if (!p) return;
    pending.delete(requestId);
    const src = p.sources.find((s) => s.id === sourceId);
    if (!src) return p.callback({});
    p.callback(audio && process.platform === 'win32' ? { video: src, audio: 'loopback' } : { video: src });
  });
}

// ─── Otomatik güncelleme ───
function setUpdate(st) { updateState = st; send('yanki:update', st); }
function checkUpdates(manual) {
  if (!autoUpdater || !app.isPackaged) { if (manual) dialog.showMessageBox(win, { message: 'Güncelleme denetimi sadece kurulu sürümde çalışır.' }); return; }
  autoUpdater.checkForUpdates().then((r) => {
    if (manual && (!r || !r.updateInfo || r.updateInfo.version === app.getVersion())) dialog.showMessageBox(win, { message: `Yankı güncel (sürüm ${app.getVersion()}).` });
  }).catch((e) => { if (manual) dialog.showMessageBox(win, { type: 'error', message: 'Güncelleme denetlenemedi: ' + e.message }); });
}
function setupUpdater() {
  if (!autoUpdater) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (i) => setUpdate({ state: 'downloading', version: i.version, percent: 0 }));
  autoUpdater.on('download-progress', (p) => setUpdate({ ...(updateState || {}), state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (i) => {
    setUpdate({ state: 'ready', version: i.version });
    tray?.displayBalloon?.({ title: 'Yankı güncellemesi hazır', content: `Sürüm ${i.version} indirildi. Sağ üstteki "Güncelle" butonuna tıkla.`, iconType: 'info' });
  });
  autoUpdater.on('error', (e) => console.warn('Güncelleme hatası:', e?.message));
  setTimeout(() => checkUpdates(false), 5000);
  setInterval(() => checkUpdates(false), 30 * 60 * 1000);
}

// ─── Arayüzle iletişim ───
ipcMain.handle('yanki:get-info', () => ({ version: app.getVersion(), update: updateState, serverUrl: serverUrl(), platform: process.platform }));
ipcMain.handle('yanki:install-update', () => { if (updateState?.state === 'ready') { quitting = true; autoUpdater.quitAndInstall(true, true); } });
ipcMain.handle('yanki:set-server', async (_e, url) => {
  url = clean(url);
  if (!url && BUILD_CFG.discoveryUrl) { delete settings.serverUrl; saveSettings(); await discover(); loadApp(); return { ok: true }; }
  if (!/^https?:\/\/[^\s]+$/.test(url)) return { error: 'Geçerli bir adres gir (https://...)' };
  settings.serverUrl = url; saveSettings(); loadApp();
  return { ok: true };
});
ipcMain.handle('yanki:retry', async () => { await discover(); loadApp(); });
// Arayüz uzun süre sunucuya bağlanamazsa adres değişmiş olabilir: yeni adresi ara
ipcMain.on('yanki:disconnected', async () => { if (await discover()) loadApp(); });
// Oturum anahtarı uygulamada (şifreli) saklanır; sunucu adresi değişse bile kullanıcı çıkış yapmış olmaz
const fromServer = (e) => { try { return new URL(e.senderFrame.url).origin === serverOrigin(); } catch { return false; } };
ipcMain.on('yanki:token-get', (e) => {
  if (!fromServer(e) || !settings.token) { e.returnValue = ''; return; }
  try { e.returnValue = settings.tokenEnc ? safeStorage.decryptString(Buffer.from(settings.token, 'base64')) : settings.token; } catch { e.returnValue = ''; }
});
ipcMain.on('yanki:token-set', (e, t) => {
  if (!fromServer(e)) return;
  const enc = !!t && safeStorage.isEncryptionAvailable();
  settings.token = !t ? '' : enc ? safeStorage.encryptString(t).toString('base64') : t;
  settings.tokenEnc = enc; saveSettings();
});
ipcMain.on('yanki:badge', (_e, n) => {
  n = Math.max(0, Number(n) || 0);
  if (process.platform === 'win32' && win) {
    if (!n) win.setOverlayIcon(null, '');
    else {
      const label = n > 9 ? '9+' : String(n);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="16" fill="#f23f43"/><text x="16" y="22" font-size="${label.length > 1 ? 15 : 19}" font-family="Segoe UI,Arial" font-weight="700" fill="#fff" text-anchor="middle">${label}</text></svg>`;
      win.setOverlayIcon(nativeImage.createFromDataURL('data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')), `${n} okunmamış`);
    }
    if (n && !win.isFocused()) win.flashFrame(true);
  } else app.setBadgeCount?.(n);
});

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
app.on('before-quit', () => { quitting = true; });
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  setupPermissions();
  await discover();
  createWindow();
  createTray();
  setupUpdater();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
