// ════════ Yankı — uygulama çekirdeği ════════
'use strict';
const App = {
  me: null, P: {}, guilds: new Map(), dms: new Map(), rels: new Map(), users: new Map(),
  readStates: {}, mentions: new Map(), messages: new Map(), hasMore: new Map(), detached: new Set(),
  voiceStates: new Map(), typing: new Map(), view: { guildId: '@me', channelId: null, homeTab: 'online' },
  panel: null, showMembers: localStorage.getItem('yanki_members') !== '0', collapsed: new Set(JSON.parse(localStorage.getItem('yanki_collapsed') || '[]')),
  lastChannel: JSON.parse(localStorage.getItem('yanki_lastch') || '{}'), guildOrder: JSON.parse(localStorage.getItem('yanki_gorder') || '[]'),
  socket: null, config: {},

  // ─── Önyükleme ───
  async boot() {
    applyAppearance();
    const inviteMatch = location.pathname.match(/^\/invite\/([\w-]+)/);
    if (!API.token) { Auth.show(inviteMatch?.[1]); return; }
    document.body.innerHTML = '<div class="splash"><div class="sp-in"><div class="sp-logo"><div class="logo-mark" style="display:grid;place-items:center">' + LOGO_SVG + '</div></div><div class="sp-bar"></div><div class="sp-txt">Yankı yükleniyor…</div></div></div>';
    let data;
    try { data = await API.get('/api/me'); } catch (e) { if (!API.token) return; document.body.innerHTML = `<div class="empty" style="height:100vh"><div class="art">📡</div><h2>Sunucuya bağlanılamadı</h2><p>${esc(e.message)}</p><button class="btn" onclick="location.reload()">Tekrar dene</button></div>`; return; }
    this.load(data);
    this.connect();
    this.renderShell();
    if (inviteMatch) { history.replaceState(null, '', '/app/@me'); this.route(); Views.acceptInvite(inviteMatch[1]); }
    else this.route();
    if (!localStorage.getItem('yanki_welcomed')) { localStorage.setItem('yanki_welcomed', '1'); setTimeout(() => Views.whyYanki(), 400); }
    if ('Notification' in window && Notification.permission === 'default') setTimeout(() => Notification.requestPermission().catch(() => {}), 4000);
  },
  load(d) {
    this.me = d.user; this.P = d.perms; this.config = { tenor: d.tenor, maxUpload: d.max_upload_mb };
    this.cacheUser(d.user);
    for (const g of d.guilds) this.putGuild(g);
    for (const c of d.dms) this.putDM(c);
    for (const r of d.relationships) { this.rels.set(r.id, r); this.cacheUser(r.user); }
    this.readStates = d.read_states || {};
    for (const v of d.dm_voice_states || []) this.setVoiceState(v);
  },
  cacheUser(u) { if (!u) return u; const old = this.users.get(u.id); this.users.set(u.id, old ? Object.assign(old, u) : u); return this.users.get(u.id); },
  user(id) { return this.users.get(id) || (id === this.me?.id ? this.me : null); },
  putGuild(g) {
    g.memberMap = new Map();
    for (const m of g.members) { this.cacheUser(m.user); m.uid = m.user.id; delete m.user; g.memberMap.set(m.uid, m); }
    g.roleMap = new Map(g.roles.map((r) => [r.id, r]));
    for (const [cid, map] of this.voiceStates) if (this.guilds.get(g.id)?.channels.some((c) => c.id === cid)) map.clear();
    for (const v of g.voice_states) this.setVoiceState(v);
    this.guilds.set(g.id, g);
    if (!this.guildOrder.includes(g.id)) this.guildOrder.push(g.id);
  },
  putDM(c) { for (const u of c.recipients || []) this.cacheUser(u); this.dms.set(c.id, c); },
  channelById(id) { if (this.dms.has(id)) return this.dms.get(id); for (const g of this.guilds.values()) { const c = g.channels.find((x) => x.id === id); if (c) return c; } return null; },
  get guild() { return this.guilds.get(this.view.guildId); },
  get channel() { return this.view.channelId ? this.channelById(this.view.channelId) : null; },
  can(perm, gid = this.view.guildId) { const g = this.guilds.get(gid); if (!g) return gid === '@me'; return (g.my_perms & this.P[perm]) === this.P[perm] || (g.my_perms & this.P.ADMIN) !== 0; },
  member(gid, uid) { return this.guilds.get(gid)?.memberMap.get(uid); },
  displayName(uid, gid) { const m = gid && this.member(gid, uid); const u = this.user(uid); return m?.nick || u?.display_name || u?.username || 'Bilinmeyen'; },
  roleColor(gid, uid) {
    const g = this.guilds.get(gid), m = g?.memberMap.get(uid);
    if (!m) return null;
    let best = null;
    for (const rid of m.roles) { const r = g.roleMap.get(rid); if (r?.color && (!best || r.position > best.position)) best = r; }
    return best?.color || null;
  },
  dmName(c) { if (c.name) return c.name; const others = (c.recipients || []).filter((u) => u.id !== this.me.id); return others.map((u) => this.user(u.id)?.display_name || u.username).join(', ') || 'Boş grup'; },
  dmOther(c) { return c.type === 'dm' ? this.user((c.recipients || []).find((u) => u.id !== this.me.id)?.id) : null; },
  mdCtx(gid) {
    return {
      users: (id) => this.user(id) && { ...this.user(id), display_name: this.displayName(id, gid) },
      channels: (id) => this.channelById(id), roles: (id) => this.guilds.get(gid)?.roleMap.get(id), meId: this.me.id,
    };
  },
  isUnread(c) { return c && c.last_message_id && c.type !== 'category' && c.type !== 'voice' && c.last_message_id > (this.readStates[c.id] || '0') && this.lastAuthor(c) !== this.me.id; },
  lastAuthor(c) { const arr = this.messages.get(c.id); return arr?.length && arr[arr.length - 1].id === c.last_message_id ? arr[arr.length - 1].author.id : null; },
  guildUnread(g) { return g.channels.some((c) => this.isUnread(c)); },
  guildMentions(g) { let n = 0; for (const c of g.channels) n += this.mentions.get(c.id) || 0; return n; },
  dmUnreadCount() { let n = 0; for (const c of this.dms.values()) n += this.mentions.get(c.id) || 0; return n; },
  incomingRequests() { return [...this.rels.values()].filter((r) => r.type === 3).length; },

  // ─── Ses durumları ───
  setVoiceState(v) {
    for (const [cid, map] of this.voiceStates) if (cid !== v.channel_id) map.delete(v.user_id);
    if (!this.voiceStates.has(v.channel_id)) this.voiceStates.set(v.channel_id, new Map());
    const map = this.voiceStates.get(v.channel_id);
    if (v.removed) map.delete(v.user_id); else map.set(v.user_id, v);
  },
  voiceIn(cid) { return [...(this.voiceStates.get(cid)?.values() || [])].sort((a, b) => a.joined_at - b.joined_at); },
  myVoice() { return Voice.channelId ? this.voiceStates.get(Voice.channelId)?.get(this.me.id) : null; },

  // ─── Socket.IO ───
  connect() {
    const s = (this.socket = io({ auth: { token: API.token }, transports: ['websocket', 'polling'] }));
    let first = true;
    s.on('connect', async () => {
      if (!first) {
        try { const d = await API.get('/api/me'); this.guilds.clear(); this.dms.clear(); this.rels.clear(); this.voiceStates.clear(); this.load(d); this.renderAll(); } catch { /* yoksay */ }
        if (Voice.channelId) { const c = Voice.channelId; Voice.leave(true); Voice.join(c); }
      }
      first = false; $('#conn-banner')?.remove();
    });
    s.on('disconnect', () => {
      clearInterval(this.discIv);
      this.discIv = setInterval(() => { if (s.connected) clearInterval(this.discIv); else window.yankiDesktop?.reportDisconnected?.(); }, 20000); if (!$('#conn-banner')) document.body.append(h('<div id="conn-banner" style="position:fixed;top:0;left:0;right:0;background:var(--yellow);color:#000;text-align:center;font-weight:700;font-size:13px;padding:4px;z-index:999">Bağlantı koptu — yeniden bağlanılıyor…</div>')); });
    s.on('connect_error', (e) => { if (e.message === 'unauthorized') { TokenStore.clear(); location.href = '/login'; } });
    s.on('guild:sync', (g) => {
      const isNew = !this.guilds.has(g.id);
      this.putGuild(g);
      if (this.view.guildId === g.id && this.view.channelId && !g.channels.some((c) => c.id === this.view.channelId)) this.go(g.id);
      this.renderGuilds();
      if (this.view.guildId === g.id) { this.renderSidebar(); this.refreshMainChrome(); }
      if (isNew) this.renderGuilds();
    });
    s.on('guild:delete', ({ id }) => {
      const g = this.guilds.get(id);
      this.guilds.delete(id);
      if (Voice.guildId === id) Voice.leave();
      if (this.view.guildId === id) { this.go('@me'); if (g) toast(`"${g.name}" sunucusuna artık erişimin yok`); }
      this.renderGuilds();
    });
    s.on('dm:create', (c) => { this.putDM(c); if (this.view.guildId === '@me') this.renderSidebar(); if (this.view.channelId === c.id) this.refreshMainChrome(); });
    s.on('dm:delete', ({ id }) => { this.dms.delete(id); if (this.view.channelId === id) this.go('@me'); else if (this.view.guildId === '@me') this.renderSidebar(); });
    s.on('relationship:update', (r) => {
      const prev = this.rels.get(r.id)?.type;
      if (r.type) { this.rels.set(r.id, r); this.cacheUser(r.user); } else this.rels.delete(r.id);
      if (r.type === 3 && prev !== 3) { Sound.message(); toast(`${r.user.display_name} sana arkadaşlık isteği gönderdi`); }
      if (r.type === 1 && prev === 4) toast(`${r.user.display_name} arkadaşlık isteğini kabul etti 🎉`, 'ok');
      this.renderGuilds();
      if (this.view.guildId === '@me' && !this.view.channelId) Views.renderHome();
    });
    s.on('user:update', (u) => {
      if (u.id === this.me.id) { Object.assign(this.me, u); applyAppearance(); }
      this.cacheUser(u);
      this.renderUserPanel();
      if (this.view.guildId === '@me') { this.renderSidebar(); if (!this.view.channelId) Views.renderHome(); }
      Views.renderMembers();
      $$(`[data-av="${u.id}"]`).forEach((el) => { const sz = el.dataset.size; el.outerHTML = avatarHTML(u.id, +sz, el.dataset.st === '1'); });
    });
    s.on('app:version', (v) => Updater.onSocketVersion(v));
    s.on('message:create', (m) => Chat.onCreate(m));
    s.on('message:update', (m) => Chat.onUpdate(m));
    s.on('message:delete', (d) => Chat.onDelete(d));
    s.on('typing', ({ channel_id, user_id }) => Chat.onTyping(channel_id, user_id));
    s.on('voice:state', (v) => {
      const before = this.voiceStates.get(v.channel_id)?.has(v.user_id);
      this.setVoiceState(v);
      if (Voice.channelId === v.channel_id && v.user_id !== this.me.id) {
        if (v.removed && before) Sound.leave(); else if (!v.removed && !before) Sound.join();
      }
      if (v.user_id === this.me.id && v.removed && Voice.channelId === v.channel_id) Voice.onLeftByServer();
      this.renderGuilds();
      this.renderSidebar();
      Views.refreshVoice();
    });
    s.on('voice:peer_left', ({ user_id }) => Voice.removePeer(user_id));
    s.on('voice:signal', ({ from, data }) => Voice.onSignal(from, data));
    s.on('voice:left', ({ channel_id }) => { if (Voice.channelId === channel_id) Voice.onLeftByServer(); });
    s.on('voice:server_mute', ({ muted }) => { Voice.serverMuted = muted; Voice.applyMicEnabled(); this.onVoiceChange(); toast(muted ? 'Bir moderatör seni susturdu' : 'Susturman kaldırıldı'); });
    s.on('call:ring', (d) => Views.incomingCall(d));
    s.on('call:declined', ({ channel_id, user_id }) => { if (Voice.channelId === channel_id && user_id !== this.me.id) toast(`${this.displayName(user_id)} aramayı reddetti`); $(`.call-ring[data-ch="${channel_id}"]`)?.remove(); });
    s.on('soundboard', ({ user_id, sound }) => { if (!Voice.deafened) Sound.playBoard(sound); const t = $(`.tile[data-uid="${user_id}"] .t-name`); if (t) { const b = h(`<span>${sound === 'alkış' ? '👏' : '🔊'}</span>`); t.append(b); setTimeout(() => b.remove(), 1500); } });
  },

  // ─── Yönlendirme ───
  route() {
    const m = location.pathname.match(/^\/app\/([^/]+)(?:\/([^/]+))?/);
    let gid = m?.[1] || '@me', cid = m?.[2] || null;
    if (gid !== '@me' && !this.guilds.has(gid)) { gid = '@me'; cid = null; }
    if (gid === '@me' && cid && !this.dms.has(cid)) cid = null;
    this.go(gid, cid, true);
  },
  go(gid, cid, replace) {
    const g = this.guilds.get(gid);
    if (gid !== '@me' && !g) gid = '@me';
    if (gid !== '@me' && !cid) {
      const last = this.lastChannel[gid];
      cid = g.channels.some((c) => c.id === last) ? last : (g.channels.find((c) => c.id === g.system_channel_id) || g.channels.find((c) => c.type === 'text' || c.type === 'announcement'))?.id || null;
    }
    const changed = this.view.channelId !== cid || this.view.guildId !== gid;
    if (changed) { Chat.reply = null; Chat.editing = null; this.panel = null; }
    this.view.guildId = gid; this.view.channelId = cid;
    if (gid !== '@me' && cid) { this.lastChannel[gid] = cid; localStorage.setItem('yanki_lastch', JSON.stringify(this.lastChannel)); }
    const url = '/app/' + gid + (cid ? '/' + cid : '');
    if (location.pathname !== url) history[replace ? 'replaceState' : 'pushState'](null, '', url);
    $('#app')?.classList.add('mobile-nav-closed');
    if (!cid && gid === '@me') $('#app')?.classList.toggle('mobile-nav-closed', false);
    this.renderGuilds(); this.renderSidebar(); this.renderMain();
    const ch = this.channel;
    document.title = ch ? (ch.guild_id ? `#${ch.name} | ${g.name}` : this.dmName(ch)) + ' — Yankı' : 'Yankı';
  },

  // ─── İskelet ───
  renderShell() {
    document.body.innerHTML = `<div id="app" class="mobile-nav-closed">
      <nav class="guilds" id="guilds"></nav>
      <aside class="sidebar"><div id="side" style="display:flex;flex-direction:column;flex:1;min-height:0"></div><div id="voicePanel"></div><div id="userPanel" class="user-panel"></div></aside>
      <main class="main" id="main"></main></div>`;
    this.renderUserPanel();
    Updater.render();
    window.onpopstate = () => this.route();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) Chat.ackCurrent(); });
    window.addEventListener('focus', () => Chat.ackCurrent());
    this.bindShortcuts();
  },
  renderAll() { this.renderGuilds(); this.renderSidebar(); this.renderMain(); this.renderUserPanel(); },
  refreshMainChrome() { Views.refreshHeader(); Views.renderMembers(); },
  renderMain() {
    const ch = this.channel;
    if (!ch) { if (this.view.guildId === '@me') Views.renderHome(); else Views.renderNoChannel(); return; }
    if (ch.type === 'voice' || ch.type === 'stage') Views.renderVoiceChannel(ch);
    else Chat.render(ch);
  },

  // ─── Sunucu listesi ───
  renderGuilds() {
    const el = $('#guilds');
    if (!el) return;
    const dmBadge = this.dmUnreadCount() + this.incomingRequests();
    Updater.setBadge(dmBadge + [...this.guilds.values()].reduce((n, g) => n + this.guildMentions(g), 0));
    const unreadDMs = [...this.dms.values()].filter((c) => (this.mentions.get(c.id) || 0) > 0).slice(0, 5);
    const order = [...this.guildOrder.filter((id) => this.guilds.has(id)), ...[...this.guilds.keys()].filter((id) => !this.guildOrder.includes(id))];
    el.innerHTML = `
      <div class="g-item ${this.view.guildId === '@me' ? 'active' : ''}" data-g="@me"><div class="g-pill"></div>
        <div class="g-icon" data-tip="Direkt Mesajlar" style="${this.view.guildId === '@me' ? 'background:var(--brand)' : ''}">${LOGO_SVG}</div>${dmBadge ? `<span class="badge">${dmBadge}</span>` : ''}</div>
      ${unreadDMs.map((c) => `<div class="g-item" data-dm="${c.id}"><div class="g-pill"></div><div class="g-icon" data-tip="${esc(this.dmName(c))}">${c.type === 'dm' ? avatarHTML(this.dmOther(c)?.id, 48, false) : groupIconHTML(c, 48)}</div><span class="badge">${this.mentions.get(c.id)}</span></div>`).join('')}
      <div class="g-sep"></div>
      ${order.map((id) => {
        const g = this.guilds.get(id), active = this.view.guildId === id, men = this.guildMentions(g);
        const inVoice = Voice.guildId === id;
        return `<div class="g-item ${active ? 'active' : ''} ${this.guildUnread(g) ? 'unread' : ''} ${g.icon ? 'has-img' : ''}" data-g="${id}" draggable="true"><div class="g-pill"></div>
          <div class="g-icon" data-tip="${esc(g.name)}">${g.icon ? `<img src="${esc(g.icon)}" alt="">` : esc(guildAcronym(g.name))}</div>
          ${men ? `<span class="badge">${men}</span>` : inVoice ? `<span class="g-voice">${icon('speaker', 'sm').replace('icon sm', 'icon" style="width:11px;height:11px;color:#fff')}</span>` : ''}</div>`;
      }).join('')}
      <div class="g-item" data-act="create"><div class="g-icon green" data-tip="Sunucu Ekle">${icon('plus', 'lg')}</div></div>
      <div class="g-item" data-act="join"><div class="g-icon green" data-tip="Davet ile Katıl">${icon('explore', 'lg')}</div></div>
      <div class="g-sep"></div>
      <div class="g-item" data-act="why"><div class="g-icon green" data-tip="Neden Yankı?" style="font-size:20px">✨</div></div>`;
    el.onclick = (e) => {
      const it = e.target.closest('.g-item');
      if (!it) return;
      if (it.dataset.g) this.go(it.dataset.g);
      else if (it.dataset.dm) this.go('@me', it.dataset.dm);
      else if (it.dataset.act === 'create') Views.createGuild();
      else if (it.dataset.act === 'join') Views.joinGuild();
      else if (it.dataset.act === 'why') Views.whyYanki();
    };
    el.oncontextmenu = (e) => { const it = e.target.closest('.g-item[data-g]'); if (it && it.dataset.g !== '@me') Views.guildMenu(e, it.dataset.g); };
    let dragId = null;
    el.ondragstart = (e) => { dragId = e.target.closest('.g-item')?.dataset.g; };
    el.ondragover = (e) => e.preventDefault();
    el.ondrop = (e) => {
      const t = e.target.closest('.g-item[data-g]')?.dataset.g;
      if (!dragId || !t || t === '@me' || t === dragId) return;
      const o = order.filter((x) => x !== dragId); o.splice(o.indexOf(t), 0, dragId);
      this.guildOrder = o; localStorage.setItem('yanki_gorder', JSON.stringify(o)); this.renderGuilds();
    };
  },

  // ─── Kenar çubuğu ───
  renderSidebar() {
    const el = $('#side');
    if (!el) return;
    if (this.view.guildId === '@me') return this.renderDMSidebar(el);
    const g = this.guild;
    if (!g) return;
    const cats = g.channels.filter((c) => c.type === 'category').sort((a, b) => a.position - b.position);
    const visible = g.channels.filter((c) => c.type !== 'category');
    const byParent = (pid) => visible.filter((c) => (c.parent_id || null) === pid).sort((a, b) => a.position - b.position || (a.created_at - b.created_at));
    const canManage = this.can('MANAGE_CHANNELS');
    const chHTML = (c) => {
      const active = this.view.channelId === c.id, unread = this.isUnread(c), men = this.mentions.get(c.id) || 0;
      const ic = c.type === 'voice' ? 'speaker' : c.type === 'announcement' ? 'megaphone' : c.type === 'stage' ? 'people' : 'hash';
      const users = c.type === 'voice' || c.type === 'stage' ? this.voiceIn(c.id) : [];
      return `<div class="ch ${active ? 'active' : ''} ${unread && !active ? 'unread' : ''}" data-ch="${c.id}" draggable="${canManage}">
        ${icon(ic)}${c.private_roles ? `<span style="margin-left:-10px;margin-top:10px;color:var(--text-muted)">${icon('lock').replace('icon', 'icon" style="width:10px;height:10px')}</span>` : ''}
        <span class="ellipsis grow">${esc(c.name)}</span>
        ${men ? `<span class="badge">${men}</span>` : ''}
        <span class="acts">${this.can('INVITE') ? `<button class="icon-btn" data-inv="${c.id}" data-tip="Davet Oluştur">${icon('personAdd')}</button>` : ''}${canManage ? `<button class="icon-btn" data-edit="${c.id}" data-tip="Kanalı Düzenle">${icon('gear')}</button>` : ''}</span></div>
        ${users.length ? `<div class="vc-users">${users.map((v) => `<div class="vc-user" data-vu="${v.user_id}">
            ${avatarHTML(v.user_id, 24, false, v.user_id)}<span class="ellipsis" style="${Voice.speaking.has(v.user_id) ? 'color:var(--text-strong)' : ''}">${esc(this.displayName(v.user_id, g.id))}</span>
            <span class="icons">${v.streaming ? '<span class="live">CANLI</span>' : ''}${v.video ? icon('video', 'sm') : ''}${v.server_muted ? `<span style="color:var(--red)">${icon('micOff', 'sm')}</span>` : v.muted ? icon('micOff', 'sm') : ''}${v.deafened ? `<span style="color:var(--red)">${icon('headphones', 'sm')}</span>` : ''}</span></div>`).join('')}</div>` : ''}`;
    };
    el.innerHTML = `
      <div class="side-header ${g.banner ? 'banner' : ''}" id="guildHeader" style="${g.banner ? `background-image:linear-gradient(rgba(0,0,0,.4),transparent 60%),url('${esc(g.banner)}')` : ''}">
        <span class="ellipsis grow">${esc(g.name)}</span>${icon('chev')}</div>
      <div class="side-scroll" id="chList">
        ${byParent(null).map(chHTML).join('')}
        ${cats.map((cat) => {
          const kids = byParent(cat.id);
          const col = this.collapsed.has(cat.id);
          const shown = col ? kids.filter((c) => c.id === this.view.channelId || this.voiceIn(c.id).length || this.isUnread(c)) : kids;
          return `<div class="cat ${col ? 'collapsed' : ''}" data-cat="${cat.id}" data-ch-drop="${cat.id}">${icon('chev', 'chev')}<span class="ellipsis">${esc(cat.name)}</span>${canManage ? `<button class="icon-btn add" data-add="${cat.id}" data-tip="Kanal Oluştur" style="width:18px;height:18px">${icon('plus', 'sm')}</button>` : ''}</div>${shown.map(chHTML).join('')}`;
        }).join('')}
        ${!visible.length ? '<div class="empty small"><div>Henüz kanal yok</div></div>' : ''}
      </div>`;
    $('#guildHeader').onclick = (e) => Views.guildMenu(e, g.id, $('#guildHeader'));
    const list = $('#chList');
    list.onclick = (e) => {
      const inv = e.target.closest('[data-inv]'); if (inv) { e.stopPropagation(); return Views.invite(g.id, inv.dataset.inv); }
      const ed = e.target.closest('[data-edit]'); if (ed) { e.stopPropagation(); return GuildSettings.openChannel(ed.dataset.edit); }
      const add = e.target.closest('[data-add]'); if (add) { e.stopPropagation(); return Views.createChannel(g.id, add.dataset.add); }
      const vu = e.target.closest('[data-vu]'); if (vu) return Views.profile(vu.dataset.vu, vu, g.id);
      const cat = e.target.closest('[data-cat]');
      if (cat) { const id = cat.dataset.cat; this.collapsed.has(id) ? this.collapsed.delete(id) : this.collapsed.add(id); localStorage.setItem('yanki_collapsed', JSON.stringify([...this.collapsed])); return this.renderSidebar(); }
      const ch = e.target.closest('[data-ch]');
      if (ch) {
        const c = this.channelById(ch.dataset.ch);
        if (c.type === 'voice' || c.type === 'stage') { if (Voice.channelId !== c.id) Voice.join(c.id); this.go(g.id, c.id); }
        else this.go(g.id, c.id);
      }
    };
    list.oncontextmenu = (e) => {
      const ch = e.target.closest('[data-ch]'), vu = e.target.closest('[data-vu]'), cat = e.target.closest('[data-cat]');
      if (vu) return Views.userMenu(e, vu.dataset.vu, g.id);
      if (ch) return Views.channelMenu(e, this.channelById(ch.dataset.ch));
      if (cat) return Views.channelMenu(e, this.channelById(cat.dataset.cat));
      if (canManage) ctxMenu(e, [{ label: 'Kanal Oluştur', action: () => Views.createChannel(g.id) }, { label: 'Kategori Oluştur', action: () => Views.createChannel(g.id, null, 'category') }]);
    };
    // Sürükle-bırak ile kanal sıralama
    if (canManage) {
      let drag = null;
      list.ondragstart = (e) => { drag = e.target.closest('[data-ch]')?.dataset.ch; e.target.closest('.ch')?.classList.add('dragging'); };
      list.ondragend = () => { $$('.ch', list).forEach((x) => x.classList.remove('dragging', 'drop-above', 'drop-below')); };
      list.ondragover = (e) => {
        e.preventDefault();
        $$('.drop-above,.drop-below', list).forEach((x) => x.classList.remove('drop-above', 'drop-below'));
        const t = e.target.closest('.ch');
        if (t) { const r = t.getBoundingClientRect(); t.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-above' : 'drop-below'); }
      };
      list.ondrop = async (e) => {
        e.preventDefault();
        const t = e.target.closest('.ch'), catEl = e.target.closest('[data-ch-drop]');
        if (!drag) return;
        const dragged = this.channelById(drag);
        let parent, siblings;
        if (t) {
          const target = this.channelById(t.dataset.ch);
          parent = target.parent_id || null;
          siblings = byParent(parent).filter((c) => c.id !== drag);
          const r = t.getBoundingClientRect();
          let idx = siblings.findIndex((c) => c.id === target.id);
          if (e.clientY >= r.top + r.height / 2) idx++;
          siblings.splice(idx, 0, dragged);
        } else if (catEl) { parent = catEl.dataset.chDrop; siblings = [...byParent(parent).filter((c) => c.id !== drag), dragged]; }
        else return;
        drag = null;
        await API.post(`/api/guilds/${g.id}/channels/reorder`, { channels: siblings.map((c, i) => ({ id: c.id, position: i, parent_id: parent })) }).catch(errToast);
      };
    }
  },
  renderDMSidebar(el) {
    const dms = [...this.dms.values()].filter((c) => c.last_message_id && (c.type === 'group' || c.last_message_id !== c.id || this.view.channelId === c.id || this.mentions.get(c.id))).sort((a, b) => (b.last_message_id || '').localeCompare(a.last_message_id || ''));
    const reqs = this.incomingRequests();
    el.innerHTML = `
      <div class="side-header" style="cursor:default;padding:0 10px"><button class="search-btn" id="quickSwitch">Sohbet bul ya da başlat <span class="kbd" style="float:right">Ctrl K</span></button></div>
      <div class="side-scroll">
        <div class="nav-item ${!this.view.channelId ? 'active' : ''}" data-nav="friends">${icon('people', 'lg')}<span class="grow">Arkadaşlar</span>${reqs ? `<span class="badge">${reqs}</span>` : ''}</div>
        <div class="nav-item" data-nav="bookmarks">${icon('bookmark', 'lg')}<span>Kaydedilenler</span></div>
        <div class="nav-item" data-nav="why">${icon('sparkle', 'lg')}<span>Ücretsiz Nitro</span><span class="tag brand" style="margin-left:auto;font-size:10px">BEDAVA</span></div>
        <div class="side-section"><span>Direkt Mesajlar</span><button class="icon-btn" id="newDM" data-tip="DM Oluştur">${icon('plus', 'sm')}</button></div>
        ${dms.map((c) => {
          const other = this.dmOther(c);
          const unread = (this.mentions.get(c.id) || 0) > 0;
          const inCall = this.voiceIn(c.id).length > 0;
          return `<div class="dm-item ${this.view.channelId === c.id ? 'active' : ''} ${unread ? 'unread' : ''}" data-dm="${c.id}">
            ${c.type === 'dm' ? avatarHTML(other?.id, 32, true) : groupIconHTML(c, 32)}
            <div class="grow" style="min-width:0"><div class="ellipsis">${esc(this.dmName(c))}</div>
            ${c.type === 'group' ? `<div class="tiny muted">${c.recipients.length} Üye</div>` : other?.custom_status ? `<div class="tiny muted ellipsis">${esc(other.custom_status_emoji || '')} ${esc(other.custom_status)}</div>` : ''}</div>
            ${inCall ? `<span style="color:var(--green)">${icon('phone', 'sm')}</span>` : ''}${unread ? `<span class="badge">${this.mentions.get(c.id)}</span>` : ''}
            <button class="icon-btn close" data-close-dm="${c.id}" style="width:20px;height:20px">${icon('x', 'sm')}</button></div>`;
        }).join('') || '<div class="muted small" style="padding:12px">Henüz kimseyle mesajlaşmadın. Arkadaşlarından birine mesaj at!</div>'}
      </div>`;
    el.onclick = (e) => {
      const close = e.target.closest('[data-close-dm]');
      if (close) { e.stopPropagation(); API.del('/api/dms/' + close.dataset.closeDm).catch(errToast); return; }
      const nav = e.target.closest('[data-nav]');
      if (nav?.dataset.nav === 'friends') this.go('@me');
      if (nav?.dataset.nav === 'bookmarks') Views.bookmarks();
      if (nav?.dataset.nav === 'why') Views.whyYanki();
      const dm = e.target.closest('[data-dm]');
      if (dm) this.go('@me', dm.dataset.dm);
      if (e.target.closest('#newDM')) Views.newDM();
      if (e.target.closest('#quickSwitch')) Views.quickSwitcher();
    };
    el.oncontextmenu = (e) => {
      const dm = e.target.closest('[data-dm]');
      if (!dm) return;
      const c = this.dms.get(dm.dataset.dm), other = this.dmOther(c);
      if (other) Views.userMenu(e, other.id);
      else ctxMenu(e, [{ label: 'Grubu Yeniden Adlandır', action: async () => { const n = await promptModal('Grubu Yeniden Adlandır', 'Grup adı', c.name || ''); if (n !== null) API.patch('/api/channels/' + c.id, { name: n }).catch(errToast); } }, '-', { label: 'Gruptan Ayrıl', danger: true, action: () => API.del('/api/dms/' + c.id).catch(errToast) }]);
    };
  },

  // ─── Kullanıcı & ses paneli ───
  renderUserPanel() {
    const el = $('#userPanel');
    if (!el || !this.me) return;
    const u = this.me;
    const st = { online: 'Çevrimiçi', idle: 'Boşta', dnd: 'Rahatsız Etmeyin', invisible: 'Görünmez' }[u.status_setting] || 'Çevrimiçi';
    el.innerHTML = `
      <div class="me" id="meBtn">${avatarHTML(u.id, 32, true)}<div style="min-width:0"><div class="name ellipsis">${esc(u.display_name)}</div><div class="tagline ellipsis">${u.custom_status ? esc((u.custom_status_emoji || '') + ' ' + u.custom_status) : st}</div></div></div>
      <button class="icon-btn ${Voice.muted || Voice.serverMuted ? 'danger-on' : ''}" id="muteBtn" data-tip="${Voice.muted ? 'Sesi Aç' : 'Sustur'}">${icon(Voice.muted || Voice.serverMuted ? 'micOff' : 'mic')}</button>
      <button class="icon-btn ${Voice.deafened ? 'danger-on' : ''}" id="deafBtn" data-tip="${Voice.deafened ? 'Sağırlaştırmayı Kaldır' : 'Sağırlaştır'}">${icon('headphones')}</button>
      <button class="icon-btn" id="setBtn" data-tip="Kullanıcı Ayarları">${icon('gear')}</button>`;
    $('#muteBtn').onclick = () => { if (Voice.connected) Voice.toggleMute(); else { Voice.muted = !Voice.muted; Voice.muted ? Sound.mute() : Sound.unmute(); this.renderUserPanel(); } };
    $('#deafBtn').onclick = () => { if (Voice.connected) Voice.toggleDeafen(); else { Voice.deafened = !Voice.deafened; Voice.muted = Voice.deafened; Voice.deafened ? Sound.mute() : Sound.unmute(); this.renderUserPanel(); } };
    $('#setBtn').onclick = () => UserSettings.open();
    $('#meBtn').onclick = (e) => Views.statusMenu(e, $('#meBtn'));
    this.renderVoicePanel();
  },
  renderVoicePanel() {
    const el = $('#voicePanel');
    if (!el) return;
    if (!Voice.connected) { el.innerHTML = ''; el.className = ''; return; }
    const ch = this.channelById(Voice.channelId);
    const g = ch?.guild_id && this.guilds.get(ch.guild_id);
    const ping = Voice.ping;
    el.className = 'voice-panel';
    el.innerHTML = `
      <div class="row"><div class="grow" style="min-width:0">
        <div class="conn ${ping > 250 ? 'bad' : ''}" data-tip="${ping != null ? 'Gecikme: ' + ping + ' ms' : 'Bağlantı kuruldu'}">${icon('signal', 'sm')} Ses Bağlandı ${ping != null ? `<span class="tiny muted" style="font-weight:500">${ping} ms</span>` : ''}</div>
        <div class="where ellipsis" id="vpWhere">${ch ? (g ? esc(ch.name) + ' / ' + esc(g.name) : esc(this.dmName(ch))) : ''}</div></div>
        <button class="icon-btn" id="vpLeave" data-tip="Bağlantıyı Kes">${icon('hangup')}</button></div>
      <div class="vbtns">
        <button class="${Voice.cam ? 'on' : ''}" id="vpCam" data-tip="Kamera">${icon('video')}</button>
        <button class="${Voice.screen ? 'on' : ''}" id="vpScreen" data-tip="Ekran Paylaş / Yayın Aç">${icon('screen')}</button>
        <button id="vpBoard" data-tip="Ses Efektleri">${icon('music')}</button>
        <button id="vpSet" data-tip="Ses Ayarları">${icon('gear')}</button>
      </div>
      ${Voice.settings.ptt ? `<div class="tiny muted" style="margin-top:6px;text-align:center">Bas-Konuş: <span class="kbd">${esc(Voice.settings.pttLabel)}</span> ${Voice.pttDown ? '🎙️ konuşuyorsun' : ''}</div>` : ''}`;
    $('#vpLeave').onclick = () => Voice.leave();
    $('#vpWhere').onclick = () => ch && this.go(ch.guild_id || '@me', ch.id);
    $('#vpCam').onclick = () => Voice.toggleCamera();
    $('#vpScreen').onclick = (e) => Views.screenMenu(e, $('#vpScreen'));
    $('#vpBoard').onclick = (e) => Views.soundboard(e, $('#vpBoard'));
    $('#vpSet').onclick = () => UserSettings.open('voice');
  },
  onVoiceChange() { this.renderUserPanel(); this.renderSidebar(); this.renderGuilds(); Views.refreshVoice(); },
  onVoiceMedia() { Views.refreshVoice(); },
  setSpeaking(uid, on) {
    $$(`[data-speak="${uid}"]`).forEach((e) => e.classList.toggle('speaking', on));
    $$(`.vc-user[data-vu="${uid}"] .ellipsis`).forEach((e) => (e.style.color = on ? 'var(--text-strong)' : ''));
  },
  needsAudioUnlock() {
    if ($('#audioUnlock')) return;
    const b = h('<button id="audioUnlock" class="btn" style="position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:300">🔊 Sesi duymak için tıkla</button>');
    b.onclick = () => { $$('audio').forEach((a) => a.play().catch(() => {})); Voice.audioCtx?.resume(); b.remove(); };
    document.body.append(b);
  },
  bindShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); Views.quickSwitcher(); }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm') { e.preventDefault(); $('#muteBtn')?.click(); }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') { e.preventDefault(); $('#deafBtn')?.click(); }
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        const g = this.guild; if (!g) return;
        const chs = g.channels.filter((c) => c.type === 'text' || c.type === 'announcement');
        const i = chs.findIndex((c) => c.id === this.view.channelId);
        const n = chs[(i + (e.key === 'ArrowUp' ? -1 : 1) + chs.length) % chs.length];
        if (n) { e.preventDefault(); this.go(g.id, n.id); }
      }
    });
  },
};

