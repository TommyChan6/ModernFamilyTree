// "Deleted — Undo" toasts. The Undo button reverts exactly the edit it was
// shown for, never a later one:
//  • the next undoable write anywhere dismisses every open undo toast, and
//  • at click time the history top must still be that write (same channel,
//    nothing undone since — a Ctrl+Z in between leaves canRedo true).
import { onUndoableMutation } from '../api'
import { translate as t } from '../i18n'
import { useMainStore } from '../store/index.js'
import { toast, dismissToast } from './dialogs.js'

const live = new Set()

onUndoableMutation(() => {
  for (const id of live) dismissToast(id)
  live.clear()
})

/** Call right after a successful undoable store action. */
export function undoToast(message, channel) {
  const store = useMainStore()
  const id = toast(message, {
    tone: 'success',
    action: {
      label: t('dialog.undo'),
      run: async () => {
        live.delete(id)
        const h = store.historyStatus
        if (!h.canUndo || h.canRedo || (channel && h.undoChannel !== channel)) return
        await store.undo()
      }
    }
  })
  live.add(id)
  return id
}
