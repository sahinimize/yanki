// ════════ Giriş / Kayıt ════════
'use strict';
const Auth = {
  async show(inviteCode) {
    const mode = location.pathname.startsWith('/register') ? 'register' : 'login';
    let invite = null;
    if (inviteCode) { try { invite = await API.get('/api/invites/' + inviteCode); } catch { /* geçersiz */ } this.invite = inviteCode; }
    this.render(mode, invite);
  },
  render(mode, invite) {
    const isReg = mode === 'register';
    if (location.pathname !== '/' + mode && !location.pathname.startsWith('/invite')) history.replaceState(null, '', '/' + mode);
    document.title = (isReg ? 'Kayıt Ol' : 'Giriş Yap') + ' — Yankı';
    const inviteHTML = invite ? `<div class="row" style="justify-content:center;margin-bottom:16px;gap:12px"><div class="g-icon" style="width:56px;height:56px;border-radius:16px;background:#7c5cff">${invite.guild.icon ? `<img src="${esc(invite.guild.icon)}">` : esc(guildAcronym(invite.guild.name))}</div><div><div class="small" style="color:#b5bac1">${esc(invite.inviter.display_name)} seni davet etti:</div><div style="font-weight:800;font-size:20px;color:#fff">${esc(invite.guild.name)}</div><div class="tiny" style="color:#b5bac1">🟢 ${invite.online_count} çevrimiçi • ${invite.member_count} üye</div></div></div>` : '';
    document.body.innerHTML = `<div id="auth">
      <div class="blob" style="width:420px;height:420px;background:#7c5cff;left:-120px;top:-80px"></div>
      <div class="blob" style="width:360px;height:360px;background:#00c2ff;right:-100px;bottom:-60px;animation-delay:-5s"></div>
      <div class="blob" style="width:260px;height:260px;background:#ff5fb8;left:40%;bottom:-120px;animation-delay:-9s"></div>
      <form class="auth-card ${isReg ? '' : 'wide'}" id="authForm" novalidate>
        <div>
          <div class="logo"><div class="logo-mark">${LOGO_SVG}</div>Yankı</div>
          ${inviteHTML}
          <h1>${isReg ? 'Bir hesap oluştur' : 'Tekrar hoş geldin!'}</h1>
          <p class="sub">${isReg ? 'Arkadaşlarınla konuşmanın en özgür yolu. Tamamen ücretsiz.' : 'Seni tekrar gördüğümüze çok sevindik!'}</p>
          ${isReg ? `
          <div class="field"><label class="label">E-posta <span class="req">*</span></label><input class="input" name="email" type="email" autocomplete="email" required></div>
          <div class="field"><label class="label">Görünen Ad</label><input class="input" name="display_name" maxlength="32" autocomplete="nickname" placeholder="Herkese böyle görünürsün"></div>
          <div class="field"><label class="label">Kullanıcı Adı <span class="req">*</span></label><input class="input" name="username" autocomplete="username" required placeholder="kucuk_harf.ve_rakam"><div class="tiny" style="color:#b5bac1;margin-top:4px" id="unHint">Sadece küçük harf, rakam, _ ve . (2-32 karakter)</div></div>
          <div class="field"><label class="label">Şifre <span class="req">*</span></label><div style="position:relative"><input class="input" name="password" type="password" autocomplete="new-password" required><button type="button" class="icon-btn" id="pwEye" style="position:absolute;right:4px;top:4px">${icon('eye', 'sm')}</button></div><div class="pw-meter"><div id="pwBar" style="width:0"></div></div><div class="tiny" id="pwTxt" style="color:#b5bac1;margin-top:4px"></div></div>
          <label class="row small" style="color:#b5bac1;margin-bottom:16px;align-items:flex-start"><input type="checkbox" name="tos" style="margin-top:3px;accent-color:#7c5cff"> <span>Yankı'nın Hizmet Koşulları'nı ve Gizlilik Politikası'nı okudum ve kabul ediyorum. (Reklam yok, veri satışı yok 🤝)</span></label>`
          : `<div class="field"><label class="label">E-posta veya kullanıcı adı <span class="req">*</span></label><input class="input" name="login" autocomplete="username" required></div>
          <div class="field"><label class="label">Şifre <span class="req">*</span></label><div style="position:relative"><input class="input" name="password" type="password" autocomplete="current-password" required><button type="button" class="icon-btn" id="pwEye" style="position:absolute;right:4px;top:4px">${icon('eye', 'sm')}</button></div><a href="#" class="small" id="forgot" style="display:inline-block;margin-top:6px">Şifreni mi unuttun?</a></div>`}
          <div class="error-text" id="authErr" style="margin-bottom:10px;min-height:0"></div>
          <button class="btn block" style="height:44px;font-size:16px;background:linear-gradient(90deg,#7c5cff,#5865f2)" id="authGo">${isReg ? 'Devam Et' : 'Giriş Yap'}</button>
          <div class="small" style="margin-top:12px;color:#949ba4">${isReg ? 'Zaten bir hesabın var mı? <a href="/login" data-sw="login">Giriş Yap</a>' : 'Bir hesaba mı ihtiyacın var? <a href="/register" data-sw="register">Kaydol</a>'}</div>
        </div>
        ${isReg ? '' : `<div class="auth-side"><div style="font-size:64px;line-height:1">🔊</div><h2 style="color:#fff;margin:0;font-size:20px">Neden Yankı?</h2>
          <div class="auth-features"><div>💎 <span>Tüm Nitro özellikleri <b style="color:#fff">bedava</b></span></div><div>📺 <span>4K 60 FPS ekran paylaşımı</span></div><div>💣 <span>Kendini imha eden mesajlar</span></div><div>⏰ <span>Zamanlanmış mesajlar</span></div><div>📊 <span>Yerleşik anketler</span></div><div>🏠 <span>Kendi sunucunda barındır</span></div><div>🇹🇷 <span>Tamamen Türkçe</span></div></div></div>`}
      </form></div>`;
    const form = $('#authForm');
    $('#pwEye').onclick = () => { const p = form.password; p.type = p.type === 'password' ? 'text' : 'password'; };
    form.querySelectorAll('[data-sw]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); history.pushState(null, '', '/' + a.dataset.sw); this.render(a.dataset.sw, invite); }));
    $('#forgot')?.addEventListener('click', (e) => { e.preventDefault(); toast('Kendi sunucunda barındırdığın için şifre sıfırlama, sunucu yöneticisi tarafından yapılır.'); });
    if (isReg) {
      form.username.oninput = () => { const v = form.username.value; form.username.value = v.toLowerCase().replace(/\s/g, '_'); $('#unHint').style.color = /^[a-z0-9_.]{2,32}$/.test(form.username.value) || !v ? '#b5bac1' : '#f23f43'; };
      form.email.onblur = () => { if (!form.username.value && form.email.value.includes('@')) form.username.value = form.email.value.split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 32); };
      form.password.oninput = () => {
        const p = form.password.value;
        let s = 0; if (p.length >= 6) s++; if (p.length >= 10) s++; if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^\w]/.test(p)) s++;
        const lv = [['', '#f23f43', 0], ['Çok zayıf', '#f23f43', 20], ['Zayıf', '#f0b232', 40], ['Orta', '#f0b232', 60], ['Güçlü', '#23a55a', 80], ['Çok güçlü 💪', '#23a55a', 100]][p ? Math.max(1, s) : 0];
        $('#pwBar').style.width = lv[2] + '%'; $('#pwBar').style.background = lv[1]; $('#pwTxt').textContent = lv[0];
      };
    }
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(form));
      const err = $('#authErr');
      err.textContent = '';
      if (isReg && !fd.tos) { err.textContent = 'Devam etmek için koşulları kabul etmelisin.'; return; }
      const btn = $('#authGo');
      btn.disabled = true; btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;border-top-color:#fff"></div>';
      try {
        const r = await API.post(isReg ? '/api/auth/register' : '/api/auth/login', fd);
        TokenStore.set(r.token);
        API.token = r.token;
        $('#auth')?.classList.add('auth-out');
        setTimeout(() => { location.href = this.invite ? '/invite/' + this.invite : '/app/@me'; }, 420);
      } catch (ex) {
        err.textContent = ex.message;
        form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
        btn.disabled = false; btn.textContent = isReg ? 'Devam Et' : 'Giriş Yap';
      }
    };
    setTimeout(() => form.querySelector('input')?.focus(), 50);
  },
};
