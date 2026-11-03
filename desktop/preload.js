// Arayüze sadece gereken küçük ve güvenli bir köprü açılır (Node.js erişimi yok)
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('yankiDesktop', {
  platform: process.platform,
  getInfo: () => ipcRenderer.invoke('yanki:get-info'),
  onUpdate: (cb) => ipcRenderer.on('yanki:update', (_e, st) => cb(st)),
  installUpdate: () => ipcRenderer.invoke('yanki:install-update'),
  onPickSource: (cb) => ipcRenderer.on('yanki:pick-source', (_e, req) => cb(req)),
  pickSource: (requestId, sourceId, audio) => ipcRenderer.send('yanki:picked', { requestId, sourceId, audio: !!audio }),
  setServer: (url) => ipcRenderer.invoke('yanki:set-server', String(url)),
  retry: () => ipcRenderer.invoke('yanki:retry'),
  setBadge: (n) => ipcRenderer.send('yanki:badge', Number(n) || 0),
  getSavedToken: () => ipcRenderer.sendSync('yanki:token-get'),
  saveToken: (t) => ipcRenderer.send('yanki:token-set', String(t || '')),
  reportDisconnected: () => ipcRenderer.send('yanki:disconnected'),
});
