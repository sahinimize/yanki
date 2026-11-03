// Yankı — kendi sunucunda çalışan, Discord benzeri sohbet + ses platformu
'use strict';
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 100);
const TENOR_KEY = process.env.TENOR_API_KEY || '';
const PUBLIC_DIR = path.join(__dirname, 'public');
// İstemci sürümü: public/ içeriğinin özeti. Sunucuya yeni arayüz yüklendiğinde değişir ve
// açık olan tüm istemcilere "Güncelleme mevcut" butonu gösterilir.
function computeClientVersion() {
  const h = crypto.createHash('sha1');
  const walk = (dir) => { for (const f of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) { const p = path.join(dir, f.name); if (f.isDirectory()) walk(p); else h.update(f.name).update(fs.readFileSync(p)); } };
  walk(PUBLIC_DIR);
  return h.digest('hex').slice(0, 12);
}
const CLIENT_VERSION = computeClientVersion();
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ───────────────────────── Veritabanı ─────────────────────────
const db = new DatabaseSync(path.join(DATA_DIR, 'yanki.db'));
db.exec(`
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY, username TEXT UNIQUE COLLATE NOCASE, email TEXT UNIQUE COLLATE NOCASE,
  password_hash TEXT, display_name TEXT, avatar TEXT, banner TEXT, bio TEXT DEFAULT '',
  accent_color TEXT DEFAULT '#5865f2', banner_color TEXT DEFAULT '#5865f2',
  theme_primary TEXT, theme_secondary TEXT, decoration TEXT, effect TEXT,
  name_color TEXT, name_color2 TEXT, name_font TEXT, pronouns TEXT DEFAULT '',
  status TEXT DEFAULT 'online', custom_status TEXT DEFAULT '', custom_status_emoji TEXT DEFAULT '',
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, created_at INTEGER);
CREATE TABLE IF NOT EXISTS relationships(user_id TEXT, target_id TEXT, type INTEGER, created_at INTEGER, PRIMARY KEY(user_id,target_id));
CREATE TABLE IF NOT EXISTS notes(user_id TEXT, target_id TEXT, note TEXT, PRIMARY KEY(user_id,target_id));
CREATE TABLE IF NOT EXISTS guilds(id TEXT PRIMARY KEY, name TEXT, icon TEXT, banner TEXT, description TEXT DEFAULT '', owner_id TEXT, system_channel_id TEXT, created_at INTEGER);
CREATE TABLE IF NOT EXISTS members(guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE, user_id TEXT, nick TEXT, joined_at INTEGER, PRIMARY KEY(guild_id,user_id));
CREATE TABLE IF NOT EXISTS roles(id TEXT PRIMARY KEY, guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE, name TEXT, color TEXT, permissions INTEGER, position INTEGER, hoist INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS member_roles(guild_id TEXT, user_id TEXT, role_id TEXT REFERENCES roles(id) ON DELETE CASCADE, PRIMARY KEY(guild_id,user_id,role_id));
CREATE TABLE IF NOT EXISTS channels(id TEXT PRIMARY KEY, guild_id TEXT, type TEXT, name TEXT, topic TEXT DEFAULT '', parent_id TEXT, position INTEGER DEFAULT 0, slowmode INTEGER DEFAULT 0, private_roles TEXT, owner_id TEXT, icon TEXT, last_message_id TEXT, created_at INTEGER);
CREATE TABLE IF NOT EXISTS dm_members(channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE, user_id TEXT, PRIMARY KEY(channel_id,user_id));
CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY, channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE, author_id TEXT, content TEXT, attachments TEXT, reply_to TEXT, poll TEXT, type TEXT DEFAULT 'default', pinned INTEGER DEFAULT 0, edited_at INTEGER, expires_at INTEGER, created_at INTEGER);
CREATE INDEX IF NOT EXISTS idx_msg_channel ON messages(channel_id, id);
CREATE TABLE IF NOT EXISTS reactions(message_id TEXT REFERENCES messages(id) ON DELETE CASCADE, user_id TEXT, emoji TEXT, created_at INTEGER, PRIMARY KEY(message_id,user_id,emoji));
CREATE TABLE IF NOT EXISTS poll_votes(message_id TEXT REFERENCES messages(id) ON DELETE CASCADE, user_id TEXT, option INTEGER, PRIMARY KEY(message_id,user_id,option));
CREATE TABLE IF NOT EXISTS invites(code TEXT PRIMARY KEY, guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE, channel_id TEXT, inviter_id TEXT, uses INTEGER DEFAULT 0, max_uses INTEGER DEFAULT 0, expires_at INTEGER, created_at INTEGER);
CREATE TABLE IF NOT EXISTS bans(guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE, user_id TEXT, reason TEXT, created_at INTEGER, PRIMARY KEY(guild_id,user_id));
CREATE TABLE IF NOT EXISTS emojis(id TEXT PRIMARY KEY, guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE, name TEXT, file TEXT, animated INTEGER, creator_id TEXT);
CREATE TABLE IF NOT EXISTS read_states(user_id TEXT, channel_id TEXT, last_read_id TEXT, PRIMARY KEY(user_id,channel_id));
CREATE TABLE IF NOT EXISTS bookmarks(user_id TEXT, message_id TEXT REFERENCES messages(id) ON DELETE CASCADE, created_at INTEGER, PRIMARY KEY(user_id,message_id));
CREATE TABLE IF NOT EXISTS scheduled(id TEXT PRIMARY KEY, channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE, author_id TEXT, content TEXT, send_at INTEGER);
CREATE TABLE IF NOT EXISTS fav_gifs(user_id TEXT, url TEXT, created_at INTEGER, PRIMARY KEY(user_id,url));
CREATE TABLE IF NOT EXISTS audit_log(id TEXT PRIMARY KEY, guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE, user_id TEXT, action TEXT, detail TEXT, created_at INTEGER);
`);

const stmts = new Map();
const S = (sql) => { let s = stmts.get(sql); if (!s) { s = db.prepare(sql); stmts.set(sql, s); } return s; };
const clean = (p) => p.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));
const get = (sql, ...p) => S(sql).get(...clean(p));
const all = (sql, ...p) => S(sql).all(...clean(p));
const run = (sql, ...p) => S(sql).run(...clean(p));
const tx = (fn) => { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };

let lastTs = 0, seq = 0;
function genId() {
  let t = Date.now() - 1700000000000;
  if (t <= lastTs) { t = lastTs; seq++; if (seq >= 4096) { lastTs++; t = lastTs; seq = 0; } } else { lastTs = t; seq = 0; }
  return String(t * 4096 + seq).padStart(16, '0');
}

// ───────────────────────── Yetkiler ─────────────────────────
const P = {
  VIEW: 1 << 0, SEND: 1 << 1, MANAGE_MESSAGES: 1 << 2, MANAGE_CHANNELS: 1 << 3, MANAGE_ROLES: 1 << 4,
  MANAGE_GUILD: 1 << 5, KICK: 1 << 6, BAN: 1 << 7, INVITE: 1 << 8, CONNECT: 1 << 9, SPEAK: 1 << 10,
  STREAM: 1 << 11, MUTE_MEMBERS: 1 << 12, MOVE_MEMBERS: 1 << 13, ATTACH: 1 << 14, MENTION_EVERYONE: 1 << 15,
  MANAGE_EMOJIS: 1 << 16, ADMIN: 1 << 30,
};
const ALL_PERMS = Object.values(P).reduce((a, b) => a | b, 0);
const DEFAULT_PERMS = P.VIEW | P.SEND | P.INVITE | P.CONNECT | P.SPEAK | P.STREAM | P.ATTACH;

function guildPerms(gid, uid) {
  const g = get('SELECT owner_id FROM guilds WHERE id=?', gid);
  if (!g) return 0;
  if (g.owner_id === uid) return ALL_PERMS;
  if (!get('SELECT 1 FROM members WHERE guild_id=? AND user_id=?', gid, uid)) return 0;
  let p = get('SELECT permissions FROM roles WHERE id=?', gid)?.permissions || 0;
  for (const r of all('SELECT r.permissions FROM member_roles mr JOIN roles r ON r.id=mr.role_id WHERE mr.guild_id=? AND mr.user_id=?', gid, uid)) p |= r.permissions;
  return p & P.ADMIN ? ALL_PERMS : p;
}
const memberRoleIds = (gid, uid) => all('SELECT role_id FROM member_roles WHERE guild_id=? AND user_id=?', gid, uid).map((r) => r.role_id);
function topRolePos(gid, uid) {
  const g = get('SELECT owner_id FROM guilds WHERE id=?', gid);
  if (g?.owner_id === uid) return Infinity;
  return get('SELECT MAX(r.position) p FROM member_roles mr JOIN roles r ON r.id=mr.role_id WHERE mr.guild_id=? AND mr.user_id=?', gid, uid)?.p || 0;
}
function canView(ch, uid) {
  if (!ch) return false;
  if (!ch.guild_id) return !!get('SELECT 1 FROM dm_members WHERE channel_id=? AND user_id=?', ch.id, uid);
  const p = guildPerms(ch.guild_id, uid);
  if (!(p & P.VIEW)) return false;
  if (p & P.ADMIN) return true;
  if (!ch.private_roles) return true;
  const allowed = JSON.parse(ch.private_roles);
  return memberRoleIds(ch.guild_id, uid).some((r) => allowed.includes(r));
}

// ───────────────────────── Çevrimiçi durum ─────────────────────────
const online = new Map(); // uid -> Set(socketId)
const voice = new Map(); // uid -> voice state
const getUser = (id) => get('SELECT * FROM users WHERE id=?', id);
function presence(u) {
  if (!online.has(u.id)) return 'offline';
  return u.status === 'invisible' ? 'offline' : u.status || 'online';
}
function pubUser(u) {
  if (typeof u === 'string') u = getUser(u);
  if (!u) return { id: '0', username: 'silinmis', display_name: 'Silinmiş Kullanıcı', status: 'offline' };
  return {
    id: u.id, username: u.username, display_name: u.display_name, avatar: u.avatar, banner: u.banner, bio: u.bio,
    accent_color: u.accent_color, banner_color: u.banner_color, theme_primary: u.theme_primary, theme_secondary: u.theme_secondary,
    decoration: u.decoration, effect: u.effect, name_color: u.name_color, name_color2: u.name_color2, name_font: u.name_font,
    pronouns: u.pronouns, custom_status: u.custom_status, custom_status_emoji: u.custom_status_emoji,
    status: presence(u), created_at: u.created_at,
  };
}
const selfUser = (u) => ({ ...pubUser(u), email: u.email, status_setting: u.status });

