import { contextBridge, ipcRenderer } from 'electron'
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  getImageUrl: (filePath) => {
    if (!filePath) return null
    // Normalize to forward slashes and encode each path segment
    const normalized = filePath.replace(/\\/g, '/')
    return 'appimg://img/' + normalized.split('/').map(encodeURIComponent).join('/')
  }
})
