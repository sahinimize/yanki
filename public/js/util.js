// ════════ Yardımcılar ════════
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

const ICONS = {
  hash: 'M20 10V8h-4V4h-2v4h-4V4H8v4H4v2h4v4H4v2h4v4h2v-4h4v4h2v-4h4v-2h-4v-4h4zm-6 4h-4v-4h4v4z',
  speaker: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',
  plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  gear: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  mic: 'M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z',
  micOff: 'M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z',
  headphones: 'M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z',
  hangup: 'M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z',
  video: 'M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z',
  screen: 'M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.11-.9-2-2-2H4c-1.11 0-2 .89-2 2v10c0 1.1.89 2 2 2H0v2h24v-2h-4zm-7-3.53v-2.19c-2.78 0-4.61.85-6 2.72.56-2.67 2.11-5.33 6-5.87V7l4 3.73-4 3.74z',
  people: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  pin: 'M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z',
  search: 'M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  x: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  chev: 'M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z',
  smile: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z',
  gif: 'M11.5 9H13v6h-1.5zM9 9H6c-.6 0-1 .5-1 1v4c0 .5.4 1 1 1h3c.6 0 1-.5 1-1v-2H8.5v1.5h-2v-3H10V10c0-.5-.4-1-1-1zm10 1.5V9h-4.5v6H16v-2h2v-1.5h-2v-1z',
  plusCircle: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z',
  reply: 'M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z',
  edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  trash: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  more: 'M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  bookmark: 'M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z',
  bell: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
  explore: 'M12 10.9c-.61 0-1.1.49-1.1 1.1s.49 1.1 1.1 1.1c.61 0 1.1-.49 1.1-1.1s-.49-1.1-1.1-1.1zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z',
  link: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
  copy: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
  chat: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z',
  phone: 'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z',
  lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
  megaphone: 'M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z',
  logout: 'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z',
  poll: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z',
  clock: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
  timer: 'M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42A8.962 8.962 0 0 0 12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9 9-4.03 9-9c0-2.12-.74-4.07-1.97-5.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z',
  fullscreen: 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z',
  personAdd: 'M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  block: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9A7.902 7.902 0 0 1 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1A7.902 7.902 0 0 1 20 12c0 4.42-3.58 8-8 8z',
  at: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10h5v-2h-5c-4.34 0-8-3.66-8-8s3.66-8 8-8 8 3.66 8 8v1.43c0 .79-.71 1.57-1.5 1.57s-1.5-.78-1.5-1.57V12c0-2.76-2.24-5-5-5s-5 2.24-5 5 2.24 5 5 5c1.38 0 2.64-.56 3.54-1.47.65.89 1.77 1.47 2.96 1.47 1.97 0 3.5-1.6 3.5-3.57V12c0-5.52-4.48-10-10-10zm0 13c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z',
  shield: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z',
  attach: 'M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z',
  music: 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
  star: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
  download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
  crown: 'M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z',
  signal: 'M2 22h20V2L2 22z',
  inbox: 'M19 3H4.99c-1.11 0-1.98.89-1.98 2L3 19c0 1.1.88 2 1.99 2H19c1.1 0 2-.9 2-2V5c0-1.11-.9-2-2-2zm0 12h-4c0 1.66-1.35 3-3 3s-3-1.34-3-3H4.99V5H19v10z',
  sparkle: 'M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z',
  folder: 'M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z',
  eye: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
};
const icon = (n, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n] || ''}"/></svg>`;
const LOGO_SVG = `<svg viewBox="0 0 24 24" width="28" height="28" fill="#fff"><path d="M12 3a9 9 0 0 0-9 9c0 1.9.6 3.7 1.6 5.1L3.5 21l4-1.1A9 9 0 1 0 12 3zm-3.5 10.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3.5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3.5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>`;

// ─── Oturum anahtarı (masaüstünde sunucu adresi değişse bile korunur) ───
const TokenStore = {
  get() { let t = null; try { t = localStorage.getItem('yanki_token'); } catch { /* yoksay */ } if (!t && window.yankiDesktop?.getSavedToken) { t = window.yankiDesktop.getSavedToken() || null; if (t) try { localStorage.setItem('yanki_token', t); } catch { /* yoksay */ } } return t; },
  set(t) { try { localStorage.setItem('yanki_token', t); } catch { /* yoksay */ } window.yankiDesktop?.saveToken?.(t); },
  clear() { try { localStorage.removeItem('yanki_token'); } catch { /* yoksay */ } window.yankiDesktop?.saveToken?.(''); },
};