// ───────────────────────── Payload'lar ─────────────────────────
function channelPayload(ch) {
  const c = { ...ch, private_roles: ch.private_roles ? JSON.parse(ch.private_roles) : null };
  if (!ch.guild_id) c.recipients = all('SELECT user_id FROM dm_members WHERE channel_id=?', ch.id).map((r) => pubUser(r.user_id));
  return c;
}
function guildPayload(gid, uid) {
  const g = get('SELECT * FROM guilds WHERE id=?', gid);
  if (!g) return null;
  const channels = all('SELECT * FROM channels WHERE guild_id=? ORDER BY position, created_at', gid).filter((c) => c.type === 'category' || canView(c, uid)).map(channelPayload);
  const roles = all('SELECT * FROM roles WHERE guild_id=? ORDER BY position DESC', gid);
  const mr = all('SELECT user_id, role_id FROM member_roles WHERE guild_id=?', gid);
  const byUser = {};
  for (const r of mr) (byUser[r.user_id] ||= []).push(r.role_id);
  const members = all('SELECT m.*, u.* FROM members m JOIN users u ON u.id=m.user_id WHERE m.guild_id=?', gid).map((m) => ({
    user: pubUser(m), nick: m.nick, roles: byUser[m.user_id] || [], joined_at: m.joined_at,
  }));
  const emojis = all('SELECT id,name,animated,guild_id FROM emojis WHERE guild_id=?', gid);
  const chIds = new Set(channels.map((c) => c.id));
  const voice_states = [...voice.values()].filter((v) => v.guild_id === gid && chIds.has(v.channel_id)).map(voicePublic);
  return { ...g, channels, roles, members, emojis, voice_states, my_perms: guildPerms(gid, uid) };
}
function messagePayload(m) {
  if (!m) return null;
  const reacts = {};
  for (const r of all('SELECT emoji, user_id FROM reactions WHERE message_id=? ORDER BY created_at', m.id)) (reacts[r.emoji] ||= []).push(r.user_id);
  let reply = null;
  if (m.reply_to) {
    const r = get('SELECT id, author_id, content, attachments FROM messages WHERE id=?', m.reply_to);
    reply = r ? { id: r.id, author: pubUser(r.author_id), content: r.content, has_attachments: r.attachments && r.attachments !== '[]' } : { id: m.reply_to, deleted: true };
  }
  let poll = null;
  if (m.poll) {
    poll = JSON.parse(m.poll);
    const votes = all('SELECT user_id, option FROM poll_votes WHERE message_id=?', m.id);
    poll.options = poll.options.map((o, i) => ({ text: o, votes: votes.filter((v) => v.option === i).map((v) => v.user_id) }));
  }
  return {
    id: m.id, channel_id: m.channel_id, author: pubUser(m.author_id), content: m.content, type: m.type,
    attachments: m.attachments ? JSON.parse(m.attachments) : [], reply_to: reply, poll, pinned: !!m.pinned,
    edited_at: m.edited_at, expires_at: m.expires_at, created_at: m.created_at,
    reactions: Object.entries(reacts).map(([emoji, users]) => ({ emoji, users })),
  };
}
const voicePublic = (v) => ({ user_id: v.user_id, channel_id: v.channel_id, guild_id: v.guild_id, muted: v.muted, deafened: v.deafened, server_muted: v.server_muted, video: v.video, streaming: v.streaming, camera_stream: v.camera_stream, screen_stream: v.screen_stream, mic_stream: v.mic_stream, joined_at: v.joined_at });

// ───────────────────────── Yayın yardımcıları ─────────────────────────
let io;
const emitUser = (uid, ev, data) => io.to('user:' + uid).emit(ev, data);
const guildMemberIds = (gid) => all('SELECT user_id FROM members WHERE guild_id=?', gid).map((r) => r.user_id);
function channelAudience(ch) {
  if (!ch.guild_id) return all('SELECT user_id FROM dm_members WHERE channel_id=?', ch.id).map((r) => r.user_id);
  return guildMemberIds(ch.guild_id).filter((u) => canView(ch, u));
}
const emitChannel = (ch, ev, data) => { for (const u of channelAudience(ch)) emitUser(u, ev, data); };
function syncGuild(gid, extraUids = []) {
  const ids = new Set([...guildMemberIds(gid), ...extraUids]);
  for (const uid of ids) {
    if (!online.has(uid)) continue;
    const isMember = get('SELECT 1 FROM members WHERE guild_id=? AND user_id=?', gid, uid);
    if (isMember) emitUser(uid, 'guild:sync', guildPayload(gid, uid));
    else emitUser(uid, 'guild:delete', { id: gid });
  }
}
function audienceOfUser(uid) {
  const s = new Set([uid]);
  for (const r of all('SELECT DISTINCT m2.user_id FROM members m1 JOIN members m2 ON m1.guild_id=m2.guild_id WHERE m1.user_id=?', uid)) s.add(r.user_id);
  for (const r of all('SELECT target_id FROM relationships WHERE user_id=?', uid)) s.add(r.target_id);
  for (const r of all('SELECT DISTINCT d2.user_id FROM dm_members d1 JOIN dm_members d2 ON d1.channel_id=d2.channel_id WHERE d1.user_id=?', uid)) s.add(r.user_id);
  return s;
}
function broadcastUser(uid) {
  const u = getUser(uid);
  const pu = pubUser(u);
  for (const t of audienceOfUser(uid)) emitUser(t, 'user:update', t === uid ? selfUser(u) : pu);
}
function audit(gid, uid, action, detail) { run('INSERT INTO audit_log VALUES(?,?,?,?,?,?)', genId(), gid, uid, action, detail || '', Date.now()); }

// ───────────────────────── Express ─────────────────────────
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/version', (req, res) => res.json({ client: CLIENT_VERSION }));
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', setHeaders: (res) => res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'") }));
app.use(express.static(PUBLIC_DIR, { maxAge: 0, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + (path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 10) || '')),
});
const upload = multer({ storage, limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 10 } });
const imageOnly = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 }, fileFilter: (req, f, cb) => cb(null, /^image\/(png|jpe?g|gif|webp)$/.test(f.mimetype)) });
const fileUrl = (f) => '/uploads/' + f.filename;

const wrap = (fn) => (req, res, next) => { try { const r = fn(req, res, next); if (r && r.catch) r.catch(next); } catch (e) { next(e); } };
class HttpErr extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const fail = (code, msg) => { throw new HttpErr(code, msg); };

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const s = token && get('SELECT user_id FROM sessions WHERE token=?', token);
  if (!s) return res.status(401).json({ error: 'Oturum geçersiz' });
  req.user = getUser(s.user_id);
  if (!req.user) return res.status(401).json({ error: 'Oturum geçersiz' });
  req.token = token;
  next();
}
const needPerm = (gid, uid, perm) => { if (!(guildPerms(gid, uid) & perm)) fail(403, 'Bunun için yetkin yok'); };
const needMember = (gid, uid) => { if (!get('SELECT 1 FROM members WHERE guild_id=? AND user_id=?', gid, uid)) fail(404, 'Sunucu bulunamadı'); };
const getChannel = (id) => get('SELECT * FROM channels WHERE id=?', id);

// Basit hız sınırlayıcı
const buckets = new Map();
function limit(key, max, windowMs) {
  const now = Date.now();
  const b = buckets.get(key) || { n: 0, t: now };
  if (now - b.t > windowMs) { b.n = 0; b.t = now; }
  b.n++; buckets.set(key, b);
  if (b.n > max) fail(429, 'Çok hızlısın, biraz yavaşla');
}

// ───── Kimlik doğrulama ─────
const USERNAME_RE = /^[a-z0-9_.]{2,32}$/;
app.post('/api/auth/register', wrap(async (req, res) => {
  limit('reg:' + req.ip, 10, 60_000);
  let { username, email, password, display_name } = req.body || {};
  username = String(username || '').trim().toLowerCase();
  email = String(email || '').trim().toLowerCase();
  if (!USERNAME_RE.test(username)) fail(400, 'Kullanıcı adı 2-32 karakter olmalı; sadece küçük harf, rakam, _ ve . kullanılabilir');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, 'Geçerli bir e-posta gir');
  if (String(password || '').length < 6) fail(400, 'Şifre en az 6 karakter olmalı');
  if (get('SELECT 1 FROM users WHERE username=?', username)) fail(400, 'Bu kullanıcı adı alınmış');
  if (get('SELECT 1 FROM users WHERE email=?', email)) fail(400, 'Bu e-posta zaten kayıtlı');
  const id = genId();
  const hash = await bcrypt.hash(String(password), 10);
  const colors = ['#5865f2', '#eb459e', '#57f287', '#fee75c', '#ed4245', '#f47b67', '#3ba55c', '#9b59b6'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  run('INSERT INTO users(id,username,email,password_hash,display_name,accent_color,banner_color,created_at) VALUES(?,?,?,?,?,?,?,?)', id, username, email, hash, String(display_name || '').trim().slice(0, 32) || username, color, color, Date.now());
  const token = crypto.randomBytes(32).toString('hex');
  run('INSERT INTO sessions VALUES(?,?,?)', token, id, Date.now());
  res.json({ token });
}));
app.post('/api/auth/login', wrap(async (req, res) => {
  limit('login:' + req.ip, 20, 60_000);
  const login = String(req.body?.login || '').trim().toLowerCase();
  const u = get('SELECT * FROM users WHERE username=? OR email=?', login, login);
  if (!u || !(await bcrypt.compare(String(req.body?.password || ''), u.password_hash))) fail(400, 'Kullanıcı adı/e-posta veya şifre hatalı');
  const token = crypto.randomBytes(32).toString('hex');
  run('INSERT INTO sessions VALUES(?,?,?)', token, u.id, Date.now());
  res.json({ token });
}));
app.post('/api/auth/logout', auth, wrap((req, res) => { run('DELETE FROM sessions WHERE token=?', req.token); res.json({ ok: true }); }));

