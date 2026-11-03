// ════════ Ses, görüntü ve ekran paylaşımı (WebRTC mesh + "perfect negotiation") ════════
'use strict';
const VoiceSettings = {
  load() {
    try { return { inputId: '', outputId: '', nsMode: 'ai', echoCancellation: true, autoGain: true, enhance: true, inputGain: 100, gate: true, gateAuto: true, gateDb: -50, bitrate: 96, ptt: false, pttKey: 'KeyV', pttLabel: 'V', threshold: 0.012, screenQuality: '1080p60', ...JSON.parse(localStorage.getItem('yanki_voice') || '{}') }; }
    catch { return {}; }
  },
  save(s) { localStorage.setItem('yanki_voice', JSON.stringify(s)); },
};
const SCREEN_PRESETS = {
  '720p30': { width: 1280, height: 720, frameRate: 30, bitrate: 2_500_000, label: '720p 30 FPS' },
  '1080p30': { width: 1920, height: 1080, frameRate: 30, bitrate: 4_500_000, label: '1080p 30 FPS' },
  '1080p60': { width: 1920, height: 1080, frameRate: 60, bitrate: 8_000_000, label: '1080p 60 FPS (Nitro kalitesi, ücretsiz)' },
  '1440p60': { width: 2560, height: 1440, frameRate: 60, bitrate: 12_000_000, label: '1440p 60 FPS' },
  'source': { width: 3840, height: 2160, frameRate: 60, bitrate: 16_000_000, label: 'Kaynak (4K\'ya kadar)' },
};

