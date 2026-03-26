export const api = {
  invoke: (channel, data) => window.electronAPI.invoke(channel, data),
  getImageUrl: (filename) => window.electronAPI.getImageUrl(filename)
}