// ───── Ben ─────
app.get('/api/me', auth, wrap((req, res) => {
  const uid = req.user.id;
  const guilds = all('SELECT guild_id FROM members WHERE user_id=? ORDER BY joined_at', uid).map((r) => guildPayload(r.guild_id, uid));
  const dms = all('SELECT c.* FROM channels c JOIN dm_members d ON d.channel_id=c.id WHERE d.user_id=? ORDER BY c.last_message_id DESC', uid).map(channelPayload);
  const relationships = all('SELECT * FROM relationships WHERE user_id=?', uid).map((r) => ({ id: r.target_id, type: r.type, user: pubUser(r.target_id), created_at: r.created_at }));
  const read_states = Object.fromEntries(all('SELECT channel_id, last_read_id FROM read_states WHERE user_id=?', uid).map((r) => [r.channel_id, r.last_read_id]));
  const dmVoice = [...voice.values()].filter((v) => !v.guild_id && dms.some((d) => d.id === v.channel_id)).map(voicePublic);
  res.json({ user: selfUser(req.user), guilds, dms, relationships, read_states, dm_voice_states: dmVoice, perms: P, tenor: !!TENOR_KEY, max_upload_mb: MAX_UPLOAD_MB });
}));
const PROFILE_FIELDS = { display_name: 32, bio: 400, accent_color: 9, banner_color: 9, theme_primary: 9, theme_secondary: 9, decoration: 32, effect: 32, name_color: 9, name_color2: 9, name_font: 32, pronouns: 40, custom_status: 128, custom_status_emoji: 64, status: 12 };
app.patch('/api/me', auth, wrap(async (req, res) => {
  const b = req.body || {};
  for (const [k, max] of Object.entries(PROFILE_FIELDS)) {
    if (!(k in b)) continue;
    let v = b[k] === null ? null : String(b[k]).slice(0, max);
    if (k === 'status' && !['online', 'idle', 'dnd', 'invisible'].includes(v)) continue;
    if (k.endsWith('color') || k.startsWith('theme_') || k === 'name_color2') if (v && !/^#[0-9a-fA-F]{3,8}$/.test(v)) v = null;
    run(`UPDATE users SET ${k}=? WHERE id=?`, v, req.user.id);
  }
  if ('avatar' in b && b.avatar === null) run('UPDATE users SET avatar=NULL WHERE id=?', req.user.id);
  if ('banner' in b && b.banner === null) run('UPDATE users SET banner=NULL WHERE id=?', req.user.id);
  if (b.username !== undefined && b.username !== req.user.username) {
    const un = String(b.username).trim().toLowerCase();
    if (!USERNAME_RE.test(un)) fail(400, 'Geçersiz kullanıcı adı');
    if (get('SELECT 1 FROM users WHERE username=? AND id!=?', un, req.user.id)) fail(400, 'Bu kullanıcı adı alınmış');
    run('UPDATE users SET username=? WHERE id=?', un, req.user.id);
  }
  if (b.new_password) {
    if (!(await bcrypt.compare(String(b.password || ''), req.user.password_hash))) fail(400, 'Mevcut şifre hatalı');
    if (String(b.new_password).length < 6) fail(400, 'Yeni şifre en az 6 karakter olmalı');
    run('UPDATE users SET password_hash=? WHERE id=?', await bcrypt.hash(String(b.new_password), 10), req.user.id);
  }
  broadcastUser(req.user.id);
  res.json(selfUser(getUser(req.user.id)));
}));
app.post('/api/me/:kind', auth, imageOnly.single('file'), wrap((req, res) => {
  if (!['avatar', 'banner'].includes(req.params.kind)) fail(404, 'Bulunamadı');
  if (!req.file) fail(400, 'Geçerli bir resim yükle (png, jpg, gif, webp)');
  run(`UPDATE users SET ${req.params.kind}=? WHERE id=?`, fileUrl(req.file), req.user.id);
  broadcastUser(req.user.id);
  res.json(selfUser(getUser(req.user.id)));
}));
app.delete('/api/me', auth, wrap(async (req, res) => {
  if (!(await bcrypt.compare(String(req.body?.password || ''), req.user.password_hash))) fail(400, 'Şifre hatalı');
  if (get('SELECT 1 FROM guilds WHERE owner_id=?', req.user.id)) fail(400, 'Önce sahibi olduğun sunucuları sil veya devret');
  const uid = req.user.id;
  tx(() => {
    run('DELETE FROM sessions WHERE user_id=?', uid);
    run('DELETE FROM relationships WHERE user_id=? OR target_id=?', uid, uid);
    run('DELETE FROM members WHERE user_id=?', uid);
    run('DELETE FROM member_roles WHERE user_id=?', uid);
    run("UPDATE users SET username=?, email=?, password_hash='', display_name='Silinmiş Kullanıcı', avatar=NULL, banner=NULL, bio='' WHERE id=?", 'silinmis_' + uid, 'deleted_' + uid + '@x', uid);
  });
  res.json({ ok: true });
}));

// ───── Kullanıcılar & notlar ─────
app.get('/api/users/:id', auth, wrap((req, res) => {
  const u = getUser(req.params.id);
  if (!u) fail(404, 'Kullanıcı bulunamadı');
  const mutual_guilds = all('SELECT g.id, g.name, g.icon FROM members a JOIN members b ON a.guild_id=b.guild_id JOIN guilds g ON g.id=a.guild_id WHERE a.user_id=? AND b.user_id=?', req.user.id, u.id);
  const mutual_friends = all('SELECT a.target_id id FROM relationships a JOIN relationships b ON a.target_id=b.target_id WHERE a.user_id=? AND b.user_id=? AND a.type=1 AND b.type=1', req.user.id, u.id).map((r) => pubUser(r.id));
  const note = get('SELECT note FROM notes WHERE user_id=? AND target_id=?', req.user.id, u.id)?.note || '';
  const rel = get('SELECT type FROM relationships WHERE user_id=? AND target_id=?', req.user.id, u.id)?.type || 0;
  res.json({ user: pubUser(u), mutual_guilds, mutual_friends, note, relationship: rel });
}));
app.put('/api/users/:id/note', auth, wrap((req, res) => {
  run('INSERT INTO notes VALUES(?,?,?) ON CONFLICT(user_id,target_id) DO UPDATE SET note=excluded.note', req.user.id, req.params.id, String(req.body?.note || '').slice(0, 256));
  res.json({ ok: true });
}));

// ───── Arkadaşlar ─────
// type: 1=arkadaş, 2=engelli, 3=gelen istek, 4=giden istek
function setRel(a, b, type) {
  if (type === null) run('DELETE FROM relationships WHERE user_id=? AND target_id=?', a, b);
  else run('INSERT INTO relationships VALUES(?,?,?,?) ON CONFLICT(user_id,target_id) DO UPDATE SET type=excluded.type', a, b, type, Date.now());
  const r = get('SELECT * FROM relationships WHERE user_id=? AND target_id=?', a, b);
  emitUser(a, 'relationship:update', { id: b, type: r ? r.type : 0, user: pubUser(b) });
}
const relType = (a, b) => get('SELECT type FROM relationships WHERE user_id=? AND target_id=?', a, b)?.type || 0;
function addFriend(me, target) {
  if (target.id === me.id) fail(400, 'Kendini arkadaş olarak ekleyemezsin 🙂');
  const mine = relType(me.id, target.id), theirs = relType(target.id, me.id);
  if (theirs === 2) fail(400, 'Bu kullanıcıya istek gönderilemiyor');
  if (mine === 1) fail(400, 'Zaten arkadaşsınız');
  if (mine === 3) { setRel(me.id, target.id, 1); setRel(target.id, me.id, 1); return 'accepted'; }
  setRel(me.id, target.id, 4); setRel(target.id, me.id, 3);
  return 'sent';
}
app.post('/api/relationships', auth, wrap((req, res) => {
  limit('rel:' + req.user.id, 30, 60_000);
  const t = get('SELECT * FROM users WHERE username=?', String(req.body?.username || '').trim().toLowerCase().replace(/^@/, ''));
  if (!t) fail(404, 'Bu kullanıcı adına sahip kimse yok. Yazımı kontrol et.');
  res.json({ result: addFriend(req.user, t) });
}));
app.put('/api/relationships/:id', auth, wrap((req, res) => {
  const t = getUser(req.params.id);
  if (!t) fail(404, 'Kullanıcı bulunamadı');
  res.json({ result: addFriend(req.user, t) });
}));
app.post('/api/relationships/:id/block', auth, wrap((req, res) => {
  const tid = req.params.id;
  if (!getUser(tid) || tid === req.user.id) fail(400, 'Geçersiz');
  setRel(req.user.id, tid, 2);
  if (relType(tid, req.user.id) !== 2) setRel(tid, req.user.id, null);
  res.json({ ok: true });
}));
app.delete('/api/relationships/:id', auth, wrap((req, res) => {
  const tid = req.params.id, mine = relType(req.user.id, tid);
  setRel(req.user.id, tid, null);
  if (mine !== 2 && relType(tid, req.user.id) !== 2) setRel(tid, req.user.id, null);
  res.json({ ok: true });
}));

// ───── DM ─────
app.post('/api/dms', auth, wrap((req, res) => {
  const ids = [...new Set((req.body?.recipients || []).map(String))].filter((x) => x !== req.user.id);
  if (!ids.length || ids.length > 9) fail(400, 'Grup DM en fazla 10 kişi olabilir');
  for (const id of ids) if (!getUser(id)) fail(404, 'Kullanıcı bulunamadı');
  if (ids.length === 1) {
    if (relType(ids[0], req.user.id) === 2) fail(403, 'Bu kullanıcıya mesaj gönderemezsin');
    const ex = get("SELECT c.* FROM channels c JOIN dm_members a ON a.channel_id=c.id JOIN dm_members b ON b.channel_id=c.id WHERE c.type='dm' AND a.user_id=? AND b.user_id=?", req.user.id, ids[0]);
    if (ex) return res.json(channelPayload(ex));
  }
  const id = genId();
  const type = ids.length === 1 ? 'dm' : 'group';
  tx(() => {
    run('INSERT INTO channels(id,guild_id,type,name,owner_id,last_message_id,created_at) VALUES(?,?,?,?,?,?,?)', id, null, type, type === 'group' ? String(req.body?.name || '').slice(0, 100) : null, req.user.id, id, Date.now());
    for (const u of [req.user.id, ...ids]) run('INSERT INTO dm_members VALUES(?,?)', id, u);
  });
  const ch = channelPayload(getChannel(id));
  for (const u of [req.user.id, ...ids]) emitUser(u, 'dm:create', ch);
  res.json(ch);
}));
app.post('/api/dms/:id/recipients', auth, wrap((req, res) => {
  const ch = getChannel(req.params.id);
  if (!ch || ch.type !== 'group' || !canView(ch, req.user.id)) fail(404, 'Grup bulunamadı');
  const uid = String(req.body?.user_id || '');
  if (!getUser(uid)) fail(404, 'Kullanıcı bulunamadı');
  run('INSERT OR IGNORE INTO dm_members VALUES(?,?)', ch.id, uid);
  const p = channelPayload(getChannel(ch.id));
  for (const u of channelAudience(ch)) emitUser(u, 'dm:create', p);
  systemMessage(ch, req.user.id, `<@${uid}> gruba eklendi`);
  res.json(p);
}));
app.delete('/api/dms/:id', auth, wrap((req, res) => {
  const ch = getChannel(req.params.id);
  if (!ch || ch.guild_id) fail(404, 'Bulunamadı');
  if (ch.type === 'group') {
    run('DELETE FROM dm_members WHERE channel_id=? AND user_id=?', ch.id, req.user.id);
    emitUser(req.user.id, 'dm:delete', { id: ch.id });
    const p = channelPayload(ch);
    for (const u of channelAudience(ch)) emitUser(u, 'dm:create', p);
    if (!p.recipients.length) run('DELETE FROM channels WHERE id=?', ch.id);
    else systemMessage(ch, req.user.id, `<@${req.user.id}> gruptan ayrıldı`);
  } else emitUser(req.user.id, 'dm:delete', { id: ch.id }); // birebir DM sadece gizlenir
  res.json({ ok: true });
}));

// ───── Sunucular ─────
function createGuild(owner, name, icon, template) {
  const gid = genId();
  tx(() => {
    run('INSERT INTO guilds(id,name,icon,owner_id,created_at) VALUES(?,?,?,?,?)', gid, name, icon, owner.id, Date.now());
    run('INSERT INTO roles VALUES(?,?,?,?,?,?,?)', gid, gid, '@everyone', null, DEFAULT_PERMS, 0, 0);
    run('INSERT INTO members VALUES(?,?,?,?)', gid, owner.id, null, Date.now());
    const cat1 = genId(), cat2 = genId(), general = genId();
    const mk = (id, type, nm, parent, pos) => run('INSERT INTO channels(id,guild_id,type,name,parent_id,position,created_at) VALUES(?,?,?,?,?,?,?)', id, gid, type, nm, parent, pos, Date.now());
    mk(cat1, 'category', 'Metin Kanalları', null, 0);
    mk(cat2, 'category', 'Ses Kanalları', null, 1);
    mk(general, 'text', 'genel', cat1, 0);
    if (template === 'gaming') { mk(genId(), 'text', 'klipler-ve-anlar', cat1, 1); mk(genId(), 'text', 'oyun-arkadaşı-arama', cat1, 2); mk(genId(), 'voice', 'Lobi', cat2, 0); mk(genId(), 'voice', 'Oyun', cat2, 1); }
    else if (template === 'study') { mk(genId(), 'text', 'kaynaklar', cat1, 1); mk(genId(), 'text', 'ödevler', cat1, 2); mk(genId(), 'voice', 'Çalışma Odası', cat2, 0); mk(genId(), 'voice', 'Pomodoro', cat2, 1); }
    else if (template === 'friends') { mk(genId(), 'text', 'caps-ve-meme', cat1, 1); mk(genId(), 'text', 'plan-program', cat1, 2); mk(genId(), 'voice', 'Muhabbet', cat2, 0); mk(genId(), 'voice', 'Film Gecesi', cat2, 1); }
    else mk(genId(), 'voice', 'Genel', cat2, 0);
    run('UPDATE guilds SET system_channel_id=? WHERE id=?', general, gid);
    run('INSERT INTO roles VALUES(?,?,?,?,?,?,?)', genId(), gid, 'Yönetici', '#ed4245', P.ADMIN | DEFAULT_PERMS, 2, 1);
    run('INSERT INTO roles VALUES(?,?,?,?,?,?,?)', genId(), gid, 'Moderatör', '#3498db', DEFAULT_PERMS | P.MANAGE_MESSAGES | P.KICK | P.MUTE_MEMBERS | P.MOVE_MEMBERS, 1, 1);
  });
  const g = get('SELECT * FROM guilds WHERE id=?', gid);
  systemMessage(getChannel(g.system_channel_id), owner.id, `**${name}** sunucusuna hoş geldin! 🎉 Arkadaşlarını davet etmek için sunucu adına tıkla → **İnsanları Davet Et**.`);
  return gid;
}
app.post('/api/guilds', auth, imageOnly.single('icon'), wrap((req, res) => {
  limit('guild:' + req.user.id, 10, 3600_000);
  const name = String(req.body?.name || '').trim().slice(0, 100);
  if (!name) fail(400, 'Sunucu adı gerekli');
  if (get('SELECT COUNT(*) n FROM members WHERE user_id=?', req.user.id).n >= 200) fail(400, 'En fazla 200 sunucuda bulunabilirsin');
  const gid = createGuild(req.user, name, req.file ? fileUrl(req.file) : null, req.body?.template);
  const p = guildPayload(gid, req.user.id);
  emitUser(req.user.id, 'guild:sync', p);
  res.json(p);
}));
app.patch('/api/guilds/:id', auth, imageOnly.fields([{ name: 'icon' }, { name: 'banner' }]), wrap((req, res) => {
  const gid = req.params.id;
  needPerm(gid, req.user.id, P.MANAGE_GUILD);
  const b = req.body || {};
  if (b.name) run('UPDATE guilds SET name=? WHERE id=?', String(b.name).slice(0, 100), gid);
  if (b.description !== undefined) run('UPDATE guilds SET description=? WHERE id=?', String(b.description).slice(0, 300), gid);
  if (b.system_channel_id !== undefined) run('UPDATE guilds SET system_channel_id=? WHERE id=?', b.system_channel_id || null, gid);
  if (req.files?.icon) run('UPDATE guilds SET icon=? WHERE id=?', fileUrl(req.files.icon[0]), gid);
  if (req.files?.banner) run('UPDATE guilds SET banner=? WHERE id=?', fileUrl(req.files.banner[0]), gid);
  if (b.remove_icon === '1' || b.remove_icon === true) run('UPDATE guilds SET icon=NULL WHERE id=?', gid);
  if (b.owner_id) {
    const g = get('SELECT owner_id FROM guilds WHERE id=?', gid);
    if (g.owner_id !== req.user.id) fail(403, 'Sadece sunucu sahibi devredebilir');
    needMember(gid, b.owner_id);
    run('UPDATE guilds SET owner_id=? WHERE id=?', b.owner_id, gid);
  }
  audit(gid, req.user.id, 'guild_update', 'Sunucu ayarlarını güncelledi');
  syncGuild(gid);
  res.json(guildPayload(gid, req.user.id));
}));
app.delete('/api/guilds/:id', auth, wrap((req, res) => {
  const g = get('SELECT * FROM guilds WHERE id=?', req.params.id);
  if (!g || g.owner_id !== req.user.id) fail(403, 'Sadece sunucu sahibi silebilir');
  const ids = guildMemberIds(g.id);
  for (const [uid, v] of voice) if (v.guild_id === g.id) leaveVoice(uid);
  run('DELETE FROM guilds WHERE id=?', g.id);
  run('DELETE FROM channels WHERE guild_id=?', g.id);
  for (const u of ids) emitUser(u, 'guild:delete', { id: g.id });
  res.json({ ok: true });
}));
app.get('/api/guilds/:id/audit', auth, wrap((req, res) => {
  needPerm(req.params.id, req.user.id, P.MANAGE_GUILD);
  res.json(all('SELECT * FROM audit_log WHERE guild_id=? ORDER BY id DESC LIMIT 100', req.params.id).map((a) => ({ ...a, user: pubUser(a.user_id) })));
}));

// ───── Üyeler ─────
function removeMember(gid, uid) {
  if (voice.get(uid)?.guild_id === gid) leaveVoice(uid);
  run('DELETE FROM members WHERE guild_id=? AND user_id=?', gid, uid);
  run('DELETE FROM member_roles WHERE guild_id=? AND user_id=?', gid, uid);
  emitUser(uid, 'guild:delete', { id: gid });
  syncGuild(gid);
}
app.delete('/api/guilds/:gid/members/:uid', auth, wrap((req, res) => {
  const { gid } = req.params;
  const uid = req.params.uid === '@me' ? req.user.id : req.params.uid;
  const g = get('SELECT * FROM guilds WHERE id=?', gid);
  if (!g) fail(404, 'Sunucu bulunamadı');
  if (uid === req.user.id) {
    if (g.owner_id === uid) fail(400, 'Sunucu sahibi ayrılamaz; önce sahipliği devret veya sunucuyu sil');
    removeMember(gid, uid);
    return res.json({ ok: true });
  }
  needPerm(gid, req.user.id, P.KICK);
  if (uid === g.owner_id || topRolePos(gid, uid) >= topRolePos(gid, req.user.id)) fail(403, 'Bu üyeyi atamazsın (rolü seninkinden yüksek/eşit)');
  audit(gid, req.user.id, 'kick', `<@${uid}> kullanıcısını attı`);
  removeMember(gid, uid);
  res.json({ ok: true });
}));
app.patch('/api/guilds/:gid/members/:uid', auth, wrap((req, res) => {
  const { gid } = req.params;
  const uid = req.params.uid === '@me' ? req.user.id : req.params.uid;
  needMember(gid, uid);
  const b = req.body || {};
  if (b.nick !== undefined) {
    if (uid !== req.user.id) needPerm(gid, req.user.id, P.MANAGE_GUILD);
    run('UPDATE members SET nick=? WHERE guild_id=? AND user_id=?', String(b.nick || '').slice(0, 32) || null, gid, uid);
  }
  if (Array.isArray(b.roles)) {
    needPerm(gid, req.user.id, P.MANAGE_ROLES);
    const myTop = topRolePos(gid, req.user.id);
    const current = memberRoleIds(gid, uid);
    const want = b.roles.map(String).filter((r) => r !== gid);
    const changed = [...current.filter((r) => !want.includes(r)), ...want.filter((r) => !current.includes(r))];
    for (const rid of changed) {
      const role = get('SELECT * FROM roles WHERE id=? AND guild_id=?', rid, gid);
      if (!role) fail(400, 'Rol bulunamadı');
      if (role.position >= myTop) fail(403, `"${role.name}" rolünü yönetemezsin (seninkinden yüksek)`);
    }
    tx(() => {
      run('DELETE FROM member_roles WHERE guild_id=? AND user_id=?', gid, uid);
      for (const r of want) run('INSERT OR IGNORE INTO member_roles VALUES(?,?,?)', gid, uid, r);
    });
    audit(gid, req.user.id, 'member_roles', `<@${uid}> rollerini güncelledi`);
  }
  syncGuild(gid);
  res.json({ ok: true });
}));

// ───── Yasaklar ─────
app.get('/api/guilds/:gid/bans', auth, wrap((req, res) => {
  needPerm(req.params.gid, req.user.id, P.BAN);
  res.json(all('SELECT * FROM bans WHERE guild_id=?', req.params.gid).map((b) => ({ ...b, user: pubUser(b.user_id) })));
}));
app.put('/api/guilds/:gid/bans/:uid', auth, wrap((req, res) => {
  const { gid, uid } = req.params;
  needPerm(gid, req.user.id, P.BAN);
  const g = get('SELECT * FROM guilds WHERE id=?', gid);
  if (uid === g.owner_id || uid === req.user.id || topRolePos(gid, uid) >= topRolePos(gid, req.user.id)) fail(403, 'Bu üyeyi yasaklayamazsın');
  run('INSERT OR REPLACE INTO bans VALUES(?,?,?,?)', gid, uid, String(req.body?.reason || '').slice(0, 200), Date.now());
  if (req.body?.delete_messages) {
    const chs = all('SELECT id FROM channels WHERE guild_id=?', gid);
    for (const c of chs) {
      const ms = all('SELECT id FROM messages WHERE channel_id=? AND author_id=? AND created_at>?', c.id, uid, Date.now() - 86400_000 * 7);
      for (const m of ms) deleteMessage(getChannel(c.id), m.id);
    }
  }
  audit(gid, req.user.id, 'ban', `<@${uid}> kullanıcısını yasakladı`);
  if (get('SELECT 1 FROM members WHERE guild_id=? AND user_id=?', gid, uid)) removeMember(gid, uid);
  res.json({ ok: true });
}));
app.delete('/api/guilds/:gid/bans/:uid', auth, wrap((req, res) => {
  needPerm(req.params.gid, req.user.id, P.BAN);
  run('DELETE FROM bans WHERE guild_id=? AND user_id=?', req.params.gid, req.params.uid);
  audit(req.params.gid, req.user.id, 'unban', `<@${req.params.uid}> yasağını kaldırdı`);
  res.json({ ok: true });
}));

// ───── Roller ─────
app.post('/api/guilds/:gid/roles', auth, wrap((req, res) => {
  const { gid } = req.params;
  needPerm(gid, req.user.id, P.MANAGE_ROLES);
  const pos = (get('SELECT MAX(position) p FROM roles WHERE guild_id=?', gid).p || 0) + 1;
  const myTop = topRolePos(gid, req.user.id);
  const id = genId();
  run('INSERT INTO roles VALUES(?,?,?,?,?,?,?)', id, gid, String(req.body?.name || 'yeni rol').slice(0, 64), req.body?.color || '#99aab5', DEFAULT_PERMS, Math.min(pos, myTop === Infinity ? pos : myTop - 0.5), 0);
  normalizeRoles(gid);
  audit(gid, req.user.id, 'role_create', 'Yeni rol oluşturdu');
  syncGuild(gid);
  res.json(get('SELECT * FROM roles WHERE id=?', id));
}));
function normalizeRoles(gid) {
  all("SELECT id FROM roles WHERE guild_id=? AND id!=? ORDER BY position, id", gid, gid).forEach((r, i) => run('UPDATE roles SET position=? WHERE id=?', i + 1, r.id));
}
app.patch('/api/roles/:id', auth, wrap((req, res) => {
  const role = get('SELECT * FROM roles WHERE id=?', req.params.id);
  if (!role) fail(404, 'Rol bulunamadı');
  needPerm(role.guild_id, req.user.id, P.MANAGE_ROLES);
  const myTop = topRolePos(role.guild_id, req.user.id);
  if (role.id !== role.guild_id && role.position >= myTop) fail(403, 'Bu rolü düzenleyemezsin');
  const b = req.body || {};
  const myPerms = guildPerms(role.guild_id, req.user.id);
  if (b.name !== undefined && role.id !== role.guild_id) run('UPDATE roles SET name=? WHERE id=?', String(b.name).slice(0, 64), role.id);
  if (b.color !== undefined) run('UPDATE roles SET color=? WHERE id=?', /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : null, role.id);
  if (b.hoist !== undefined) run('UPDATE roles SET hoist=? WHERE id=?', b.hoist ? 1 : 0, role.id);
  if (b.permissions !== undefined) {
    const np = Number(b.permissions) & ALL_PERMS;
    if ((np & ~myPerms) & ~role.permissions) fail(403, 'Sahip olmadığın yetkileri veremezsin');
    run('UPDATE roles SET permissions=? WHERE id=?', np, role.id);
  }
  if (b.position !== undefined && role.id !== role.guild_id) {
    const np = Number(b.position);
    if (np >= myTop) fail(403, 'Rolü kendi rolünün üstüne taşıyamazsın');
    run('UPDATE roles SET position=? WHERE id=?', np + (np > role.position ? 0.5 : -0.5), role.id);
    normalizeRoles(role.guild_id);
  }
  audit(role.guild_id, req.user.id, 'role_update', `"${role.name}" rolünü güncelledi`);
  syncGuild(role.guild_id);
  res.json(get('SELECT * FROM roles WHERE id=?', role.id));
}));
app.delete('/api/roles/:id', auth, wrap((req, res) => {
  const role = get('SELECT * FROM roles WHERE id=?', req.params.id);
  if (!role || role.id === role.guild_id) fail(400, 'Bu rol silinemez');
  needPerm(role.guild_id, req.user.id, P.MANAGE_ROLES);
  if (role.position >= topRolePos(role.guild_id, req.user.id)) fail(403, 'Bu rolü silemezsin');
  run('DELETE FROM roles WHERE id=?', role.id);
  audit(role.guild_id, req.user.id, 'role_delete', `"${role.name}" rolünü sildi`);
  syncGuild(role.guild_id);
  res.json({ ok: true });
}));

// ───── Kanallar ─────
app.post('/api/guilds/:gid/channels', auth, wrap((req, res) => {
  const { gid } = req.params;
  needPerm(gid, req.user.id, P.MANAGE_CHANNELS);
  const type = ['text', 'voice', 'category', 'announcement', 'stage'].includes(req.body?.type) ? req.body.type : 'text';
  let name = String(req.body?.name || '').trim().slice(0, 100);
  if (type === 'text' || type === 'announcement') name = name.toLocaleLowerCase('tr').replace(/\s+/g, '-');
  if (!name) fail(400, 'Kanal adı gerekli');
  const parent = req.body?.parent_id && get("SELECT id FROM channels WHERE id=? AND guild_id=? AND type='category'", req.body.parent_id, gid) ? req.body.parent_id : null;
  const pos = (get('SELECT MAX(position) p FROM channels WHERE guild_id=? AND parent_id IS ?', gid, parent).p ?? -1) + 1;
  const id = genId();
  const priv = Array.isArray(req.body?.private_roles) ? JSON.stringify(req.body.private_roles.map(String)) : null;
  run('INSERT INTO channels(id,guild_id,type,name,topic,parent_id,position,private_roles,created_at) VALUES(?,?,?,?,?,?,?,?,?)', id, gid, type, name, String(req.body?.topic || ''), parent, pos, priv, Date.now());
  audit(gid, req.user.id, 'channel_create', `#${name} kanalını oluşturdu`);
  syncGuild(gid);
  res.json(channelPayload(getChannel(id)));
}));
app.patch('/api/channels/:id', auth, wrap((req, res) => {
  const ch = getChannel(req.params.id);
  if (!ch) fail(404, 'Kanal bulunamadı');
  if (!ch.guild_id) {
    if (ch.type !== 'group' || !canView(ch, req.user.id)) fail(403, 'Yetkin yok');
    if (req.body?.name !== undefined) run('UPDATE channels SET name=? WHERE id=?', String(req.body.name).slice(0, 100), ch.id);
    const p = channelPayload(getChannel(ch.id));
    for (const u of channelAudience(ch)) emitUser(u, 'dm:create', p);
    return res.json(p);
  }
  needPerm(ch.guild_id, req.user.id, P.MANAGE_CHANNELS);
  const b = req.body || {};
  if (b.name !== undefined) {
    let name = String(b.name).trim().slice(0, 100);
    if (ch.type === 'text' || ch.type === 'announcement') name = name.toLocaleLowerCase('tr').replace(/\s+/g, '-');
    if (name) run('UPDATE channels SET name=? WHERE id=?', name, ch.id);
  }
  if (b.topic !== undefined) run('UPDATE channels SET topic=? WHERE id=?', String(b.topic).slice(0, 1024), ch.id);
  if (b.slowmode !== undefined) run('UPDATE channels SET slowmode=? WHERE id=?', Math.max(0, Math.min(21600, Number(b.slowmode) || 0)), ch.id);
  if (b.private_roles !== undefined) run('UPDATE channels SET private_roles=? WHERE id=?', Array.isArray(b.private_roles) ? JSON.stringify(b.private_roles.map(String)) : null, ch.id);
  if (b.parent_id !== undefined) run('UPDATE channels SET parent_id=? WHERE id=?', b.parent_id || null, ch.id);
  if (b.position !== undefined) run('UPDATE channels SET position=? WHERE id=?', Number(b.position) || 0, ch.id);
  audit(ch.guild_id, req.user.id, 'channel_update', `#${ch.name} kanalını düzenledi`);
  syncGuild(ch.guild_id);
  res.json(channelPayload(getChannel(ch.id)));
}));
app.post('/api/guilds/:gid/channels/reorder', auth, wrap((req, res) => {
  const { gid } = req.params;
  needPerm(gid, req.user.id, P.MANAGE_CHANNELS);
  tx(() => { for (const c of req.body?.channels || []) run('UPDATE channels SET position=?, parent_id=? WHERE id=? AND guild_id=?', Number(c.position) || 0, c.parent_id || null, c.id, gid); });
  syncGuild(gid);
  res.json({ ok: true });
}));
app.delete('/api/channels/:id', auth, wrap((req, res) => {
  const ch = getChannel(req.params.id);
  if (!ch || !ch.guild_id) fail(404, 'Kanal bulunamadı');
  needPerm(ch.guild_id, req.user.id, P.MANAGE_CHANNELS);
  for (const [uid, v] of voice) if (v.channel_id === ch.id) leaveVoice(uid);
  run('UPDATE channels SET parent_id=NULL WHERE parent_id=?', ch.id);
  run('DELETE FROM channels WHERE id=?', ch.id);
  audit(ch.guild_id, req.user.id, 'channel_delete', `#${ch.name} kanalını sildi`);
  syncGuild(ch.guild_id);
  res.json({ ok: true });
}));

// ───── Davetler ─────
function inviteCode() { const a = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 8; i++) s += a[crypto.randomInt(a.length)]; return s; }
app.post('/api/guilds/:gid/invites', auth, wrap((req, res) => {
  const { gid } = req.params;
  needPerm(gid, req.user.id, P.INVITE);
  const maxAge = Number(req.body?.max_age ?? 604800);
  const maxUses = Math.max(0, Number(req.body?.max_uses || 0));
  if (!maxAge && !maxUses) {
    const ex = get('SELECT * FROM invites WHERE guild_id=? AND inviter_id=? AND expires_at IS NULL AND max_uses=0', gid, req.user.id);
    if (ex) return res.json(ex);
  }
  const code = inviteCode();
  run('INSERT INTO invites VALUES(?,?,?,?,?,?,?,?)', code, gid, req.body?.channel_id || null, req.user.id, 0, maxUses, maxAge ? Date.now() + maxAge * 1000 : null, Date.now());
  res.json(get('SELECT * FROM invites WHERE code=?', code));
}));
app.get('/api/guilds/:gid/invites', auth, wrap((req, res) => {
  needPerm(req.params.gid, req.user.id, P.MANAGE_GUILD);
  res.json(all('SELECT * FROM invites WHERE guild_id=? ORDER BY created_at DESC', req.params.gid).map((i) => ({ ...i, inviter: pubUser(i.inviter_id) })));
}));
function validInvite(code) {
  const inv = get('SELECT * FROM invites WHERE code=?', code);
  if (!inv) return null;
  if ((inv.expires_at && inv.expires_at < Date.now()) || (inv.max_uses && inv.uses >= inv.max_uses)) return null;
  return inv;
}
app.get('/api/invites/:code', wrap((req, res) => {
  const inv = validInvite(req.params.code);
  if (!inv) fail(404, 'Davet geçersiz veya süresi dolmuş');
  const g = get('SELECT id,name,icon,banner,description FROM guilds WHERE id=?', inv.guild_id);
  const count = get('SELECT COUNT(*) n FROM members WHERE guild_id=?', g.id).n;
  const onlineCount = guildMemberIds(g.id).filter((u) => online.has(u)).length;
  res.json({ code: inv.code, guild: g, member_count: count, online_count: onlineCount, inviter: pubUser(inv.inviter_id) });
}));
app.post('/api/invites/:code', auth, wrap((req, res) => {
  const inv = validInvite(req.params.code);
  if (!inv) fail(404, 'Davet geçersiz veya süresi dolmuş');
  const gid = inv.guild_id;
  if (get('SELECT 1 FROM bans WHERE guild_id=? AND user_id=?', gid, req.user.id)) fail(403, 'Bu sunucudan yasaklandın');
  if (!get('SELECT 1 FROM members WHERE guild_id=? AND user_id=?', gid, req.user.id)) {
    run('INSERT INTO members VALUES(?,?,?,?)', gid, req.user.id, null, Date.now());
    run('UPDATE invites SET uses=uses+1 WHERE code=?', inv.code);
    const g = get('SELECT * FROM guilds WHERE id=?', gid);
    const sys = g.system_channel_id && getChannel(g.system_channel_id);
    const greetings = ['bir sunucuya atladı. Selam ver! 👋', 'partiye katıldı! 🎉', 'aramıza katıldı. Hoş geldin! ✨', 'geldi. Herkes davransın 😎', 'ortaya çıktı! 🚀'];
    if (sys) systemMessage(sys, req.user.id, `<@${req.user.id}> ${greetings[Math.floor(Math.random() * greetings.length)]}`, 'join');
    syncGuild(gid);
  }
  res.json(guildPayload(gid, req.user.id));
}));
app.delete('/api/invites/:code', auth, wrap((req, res) => {
  const inv = get('SELECT * FROM invites WHERE code=?', req.params.code);
  if (!inv) fail(404, 'Davet bulunamadı');
  if (inv.inviter_id !== req.user.id) needPerm(inv.guild_id, req.user.id, P.MANAGE_GUILD);
  run('DELETE FROM invites WHERE code=?', inv.code);
  res.json({ ok: true });
}));

