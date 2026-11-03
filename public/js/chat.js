// ════════ Sohbet ════════
'use strict';
const QUICK_REACTS = ['👍', '😂', '❤️'];
const SLASH = [
  { name: 'zar', desc: 'Zar at (örn. /zar 20)', server: true }, { name: 'yazitura', desc: 'Yazı tura at', server: true },
  { name: '8top', desc: 'Sihirli 8 topa soru sor', server: true }, { name: 'sec', desc: 'Seçenekler arasından seç: /sec a, b, c', server: true },
  { name: 'anket', desc: 'Anket oluştur' }, { name: 'zamanla', desc: 'Mesajı ileri bir tarihte gönder' }, { name: 'sureli', desc: 'Kendini imha eden mesaj gönder' },
  { name: 'shrug', desc: '¯\\_(ツ)_/¯ ekler' }, { name: 'tableflip', desc: '(╯°□°)╯︵ ┻━┻' }, { name: 'unflip', desc: '┬─┬ノ( º _ ºノ)' },
  { name: 'me', desc: 'Eylem mesajı (italik)' }, { name: 'spoiler', desc: 'Mesajı spoiler olarak gönder' }, { name: 'nick', desc: 'Bu sunucudaki takma adını değiştir' },
];
const EXPIRE_OPTS = [[0, 'Kapalı'], [30, '30 saniye'], [300, '5 dakika'], [3600, '1 saat'], [86400, '1 gün'], [604800, '1 hafta']];