const Voice = {
  channelId: null, guildId: null, joinedAt: 0,
  peers: new Map(), remote: new Map(),
  mic: null, cam: null, screen: null,
  muted: false, deafened: false, serverMuted: false, pttDown: false, wasMutedBeforeDeafen: false,
  speaking: new Set(), analysers: new Map(), audioCtx: null, loop: null, iceServers: null, ping: null,
  settings: VoiceSettings.load(),
  get socket() { return App.socket; },
  get connected() { return !!this.channelId; },

  async getRawMic() {
    const s = this.settings;
    try { return await navigator.mediaDevices.getUserMedia({ audio: AudioFX.rawConstraints(s), video: false }); }
    catch (e) { if (s.inputId) { s.inputId = ''; return this.getRawMic(); } throw e; }
  },
  // Mikrofon sesi Yankı Ses İşleme Motoru'ndan geçirilerek gönderilir
  async getMic() {
    const raw = await this.getRawMic();
    const old = this.fx;
    try { this.fx = await AudioFX.create(raw, this.settings); old?.destroy(); return this.fx.stream; }
    catch (e) { console.warn('Ses işleme başlatılamadı', e); this.fx = null; old?.destroy(); return raw; }
  },
  applyFx() { this.fx?.update(this.settings); },
  async applyAudioBitrate(peer) {
    for (const snd of peer.senders.mic) {
      try {
        const p = snd.getParameters();
        if (!p.encodings?.length) p.encodings = [{}];
        p.encodings[0].maxBitrate = (this.settings.bitrate || 96) * 1000;
        p.encodings[0].priority = 'high'; p.encodings[0].networkPriority = 'high';
        await snd.setParameters(p);
      } catch { /* yoksay */ }
    }
  },
  async join(channelId) {
    if (this.channelId === channelId) return;
    if (this.channelId) this.leave(true);
    if (!this.iceServers) this.iceServers = await API.get('/api/ice').catch(() => [{ urls: 'stun:stun.l.google.com:19302' }]);
    let mic = null;
    try { mic = await this.getMic(); } catch (e) { toast('Mikrofona erişilemedi — sadece dinleme modunda katılıyorsun', 'err'); }
    const res = await new Promise((r) => this.socket.emit('voice:join', { channel_id: channelId }, r));
    if (res?.error) { mic?.getTracks().forEach((t) => t.stop()); toast(res.error, 'err'); return; }
    this.mic = mic;
    this.channelId = channelId; this.joinedAt = Date.now();
    this.guildId = App.channelById(channelId)?.guild_id || null;
    this.serverMuted = !!res.server_muted;
    if (!mic) this.muted = true;
    this.applyMicEnabled();
    if (mic) this.watchLevel('me', mic);
    for (const uid of res.peers) this.createPeer(uid, true);
    this.sendState();
    this.startLoop();
    Sound.join();
    App.onVoiceChange();
  },
  leave(silent) {
    if (!this.channelId) return;
    this.socket.emit('voice:leave');
    for (const p of this.peers.values()) p.pc.close();
    this.peers.clear();
    for (const r of this.remote.values()) for (const a of r.audio.values()) { a.srcObject = null; a.remove(); }
    this.remote.clear();
    [this.mic, this.cam, this.screen].forEach((s) => s?.getTracks().forEach((t) => t.stop()));
    this.fx?.destroy(); this.fx = null;
    this.mic = this.cam = this.screen = null;
    for (const a of this.analysers.values()) a.src.disconnect();
    this.analysers.clear(); this.speaking.clear();
    clearInterval(this.loop); this.loop = null;
    this.channelId = null; this.guildId = null; this.ping = null;
    if (!silent) Sound.leave();
    App.onVoiceChange();
  },
  onLeftByServer() {
    if (!this.channelId) return;
    for (const p of this.peers.values()) p.pc.close();
    this.peers.clear();
    const was = this.channelId;
    this.channelId = 'x';
    this.leave();
    if (was) toast('Ses kanalından bağlantın kesildi');
  },

  // ─── Eş bağlantıları ───
  createPeer(uid) {
    if (this.peers.has(uid)) return this.peers.get(uid);
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const peer = { uid, pc, polite: App.me.id > uid, makingOffer: false, ignoreOffer: false, queue: Promise.resolve(), senders: { mic: [], cam: [], screen: [] } };
    this.peers.set(uid, peer);
    const add = (stream, kind) => stream?.getTracks().forEach((t) => peer.senders[kind].push(pc.addTrack(t, stream)));
    add(this.mic, 'mic'); add(this.cam, 'cam'); add(this.screen, 'screen');
    pc.onnegotiationneeded = async () => {
      try { peer.makingOffer = true; await pc.setLocalDescription(); this.signal(uid, { description: pc.localDescription }); }
      catch (e) { console.warn('negotiation', e); } finally { peer.makingOffer = false; }
    };
    pc.onicecandidate = ({ candidate }) => candidate && this.signal(uid, { candidate });
    pc.oniceconnectionstatechange = () => { if (pc.iceConnectionState === 'failed') pc.restartIce?.(); };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'connected') { this.applyAudioBitrate(peer); if (this.screen) this.applyBitrate('screen', (SCREEN_PRESETS[this.settings.screenQuality] || SCREEN_PRESETS['1080p60']).bitrate); if (this.cam) this.applyBitrate('cam', 2_500_000); } };
    pc.ontrack = ({ track, streams }) => {
      const stream = streams[0] || new MediaStream([track]);
      let r = this.remote.get(uid);
      if (!r) { r = { streams: new Map(), audio: new Map() }; this.remote.set(uid, r); }
      r.streams.set(stream.id, stream);
      if (track.kind === 'audio' && !r.audio.has(stream.id)) {
        const a = document.createElement('audio');
        a.autoplay = true; a.srcObject = stream; a.dataset.uid = uid;
        document.body.append(a);
        r.audio.set(stream.id, a);
        this.applyRemoteAudio(uid);
        if (this.settings.outputId && a.setSinkId) a.setSinkId(this.settings.outputId).catch(() => {});
        a.play().catch(() => App.needsAudioUnlock());
        this.watchLevel(uid + ':' + stream.id, stream, uid);
      }
      track.onunmute = () => App.onVoiceMedia();
      stream.onremovetrack = () => App.onVoiceMedia();
      App.onVoiceMedia();
    };
    return peer;
  },
  removePeer(uid) {
    const p = this.peers.get(uid);
    if (p) { p.pc.close(); this.peers.delete(uid); }
    const r = this.remote.get(uid);
    if (r) { for (const a of r.audio.values()) { a.srcObject = null; a.remove(); } this.remote.delete(uid); }
    for (const [k, a] of this.analysers) if (a.uid === uid) { a.src.disconnect(); this.analysers.delete(k); }
    this.speaking.delete(uid);
    App.onVoiceMedia();
  },
  signal(to, data) { this.socket.emit('voice:signal', { to, data }); },
  onSignal(from, data) {
    if (!this.channelId) return;
    const peer = this.createPeer(from);
    peer.queue = peer.queue.then(async () => {
      const pc = peer.pc;
      try {
        if (data.description) {
          const d = data.description;
          const collision = d.type === 'offer' && (peer.makingOffer || pc.signalingState !== 'stable');
          peer.ignoreOffer = !peer.polite && collision;
          if (peer.ignoreOffer) return;
          await pc.setRemoteDescription(d);
          if (d.type === 'offer') { await pc.setLocalDescription(); this.signal(from, { description: pc.localDescription }); }
        } else if (data.candidate) {
          try { await pc.addIceCandidate(data.candidate); } catch (e) { if (!peer.ignoreOffer) console.warn(e); }
        }
      } catch (e) { console.warn('signal', e); }
    });
  },

  // ─── Durum ───
  sendState() {
    if (!this.channelId) return;
    this.socket.emit('voice:update', {
      muted: this.muted || !this.mic, deafened: this.deafened, video: !!this.cam, streaming: !!this.screen,
      camera_stream: this.cam?.id || null, screen_stream: this.screen?.id || null, mic_stream: this.mic?.id || null,
    });
  },
  applyMicEnabled() {
    const t = this.mic?.getAudioTracks()[0];
    if (!t) return;
    const open = !this.muted && !this.deafened && !this.serverMuted && (!this.settings.ptt || this.pttDown);
    t.enabled = open;
  },
  applyRemoteAudio(uid) {
    const r = this.remote.get(uid);
    if (!r) return;
    const vol = Number(localStorage.getItem('yanki_vol_' + uid) ?? 100);
    const localMute = localStorage.getItem('yanki_lmute_' + uid) === '1';
    for (const a of r.audio.values()) { a.volume = Math.max(0, Math.min(1, vol / 100)); a.muted = this.deafened || localMute; }
  },
  toggleMute() {
    if (!this.mic && this.channelId) { toast('Mikrofon bulunamadı', 'err'); return; }
    if (this.deafened) { this.deafened = false; this.muted = false; }
    else this.muted = !this.muted;
    this.muted ? Sound.mute() : Sound.unmute();
    this.applyMicEnabled();
    for (const uid of this.remote.keys()) this.applyRemoteAudio(uid);
    this.sendState(); App.onVoiceChange();
  },
  toggleDeafen() {
    this.deafened = !this.deafened;
    if (this.deafened) { this.wasMutedBeforeDeafen = this.muted; this.muted = true; Sound.mute(); }
    else { this.muted = this.wasMutedBeforeDeafen; Sound.unmute(); }
    this.applyMicEnabled();
    for (const uid of this.remote.keys()) this.applyRemoteAudio(uid);
    this.sendState(); App.onVoiceChange();
  },
  setPTT(down) {
    if (!this.settings.ptt || this.pttDown === down) return;
    this.pttDown = down;
    this.applyMicEnabled();
    App.onVoiceChange();
  },
  async toggleCamera() {
    if (this.cam) return this.stopStream('cam');
    try {
      this.cam = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } });
      this.addStream(this.cam, 'cam', 2_500_000);
    } catch (e) { toast('Kameraya erişilemedi: ' + e.message, 'err'); }
  },
  async startScreen(presetKey) {
    if (this.screen) this.stopStream('screen');
    const p = SCREEN_PRESETS[presetKey || this.settings.screenQuality] || SCREEN_PRESETS['1080p60'];
    try {
      this.screen = await navigator.mediaDevices.getDisplayMedia({ video: { width: { ideal: p.width }, height: { ideal: p.height }, frameRate: { ideal: p.frameRate } }, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, systemAudio: 'include' });
      const v = this.screen.getVideoTracks()[0];
      if (v) { v.contentHint = p.frameRate >= 60 ? 'motion' : 'detail'; v.onended = () => this.stopStream('screen'); }
      this.addStream(this.screen, 'screen', p.bitrate);
      toast('Yayındasın! 🔴 ' + p.label, 'ok');
    } catch (e) { if (e.name !== 'NotAllowedError') toast('Ekran paylaşımı başlatılamadı: ' + e.message, 'err'); this.screen = null; }
  },
  addStream(stream, kind, bitrate) {
    for (const peer of this.peers.values()) stream.getTracks().forEach((t) => peer.senders[kind].push(peer.pc.addTrack(t, stream)));
    setTimeout(() => this.applyBitrate(kind, bitrate), 1500);
    this.sendState(); App.onVoiceChange(); App.onVoiceMedia();
  },
  async applyBitrate(kind, bitrate) {
    for (const peer of this.peers.values()) for (const s of peer.senders[kind]) {
      if (s.track?.kind !== 'video') continue;
      try { const prm = s.getParameters(); if (!prm.encodings?.length) prm.encodings = [{}]; prm.encodings[0].maxBitrate = bitrate; await s.setParameters(prm); } catch { /* yoksay */ }
    }
  },
  stopStream(kind) {
    const s = this[kind];
    if (!s) return;
    s.getTracks().forEach((t) => t.stop());
    for (const peer of this.peers.values()) { for (const snd of peer.senders[kind]) try { peer.pc.removeTrack(snd); } catch { /* yoksay */ } peer.senders[kind] = []; }
    this[kind] = null;
    this.sendState(); App.onVoiceChange(); App.onVoiceMedia();
  },
  async switchInput() {
    if (!this.channelId) return;
    try {
      const n = await this.getMic();
      const track = n.getAudioTracks()[0];
      for (const peer of this.peers.values()) for (const s of peer.senders.mic) await s.replaceTrack(track);
      if (this.mic && this.mic !== n) this.mic.getTracks().forEach((t) => t.stop());
      const old = this.analysers.get('me'); if (old) { old.src.disconnect(); this.analysers.delete('me'); }
      // Yeni track'i mevcut stream kimliğiyle değil, yeni stream ile izliyoruz; karşı taraf mic_stream eşleşmesine ihtiyaç duymaz
      this.mic = n; this.applyMicEnabled(); this.watchLevel('me', n);
    } catch (e) { errToast(e); }
  },
  setOutput(id) { for (const r of this.remote.values()) for (const a of r.audio.values()) a.setSinkId?.(id).catch(() => {}); },

  // ─── Konuşma algılama ───
  watchLevel(key, stream, uid = App.me.id) {
    try {
      this.audioCtx ||= new AudioContext();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume().catch(() => {});
      const src = this.audioCtx.createMediaStreamSource(stream);
      const an = this.audioCtx.createAnalyser(); an.fftSize = 512;
      src.connect(an);
      this.analysers.set(key, { src, an, uid, buf: new Float32Array(an.fftSize), stream });
    } catch (e) { console.warn(e); }
  },
  level(key) {
    const a = this.analysers.get(key);
    if (!a) return 0;
    a.an.getFloatTimeDomainData(a.buf);
    let sum = 0; for (const v of a.buf) sum += v * v;
    return Math.sqrt(sum / a.buf.length);
  },
  startLoop() {
    clearInterval(this.loop);
    let tick = 0;
    this.loop = setInterval(() => {
      const now = new Set();
      for (const [k, a] of this.analysers) {
        const lvl = this.level(k);
        if (k === 'me') { App.onMicLevel?.(lvl); if (!this.mic?.getAudioTracks()[0]?.enabled) continue; }
        if (lvl > 0.012) now.add(a.uid);
      }
      for (const u of now) if (!this.speaking.has(u)) App.setSpeaking(u, true);
      for (const u of this.speaking) if (!now.has(u)) App.setSpeaking(u, false);
      this.speaking = now;
      if (++tick % 30 === 0) this.measurePing();
    }, 100);
  },
  async measurePing() {
    const p = this.peers.values().next().value;
    if (!p) { this.ping = null; return; }
    try {
      const stats = await p.pc.getStats();
      stats.forEach((r) => { if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.currentRoundTripTime != null) this.ping = Math.round(r.currentRoundTripTime * 1000); });
      App.renderVoicePanel?.();
    } catch { /* yoksay */ }
  },

  // ─── Mikrofon testi (ayarlar) ───
  async micTest(onLevel) {
    const raw = await this.getRawMic();
    const fx = await AudioFX.create(raw, this.settings);
    const loopback = document.createElement('audio');
    if (this.settings.outputId && loopback.setSinkId) loopback.setSinkId(this.settings.outputId).catch(() => {});
    const iv = setInterval(() => onLevel(fx.state), 50);
    return {
      fx,
      loopback(on) { if (on) { loopback.srcObject = fx.stream; loopback.play().catch(() => {}); } else loopback.srcObject = null; },
      stop() { clearInterval(iv); loopback.srcObject = null; fx.destroy(); },
    };
  },
};

window.addEventListener('keydown', (e) => {
  if (!Voice.settings.ptt || e.repeat) return;
  if (e.code === Voice.settings.pttKey && !e.target.closest('input, textarea, [contenteditable]')) Voice.setPTT(true);
});
window.addEventListener('keyup', (e) => { if (Voice.settings.ptt && e.code === Voice.settings.pttKey) Voice.setPTT(false); });
window.addEventListener('blur', () => Voice.setPTT(false));