// ───── Emojiler ─────
app.post('/api/guilds/:gid/emojis', auth, imageOnly.single('file'), wrap((req, res) => {
  const { gid } = req.params;
  needPerm(gid, req.user.id, P.MANAGE_EMOJIS);
  if (!req.file) fail(400, 'Resim gerekli');
  if (req.file.size > 512 * 1024) { fs.unlink(req.file.path, () => {}); fail(400, 'Emoji en fazla 512KB olabilir'); }
  const name = String(req.body?.name || '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32) || 'emoji';
  if (get('SELECT COUNT(*) n FROM emojis WHERE guild_id=?', gid).n >= 250) fail(400, 'Emoji sınırına ulaşıldı (250)');
  const id = genId();
  run('INSERT INTO emojis VALUES(?,?,?,?,?,?)', id, gid, name, req.file.filename, req.file.mimetype === 'image/gif' ? 1 : 0, req.user.id);
  syncGuild(gid);
  res.json(get('SELECT id,name,animated,guild_id FROM emojis WHERE id=?', id));
}));
app.delete('/api/emojis/:id', auth, wrap((req, res) => {
  const e = get('SELECT * FROM emojis WHERE id=?', req.params.id);
  if (!e) fail(404, 'Emoji bulunamadı');
  needPerm(e.guild_id, req.user.id, P.MANAGE_EMOJIS);
  run('DELETE FROM emojis WHERE id=?', e.id);
  syncGuild(e.guild_id);
  res.json({ ok: true });
}));
app.get('/api/emojis/:id', (req, res) => {
  const e = get('SELECT file FROM emojis WHERE id=?', req.params.id);
  if (!e) return res.status(404).end();
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(UPLOAD_DIR, e.file));
});
app.get('/api/me/emojis', auth, wrap((req, res) => {
  res.json(all('SELECT e.id,e.name,e.animated,e.guild_id FROM emojis e JOIN members m ON m.guild_id=e.guild_id WHERE m.user_id=?', req.user.id));
}));