// ─── Ortak HTML yardımcıları ───
function guildAcronym(n) { return n.split(/\s+/).map((w) => [...w][0] || '').join('').slice(0, 4); }
function avatarHTML(uid, size = 40, withStatus = false, speakKey) {
  const u = App.user(uid) || { id: uid || '0', username: '?', display_name: '?' };
  const inner = u.avatar ? `<img src="${esc(u.avatar)}" alt="" loading="lazy" draggable="false">` : `<div class="av-fallback" style="background:${u.accent_color || avatarColor(u.id)};font-size:${Math.round(size * 0.42)}px">${esc([...(u.display_name || u.username || '?')][0]?.toUpperCase() || '?')}</div>`;
  const st = withStatus ? `<span class="status ${u.status || 'offline'}" ${u.status === 'dnd' ? 'data-tip="Rahatsız Etmeyin"' : ''}></span>` : '';
  return `<span class="avatar" data-av="${u.id}" data-size="${size}" data-st="${withStatus ? 1 : 0}" ${u.decoration && size >= 24 ? `data-deco="${esc(u.decoration)}"` : ''} ${speakKey ? `data-speak="${speakKey}"` : ''} style="width:${size}px;height:${size}px">${inner}${st}</span>`;
}
function groupIconHTML(c, size) {
  if (c.icon) return `<span class="avatar" style="width:${size}px;height:${size}px"><img src="${esc(c.icon)}"></span>`;
  return `<span class="avatar" style="width:${size}px;height:${size}px"><div class="av-fallback" style="background:${avatarColor(c.id)}">${icon('people', size > 40 ? 'lg' : '')}</div></span>`;
}
const NAME_FONTS = { '': 'Varsayılan', bangers: 'Bangers', pacifico: 'Pacifico', press: 'Press Start 2P', orbitron: 'Orbitron', caveat: 'Caveat', lobster: 'Lobster' };
const FONT_CSS = { bangers: "'Bangers', cursive", pacifico: "'Pacifico', cursive", press: "'Press Start 2P', monospace", orbitron: "'Orbitron', sans-serif", caveat: "'Caveat', cursive", lobster: "'Lobster', cursive" };
function nameStyle(uid, roleColor) {
  const u = App.user(uid) || {};
  let st = '';
  let cls = 'styled-name';
  if (u.name_font && FONT_CSS[u.name_font]) st += `font-family:${FONT_CSS[u.name_font]};${u.name_font === 'press' ? 'font-size:.75em;' : ''}`;
  if (u.name_color && u.name_color2) { st += `background-image:linear-gradient(90deg,${u.name_color},${u.name_color2},${u.name_color});`; cls += ' grad anim'; }
  else if (u.name_color) st += `color:${u.name_color};`;
  else if (roleColor) st += `color:${roleColor};`;
  return { st, cls };
}
function nameHTML(uid, gid, extraCls = '') {
  const { st, cls } = nameStyle(uid, gid && App.roleColor(gid, uid));
  return `<span class="${cls} ${extraCls}" style="${st}" data-user="${uid}">${esc(App.displayName(uid, gid))}</span>`;
}
function applyAppearance() {
  const s = JSON.parse(localStorage.getItem('yanki_appearance') || '{}');
  document.documentElement.dataset.theme = s.theme || 'dark';
  document.documentElement.dataset.compact = s.compact ? '1' : '0';
  document.documentElement.dataset.fontsize = s.fontSize || 'normal';
  if (s.accent) document.documentElement.style.setProperty('--brand', s.accent); else document.documentElement.style.removeProperty('--brand');
}

window.addEventListener('DOMContentLoaded', () => App.boot());
