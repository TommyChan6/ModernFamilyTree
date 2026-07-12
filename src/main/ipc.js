import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import { getDB } from './db.js'
import { channelHandlers, WRITE_CHANNELS, nowStr } from '../shared/dbCore'
import { PUBLIC_CHANNELS, resolveSession, unwrapRequest } from '../shared/auth'

// The Electron shell around the shared data core (src/shared/dbCore.ts).
// Every shared channel gets the same treatment: run the handler against the
// raw DB, save after writes, and wrap the result in the { success, data | error }
// envelope — exceptions never cross the process boundary. Only the genuinely
// platform-bound channels (file dialog, file bytes) are implemented here.

/** Platform services injected into the shared handlers. */
const env = {
  uuid: randomUUID,
  nowStr,
  // Persist an image into userData/images and return its stored path. Accepts
  // either a picked file's path (copied) or a data: URL (decoded and written —
  // how renderer-generated images like character portraits arrive).
  storeImageFile(srcPath) {
    if (srcPath.startsWith('data:')) {
      const m = /^data:image\/([a-z0-9+.-]+);base64,(.+)$/i.exec(srcPath)
      if (!m) throw new Error('Unsupported image data URL')
      const ext = m[1] === 'jpeg' ? 'jpg' : m[1] === 'svg+xml' ? 'svg' : m[1]
      const destPath = path.join(app.getPath('userData'), 'images', `${randomUUID()}.${ext}`)
      fs.writeFileSync(destPath, Buffer.from(m[2], 'base64'))
      return destPath
    }
    const filename = randomUUID() + path.extname(srcPath)
    const destPath = path.join(app.getPath('userData'), 'images', filename)
    fs.copyFileSync(srcPath, destPath)
    return destPath
  },
  // Best-effort delete of a stored image file (already-gone files are fine).
  removeImageFile(filePath) {
    try {
      fs.unlinkSync(filePath)
    } catch (_) {
      /* ignore */
    }
  }
}

export function registerHandlers(ipcMain, _app, dialog) {
  // ── All shared channels (projects/persons/relationships/factions/scenarios/
  //    images metadata/settings/globalSettings) ───────────────────────────────
  for (const [channel, handler] of Object.entries(channelHandlers)) {
    ipcMain.handle(channel, async (_event, raw) => {
      try {
        const { db, save } = getDB()
        // Auth middleware, the same shape a hosted server would run: unwrap
        // the request envelope, resolve the bearer token to a user, and
        // reject non-public channels without a live session.
        const { token, data } = unwrapRequest(raw)
        const ctx = { user: resolveSession(db, token, nowStr()), token }
        if (!ctx.user && !PUBLIC_CHANNELS.has(channel)) {
          return { success: false, error: 'Not signed in' }
        }
        const result = await handler(db, data, env, ctx)
        if (WRITE_CHANNELS.has(channel)) save()
        return { success: true, data: result }
      } catch (err) {
        return { success: false, error: err.message }
      }
    })
  }

  // ── images:bytes ───────────────────────────────────────────────────────────
  // Returns the raw bytes of an image file. The renderer wraps these in a
  // (same-origin) Blob and downscales via createImageBitmap → a tiny cached
  // thumbnail, so card/list views never decode or GPU-upload the full-resolution
  // photo while scrolling. Done in the renderer because Electron's nativeImage
  // can't decode WebP (the app's photo format) — Chromium can decode everything.
  ipcMain.handle('images:bytes', async (_event, raw) => {
    try {
      const { filePath } = unwrapRequest(raw).data || {}
      if (!filePath || !fs.existsSync(filePath)) return { success: false, error: 'missing' }
      return { success: true, data: fs.readFileSync(filePath) } // Buffer → Uint8Array in renderer
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── images:openDialog ──────────────────────────────────────────────────────
  ipcMain.handle('images:openDialog', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }]
      })
      if (result.canceled || !result.filePaths.length) return { success: true, data: null }
      return { success: true, data: result.filePaths[0] }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}
