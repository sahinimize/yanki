// ════════ Yankı Ses İşleme Motoru ════════
// Mikrofon → uğultu filtresi → Yapay zekâ gürültü engelleme (RNNoise) → sıcaklık/netlik EQ
//          → kompresör (sesi "yakın" ve dolgun yapar) → kazanç → akıllı gürültü kapısı → limitör → gönderilen ses
'use strict';
const AudioFX = {
  ctx: null, rnReady: null, aiFailed: false,

  async getCtx() {
    if (!this.ctx || this.ctx.state === 'closed') { this.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000, latencyHint: 'interactive' }); this.rnReady = null; }
    if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {});
    return this.ctx;
  },
  loadAI(ctx) {
    this.rnReady ||= (async () => {
      const m = await import('/vendor/nsx/index.js');
      const [wasm] = await Promise.all([
        m.loadRnnoise({ url: '/vendor/nsx/rnnoise.wasm', simdUrl: '/vendor/nsx/rnnoise_simd.wasm' }),
        ctx.audioWorklet.addModule('/vendor/nsx/rnnoise-worklet.js'),
      ]);
      return { m, wasm };
    })();
    return this.rnReady;
  },
  rawConstraints(s) {
    return {
      deviceId: s.inputId ? { exact: s.inputId } : undefined,
      echoCancellation: s.echoCancellation !== false,
      // Yapay zekâ modu açıkken tarayıcının kendi (zayıf) filtreleri kapatılır; çift işlem sesi boğuklaştırır
      noiseSuppression: s.nsMode === 'standard',
      // Tarayıcının otomatik kazancı sesi "uzaktan geliyor" gibi yapar; kendi kompresörümüz bu işi daha iyi yapıyor
      autoGainControl: s.nsMode === 'standard' && s.autoGain !== false,
      channelCount: 1, sampleRate: 48000, sampleSize: 16,
    };
  },

  async create(raw, s) {
    const ctx = await this.getCtx();
    const N = {};
    N.src = ctx.createMediaStreamSource(raw);
    N.hp = Object.assign(ctx.createBiquadFilter(), { type: 'highpass' }); N.hp.frequency.value = 85; N.hp.Q.value = 0.7;
    N.src.connect(N.hp);
    let node = N.hp;
    let ai = false;
    if (s.nsMode === 'ai') {
      try {
        const { m, wasm } = await this.loadAI(ctx);
        N.rn = new m.RnnoiseWorkletNode(ctx, { maxChannels: 1, wasmBinary: wasm });
        node.connect(N.rn); node = N.rn; ai = true;
      } catch (e) { console.warn('AI gürültü engelleme yüklenemedi', e); if (!this.aiFailed) toast('Yapay zekâ gürültü engelleme bu cihazda başlatılamadı, standart filtre kullanılıyor', 'err'); this.aiFailed = true; }
    }
    N.pre = ctx.createAnalyser(); N.pre.fftSize = 1024; node.connect(N.pre);
    // Ses netleştirici
    N.warm = Object.assign(ctx.createBiquadFilter(), { type: 'lowshelf' }); N.warm.frequency.value = 180;
    N.mud = Object.assign(ctx.createBiquadFilter(), { type: 'peaking' }); N.mud.frequency.value = 380; N.mud.Q.value = 1.1;
    N.pres = Object.assign(ctx.createBiquadFilter(), { type: 'peaking' }); N.pres.frequency.value = 3200; N.pres.Q.value = 0.9;
    N.air = Object.assign(ctx.createBiquadFilter(), { type: 'highshelf' }); N.air.frequency.value = 9000;
    N.comp = ctx.createDynamicsCompressor();
    N.gain = ctx.createGain();
    N.gate = ctx.createGain(); N.gate.gain.value = 0;
    N.lim = ctx.createDynamicsCompressor();
    Object.assign(N.lim, {}); N.lim.threshold.value = -1.5; N.lim.knee.value = 0; N.lim.ratio.value = 20; N.lim.attack.value = 0.001; N.lim.release.value = 0.06;
    N.out = ctx.createAnalyser(); N.out.fftSize = 512;
    N.dest = ctx.createMediaStreamDestination();
    node.connect(N.warm); N.warm.connect(N.mud); N.mud.connect(N.pres); N.pres.connect(N.air); N.air.connect(N.comp);
    N.comp.connect(N.gain); N.gain.connect(N.gate); N.gate.connect(N.lim); N.lim.connect(N.dest); N.lim.connect(N.out);

    const buf = new Float32Array(N.pre.fftSize);
    const st = { db: -100, threshold: s.gateDb ?? -50, open: false, floor: -70, ai };
    let lastLoud = 0;
    const fx = {
      stream: N.dest.stream, raw, state: st, nodes: N,
      update(ns) {
        s = ns;
        const t = ctx.currentTime, en = ns.enhance !== false;
        N.warm.gain.setTargetAtTime(en ? 2.5 : 0, t, 0.05);
        N.mud.gain.setTargetAtTime(en ? -2 : 0, t, 0.05);
        N.pres.gain.setTargetAtTime(en ? 4 : 0, t, 0.05);
        N.air.gain.setTargetAtTime(en ? 1.5 : 0, t, 0.05);
        N.comp.threshold.setTargetAtTime(en ? -28 : 0, t, 0.05);
        N.comp.ratio.setTargetAtTime(en ? 3.5 : 1, t, 0.05);
        N.comp.knee.value = 10; N.comp.attack.value = 0.004; N.comp.release.value = 0.18;
        // Kompresörün kıstığı sesi geri kazandır → ses daha yakın ve dolgun
        N.gain.gain.setTargetAtTime(((ns.inputGain ?? 100) / 100) * (en ? 2.2 : 1), t, 0.05);
        if (ns.gate === false) N.gate.gain.setTargetAtTime(1, t, 0.02);
      },
      destroy() {
        clearInterval(fx.iv);
        try { N.src.disconnect(); N.lim.disconnect(); } catch { /* yoksay */ }
        try { N.rn?.destroy(); } catch { /* yoksay */ }
        raw.getTracks().forEach((tr) => tr.stop());
        N.dest.stream.getTracks().forEach((tr) => tr.stop());
      },
    };
    fx.update(s);
    // Akıllı gürültü kapısı: konuşmadığında mikrofonu tamamen sessize alır, gürültü seviyesini otomatik öğrenir
    fx.iv = setInterval(() => {
      N.pre.getFloatTimeDomainData(buf);
      let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const db = Math.max(-100, 20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-9));
      st.db = db;
      if (!st.open) st.floor = st.floor * 0.985 + Math.min(db, st.floor + 6) * 0.015;
      st.threshold = s.gateAuto !== false ? Math.max(-62, Math.min(-28, st.floor + (ai ? 10 : 14))) : (s.gateDb ?? -50);
      if (s.gate === false) { st.open = true; return; }
      const now = performance.now();
      if (db > st.threshold) { lastLoud = now; if (!st.open) { st.open = true; N.gate.gain.setTargetAtTime(1, ctx.currentTime, 0.004); } }
      else if (st.open && now - lastLoud > 280 && db < st.threshold - 3) { st.open = false; N.gate.gain.setTargetAtTime(0, ctx.currentTime, 0.05); }
    }, 15);
    return fx;
  },
};
