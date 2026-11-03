// ════════ Ayarlar ════════
'use strict';
const THEMES = [
  ['dark', 'Koyu', '#313338'], ['midnight', 'Gece (AMOLED)', '#000'], ['light', 'Açık', '#fff'],
  ['g-sunset', 'Gün Batımı', 'linear-gradient(135deg,#4b134f,#c94b4b,#f09819)'], ['g-ocean', 'Okyanus', 'linear-gradient(135deg,#0f2027,#2c5364)'],
  ['g-aurora', 'Aurora', 'linear-gradient(135deg,#0b1a3a,#1b4d5c,#3a1c71)'], ['g-lava', 'Lav', 'linear-gradient(135deg,#200122,#6f0000)'],
  ['g-forest', 'Orman', 'linear-gradient(135deg,#0f2b1d,#1e5631,#a4de02)'], ['g-candy', 'Şeker', 'linear-gradient(135deg,#41295a,#b24592,#f15f79)'],
  ['g-cyber', 'Siberpunk', 'linear-gradient(135deg,#0d0221,#261447,#ff3864)'],
];
function settingsShell(navHTML, onNav, onClose) {
  const el = h(`<div class="settings"><div class="s-nav"><div class="s-nav-inner">${navHTML}</div></div><div class="s-content"><div class="s-content-inner" id="sBody"></div></div><div class="s-close"><button id="sClose">${icon('x')}</button>ESC</div></div>`);
  document.body.append(el);
  const close = () => { el.remove(); document.removeEventListener('keydown', key); onClose?.(); };
  const key = (e) => { if (e.key === 'Escape' && !$('.modal-back') && !$('.ctx, .picker, .popout')) close(); };
  document.addEventListener('keydown', key);
  $('#sClose', el).onclick = close;
  $('.s-nav', el).onclick = (e) => { const it = e.target.closest('[data-tab]'); if (it) { $$('.item', el).forEach((x) => x.classList.toggle('active', x === it)); onNav(it.dataset.tab); } };
  return { el, close, body: $('#sBody', el) };
}