const Chat = {
  reply: null, editing: null, files: [], expiresIn: 0, lastTyping: 0, unreadMarker: null, ackTimer: null, loading: new Set(),

  render(ch) {
    const main = $('#main');
    const isDM = !ch.guild_id;
    if (this.noAckUntilLeave && this.noAckUntilLeave !== ch.id) this.noAckUntilLeave = null;
    this.unreadMarker = this.isAtLatest(ch) ? (App.readStates[ch.id] || null) : null;
    this.files = []; this.expiresIn = 0;
    main.innerHTML = `<div class="main-header" id="mainHeader"></div>
      <div class="main-body"><div class="chat" id="chat">
        ${isDM ? '<div id="dmCall"></div>' : ''}
        <div class="messages" id="msgs"></div>
        <div class="composer-wrap" id="composerWrap"></div></div>
        <div id="sidePanel" class="hidden"></div><aside class="members" id="members"></aside></div>`;
    Views.refreshHeader();
    Views.renderMembers();
    this.renderComposer();
    if (isDM) Views.refreshVoice();
    const arr = this.messages(ch.id);
    if (arr) { this.renderMessages(true); this.ackCurrent(); }
    else { $('#msgs').innerHTML = '<div class="empty"><div class="spinner"></div></div>'; this.load(ch.id).then(() => { if (App.view.channelId === ch.id) { this.renderMessages(true); this.ackCurrent(); } }); }
    this.bindMessages();
    this.bindDrop();
    if (App.panel) Views.openPanel(App.panel.type, App.panel.arg);
  },
  messages(cid) { return App.messages.get(cid); },
  isAtLatest(ch) { return !App.detached.has(ch.id); },
  async load(cid, before) {
    if (this.loading.has(cid)) return;
    this.loading.add(cid);
    try {
      const rows = await API.get(`/api/channels/${cid}/messages?limit=50${before ? '&before=' + before : ''}`);
      const arr = before ? [...rows, ...(App.messages.get(cid) || [])] : rows;
      App.messages.set(cid, arr);
      App.hasMore.set(cid, rows.length === 50);
      for (const m of rows) App.cacheUser(m.author);
    } catch (e) { errToast(e); } finally { this.loading.delete(cid); }
  },
  async jumpTo(cid, mid) {
    const ch = App.channelById(cid);
    if (!ch) return toast('Bu mesaja erişimin yok', 'err');
    const rows = await API.get(`/api/channels/${cid}/messages?around=${mid}&limit=50`).catch(errToast);
    if (!rows) return;
    App.messages.set(cid, rows); App.hasMore.set(cid, true);
    if (rows.length && rows[rows.length - 1].id !== ch.last_message_id) App.detached.add(cid); else App.detached.delete(cid);
    if (App.view.channelId !== cid) App.go(ch.guild_id || '@me', cid); else this.renderMessages();
    requestAnimationFrame(() => { const el = $(`.message[data-id="${mid}"]`); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('highlight'); setTimeout(() => el.classList.remove('highlight'), 2000); } });
  },
  async jumpPresent() { const cid = App.view.channelId; App.detached.delete(cid); App.messages.delete(cid); await this.load(cid); this.renderMessages(true); },

  // ─── Mesaj HTML ───
  isMention(m) {
    if (m.author.id === App.me.id) return false;
    const c = m.content || '';
    if (c.includes(`<@${App.me.id}>`) || /(^|\s)@(everyone|here)\b/.test(c)) return true;
    if (m.reply_to?.author?.id === App.me.id) return true;
    const ch = App.channelById(m.channel_id), mem = ch?.guild_id && App.member(ch.guild_id, App.me.id);
    return !!mem?.roles.some((r) => c.includes(`<@&${r}>`));
  },
  msgHTML(m, prev, gid) {
    const ctx = App.mdCtx(gid);
    if (m.type !== 'default') {
      const ic = m.type === 'join' ? `<span class="sys-icon">→</span>` : m.type === 'pin' ? `<span class="sys-icon" style="color:var(--text-muted)">${icon('pin', 'sm')}</span>` : `<span class="sys-icon" style="color:var(--brand)">${icon('sparkle', 'sm')}</span>`;
      return `<div class="message system head" data-id="${m.id}">${ic}<span class="m-body">${renderMarkdown(m.content, ctx)}</span> <span class="m-time">${fmtDate(m.created_at)}</span></div>`;
    }
    const grouped = prev && prev.type === 'default' && prev.author.id === m.author.id && !m.reply_to && m.created_at - prev.created_at < 7 * 60000 && new Date(prev.created_at).toDateString() === new Date(m.created_at).toDateString();
    const uid = m.author.id;
    const mine = uid === App.me.id;
    let body = m.content ? `<div class="m-body ${isJumbo(m.content) ? 'jumbo' : ''}">${renderMarkdown(m.content, ctx)}${m.edited_at ? `<span class="edited" data-tip="${fmtFull(m.edited_at)}">(düzenlendi)</span>` : ''}${m.expires_at ? `<span class="m-expire" data-exp="${m.expires_at}">${icon('timer', 'sm')}${fmtLeft(m.expires_at - Date.now())}</span>` : ''}</div>` : (m.expires_at ? `<span class="m-expire" data-exp="${m.expires_at}">${icon('timer', 'sm')}${fmtLeft(m.expires_at - Date.now())}</span>` : '');
    body += this.attachHTML(m) + this.embedHTML(m) + (m.poll ? this.pollHTML(m) : '') + this.reactHTML(m);
    const reply = m.reply_to ? (m.reply_to.deleted ? `<div class="m-reply"><span class="muted"><i>Orijinal mesaj silindi</i></span></div>` : `<div class="m-reply" data-jump="${m.reply_to.id}">${avatarHTML(m.reply_to.author.id, 16)}<b style="color:${App.roleColor(gid, m.reply_to.author.id) || ''}">@${esc(App.displayName(m.reply_to.author.id, gid))}</b><span class="ellipsis">${m.reply_to.content ? esc(plainPreview(m.reply_to.content, ctx)).slice(0, 200) : '<i>Eki görmek için tıkla</i>'}</span></div>`) : '';
    const actions = `<div class="m-actions">${QUICK_REACTS.map((e) => `<button data-qr="${e}" data-tip="${e} ile tepki ver">${e}</button>`).join('')}<button data-act="react" data-tip="Tepki Ekle">${icon('smile')}</button><button data-act="reply" data-tip="Yanıtla">${icon('reply')}</button>${mine ? `<button data-act="edit" data-tip="Düzenle">${icon('edit')}</button>` : ''}<button data-act="more" data-tip="Diğer">${icon('more')}</button></div>`;
    const cls = `message ${grouped ? '' : 'head'} ${this.isMention(m) ? 'mention' : ''} ${m.reply_to ? 'has-reply' : ''} ${this.reply?.id === m.id ? 'replying' : ''}`;
    if (grouped) return `<div class="${cls}" data-id="${m.id}" data-author="${uid}"><span class="m-side" data-tip="${fmtFull(m.created_at)}">${fmtTime(m.created_at)}</span>${body}${actions}</div>`;
    const deco = App.user(uid);
    return `<div class="${cls}" data-id="${m.id}" data-author="${uid}">${reply}<span class="m-av" data-user="${uid}">${avatarHTML(uid, 40, false, uid)}</span>
      <div class="m-head">${nameHTML(uid, gid, 'm-name')}${deco?.custom_status_emoji && false ? '' : ''}<span class="m-time" data-tip="${fmtFull(m.created_at)}">${fmtDate(m.created_at)}</span></div>${body}${actions}</div>`;
  },
  attachHTML(m) {
    if (!m.attachments?.length) return '';
    return `<div class="attachments">${m.attachments.map((a) => {
      const sp = a.spoiler;
      let inner;
      if (/^image\//.test(a.type)) inner = `<img class="att-img" src="${esc(a.url)}" alt="${esc(a.name)}" loading="lazy" data-full="${esc(a.url)}">`;
      else if (/^video\//.test(a.type)) inner = `<video class="att-video" src="${esc(a.url)}" controls preload="metadata"></video>`;
      else if (/^audio\//.test(a.type)) inner = `<div class="att-file" style="flex-direction:column;align-items:stretch"><div class="row">${icon('music')}<a href="${esc(a.url)}" target="_blank" class="ellipsis">${esc(a.name)}</a></div><audio class="att-audio" src="${esc(a.url)}" controls preload="none"></audio></div>`;
      else { const ext = (a.name.split('.').pop() || 'dosya').slice(0, 4).toUpperCase(); inner = `<div class="att-file"><div class="fi">${esc(ext)}</div><div class="grow" style="min-width:0"><a href="${esc(a.url)}" target="_blank" download="${esc(a.name)}" class="ellipsis" style="display:block">${esc(a.name)}</a><div class="tiny muted">${fmtSize(a.size || 0)}</div></div><a class="icon-btn" href="${esc(a.url)}" download="${esc(a.name)}" data-tip="İndir">${icon('download')}</a></div>`; }
      return sp ? `<div class="spoiler-wrap hidden-sp">${inner}</div>` : inner;
    }).join('')}</div>`;
  },
  embedHTML(m) {
    if (!m.content) return '';
    const out = [];
    const yt = m.content.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/);
    if (yt) out.push(`<div class="embed" style="border-color:#ff0000"><div class="e-title">YouTube</div><iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}" allowfullscreen loading="lazy" allow="autoplay; encrypted-media; picture-in-picture"></iframe></div>`);
    const imgs = [...m.content.matchAll(/https?:\/\/\S+?\.(?:gif|png|jpe?g|webp)(?:\?\S*)?(?=\s|$)/gi)].slice(0, 3);
    for (const im of imgs) out.push(`<img class="att-img" src="${esc(im[0])}" loading="lazy" data-full="${esc(im[0])}" referrerpolicy="no-referrer" style="margin-top:4px">`);
    const tenor = m.content.match(/https?:\/\/(?:media\.)?tenor\.com\/\S+/);
    if (tenor && !imgs.length) out.push(`<div class="embed"><a href="${esc(tenor[0])}" target="_blank">Tenor GIF</a></div>`);
    return out.join('');
  },
  pollHTML(m) {
    const p = m.poll, total = new Set(p.options.flatMap((o) => o.votes)).size;
    const ended = p.ends_at && p.ends_at < Date.now();
    const maxVotes = Math.max(...p.options.map((o) => o.votes.length));
    return `<div class="poll ${p.multi ? 'multi' : ''}" data-poll="${m.id}"><div class="row"><span style="color:var(--brand)">${icon('poll')}</span><div class="q grow">${esc(p.question || 'Anket')}</div></div>
      <div class="tiny muted">${p.multi ? 'Birden fazla seçenek seçebilirsin' : 'Bir seçenek seç'}</div>
      ${p.options.map((o, i) => { const pct = total ? Math.round((o.votes.length / total) * 100) : 0; const mine = o.votes.includes(App.me.id); return `<div class="opt ${mine ? 'mine' : ''}" data-opt="${i}"><div class="bar" style="width:${pct}%"></div><span class="chk"></span><span class="grow">${esc(o.text)} ${ended && o.votes.length === maxVotes && maxVotes > 0 ? '🏆' : ''}</span><span class="pct">${pct}% <span class="muted tiny">(${o.votes.length})</span></span></div>`; }).join('')}
      <div class="tiny muted" style="margin-top:10px">${total} oy · ${ended ? 'Anket sona erdi' : p.ends_at ? fmtLeft(p.ends_at - Date.now()) + ' kaldı' : 'Süresiz'}</div></div>`;
  },
  reactHTML(m) {
    if (!m.reactions?.length) return '';
    return `<div class="reactions">${m.reactions.map((r) => {
      const me = r.users.includes(App.me.id);
      const names = r.users.slice(0, 5).map((u) => App.displayName(u)).join(', ') + (r.users.length > 5 ? ` ve ${r.users.length - 5} kişi daha` : '');
      return `<span class="reaction ${me ? 'me' : ''}" data-emoji="${esc(r.emoji)}" data-tip="${esc(names)} tepki verdi">${emojiHTML(r.emoji)}<span class="cnt">${r.users.length}</span></span>`;
    }).join('')}<span class="reaction" data-act="react" data-tip="Tepki Ekle" style="opacity:.6">${icon('smile', 'sm')}+</span></div>`;
  },

  renderMessages(scrollBottom) {
    const ch = App.channel, el = $('#msgs');
    if (!ch || !el) return;
    const arr = this.messages(ch.id) || [];
    const gid = ch.guild_id;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    let html = '';
    if (!App.hasMore.get(ch.id)) html += this.introHTML(ch);
    else html += '<div class="empty" style="padding:20px"><div class="spinner" style="width:24px;height:24px"></div></div>';
    let prev = null, newShown = false;
    for (const m of arr) {
      if (!prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString()) { html += `<div class="day-sep"><span>${fmtDay(m.created_at)}</span></div>`; prev = null; }
      if (!newShown && this.unreadMarker && m.id > this.unreadMarker && m.author.id !== App.me.id) { html += '<div class="new-sep"><span>YENİ</span></div>'; newShown = true; prev = null; }
      html += this.msgHTML(m, prev, gid);
      prev = m;
    }
    el.innerHTML = html;
    if (App.detached.has(ch.id)) {
      $('#composerWrap .jump-bar')?.remove();
      const jb = h(`<div class="jump-bar"><span>Eski mesajları görüntülüyorsun</span><span>Şimdiye Dön ↓</span></div>`);
      jb.onclick = () => this.jumpPresent();
      $('#composerWrap')?.prepend(jb);
    } else $('#composerWrap .jump-bar')?.remove();
    if (scrollBottom || atBottom) {
      el.scrollTop = el.scrollHeight;
      // Resimler yüklendikçe en altta kal
      $$('img', el).forEach((img) => { if (!img.complete) img.addEventListener('load', () => { if (this.stick) el.scrollTop = el.scrollHeight; }, { once: true }); });
      this.stick = true;
    }
  },
  introHTML(ch) {
    if (!ch.guild_id) {
      const other = App.dmOther(ch);
      if (other) return `<div class="msg-intro">${avatarHTML(other.id, 80)}<h2>${esc(App.displayName(other.id))}</h2><div style="font-size:20px;font-weight:600;color:var(--text-strong);margin-bottom:8px">${esc(other.username)}</div><p class="muted">Bu, <b>${esc(App.displayName(other.id))}</b> ile olan direkt mesaj geçmişinin başlangıcı.</p>
        <div class="row">${App.rels.get(other.id)?.type === 1 ? '<button class="btn secondary sm" data-intro="unfriend">Arkadaşı Çıkar</button>' : App.rels.get(other.id)?.type === 4 ? '<button class="btn sm" disabled>İstek Gönderildi</button>' : '<button class="btn sm" data-intro="friend">Arkadaş Ekle</button>'}<button class="btn secondary sm" data-intro="block">${App.rels.get(other.id)?.type === 2 ? 'Engeli Kaldır' : 'Engelle'}</button></div></div>`;
      return `<div class="msg-intro">${groupIconHTML(ch, 80)}<h2>${esc(App.dmName(ch))}</h2><p class="muted"><b>${esc(App.dmName(ch))}</b> grubunun başlangıcına hoş geldin.</p></div>`;
    }
    return `<div class="msg-intro"><div class="big">${icon(ch.type === 'announcement' ? 'megaphone' : 'hash', 'lg').replace('icon lg', 'icon" style="width:42px;height:42px')}</div><h2>#${esc(ch.name)} kanalına hoş geldin!</h2><p class="muted">Bu, #${esc(ch.name)} kanalının başlangıcı. ${ch.topic ? esc(ch.topic) : ''}</p>${App.can('MANAGE_CHANNELS', ch.guild_id) ? `<button class="btn ghost sm" style="padding-left:0;color:var(--link)" data-intro="editch">${icon('edit', 'sm')} Kanalı Düzenle</button>` : ''}</div>`;
  },
  rerenderOne(m) {
    const el = $(`.message[data-id="${m.id}"]`);
    if (!el) return;
    const arr = this.messages(m.channel_id) || [];
    const i = arr.findIndex((x) => x.id === m.id);
    const prevEl = el.previousElementSibling;
    const prev = prevEl?.classList.contains('message') ? arr[i - 1] : null;
    const n = h(this.msgHTML(m, prev, App.channel?.guild_id));
    el.replaceWith(n);
  },

  // ─── Etkileşimler ───
  bindMessages() {
    const el = $('#msgs');
    el.onscroll = debounce(async () => {
      this.stick = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      const ch = App.channel;
      if (!ch || el.scrollTop > 300 || !App.hasMore.get(ch.id) || this.loading.has(ch.id)) return;
      const arr = this.messages(ch.id);
      const h0 = el.scrollHeight;
      await this.load(ch.id, arr[0]?.id);
      if (App.view.channelId !== ch.id) return;
      this.renderMessages();
      el.scrollTop = el.scrollHeight - h0 + el.scrollTop;
    }, 80);
    el.onclick = async (e) => {
      const t = e.target;
      const msgEl = t.closest('.message'), mid = msgEl?.dataset.id;
      const m = mid && this.find(mid);
      const intro = t.closest('[data-intro]');
      if (intro) {
        const other = App.dmOther(App.channel), a = intro.dataset.intro;
        if (a === 'friend') API.put('/api/relationships/' + other.id).then(() => toast('Arkadaşlık isteği gönderildi', 'ok')).catch(errToast);
        if (a === 'unfriend') API.del('/api/relationships/' + other.id).catch(errToast);
        if (a === 'block') (App.rels.get(other.id)?.type === 2 ? API.del('/api/relationships/' + other.id) : API.post(`/api/relationships/${other.id}/block`)).catch(errToast);
        if (a === 'editch') GuildSettings.openChannel(App.channel.id);
        setTimeout(() => this.renderMessages(), 300);
        return;
      }
      if (t.closest('.spoiler')) return t.closest('.spoiler').classList.toggle('shown');
      const sw = t.closest('.spoiler-wrap.hidden-sp'); if (sw) { sw.classList.remove('hidden-sp'); return; }
      const userEl = t.closest('[data-user]'); if (userEl) return Views.profile(userEl.dataset.user, userEl, App.channel?.guild_id);
      const chEl = t.closest('[data-channel]'); if (chEl) { const c = App.channelById(chEl.dataset.channel); if (c) App.go(c.guild_id, c.id); return; }
      const img = t.closest('.att-img'); if (img) return Views.lightbox(img.dataset.full);
      const jump = t.closest('[data-jump]'); if (jump) return this.jumpTo(App.view.channelId, jump.dataset.jump);
      if (!m) return;
      const opt = t.closest('[data-opt]'); if (opt) return API.post(`/api/messages/${m.id}/vote`, { option: +opt.dataset.opt }).catch(errToast);
      const qr = t.closest('[data-qr]'); if (qr) return this.toggleReact(m, qr.dataset.qr);
      const rx = t.closest('.reaction[data-emoji]'); if (rx) { rx.classList.add('pop'); return this.toggleReact(m, rx.dataset.emoji); }
      const act = t.closest('[data-act]')?.dataset.act;
      if (act === 'react') { msgEl.querySelector('.m-actions')?.classList.add('open'); Pickers.emoji(t.closest('[data-act]'), (em) => this.toggleReact(m, em, true)); }
      if (act === 'reply') this.startReply(m);
      if (act === 'edit') this.startEdit(m);
      if (act === 'more') this.messageMenu(e, m, t.closest('[data-act]'));
    };
    el.oncontextmenu = (e) => {
      const msgEl = e.target.closest('.message');
      if (e.target.closest('[data-user]') && !msgEl?.contains(e.target.closest('.m-body'))) return Views.userMenu(e, e.target.closest('[data-user]').dataset.user, App.channel?.guild_id);
      if (e.target.closest('a, img, video')) return;
      const m = msgEl && this.find(msgEl.dataset.id);
      if (m && m.type === 'default') this.messageMenu(e, m);
    };
    el.ondblclick = (e) => { const msgEl = e.target.closest('.message'); const m = msgEl && this.find(msgEl.dataset.id); if (m?.author.id === App.me.id && !e.target.closest('.m-actions,.reaction,.poll')) this.startEdit(m); };
  },
  find(id) { return (this.messages(App.view.channelId) || []).find((m) => m.id === id) || App.panelMessages?.get(id); },
  toggleReact(m, emoji, forceAdd) {
    const r = m.reactions.find((x) => x.emoji === emoji);
    const has = r?.users.includes(App.me.id);
    const url = `/api/messages/${m.id}/reactions/${encodeURIComponent(emoji)}`;
    (has && !forceAdd ? API.del(url) : API.put(url)).catch(errToast);
  },
  messageMenu(e, m, anchor) {
    const ch = App.channelById(m.channel_id);
    const mine = m.author.id === App.me.id;
    const canManage = ch.guild_id ? App.can('MANAGE_MESSAGES', ch.guild_id) : true;
    const link = `${location.origin}/app/${ch.guild_id || '@me'}/${ch.id}?m=${m.id}`;
    ctxMenu(e, [
      { label: 'Tepki Ekle', icon: 'smile', action: () => Pickers.emoji(anchor || $(`.message[data-id="${m.id}"]`), (em) => this.toggleReact(m, em, true)) },
      mine && { label: 'Mesajı Düzenle', icon: 'edit', action: () => this.startEdit(m) },
      { label: 'Yanıtla', icon: 'reply', action: () => this.startReply(m) },
      canManage && { label: m.pinned ? 'Sabitlemeyi Kaldır' : 'Mesajı Sabitle', icon: 'pin', action: () => API.put(`/api/messages/${m.id}/pin`, { pinned: !m.pinned }).then(() => toast(m.pinned ? 'Sabitleme kaldırıldı' : 'Mesaj sabitlendi', 'ok')).catch(errToast) },
      { label: 'Mesajı Kaydet', icon: 'bookmark', action: () => API.put('/api/bookmarks/' + m.id).then(() => toast('Kaydedilenlere eklendi 🔖', 'ok')).catch(errToast) },
      { label: 'Okunmamış Olarak İşaretle', icon: 'bell', action: () => { const arr = this.messages(ch.id); const i = arr.findIndex((x) => x.id === m.id); const prevId = arr[i - 1]?.id || '0'; App.readStates[ch.id] = prevId; API.post(`/api/channels/${ch.id}/ack`, { message_id: prevId }); this.unreadMarker = prevId; this.renderMessages(); App.renderSidebar(); this.noAckUntilLeave = ch.id; } },
      m.content && { label: 'Metni Kopyala', icon: 'copy', action: () => copyText(m.content) },
      { label: 'Mesaj Bağlantısını Kopyala', icon: 'link', action: () => copyText(link) },
      m.content && { label: 'Sesli Oku', icon: 'speaker', action: () => { const u = new SpeechSynthesisUtterance(plainPreview(m.content, App.mdCtx(ch.guild_id))); u.lang = 'tr-TR'; speechSynthesis.speak(u); } },
      '-',
      (mine || canManage) && { label: 'Mesajı Sil', icon: 'trash', danger: true, action: async () => { if (e.shiftKey || await confirmModal('Mesajı Sil', 'Bu mesajı silmek istediğinden emin misin? <br><span class="tiny muted">İpucu: Shift basılıyken silersen onay sorulmaz.</span>', 'Sil')) API.del('/api/messages/' + m.id).catch(errToast); } },
      { label: 'Kimliği Kopyala', action: () => copyText(m.id) },
    ], anchor);
  },
  startReply(m) { this.reply = m; this.editing = null; this.renderComposer(); $('#composer')?.focus(); $$('.message.replying').forEach((x) => x.classList.remove('replying')); $(`.message[data-id="${m.id}"]`)?.classList.add('replying'); },
  startEdit(m) {
    const el = $(`.message[data-id="${m.id}"]`);
    if (!el) return;
    const body = el.querySelector('.m-body') || h('<div class="m-body"></div>');
    if (!body.parentNode) el.querySelector('.m-head')?.after(body) || el.prepend(body);
    const wrap = h(`<div class="edit-wrap"><div class="composer" style="margin:6px 0"><div class="composer-row"><textarea rows="1" style="padding:10px"></textarea></div></div><div class="tiny muted">kaydetmek için <a href="#" data-save>enter</a> • iptal için <a href="#" data-cancel>escape</a></div></div>`);
    const ta = wrap.querySelector('textarea');
    ta.value = m.content;
    body.replaceWith(wrap);
    autoGrow(ta); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    const done = () => this.rerenderOne(m);
    const save = async () => {
      const v = ta.value.trim();
      if (v === m.content) return done();
      if (!v && !m.attachments.length) { done(); return confirmModal('Mesajı Sil', 'Boş mesaj kaydedilemez. Silmek ister misin?', 'Sil').then((ok) => ok && API.del('/api/messages/' + m.id)); }
      API.patch('/api/messages/' + m.id, { content: v }).catch((er) => { errToast(er); done(); });
    };
    ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === 'Escape') { e.stopPropagation(); done(); } };
    ta.oninput = () => autoGrow(ta);
    wrap.querySelector('[data-save]').onclick = (e) => { e.preventDefault(); save(); };
    wrap.querySelector('[data-cancel]').onclick = (e) => { e.preventDefault(); done(); };
  },

  // ─── Mesaj yazma alanı ───
  renderComposer() {
    const wrap = $('#composerWrap'), ch = App.channel;
    if (!wrap || !ch) return;
    let canSend = true, reason = '';
    if (ch.guild_id) {
      if (!App.can('SEND', ch.guild_id)) { canSend = false; reason = 'Bu kanalda mesaj gönderme iznin yok.'; }
      if (ch.type === 'announcement' && !App.can('MANAGE_MESSAGES', ch.guild_id)) { canSend = false; reason = 'Bu bir duyuru kanalı — sadece moderatörler yazabilir.'; }
    } else if (ch.type === 'dm') {
      const o = App.dmOther(ch);
      if (o && App.rels.get(o.id)?.type === 2) { canSend = false; reason = 'Bu kullanıcıyı engelledin. Mesaj göndermek için engeli kaldır.'; }
    }
    const placeholder = ch.guild_id ? `#${ch.name} kanalına mesaj gönder` : `@${App.dmName(ch)} kişisine mesaj gönder`;
    const prevVal = $('#composer')?.value || this.drafts[ch.id] || '';
    wrap.innerHTML = `<div class="autocomplete hidden" id="ac"></div>
      <div class="composer">
        ${this.reply ? `<div class="composer-top"><span class="grow">${esc(App.displayName(this.reply.author.id, ch.guild_id))} kişisine yanıt veriliyor</span><button class="icon-btn" id="cancelReply" style="width:22px;height:22px">${icon('x', 'sm')}</button></div>` : ''}
        ${this.expiresIn ? `<div class="composer-top" style="color:var(--yellow)">${icon('timer', 'sm')}<span class="grow">Süreli mesaj: <b style="color:var(--yellow)">${EXPIRE_OPTS.find((x) => x[0] === this.expiresIn)?.[1]}</b> sonra kendini imha edecek</span><button class="icon-btn" id="cancelExp" style="width:22px;height:22px">${icon('x', 'sm')}</button></div>` : ''}
        ${this.files.length ? `<div class="composer-files">${this.files.map((f, i) => `<div class="cf"><div class="prev">${f.type.startsWith('image/') ? `<img src="${f.preview}">` : f.type.startsWith('video/') ? `<video src="${f.preview}" muted></video>` : `<div style="font-size:40px">📄</div>`}</div><div class="nm ellipsis">${esc(f.name)}</div><div class="tiny muted">${fmtSize(f.size)}</div><div class="x row" style="gap:0"><button class="icon-btn" data-spoil="${i}" data-tip="Spoiler olarak işaretle" style="${f.spoiler ? 'color:var(--brand)' : ''}">${icon('eye', 'sm')}</button><button class="icon-btn" data-rmf="${i}" data-tip="Kaldır" style="color:var(--red)">${icon('trash', 'sm')}</button></div></div>`).join('')}</div>` : ''}
        ${canSend ? `<div class="composer-row">
          <button class="icon-btn" id="plusBtn" data-tip="Dosya, anket ve daha fazlası">${icon('plusCircle', 'lg')}</button>
          <textarea id="composer" rows="1" placeholder="${esc(placeholder)}" maxlength="4000"></textarea>
          <span class="char-count hidden" id="charCount"></span>
          <button class="icon-btn" id="expBtn" data-tip="Süreli mesaj (kendini imha eder)" style="${this.expiresIn ? 'color:var(--yellow)' : ''}">${icon('timer', 'lg')}</button>
          <button class="icon-btn" id="gifBtn" data-tip="GIF gönder">${icon('gif', 'lg')}</button>
          <button class="icon-btn" id="emojiBtn" data-tip="Emoji seç">${icon('smile', 'lg')}</button></div>` : `<div class="composer-disabled">${icon('lock', 'sm')} ${reason}</div>`}
      </div>
      <div class="typing" id="typing"></div>
      <input type="file" id="fileIn" multiple class="hidden">`;
    this.renderTyping();
    if (!canSend) return;
    const ta = $('#composer');
    ta.value = prevVal; autoGrow(ta);
    if (!('ontouchstart' in window)) setTimeout(() => ta.focus(), 0);
    ta.onkeydown = (e) => this.onKey(e, ta);
    ta.oninput = () => {
      autoGrow(ta); this.drafts[ch.id] = ta.value; this.autocomplete(ta);
      const cc = $('#charCount'), len = ta.value.length;
      cc.classList.toggle('hidden', len < 3500); cc.textContent = 4000 - len; cc.classList.toggle('over', len > 4000);
      if (ta.value && Date.now() - this.lastTyping > 3000 && !ta.value.startsWith('/')) { this.lastTyping = Date.now(); App.socket.emit('typing', { channel_id: ch.id }); }
    };
    ta.onpaste = (e) => { const files = [...(e.clipboardData?.files || [])]; if (files.length) { e.preventDefault(); this.addFiles(files); } };
    $('#cancelReply')?.addEventListener('click', () => { this.reply = null; this.renderComposer(); $$('.message.replying').forEach((x) => x.classList.remove('replying')); });
    $('#cancelExp')?.addEventListener('click', () => { this.expiresIn = 0; this.renderComposer(); });
    $('#fileIn').onchange = (e) => { this.addFiles([...e.target.files]); e.target.value = ''; };
    $('#plusBtn').onclick = (e) => ctxMenu(e, [
      { label: 'Dosya Yükle', icon: 'attach', action: () => $('#fileIn').click() },
      { label: 'Anket Oluştur', icon: 'poll', action: () => Views.pollModal() },
      { label: 'Mesajı Zamanla', icon: 'clock', action: () => Views.scheduleModal() },
      { label: 'Zamanlanmış Mesajlarım', icon: 'inbox', action: () => Views.scheduledList() },
      { label: 'Süreli Mesaj', icon: 'timer', action: () => this.expMenu(e) },
    ], $('#plusBtn'));
    $('#expBtn').onclick = (e) => this.expMenu(e, $('#expBtn'));
    $('#gifBtn').onclick = () => Pickers.gif($('#gifBtn'), (url) => this.send({ gif_url: url }));
    $('#emojiBtn').onclick = () => Pickers.emoji($('#emojiBtn'), (em) => { insertAtCaret(ta, em + ' '); ta.dispatchEvent(new Event('input')); }, true);
    wrap.onclick = (e) => {
      const rm = e.target.closest('[data-rmf]'); if (rm) { this.files.splice(+rm.dataset.rmf, 1); this.renderComposer(); }
      const sp = e.target.closest('[data-spoil]'); if (sp) { const f = this.files[+sp.dataset.spoil]; f.spoiler = !f.spoiler; this.renderComposer(); }
    };
  },
  drafts: {},
  expMenu(e, anchor) { ctxMenu(e, EXPIRE_OPTS.map(([v, l]) => ({ label: l, check: this.expiresIn === v, action: () => { this.expiresIn = v; this.renderComposer(); } })), anchor); },
  addFiles(files) {
    const max = (App.config.maxUpload || 100) * 1024 * 1024;
    for (const f of files) {
      if (f.size > max) { toast(`${f.name} çok büyük (en fazla ${App.config.maxUpload}MB)`, 'err'); continue; }
      if (this.files.length >= 10) { toast('En fazla 10 dosya ekleyebilirsin', 'err'); break; }
      this.files.push({ file: f, name: f.name, size: f.size, type: f.type || 'application/octet-stream', preview: URL.createObjectURL(f), spoiler: false });
    }
    this.renderComposer();
  },
  bindDrop() {
    const chat = $('#chat');
    let depth = 0;
    chat.ondragenter = (e) => { if (!e.dataTransfer?.types.includes('Files')) return; depth++; if (!$('.drop-overlay', chat)) chat.append(h(`<div class="drop-overlay"><div style="font-size:48px">📁</div>Dosyaları buraya bırak<div class="small" style="font-weight:500">Dosya başına ${App.config.maxUpload}MB'a kadar — ücretsiz!</div></div>`)); };
    chat.ondragleave = () => { if (--depth <= 0) { depth = 0; $('.drop-overlay', chat)?.remove(); } };
    chat.ondragover = (e) => e.preventDefault();
    chat.ondrop = (e) => { e.preventDefault(); depth = 0; $('.drop-overlay', chat)?.remove(); if (e.dataTransfer.files.length) this.addFiles([...e.dataTransfer.files]); };
  },
  onKey(e, ta) {
    if (this.acState && !$('#ac').classList.contains('hidden')) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); this.acMove(e.key === 'ArrowDown' ? 1 : -1); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); this.acPick(ta); return; }
      if (e.key === 'Escape') { $('#ac').classList.add('hidden'); this.acState = null; return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); this.submit(ta); return; }
    if (e.key === 'Escape') { if (this.reply) { this.reply = null; this.renderComposer(); } return; }
    if (e.key === 'ArrowUp' && !ta.value) {
      const arr = this.messages(App.view.channelId) || [];
      const last = [...arr].reverse().find((m) => m.author.id === App.me.id && m.type === 'default');
      if (last) { e.preventDefault(); this.startEdit(last); }
    }
  },
  async submit(ta) {
    let content = ta.value;
    const ch = App.channel;
    const cmd = content.match(/^\/(\w+)\s?([\s\S]*)$/);
    if (cmd) {
      const [, c, arg] = cmd;
      const local = { shrug: () => (arg + ' ¯\\_(ツ)_/¯').trim(), tableflip: () => (arg + ' (╯°□°)╯︵ ┻━┻').trim(), unflip: () => (arg + ' ┬─┬ノ( º _ ºノ)').trim(), me: () => `_${arg}_`, spoiler: () => `||${arg}||` };
      if (local[c]) content = local[c]();
      else if (c === 'anket') { ta.value = ''; return Views.pollModal(arg); }
      else if (c === 'zamanla') { ta.value = ''; return Views.scheduleModal(arg); }
      else if (c === 'sureli') { ta.value = arg; this.expiresIn = 300; this.renderComposer(); toast('Süreli mesaj modu: 5 dakika'); return; }
      else if (c === 'nick' && ch.guild_id) { ta.value = ''; return API.patch(`/api/guilds/${ch.guild_id}/members/@me`, { nick: arg }).then(() => toast(arg ? `Takma adın "${arg}" oldu` : 'Takma ad sıfırlandı', 'ok')).catch(errToast); }
    }
    if (!content.trim() && !this.files.length) return;
    if (content.length > 4000) return toast('Mesaj 4000 karakteri geçemez', 'err');
    ta.value = ''; delete this.drafts[ch.id]; autoGrow(ta); this.lastTyping = 0;
    $('#ac')?.classList.add('hidden');
    await this.send({ content });
  },
  async send({ content = '', gif_url, poll, send_at } = {}) {
    const ch = App.channel;
    if (!ch) return;
    const fd = new FormData();
    fd.append('content', content);
    if (this.reply) fd.append('reply_to', this.reply.id);
    if (this.expiresIn) fd.append('expires_in', this.expiresIn);
    if (gif_url) fd.append('gif_url', gif_url);
    if (poll) fd.append('poll', JSON.stringify(poll));
    if (send_at) fd.append('send_at', send_at);
    const files = this.files;
    if (files.some((f) => f.spoiler)) fd.append('spoiler', '1');
    for (const f of files) fd.append('files', f.file, f.name);
    this.reply = null; this.files = [];
    const hadFiles = files.length > 0;
    this.renderComposer();
    $$('.message.replying').forEach((x) => x.classList.remove('replying'));
    let bar;
    if (hadFiles) { bar = h(`<div class="composer-top" style="margin-bottom:6px;border-radius:8px"><span class="grow">Yükleniyor: ${esc(files.map((f) => f.name).join(', '))}</span><div style="width:160px;height:6px;background:var(--bg-0);border-radius:3px"><div class="pb" style="height:100%;width:0;background:var(--brand);border-radius:3px"></div></div></div>`); $('#composerWrap').prepend(bar); }
    try {
      const r = await API.upload(`/api/channels/${ch.id}/messages`, fd, (p) => bar && (bar.querySelector('.pb').style.width = p * 100 + '%'));
      if (r?.scheduled) toast('Mesaj zamanlandı ⏰', 'ok');
      if (App.detached.has(ch.id)) this.jumpPresent();
    } catch (e) {
      errToast(e);
      if (content && $('#composer') && !$('#composer').value) { $('#composer').value = content; autoGrow($('#composer')); }
      if (hadFiles) { this.files = files; this.renderComposer(); }
    } finally { bar?.remove(); }
  },

  // ─── Otomatik tamamlama ───
  autocomplete(ta) {
    const before = ta.value.slice(0, ta.selectionStart);
    const m = before.match(/(^|\s)([@#:])([^\s@#:]{0,32})$/) || (before.match(/^\/(\w*)$/) && [null, '', '/', before.slice(1)]);
    const ac = $('#ac');
    if (!m) { ac.classList.add('hidden'); this.acState = null; return; }
    const [, , trig, q] = m;
    const ql = q.toLocaleLowerCase('tr');
    const ch = App.channel, g = ch.guild_id && App.guilds.get(ch.guild_id);
    let items = [], title = '';
    if (trig === '@') {
      title = 'Üyeler';
      const pool = g ? [...g.memberMap.keys()] : (ch.recipients || []).map((u) => u.id);
      items = pool.map((uid) => App.user(uid)).filter((u) => u && (u.username.includes(ql) || App.displayName(u.id, g?.id).toLocaleLowerCase('tr').includes(ql))).slice(0, 8)
        .map((u) => ({ html: `${avatarHTML(u.id, 24, true)}<b>${esc(App.displayName(u.id, g?.id))}</b><span class="desc">${esc(u.username)}</span>`, value: `<@${u.id}> ` }));
      if (g) {
        items.push(...g.roles.filter((r) => r.id !== g.id && r.name.toLowerCase().includes(ql)).slice(0, 4).map((r) => ({ html: `<span class="role-dot" style="background:${r.color || '#99aab5'}"></span><b style="color:${r.color || ''}">@${esc(r.name)}</b><span class="desc">Rol</span>`, value: `<@&${r.id}> ` })));
        if (App.can('MENTION_EVERYONE', g.id)) for (const w of ['everyone', 'here']) if (w.startsWith(ql)) items.push({ html: `<b>@${w}</b><span class="desc">${w === 'everyone' ? 'Bu kanalı görebilen herkes' : 'Çevrimiçi herkes'}</span>`, value: `@${w} ` });
      }
    } else if (trig === '#' && g) {
      title = 'Kanallar';
      items = g.channels.filter((c) => c.type !== 'category' && c.name.includes(ql)).slice(0, 8).map((c) => ({ html: `${icon(c.type === 'voice' ? 'speaker' : 'hash', 'sm')}<b>${esc(c.name)}</b>`, value: `<#${c.id}> ` }));
    } else if (trig === ':' && q.length >= 2) {
      title = `":${q}" ile eşleşen emojiler`;
      const custom = [...App.guilds.values()].flatMap((gg) => gg.emojis).filter((e) => e.name.toLowerCase().includes(ql)).slice(0, 5)
        .map((e) => ({ html: `<img class="emoji" src="${customEmojiUrl(e.id)}"><b>:${esc(e.name)}:</b><span class="desc">${esc(App.guilds.get(e.guild_id)?.name || '')}</span>`, value: `<${e.animated ? 'a' : ''}:${e.name}:${e.id}> ` }));
      const std = EMOJIS.filter((e) => e.names.some((n) => n.startsWith(ql))).slice(0, 8).map((e) => ({ html: `<span style="font-size:20px">${e.e}</span><b>:${esc(e.names[0])}:</b>`, value: e.e + ' ' }));
      items = [...custom, ...std];
    } else if (trig === '/') {
      title = 'Komutlar';
      items = SLASH.filter((c) => c.name.startsWith(ql)).map((c) => ({ html: `<b>/${c.name}</b><span class="desc">${esc(c.desc)}</span>`, value: '/' + c.name + ' ' }));
    }
    if (!items.length) { ac.classList.add('hidden'); this.acState = null; return; }
    this.acState = { items, sel: 0, start: before.length - q.length - trig.length };
    ac.innerHTML = `<div class="ac-title">${esc(title)}</div>` + items.map((it, i) => `<div class="ac-item ${i === 0 ? 'sel' : ''}" data-i="${i}">${it.html}</div>`).join('');
    ac.classList.remove('hidden');
    ac.onmousedown = (e) => { e.preventDefault(); const it = e.target.closest('[data-i]'); if (it) { this.acState.sel = +it.dataset.i; this.acPick(ta); } };
  },
  acMove(d) { const s = this.acState; s.sel = (s.sel + d + s.items.length) % s.items.length; $$('#ac .ac-item').forEach((el, i) => el.classList.toggle('sel', i === s.sel)); $$('#ac .ac-item')[s.sel]?.scrollIntoView({ block: 'nearest' }); },
  acPick(ta) {
    const s = this.acState, it = s.items[s.sel];
    const after = ta.value.slice(ta.selectionStart);
    ta.value = ta.value.slice(0, s.start) + it.value + after;
    const pos = s.start + it.value.length;
    ta.setSelectionRange(pos, pos);
    $('#ac').classList.add('hidden'); this.acState = null;
    autoGrow(ta); ta.focus();
  },

  // ─── Yazıyor göstergesi ───
  onTyping(cid, uid) {
    if (!App.typing.has(cid)) App.typing.set(cid, new Map());
    const map = App.typing.get(cid);
    clearTimeout(map.get(uid));
    map.set(uid, setTimeout(() => { map.delete(uid); if (App.view.channelId === cid) this.renderTyping(); }, 6000));
    if (App.view.channelId === cid) this.renderTyping();
  },
  renderTyping() {
    const el = $('#typing');
    if (!el) return;
    const cid = App.view.channelId, gid = App.channel?.guild_id;
    const ids = [...(App.typing.get(cid)?.keys() || [])].filter((u) => u !== App.me.id);
    if (!ids.length) { el.innerHTML = ''; return; }
    const names = ids.map((u) => `<b>${esc(App.displayName(u, gid))}</b>`);
    const txt = ids.length > 3 ? 'Birkaç kişi yazıyor…' : names.length === 1 ? `${names[0]} yazıyor…` : `${names.slice(0, -1).join(', ')} ve ${names[names.length - 1]} yazıyor…`;
    el.innerHTML = `<span class="dots"><span></span><span></span><span></span></span><span>${txt}</span>`;
  },

  // ─── Gerçek zamanlı olaylar ───
  onCreate(m) {
    App.cacheUser(m.author);
    const ch = App.channelById(m.channel_id);
    if (!ch) return;
    ch.last_message_id = m.id;
    const arr = App.messages.get(ch.id);
    if (arr && !App.detached.has(ch.id) && !arr.some((x) => x.id === m.id)) arr.push(m);
    const tm = App.typing.get(ch.id); if (tm?.has(m.author.id)) { clearTimeout(tm.get(m.author.id)); tm.delete(m.author.id); }
    const viewing = App.view.channelId === ch.id;
    const visible = viewing && !document.hidden && document.hasFocus();
    if (m.author.id === App.me.id) App.readStates[ch.id] = m.id;
    else if (!visible) {
      const mention = this.isMention(m) || !ch.guild_id;
      if (mention) {
        App.mentions.set(ch.id, (App.mentions.get(ch.id) || 0) + 1);
        if (App.me.status_setting !== 'dnd') {
          Sound.message();
          const g = ch.guild_id && App.guilds.get(ch.guild_id);
          desktopNotify(App.displayName(m.author.id, ch.guild_id) + (g ? ` (#${ch.name}, ${g.name})` : ''), m.content ? plainPreview(m.content, App.mdCtx(ch.guild_id)).slice(0, 140) : '📎 Ek gönderdi', m.author.avatar || '/favicon.svg', () => App.go(ch.guild_id || '@me', ch.id));
        }
      }
    }
    if (viewing) {
      if (!App.detached.has(ch.id)) {
        const el = $('#msgs');
        const stick = el && el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        const prev = arr?.[arr.length - 2];
        if (el) {
          const lastEl = el.lastElementChild;
          if (prev && new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString()) el.append(h(`<div class="day-sep"><span>${fmtDay(m.created_at)}</span></div>`));
          const usePrev = lastEl?.classList.contains('message') ? prev : null;
          el.append(h(this.msgHTML(m, usePrev, ch.guild_id)));
          if (stick || m.author.id === App.me.id) { el.scrollTop = el.scrollHeight; $$('img', el.lastElementChild).forEach((i) => i.addEventListener('load', () => (el.scrollTop = el.scrollHeight), { once: true })); }
        }
        this.renderTyping();
      }
      if (visible) this.ackSoon();
    }
    App.renderGuilds();
    if (!viewing || ch.guild_id) App.renderSidebar();
  },
  onUpdate(m) {
    const arr = App.messages.get(m.channel_id);
    if (arr) { const i = arr.findIndex((x) => x.id === m.id); if (i >= 0) arr[i] = m; }
    if (App.panelMessages?.has(m.id)) App.panelMessages.set(m.id, m);
    if (App.view.channelId === m.channel_id) {
      const el = $(`#msgs .message[data-id="${m.id}"]`);
      if (el && !el.querySelector('.edit-wrap')) this.rerenderOne(m);
    }
  },
  onDelete({ id, channel_id }) {
    const arr = App.messages.get(channel_id);
    if (arr) { const i = arr.findIndex((x) => x.id === id); if (i >= 0) arr.splice(i, 1); }
    if (App.view.channelId === channel_id) {
      const el = $(`#msgs .message[data-id="${id}"]`);
      if (el) {
        const next = el.nextElementSibling;
        const wasHead = el.classList.contains('head');
        el.style.transition = 'opacity .2s'; el.style.opacity = 0;
        setTimeout(() => { el.remove(); if (wasHead && next?.classList.contains('message') && !next.classList.contains('head')) { const m = this.find(next.dataset.id); if (m) this.rerenderOne(m); } }, 200);
      }
    }
    $(`.side-panel .message[data-id="${id}"]`)?.closest('.result-card')?.remove();
  },
  ackSoon() { clearTimeout(this.ackTimer); this.ackTimer = setTimeout(() => this.ackCurrent(), 400); },
  ackCurrent() {
    const ch = App.channel;
    if (!ch || document.hidden || ch.type === 'voice' || this.noAckUntilLeave === ch.id) return;
    const had = App.mentions.get(ch.id) || App.isUnread(ch);
    App.mentions.delete(ch.id);
    if (ch.last_message_id && (App.readStates[ch.id] || '0') < ch.last_message_id) {
      App.readStates[ch.id] = ch.last_message_id;
      API.post(`/api/channels/${ch.id}/ack`, { message_id: ch.last_message_id }).catch(() => {});
    }
    if (had) { App.renderGuilds(); App.renderSidebar(); }
  },
};

// Süreli mesaj sayaçlarını güncelle
setInterval(() => { for (const el of $$('[data-exp]')) { const left = +el.dataset.exp - Date.now(); el.lastChild.textContent = left > 0 ? fmtLeft(left) : 'siliniyor…'; } }, 1000);

function autoGrow(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, innerHeight * 0.5) + 'px'; }
function insertAtCaret(ta, text) { const s = ta.selectionStart ?? ta.value.length, e = ta.selectionEnd ?? s; ta.value = ta.value.slice(0, s) + text + ta.value.slice(e); ta.setSelectionRange(s + text.length, s + text.length); ta.focus(); }
function emojiHTML(e) { const m = e.match(/^<(a?):(\w+):(\d+)>$/); return m ? `<img class="emoji" src="${customEmojiUrl(m[3])}" alt=":${esc(m[2])}:">` : `<span class="emoji">${esc(e)}</span>`; }

// ════════ Emoji & GIF seçiciler ════════
const Pickers = {
  recent() { try { return JSON.parse(localStorage.getItem('yanki_recent_emoji') || '[]'); } catch { return []; } },
  addRecent(e) { const r = [e, ...this.recent().filter((x) => x !== e)].slice(0, 24); localStorage.setItem('yanki_recent_emoji', JSON.stringify(r)); },
  emoji(anchor, onPick, keepOpen) {
    closeFloating();
    const el = h(`<div class="picker" data-keep-float><div class="p-tabs"><button class="active">Emoji</button><button data-gif>GIF</button></div><div class="p-search"><input placeholder="Emoji ara (Türkçe veya İngilizce)…"></div><div class="p-body"></div></div>`);
    const body = el.querySelector('.p-body'), inp = el.querySelector('input');
    const custom = [...App.guilds.values()].flatMap((g) => g.emojis.map((e) => ({ ...e, gname: g.name })));
    const draw = (q = '') => {
      q = q.toLocaleLowerCase('tr');
      let html = '';
      if (!q) {
        const rec = this.recent();
        if (rec.length) html += `<div class="p-cat">Son Kullanılanlar</div><div class="p-grid">${rec.map((e) => `<button data-e="${esc(e)}">${emojiHTML(e).replace('class="emoji"', '')}</button>`).join('')}</div>`;
      }
      const cust = custom.filter((e) => !q || e.name.toLowerCase().includes(q));
      const byG = {};
      for (const e of cust) (byG[e.gname] ||= []).push(e);
      for (const [gn, list] of Object.entries(byG)) html += `<div class="p-cat">${esc(gn)} <span class="tag brand" style="font-size:9px">HER YERDE KULLAN</span></div><div class="p-grid">${list.map((e) => `<button data-e="<${e.animated ? 'a' : ''}:${e.name}:${e.id}>" data-tip=":${esc(e.name)}:"><img src="${customEmojiUrl(e.id)}" loading="lazy"></button>`).join('')}</div>`;
      for (const [cat] of EMOJI_CATS) {
        const list = EMOJIS.filter((e) => e.cat === cat && (!q || e.names.some((n) => n.includes(q))));
        if (list.length) html += `<div class="p-cat">${cat}</div><div class="p-grid">${list.map((e) => `<button data-e="${e.e}" data-tip=":${e.names[0]}:">${e.e}</button>`).join('')}</div>`;
      }
      body.innerHTML = html || '<div class="empty">Sonuç yok 😕</div>';
    };
    draw();
    inp.oninput = () => draw(inp.value);
    body.onclick = (e) => { const b = e.target.closest('[data-e]'); if (!b) return; this.addRecent(b.dataset.e); onPick(b.dataset.e); if (!keepOpen || !e.shiftKey) closeFloating(); };
    el.querySelector('[data-gif]').onclick = () => { closeFloating(); this.gif(anchor, (url) => Chat.send({ gif_url: url })); };
    placeFloating(el, 0, 0, anchor);
    inp.focus();
  },
  async gif(anchor, onPick) {
    closeFloating();
    const el = h(`<div class="picker" data-keep-float><div class="p-tabs"><button data-t="trend" class="active">${App.config.tenor ? 'Trend' : 'Topluluk'}</button><button data-t="fav">⭐ Favoriler</button><button data-t="up">Yükle</button></div><div class="p-search"><input placeholder="GIF ara…"></div><div class="p-body"><div class="gif-grid"></div></div></div>`);
    const grid = el.querySelector('.gif-grid'), inp = el.querySelector('input');
    let favs = await API.get('/api/gifs/favorites').catch(() => []);
    const drawList = (list, note = '') => {
      grid.parentElement.querySelector('.note')?.remove();
      if (note) grid.before(h(`<div class="note tiny muted" style="padding:0 4px 8px">${note}</div>`));
      grid.innerHTML = list.map((g) => `<div class="g" data-url="${esc(g.url)}"><img src="${esc(g.preview || g.url)}" loading="lazy" referrerpolicy="no-referrer"><button class="fav" data-fav="${esc(g.url)}" data-tip="${favs.includes(g.url) ? 'Favorilerden çıkar' : 'Favorilere ekle'}">${favs.includes(g.url) ? '★' : '☆'}</button></div>`).join('') || '<div class="empty" style="column-span:all">Burada henüz GIF yok.<br><span class="small">"Yükle" sekmesinden bilgisayarından GIF gönderebilir ya da bir GIF bağlantısı yapıştırabilirsin.</span></div>';
    };
    const search = async (q) => {
      const r = await API.get('/api/gifs?q=' + encodeURIComponent(q)).catch(() => ({ results: [] }));
      drawList(r.results, r.source === 'community' ? 'Topluluk kütüphanesi: bu sunucuda paylaşılan GIF\'ler. (Yönetici TENOR_API_KEY eklerse Tenor araması açılır.)' : '');
    };
    const tab = (t) => {
      $$('.p-tabs button', el).forEach((b) => b.classList.toggle('active', b.dataset.t === t));
      el.querySelector('.p-search').classList.toggle('hidden', t === 'up');
      if (t === 'trend') search(inp.value);
      if (t === 'fav') drawList(favs.map((u) => ({ url: u })));
      if (t === 'up') {
        grid.parentElement.querySelector('.note')?.remove();
        grid.innerHTML = `<div style="column-span:all;padding:8px"><button class="btn block" id="gifUp">${icon('attach')} Bilgisayarından GIF seç</button><div class="divider"></div><label class="label">veya GIF bağlantısı yapıştır</label><div class="row"><input class="input" id="gifUrl" placeholder="https://…/komik.gif"><button class="btn" id="gifUrlGo">Gönder</button></div><input type="file" accept="image/gif,image/webp,video/mp4" class="hidden" id="gifFile"></div>`;
        $('#gifUp', el).onclick = () => $('#gifFile', el).click();
        $('#gifFile', el).onchange = (e) => { const f = e.target.files[0]; if (f) { closeFloating(); Chat.addFiles([f]); Chat.submit($('#composer')); } };
        $('#gifUrlGo', el).onclick = () => { const u = $('#gifUrl', el).value.trim(); if (/^https?:\/\//.test(u)) { closeFloating(); onPick(u); } else toast('Geçerli bir bağlantı gir', 'err'); };
      }
    };
    el.querySelector('.p-tabs').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) tab(b.dataset.t); };
    inp.oninput = debounce(() => search(inp.value), 300);
    grid.onclick = async (e) => {
      const f = e.target.closest('[data-fav]');
      if (f) {
        e.stopPropagation();
        const url = f.dataset.fav, has = favs.includes(url);
        await (has ? API.del('/api/gifs/favorites', { url }) : API.put('/api/gifs/favorites', { url })).catch(errToast);
        favs = has ? favs.filter((x) => x !== url) : [url, ...favs];
        f.textContent = has ? '☆' : '★';
        toast(has ? 'Favorilerden çıkarıldı' : 'Favorilere eklendi ⭐', 'ok');
        return;
      }
      const g = e.target.closest('[data-url]');
      if (g) { closeFloating(); onPick(g.dataset.url); }
    };
    placeFloating(el, 0, 0, anchor);
    tab('trend');
    inp.focus();
  },
};
