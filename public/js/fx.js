// ════════ Yankı 2.0 — Animasyon & etkileşim katmanı ════════
'use strict';
const FX = {
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,

  init() {
    this.ripples();
    this.messageEntrances();
    this.wrapNavigation();
    this.authEffects();
    if (window.yankiDesktop?.titlebar) this.titlebar();
  },

  // Butonlara tıklayınca yayılan dalga
  ripples() {
    const SEL = '.btn, .icon-btn, .vc, .seg button, .choice, .nav-item, .g-icon, .voice-panel .vbtns button, .friends-head .tab, .ctx .ci, #updateBtn';
    document.addEventListener('pointerdown', (e) => {
      if (this.reduced || e.button !== 0) return;
      const el = e.target.closest(SEL);
      if (!el || el.disabled) return;
      const r = el.getBoundingClientRect();
      const size = Math.max(r.width, r.height);
      const s = document.createElement('span');
      s.className = 'ripple';
      s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      el.append(s);
      setTimeout(() => s.remove(), 650);
    }, true);
  },

  // Yeni gelen mesajlar kayarak belirir (toplu yüklemede değil, tek tek eklenince)
  messageEntrances() {
    const watch = () => {
      const box = document.getElementById('msgs');
      if (!box || box._fx) return;
      box._fx = true;
      new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.addedNodes.length > 2) continue;
          for (const n of m.addedNodes) if (n.nodeType === 1 && n.classList.contains('message') && !m.removedNodes.length) { n.classList.add('msg-in'); setTimeout(() => n.classList.remove('msg-in'), 600); }
        }
      }).observe(box, { childList: true });
    };
    new MutationObserver(watch).observe(document.body, { childList: true, subtree: true });
  },

  // Sunucu değiştirince kanal listesi yumuşakça kayar
  wrapNavigation() {
    const orig = App.go;
    App.go = function (...args) {
      const prev = this.view.guildId;
      const r = orig.apply(this, args);
      if (prev !== this.view.guildId) { const s = document.getElementById('side'); if (s) { s.classList.remove('swap'); void s.offsetWidth; s.classList.add('swap'); } }
      FX.updateTitlebar();
      return r;
    };
  },

  // Masaüstü: Windows başlık çubuğu yerine uygulamayla bütünleşik çubuk
  titlebar() {
    document.documentElement.classList.add('has-titlebar');
    const put = () => {
      if (document.getElementById('titlebar')) return;
      const tb = document.createElement('div');
      tb.id = 'titlebar';
      tb.innerHTML = `<span class="tb-logo">${LOGO_SVG}</span><b>Yankı</b><span class="tb-where" id="tbWhere"></span>`;
      document.body.prepend(tb);
      this.updateTitlebar();
    };
    put();
    new MutationObserver(put).observe(document.body, { childList: true });
    const sync = () => {
      const t = document.documentElement.dataset.theme || 'dark';
      const color = t === 'light' ? '#eceef6' : t === 'midnight' ? '#000000' : t.startsWith('g-') ? '#0c0c14' : '#08090e';
      window.yankiDesktop.setTitlebar?.({ color, symbolColor: t === 'light' ? '#2b2f3d' : '#a3a8bb' });
    };
    sync();
    new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  },
  updateTitlebar() {
    const w = document.getElementById('tbWhere');
    if (!w || typeof App === 'undefined' || !App.me) return;
    const ch = App.channel, g = App.guild;
    w.textContent = ch ? `· ${g ? g.name + ' · #' + ch.name : App.dmName(ch)}` : g ? `· ${g.name}` : '· Arkadaşlar';
  },

  // Giriş ekranı: kutup ışıkları, uçuşan parçacıklar, fareyi izleyen ışık
  authEffects() {
    const run = () => {
      const auth = document.getElementById('auth');
      if (!auth || auth._fx) return;
      auth._fx = true;
      auth.insertAdjacentHTML('afterbegin', '<div class="aurora"></div><div class="grid-lines"></div><div class="particles"></div>');
      const p = auth.querySelector('.particles');
      if (!this.reduced) for (let i = 0; i < 26; i++) {
        const s = document.createElement('span');
        const size = 2 + Math.random() * 3;
        s.style.cssText = `left:${Math.random() * 100}%;width:${size}px;height:${size}px;animation-duration:${9 + Math.random() * 12}s;animation-delay:${-Math.random() * 20}s;opacity:${0.3 + Math.random() * 0.6}`;
        p.append(s);
      }
      const card = auth.querySelector('.auth-card');
      auth.addEventListener('pointermove', (e) => { const c = auth.querySelector('.auth-card'); if (!c) return; const r = c.getBoundingClientRect(); c.style.setProperty('--mx', `${e.clientX - r.left}px`); c.style.setProperty('--my', `${e.clientY - r.top}px`); });
    };
    run();
    new MutationObserver(run).observe(document.body, { childList: true });
  },

  // Mesajlar yüklenirken iskelet görünümü
  skeleton(n = 7) {
    const w = () => 25 + Math.random() * 55;
    return `<div class="skel">${Array.from({ length: n }, (_, i) => `<div class="s-row" style="animation-delay:${i * 50}ms"><div class="s-av"></div><div style="flex:1"><div class="s-ln" style="width:${12 + Math.random() * 10}%"></div><div class="s-ln" style="width:${w()}%"></div>${Math.random() > 0.5 ? `<div class="s-ln" style="width:${w()}%"></div>` : ''}</div></div>`).join('')}</div>`;
  },
};
document.addEventListener('DOMContentLoaded', () => FX.init());
