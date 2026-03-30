import { app, BrowserWindow, ipcMain, protocol, dialog, net } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDB } from './db.js'
import { registerHandlers } from './ipc.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Register appimg scheme as privileged BEFORE app ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'appimg', privileges: { secure: true, standard: true, bypassCSP: true } }
])

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    show: false,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Close confirmation for unsaved changes
  let forceClose = false
  mainWindow.on('close', async (e) => {
    if (forceClose) return
    e.preventDefault()
    const dirty = await mainWindow.webContents.executeJavaScript(
      'window.__isGraphDirty ? window.__isGraphDirty() : false'
    ).catch(() => false)

    if (dirty) {
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Save & Close', 'Discard & Close', 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        title: 'Unsaved Changes',
        message: 'You have unsaved graph layout changes.',
        detail: 'Would you like to save before closing?'
      })
      if (response === 0) {
        // Save then close
        await mainWindow.webContents.executeJavaScript(
          'window.__saveGraphLayout ? window.__saveGraphLayout() : Promise.resolve()'
        ).catch(() => {})
        forceClose = true
        mainWindow.close()
      } else if (response === 1) {
        // Discard and close
        forceClose = true
        mainWindow.close()
      }
      // response === 2: Cancel, do nothing
    } else {
      forceClose = true
      mainWindow.close()
    }
  })

  if (process.env.NODE_ENV === 'development' && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  // Handle appimg:// protocol
  protocol.handle('appimg', async (req) => {
    const filename = decodeURIComponent(req.url.replace('appimg://', ''))
    const filePath = path.join(app.getPath('userData'), 'images', filename).replace(/\\/g, '/')
    return net.fetch('file:///' + filePath)
  })

  initDB()
  registerHandlers(ipcMain, app, dialog)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
