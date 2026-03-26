import { contextBridge, ipcRenderer } from 'electron'
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  getImageUrl: (filename) => filename ? `appimg://${encodeURIComponent(filename)}` : null
})
