// In-app confirm / alert dialogs and toasts — the replacement for the native
// window.confirm/alert, which block the renderer, can't be themed or
// translated, and look foreign in both Electron and the browser.
//
//   if (!(await confirmDialog({ title, message, tone: 'danger' }))) return
//   toast(t('toast.deleted', { name }), { tone: 'success', action: undoAction() })
//
// State is a plain module-level reactive (no Pinia dependency) rendered by
// components/ui/DialogHost.vue, which App.vue mounts once.
import { reactive } from 'vue'

export const dialogState = reactive({
  /** @type {Array<{id:number, kind:'confirm'|'alert', title:string, message:string,
   *   confirmLabel?:string, cancelLabel?:string, tone:'primary'|'danger', icon?:string,
   *   resolve:(v:boolean)=>void}>} */
  dialogs: [],
  /** @type {Array<{id:number, message:string, tone:string, icon?:string,
   *   duration:number, action?:{label:string, run:()=>unknown}}>} */
  toasts: []
})

let seq = 0

/**
 * Ask the user to confirm. Resolves true (confirmed) or false (cancelled,
 * Esc, backdrop click). Options: title, message, confirmLabel, cancelLabel,
 * tone ('primary' | 'danger'), icon (a UiIcon name shown in the header).
 */
export function confirmDialog(opts = {}) {
  return new Promise((resolve) => {
    dialogState.dialogs.push({
      id: ++seq,
      kind: 'confirm',
      title: opts.title || '',
      message: opts.message || '',
      confirmLabel: opts.confirmLabel,
      cancelLabel: opts.cancelLabel,
      tone: opts.tone === 'danger' ? 'danger' : 'primary',
      icon: opts.icon ?? (opts.tone === 'danger' ? 'trash-2' : undefined),
      resolve
    })
  })
}

/** A one-button notice. Resolves when dismissed. */
export function alertDialog(opts = {}) {
  return new Promise((resolve) => {
    dialogState.dialogs.push({
      id: ++seq,
      kind: 'alert',
      title: opts.title || '',
      message: opts.message || '',
      confirmLabel: opts.confirmLabel,
      tone: 'primary',
      icon: opts.icon ?? 'info',
      resolve: () => resolve()
    })
  })
}

export function settleDialog(id, value) {
  const i = dialogState.dialogs.findIndex((d) => d.id === id)
  if (i === -1) return
  const [d] = dialogState.dialogs.splice(i, 1)
  d.resolve(!!value)
}

// Default icon per tone (UiIcon names; callers may pass their own `icon`).
export const TONE_ICON = {
  success: 'check',
  error: 'circle-alert',
  warning: 'triangle-alert',
  info: 'info'
}
// id → { timer, remaining, startedAt } — auto-dismiss bookkeeping, kept out of
// the reactive state so hover pauses never re-render the stack.
const clocks = new Map()

function arm(id, ms) {
  const c = { remaining: ms, startedAt: performance.now(), timer: 0 }
  c.timer = setTimeout(() => dismissToast(id), ms)
  clocks.set(id, c)
}

/**
 * Show a toast. Options: tone ('info' | 'success' | 'warning' | 'error'),
 * duration (ms; 0 = sticky), icon (a UiIcon name), action ({ label, run } — e.g. Undo).
 * Returns the toast id (pass to dismissToast).
 */
export function toast(message, opts = {}) {
  const id = ++seq
  const tone = TONE_ICON[opts.tone] ? opts.tone : 'info'
  const duration = opts.duration ?? (opts.action ? 6000 : tone === 'error' ? 6000 : 3200)
  dialogState.toasts.push({
    id,
    message: String(message ?? ''),
    tone,
    icon: opts.icon ?? TONE_ICON[tone],
    duration,
    action: opts.action
  })
  // Keep the stack short: oldest drops first.
  while (dialogState.toasts.length > 4) dismissToast(dialogState.toasts[0].id)
  if (duration > 0) arm(id, duration)
  return id
}

export function dismissToast(id) {
  clearTimeout(clocks.get(id)?.timer)
  clocks.delete(id)
  const i = dialogState.toasts.findIndex((t) => t.id === id)
  if (i !== -1) dialogState.toasts.splice(i, 1)
}

/** Pause/resume auto-dismiss while the pointer rests on a toast. The host
 *  pauses the progress bar's CSS animation in step, so the two stay synced. */
export function holdToast(id, held) {
  const c = clocks.get(id)
  if (!c) return
  if (held) {
    clearTimeout(c.timer)
    c.remaining = Math.max(0, c.remaining - (performance.now() - c.startedAt))
  } else {
    c.startedAt = performance.now()
    c.timer = setTimeout(() => dismissToast(id), c.remaining)
  }
}