// ─── API ───
const API = {
  token: TokenStore.get(),
  async req(method, url, body, isForm) {
    const opts = { method, headers: {} };
    if (this.token) opts.headers.Authorization = 'Bearer ' + this.token;
    if (body !== undefined) {
      if (isForm) opts.body = body;
      else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    }
    const r = await fetch(url, opts);
    let data = null;
    try { data = await r.json(); } catch { /* boş */ }
    if (r.status === 401 && this.token && !url.startsWith('/api/auth')) { TokenStore.clear(); location.reload(); }
    if (!r.ok) throw new Error(data?.error || 'Bir hata oluştu (' + r.status + ')');
    return data;
  },
  get(u) { return this.req('GET', u); }, post(u, b) { return this.req('POST', u, b ?? {}); }, patch(u, b) { return this.req('PATCH', u, b); },
  put(u, b) { return this.req('PUT', u, b ?? {}); }, del(u, b) { return this.req('DELETE', u, b); },
  form(method, u, fd) { return this.req(method, u, fd, true); },
  upload(url, fd, onProgress) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('POST', url);
      x.setRequestHeader('Authorization', 'Bearer ' + this.token);
      x.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      x.onload = () => { let d; try { d = JSON.parse(x.responseText); } catch { d = {}; } x.status < 300 ? resolve(d) : reject(new Error(d.error || 'Yükleme başarısız')); };
      x.onerror = () => reject(new Error('Bağlantı hatası'));
      x.send(fd);
    });
  },
};

// ─── Bildirim / toast ───
function toast(msg, type = '') {
  let w = $('.toast-wrap');
  if (!w) { w = h('<div class="toast-wrap"></div>'); document.body.append(w); }
  const t = h(`<div class="toast ${type}">${type === 'err' ? '⚠️' : type === 'ok' ? '✅' : 'ℹ️'} <span>${esc(msg)}</span></div>`);
  w.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3400);
}
const errToast = (e) => toast(e.message || String(e), 'err');
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); }
  catch { const ta = h('<textarea style="position:fixed;opacity:0"></textarea>'); ta.value = t; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  toast('Panoya kopyalandı', 'ok');
}

// ─── Modal ───
function modal({ title, sub, body = '', foot, cls = '', center = false, onClose } = {}) {
  const back = h(`<div class="modal-back"><div class="modal ${cls}" role="dialog">
    ${title !== undefined ? `<div class="modal-head ${center ? 'center' : ''}"><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}<button class="icon-btn modal-close" data-close>${icon('x')}</button></div>` : ''}
    <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div></div>`);
  let closed = false;
  const close = () => { if (closed) return; closed = true; document.removeEventListener('keydown', onKey); back.classList.add('closing'); setTimeout(() => back.remove(), 200); onClose?.(); };
  const onKey = (e) => { if (e.key === 'Escape' && document.querySelector('.modal-back:last-of-type') === back) close(); };
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  back.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(back);
  setTimeout(() => back.querySelector('input:not([type=file]):not([type=checkbox]):not([type=radio]),textarea')?.focus(), 30);
  return { el: back, m: back.querySelector('.modal'), close, $: (s) => back.querySelector(s) };
}
function confirmModal(title, text, okText = 'Onayla', danger = true) {
  return new Promise((res) => {
    const md = modal({ title, body: `<p style="margin:0 0 8px">${text}</p>`, foot: `<button class="btn ghost" data-close>İptal</button><button class="btn ${danger ? 'danger' : ''}" data-ok>${okText}</button>`, onClose: () => res(false) });
    md.$('[data-ok]').onclick = () => { res(true); md.el.remove(); };
  });
}
function promptModal(title, label, value = '', okText = 'Kaydet') {
  return new Promise((res) => {
    const md = modal({ title, body: `<label class="label">${label}</label><input class="input" value="${esc(value)}">`, foot: `<button class="btn ghost" data-close>İptal</button><button class="btn" data-ok>${okText}</button>`, onClose: () => res(null) });
    const inp = md.$('input');
    const ok = () => { res(inp.value); md.el.remove(); };
    md.$('[data-ok]').onclick = ok;
    inp.onkeydown = (e) => e.key === 'Enter' && ok();
  });
}