// ───── Mesajlar ─────
const lastSent = new Map();
function systemMessage(ch, authorId, content, type = 'system') {
  if (!ch) return;
  const id = genId();
  run('INSERT INTO messages(id,channel_id,author_id,content,type,created_at) VALUES(?,?,?,?,?,?)', id, ch.id, authorId, content, type, Date.now());
  run('UPDATE channels SET last_message_id=? WHERE id=?', id, ch.id);
  emitChannel(ch, 'message:create', messagePayload(get('SELECT * FROM messages WHERE id=?', id)));
}
function insertMessage(ch, authorId, { content = '', attachments = [], reply_to = null, poll = null, expires_at = null }) {
  const id = genId();
  run('INSERT INTO messages(id,channel_id,author_id,content,attachments,reply_to,poll,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?)', id, ch.id, authorId, content, JSON.stringify(attachments), reply_to, poll ? JSON.stringify(poll) : null, expires_at, Date.now());
  run('UPDATE channels SET last_message_id=? WHERE id=?', id, ch.id);
  run('INSERT INTO read_states VALUES(?,?,?) ON CONFLICT(user_id,channel_id) DO UPDATE SET last_read_id=excluded.last_read_id', authorId, ch.id, id);
  const msg = messagePayload(get('SELECT * FROM messages WHERE id=?', id));
  if (!ch.guild_id) for (const u of channelAudience(ch)) emitUser(u, 'dm:create', channelPayload(getChannel(ch.id)));
  emitChannel(ch, 'message:create', msg);
  return msg;
}
function deleteMessage(ch, id) {
  run('DELETE FROM messages WHERE id=?', id);
  emitChannel(ch, 'message:delete', { id, channel_id: ch.id });
}
function canSend(ch, uid) {
  if (!canView(ch, uid)) fail(404, 'Kanal bulunamadı');
  if (ch.guild_id) {
    const p = guildPerms(ch.guild_id, uid);
    if (!(p & P.SEND)) fail(403, 'Bu kanala mesaj gönderemezsin');
    if (ch.type === 'announcement' && !(p & P.MANAGE_MESSAGES)) fail(403, 'Duyuru kanalına sadece moderatörler yazabilir');
    if (ch.type === 'category') fail(400, 'Kategoriye mesaj gönderilemez');
    return p;
  }
  if (ch.type === 'dm') {
    const other = all('SELECT user_id FROM dm_members WHERE channel_id=? AND user_id!=?', ch.id, uid)[0]?.user_id;
    if (other && (relType(other, uid) === 2 || relType(uid, other) === 2)) fail(403, 'Bu kullanıcıyla mesajlaşamazsın (engelleme)');
  }
  return ALL_PERMS;
}
app.get('/api/channels/:id/messages', auth, wrap((req, res) => {
  const ch = getChannel(req.params.id);
  if (!canView(ch, req.user.id)) fail(404, 'Kanal bulunamadı');
  const lim = Math.min(100, Number(req.query.limit) || 50);
  let rows;
  if (req.query.around) {
    const a = all('SELECT * FROM messages WHERE channel_id=? AND id<=? ORDER BY id DESC LIMIT ?', ch.id, req.query.around, Math.ceil(lim / 2));
    const b = all('SELECT * FROM messages WHERE channel_id=? AND id>? ORDER BY id ASC LIMIT ?', ch.id, req.query.around, Math.floor(lim / 2));
    rows = [...a.reverse(), ...b];
  } else if (req.query.before) rows = all('SELECT * FROM messages WHERE channel_id=? AND id<? ORDER BY id DESC LIMIT ?', ch.id, req.query.before, lim).reverse();
  else rows = all('SELECT * FROM messages WHERE channel_id=? ORDER BY id DESC LIMIT ?', ch.id, lim).reverse();
  res.json(rows.map(messagePayload));
}));
app.post('/api/channels/:id/messages', auth, upload.array('files', 10), wrap((req, res) => {
  const ch = getChannel(req.params.id);
  const p = canSend(ch, req.user.id);
  limit('msg:' + req.user.id, 30, 10_000);
  const b = req.body || {};
  let content = String(b.content || '').slice(0, 4000);
  const files = req.files || [];
  if (files.length && ch.guild_id && !(p & P.ATTACH)) fail(403, 'Dosya yükleme yetkin yok');
  if (ch.slowmode && !(p & P.MANAGE_MESSAGES)) {
    const k = ch.id + ':' + req.user.id, last = lastSent.get(k) || 0;
    if (Date.now() - last < ch.slowmode * 1000) fail(429, `Yavaş mod açık: ${Math.ceil((ch.slowmode * 1000 - (Date.now() - last)) / 1000)} sn bekle`);
    lastSent.set(k, Date.now());
  }
  if (/@(everyone|here)/.test(content) && ch.guild_id && !(p & P.MENTION_EVERYONE)) content = content.replace(/@(everyone|here)/g, '@​$1');
  // Sunucu taraflı eğlenceli komutlar
  const cmd = content.match(/^\/(zar|yazitura|8top|sec)\b\s*(.*)$/i);
  if (cmd && !files.length) {
    const c = cmd[1].toLowerCase(), arg = cmd[2].trim();
    if (c === 'zar') { const n = Math.max(2, Math.min(1000, parseInt(arg) || 6)); content = `🎲 **${crypto.randomInt(1, n + 1)}** attı (1-${n})`; }
    if (c === 'yazitura') content = crypto.randomInt(2) ? '🪙 Para havaya atıldı… **YAZI**!' : '🪙 Para havaya atıldı… **TURA**!';
    if (c === '8top') { const a = ['Kesinlikle evet.', 'Hiç şüphem yok.', 'Büyük ihtimalle.', 'Belirtiler evet diyor.', 'Şimdi söylemesem daha iyi…', 'Tekrar sor.', 'Pek sanmıyorum.', 'Kaynaklarım hayır diyor.', 'Hiç umutlanma.']; content = `🎱 ${arg ? `"${arg}" — ` : ''}**${a[crypto.randomInt(a.length)]}**`; }
    if (c === 'sec') { const opts = arg.split(/[,|]/).map((s) => s.trim()).filter(Boolean); content = opts.length ? `🤔 Seçimim: **${opts[crypto.randomInt(opts.length)]}**` : 'Kullanım: /sec pizza, döner, lahmacun'; }
  }
  const attachments = files.map((f) => ({ url: fileUrl(f), name: Buffer.from(f.originalname, 'latin1').toString('utf8').slice(0, 200), size: f.size, type: f.mimetype, spoiler: String(b.spoiler || '') === '1' }));
  if (b.gif_url && /^(https?:\/\/|\/uploads\/)/.test(b.gif_url)) attachments.push({ url: String(b.gif_url).slice(0, 500), name: 'gif', type: 'image/gif', external: true });
  let poll = null;
  if (b.poll) {
    try {
      const pp = typeof b.poll === 'string' ? JSON.parse(b.poll) : b.poll;
      const options = (pp.options || []).map((o) => String(o).trim().slice(0, 80)).filter(Boolean).slice(0, 10);
      if (options.length < 2) fail(400, 'Anket için en az 2 seçenek gerekli');
      poll = { question: String(pp.question || '').slice(0, 300), options, multi: !!pp.multi, ends_at: pp.hours ? Date.now() + Math.min(720, Number(pp.hours)) * 3600_000 : null };
    } catch (e) { if (e instanceof HttpErr) throw e; fail(400, 'Geçersiz anket'); }
  }
  if (!content.trim() && !attachments.length && !poll) fail(400, 'Boş mesaj gönderilemez');
  const reply_to = b.reply_to && get('SELECT id FROM messages WHERE id=? AND channel_id=?', b.reply_to, ch.id) ? b.reply_to : null;
  const exp = Number(b.expires_in) > 0 ? Date.now() + Math.min(7 * 86400, Number(b.expires_in)) * 1000 : null;
  if (Number(b.send_at) > Date.now() + 5000) {
    if (attachments.length || poll) fail(400, 'Zamanlanmış mesajlar şimdilik sadece metin olabilir');
    const id = genId();
    run('INSERT INTO scheduled VALUES(?,?,?,?,?)', id, ch.id, req.user.id, content, Math.min(Number(b.send_at), Date.now() + 30 * 86400_000));
    return res.json({ scheduled: true, id });
  }
  res.json(insertMessage(ch, req.user.id, { content, attachments, reply_to, poll, expires_at: exp }));
}));
app.get('/api/channels/:id/scheduled', auth, wrap((req, res) => {
  res.json(all('SELECT * FROM scheduled WHERE channel_id=? AND author_id=? ORDER BY send_at', req.params.id, req.user.id));
}));
app.delete('/api/scheduled/:id', auth, wrap((req, res) => { run('DELETE FROM scheduled WHERE id=? AND author_id=?', req.params.id, req.user.id); res.json({ ok: true }); }));
app.patch('/api/messages/:id', auth, wrap((req, res) => {
  const m = get('SELECT * FROM messages WHERE id=?', req.params.id);
  if (!m || m.author_id !== req.user.id || m.type !== 'default') fail(403, 'Bu mesajı düzenleyemezsin');
  const content = String(req.body?.content || '').slice(0, 4000);
  if (!content.trim() && (!m.attachments || m.attachments === '[]')) fail(400, 'Mesaj boş olamaz');
  run('UPDATE messages SET content=?, edited_at=? WHERE id=?', content, Date.now(), m.id);
  emitChannel(getChannel(m.channel_id), 'message:update', messagePayload(get('SELECT * FROM messages WHERE id=?', m.id)));
  res.json({ ok: true });
}));
app.delete('/api/messages/:id', auth, wrap((req, res) => {
  const m = get('SELECT * FROM messages WHERE id=?', req.params.id);
  if (!m) fail(404, 'Mesaj bulunamadı');
  const ch = getChannel(m.channel_id);
  if (m.author_id !== req.user.id) {
    if (!ch.guild_id) fail(403, 'Başkasının mesajını silemezsin');
    needPerm(ch.guild_id, req.user.id, P.MANAGE_MESSAGES);
    audit(ch.guild_id, req.user.id, 'message_delete', `<@${m.author_id}> kullanıcısının mesajını sildi`);
  }
  deleteMessage(ch, m.id);
  res.json({ ok: true });
}));
const emitMsgUpdate = (mid) => { const m = get('SELECT * FROM messages WHERE id=?', mid); if (m) emitChannel(getChannel(m.channel_id), 'message:update', messagePayload(m)); };
function msgForUser(mid, uid) {
  const m = get('SELECT * FROM messages WHERE id=?', mid);
  if (!m || !canView(getChannel(m.channel_id), uid)) fail(404, 'Mesaj bulunamadı');
  return m;
}
app.put('/api/messages/:id/reactions/:emoji', auth, wrap((req, res) => {
  const m = msgForUser(req.params.id, req.user.id);
  const emoji = String(req.params.emoji).slice(0, 80);
  if (get('SELECT COUNT(DISTINCT emoji) n FROM reactions WHERE message_id=?', m.id).n >= 20 && !get('SELECT 1 FROM reactions WHERE message_id=? AND emoji=?', m.id, emoji)) fail(400, 'Tepki sınırı');
  run('INSERT OR IGNORE INTO reactions VALUES(?,?,?,?)', m.id, req.user.id, emoji, Date.now());
  emitMsgUpdate(m.id);
  res.json({ ok: true });
}));
app.delete('/api/messages/:id/reactions/:emoji', auth, wrap((req, res) => {
  const m = msgForUser(req.params.id, req.user.id);
  run('DELETE FROM reactions WHERE message_id=? AND user_id=? AND emoji=?', m.id, req.user.id, req.params.emoji);
  emitMsgUpdate(m.id);
  res.json({ ok: true });
}));
app.put('/api/messages/:id/pin', auth, wrap((req, res) => {
  const m = msgForUser(req.params.id, req.user.id);
  const ch = getChannel(m.channel_id);
  if (ch.guild_id) needPerm(ch.guild_id, req.user.id, P.MANAGE_MESSAGES);
  const pin = req.body?.pinned !== false;
  run('UPDATE messages SET pinned=? WHERE id=?', pin ? 1 : 0, m.id);
  emitMsgUpdate(m.id);
  if (pin) systemMessage(ch, req.user.id, `<@${req.user.id}> bir mesajı bu kanala sabitledi.`, 'pin');
  res.json({ ok: true });
}));
app.get('/api/channels/:id/pins', auth, wrap((req, res) => {
  const ch = getChannel(req.params.id);
  if (!canView(ch, req.user.id)) fail(404, 'Kanal bulunamadı');
  res.json(all('SELECT * FROM messages WHERE channel_id=? AND pinned=1 ORDER BY id DESC', ch.id).map(messagePayload));
}));
app.post('/api/messages/:id/vote', auth, wrap((req, res) => {
  const m = msgForUser(req.params.id, req.user.id);
  if (!m.poll) fail(400, 'Bu bir anket değil');
  const poll = JSON.parse(m.poll);
  if (poll.ends_at && poll.ends_at < Date.now()) fail(400, 'Anket sona erdi');
  const opt = Number(req.body?.option);
  if (!(opt >= 0 && opt < poll.options.length)) fail(400, 'Geçersiz seçenek');
  const had = get('SELECT 1 FROM poll_votes WHERE message_id=? AND user_id=? AND option=?', m.id, req.user.id, opt);
  if (had) run('DELETE FROM poll_votes WHERE message_id=? AND user_id=? AND option=?', m.id, req.user.id, opt);
  else {
    if (!poll.multi) run('DELETE FROM poll_votes WHERE message_id=? AND user_id=?', m.id, req.user.id);
    run('INSERT INTO poll_votes VALUES(?,?,?)', m.id, req.user.id, opt);
  }
  emitMsgUpdate(m.id);
  res.json({ ok: true });
}));
app.post('/api/channels/:id/ack', auth, wrap((req, res) => {
  const ch = getChannel(req.params.id);
  if (!canView(ch, req.user.id)) return res.json({ ok: false });
  const mid = String(req.body?.message_id || ch.last_message_id || '');
  run('INSERT INTO read_states VALUES(?,?,?) ON CONFLICT(user_id,channel_id) DO UPDATE SET last_read_id=excluded.last_read_id', req.user.id, ch.id, mid);
  res.json({ ok: true });
}));
app.get('/api/search', auth, wrap((req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json([]);
  let channels;
  if (req.query.guild_id) channels = all('SELECT * FROM channels WHERE guild_id=?', req.query.guild_id).filter((c) => canView(c, req.user.id));
  else if (req.query.channel_id) channels = [getChannel(req.query.channel_id)].filter((c) => canView(c, req.user.id));
  else channels = [];
  if (!channels.length) return res.json([]);
  const ids = channels.map((c) => c.id);
  let sql = `SELECT * FROM messages WHERE channel_id IN (${ids.map(() => '?').join(',')}) AND content LIKE ? ESCAPE '\\'`;
  const params = [...ids, '%' + q.replace(/[%_\\]/g, '\\$&') + '%'];
  if (req.query.author_id) { sql += ' AND author_id=?'; params.push(req.query.author_id); }
  if (req.query.has === 'file') sql += " AND attachments!='[]'";
  sql += ' ORDER BY id DESC LIMIT 50';
  res.json(db.prepare(sql).all(...params).map(messagePayload));
}));

