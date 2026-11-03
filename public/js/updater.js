// ════════ Güncelleme butonu & masaüstü entegrasyonu ════════
// İki tür güncelleme var:
//  1) Masaüstü uygulamasının yeni sürümü (Setup.exe) — arka planda iner, hazır olunca "Yeniden başlat" butonu çıkar.
//  2) Sunucuya yeni arayüz yüklendi — açık olan herkese "Güncelle" butonu çıkar, tıklayınca sayfa yenilenir.
'use strict';
const Desktop = window.yankiDesktop || null;
const Updater = {
  loaded: null, webAvailable: false, desktop: null,

  init() {
    fetch('/api/version').then((r) => r.json()).then((v) => { this.loaded ||= v.client; }).catch(() => {});
    setInterval(() => this.checkWeb(), 10 * 60 * 1000);
    if (Desktop) {
      document.documentElement.classList.add('is-desktop');
      Desktop.onUpdate((st) => { this.desktop = st; this.render(); });
      Desktop.getInfo().then((i) => { if (i.update) { this.desktop = i.update; this.render(); } }).catch(() => {});
      Desktop.onPickSource((req) => this.pickSource(req));
    }
  },
  onSocketVersion(v) {
    if (!this.loaded) { this.loaded = v.client; return; }
    if (v.client !== this.loaded && !this.webAvailable) { this.webAvailable = true; this.render(); }
  },
  async checkWeb() {
    try { const v = await (await fetch('/api/version', { cache: 'no-store' })).json(); this.onSocketVersion(v); } catch { /* çevrimdışı */ }
  },
  render() {
    $('#updateBtn')?.remove();
    const ready = this.desktop?.state === 'ready';
    if (!ready && !this.webAvailable) { document.documentElement.classList.remove('has-update'); return; }
    document.documentElement.classList.add('has-update');
    const label = ready ? 'Güncelle' : 'Güncelle';
    const tip = ready ? `Yankı ${this.desktop.version} hazır — yeniden başlatmak için tıkla` : 'Yankı\'nın yeni bir sürümü mevcut — yenilemek için tıkla';
    const b = h(`<button id="updateBtn" data-tip="${esc(tip)}" data-tip-side="bottom">${icon('download', 'sm')}<span>${label}</span></button>`);
    b.onclick = async () => {
      if (ready) {
        if (Voice.connected && !(await confirmModal('Güncelleme', 'Güncelleme için Yankı yeniden başlatılacak ve ses bağlantın kesilecek. Devam edilsin mi?', 'Yeniden Başlat', false))) return;
        Desktop.installUpdate();
      } else {
        if (Voice.connected && !(await confirmModal('Güncelleme', 'Sayfa yenilenecek ve ses bağlantın kesilecek. Devam edilsin mi?', 'Güncelle', false))) return;
        location.reload();
      }
    };
    document.body.append(b);
    if (!this.toasted) { this.toasted = true; toast(ready ? `Yeni sürüm (${this.desktop.version}) indirildi. Sağ üstten güncelleyebilirsin.` : 'Yeni bir güncelleme mevcut! Sağ üstteki butona tıkla.'); }
  },

  // Masaüstü: ekran / pencere seçici (tarayıcıdaki seçicinin yerine)
  pickSource({ requestId, sources }) {
    let done = false;
    const finish = (id, audio) => { if (done) return; done = true; Desktop.pickSource(requestId, id, audio); };
    const screens = sources.filter((s) => s.id.startsWith('screen'));
    const windows = sources.filter((s) => !s.id.startsWith('screen'));
    const card = (s) => `<button class="src-card" data-id="${esc(s.id)}"><img src="${s.thumb}" alt=""><span class="row" style="gap:6px">${s.icon ? `<img src="${s.icon}" style="width:16px;height:16px">` : ''}<span class="ellipsis">${esc(s.name)}</span></span></button>`;
    const md = modal({ title: 'Ekran Paylaş', cls: 'xl', sub: 'Yayınlamak istediğin ekranı veya uygulama penceresini seç.', onClose: () => finish(null, false),
      body: `<div class="p-tabs" style="display:flex;gap:6px;margin-bottom:12px"><button class="tag" data-tab="apps" style="cursor:pointer">Uygulamalar (${windows.length})</button><button class="tag" data-tab="screens" style="cursor:pointer">Ekranlar (${screens.length})</button></div>
        <div class="src-grid" data-pane="apps">${windows.map(card).join('') || '<div class="muted">Açık pencere bulunamadı</div>'}</div>
        <div class="src-grid hidden" data-pane="screens">${screens.map(card).join('')}</div>`,
      foot: `<label class="row small grow" style="${Desktop.platform === 'win32' ? '' : 'display:none'}"><input type="checkbox" id="srcAudio" checked style="accent-color:var(--brand)"> Bilgisayar sesini de paylaş</label><button class="btn ghost" data-close>İptal</button>` });
    const tab = (t) => { $$('[data-pane]', md.el).forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== t)); $$('[data-tab]', md.el).forEach((b) => b.classList.toggle('brand', b.dataset.tab === t)); };
    tab(windows.length ? 'apps' : 'screens');
    md.el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]'); if (t) tab(t.dataset.tab);
      const c = e.target.closest('.src-card');
      if (c) { finish(c.dataset.id, !!md.$('#srcAudio')?.checked); md.el.remove(); }
    });
  },
  setBadge(n) { Desktop?.setBadge(n); },
};
Updater.init();
