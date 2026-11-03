// ════════ Görünümler ════════
'use strict';
const STATUS_TEXT = { online: 'Çevrimiçi', idle: 'Boşta', dnd: 'Rahatsız Etmeyin', offline: 'Çevrimdışı', invisible: 'Görünmez' };
const DECORATIONS = [['', 'Yok'], ['neon', 'Neon'], ['rainbow', 'Gökkuşağı'], ['fire', 'Alev'], ['crown', 'Taç'], ['halo', 'Hale'], ['hearts', 'Kalpler'], ['snow', 'Kar Tanesi'], ['cat', 'Kedi Kulağı'], ['star', 'Yıldız'], ['gamer', 'Oyuncu'], ['tr', 'Ay Yıldız']];
const EFFECTS = [['', 'Yok'], ['confetti', 'Konfeti'], ['stars', 'Yıldız Yağmuru'], ['snow', 'Kar Yağışı'], ['hearts', 'Kalp Yağmuru'], ['fireflies', 'Ateş Böcekleri'], ['aurora', 'Kutup Işıkları'], ['sparkle', 'Pırıltı'], ['sakura', 'Sakura']];
function effectHTML(effect) {
  if (!effect) return '';
  if (effect === 'aurora') return '<div class="pc-effect aurora"></div>';
  const chars = { confetti: ['🎉', '🎊', '✨', '🟪', '🟨'], stars: ['⭐', '✨', '🌟'], snow: ['❄️', '❅', '❆'], hearts: ['💖', '💕', '❤️', '💗'], sakura: ['🌸', '💮'], sparkle: ['✨', '💫'] }[effect];
  let s = '';
  for (let i = 0; i < 14; i++) {
    const left = Math.random() * 100, dur = 3 + Math.random() * 4, delay = -Math.random() * 7, size = 10 + Math.random() * 10;
    if (effect === 'fireflies') s += `<span style="left:${left}%;animation-duration:${dur + 2}s;animation-delay:${delay}s"></span>`;
    else if (effect === 'sparkle') s += `<span style="left:${left}%;top:${Math.random() * 90}%;animation-delay:${delay}s;font-size:${size}px">${chars[i % chars.length]}</span>`;
    else s += `<span style="left:${left}%;animation-duration:${dur}s;animation-delay:${delay}s;font-size:${size}px">${chars[i % chars.length]}</span>`;
  }
  return `<div class="pc-effect ${effect}">${s}</div>`;
}
function profileCardHTML(u, o = {}) {
  const themed = u.theme_primary && u.theme_secondary;
  const banner = u.banner ? `background-image:url('${esc(u.banner)}')` : `background:${u.banner_color || u.accent_color || '#5865f2'}`;
  const gid = o.gid, mem = gid && App.member(gid, u.id), g = gid && App.guilds.get(gid);
  const roles = mem ? mem.roles.map((r) => g.roleMap.get(r)).filter(Boolean).sort((a, b) => b.position - a.position) : [];
  const { st, cls } = nameStyle(u.id, gid && App.roleColor(gid, u.id));
  const badges = [];
  if (u.created_at && u.created_at < Date.now() - 0) badges.push('<span data-tip="Erken Destekçi">🚀</span>');
  if (u.decoration || u.effect || u.name_color2 || themed) badges.push('<span data-tip="Profil Süsleyici (Ücretsiz Nitro)">💎</span>');
  if (g && g.owner_id === u.id) badges.push('<span data-tip="Sunucu Sahibi">👑</span>');
  return `<div class="profile-card ${themed ? 'themed' : ''}" style="${themed ? `--p1:${u.theme_primary};--p2:${u.theme_secondary}` : ''}">
    ${effectHTML(u.effect)}
    <div class="pc-banner" style="${banner}"></div>
    <div class="pc-av">${avatarHTML(u.id, 80, true).replace('data-av=', o.preview ? 'data-prev-av=' : 'data-av=')}</div>
    <div class="pc-badges">${badges.join('')}</div>
    <div class="pc-inner">
      <div class="pc-name ${cls}" style="${st}">${esc(mem?.nick || u.display_name || u.username)}</div>
      <div class="pc-user">${esc(u.username)}${u.pronouns ? ` • <span class="muted">${esc(u.pronouns)}</span>` : ''}</div>
      ${u.custom_status ? `<div class="cstatus">${esc(u.custom_status_emoji || '💬')} ${esc(u.custom_status)}</div>` : ''}
      ${u.bio ? `<div class="pc-sec"><h5>Hakkımda</h5><div class="md">${renderMarkdown(u.bio, App.mdCtx(gid))}</div></div>` : ''}
      <div class="pc-sec"><h5>Üyelik Tarihi</h5><div class="small">${u.created_at ? new Date(u.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}${mem ? ` &nbsp;•&nbsp; Sunucuya katılım: ${new Date(mem.joined_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</div></div>
      ${roles.length || (mem && App.can('MANAGE_ROLES', gid)) ? `<div class="pc-sec"><h5>Roller</h5><div>${roles.map((r) => `<span class="role-chip"><span class="role-dot" style="background:${r.color || '#99aab5'}"></span>${esc(r.name)}${App.can('MANAGE_ROLES', gid) ? `<span class="x" data-rmrole="${r.id}">✕</span>` : ''}</span>`).join('')}${App.can('MANAGE_ROLES', gid) ? `<button class="role-chip" data-addrole style="cursor:pointer">+</button>` : ''}</div></div>` : ''}
      ${o.mutual ? o.mutual : ''}
      ${o.note !== undefined ? `<div class="pc-sec"><h5>Not</h5><textarea class="note" rows="1" placeholder="Not eklemek için tıkla (sadece sen görürsün)">${esc(o.note)}</textarea></div>` : ''}
      ${o.actions || ''}
    </div></div>`;
}

const Views = {
  focusKey: null, videoCache: new Map(),

  // ─── Ana sayfa (Arkadaşlar) ───
  renderHome() {
    const main = $('#main');
    if (!main || App.view.guildId !== '@me' || App.view.channelId) return;
    const tab = App.view.homeTab;
    const rels = [...App.rels.values()];
    const friends = rels.filter((r) => r.type === 1).map((r) => App.user(r.id));
    const pend = rels.filter((r) => r.type === 3 || r.type === 4);
    const blocked = rels.filter((r) => r.type === 2);
    let list = [], title = '';
    if (tab === 'online') { list = friends.filter((u) => u.status !== 'offline'); title = `Çevrimiçi — ${list.length}`; }
    if (tab === 'all') { list = friends; title = `Tüm arkadaşlar — ${list.length}`; }
    const q = (this.friendQ || '').toLowerCase();
    const filterQ = (u) => !q || u.username.includes(q) || (u.display_name || '').toLowerCase().includes(q);
    const row = (u, actions, sub) => `<div class="friend-row" data-u="${u.id}">${avatarHTML(u.id, 32, true)}<div class="grow" style="min-width:0"><div class="ellipsis"><b style="color:var(--text-strong)">${esc(u.display_name)}</b> <span class="muted small friend-un">${esc(u.username)}</span></div><div class="tiny muted ellipsis">${sub ?? (u.custom_status ? esc((u.custom_status_emoji || '') + ' ' + u.custom_status) : STATUS_TEXT[u.status])}</div></div><div class="actions">${actions}</div></div>`;
    let body = '';
    if (tab === 'add') {
      body = `<h3 style="color:var(--text-strong);margin:4px 0 8px">ARKADAŞ EKLE</h3><p class="muted small" style="margin:0 0 16px">Yankı kullanıcı adlarıyla arkadaşlarını ekleyebilirsin.</p>
        <form id="addFriend" class="row" style="background:var(--bg-0);padding:6px 6px 6px 14px;border-radius:8px;border:1px solid var(--border)"><input class="grow" id="addName" placeholder="Yankı kullanıcı adını girerek arkadaş ekleyebilirsin." style="background:none;border:0;outline:none;padding:8px 0;font-size:15px"><button class="btn sm" id="addGo" disabled>Arkadaşlık İsteği Gönder</button></form>
        <div id="addMsg" class="small" style="margin-top:8px"></div>
        <div class="divider"></div>
        <div class="empty"><div class="art">🤝</div><p>Kullanıcı adını öğrenmek için arkadaşından <b>profil kartına</b> bakmasını iste.<br>Senin kullanıcı adın: <b style="color:var(--text-strong);cursor:pointer" id="myUn">${esc(App.me.username)}</b> (kopyalamak için tıkla)</p></div>`;
    } else if (tab === 'pending') {
      const items = pend.map((r) => App.user(r.id)).filter(filterQ);
      body = `<div class="label">Bekleyen — ${items.length}</div>` + (items.map((u) => {
        const incoming = App.rels.get(u.id).type === 3;
        return row(u, incoming ? `<button class="icon-btn ok" data-acc="${u.id}" data-tip="Kabul Et">${icon('check')}</button><button class="icon-btn no" data-rm="${u.id}" data-tip="Reddet">${icon('x')}</button>` : `<button class="icon-btn no" data-rm="${u.id}" data-tip="İptal Et">${icon('x')}</button>`, incoming ? 'Gelen Arkadaşlık İsteği' : 'Giden Arkadaşlık İsteği');
      }).join('') || `<div class="empty"><div class="art">📭</div><p>Bekleyen arkadaşlık isteği yok. Şimdilik!</p></div>`);
    } else if (tab === 'blocked') {
      const items = blocked.map((r) => App.user(r.id)).filter(filterQ);
      body = `<div class="label">Engellenen — ${items.length}</div>` + (items.map((u) => row(u, `<button class="icon-btn no" data-rm="${u.id}" data-tip="Engeli Kaldır">${icon('block')}</button>`, 'Engellendi')).join('') || `<div class="empty"><div class="art">🕊️</div><p>Kimseyi engellemedin. Harika!</p></div>`);
    } else {
      const items = list.filter(filterQ);
      body = `<div class="label">${title}</div>` + (items.map((u) => row(u, `<button class="icon-btn" data-dm="${u.id}" data-tip="Mesaj">${icon('chat')}</button><button class="icon-btn" data-more="${u.id}" data-tip="Diğer">${icon('more')}</button>`)).join('') || `<div class="empty"><div class="art">${tab === 'online' ? '🌙' : '👋'}</div><p>${tab === 'online' ? 'Kimse ortalarda yok. Belki de bir arkadaş eklemenin zamanı gelmiştir?' : 'Henüz arkadaşın yok. Hemen birini ekle!'}</p><button class="btn" data-goadd>Arkadaş Ekle</button></div>`);
    }
    // Şu an aktif: ses kanalındaki arkadaşlar
    const activeNow = [];
    for (const [cid, map] of App.voiceStates) for (const v of map.values()) if (App.rels.get(v.user_id)?.type === 1) activeNow.push({ v, ch: App.channelById(cid) });
    const reqs = App.incomingRequests();
    main.innerHTML = `<div class="main-header friends-head"><span class="mobile-only"><button class="icon-btn" id="mobNav">${icon('menu')}</button></span><div class="title">${icon('people')} Arkadaşlar</div><div style="width:1px;height:24px;background:var(--bg-4)"></div>
      <button class="tab ${tab === 'online' ? 'active' : ''}" data-tab="online">Çevrimiçi</button><button class="tab ${tab === 'all' ? 'active' : ''}" data-tab="all">Tümü</button>
      <button class="tab ${tab === 'pending' ? 'active' : ''}" data-tab="pending">Bekleyen ${reqs ? `<span class="badge">${reqs}</span>` : ''}</button><button class="tab ${tab === 'blocked' ? 'active' : ''}" data-tab="blocked">Engellenen</button>
      <button class="tab add ${tab === 'add' ? 'active' : ''}" data-tab="add">Arkadaş Ekle</button>
      <div class="tools"><button class="icon-btn" id="newDM2" data-tip="Yeni Grup DM">${icon('chat')}</button></div></div>
      <div class="main-body"><div class="chat"><div class="friends-body">
        ${tab !== 'add' ? `<input class="input" id="friendSearch" placeholder="Ara" value="${esc(this.friendQ || '')}" style="margin-bottom:16px">` : ''}${body}</div></div>
        <aside class="active-now"><h3>Şu An Aktif</h3>
          ${activeNow.length ? activeNow.map(({ v, ch }) => `<div class="an-card" data-goch="${ch?.id}" style="cursor:pointer"><div class="row">${avatarHTML(v.user_id, 32, true)}<div class="grow" style="min-width:0"><b>${esc(App.displayName(v.user_id))}</b><div class="tiny muted ellipsis">${ch?.guild_id ? esc(App.guilds.get(ch.guild_id)?.name) + ' / ' : ''}${esc(ch?.name || 'Arama')}</div></div>${v.streaming ? '<span class="tag" style="background:var(--red);color:#fff">CANLI</span>' : icon('speaker')}</div></div>`).join('') : `<div class="an-card" style="text-align:center"><b style="color:var(--text-strong)">Şimdilik sessiz…</b><p class="small muted">Bir arkadaşın ses kanalına girdiğinde ya da yayın açtığında burada görürsün.</p></div>`}
          <div class="an-card" style="background:linear-gradient(135deg,rgba(124,92,255,.25),rgba(255,95,184,.2))"><b style="color:var(--text-strong)">✨ Nitro? Burada bedava.</b><p class="small" style="margin:6px 0 10px">Animasyonlu avatar, profil teması, 4K yayın, 100MB dosya, her yerde özel emoji… Hepsi açık.</p><button class="btn sm" id="goNitro">Profilini süsle</button></div>
        </aside></div>`;
    main.onclick = (e) => {
      const t = e.target;
      const tb = t.closest('[data-tab]'); if (tb) { App.view.homeTab = tb.dataset.tab; return this.renderHome(); }
      if (t.closest('[data-goadd]')) { App.view.homeTab = 'add'; return this.renderHome(); }
      if (t.closest('#mobNav')) return $('#app').classList.remove('mobile-nav-closed');
      if (t.closest('#newDM2')) return this.newDM();
      if (t.closest('#goNitro')) return UserSettings.open('profile');
      if (t.closest('#myUn')) return copyText(App.me.username);
      const gc = t.closest('[data-goch]'); if (gc) { const c = App.channelById(gc.dataset.goch); if (c) App.go(c.guild_id || '@me', c.id); return; }
      const acc = t.closest('[data-acc]'); if (acc) { e.stopPropagation(); return API.put('/api/relationships/' + acc.dataset.acc).catch(errToast); }
      const rm = t.closest('[data-rm]'); if (rm) { e.stopPropagation(); return API.del('/api/relationships/' + rm.dataset.rm).catch(errToast); }
      const more = t.closest('[data-more]'); if (more) { e.stopPropagation(); return this.userMenu(e, more.dataset.more, null, more); }
      const dm = t.closest('[data-dm]'); if (dm) { e.stopPropagation(); return this.openDM(dm.dataset.dm); }
      const r = t.closest('.friend-row'); if (r && (tab === 'online' || tab === 'all')) return this.openDM(r.dataset.u);
    };
    main.oncontextmenu = (e) => { const r = e.target.closest('.friend-row'); if (r) this.userMenu(e, r.dataset.u); };
    const fs = $('#friendSearch');
    if (fs) fs.oninput = () => { this.friendQ = fs.value; const pos = fs.selectionStart; this.renderHome(); const n = $('#friendSearch'); n.focus(); n.setSelectionRange(pos, pos); };
    const form = $('#addFriend');
    if (form) {
      const inp = $('#addName'), go = $('#addGo');
      inp.oninput = () => { go.disabled = !inp.value.trim(); $('#addMsg').textContent = ''; };
      form.onsubmit = async (e) => {
        e.preventDefault();
        try {
          const r = await API.post('/api/relationships', { username: inp.value.trim() });
          $('#addMsg').innerHTML = `<span style="color:var(--green)">${r.result === 'accepted' ? 'Artık arkadaşsınız! 🎉' : `<b>${esc(inp.value.trim())}</b> kişisine arkadaşlık isteği gönderildi.`}</span>`;
          form.style.borderColor = 'var(--green)'; inp.value = ''; go.disabled = true;
        } catch (er) { $('#addMsg').innerHTML = `<span class="error-text">${esc(er.message)}</span>`; form.style.borderColor = 'var(--red)'; }
      };
      inp.focus();
    }
  },
  renderNoChannel() {
    $('#main').innerHTML = `<div class="main-header"><span class="mobile-only"><button class="icon-btn" onclick="$('#app').classList.remove('mobile-nav-closed')">${icon('menu')}</button></span></div><div class="empty" style="flex:1"><div class="art">🗺️</div><h2 style="color:var(--text-strong)">Burada görebileceğin bir metin kanalı yok</h2><p>Soldan bir ses kanalına katılabilir veya ${App.can('MANAGE_CHANNELS') ? 'yeni bir kanal oluşturabilirsin.' : 'yöneticiden kanal açmasını isteyebilirsin.'}</p>${App.can('MANAGE_CHANNELS') ? `<button class="btn" onclick="Views.createChannel(App.view.guildId)">Kanal Oluştur</button>` : ''}</div>`;
  },

  // ─── Üst başlık ───
  refreshHeader() {
    const hd = $('#mainHeader'), ch = App.channel;
    if (!hd || !ch) return;
    const isDM = !ch.guild_id;
    const other = isDM && App.dmOther(ch);
    const mob = `<span class="mobile-only"><button class="icon-btn" id="mobNav">${icon('menu')}</button></span>`;
    let left;
    if (ch.type === 'voice' || ch.type === 'stage') left = `<div class="title">${icon('speaker')} ${esc(ch.name)}</div>`;
    else if (isDM) left = `<div class="title">${other ? avatarHTML(other.id, 24, true) : groupIconHTML(ch, 24)} <span data-hdr-user="${other?.id || ''}" style="cursor:pointer">${esc(App.dmName(ch))}</span></div>${other?.custom_status ? `<div class="topic ellipsis">${esc((other.custom_status_emoji || '') + ' ' + other.custom_status)}</div>` : ''}`;
    else left = `<div class="title">${icon(ch.type === 'announcement' ? 'megaphone' : 'hash')} ${esc(ch.name)}</div>${ch.topic ? `<div class="topic ellipsis" id="topic" data-tip="Konuyu görmek için tıkla">${esc(plainPreview(ch.topic, App.mdCtx(ch.guild_id)))}</div>` : ''}${ch.slowmode ? `<span class="tag" data-tip="Yavaş mod: ${ch.slowmode} sn">🐢 ${ch.slowmode}sn</span>` : ''}`;
    const tools = [];
    if (isDM) { tools.push(`<button class="icon-btn" id="hCall" data-tip="Sesli Arama Başlat">${icon('phone')}</button>`, `<button class="icon-btn" id="hVideo" data-tip="Görüntülü Arama Başlat">${icon('video')}</button>`); }
    if (ch.type !== 'voice') tools.push(`<button class="icon-btn ${App.panel?.type === 'pins' ? 'active' : ''}" id="hPins" data-tip="Sabitlenmiş Mesajlar">${icon('pin')}</button>`);
    if (isDM && ch.type === 'group') tools.push(`<button class="icon-btn" id="hAdd" data-tip="DM'ye Arkadaş Ekle">${icon('personAdd')}</button>`);
    if (!isDM || ch.type === 'group' || other) tools.push(`<button class="icon-btn ${App.showMembers ? 'active' : ''}" id="hMembers" data-tip="${other ? 'Kullanıcı Profilini Göster' : 'Üye Listesini Göster'}">${icon('people')}</button>`);
    if (ch.type !== 'voice') tools.push(`<input class="search" id="hSearch" placeholder="Ara">`);
    tools.push(`<button class="icon-btn ${App.panel?.type === 'bookmarks' ? 'active' : ''}" id="hBook" data-tip="Kaydedilenler">${icon('bookmark')}</button>`);
    hd.innerHTML = mob + left + `<div class="tools">${tools.join('')}</div>`;
    hd.onclick = (e) => {
      const t = e.target;
      if (t.closest('#mobNav')) $('#app').classList.remove('mobile-nav-closed');
      if (t.closest('#topic')) modal({ title: '#' + esc(ch.name), body: `<div class="m-body" style="white-space:pre-wrap">${renderMarkdown(ch.topic, App.mdCtx(ch.guild_id))}</div>` });
      if (t.closest('#hCall')) Voice.join(ch.id);
      if (t.closest('#hVideo')) Voice.join(ch.id).then(() => Voice.connected && !Voice.cam && Voice.toggleCamera());
      if (t.closest('#hPins')) this.openPanel('pins');
      if (t.closest('#hBook')) this.openPanel('bookmarks');
      if (t.closest('#hAdd')) this.newDM(ch);
      if (t.closest('#hMembers')) { App.showMembers = !App.showMembers; localStorage.setItem('yanki_members', App.showMembers ? '1' : '0'); $('#members')?.classList.toggle('force', App.showMembers); this.refreshHeader(); this.renderMembers(); }
      const hu = t.closest('[data-hdr-user]'); if (hu?.dataset.hdrUser) this.profile(hu.dataset.hdrUser, hu);
    };
    const s = $('#hSearch');
    if (s) s.onkeydown = (e) => { if (e.key === 'Enter' && s.value.trim()) this.openPanel('search', s.value.trim()); };
  },

  // ─── Yan panel: sabitlenenler / arama / kaydedilenler ───
  async openPanel(type, arg) {
    const sp = $('#sidePanel');
    if (!sp) return this.bookmarks();
    if (App.panel?.type === type && arg === undefined && !sp.classList.contains('hidden')) { App.panel = null; sp.className = 'hidden'; this.refreshHeader(); return; }
    App.panel = { type, arg };
    sp.className = 'side-panel';
    const titles = { pins: `${icon('pin')} Sabitlenmiş Mesajlar`, search: `${icon('search')} Arama sonuçları`, bookmarks: `${icon('bookmark')} Kaydedilenler` };
    sp.innerHTML = `<div class="sp-head">${titles[type]}<span class="grow"></span><button class="icon-btn" id="spClose">${icon('x')}</button></div><div class="sp-body"><div class="empty"><div class="spinner"></div></div></div>`;
    $('#spClose').onclick = () => { App.panel = null; sp.className = 'hidden'; this.refreshHeader(); };
    this.refreshHeader();
    const ch = App.channel;
    let rows = [];
    try {
      if (type === 'pins') rows = await API.get(`/api/channels/${ch.id}/pins`);
      if (type === 'search') rows = await API.get(`/api/search?q=${encodeURIComponent(arg)}&${ch.guild_id ? 'guild_id=' + ch.guild_id : 'channel_id=' + ch.id}`);
      if (type === 'bookmarks') rows = await API.get('/api/bookmarks');
    } catch (e) { errToast(e); }
    App.panelMessages = new Map(rows.map((m) => [m.id, m]));
    const empty = { pins: ['📌', 'Bu kanalda henüz sabitlenmiş mesaj yok.'], search: ['🔍', `"${esc(arg)}" için sonuç bulunamadı.`], bookmarks: ['🔖', 'Kaydettiğin mesajlar burada görünür. Bir mesajın menüsünden "Mesajı Kaydet" de.'] }[type];
    $('.sp-body', sp).innerHTML = (type === 'search' ? `<div class="tiny muted" style="padding:4px 16px">${rows.length} sonuç</div>` : '') + (rows.map((m) => {
      const mc = App.channelById(m.channel_id);
      const where = mc ? (mc.guild_id ? `#${esc(mc.name)} • ${esc(App.guilds.get(mc.guild_id)?.name || '')}` : esc(App.dmName(mc))) : '';
      return `<div class="result-card" data-jump-ch="${m.channel_id}" data-jump-m="${m.id}"><div class="rc-meta">${where}${type === 'bookmarks' ? `<button class="icon-btn" data-unbook="${m.id}" style="float:right;width:22px;height:22px" data-tip="Kaldır">${icon('x', 'sm')}</button>` : ''}</div>${Chat.msgHTML(m, null, mc?.guild_id).replace(/<div class="m-actions">[\s\S]*?<\/div><\/div>$/, '</div>')}</div>`;
    }).join('') || `<div class="empty"><div class="art">${empty[0]}</div><p>${empty[1]}</p></div>`);
    sp.onclick = (e) => {
      const ub = e.target.closest('[data-unbook]');
      if (ub) { e.stopPropagation(); API.del('/api/bookmarks/' + ub.dataset.unbook).then(() => ub.closest('.result-card').remove()); return; }
      const c = e.target.closest('[data-jump-ch]');
      if (c) Chat.jumpTo(c.dataset.jumpCh, c.dataset.jumpM);
    };
  },
  bookmarks() {
    const md = modal({ title: '🔖 Kaydedilen Mesajlar', cls: 'lg', body: '<div class="empty"><div class="spinner"></div></div>' });
    API.get('/api/bookmarks').then((rows) => {
      App.panelMessages = new Map(rows.map((m) => [m.id, m]));
      md.$('.modal-body').innerHTML = rows.map((m) => `<div class="result-card" data-jump-ch="${m.channel_id}" data-jump-m="${m.id}"><div class="rc-meta">${m.guild_name ? esc(m.guild_name) + ' • #' + esc(m.channel_name) : 'Direkt Mesaj'}</div>${Chat.msgHTML(m, null, m.guild_id).replace(/<div class="m-actions">[\s\S]*?<\/div><\/div>$/, '</div>')}</div>`).join('') || '<div class="empty"><div class="art">🔖</div><p>Henüz bir mesaj kaydetmedin. Herhangi bir mesaja sağ tıklayıp <b>Mesajı Kaydet</b> diyebilirsin.</p></div>';
      md.el.onclick = (e) => { const c = e.target.closest('[data-jump-ch]'); if (c) { md.close(); Chat.jumpTo(c.dataset.jumpCh, c.dataset.jumpM); } };
    });
  },

  // ─── Üye listesi ───
  renderMembers() {
    const el = $('#members'), ch = App.channel;
    if (!el || !ch) return;
    el.classList.toggle('hidden', !App.showMembers);
    if (!App.showMembers) return;
    if (!ch.guild_id) {
      const other = App.dmOther(ch);
      if (other) {
        el.style.padding = '0';
        el.innerHTML = `<div class="dm-profile">${profileCardHTML(other)}</div>`;
        return;
      }
      el.style.padding = '';
      el.innerHTML = `<div class="grp">Üyeler — ${ch.recipients.length}</div>` + ch.recipients.map((u) => this.memberRow(u.id, null, ch.owner_id === u.id)).join('');
      el.onclick = (e) => { const m = e.target.closest('.member'); if (m) this.profile(m.dataset.u, m); };
      return;
    }
    el.style.padding = '';
    const g = App.guilds.get(ch.guild_id);
    const mems = [...g.memberMap.values()].filter((m) => !ch.private_roles || g.owner_id === m.uid || m.roles.some((r) => ch.private_roles.includes(r) || (g.roleMap.get(r)?.permissions & App.P.ADMIN)));
    const hoisted = g.roles.filter((r) => r.hoist && r.id !== g.id).sort((a, b) => b.position - a.position);
    const groups = new Map(hoisted.map((r) => [r.id, []]));
    const onlineRest = [], offline = [];
    const sortName = (a, b) => App.displayName(a.uid, g.id).localeCompare(App.displayName(b.uid, g.id), 'tr');
    for (const m of mems) {
      const u = App.user(m.uid);
      if (!u || u.status === 'offline') { offline.push(m); continue; }
      const top = hoisted.find((r) => m.roles.includes(r.id));
      if (top) groups.get(top.id).push(m); else onlineRest.push(m);
    }
    let html = '';
    for (const r of hoisted) { const list = groups.get(r.id); if (list.length) html += `<div class="grp">${esc(r.name)} — ${list.length}</div>` + list.sort(sortName).map((m) => this.memberRow(m.uid, g.id, g.owner_id === m.uid)).join(''); }
    if (onlineRest.length) html += `<div class="grp">Çevrimiçi — ${onlineRest.length}</div>` + onlineRest.sort(sortName).map((m) => this.memberRow(m.uid, g.id, g.owner_id === m.uid)).join('');
    if (offline.length) html += `<div class="grp">Çevrimdışı — ${offline.length}</div>` + offline.sort(sortName).slice(0, 200).map((m) => this.memberRow(m.uid, g.id, g.owner_id === m.uid, true)).join('');
    el.innerHTML = html;
    el.onclick = (e) => { const m = e.target.closest('.member'); if (m) this.profile(m.dataset.u, m, g.id, 'left'); };
    el.oncontextmenu = (e) => { const m = e.target.closest('.member'); if (m) this.userMenu(e, m.dataset.u, g.id); };
  },
  memberRow(uid, gid, owner, off) {
    const u = App.user(uid) || {};
    const v = [...App.voiceStates.values()].find((m) => m.has(uid))?.get(uid);
    const sub = u.custom_status ? esc((u.custom_status_emoji || '') + ' ' + u.custom_status) : v?.streaming ? '<span style="color:var(--red);font-weight:700">🔴 Yayında</span>' : v ? '🔊 Ses kanalında' : '';
    return `<div class="member ${off ? 'offline' : ''}" data-u="${uid}">${avatarHTML(uid, 32, true, uid)}<div style="min-width:0" class="grow"><div class="nm ellipsis">${nameHTML(uid, gid)} ${owner ? `<span class="crown" data-tip="Sunucu Sahibi">${icon('crown', 'sm')}</span>` : ''}</div>${sub ? `<div class="cs ellipsis">${sub}</div>` : ''}</div></div>`;
  },

  // ─── Profil kartı ───
  async profile(uid, anchor, gid, side) {
    closeFloating();
    const u = App.user(uid);
    if (!u) return;
    const el = h(`<div class="popout" data-keep-float></div>`);
    const isMe = uid === App.me.id;
    const rel = App.rels.get(uid)?.type || 0;
    const actions = isMe ? `<div class="pc-sec"><button class="btn block sm" id="pcEdit">${icon('edit', 'sm')} Profili Düzenle</button></div>`
      : `<div class="pc-sec"><input class="input" id="pcMsg" placeholder="@${esc(u.username)} kişisine mesaj gönder" style="font-size:14px"></div><div class="row" style="margin-top:8px">${rel === 1 ? '' : rel === 3 ? `<button class="btn success sm grow" id="pcAcc">İsteği Kabul Et</button>` : rel === 4 ? `<button class="btn secondary sm grow" disabled>İstek Gönderildi</button>` : rel === 2 ? '' : `<button class="btn sm grow" id="pcAdd">${icon('personAdd', 'sm')} Arkadaş Ekle</button>`}<button class="btn secondary sm" id="pcMore">${icon('more', 'sm')}</button></div>`;
    el.innerHTML = profileCardHTML(u, { gid, note: isMe ? undefined : '', actions });
    if (anchor) {
      document.body.append(el);
      const a = anchor.getBoundingClientRect(), r = el.getBoundingClientRect();
      let x = side === 'left' ? a.left - r.width - 12 : a.right + 12, y = a.top;
      if (x + r.width > innerWidth - 8) x = a.left - r.width - 12;
      if (x < 8) x = Math.min(a.left, innerWidth - r.width - 8);
      y = Math.max(8, Math.min(y, innerHeight - r.height - 8));
      el.style.left = x + 'px'; el.style.top = y + 'px';
    } else placeFloating(el, innerWidth / 2 - 170, innerHeight / 2 - 250);
    const reposition = () => { const r = el.getBoundingClientRect(); if (r.bottom > innerHeight - 8) el.style.top = Math.max(8, innerHeight - r.height - 8) + 'px'; };
    el.onclick = async (e) => {
      if (e.target.closest('#pcEdit')) { closeFloating(); UserSettings.open('profile'); }
      if (e.target.closest('#pcAdd')) API.put('/api/relationships/' + uid).then(() => { toast('Arkadaşlık isteği gönderildi', 'ok'); closeFloating(); }).catch(errToast);
      if (e.target.closest('#pcAcc')) API.put('/api/relationships/' + uid).then(() => closeFloating()).catch(errToast);
      if (e.target.closest('#pcMore')) this.userMenu(e, uid, gid, e.target.closest('#pcMore'));
      const rr = e.target.closest('[data-rmrole]');
      if (rr) { const m = App.member(gid, uid); API.patch(`/api/guilds/${gid}/members/${uid}`, { roles: m.roles.filter((x) => x !== rr.dataset.rmrole) }).then(() => setTimeout(() => this.profile(uid, anchor, gid, side), 200)).catch(errToast); }
      if (e.target.closest('[data-addrole]')) this.roleMenu(e, gid, uid, e.target.closest('[data-addrole]'));
    };
    const msg = $('#pcMsg', el);
    if (msg) msg.onkeydown = async (e) => {
      if (e.key !== 'Enter' || !msg.value.trim()) return;
      const text = msg.value.trim();
      try { const ch = await API.post('/api/dms', { recipients: [uid] }); App.putDM(ch); closeFloating(); App.go('@me', ch.id); const fd = new FormData(); fd.append('content', text); API.upload(`/api/channels/${ch.id}/messages`, fd); } catch (er) { errToast(er); }
    };
    if (!isMe) {
      const data = await API.get('/api/users/' + uid).catch(() => null);
      if (!data || !document.body.contains(el)) return;
      const note = $('.note', el);
      if (note) { note.value = data.note; note.onblur = () => API.put(`/api/users/${uid}/note`, { note: note.value }); note.oninput = () => autoGrow(note); }
      if (data.mutual_guilds.length || data.mutual_friends.length) {
        const sec = h(`<div class="pc-sec"><div class="small muted">${data.mutual_guilds.length ? `🏠 ${data.mutual_guilds.length} ortak sunucu` : ''}${data.mutual_guilds.length && data.mutual_friends.length ? ' • ' : ''}${data.mutual_friends.length ? `👥 ${data.mutual_friends.length} ortak arkadaş` : ''}</div></div>`);
        $('.pc-inner .pc-sec:last-of-type', el)?.before(sec);
      }
      reposition();
    }
  },
  roleMenu(e, gid, uid, anchor) {
    const g = App.guilds.get(gid), m = App.member(gid, uid);
    const roles = g.roles.filter((r) => r.id !== g.id);
    if (!roles.length) return toast('Bu sunucuda henüz rol yok');
    ctxMenu(e, roles.map((r) => ({ label: r.name, color: r.color || '#99aab5', check: m.roles.includes(r.id), keep: true, action: () => {
      const has = App.member(gid, uid).roles.includes(r.id);
      API.patch(`/api/guilds/${gid}/members/${uid}`, { roles: has ? m.roles.filter((x) => x !== r.id) : [...m.roles, r.id] }).catch(errToast);
    } })), anchor);
  },
  async openDM(uid) { try { const ch = await API.post('/api/dms', { recipients: [uid] }); App.putDM(ch); App.go('@me', ch.id); } catch (e) { errToast(e); } },

  // ─── Bağlam menüleri ───
  userMenu(e, uid, gid, anchor) {
    const isMe = uid === App.me.id, rel = App.rels.get(uid)?.type || 0, g = gid && App.guilds.get(gid);
    const vs = App.voiceStates.get(Voice.channelId)?.get(uid);
    const vol = Number(localStorage.getItem('yanki_vol_' + uid) ?? 100);
    const lmute = localStorage.getItem('yanki_lmute_' + uid) === '1';
    const items = [
      { label: 'Profil', action: () => this.profile(uid, anchor || { getBoundingClientRect: () => ({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }) }, gid) },
      !isMe && { label: 'Mesaj', action: () => this.openDM(uid) },
      !isMe && { label: 'Sesli Ara', action: async () => { const ch = await API.post('/api/dms', { recipients: [uid] }); App.putDM(ch); App.go('@me', ch.id); Voice.join(ch.id); } },
      vs && !isMe && '-', vs && !isMe && { label: `Ses Seviyesi: %${vol}`, action: () => this.volumeModal(uid) },
      vs && !isMe && { label: 'Yerel Olarak Sustur', check: lmute, keep: true, action: () => { localStorage.setItem('yanki_lmute_' + uid, lmute ? '0' : '1'); Voice.applyRemoteAudio(uid); } },
      '-',
      !isMe && rel === 0 && { label: 'Arkadaş Ekle', action: () => API.put('/api/relationships/' + uid).then(() => toast('İstek gönderildi', 'ok')).catch(errToast) },
      !isMe && rel === 3 && { label: 'Arkadaşlık İsteğini Kabul Et', action: () => API.put('/api/relationships/' + uid).catch(errToast) },
      !isMe && rel === 1 && { label: 'Arkadaşı Çıkar', danger: true, action: async () => { if (await confirmModal(`'${esc(App.displayName(uid))}' Arkadaşlardan Çıkarılsın mı?`, 'Bu kullanıcıyı arkadaşlarından çıkarmak istediğine emin misin?', 'Arkadaşı Çıkar')) API.del('/api/relationships/' + uid).catch(errToast); } },
      !isMe && (rel === 2 ? { label: 'Engeli Kaldır', action: () => API.del('/api/relationships/' + uid).catch(errToast) } : { label: 'Engelle', danger: true, action: async () => { if (await confirmModal(`${esc(App.displayName(uid))} engellensin mi?`, 'Engellediğin kişi sana mesaj gönderemez ve arkadaşlığınız sona erer.', 'Engelle')) API.post(`/api/relationships/${uid}/block`).catch(errToast); } }),
    ];
    if (g) {
      const m = App.member(gid, uid);
      items.push('-');
      if (isMe || App.can('MANAGE_GUILD', gid)) items.push({ label: 'Takma Ad Değiştir', action: async () => { const n = await promptModal('Takma Ad Değiştir', 'Takma ad (boş bırakırsan sıfırlanır)', m?.nick || ''); if (n !== null) API.patch(`/api/guilds/${gid}/members/${uid}`, { nick: n }).catch(errToast); } });
      if (App.can('MANAGE_ROLES', gid) && m) items.push({ label: 'Roller ▸', action: () => this.roleMenu(e, gid, uid, anchor) });
      if (vs && !isMe && App.can('MUTE_MEMBERS', gid)) items.push({ label: vs.server_muted ? 'Sunucu Susturmasını Kaldır' : 'Sunucuda Sustur', action: () => App.socket.emit('voice:moderate', { user_id: uid, action: vs.server_muted ? 'unmute' : 'mute' }) });
      if (vs && !isMe && App.can('MOVE_MEMBERS', gid)) items.push({ label: 'Sesten Bağlantısını Kes', danger: true, action: () => App.socket.emit('voice:moderate', { user_id: uid, action: 'disconnect' }) });
      if (!isMe && App.can('KICK', gid) && g.owner_id !== uid) items.push({ label: `${App.displayName(uid, gid)} Adlı Kullanıcıyı At`, danger: true, action: async () => { if (await confirmModal(`'${esc(App.displayName(uid, gid))}' sunucudan atılsın mı?`, 'Davet ile tekrar katılabilir.', 'At')) API.del(`/api/guilds/${gid}/members/${uid}`).then(() => toast('Kullanıcı atıldı', 'ok')).catch(errToast); } });
      if (!isMe && App.can('BAN', gid) && g.owner_id !== uid) items.push({ label: `${App.displayName(uid, gid)} Adlı Kullanıcıyı Yasakla`, danger: true, action: () => this.banModal(gid, uid) });
    }
    items.push('-', { label: 'Kullanıcı Adını Kopyala', action: () => copyText(App.user(uid)?.username || '') }, { label: 'Kullanıcı Kimliğini Kopyala', action: () => copyText(uid) });
    ctxMenu(e, items, anchor);
  },
  volumeModal(uid) {
    const cur = Number(localStorage.getItem('yanki_vol_' + uid) ?? 100);
    const md = modal({ title: `${esc(App.displayName(uid))} — Ses Seviyesi`, sub: 'Bu ayar sadece senin duyduğunu değiştirir.', body: `<input type="range" min="0" max="100" value="${cur}" class="vol-slider" id="vs"><div style="text-align:center;font-weight:700;margin-top:8px" id="vl">%${cur}</div>`, foot: '<button class="btn" data-close>Tamam</button>' });
    md.$('#vs').oninput = (e) => { localStorage.setItem('yanki_vol_' + uid, e.target.value); md.$('#vl').textContent = '%' + e.target.value; Voice.applyRemoteAudio(uid); };
  },
  banModal(gid, uid) {
    const md = modal({ title: `'${esc(App.displayName(uid, gid))}' Yasaklansın mı?`, body: `<p class="muted">Yasaklanan kullanıcı davetle tekrar katılamaz.</p><div class="field"><label class="label">Sebep</label><input class="input" id="banR" placeholder="İsteğe bağlı"></div><label class="row"><input type="checkbox" id="banDel"> Son 7 günün mesajlarını sil</label>`, foot: '<button class="btn ghost" data-close>İptal</button><button class="btn danger" id="banGo">Yasakla</button>' });
    md.$('#banGo').onclick = () => API.put(`/api/guilds/${gid}/bans/${uid}`, { reason: md.$('#banR').value, delete_messages: md.$('#banDel').checked }).then(() => { md.close(); toast('Kullanıcı yasaklandı', 'ok'); }).catch(errToast);
  },
  channelMenu(e, ch) {
    if (!ch) return;
    const gid = ch.guild_id;
    const canManage = App.can('MANAGE_CHANNELS', gid);
    ctxMenu(e, [
      ch.type !== 'category' && ch.type !== 'voice' && { label: 'Okundu Olarak İşaretle', action: () => { App.view.channelId === ch.id || (App.readStates[ch.id] = ch.last_message_id); App.mentions.delete(ch.id); API.post(`/api/channels/${ch.id}/ack`, {}); App.renderSidebar(); App.renderGuilds(); } },
      ch.type === 'voice' && (Voice.channelId === ch.id ? { label: 'Bağlantıyı Kes', action: () => Voice.leave() } : { label: 'Ses Kanalına Katıl', action: () => Voice.join(ch.id) }),
      ch.type !== 'category' && App.can('INVITE', gid) && { label: 'İnsanları Davet Et', action: () => this.invite(gid, ch.id) },
      ch.type !== 'category' && { label: 'Bağlantıyı Kopyala', action: () => copyText(`${location.origin}/app/${gid}/${ch.id}`) },
      canManage && '-',
      canManage && { label: ch.type === 'category' ? 'Kategoriyi Düzenle' : 'Kanalı Düzenle', action: () => GuildSettings.openChannel(ch.id) },
      canManage && ch.type === 'category' && { label: 'Kanal Oluştur', action: () => this.createChannel(gid, ch.id) },
      canManage && { label: ch.type === 'category' ? 'Kategoriyi Sil' : 'Kanalı Sil', danger: true, action: async () => { if (await confirmModal(ch.type === 'category' ? 'Kategoriyi Sil' : 'Kanalı Sil', `<b>${esc(ch.name)}</b> silinsin mi? Bu işlem geri alınamaz.`, 'Sil')) API.del('/api/channels/' + ch.id).catch(errToast); } },
      '-', { label: 'Kanal Kimliğini Kopyala', action: () => copyText(ch.id) },
    ]);
  },
  guildMenu(e, gid, anchor) {
    const g = App.guilds.get(gid);
    if (!g) return;
    const isOwner = g.owner_id === App.me.id;
    ctxMenu(e, [
      App.can('INVITE', gid) && { label: 'İnsanları Davet Et', icon: 'personAdd', action: () => this.invite(gid) },
      (App.can('MANAGE_GUILD', gid) || App.can('MANAGE_ROLES', gid) || App.can('BAN', gid) || App.can('MANAGE_EMOJIS', gid)) && { label: 'Sunucu Ayarları', icon: 'gear', action: () => GuildSettings.open(gid) },
      App.can('MANAGE_CHANNELS', gid) && { label: 'Kanal Oluştur', icon: 'plusCircle', action: () => this.createChannel(gid) },
      App.can('MANAGE_CHANNELS', gid) && { label: 'Kategori Oluştur', icon: 'folder', action: () => this.createChannel(gid, null, 'category') },
      '-',
      { label: 'Sunucu Profilini Düzenle', icon: 'edit', action: async () => { const n = await promptModal('Sunucu Profili', 'Bu sunucudaki takma adın', App.member(gid, App.me.id)?.nick || ''); if (n !== null) API.patch(`/api/guilds/${gid}/members/@me`, { nick: n }).catch(errToast); } },
      { label: 'Tümünü Okundu İşaretle', icon: 'check', action: () => { for (const c of g.channels) if (c.last_message_id) { App.readStates[c.id] = c.last_message_id; App.mentions.delete(c.id); API.post(`/api/channels/${c.id}/ack`, {}); } App.renderGuilds(); App.renderSidebar(); } },
      '-',
      { label: 'Sunucu Kimliğini Kopyala', action: () => copyText(gid) },
      !isOwner && { label: 'Sunucudan Ayrıl', danger: true, icon: 'logout', action: async () => { if (await confirmModal(`'${esc(g.name)}' Sunucusundan Ayrıl`, `<b>${esc(g.name)}</b> sunucusundan ayrılmak istediğine emin misin? Davet edilmeden tekrar katılamazsın.`, 'Sunucudan Ayrıl')) API.del(`/api/guilds/${gid}/members/@me`).catch(errToast); } },
    ], anchor);
  },
  statusMenu(e, anchor) {
    const set = (status) => API.patch('/api/me', { status }).catch(errToast);
    ctxMenu(e, [
      { label: '🟢 Çevrimiçi', action: () => set('online') },
      { label: '🌙 Boşta', action: () => set('idle') },
      { label: '⛔ Rahatsız Etmeyin (sessiz mod)', action: () => set('dnd') },
      { label: '⚪ Görünmez', action: () => set('invisible') },
      '-',
      { label: App.me.custom_status ? 'Özel Durumu Düzenle' : 'Özel Durum Ayarla', action: () => this.customStatus() },
      App.me.custom_status && { label: 'Özel Durumu Temizle', action: () => API.patch('/api/me', { custom_status: '', custom_status_emoji: '' }) },
      '-',
      { label: 'Profili Düzenle', action: () => UserSettings.open('profile') },
      { label: 'Kullanıcı Adını Kopyala', action: () => copyText(App.me.username) },
    ], anchor);
  },
  customStatus() {
    const md = modal({ title: 'Özel Durum Ayarla', center: true, body: `<div class="field"><label class="label">Şu an ne yapıyorsun?</label><div class="row"><button class="btn secondary" id="csEmoji" style="font-size:20px;min-width:48px">${esc(App.me.custom_status_emoji || '💬')}</button><input class="input" id="csText" maxlength="128" value="${esc(App.me.custom_status || '')}" placeholder="Valorant oynuyorum, ders çalışıyorum…"></div></div>
      <div class="row wrap">${['🎮 Oyun oynuyorum', '📚 Ders çalışıyorum', '🎵 Müzik dinliyorum', '💤 Uyuyorum', '🍕 Yemekteyim', '💻 Kod yazıyorum'].map((s) => `<button class="tag" data-preset="${s}" style="cursor:pointer">${s}</button>`).join('')}</div>`, foot: '<button class="btn ghost" data-close>İptal</button><button class="btn" id="csSave">Kaydet</button>' });
    let emoji = App.me.custom_status_emoji || '💬';
    md.$('#csEmoji').onclick = () => Pickers.emoji(md.$('#csEmoji'), (em) => { if (em.startsWith('<')) return toast('Özel durumda standart emoji kullan'); emoji = em; md.$('#csEmoji').textContent = em; });
    md.el.addEventListener('click', (e) => { const p = e.target.closest('[data-preset]'); if (p) { const [em, ...rest] = p.dataset.preset.split(' '); emoji = em; md.$('#csEmoji').textContent = em; md.$('#csText').value = rest.join(' '); } });
    md.$('#csSave').onclick = () => API.patch('/api/me', { custom_status: md.$('#csText').value, custom_status_emoji: emoji }).then(() => md.close()).catch(errToast);
  },

  // ─── Sunucu oluştur / katıl / davet ───
  createGuild() {
    const md = modal({ title: 'Sunucunu oluştur', center: true, sub: 'Sunucun, arkadaşlarınla takıldığın yerdir. Kendi sunucunu oluştur ve konuşmaya başla.', body: `
      <button class="choice" data-tpl="">${'<span class="ci">🛠️</span>'}Kendim Oluşturayım<span class="grow"></span>${icon('chev').replace('icon', 'icon" style="transform:rotate(-90deg)')}</button>
      <div class="label" style="margin-top:14px">Bir şablonla başla</div>
      <button class="choice" data-tpl="gaming"><span class="ci">🎮</span>Oyun</button>
      <button class="choice" data-tpl="friends"><span class="ci">💖</span>Arkadaşlar</button>
      <button class="choice" data-tpl="study"><span class="ci">🍎</span>Ders Çalışma Grubu</button>`, foot: `<div class="grow" style="text-align:center"><div style="font-weight:600;color:var(--text-strong);margin-bottom:8px">Zaten bir davetin var mı?</div><button class="btn secondary block" id="toJoin">Bir Sunucuya Katıl</button></div>` });
    md.$('#toJoin').onclick = () => { md.close(); this.joinGuild(); };
    md.el.addEventListener('click', (e) => {
      const c = e.target.closest('[data-tpl]');
      if (!c) return;
      const tpl = c.dataset.tpl;
      md.$('.modal-head').innerHTML = `<h2>Sunucunu özelleştir</h2><p>Yeni sunucuna bir ad ve simge ekleyerek ona kişilik kat. Bunları daha sonra değiştirebilirsin.</p>`;
      md.$('.modal-body').innerHTML = `<label class="upload-circle" id="upC">${icon('plus', 'lg')}<input type="file" accept="image/*" class="hidden" id="gIcon"></label><div class="tiny muted" style="text-align:center;margin:-8px 0 16px">YÜKLE</div><div class="field"><label class="label">Sunucu adı <span class="req">*</span></label><input class="input" id="gName" value="${esc(App.me.display_name)} sunucusu" maxlength="100"></div><div class="tiny muted">Sunucu oluşturarak Yankı'nın Topluluk Kurallarını kabul etmiş olursun.</div>`;
      md.$('.modal-foot').innerHTML = `<button class="btn ghost" id="back">Geri</button><span class="grow"></span><button class="btn" id="gCreate">Oluştur</button>`;
      let file = null;
      md.$('#gIcon').onchange = (ev) => { file = ev.target.files[0]; if (file) { const u = URL.createObjectURL(file); md.$('#upC').style.backgroundImage = `url(${u})`; md.$('#upC').firstChild.remove?.(); md.$('#upC').style.border = '0'; } };
      md.$('#back').onclick = () => { md.close(); this.createGuild(); };
      const go = async () => {
        const fd = new FormData();
        fd.append('name', md.$('#gName').value.trim()); fd.append('template', tpl);
        if (file) fd.append('icon', file);
        md.$('#gCreate').disabled = true;
        try { const g = await API.form('POST', '/api/guilds', fd); App.putGuild(g); md.close(); App.go(g.id); toast('Sunucu oluşturuldu 🎉', 'ok'); setTimeout(() => this.invite(g.id), 500); }
        catch (er) { errToast(er); md.$('#gCreate').disabled = false; }
      };
      md.$('#gCreate').onclick = go;
      md.$('#gName').onkeydown = (ev) => ev.key === 'Enter' && go();
      md.$('#gName').select();
    });
  },
  joinGuild() {
    const md = modal({ title: 'Bir Sunucuya Katıl', center: true, sub: 'Mevcut bir sunucuya katılmak için aşağıya bir davet gir', body: `<div class="field"><label class="label">Davet bağlantısı <span class="req">*</span></label><input class="input" id="invCode" placeholder="${location.origin}/invite/Ab3dE6gH"><div id="invErr" class="error-text" style="margin-top:6px"></div></div><div class="label">Davetler şuna benzer</div><div class="small">Ab3dE6gH<br>${location.origin}/invite/Ab3dE6gH</div>`, foot: '<button class="btn ghost" data-close>Geri</button><button class="btn" id="invGo">Sunucuya Katıl</button>' });
    const go = async () => {
      const code = md.$('#invCode').value.trim().split('/').pop();
      if (!code) return;
      try { const g = await API.post('/api/invites/' + code); App.putGuild(g); md.close(); App.go(g.id); }
      catch (e) { md.$('#invErr').textContent = e.message; }
    };
    md.$('#invGo').onclick = go;
    md.$('#invCode').onkeydown = (e) => e.key === 'Enter' && go();
  },
  async acceptInvite(code) {
    let inv;
    try { inv = await API.get('/api/invites/' + code); } catch (e) { return toast(e.message, 'err'); }
    if (App.guilds.has(inv.guild.id)) { App.go(inv.guild.id); return toast('Zaten bu sunucudasın'); }
    const g = inv.guild;
    const md = modal({ center: true, title: '', body: `<div style="text-align:center"><div class="g-icon" style="width:80px;height:80px;margin:0 auto 12px;border-radius:24px;font-size:28px;background:var(--brand)">${g.icon ? `<img src="${esc(g.icon)}">` : esc(guildAcronym(g.name))}</div><div class="muted">${esc(inv.inviter.display_name)} seni şuraya katılmaya davet etti:</div><h2 style="color:var(--text-strong);margin:6px 0">${esc(g.name)}</h2><div class="row" style="justify-content:center;gap:16px" class="small"><span><span class="status-dot" style="background:var(--green)"></span> ${inv.online_count} Çevrimiçi</span><span><span class="status-dot"></span> ${inv.member_count} Üye</span></div>${g.description ? `<p class="small muted">${esc(g.description)}</p>` : ''}</div>`, foot: '<button class="btn block" id="accInv">Davete Katıl</button>' });
    md.$('#accInv').onclick = async () => { try { const gg = await API.post('/api/invites/' + code); App.putGuild(gg); md.close(); App.go(gg.id); toast(`${gg.name} sunucusuna hoş geldin! 🎉`, 'ok'); } catch (e) { errToast(e); } };
  },
  async invite(gid, cid) {
    const g = App.guilds.get(gid);
    const ch = cid ? App.channelById(cid) : g.channels.find((c) => c.type === 'text');
    let maxAge = 604800, maxUses = 0;
    const md = modal({ title: `Arkadaşlarını ${esc(g.name)} sunucusuna davet et`, sub: ch ? `Alıcılar ${ch.type === 'voice' ? '🔊' : '#'} ${esc(ch.name)} kanalına gelecek` : '', body: `
      <div class="field"><input class="input" id="invSearch" placeholder="Arkadaş ara"></div><div id="invFriends" style="max-height:200px;overflow-y:auto;margin-bottom:12px"></div>
      <label class="label">Ya da birine sunucu davet bağlantısını gönder</label><div class="invite-box"><input id="invLink" readonly value="Oluşturuluyor…"><button class="btn sm" id="invCopy">Kopyala</button></div>
      <div class="tiny muted" style="margin-top:8px" id="invInfo"></div>
      <div class="row" style="margin-top:12px;gap:8px"><select class="select" id="invAge" style="flex:1"><option value="1800">30 dakika</option><option value="3600">1 saat</option><option value="21600">6 saat</option><option value="43200">12 saat</option><option value="86400">1 gün</option><option value="604800" selected>7 gün</option><option value="0">Asla</option></select><select class="select" id="invUses" style="flex:1"><option value="0">Sınırsız kullanım</option><option value="1">1 kullanım</option><option value="5">5 kullanım</option><option value="10">10 kullanım</option><option value="25">25 kullanım</option><option value="100">100 kullanım</option></select></div>` });
    const gen = async () => {
      try {
        const inv = await API.post(`/api/guilds/${gid}/invites`, { channel_id: ch?.id, max_age: maxAge, max_uses: maxUses });
        md.$('#invLink').value = `${location.origin}/invite/${inv.code}`;
        md.$('#invInfo').textContent = (inv.expires_at ? `Davet bağlantının süresi ${fmtLeft(inv.expires_at - Date.now())} sonra doluyor.` : 'Davet bağlantının süresi asla dolmayacak.') + (inv.max_uses ? ` En fazla ${inv.max_uses} kez kullanılabilir.` : '');
      } catch (e) { md.$('#invLink').value = e.message; }
    };
    md.$('#invAge').onchange = (e) => { maxAge = +e.target.value; gen(); };
    md.$('#invUses').onchange = (e) => { maxUses = +e.target.value; gen(); };
    md.$('#invCopy').onclick = () => { copyText(md.$('#invLink').value); md.$('#invCopy').textContent = 'Kopyalandı'; md.$('#invCopy').classList.add('success'); };
    const friends = [...App.rels.values()].filter((r) => r.type === 1 && !g.memberMap.has(r.id));
    const drawF = (q = '') => { md.$('#invFriends').innerHTML = friends.filter((r) => App.user(r.id).username.includes(q.toLowerCase())).map((r) => `<div class="row" style="padding:6px 4px">${avatarHTML(r.id, 32)}<b class="grow">${esc(App.displayName(r.id))}</b><button class="btn secondary sm" data-send="${r.id}">Davet Et</button></div>`).join('') || `<div class="small muted" style="padding:6px 4px">${friends.length ? 'Sonuç yok' : 'Davet edilecek arkadaş yok (herkes zaten burada ya da henüz arkadaşın yok).'}</div>`; };
    drawF();
    md.$('#invSearch').oninput = (e) => drawF(e.target.value);
    md.$('#invFriends').onclick = async (e) => {
      const b = e.target.closest('[data-send]');
      if (!b) return;
      b.disabled = true; b.textContent = 'Gönderildi';
      try { const dm = await API.post('/api/dms', { recipients: [b.dataset.send] }); App.putDM(dm); const fd = new FormData(); fd.append('content', `Hey! **${g.name}** sunucusuna katıl: ${md.$('#invLink').value}`); await API.upload(`/api/channels/${dm.id}/messages`, fd); } catch (er) { errToast(er); }
    };
    gen();
  },
  createChannel(gid, parentId, type = 'text') {
    const g = App.guilds.get(gid);
    const cat = parentId && App.channelById(parentId);
    const isCat = type === 'category';
    const md = modal({ title: isCat ? 'Kategori Oluştur' : 'Kanal Oluştur', sub: cat ? `${esc(cat.name)} kategorisinde` : '', body: `
      ${isCat ? '' : `<label class="label">Kanal türü</label>
      <label class="radio-card"><input type="radio" name="ct" value="text" checked><span style="font-size:22px">${icon('hash', 'lg')}</span><div><b>Metin</b><div class="small muted">Mesaj, resim, GIF, emoji, fikir ve şaka gönder</div></div></label>
      <label class="radio-card"><input type="radio" name="ct" value="voice"><span>${icon('speaker', 'lg')}</span><div><b>Ses</b><div class="small muted">Sesli, görüntülü sohbet et ve ekran paylaş</div></div></label>
      <label class="radio-card"><input type="radio" name="ct" value="announcement"><span>${icon('megaphone', 'lg')}</span><div><b>Duyuru</b><div class="small muted">Sadece moderatörlerin yazabildiği önemli güncellemeler</div></div></label>`}
      <div class="field" style="margin-top:12px"><label class="label">${isCat ? 'Kategori adı' : 'Kanal adı'}</label><input class="input" id="chName" placeholder="${isCat ? 'Yeni Kategori' : 'yeni-kanal'}" maxlength="100"></div>
      <div class="setting-row" style="border:0"><div><div class="t">${icon('lock', 'sm')} Özel ${isCat ? 'Kategori' : 'Kanal'}</div><div class="d">Sadece seçilen roller görebilir</div></div><label class="switch"><input type="checkbox" id="chPriv"><span></span></label></div>
      <div id="chRoles" class="hidden">${g.roles.filter((r) => r.id !== g.id).map((r) => `<label class="row" style="padding:4px 0"><input type="checkbox" value="${r.id}"><span class="role-dot" style="background:${r.color || '#99aab5'}"></span>${esc(r.name)}</label>`).join('') || '<div class="small muted">Önce Sunucu Ayarları → Roller’den rol oluştur.</div>'}</div>`, foot: `<button class="btn ghost" data-close>İptal</button><button class="btn" id="chGo">${isCat ? 'Kategori Oluştur' : 'Kanal Oluştur'}</button>` });
    md.$('#chPriv').onchange = (e) => md.$('#chRoles').classList.toggle('hidden', !e.target.checked);
    const go = async () => {
      const t = isCat ? 'category' : md.el.querySelector('input[name=ct]:checked').value;
      const name = md.$('#chName').value.trim() || (isCat ? 'Yeni Kategori' : t === 'voice' ? 'Ses Kanalı' : 'yeni-kanal');
      const priv = md.$('#chPriv').checked ? $$('#chRoles input:checked', md.el).map((i) => i.value) : null;
      try { const c = await API.post(`/api/guilds/${gid}/channels`, { name, type: t, parent_id: parentId || (isCat ? null : g.channels.find((c) => c.type === 'category' && (t === 'voice' ? /ses/i.test(c.name) : /metin/i.test(c.name)))?.id), private_roles: priv }); md.close(); if (!isCat) setTimeout(() => App.go(gid, c.id), 150); }
      catch (e) { errToast(e); }
    };
    md.$('#chGo').onclick = go;
    md.$('#chName').onkeydown = (e) => e.key === 'Enter' && go();
  },
  newDM(existing) {
    const friends = [...App.rels.values()].filter((r) => r.type === 1 && !(existing?.recipients || []).some((u) => u.id === r.id));
    const sel = new Set();
    const md = modal({ title: existing ? 'Gruba Arkadaş Ekle' : 'Arkadaşları Seç', sub: existing ? '' : 'En fazla 9 arkadaş daha ekleyebilirsin.', body: `<input class="input" id="dmQ" placeholder="Bir arkadaşının kullanıcı adını yaz" style="margin-bottom:10px"><div id="dmList" style="max-height:300px;overflow-y:auto"></div>`, foot: `<button class="btn block" id="dmGo" disabled>${existing ? 'Ekle' : 'DM Oluştur'}</button>` });
    const draw = (q = '') => { md.$('#dmList').innerHTML = friends.filter((r) => App.user(r.id).username.includes(q.toLowerCase()) || (App.user(r.id).display_name || '').toLowerCase().includes(q.toLowerCase())).map((r) => `<label class="row" style="padding:6px;border-radius:4px;cursor:pointer">${avatarHTML(r.id, 32, true)}<div class="grow"><b>${esc(App.displayName(r.id))}</b> <span class="small muted">${esc(App.user(r.id).username)}</span></div><input type="checkbox" value="${r.id}" ${sel.has(r.id) ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--brand)"></label>`).join('') || '<div class="empty small">Eklenebilecek arkadaş bulunamadı. Önce arkadaş ekle!</div>'; };
    draw();
    md.$('#dmQ').oninput = (e) => draw(e.target.value);
    md.$('#dmList').onchange = (e) => { e.target.checked ? sel.add(e.target.value) : sel.delete(e.target.value); md.$('#dmGo').disabled = !sel.size || sel.size > 9; md.$('#dmGo').textContent = existing ? 'Ekle' : sel.size > 1 ? 'Grup DM Oluştur' : 'DM Oluştur'; };
    md.$('#dmGo').onclick = async () => {
      try {
        if (existing) { for (const id of sel) await API.post(`/api/dms/${existing.id}/recipients`, { user_id: id }); md.close(); return; }
        const ch = await API.post('/api/dms', { recipients: [...sel] }); App.putDM(ch); md.close(); App.go('@me', ch.id);
      } catch (e) { errToast(e); }
    };
  },
  quickSwitcher() {
    const md = modal({ cls: '', body: `<div style="padding:8px 0"><div class="small muted" style="margin-bottom:8px;font-weight:600">Bir sunucu, kanal veya kişi ara</div><input class="input" id="qs" placeholder="Nereye gitmek istersin?" style="font-size:18px;padding:14px"><div id="qsRes" style="margin-top:10px;max-height:360px;overflow-y:auto"></div><div class="tiny muted" style="margin-top:10px">İPUCU: <span class="kbd">@</span> kişiler, <span class="kbd">#</span> metin kanalları, <span class="kbd">!</span> ses kanalları, <span class="kbd">*</span> sunucular</div></div>` });
    let items = [], sel = 0;
    const draw = (q) => {
      const ql = q.replace(/^[@#!*]/, '').toLocaleLowerCase('tr'), pre = q[0];
      items = [];
      if (!pre || pre === '@') { for (const c of App.dms.values()) if (App.dmName(c).toLocaleLowerCase('tr').includes(ql)) items.push({ html: `${c.type === 'dm' ? avatarHTML(App.dmOther(c)?.id, 24, true) : groupIconHTML(c, 24)}<b>${esc(App.dmName(c))}</b>`, go: () => App.go('@me', c.id) }); for (const r of App.rels.values()) if (r.type === 1 && App.user(r.id).username.includes(ql) && ![...App.dms.values()].some((c) => c.type === 'dm' && App.dmOther(c)?.id === r.id)) items.push({ html: `${avatarHTML(r.id, 24, true)}<b>${esc(App.displayName(r.id))}</b><span class="desc">${esc(App.user(r.id).username)}</span>`, go: () => this.openDM(r.id) }); }
      for (const g of App.guilds.values()) {
        if ((!pre || pre === '*') && g.name.toLocaleLowerCase('tr').includes(ql)) items.push({ html: `<span class="g-icon" style="width:24px;height:24px;font-size:10px;border-radius:8px">${g.icon ? `<img src="${esc(g.icon)}">` : esc(guildAcronym(g.name))}</span><b>${esc(g.name)}</b>`, go: () => App.go(g.id) });
        for (const c of g.channels) if (c.type !== 'category' && c.name.toLocaleLowerCase('tr').includes(ql) && (!pre || (pre === '#' && c.type !== 'voice') || (pre === '!' && c.type === 'voice'))) items.push({ html: `${icon(c.type === 'voice' ? 'speaker' : 'hash', 'sm')}<b>${esc(c.name)}</b><span class="desc">${esc(g.name)}</span>`, go: () => { App.go(g.id, c.id); if (c.type === 'voice') Voice.join(c.id); } });
      }
      items = items.slice(0, 30); sel = 0;
      md.$('#qsRes').innerHTML = items.map((it, i) => `<div class="ac-item ${i === 0 ? 'sel' : ''}" data-i="${i}">${it.html}</div>`).join('') || '<div class="empty small">Sonuç yok</div>';
    };
    draw('');
    const inp = md.$('#qs');
    inp.oninput = () => draw(inp.value);
    inp.onkeydown = (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; $$('#qsRes .ac-item', md.el).forEach((x, i) => x.classList.toggle('sel', i === sel)); }
      if (e.key === 'Enter' && items[sel]) { md.close(); items[sel].go(); }
    };
    md.$('#qsRes').onclick = (e) => { const it = e.target.closest('[data-i]'); if (it) { md.close(); items[+it.dataset.i].go(); } };
  },
  lightbox(url) {
    const el = h(`<div class="lightbox"><img src="${esc(url)}" referrerpolicy="no-referrer"><a href="${esc(url)}" target="_blank" style="color:#fff;font-size:14px">Orijinali aç</a></div>`);
    el.onclick = (e) => { if (e.target.tagName !== 'A') el.remove(); };
    document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { el.remove(); document.removeEventListener('keydown', k); } });
    document.body.append(el);
  },

  // ─── Anket / zamanlama ───
  pollModal(question = '') {
    const md = modal({ title: '📊 Anket Oluştur', body: `<div class="field"><label class="label">Soru</label><input class="input" id="pq" maxlength="300" value="${esc(question)}" placeholder="Bu akşam ne oynayalım?"></div><label class="label">Seçenekler</label><div id="pOpts"></div><button class="btn secondary sm" id="pAdd" style="margin:4px 0 16px">+ Seçenek ekle</button>
      <div class="row" style="gap:16px"><div class="grow"><label class="label">Süre</label><select class="select" id="pHours"><option value="1">1 saat</option><option value="4">4 saat</option><option value="24" selected>24 saat</option><option value="72">3 gün</option><option value="168">1 hafta</option><option value="0">Süresiz</option></select></div><label class="row" style="margin-top:22px"><input type="checkbox" id="pMulti" style="accent-color:var(--brand)"> Çoklu seçim</label></div>`, foot: '<button class="btn ghost" data-close>İptal</button><button class="btn" id="pGo">Paylaş</button>' });
    const addOpt = (v = '') => { const n = md.$('#pOpts').children.length; if (n >= 10) return; md.$('#pOpts').append(h(`<div class="row" style="margin-bottom:8px"><input class="input" maxlength="80" placeholder="Seçenek ${n + 1}" value="${esc(v)}"><button class="icon-btn" data-rm>${icon('trash', 'sm')}</button></div>`)); };
    addOpt(); addOpt();
    md.$('#pAdd').onclick = () => addOpt();
    md.$('#pOpts').onclick = (e) => { if (e.target.closest('[data-rm]') && md.$('#pOpts').children.length > 2) e.target.closest('.row').remove(); };
    md.$('#pGo').onclick = () => {
      const options = $$('#pOpts input', md.el).map((i) => i.value.trim()).filter(Boolean);
      if (!md.$('#pq').value.trim()) return toast('Bir soru yaz', 'err');
      if (options.length < 2) return toast('En az 2 seçenek gerekli', 'err');
      Chat.send({ poll: { question: md.$('#pq').value.trim(), options, multi: md.$('#pMulti').checked, hours: +md.$('#pHours').value } });
      md.close();
    };
  },
  scheduleModal(text = '') {
    const d = new Date(Date.now() + 3600_000); d.setSeconds(0, 0);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const md = modal({ title: '⏰ Mesajı Zamanla', sub: 'Mesajın seçtiğin zamanda otomatik olarak gönderilir — bilgisayarın kapalı olsa bile.', body: `<div class="field"><label class="label">Mesaj</label><textarea class="textarea" id="sText" maxlength="4000" placeholder="Doğum günün kutlu olsun! 🎂">${esc(text || $('#composer')?.value || '')}</textarea></div><div class="field"><label class="label">Gönderim zamanı</label><input type="datetime-local" class="input" id="sAt" value="${local}"></div><div class="row wrap">${[['30 dk', 30], ['1 saat', 60], ['Bu akşam 20:00', 'eve'], ['Yarın 09:00', 'tom']].map(([l, v]) => `<button class="tag" style="cursor:pointer" data-q="${v}">${l}</button>`).join('')}</div>`, foot: '<button class="btn ghost" data-close>İptal</button><button class="btn" id="sGo">Zamanla</button>' });
    md.el.addEventListener('click', (e) => {
      const q = e.target.closest('[data-q]')?.dataset.q;
      if (!q) return;
      let t = new Date();
      if (q === 'eve') { t.setHours(20, 0, 0, 0); if (t < new Date()) t.setDate(t.getDate() + 1); } else if (q === 'tom') { t.setDate(t.getDate() + 1); t.setHours(9, 0, 0, 0); } else t = new Date(Date.now() + +q * 60000);
      md.$('#sAt').value = new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    });
    md.$('#sGo').onclick = async () => {
      const at = new Date(md.$('#sAt').value).getTime();
      if (!md.$('#sText').value.trim()) return toast('Mesaj boş olamaz', 'err');
      if (!(at > Date.now() + 10000)) return toast('Gelecekte bir zaman seç', 'err');
      await Chat.send({ content: md.$('#sText').value, send_at: at });
      if ($('#composer')) $('#composer').value = '';
      md.close();
    };
  },
  async scheduledList() {
    const ch = App.channel;
    const rows = await API.get(`/api/channels/${ch.id}/scheduled`).catch(() => []);
    const md = modal({ title: '⏰ Zamanlanmış Mesajlar', body: rows.map((s) => `<div class="row" style="padding:10px;border-bottom:1px solid var(--border)"><div class="grow" style="min-width:0"><div class="small muted">${fmtFull(s.send_at)}</div><div class="ellipsis">${esc(s.content)}</div></div><button class="icon-btn" data-del="${s.id}" data-tip="İptal et" style="color:var(--red)">${icon('trash')}</button></div>`).join('') || '<div class="empty"><div class="art">⏰</div><p>Bu kanalda zamanlanmış mesajın yok.</p></div>' });
    md.el.addEventListener('click', (e) => { const d = e.target.closest('[data-del]'); if (d) API.del('/api/scheduled/' + d.dataset.del).then(() => { d.closest('.row').remove(); toast('İptal edildi', 'ok'); }); });
  },

  // ─── Ses ───
  screenMenu(e, anchor) {
    if (Voice.screen) return ctxMenu(e, [{ label: 'Yayını Durdur', danger: true, action: () => Voice.stopStream('screen') }, '-', ...Object.entries(SCREEN_PRESETS).map(([k, p]) => ({ label: 'Kaliteyi değiştir: ' + p.label, action: () => { Voice.settings.screenQuality = k; VoiceSettings.save(Voice.settings); Voice.startScreen(k); } }))], anchor);
    ctxMenu(e, Object.entries(SCREEN_PRESETS).map(([k, p]) => ({ label: p.label, check: Voice.settings.screenQuality === k, action: () => { Voice.settings.screenQuality = k; VoiceSettings.save(Voice.settings); Voice.startScreen(k); } })), anchor);
  },
  soundboard(e, anchor) {
    closeFloating();
    const el = h(`<div class="picker" style="height:auto;width:300px" data-keep-float><div class="p-cat" style="padding:12px 12px 6px">Ses Efektleri <span class="tag brand" style="font-size:9px">ÜCRETSİZ</span></div><div class="soundboard" style="padding:0 10px 12px">${[['davul', '🥁'], ['alkış', '👏'], ['zil', '🔔'], ['trompet', '🎺'], ['hata', '❌'], ['yay', '🏹'], ['üzgün', '😢'], ['tada', '🎉']].map(([n, e]) => `<button data-s="${n}">${e}<span>${n}</span></button>`).join('')}</div></div>`);
    el.onclick = (ev) => { const b = ev.target.closest('[data-s]'); if (b) App.socket.emit('soundboard', { sound: b.dataset.s }); };
    placeFloating(el, 0, 0, anchor);
  },
  incomingCall({ channel_id, from }) {
    if (Voice.channelId === channel_id || $(`.call-ring[data-ch="${channel_id}"]`)) return;
    if (App.me.status_setting === 'dnd') return;
    const el = h(`<div class="call-ring" data-ch="${channel_id}">${avatarHTML(from.id, 56)}<div><b style="color:var(--text-strong);font-size:17px">${esc(from.display_name)}</b><div class="small muted">Gelen arama…</div></div>
      <button class="round" style="background:var(--green)" data-ans data-tip="Kabul Et">${icon('phone')}</button><button class="round" style="background:var(--red)" data-dec data-tip="Reddet">${icon('hangup')}</button></div>`);
    document.body.append(el);
    let n = 0;
    const iv = setInterval(() => { if (!document.body.contains(el) || n++ > 12) { clearInterval(iv); el.remove(); } else Sound.ring(); }, 2500);
    Sound.ring();
    desktopNotify('📞 ' + from.display_name + ' arıyor', 'Yanıtlamak için tıkla', from.avatar);
    el.onclick = (e) => {
      if (e.target.closest('[data-ans]')) { el.remove(); App.go('@me', channel_id); Voice.join(channel_id); }
      if (e.target.closest('[data-dec]')) { el.remove(); App.socket.emit('call:decline', { channel_id }); }
    };
  },
  renderVoiceChannel(ch) {
    const main = $('#main');
    main.innerHTML = `<div class="main-header" id="mainHeader"></div><div class="main-body"><div class="voice-view" id="voiceView"><div class="voice-grid" id="vgrid"></div><div class="voice-controls" id="vctrls"></div></div></div>`;
    this.refreshHeader();
    this.focusKey = null;
    this.refreshVoice();
  },
  tilesFor(cid) {
    const tiles = [];
    for (const v of App.voiceIn(cid)) {
      const me = v.user_id === App.me.id;
      const r = Voice.remote.get(v.user_id);
      const screen = me ? Voice.screen : v.streaming && r?.streams.get(v.screen_stream);
      const cam = me ? Voice.cam : v.video && r?.streams.get(v.camera_stream);
      if (v.streaming) tiles.push({ key: v.user_id + ':screen', uid: v.user_id, stream: screen || null, kind: 'screen', v });
      tiles.push({ key: v.user_id + (cam ? ':cam' : ':av'), uid: v.user_id, stream: cam || null, kind: cam ? 'cam' : 'av', v, me });
    }
    return tiles;
  },
  tileEl(t, gid) {
    const el = h(`<div class="tile ${t.kind === 'cam' ? 'cam' : ''} ${t.me && t.kind === 'cam' ? 'mirror' : ''} ${t.kind !== 'screen' && Voice.speaking.has(t.uid) ? 'speaking' : ''}" data-key="${t.key}" data-uid="${t.uid}" ${t.kind !== 'screen' ? `data-speak="${t.uid}"` : ''}></div>`);
    if (t.stream) {
      let vid = this.videoCache.get(t.key);
      if (!vid || vid.srcObject !== t.stream) { vid = document.createElement('video'); vid.autoplay = true; vid.playsInline = true; vid.muted = true; vid.srcObject = t.stream; this.videoCache.set(t.key, vid); }
      el.append(vid);
      vid.play().catch(() => {});
    } else if (t.kind === 'screen') {
      el.append(h(`<div class="voice-empty"><div style="font-size:40px">📺</div><div class="small">Yayın yükleniyor…</div></div>`));
    } else {
      const u = App.user(t.uid);
      el.style.background = u?.banner_color || u?.accent_color || '';
      el.append(h(`<div class="t-av">${avatarHTML(t.uid, 80)}</div>`));
    }
    const v = t.v;
    el.append(h(`<div class="t-name">${t.kind === 'screen' ? '🖥️ ' : ''}<span class="ellipsis">${esc(App.displayName(t.uid, gid))}${t.kind === 'screen' ? ' — ekran' : ''}</span>${t.kind !== 'screen' && (v.muted || v.server_muted) ? `<span style="color:var(--red)">${icon('micOff', 'sm')}</span>` : ''}${t.kind !== 'screen' && v.deafened ? `<span style="color:var(--red)">${icon('headphones', 'sm')}</span>` : ''}</div>`));
    if (t.kind === 'screen') el.append(h('<div class="t-live">CANLI</div>'));
    if (t.stream) el.append(h(`<button class="icon-btn t-fs" data-fs data-tip="Tam ekran">${icon('fullscreen')}</button>`));
    return el;
  },
  refreshVoice() {
    const ch = App.channel;
    if (!ch) return;
    if (!ch.guild_id) return this.refreshDMCall(ch);
    if (ch.type !== 'voice' && ch.type !== 'stage') { this.renderMembers(); return; }
    const grid = $('#vgrid'), ctr = $('#vctrls');
    if (!grid) return;
    const joined = Voice.channelId === ch.id;
    const participants = App.voiceIn(ch.id);
    if (!joined) {
      grid.className = 'voice-grid';
      grid.style.gridTemplateColumns = '';
      grid.innerHTML = `<div class="voice-empty"><div style="display:flex;justify-content:center;gap:-8px;margin-bottom:8px">${participants.slice(0, 6).map((v) => avatarHTML(v.user_id, 56)).join('') || '<div style="font-size:64px">🔊</div>'}</div><h2>${esc(ch.name)}</h2><p>${participants.length ? `${participants.map((v) => esc(App.displayName(v.user_id, ch.guild_id))).slice(0, 3).join(', ')}${participants.length > 3 ? ` ve ${participants.length - 3} kişi daha` : ''} şu an burada${participants.some((v) => v.streaming) ? ' — 🔴 canlı yayın var!' : ''}` : 'Şu an kanalda kimse yok. Takılmaya ilk sen başla!'}</p><button class="btn" id="vJoin" style="padding:10px 28px">Ses Kanalına Katıl</button></div>`;
      ctr.innerHTML = '';
      $('#vJoin').onclick = () => Voice.join(ch.id);
      return;
    }
    const tiles = this.tilesFor(ch.id);
    if (this.focusKey && !tiles.some((t) => t.key === this.focusKey)) this.focusKey = null;
    grid.innerHTML = '';
    if (this.focusKey) {
      grid.className = 'voice-grid focus';
      grid.style.gridTemplateColumns = '';
      const main = tiles.find((t) => t.key === this.focusKey);
      const big = this.tileEl(main, ch.guild_id); big.style.aspectRatio = 'auto'; big.style.height = '100%'; big.style.minHeight = '0';
      const strip = h('<div class="strip"></div>');
      for (const t of tiles) if (t !== main) strip.append(this.tileEl(t, ch.guild_id));
      grid.style.gridTemplateRows = strip.children.length ? '1fr 110px' : '1fr';
      grid.append(big); if (strip.children.length) grid.append(strip);
    } else {
      grid.className = 'voice-grid';
      grid.style.gridTemplateRows = '';
      const n = tiles.length, W = grid.clientWidth - 32 || 800, H = grid.clientHeight - 32 || 500;
      let best = { w: 0, c: 1 };
      for (let c = 1; c <= n; c++) { const rows = Math.ceil(n / c); const w = Math.min((W - (c - 1) * 8) / c, ((H - (rows - 1) * 8) / rows) * 16 / 9); if (w > best.w) best = { w, c }; }
      grid.style.gridTemplateColumns = `repeat(${best.c}, ${Math.max(140, Math.floor(best.w))}px)`;
      for (const t of tiles) grid.append(this.tileEl(t, ch.guild_id));
    }
    grid.onclick = (e) => {
      const fs = e.target.closest('[data-fs]');
      if (fs) { e.stopPropagation(); const tile = fs.closest('.tile'); (tile.requestFullscreen || tile.webkitRequestFullscreen)?.call(tile); return; }
      const t = e.target.closest('.tile');
      if (t) { this.focusKey = this.focusKey === t.dataset.key ? null : t.dataset.key; this.refreshVoice(); }
    };
    grid.oncontextmenu = (e) => { const t = e.target.closest('.tile'); if (t) this.userMenu(e, t.dataset.uid, ch.guild_id); };
    this.renderVoiceControls(ctr);
  },
  renderVoiceControls(ctr) {
    ctr.innerHTML = `
      <button class="vc ${Voice.cam ? 'on' : ''}" id="vcCam" data-tip="${Voice.cam ? 'Kamerayı Kapat' : 'Kamerayı Aç'}">${icon('video', 'lg')}</button>
      <button class="vc ${Voice.screen ? 'on' : ''}" id="vcScr" data-tip="${Voice.screen ? 'Yayın ayarları' : 'Ekranını Paylaş'}">${icon('screen', 'lg')}</button>
      <button class="vc ${Voice.muted || Voice.serverMuted ? 'muted' : ''}" id="vcMute" data-tip="${Voice.muted ? 'Sesi Aç' : 'Sustur'}">${icon(Voice.muted || Voice.serverMuted ? 'micOff' : 'mic', 'lg')}</button>
      <button class="vc ${Voice.deafened ? 'muted' : ''}" id="vcDeaf" data-tip="${Voice.deafened ? 'Sağırlaştırmayı Kaldır' : 'Sağırlaştır'}">${icon('headphones', 'lg')}</button>
      <button class="vc" id="vcBoard" data-tip="Ses Efektleri">${icon('music', 'lg')}</button>
      <button class="vc red" id="vcLeave" data-tip="Bağlantıyı Kes">${icon('hangup', 'lg')}</button>`;
    $('#vcCam', ctr).onclick = () => Voice.toggleCamera();
    $('#vcScr', ctr).onclick = (e) => this.screenMenu(e, $('#vcScr', ctr));
    $('#vcMute', ctr).onclick = () => Voice.toggleMute();
    $('#vcDeaf', ctr).onclick = () => Voice.toggleDeafen();
    $('#vcBoard', ctr).onclick = (e) => this.soundboard(e, $('#vcBoard', ctr));
    $('#vcLeave', ctr).onclick = () => Voice.leave();
  },
  refreshDMCall(ch) {
    const area = $('#dmCall');
    if (!area) return;
    const parts = App.voiceIn(ch.id);
    if (!parts.length) { if (area.innerHTML) { area.innerHTML = ''; area.removeAttribute('style'); } return; }
    const joined = Voice.channelId === ch.id;
    const msgs = $('#msgs'), atBottom = msgs && msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 120;
    requestAnimationFrame(() => { if (msgs && atBottom) msgs.scrollTop = msgs.scrollHeight; });
    area.style.cssText = 'background:#000;display:flex;flex-direction:column;height:' + (joined ? '46%' : 'auto') + ';min-height:' + (joined ? '260px' : '0') + ';flex:none';
    if (!joined) {
      area.innerHTML = `<div class="row" style="padding:14px 18px;color:#fff;gap:14px"><div class="row" style="gap:4px">${parts.map((v) => avatarHTML(v.user_id, 40)).join('')}</div><div class="grow"><b>Arama devam ediyor</b><div class="small" style="color:#b5bac1">${parts.map((v) => esc(App.displayName(v.user_id))).join(', ')}</div></div><button class="btn success" id="dmJoin">${icon('phone', 'sm')} Katıl</button></div>`;
      $('#dmJoin').onclick = () => Voice.join(ch.id);
      return;
    }
    area.innerHTML = '<div class="voice-grid" id="vgrid" style="padding:10px"></div><div class="voice-controls" id="vctrls" style="padding:8px"></div>';
    const grid = $('#vgrid', area);
    const tiles = this.tilesFor(ch.id);
    const n = tiles.length;
    grid.style.gridTemplateColumns = `repeat(${Math.min(n, 4)}, minmax(0, ${n <= 2 ? '360px' : '260px'}))`;
    for (const t of tiles) grid.append(this.tileEl(t));
    grid.onclick = (e) => { const fs = e.target.closest('.tile'); if (fs && fs.querySelector('video')) (fs.requestFullscreen || fs.webkitRequestFullscreen)?.call(fs); };
    this.renderVoiceControls($('#vctrls', area));
  },

  whyYanki() {
    const feats = [
      ['💎', 'Tüm Nitro özellikleri bedava', 'Animasyonlu (GIF) avatar & banner, profil temaları, avatar süsleri, profil efektleri, renkli/gradyan isim stilleri, 4000 karakter mesaj.'],
      ['📺', '4K 60 FPS yayın — ücretsiz', 'Ekran paylaşımında 720p\'den Kaynak/4K\'ya kadar kaliteyi sen seç. Kimse "Nitro al" demesin.'],
      ['📁', '100 MB dosya yükleme', 'Sürükle bırak, yapıştır, spoiler olarak işaretle. Sunucu yöneticisi limiti daha da artırabilir.'],
      ['😎', 'Özel emojiler her yerde', 'Bir sunucunun emojisini başka sunucuda veya DM\'de kullan. Sınırsız.'],
      ['💣', 'Kendini imha eden mesajlar', 'Mesajına süre koy: 30 saniye, 5 dakika, 1 gün… Süre dolunca herkesten silinir.'],
      ['⏰', 'Zamanlanmış mesajlar', 'Doğum günü mesajını şimdiden yaz, gece 00:00\'da otomatik gitsin. Bilgisayarın kapalı olsa bile.'],
      ['📊', 'Yerleşik anketler', 'Tek veya çoklu seçimli, süreli anketler. /anket yaz ve başla.'],
      ['🔖', 'Kaydedilen mesajlar', 'Önemli mesajları yer imlerine ekle, tek tıkla geri dön.'],
      ['🎚️', 'Gelişmiş ses kontrolü', 'Kişiye özel ses seviyesi, bas-konuş, gürültü engelleme, mikrofon testi, gecikme göstergesi.'],
      ['🔊', 'Ücretsiz ses efektleri paneli', 'Ses kanalında herkese davul, alkış, tada çal.'],
      ['🎲', 'Eğlence komutları', '/zar, /yazitura, /8top, /sec — bot kurmana gerek yok.'],
      ['🏠', 'Kendi sunucunda barındır', 'Açık kaynak mantığıyla kendi bilgisayarında veya VPS\'inde çalıştır. Verin sende, yasaklara takılmaz.'],
      ['🇹🇷', 'Tamamen Türkçe', 'Arayüz, komutlar ve emoji araması Türkçe. "kalp", "ateş", "döner" yaz, bul.'],
      ['🔒', 'Reklam yok, takip yok', 'Kimse mesajlarını reklam için taramıyor. Denetim kaydı ile sunucunda ne olduğunu gör.'],
    ];
    modal({ title: '✨ Neden Yankı?', cls: 'xl', sub: 'Discord\'da sevdiğin her şey burada. Para verdiklerin de. Üstüne bunlar:', body: `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px">${feats.map(([e, t, d]) => `<div class="an-card" style="margin:0"><div style="font-size:28px">${e}</div><b style="color:var(--text-strong)">${t}</b><p class="small muted" style="margin:6px 0 0">${d}</p></div>`).join('')}</div>`, foot: '<button class="btn secondary" id="wyProf">Profilimi süsle</button><button class="btn" data-close>Harika, başlayalım!</button>' }).$('#wyProf').onclick = () => { $$('.modal-back').forEach((x) => x.remove()); UserSettings.open('profile'); };
  },
};
window.addEventListener('resize', debounce(() => { if (App.channel?.type === 'voice' && !Views.focusKey) Views.refreshVoice(); }, 150));