// ─── Bağlam menüsü ───
function closeFloating() { $$('.ctx, .picker, .popout').forEach((e) => { if (e.classList.contains('floating-out')) return; e.classList.add('floating-out'); setTimeout(() => e.remove(), 140); }); $$('.m-actions.open').forEach((e) => e.classList.remove('open')); }
function placeFloating(el, x, y, anchor) {
  document.body.append(el);
  const r = el.getBoundingClientRect();
  if (anchor) {
    const a = anchor.getBoundingClientRect();
    x = a.left; y = a.bottom + 6;
    if (y + r.height > innerHeight - 8) y = a.top - r.height - 6;
    if (x + r.width > innerWidth - 8) x = a.right - r.width;
  }
  x = Math.max(8, Math.min(x, innerWidth - r.width - 8));
  y = Math.max(8, Math.min(y, innerHeight - r.height - 8));
  el.style.left = x + 'px'; el.style.top = y + 'px';
}
function ctxMenu(e, items, anchor) {
  e.preventDefault(); e.stopPropagation();
  closeFloating();
  const el = h('<div class="ctx"></div>');
  for (const it of items.filter(Boolean)) {
    if (it === '-') { el.append(h('<div class="sep"></div>')); continue; }
    const b = h(`<button class="ci ${it.danger ? 'danger' : ''}"><span>${esc(it.label)}</span>${it.icon ? icon(it.icon, 'sm') : ''}${it.check !== undefined ? `<input type="checkbox" ${it.check ? 'checked' : ''} tabindex="-1">` : ''}${it.color ? `<span class="role-dot" style="background:${it.color}"></span>` : ''}</button>`);
    b.onclick = (ev) => { ev.stopPropagation(); if (!it.keep) closeFloating(); it.action?.(b); if (it.keep && it.check !== undefined) { const c = b.querySelector('input'); c.checked = !c.checked; } };
    el.append(b);
  }
  placeFloating(el, e.clientX, e.clientY, anchor);
  return el;
}
document.addEventListener('mousedown', (e) => { if (!e.target.closest('.ctx, .picker, .popout, [data-keep-float]')) closeFloating(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFloating(); });

// ─── Tooltip ───
let tipEl;
document.addEventListener('mouseover', (e) => {
  const t = e.target.closest('[data-tip]');
  if (!t) { tipEl?.remove(); tipEl = null; return; }
  if (tipEl?._t === t) return;
  tipEl?.remove();
  tipEl = h(`<div class="tooltip">${esc(t.dataset.tip)}</div>`); tipEl._t = t;
  document.body.append(tipEl);
  const r = t.getBoundingClientRect(), tr = tipEl.getBoundingClientRect();
  const side = t.dataset.tipSide || (r.left < 80 ? 'right' : 'top');
  let x, y;
  if (side === 'right') { x = r.right + 10; y = r.top + r.height / 2 - tr.height / 2; } else { x = r.left + r.width / 2 - tr.width / 2; y = r.top - tr.height - 8; if (y < 4) y = r.bottom + 8; }
  tipEl.style.left = Math.max(4, Math.min(x, innerWidth - tr.width - 4)) + 'px'; tipEl.style.top = y + 'px';
});
document.addEventListener('mousedown', () => { tipEl?.remove(); tipEl = null; });

// ─── Zaman ───
const pad = (n) => String(n).padStart(2, '0');
function fmtTime(ts) { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function fmtDate(ts) {
  const d = new Date(ts), now = new Date();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Bugün ' + fmtTime(ts);
  if (d.toDateString() === y.toDateString()) return 'Dün ' + fmtTime(ts);
  return d.toLocaleDateString('tr-TR') + ' ' + fmtTime(ts);
}
const fmtDay = (ts) => new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtFull = (ts) => new Date(ts).toLocaleString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
function fmtSize(b) { if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'; return (b / 1048576).toFixed(1) + ' MB'; }
function fmtDuration(ms) { const s = Math.floor(ms / 1000); const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60; return (hh ? hh + ':' + pad(mm) : mm) + ':' + pad(ss); }
function fmtLeft(ms) { if (ms < 60000) return Math.ceil(ms / 1000) + ' sn'; if (ms < 3600000) return Math.ceil(ms / 60000) + ' dk'; if (ms < 86400000) return Math.ceil(ms / 3600000) + ' sa'; return Math.ceil(ms / 86400000) + ' gün'; }

// ─── Sesler (WebAudio ile üretilir, dosya gerekmez) ───
const Sound = {
  ctx: null,
  enabled: () => (localStorage.getItem('yanki_sounds') ?? '1') === '1',
  tone(freqs, dur = 0.12, type = 'sine', vol = 0.08, gap = 0.09) {
    if (!this.enabled()) return;
    try {
      this.ctx ||= new (window.AudioContext || window.webkitAudioContext)();
      const t0 = this.ctx.currentTime;
      freqs.forEach((f, i) => {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(0, t0 + i * gap); g.gain.linearRampToValueAtTime(vol, t0 + i * gap + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * gap + dur);
        o.connect(g).connect(this.ctx.destination); o.start(t0 + i * gap); o.stop(t0 + i * gap + dur + 0.02);
      });
    } catch { /* yoksay */ }
  },
  message() { this.tone([880, 1320], 0.14, 'sine', 0.06, 0.07); },
  join() { this.tone([523, 784], 0.16, 'triangle', 0.08); },
  leave() { this.tone([784, 523], 0.16, 'triangle', 0.08); },
  mute() { this.tone([440], 0.08, 'square', 0.04); },
  unmute() { this.tone([660], 0.08, 'square', 0.04); },
  ring() { this.tone([660, 880, 660, 880], 0.2, 'sine', 0.08, 0.22); },
  board: {
    'davul': [[150, 0.25, 'sine', 0.3], [110, 0.3, 'sine', 0.3]],
    'alkış': 'noise', 'zil': [[1568, 0.4, 'sine', 0.12], [2093, 0.5, 'sine', 0.1]],
    'trompet': [[392, 0.2, 'sawtooth', 0.06], [523, 0.2, 'sawtooth', 0.06], [659, 0.4, 'sawtooth', 0.06]],
    'hata': [[200, 0.3, 'square', 0.06], [150, 0.4, 'square', 0.06]],
    'yay': [[300, 0.1, 'sine', 0.1], [600, 0.1, 'sine', 0.1], [1200, 0.15, 'sine', 0.1]],
    'üzgün': [[392, 0.3, 'triangle', 0.08], [370, 0.3, 'triangle', 0.08], [349, 0.6, 'triangle', 0.08]],
    'tada': [[523, 0.12, 'triangle', 0.1], [659, 0.12, 'triangle', 0.1], [784, 0.12, 'triangle', 0.1], [1047, 0.4, 'triangle', 0.1]],
  },
  playBoard(name) {
    if (!this.enabled()) return;
    this.ctx ||= new AudioContext();
    const def = this.board[name];
    if (def === 'noise') {
      const ctx = this.ctx, len = ctx.sampleRate * 0.8, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (Math.sin(i / 900) > 0.2 ? 1 : 0.15) * (1 - i / len);
      const s = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = 0.15; s.buffer = buf; s.connect(g).connect(ctx.destination); s.start();
      return;
    }
    let t = 0;
    for (const [f, d, type, v] of def || []) { setTimeout(() => this.tone([f], d, type, v), t * 1000); t += d * 0.8; }
  },
};

// ─── Masaüstü bildirimleri ───
function desktopNotify(title, body, icon, onclick) {
  if (localStorage.getItem('yanki_notif') === '0' || !('Notification' in window) || Notification.permission !== 'granted') return;
  try { const n = new Notification(title, { body, icon, silent: true }); n.onclick = () => { window.focus(); onclick?.(); n.close(); }; } catch { /* yoksay */ }
}

const avatarColor = (id) => ['#5865f2', '#eb459e', '#3ba55c', '#faa61a', '#ed4245', '#7c5cff', '#00a8fc', '#e67e22'][Number(String(id).slice(-3)) % 8];