// ───── Yer imleri (kaydedilen mesajlar) ─────
app.get('/api/bookmarks', auth, wrap((req, res) => {
  res.json(all('SELECT m.* FROM bookmarks b JOIN messages m ON m.id=b.message_id WHERE b.user_id=? ORDER BY b.created_at DESC', req.user.id)
    .filter((m) => canView(getChannel(m.channel_id), req.user.id)).map((m) => {
      const ch = getChannel(m.channel_id);
      const g = ch.guild_id && get('SELECT name FROM guilds WHERE id=?', ch.guild_id);
      return { ...messagePayload(m), channel_name: ch.name, guild_id: ch.guild_id, guild_name: g?.name };
    }));
}));
app.put('/api/bookmarks/:id', auth, wrap((req, res) => { msgForUser(req.params.id, req.user.id); run('INSERT OR IGNORE INTO bookmarks VALUES(?,?,?)', req.user.id, req.params.id, Date.now()); res.json({ ok: true }); }));
app.delete('/api/bookmarks/:id', auth, wrap((req, res) => { run('DELETE FROM bookmarks WHERE user_id=? AND message_id=?', req.user.id, req.params.id); res.json({ ok: true }); }));

// ───── GIF ─────
app.get('/api/gifs', auth, wrap(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (TENOR_KEY) {
    try {
      const url = q ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&limit=30&locale=tr_TR&media_filter=gif,tinygif` : `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}&limit=30&locale=tr_TR&media_filter=gif,tinygif`;
      const r = await fetch(url);
      const j = await r.json();
      return res.json({ source: 'tenor', results: (j.results || []).map((x) => ({ url: x.media_formats.gif?.url, preview: x.media_formats.tinygif?.url || x.media_formats.gif?.url, title: x.content_description })) });
    } catch (e) { /* topluluk GIF'lerine düş */ }
  }
  // Tenor anahtarı yoksa: sunucuda paylaşılmış tüm GIF'ler (topluluk kütüphanesi)
  const rows = all("SELECT attachments FROM messages WHERE attachments LIKE '%image/gif%' ORDER BY id DESC LIMIT 400");
  const seen = new Set(), results = [];
  for (const r of rows) for (const a of JSON.parse(r.attachments)) {
    if (a.type !== 'image/gif' || seen.has(a.url) || a.external && !a.url.startsWith('/uploads/')) continue;
    if (q && !(a.name || '').toLowerCase().includes(q.toLowerCase())) continue;
    seen.add(a.url); results.push({ url: a.url, preview: a.url, title: a.name });
  }
  res.json({ source: 'community', results: results.slice(0, 60) });
}));
app.get('/api/gifs/favorites', auth, wrap((req, res) => res.json(all('SELECT url FROM fav_gifs WHERE user_id=? ORDER BY created_at DESC', req.user.id).map((r) => r.url))));
app.put('/api/gifs/favorites', auth, wrap((req, res) => { const u = String(req.body?.url || ''); if (/^(https?:\/\/|\/uploads\/)/.test(u)) run('INSERT OR IGNORE INTO fav_gifs VALUES(?,?,?)', req.user.id, u.slice(0, 500), Date.now()); res.json({ ok: true }); }));
app.delete('/api/gifs/favorites', auth, wrap((req, res) => { run('DELETE FROM fav_gifs WHERE user_id=? AND url=?', req.user.id, String(req.body?.url || '')); res.json({ ok: true }); }));
app.post('/api/upload', auth, upload.single('file'), wrap((req, res) => { if (!req.file) fail(400, 'Dosya yok'); res.json({ url: fileUrl(req.file), type: req.file.mimetype, size: req.file.size }); }));

app.get('/api/ice', auth, (req, res) => {
  const servers = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (process.env.TURN_URL) servers.push({ urls: process.env.TURN_URL.split(','), username: process.env.TURN_USER, credential: process.env.TURN_PASS });
  res.json(servers);
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Bulunamadı' }));
app.get(['/', '/app', '/app/*rest', '/invite/:code', '/login', '/register'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((err, req, res, next) => {
  if (err instanceof HttpErr) return res.status(err.code).json({ error: err.message });
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `Dosya çok büyük (en fazla ${MAX_UPLOAD_MB}MB)` });
  console.error(err);
  res.status(500).json({ error: 'Sunucu hatası' });
});

// ───────────────────────── Socket.IO ─────────────────────────
const server = process.env.SSL_CERT && process.env.SSL_KEY
  ? require('https').createServer({ cert: fs.readFileSync(process.env.SSL_CERT), key: fs.readFileSync(process.env.SSL_KEY) }, app)
  : http.createServer(app);
io = new Server(server, { maxHttpBufferSize: 1e6, pingInterval: 20000, pingTimeout: 20000 });

function voiceAudience(v) {
  if (v.guild_id) return guildMemberIds(v.guild_id);
  return all('SELECT user_id FROM dm_members WHERE channel_id=?', v.channel_id).map((r) => r.user_id);
}
function emitVoice(v, removed = false) {
  const payload = { ...voicePublic(v), removed };
  for (const u of voiceAudience(v)) emitUser(u, 'voice:state', payload);
}
function leaveVoice(uid) {
  const v = voice.get(uid);
  if (!v) return;
  voice.delete(uid);
  emitVoice(v, true);
  for (const o of voice.values()) if (o.channel_id === v.channel_id) io.to(o.socket_id).emit('voice:peer_left', { user_id: uid });
  io.to(v.socket_id).emit('voice:left', { channel_id: v.channel_id });
}

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const s = token && get('SELECT user_id FROM sessions WHERE token=?', token);
  if (!s) return next(new Error('unauthorized'));
  socket.uid = s.user_id;
  next();
});

io.on('connection', (socket) => {
  const uid = socket.uid;
  socket.join('user:' + uid);
  socket.emit('app:version', { client: CLIENT_VERSION });
  const wasOnline = online.has(uid);
  if (!wasOnline) online.set(uid, new Set());
  online.get(uid).add(socket.id);
  if (!wasOnline) broadcastUser(uid);

  socket.on('typing', ({ channel_id } = {}) => {
    const ch = getChannel(channel_id);
    if (!ch || !canView(ch, uid)) return;
    for (const u of channelAudience(ch)) if (u !== uid) emitUser(u, 'typing', { channel_id, user_id: uid });
  });

  socket.on('voice:join', ({ channel_id } = {}, cb) => {
    const ch = getChannel(channel_id);
    const reply = typeof cb === 'function' ? cb : () => {};
    if (!ch || !canView(ch, uid)) return reply({ error: 'Kanal bulunamadı' });
    if (ch.guild_id) {
      if (!['voice', 'stage'].includes(ch.type)) return reply({ error: 'Bu bir ses kanalı değil' });
      if (!(guildPerms(ch.guild_id, uid) & P.CONNECT)) return reply({ error: 'Bu kanala bağlanma yetkin yok' });
    }
    if (voice.has(uid)) leaveVoice(uid);
    const peers = [...voice.values()].filter((v) => v.channel_id === ch.id);
    if (peers.length >= 25) return reply({ error: 'Kanal dolu (25 kişi)' });
    const canSpeak = !ch.guild_id || (guildPerms(ch.guild_id, uid) & P.SPEAK);
    const v = { user_id: uid, channel_id: ch.id, guild_id: ch.guild_id, socket_id: socket.id, muted: false, deafened: false, server_muted: !canSpeak, video: false, streaming: false, camera_stream: null, screen_stream: null, mic_stream: null, joined_at: Date.now() };
    voice.set(uid, v);
    emitVoice(v);
    for (const p of peers) io.to(p.socket_id).emit('voice:peer_joined', { user_id: uid });
    if (!ch.guild_id && !peers.length) for (const u of voiceAudience(v)) if (u !== uid) emitUser(u, 'call:ring', { channel_id: ch.id, from: pubUser(uid) });
    reply({ ok: true, peers: peers.map((p) => p.user_id), states: peers.map(voicePublic), server_muted: v.server_muted });
  });
  socket.on('voice:leave', () => { if (voice.get(uid)?.socket_id === socket.id) leaveVoice(uid); });
  socket.on('voice:update', (d = {}) => {
    const v = voice.get(uid);
    if (!v || v.socket_id !== socket.id) return;
    for (const k of ['muted', 'deafened', 'video', 'streaming']) if (k in d) v[k] = !!d[k];
    for (const k of ['camera_stream', 'screen_stream', 'mic_stream']) if (k in d) v[k] = d[k] ? String(d[k]).slice(0, 100) : null;
    if (v.streaming && v.guild_id && !(guildPerms(v.guild_id, uid) & P.STREAM)) v.streaming = false;
    emitVoice(v);
  });
  socket.on('voice:signal', ({ to, data } = {}) => {
    const me = voice.get(uid), them = voice.get(to);
    if (!me || !them || me.channel_id !== them.channel_id || me.socket_id !== socket.id) return;
    io.to(them.socket_id).emit('voice:signal', { from: uid, data });
  });
  socket.on('voice:moderate', ({ user_id, action } = {}) => {
    const v = voice.get(user_id);
    if (!v || !v.guild_id) return;
    const p = guildPerms(v.guild_id, uid);
    if (action === 'mute' || action === 'unmute') { if (!(p & P.MUTE_MEMBERS)) return; v.server_muted = action === 'mute'; emitVoice(v); io.to(v.socket_id).emit('voice:server_mute', { muted: v.server_muted }); }
    if (action === 'disconnect') { if (!(p & P.MOVE_MEMBERS)) return; leaveVoice(user_id); }
  });
  socket.on('call:decline', ({ channel_id } = {}) => {
    const ch = getChannel(channel_id);
    if (ch && !ch.guild_id && canView(ch, uid)) for (const u of channelAudience(ch)) emitUser(u, 'call:declined', { channel_id, user_id: uid });
  });
  socket.on('soundboard', ({ sound } = {}) => {
    const v = voice.get(uid);
    if (!v || typeof sound !== 'string' || sound.length > 20) return;
    try { limit('sb:' + uid, 5, 5000); } catch { return; }
    for (const o of voice.values()) if (o.channel_id === v.channel_id) io.to(o.socket_id).emit('soundboard', { user_id: uid, sound });
  });

  socket.on('disconnect', () => {
    const set = online.get(uid);
    if (set) { set.delete(socket.id); if (!set.size) { online.delete(uid); broadcastUser(uid); } }
    if (voice.get(uid)?.socket_id === socket.id) leaveVoice(uid);
  });
});

// ───── Zamanlanmış görevler: zamanlanmış mesajlar & süreli mesajlar & biten anketler ─────
setInterval(() => {
  const now = Date.now();
  for (const s of all('SELECT * FROM scheduled WHERE send_at<=?', now)) {
    run('DELETE FROM scheduled WHERE id=?', s.id);
    const ch = getChannel(s.channel_id);
    try { if (ch) { canSend(ch, s.author_id); insertMessage(ch, s.author_id, { content: s.content }); } } catch { /* yetki kaybedilmişse atla */ }
  }
  for (const m of all('SELECT id, channel_id FROM messages WHERE expires_at IS NOT NULL AND expires_at<=?', now)) {
    const ch = getChannel(m.channel_id);
    if (ch) deleteMessage(ch, m.id);
  }
}, 2000);

server.listen(PORT, () => console.log(`\n  🔊 Yankı çalışıyor →  ${process.env.SSL_CERT ? 'https' : 'http'}://localhost:${PORT}\n`));
module.exports = { app, server };