const UserSettings = {
  open(tab = 'account') {
    const nav = `<h4>Kullanıcı Ayarları</h4>
      <button class="item" data-tab="account">Hesabım</button><button class="item" data-tab="profile">Profiller</button>
      <div class="sep"></div><h4>Ücretsiz Nitro</h4><button class="item" data-tab="nitro" style="background:linear-gradient(90deg,rgba(124,92,255,.25),transparent)">✨ Nitro Özellikleri</button>
      <div class="sep"></div><h4>Uygulama Ayarları</h4>
      <button class="item" data-tab="appearance">Görünüm</button><button class="item" data-tab="voice">Ses ve Görüntü</button><button class="item" data-tab="notifications">Bildirimler</button><button class="item" data-tab="keybinds">Tuş Atamaları</button>
      <div class="sep"></div><button class="item danger" data-tab="logout">Çıkış Yap ${icon('logout', 'sm')}</button>
      <div class="tiny faint" style="padding:10px">Yankı v1.0 • Kendi sunucunda</div>`;
    this.s = settingsShell(nav, (t) => this.tab(t), () => { this.micTest?.stop(); this.micTest = null; this.camTest?.getTracks().forEach((t) => t.stop()); });
    $(`[data-tab="${tab}"]`, this.s.el).classList.add('active');
    this.tab(tab);
  },
  tab(t) {
    this.micTest?.stop(); this.micTest = null;
    const b = this.s.body;
    b.onclick = null; b.oninput = null; b.onchange = null;
    if (t === 'logout') return this.logout();
    this[t]?.(b);
  },
  async logout() {
    if (!(await confirmModal('Çıkış Yap', 'Çıkış yapmak istediğine emin misin?', 'Çıkış Yap'))) return;
    Voice.leave(true);
    await API.post('/api/auth/logout').catch(() => {});
    localStorage.removeItem('yanki_token');
    location.href = '/login';
  },
  account(b) {
    const u = App.me;
    b.innerHTML = `<h2>Hesabım</h2>
      <div class="acct-card"><div class="banner" style="${u.banner ? `background-image:url('${esc(u.banner)}')` : `background:${u.banner_color || u.accent_color}`}"></div>
      <div class="info"><div class="row" style="align-items:flex-end">${avatarHTML(u.id, 80, true)}<div class="grow" style="padding-bottom:8px"><div style="font-size:20px;font-weight:700;color:var(--text-strong)">${esc(u.display_name)}</div><div class="small muted">${esc(u.username)}</div></div><button class="btn sm" id="toProfile" style="margin-bottom:8px">Kullanıcı Profilini Düzenle</button></div>
      <div class="fields">
        <div class="f"><div><div class="label" style="margin:0">Görünen Ad</div><div>${esc(u.display_name)}</div></div><button class="btn secondary sm" data-ed="display_name">Düzenle</button></div>
        <div class="f"><div><div class="label" style="margin:0">Kullanıcı Adı</div><div>${esc(u.username)}</div></div><button class="btn secondary sm" data-ed="username">Düzenle</button></div>
        <div class="f"><div><div class="label" style="margin:0">E-posta</div><div><span id="em">${esc(u.email.replace(/^(.).*(@.*)$/, '$1•••••$2'))}</span> <a href="#" id="showEm" class="small">Göster</a></div></div></div>
      </div></div></div>
      <h3>Şifre ve Kimlik Doğrulama</h3><button class="btn" id="chPw">Şifreyi Değiştir</button>
      <div class="divider"></div>
      <h3>Hesabı Kaldırma</h3><p class="small muted">Hesabını sildiğinde mesajların "Silinmiş Kullanıcı" olarak kalır. Bu işlem geri alınamaz.</p><button class="btn danger" id="delAcc">Hesabı Sil</button>`;
    b.onclick = async (e) => {
      if (e.target.closest('#toProfile')) { $('[data-tab="profile"]', this.s.el).click(); }
      if (e.target.closest('#showEm')) { e.preventDefault(); $('#em', b).textContent = u.email; e.target.remove(); }
      const ed = e.target.closest('[data-ed]');
      if (ed) {
        const f = ed.dataset.ed;
        const v = await promptModal(f === 'username' ? 'Kullanıcı adını değiştir' : 'Görünen adını değiştir', f === 'username' ? 'Kullanıcı adı (küçük harf, rakam, _ ve .)' : 'Görünen ad', u[f]);
        if (v !== null) API.patch('/api/me', { [f]: v }).then((nu) => { Object.assign(App.me, nu); App.cacheUser(nu); this.account(b); toast('Kaydedildi', 'ok'); }).catch(errToast);
      }
      if (e.target.closest('#chPw')) {
        const md = modal({ title: 'Şifreni güncelle', sub: 'Mevcut şifreni ve yeni şifreni gir.', body: '<div class="field"><label class="label">Mevcut Şifre</label><input type="password" class="input" id="p0"></div><div class="field"><label class="label">Yeni Şifre</label><input type="password" class="input" id="p1"></div><div class="field"><label class="label">Yeni Şifreyi Onayla</label><input type="password" class="input" id="p2"></div>', foot: '<button class="btn ghost" data-close>İptal</button><button class="btn" id="pGo">Tamam</button>' });
        md.$('#pGo').onclick = () => { if (md.$('#p1').value !== md.$('#p2').value) return toast('Yeni şifreler eşleşmiyor', 'err'); API.patch('/api/me', { password: md.$('#p0').value, new_password: md.$('#p1').value }).then(() => { md.close(); toast('Şifre değiştirildi', 'ok'); }).catch(errToast); };
      }
      if (e.target.closest('#delAcc')) {
        const md = modal({ title: 'Hesabı Sil', body: '<p class="muted">Bu işlem geri alınamaz. Devam etmek için şifreni gir.</p><input type="password" class="input" id="dp">', foot: '<button class="btn ghost" data-close>İptal</button><button class="btn danger" id="dGo">Hesabı Sil</button>' });
        md.$('#dGo').onclick = () => API.del('/api/me', { password: md.$('#dp').value }).then(() => { localStorage.removeItem('yanki_token'); location.href = '/register'; }).catch(errToast);
      }
    };
  },
  profile(b) {
    const u = App.me;
    const d = { display_name: u.display_name, pronouns: u.pronouns || '', bio: u.bio || '', banner_color: u.banner_color || u.accent_color || '#5865f2', accent_color: u.accent_color, theme_primary: u.theme_primary || '', theme_secondary: u.theme_secondary || '', decoration: u.decoration || '', effect: u.effect || '', name_color: u.name_color || '', name_color2: u.name_color2 || '', name_font: u.name_font || '' };
    const orig = JSON.stringify(d);
    const colorRow = (k, label, def) => `<div><div class="tiny muted" style="margin-bottom:4px">${label}</div><input type="color" class="color-input" data-k="${k}" value="${d[k] || def}"></div>`;
    b.innerHTML = `<h2>Profiller</h2>
      <div class="free-nitro"><h3>✨ Nitro'nun tüm profil özellikleri sana bedava</h3><div class="small">Animasyonlu avatar & banner, profil teması, avatar süsleri, profil efektleri ve isim stilleri. Kredi kartı yok, abonelik yok.</div></div>
      <div class="profile-editor"><div>
        <div class="field"><label class="label">Görünen Ad</label><input class="input" data-k="display_name" maxlength="32" value="${esc(d.display_name)}"></div>
        <div class="field"><label class="label">Zamirler</label><input class="input" data-k="pronouns" maxlength="40" value="${esc(d.pronouns)}" placeholder="o/onu"></div>
        <div class="divider"></div>
        <div class="field"><label class="label">Avatar <span class="tag brand" style="font-size:9px">GIF DESTEKLİ</span></label><div class="row"><button class="btn sm" id="upAv">Avatarı Değiştir</button>${u.avatar ? '<button class="btn ghost sm" id="rmAv">Avatarı Kaldır</button>' : ''}</div></div>
        <div class="field"><label class="label">Profil Afişi (Banner) <span class="tag brand" style="font-size:9px">GIF DESTEKLİ</span></label><div class="row"><button class="btn sm" id="upBn">Afişi Değiştir</button>${u.banner ? '<button class="btn ghost sm" id="rmBn">Afişi Kaldır</button>' : ''}</div></div>
        <div class="field"><label class="label">Afiş Rengi</label>${colorRow('banner_color', 'Afiş görseli yoksa kullanılır', '#5865f2')}</div>
        <div class="divider"></div>
        <div class="field"><label class="label">Profil Teması</label><div class="row" style="gap:16px">${colorRow('theme_primary', 'Ana renk', '#2b1d6e')}${colorRow('theme_secondary', 'Vurgu rengi', '#8a1d6e')}<button class="btn ghost sm" id="rmTheme" style="margin-top:16px">Temayı sıfırla</button></div></div>
        <div class="field"><label class="label">Avatar Süsü</label><div class="picker-grid" id="decoGrid">${DECORATIONS.map(([k, n]) => `<div class="pick ${d.decoration === k ? 'sel' : ''}" data-deco="${k}"><span class="avatar" ${k ? `data-deco="${k}"` : ''} style="width:44px;height:44px"><div class="av-fallback" style="background:${u.accent_color || '#5865f2'};width:100%;height:100%;border-radius:50%">${u.avatar ? `<img src="${esc(u.avatar)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : esc([...u.display_name][0] || '?')}</div></span>${n}</div>`).join('')}</div></div>
        <div class="field"><label class="label">Profil Efekti</label><div class="picker-grid" id="fxGrid">${EFFECTS.map(([k, n]) => `<div class="pick ${d.effect === k ? 'sel' : ''}" data-fx="${k}"><span style="font-size:24px">${{ '': '🚫', confetti: '🎉', stars: '⭐', snow: '❄️', hearts: '💖', fireflies: '✨', aurora: '🌌', sparkle: '💫', sakura: '🌸' }[k]}</span>${n}</div>`).join('')}</div></div>
        <div class="field"><label class="label">İsim Stili</label><div class="row wrap" style="gap:16px;align-items:flex-end"><div><div class="tiny muted" style="margin-bottom:4px">Yazı tipi</div><select class="select" data-k="name_font" style="width:170px">${Object.entries(NAME_FONTS).map(([k, n]) => `<option value="${k}" ${d.name_font === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>${colorRow('name_color', 'Renk 1', '#ffffff')}${colorRow('name_color2', 'Renk 2 (gradyan)', '#ff5fb8')}<label class="row small"><input type="checkbox" id="useNameColor" ${d.name_color ? 'checked' : ''}> Renkli isim</label><label class="row small"><input type="checkbox" id="useGrad" ${d.name_color2 ? 'checked' : ''}> Gradyan & animasyon</label></div></div>
        <div class="field"><label class="label">Hakkımda</label><textarea class="textarea" data-k="bio" maxlength="400" placeholder="Markdown kullanabilirsin: **kalın**, *italik*, ||spoiler||">${esc(d.bio)}</textarea><div class="tiny muted" style="text-align:right" id="bioCnt">${400 - d.bio.length}</div></div>
      </div>
      <div style="position:sticky;top:20px"><div class="label">Önizleme</div><div id="pPrev" style="border-radius:12px;overflow:hidden;box-shadow:var(--shadow);position:relative"></div>
        <div class="label" style="margin-top:16px">Sohbette böyle görünür</div><div id="pPrevMsg" style="background:var(--bg-2);border-radius:8px;padding:6px 0"></div></div></div>
      <div id="saveBar" class="hidden" style="position:sticky;bottom:20px;margin-top:20px;background:var(--bg-float);padding:10px 16px;border-radius:8px;box-shadow:var(--shadow);display:flex;align-items:center;gap:10px"><span class="grow" style="font-weight:600">Dikkat — kaydedilmemiş değişikliklerin var!</span><button class="btn ghost sm" id="reset">Sıfırla</button><button class="btn success sm" id="save">Değişiklikleri Kaydet</button></div>
      <input type="file" accept="image/*" class="hidden" id="fAv"><input type="file" accept="image/*" class="hidden" id="fBn">`;
    const prev = () => {
      const pu = { ...App.me, ...d, theme_primary: d.theme_primary || null, theme_secondary: d.theme_secondary || null };
      App.users.set('__preview', { ...pu, id: '__preview' });
      $('#pPrev', b).innerHTML = profileCardHTML({ ...pu, id: '__preview' }, { preview: true });
      $('#pPrevMsg', b).innerHTML = Chat.msgHTML({ id: 'x', type: 'default', author: { id: '__preview' }, content: 'Yeni profilim nasıl olmuş? 😎', attachments: [], reactions: [], created_at: Date.now() }, null, null).replace(/<div class="m-actions">[\s\S]*?<\/div><\/div>$/, '</div>');
      $('#saveBar', b).classList.toggle('hidden', JSON.stringify(d) === orig);
    };
    prev();
    b.oninput = (e) => {
      const k = e.target.dataset.k;
      if (!k) return;
      d[k] = e.target.value;
      if (k === 'name_color') $('#useNameColor', b).checked = true;
      if (k === 'name_color2') { $('#useGrad', b).checked = true; if (!d.name_color) { d.name_color = $('[data-k=name_color]', b).value; $('#useNameColor', b).checked = true; } }
      if (k === 'theme_primary' && !d.theme_secondary) d.theme_secondary = $('[data-k=theme_secondary]', b).value;
      if (k === 'theme_secondary' && !d.theme_primary) d.theme_primary = $('[data-k=theme_primary]', b).value;
      if (k === 'bio') $('#bioCnt', b).textContent = 400 - d.bio.length;
      prev();
    };
    b.onchange = (e) => {
      if (e.target.id === 'useNameColor') { d.name_color = e.target.checked ? $('[data-k=name_color]', b).value : ''; if (!e.target.checked) { d.name_color2 = ''; $('#useGrad', b).checked = false; } prev(); }
      if (e.target.id === 'useGrad') { d.name_color2 = e.target.checked ? $('[data-k=name_color2]', b).value : ''; if (e.target.checked && !d.name_color) { d.name_color = $('[data-k=name_color]', b).value; $('#useNameColor', b).checked = true; } prev(); }
      if (e.target.dataset.k === 'name_font') { d.name_font = e.target.value; prev(); }
      if (e.target.id === 'fAv' || e.target.id === 'fBn') {
        const f = e.target.files[0];
        if (!f) return;
        const fd = new FormData(); fd.append('file', f);
        API.form('POST', '/api/me/' + (e.target.id === 'fAv' ? 'avatar' : 'banner'), fd).then((nu) => { Object.assign(App.me, nu); App.cacheUser(nu); App.renderUserPanel(); toast('Yüklendi ✨', 'ok'); this.profile(b); }).catch(errToast);
      }
    };
    b.onclick = (e) => {
      const deco = e.target.closest('[data-deco]:not(.avatar)');
      if (deco) { d.decoration = deco.dataset.deco; $$('#decoGrid .pick', b).forEach((x) => x.classList.toggle('sel', x === deco)); prev(); }
      const fx = e.target.closest('[data-fx]');
      if (fx) { d.effect = fx.dataset.fx; $$('#fxGrid .pick', b).forEach((x) => x.classList.toggle('sel', x === fx)); prev(); }
      if (e.target.closest('#upAv')) $('#fAv', b).click();
      if (e.target.closest('#upBn')) $('#fBn', b).click();
      if (e.target.closest('#rmAv')) API.patch('/api/me', { avatar: null }).then((nu) => { Object.assign(App.me, nu); App.cacheUser(nu); this.profile(b); });
      if (e.target.closest('#rmBn')) API.patch('/api/me', { banner: null }).then((nu) => { Object.assign(App.me, nu); App.cacheUser(nu); this.profile(b); });
      if (e.target.closest('#rmTheme')) { d.theme_primary = ''; d.theme_secondary = ''; prev(); }
      if (e.target.closest('#reset')) this.profile(b);
      if (e.target.closest('#save')) {
        const payload = { ...d };
        for (const k of ['theme_primary', 'theme_secondary', 'name_color', 'name_color2']) if (!payload[k]) payload[k] = null;
        API.patch('/api/me', payload).then((nu) => { Object.assign(App.me, nu); App.cacheUser(nu); App.renderUserPanel(); toast('Profil kaydedildi ✨', 'ok'); this.profile(b); }).catch(errToast);
      }
    };
  },
  nitro(b) {
    const perks = [['🎞️', 'Animasyonlu avatar ve afiş', 'GIF yükle, profilin canlansın.'], ['🎨', 'Profil temaları', 'İki renkli gradyan profil kartı.'], ['👑', 'Avatar süsleri', 'Neon, alev, taç, hale ve daha fazlası.'], ['🎉', 'Profil efektleri', 'Konfeti, kar, kutup ışıkları…'], ['🌈', 'İsim stilleri', 'Özel yazı tipi ve animasyonlu gradyan isim.'], ['📺', 'HD/4K yayın', '1080p60, 1440p60 ve kaynak kalite.'], ['📁', `${App.config.maxUpload}MB yükleme`, 'Büyük dosyaları rahatça paylaş.'], ['😎', 'Her yerde özel emoji', 'Sunucular arası ve DM\'de.'], ['✍️', '4000 karakter', 'Uzun mesajlar, sorun değil.'], ['🖌️', 'Uygulama temaları', '7 gradyan tema + özel vurgu rengi.'], ['🔊', 'Ses efektleri paneli', 'Ses kanallarında ücretsiz.'], ['🏷️', 'Sunucu başına takma ad', 'Her sunucuda farklı isim.']];
    b.innerHTML = `<div class="free-nitro" style="padding:28px"><h2 style="color:#fff;margin:0 0 6px;font-size:26px">Nitro mu? Burada herkes Nitro. ✨</h2><div>Yankı'da para ile satılan özellik yok. Aşağıdakilerin hepsi şu an hesabında açık.</div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">${perks.map(([e, t, d]) => `<div class="an-card" style="margin:0"><div style="font-size:26px">${e}</div><b style="color:var(--text-strong)">${t}</b><div class="small muted">${d}</div><div class="tiny" style="color:var(--green);margin-top:6px;font-weight:700">✓ AKTİF</div></div>`).join('')}</div>
      <div class="row" style="margin-top:20px"><button class="btn" id="goP">Profilimi süsle</button><button class="btn secondary" id="goA">Tema seç</button></div>`;
    b.onclick = (e) => { if (e.target.closest('#goP')) $('[data-tab="profile"]', this.s.el).click(); if (e.target.closest('#goA')) $('[data-tab="appearance"]', this.s.el).click(); };
  },
  appearance(b) {
    const s = JSON.parse(localStorage.getItem('yanki_appearance') || '{}');
    const save = () => { localStorage.setItem('yanki_appearance', JSON.stringify(s)); applyAppearance(); };
    b.innerHTML = `<h2>Görünüm</h2>
      <div style="background:var(--bg-2);border-radius:8px;padding:8px 0;margin-bottom:20px;border:1px solid var(--border)">${Chat.msgHTML({ id: 'p1', type: 'default', author: { id: App.me.id }, content: 'Merhaba! Yeni temam nasıl? 🎨', attachments: [], reactions: [{ emoji: '🔥', users: [App.me.id] }], created_at: Date.now() - 60000 }, null).replace(/<div class="m-actions">[\s\S]*?<\/div><\/div>$/, '</div>')}</div>
      <h3>Tema</h3><div class="theme-swatches">${THEMES.slice(0, 3).map(([k, n, c]) => `<div class="col" style="align-items:center;gap:6px"><div class="swatch ${(s.theme || 'dark') === k ? 'sel' : ''}" data-theme="${k}" style="background:${c}" data-tip="${n}"></div><span class="tiny">${n}</span></div>`).join('')}</div>
      <h3>Renk Temaları <span class="tag brand">NITRO — BEDAVA</span></h3><div class="theme-swatches">${THEMES.slice(3).map(([k, n, c]) => `<div class="col" style="align-items:center;gap:6px"><div class="swatch ${s.theme === k ? 'sel' : ''}" data-theme="${k}" style="background:${c}" data-tip="${n}"></div><span class="tiny">${n}</span></div>`).join('')}</div>
      <h3>Vurgu Rengi</h3><div class="row"><input type="color" class="color-input" id="acc" value="${s.accent || '#7c5cff'}"><button class="btn ghost sm" id="accReset">Varsayılan</button></div>
      <div class="setting-row"><div><div class="t">Kompakt mod</div><div class="d">Mesajlar arasındaki boşlukları azaltır.</div></div><label class="switch"><input type="checkbox" id="compact" ${s.compact ? 'checked' : ''}><span></span></label></div>
      <div class="setting-row"><div><div class="t">Yazı boyutu</div></div><select class="select" id="fs" style="width:160px"><option value="small">Küçük</option><option value="normal">Normal</option><option value="large">Büyük</option></select></div>`;
    $('#fs', b).value = s.fontSize || 'normal';
    b.onclick = (e) => {
      const sw = e.target.closest('[data-theme]');
      if (sw) { s.theme = sw.dataset.theme; save(); $$('.swatch', b).forEach((x) => x.classList.toggle('sel', x === sw)); }
      if (e.target.closest('#accReset')) { delete s.accent; save(); }
    };
    b.oninput = (e) => { if (e.target.id === 'acc') { s.accent = e.target.value; save(); } };
    b.onchange = (e) => { if (e.target.id === 'compact') { s.compact = e.target.checked; save(); } if (e.target.id === 'fs') { s.fontSize = e.target.value; save(); } };
  },
  async voice(b) {
    const s = Voice.settings;
    let devices = [];
    try { devices = await navigator.mediaDevices.enumerateDevices(); } catch { /* yoksay */ }
    const ins = devices.filter((d) => d.kind === 'audioinput'), outs = devices.filter((d) => d.kind === 'audiooutput');
    const opt = (list, cur) => `<option value="">Varsayılan</option>` + list.filter((d) => d.deviceId && d.deviceId !== 'default').map((d, i) => `<option value="${esc(d.deviceId)}" ${d.deviceId === cur ? 'selected' : ''}>${esc(d.label || 'Cihaz ' + (i + 1))}</option>`).join('');
    b.innerHTML = `<h2>Ses ve Görüntü</h2>
      <div class="row" style="gap:16px;align-items:flex-start"><div class="grow"><label class="label">Giriş Cihazı</label><select class="select" id="inDev">${opt(ins, s.inputId)}</select></div><div class="grow"><label class="label">Çıkış Cihazı</label><select class="select" id="outDev">${opt(outs, s.outputId)}</select></div></div>
      <h3>Mikrofon Testi</h3><p class="small muted">Mikrofonunda sorun mu var? Teste başla ve bir şeyler söyle — sesini sana geri çalacağız.</p>
      <div class="row"><button class="btn" id="mt">Hadi Kontrol Edelim</button><div class="grow mic-meter" style="height:10px"><div id="mtBar"></div></div></div>
      <h3>Giriş Modu</h3>
      <label class="radio-card"><input type="radio" name="im" value="va" ${!s.ptt ? 'checked' : ''}><div><b>Ses Etkinliği</b><div class="small muted">Konuştuğunda mikrofonun otomatik açılır</div></div></label>
      <label class="radio-card"><input type="radio" name="im" value="ptt" ${s.ptt ? 'checked' : ''}><div><b>Bas-Konuş</b><div class="small muted">Sadece tuşa basılıyken konuşursun</div></div></label>
      <div class="row ${s.ptt ? '' : 'hidden'}" id="pttRow"><span>Kısayol:</span><button class="btn secondary sm" id="pttKey">${esc(s.pttLabel)}</button><span class="small muted">değiştirmek için tıkla ve bir tuşa bas</span></div>
      <h3>Giriş Hassasiyeti</h3><p class="small muted">Konuşma algılama eşiği — arka plan gürültüsü konuşuyormuş gibi gösteriyorsa yükselt.</p><input type="range" min="0.003" max="0.15" step="0.001" value="${s.threshold}" class="vol-slider" id="thr">
      <h3>Ses İşleme</h3>
      <div class="setting-row"><div><div class="t">Gürültü Engelleme</div><div class="d">Klavye, fan gibi arka plan seslerini bastırır.</div></div><label class="switch"><input type="checkbox" data-s="noiseSuppression" ${s.noiseSuppression ? 'checked' : ''}><span></span></label></div>
      <div class="setting-row"><div><div class="t">Yankı Engelleme</div><div class="d">Hoparlörden gelen sesin mikrofona geri dönmesini önler.</div></div><label class="switch"><input type="checkbox" data-s="echoCancellation" ${s.echoCancellation ? 'checked' : ''}><span></span></label></div>
      <div class="setting-row"><div><div class="t">Otomatik Kazanç Kontrolü</div><div class="d">Ses seviyeni otomatik dengeler.</div></div><label class="switch"><input type="checkbox" data-s="autoGain" ${s.autoGain ? 'checked' : ''}><span></span></label></div>
      <h3>Yayın Kalitesi (Ekran Paylaşımı)</h3><select class="select" id="sq">${Object.entries(SCREEN_PRESETS).map(([k, p]) => `<option value="${k}" ${s.screenQuality === k ? 'selected' : ''}>${p.label}</option>`).join('')}</select>
      <h3>Kamera</h3><div style="background:var(--bg-0);border-radius:8px;aspect-ratio:16/9;max-width:420px;display:grid;place-items:center;overflow:hidden" id="camBox"><button class="btn" id="camTest">Kamerayı Test Et</button></div>`;
    const save = () => VoiceSettings.save(s);
    b.onchange = (e) => {
      const t = e.target;
      if (t.id === 'inDev') { s.inputId = t.value; save(); Voice.switchInput(); }
      if (t.id === 'outDev') { s.outputId = t.value; save(); Voice.setOutput(t.value); }
      if (t.name === 'im') { s.ptt = t.value === 'ptt'; save(); $('#pttRow', b).classList.toggle('hidden', !s.ptt); Voice.applyMicEnabled(); App.renderVoicePanel(); }
      if (t.dataset.s) { s[t.dataset.s] = t.checked; save(); Voice.switchInput(); }
      if (t.id === 'sq') { s.screenQuality = t.value; save(); }
    };
    b.oninput = (e) => { if (e.target.id === 'thr') { s.threshold = +e.target.value; save(); } };
    b.onclick = async (e) => {
      if (e.target.closest('#mt')) {
        if (this.micTest) { this.micTest.stop(); this.micTest = null; $('#mt', b).textContent = 'Hadi Kontrol Edelim'; $('#mtBar', b).style.width = 0; return; }
        try {
          this.micTest = await Voice.micTest((lvl) => { const bar = $('#mtBar', b); if (bar) { bar.style.width = Math.min(100, lvl * 400) + '%'; bar.style.background = lvl > s.threshold ? 'var(--green)' : 'var(--text-faint)'; } });
          this.micTest.loopback(true);
          $('#mt', b).textContent = 'Testi Durdur';
        } catch (er) { toast('Mikrofona erişilemedi: ' + er.message, 'err'); }
      }
      if (e.target.closest('#pttKey')) {
        const btn = $('#pttKey', b); btn.textContent = 'Bir tuşa bas…';
        const k = (ev) => { ev.preventDefault(); s.pttKey = ev.code; s.pttLabel = ev.key.length === 1 ? ev.key.toUpperCase() : ev.code; save(); btn.textContent = s.pttLabel; window.removeEventListener('keydown', k, true); App.renderVoicePanel(); };
        window.addEventListener('keydown', k, true);
      }
      if (e.target.closest('#camTest')) {
        try { this.camTest = await navigator.mediaDevices.getUserMedia({ video: true }); const v = h('<video autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1)"></video>'); v.srcObject = this.camTest; $('#camBox', b).innerHTML = ''; $('#camBox', b).append(v); }
        catch (er) { toast('Kameraya erişilemedi: ' + er.message, 'err'); }
      }
    };
  },
  notifications(b) {
    const get = (k, d = '1') => (localStorage.getItem(k) ?? d) === '1';
    b.innerHTML = `<h2>Bildirimler</h2>
      <div class="setting-row"><div><div class="t">Masaüstü Bildirimleri</div><div class="d">Sekme arka plandayken bahsedilme ve DM bildirimleri. ${'Notification' in window ? 'İzin durumu: <b>' + ({ granted: 'izin verildi', denied: 'engellendi', default: 'sorulmadı' }[Notification.permission]) + '</b>' : ''}</div></div><label class="switch"><input type="checkbox" id="nDesk" ${get('yanki_notif') ? 'checked' : ''}><span></span></label></div>
      <div class="setting-row"><div><div class="t">Sesler</div><div class="d">Mesaj, katılma/ayrılma, susturma sesleri.</div></div><label class="switch"><input type="checkbox" id="nSound" ${get('yanki_sounds') ? 'checked' : ''}><span></span></label></div>
      <div class="setting-row"><div><div class="t">Rahatsız Etmeyin = Sessiz Mod</div><div class="d">Durumun "Rahatsız Etmeyin" iken tüm sesler, bildirimler ve gelen aramalar susturulur.</div></div><span class="tag" style="color:var(--green)">Her zaman açık</span></div>
      <button class="btn secondary" id="nTest" style="margin-top:16px">Test bildirimi gönder</button>`;
    b.onchange = (e) => {
      if (e.target.id === 'nDesk') { localStorage.setItem('yanki_notif', e.target.checked ? '1' : '0'); if (e.target.checked && Notification.permission !== 'granted') Notification.requestPermission(); }
      if (e.target.id === 'nSound') localStorage.setItem('yanki_sounds', e.target.checked ? '1' : '0');
    };
    b.onclick = (e) => { if (e.target.closest('#nTest')) { Sound.message(); if (Notification.permission === 'granted') new Notification('Yankı', { body: 'Bildirimler çalışıyor! 🎉' }); else Notification.requestPermission(); } };
  },
  keybinds(b) {
    const k = [['Ctrl + K', 'Hızlı geçiş (sunucu/kanal/kişi bul)'], ['Ctrl + Shift + M', 'Mikrofonu sustur/aç'], ['Ctrl + Shift + D', 'Sağırlaştır'], ['Alt + ↑ / ↓', 'Önceki/sonraki kanal'], ['↑ (boş kutuda)', 'Son mesajını düzenle'], ['Shift + Enter', 'Yeni satır'], ['Esc', 'Yanıtı/düzenlemeyi iptal et'], ['Shift + Sil', 'Mesajı onaysız sil'], [Voice.settings.pttLabel, 'Bas-Konuş (açıksa)']];
    b.innerHTML = `<h2>Tuş Atamaları</h2>${k.map(([a, d]) => `<div class="setting-row"><div class="t">${d}</div><span class="kbd">${esc(a)}</span></div>`).join('')}
      <h3>Metin biçimlendirme</h3><div class="small" style="line-height:2">**kalın** • *italik* • __altı çizili__ • ~~üstü çizili~~ • ||spoiler|| • \`kod\` • \`\`\`js kod bloğu\`\`\` • &gt; alıntı • # başlık • -# küçük yazı • [metin](bağlantı) • :emoji_adı:</div>`;
  },
};

// ═══ Sunucu ayarları ═══
const GuildSettings = {
  open(gid, tab = 'overview') {
    this.gid = gid;
    const g = App.guilds.get(gid);
    const can = (p) => App.can(p, gid);
    const nav = `<h4 class="ellipsis">${esc(g.name)}</h4>
      ${can('MANAGE_GUILD') ? '<button class="item" data-tab="overview">Genel Görünüm</button>' : ''}
      ${can('MANAGE_ROLES') ? '<button class="item" data-tab="roles">Roller</button>' : ''}
      ${can('MANAGE_EMOJIS') ? '<button class="item" data-tab="emojis">Emoji</button>' : ''}
      <div class="sep"></div><h4>Kullanıcı Yönetimi</h4>
      <button class="item" data-tab="members">Üyeler</button>
      ${can('MANAGE_GUILD') ? '<button class="item" data-tab="invites">Davetler</button>' : ''}
      ${can('BAN') ? '<button class="item" data-tab="bans">Yasaklar</button>' : ''}
      ${can('MANAGE_GUILD') ? '<div class="sep"></div><button class="item" data-tab="audit">Denetim Kaydı</button>' : ''}
      ${g.owner_id === App.me.id ? '<div class="sep"></div><button class="item danger" data-tab="delete">Sunucuyu Sil</button>' : ''}`;
    this.s = settingsShell(nav, (t) => this.tab(t));
    const first = $(`[data-tab="${tab}"]`, this.s.el) || $('[data-tab]', this.s.el);
    first.classList.add('active');
    this.tab(first.dataset.tab);
  },
  get g() { return App.guilds.get(this.gid); },
  tab(t) { const b = this.s.body; b.onclick = b.oninput = b.onchange = null; this[t]?.(b); },
  overview(b) {
    const g = this.g;
    b.innerHTML = `<h2>Sunucuya Genel Bakış</h2>
      <div class="row" style="gap:24px;align-items:flex-start"><div class="col" style="align-items:center"><label class="upload-circle" style="width:100px;height:100px;${g.icon ? `background-image:url('${esc(g.icon)}');border:0` : ''}">${g.icon ? '' : esc(guildAcronym(g.name))}<input type="file" accept="image/*" class="hidden" id="gIc"></label>${g.icon ? '<button class="btn ghost sm" id="rmIc">Kaldır</button>' : '<div class="tiny muted">Min. 128x128</div>'}</div>
      <div class="grow"><div class="field"><label class="label">Sunucu Adı</label><input class="input" id="gn" value="${esc(g.name)}" maxlength="100"></div><div class="field"><label class="label">Açıklama</label><textarea class="textarea" id="gd" maxlength="300" placeholder="Sunucun ne hakkında?">${esc(g.description || '')}</textarea></div></div></div>
      <div class="field"><label class="label">Sunucu Afişi <span class="tag brand" style="font-size:9px">BEDAVA</span></label><div class="row"><label class="btn secondary sm">Afiş Yükle<input type="file" accept="image/*" class="hidden" id="gBn"></label>${g.banner ? `<img src="${esc(g.banner)}" style="height:60px;border-radius:6px">` : ''}</div></div>
      <div class="field"><label class="label">Sistem Mesajları Kanalı</label><select class="select" id="gsys"><option value="">Sistem mesajı yok</option>${g.channels.filter((c) => c.type === 'text').map((c) => `<option value="${c.id}" ${g.system_channel_id === c.id ? 'selected' : ''}>#${esc(c.name)}</option>`).join('')}</select><div class="tiny muted" style="margin-top:4px">Yeni katılanlar için karşılama mesajları buraya gönderilir.</div></div>
      ${g.owner_id === App.me.id ? `<div class="field"><label class="label">Sahipliği Devret</label><div class="row"><select class="select" id="gown">${[...g.memberMap.keys()].filter((u) => u !== App.me.id).map((u) => `<option value="${u}">${esc(App.displayName(u, g.id))}</option>`).join('')}</select><button class="btn danger sm" id="gTransfer">Devret</button></div></div>` : ''}
      <button class="btn success" id="gSave">Değişiklikleri Kaydet</button>`;
    const up = (field, file) => { const fd = new FormData(); fd.append(field, file); API.form('PATCH', '/api/guilds/' + g.id, fd).then((ng) => { App.putGuild(ng); this.overview(b); toast('Yüklendi', 'ok'); }).catch(errToast); };
    b.onchange = (e) => { if (e.target.id === 'gIc') up('icon', e.target.files[0]); if (e.target.id === 'gBn') up('banner', e.target.files[0]); };
    b.onclick = async (e) => {
      if (e.target.closest('#rmIc')) API.patch('/api/guilds/' + g.id, { remove_icon: true }).then((ng) => { App.putGuild(ng); this.overview(b); });
      if (e.target.closest('#gSave')) API.patch('/api/guilds/' + g.id, { name: $('#gn', b).value, description: $('#gd', b).value, system_channel_id: $('#gsys', b).value }).then(() => toast('Kaydedildi', 'ok')).catch(errToast);
      if (e.target.closest('#gTransfer')) { const uid = $('#gown', b).value; if (await confirmModal('Sahipliği Devret', `Sunucu sahipliğini <b>${esc(App.displayName(uid, g.id))}</b> kişisine devretmek istiyor musun? Bu işlem geri alınamaz.`, 'Devret')) API.patch('/api/guilds/' + g.id, { owner_id: uid }).then(() => { toast('Sahiplik devredildi', 'ok'); this.s.close(); }).catch(errToast); }
    };
  },
  roles(b, selId) {
    const g = this.g;
    const roles = g.roles.filter((r) => r.id !== g.id).sort((a, b2) => b2.position - a.position);
    const sel = g.roleMap.get(selId) || null;
    const PERMS = [
      ['ADMIN', 'Yönetici', 'Tüm yetkiler. Dikkatli ver!'], ['MANAGE_GUILD', 'Sunucuyu Yönet', 'Ad, simge, davetleri yönetme'], ['MANAGE_ROLES', 'Rolleri Yönet', 'Kendi rolünün altındaki rolleri düzenleme ve verme'], ['MANAGE_CHANNELS', 'Kanalları Yönet', 'Kanal oluşturma, düzenleme, silme'],
      ['KICK', 'Üyeleri At', ''], ['BAN', 'Üyeleri Yasakla', ''], ['INVITE', 'Davet Oluştur', ''], ['MANAGE_EMOJIS', 'Emojileri Yönet', ''], ['VIEW', 'Kanalları Görüntüle', ''], ['SEND', 'Mesaj Gönder', ''],
      ['MANAGE_MESSAGES', 'Mesajları Yönet', 'Başkalarının mesajlarını silme, sabitleme'], ['ATTACH', 'Dosya Ekle', ''], ['MENTION_EVERYONE', '@everyone Bahset', ''],
      ['CONNECT', 'Ses Kanalına Bağlan', ''], ['SPEAK', 'Konuş', ''], ['STREAM', 'Görüntü / Yayın', 'Kamera ve ekran paylaşımı'], ['MUTE_MEMBERS', 'Üyeleri Sustur', ''], ['MOVE_MEMBERS', 'Üyelerin Bağlantısını Kes', ''],
    ];
    const editing = sel || g.roleMap.get(g.id);
    b.innerHTML = `<h2>Roller</h2><p class="small muted">Sunucu üyelerini gruplamak ve yetki vermek için roller kullan. Üstteki roller alttakileri yönetebilir.</p>
      <div class="row" style="align-items:flex-start;gap:20px"><div class="role-list"><button class="btn sm block" id="rNew" style="margin-bottom:10px">+ Rol Oluştur</button>
        ${roles.map((r) => `<div class="role-item ${sel?.id === r.id ? 'active' : ''}" data-r="${r.id}"><span class="role-dot" style="background:${r.color || '#99aab5'}"></span><span class="grow ellipsis">${esc(r.name)}</span><span class="tiny muted">${[...g.memberMap.values()].filter((m) => m.roles.includes(r.id)).length}</span></div>`).join('')}
        <div class="role-item ${!sel ? 'active' : ''}" data-r="${g.id}"><span class="role-dot" style="background:#99aab5"></span>@everyone</div></div>
      <div class="grow">
        <div class="field"><label class="label">Rol Adı</label><input class="input" id="rName" value="${esc(editing.name)}" ${editing.id === g.id ? 'disabled' : ''}></div>
        ${editing.id !== g.id ? `<div class="field"><label class="label">Rol Rengi</label><div class="row wrap">${['#99aab5', '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#e91e63', '#f1c40f', '#e67e22', '#e74c3c', '#7c5cff'].map((c) => `<span class="swatch" data-col="${c}" style="background:${c};width:36px;height:36px;border-radius:6px;${editing.color === c ? 'border-color:#fff' : ''}"></span>`).join('')}<input type="color" class="color-input" id="rColor" value="${editing.color || '#99aab5'}"></div></div>
        <div class="setting-row"><div><div class="t">Rol üyelerini ayrı göster</div><div class="d">Üye listesinde bu rol için ayrı bir bölüm olur</div></div><label class="switch"><input type="checkbox" id="rHoist" ${editing.hoist ? 'checked' : ''}><span></span></label></div>
        <div class="row" style="margin:12px 0"><button class="btn secondary sm" id="rUp">↑ Yukarı taşı</button><button class="btn secondary sm" id="rDown">↓ Aşağı taşı</button><span class="grow"></span><button class="btn danger sm" id="rDel">Rolü Sil</button></div>
        <div class="field"><label class="label">Bu role sahip üyeler</label><div id="rMembers">${[...g.memberMap.values()].filter((m) => m.roles.includes(editing.id)).map((m) => `<span class="role-chip">${avatarHTML(m.uid, 16)} ${esc(App.displayName(m.uid, g.id))} <span class="x" data-unrole="${m.uid}">✕</span></span>`).join('') || '<span class="small muted">Henüz kimse yok.</span>'} <button class="role-chip" id="rAddMem" style="cursor:pointer">+ Üye ekle</button></div></div>` : '<p class="small muted">@everyone rolü sunucudaki herkesin varsayılan yetkilerini belirler.</p>'}
        <h3>Yetkiler</h3>${PERMS.map(([k, n, d]) => `<div class="perm-row"><div><div class="t" style="font-weight:600;color:var(--text-strong)">${n}</div>${d ? `<div class="tiny muted">${d}</div>` : ''}</div><label class="switch"><input type="checkbox" data-perm="${k}" ${(editing.permissions & App.P[k]) ? 'checked' : ''}><span></span></label></div>`).join('')}
      </div></div>`;
    const patch = (body) => API.patch('/api/roles/' + editing.id, body).then(() => setTimeout(() => this.roles(b, editing.id === g.id ? null : editing.id), 150)).catch(errToast);
    b.onclick = async (e) => {
      const ri = e.target.closest('[data-r]'); if (ri) return this.roles(b, ri.dataset.r === g.id ? null : ri.dataset.r);
      if (e.target.closest('#rNew')) { const r = await API.post(`/api/guilds/${g.id}/roles`, { name: 'yeni rol' }).catch(errToast); if (r) setTimeout(() => this.roles(b, r.id), 200); }
      const col = e.target.closest('[data-col]'); if (col) patch({ color: col.dataset.col });
      if (e.target.closest('#rUp')) patch({ position: editing.position + 1 });
      if (e.target.closest('#rDown')) patch({ position: Math.max(1, editing.position - 1) });
      if (e.target.closest('#rDel') && await confirmModal('Rolü Sil', `<b>${esc(editing.name)}</b> rolü silinsin mi?`, 'Sil')) API.del('/api/roles/' + editing.id).then(() => setTimeout(() => this.roles(b), 150)).catch(errToast);
      const ur = e.target.closest('[data-unrole]'); if (ur) { const m = g.memberMap.get(ur.dataset.unrole); API.patch(`/api/guilds/${g.id}/members/${m.uid}`, { roles: m.roles.filter((x) => x !== editing.id) }).then(() => setTimeout(() => this.roles(b, editing.id), 150)).catch(errToast); }
      if (e.target.closest('#rAddMem')) ctxMenu(e, [...g.memberMap.values()].filter((m) => !m.roles.includes(editing.id)).slice(0, 50).map((m) => ({ label: App.displayName(m.uid, g.id), action: () => API.patch(`/api/guilds/${g.id}/members/${m.uid}`, { roles: [...m.roles, editing.id] }).then(() => setTimeout(() => this.roles(b, editing.id), 150)).catch(errToast) })), e.target.closest('#rAddMem'));
    };
    b.onchange = (e) => {
      const pk = e.target.dataset.perm;
      if (pk) { const p = e.target.checked ? editing.permissions | App.P[pk] : editing.permissions & ~App.P[pk]; patch({ permissions: p }); }
      if (e.target.id === 'rName') patch({ name: e.target.value });
      if (e.target.id === 'rColor') patch({ color: e.target.value });
      if (e.target.id === 'rHoist') patch({ hoist: e.target.checked });
    };
  },
  emojis(b) {
    const g = this.g;
    b.innerHTML = `<h2>Emoji</h2><p class="small muted">Sunucuna 250'ye kadar özel emoji ekle. <b>Bütün üyeler bu emojileri her sunucuda ve DM'de kullanabilir</b> (Nitro'ya gerek yok). Animasyonlu GIF desteklenir. En fazla 512KB.</p>
      <div class="row"><input class="input" id="eName" placeholder="emoji_adi" style="width:200px"><label class="btn">Emoji Yükle<input type="file" accept="image/png,image/gif,image/webp,image/jpeg" class="hidden" id="eFile"></label></div>
      <table class="table" style="margin-top:16px"><tr><th>Görsel</th><th>Ad</th><th>Tür</th><th></th></tr>${g.emojis.map((e) => `<tr><td><img src="${customEmojiUrl(e.id)}" style="width:32px;height:32px;object-fit:contain"></td><td>:${esc(e.name)}:</td><td class="small muted">${e.animated ? 'Animasyonlu' : 'Sabit'}</td><td><button class="icon-btn" data-del="${e.id}" style="color:var(--red)">${icon('trash')}</button></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Henüz emoji yok</td></tr>'}</table>`;
    b.onchange = (e) => {
      if (e.target.id !== 'eFile') return;
      const f = e.target.files[0];
      if (!f) return;
      const fd = new FormData();
      fd.append('name', $('#eName', b).value || f.name.replace(/\.\w+$/, '').replace(/[^\w]/g, '_'));
      fd.append('file', f);
      API.form('POST', `/api/guilds/${g.id}/emojis`, fd).then(() => { toast('Emoji eklendi', 'ok'); setTimeout(() => this.emojis(b), 200); }).catch(errToast);
    };
    b.onclick = (e) => { const d = e.target.closest('[data-del]'); if (d) API.del('/api/emojis/' + d.dataset.del).then(() => setTimeout(() => this.emojis(b), 200)).catch(errToast); };
  },
  members(b) {
    const g = this.g;
    const draw = (q = '') => {
      const ms = [...g.memberMap.values()].filter((m) => { const u = App.user(m.uid); return !q || u.username.includes(q) || App.displayName(m.uid, g.id).toLowerCase().includes(q); });
      $('#mt', b).innerHTML = `<tr><th>Ad</th><th>Katılım</th><th>Roller</th><th></th></tr>` + ms.map((m) => `<tr data-u="${m.uid}"><td><div class="row">${avatarHTML(m.uid, 28, true)}<div><b>${esc(App.displayName(m.uid, g.id))}</b>${g.owner_id === m.uid ? ' 👑' : ''}<div class="tiny muted">${esc(App.user(m.uid).username)}</div></div></div></td><td class="small muted">${new Date(m.joined_at).toLocaleDateString('tr-TR')}</td><td>${m.roles.map((r) => g.roleMap.get(r)).filter(Boolean).map((r) => `<span class="role-chip"><span class="role-dot" style="background:${r.color || '#99aab5'}"></span>${esc(r.name)}</span>`).join('')}</td><td><button class="icon-btn" data-more="${m.uid}">${icon('more')}</button></td></tr>`).join('');
    };
    b.innerHTML = `<h2>Sunucu Üyeleri — ${g.memberMap.size}</h2><input class="input" id="mq" placeholder="Üye ara" style="margin-bottom:12px"><table class="table" id="mt"></table>`;
    draw();
    b.oninput = (e) => { if (e.target.id === 'mq') draw(e.target.value.toLowerCase()); };
    b.onclick = (e) => { const m = e.target.closest('[data-more]'); if (m) Views.userMenu(e, m.dataset.more, g.id, m); };
  },
  async invites(b) {
    const g = this.g;
    const rows = await API.get(`/api/guilds/${g.id}/invites`).catch(() => []);
    b.innerHTML = `<h2>Davetler</h2><p class="small muted">Aktif davet bağlantıları. İstediğini iptal edebilirsin.</p><table class="table"><tr><th>Davet Eden</th><th>Kod</th><th>Kullanım</th><th>Süre</th><th></th></tr>${rows.map((i) => { const exp = i.expires_at && i.expires_at < Date.now(); return `<tr style="${exp ? 'opacity:.5' : ''}"><td><div class="row">${avatarHTML(i.inviter.id, 24)}${esc(i.inviter.display_name)}</div></td><td><code style="cursor:pointer" data-copy="${i.code}">${i.code}</code></td><td>${i.uses}${i.max_uses ? ' / ' + i.max_uses : ''}</td><td class="small">${exp ? 'Süresi doldu' : i.expires_at ? fmtLeft(i.expires_at - Date.now()) : '∞'}</td><td><button class="icon-btn" data-rev="${i.code}" style="color:var(--red)" data-tip="İptal Et">${icon('x')}</button></td></tr>`; }).join('') || '<tr><td colspan="5" class="muted">Hiç davet yok</td></tr>'}</table>`;
    b.onclick = (e) => {
      const r = e.target.closest('[data-rev]'); if (r) API.del('/api/invites/' + r.dataset.rev).then(() => this.invites(b)).catch(errToast);
      const c = e.target.closest('[data-copy]'); if (c) copyText(`${location.origin}/invite/${c.dataset.copy}`);
    };
  },
  async bans(b) {
    const g = this.g;
    const rows = await API.get(`/api/guilds/${g.id}/bans`).catch(() => []);
    b.innerHTML = `<h2>Sunucu Yasakları — ${rows.length}</h2>${rows.map((x) => `<div class="setting-row"><div class="row">${avatarHTML(x.user.id, 32)}<div><b>${esc(x.user.display_name)}</b> <span class="muted small">${esc(x.user.username)}</span><div class="tiny muted">Sebep: ${esc(x.reason || 'belirtilmedi')}</div></div></div><button class="btn secondary sm" data-unban="${x.user_id}">Yasağı Kaldır</button></div>`).join('') || '<div class="empty"><div class="art">⚖️</div><p>Yasaklanmış kimse yok.</p></div>'}`;
    b.onclick = (e) => { const u = e.target.closest('[data-unban]'); if (u) API.del(`/api/guilds/${g.id}/bans/${u.dataset.unban}`).then(() => this.bans(b)).catch(errToast); };
  },
  async audit(b) {
    const g = this.g;
    const rows = await API.get(`/api/guilds/${g.id}/audit`).catch(() => []);
    b.innerHTML = `<h2>Denetim Kaydı</h2><p class="small muted">Sunucunda yapılan yönetim işlemleri. Şeffaflık önemli.</p>${rows.map((a) => `<div class="setting-row" style="justify-content:flex-start">${avatarHTML(a.user.id, 32)}<div class="grow"><b>${esc(a.user.display_name)}</b> <span class="m-body">${renderMarkdown(a.detail, App.mdCtx(g.id), { inline: true })}</span><div class="tiny muted">${fmtFull(a.created_at)}</div></div></div>`).join('') || '<div class="empty"><div class="art">📜</div><p>Henüz kayıt yok.</p></div>'}`;
  },
  async delete() {
    const g = this.g;
    const md = modal({ title: `'${esc(g.name)}' Sunucusunu Sil`, body: `<p class="muted">Bu işlem <b>geri alınamaz</b>. Tüm kanallar ve mesajlar silinir.</p><label class="label">Onaylamak için sunucu adını gir</label><input class="input" id="dn">`, foot: '<button class="btn ghost" data-close>İptal</button><button class="btn danger" id="dGo">Sunucuyu Sil</button>' });
    md.$('#dGo').onclick = () => { if (md.$('#dn').value !== g.name) return toast('Sunucu adı eşleşmiyor', 'err'); API.del('/api/guilds/' + g.id).then(() => { md.close(); this.s.close(); toast('Sunucu silindi'); }).catch(errToast); };
  },

  openChannel(cid) {
    const ch = App.channelById(cid);
    const g = App.guilds.get(ch.guild_id);
    const isCat = ch.type === 'category';
    const md = modal({ title: (isCat ? 'Kategori: ' : ch.type === 'voice' ? '🔊 ' : '# ') + esc(ch.name), cls: 'lg', body: `
      <div class="field"><label class="label">${isCat ? 'Kategori' : 'Kanal'} Adı</label><input class="input" id="cn" value="${esc(ch.name)}" maxlength="100"></div>
      ${!isCat && ch.type !== 'voice' ? `<div class="field"><label class="label">Kanal Konusu</label><textarea class="textarea" id="ct" maxlength="1024" placeholder="Herkese bu kanalın nasıl kullanılacağını anlat">${esc(ch.topic || '')}</textarea></div>
      <div class="field"><label class="label">Yavaş Mod</label><select class="select" id="cs">${[[0, 'Kapalı'], [5, '5 sn'], [10, '10 sn'], [30, '30 sn'], [60, '1 dk'], [300, '5 dk'], [900, '15 dk'], [3600, '1 saat']].map(([v, l]) => `<option value="${v}" ${ch.slowmode === v ? 'selected' : ''}>${l}</option>`).join('')}</select><div class="tiny muted" style="margin-top:4px">Üyeler her mesaj arasında bu kadar beklemek zorunda kalır (moderatörler hariç).</div></div>` : ''}
      ${!isCat ? `<div class="field"><label class="label">Kategori</label><select class="select" id="cp"><option value="">Kategori yok</option>${g.channels.filter((c) => c.type === 'category').map((c) => `<option value="${c.id}" ${ch.parent_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>` : ''}
      <div class="setting-row"><div><div class="t">${icon('lock', 'sm')} Özel Kanal</div><div class="d">Sadece seçili roller (ve yöneticiler) bu kanalı görebilir</div></div><label class="switch"><input type="checkbox" id="cpriv" ${ch.private_roles ? 'checked' : ''}><span></span></label></div>
      <div id="cRoles" class="${ch.private_roles ? '' : 'hidden'}" style="padding:8px 0">${g.roles.filter((r) => r.id !== g.id).map((r) => `<label class="row" style="padding:4px 0"><input type="checkbox" value="${r.id}" ${ch.private_roles?.includes(r.id) ? 'checked' : ''}><span class="role-dot" style="background:${r.color || '#99aab5'}"></span>${esc(r.name)}</label>`).join('') || '<span class="small muted">Önce bir rol oluştur.</span>'}</div>`,
      foot: `<button class="btn danger sm" id="cDel">Sil</button><span class="grow"></span><button class="btn ghost" data-close>İptal</button><button class="btn success" id="cSave">Kaydet</button>` });
    md.$('#cpriv').onchange = (e) => md.$('#cRoles').classList.toggle('hidden', !e.target.checked);
    md.$('#cSave').onclick = () => {
      const body = { name: md.$('#cn').value, private_roles: md.$('#cpriv').checked ? $$('#cRoles input:checked', md.el).map((i) => i.value) : null };
      if (md.$('#ct')) body.topic = md.$('#ct').value;
      if (md.$('#cs')) body.slowmode = +md.$('#cs').value;
      if (md.$('#cp')) body.parent_id = md.$('#cp').value || null;
      API.patch('/api/channels/' + ch.id, body).then(() => { md.close(); toast('Kaydedildi', 'ok'); }).catch(errToast);
    };
    md.$('#cDel').onclick = async () => { if (await confirmModal('Sil', `<b>${esc(ch.name)}</b> silinsin mi? Geri alınamaz.`, 'Sil')) API.del('/api/channels/' + ch.id).then(() => md.close()).catch(errToast); };
  },
};
