<template>
  <Teleport to="body">
    <!-- ── Confirm / alert dialogs (one at a time; queued ones wait) ────────── -->
    <Transition name="dh">
      <div v-if="current" :key="current.id" class="dh-backdrop ink-veil" @pointerdown.self="cancel">
        <div
          class="dh-box ink-mount ink-unroll ink-rollers"
          :class="'dh-' + current.tone"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="'dh-title-' + current.id"
          :aria-describedby="'dh-msg-' + current.id"
        >
          <div v-if="current.icon" class="dh-icon" aria-hidden="true">
            <UiIcon :name="dialogIcon(current)" :size="24" />
          </div>
          <h2 :id="'dh-title-' + current.id" class="dh-title">
            {{
              current.title ||
              (current.kind === 'alert' ? t('dialog.notice') : t('dialog.areYouSure'))
            }}
          </h2>
          <p v-if="current.message" :id="'dh-msg-' + current.id" class="dh-msg">
            {{ current.message }}
          </p>
          <div class="dh-actions">
            <button v-if="current.kind === 'confirm'" class="btn btn-ghost" @click="cancel">
              {{ current.cancelLabel || t('dialog.cancel') }}
            </button>
            <button
              ref="confirmBtn"
              class="btn"
              :class="current.tone === 'danger' ? 'btn-danger-solid' : 'btn-primary'"
              @click="accept"
            >
              {{
                current.confirmLabel ||
                (current.kind === 'alert'
                  ? t('dialog.ok')
                  : current.tone === 'danger'
                    ? t('dialog.delete')
                    : t('dialog.confirm'))
              }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ── Toast stack (bottom-center) ──────────────────────────────────────── -->
    <TransitionGroup tag="div" name="dh-toast" class="dh-toasts" aria-live="polite">
      <div
        v-for="tst in dialogState.toasts"
        :key="tst.id"
        class="dh-toast"
        :class="'dh-toast-' + tst.tone"
        role="status"
        @mouseenter="hover(tst.id, true)"
        @mouseleave="hover(tst.id, false)"
      >
        <span class="dh-toast-icon" aria-hidden="true">
          <UiIcon :name="toastIcon(tst)" :size="13" :stroke="2.5" />
        </span>
        <span class="dh-toast-msg">{{ tst.message }}</span>
        <button v-if="tst.action" class="dh-toast-action" @click="runAction(tst)">
          {{ tst.action.label }}
        </button>
        <button
          class="dh-toast-close"
          :title="t('dialog.dismiss')"
          :aria-label="t('dialog.dismiss')"
          @click="dismissToast(tst.id)"
        >
          <UiIcon name="x" :size="14" />
        </button>
        <span
          v-if="tst.duration > 0"
          class="dh-toast-bar"
          :class="{ held: held.has(tst.id) }"
          :style="{ animationDuration: tst.duration + 'ms' }"
        ></span>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from '../../i18n'
import { dialogState, settleDialog, dismissToast, holdToast, TONE_ICON } from '../../lib/dialogs.js'
import UiIcon, { hasIcon } from './UiIcon.js'

// Renders lib/dialogs.js: confirm/alert dialogs and the toast stack. Mounted
// once by App.vue. While a dialog is up it owns the keyboard (Enter confirms,
// Esc cancels) and swallows every other key so graph/view hotkeys underneath
// never fire behind it.
const { t } = useI18n()
const current = computed(() => dialogState.dialogs[0] || null)
const confirmBtn = ref(null)
const held = reactive(new Set())
let restoreFocus = null

watch(current, async (d, prev) => {
  if (d && !prev) restoreFocus = document.activeElement
  if (d) {
    await nextTick()
    confirmBtn.value?.focus()
  } else if (restoreFocus && typeof restoreFocus.focus === 'function') {
    restoreFocus.focus()
    restoreFocus = null
  }
})

// Icons are UiIcon names (legacy emoji passed by older callers still resolve);
// anything unknown falls back to the tone's own icon so the badge never blanks.
function dialogIcon(d) {
  if (hasIcon(d.icon)) return d.icon
  return d.tone === 'danger' ? 'trash-2' : 'info'
}
function toastIcon(tst) {
  return hasIcon(tst.icon) ? tst.icon : TONE_ICON[tst.tone] || 'info'
}

function accept() {
  if (current.value) settleDialog(current.value.id, true)
}
function cancel() {
  if (current.value) settleDialog(current.value.id, current.value.kind === 'alert')
}

function onKey(e) {
  if (!current.value) return
  e.stopPropagation()
  if (e.key === 'Escape') {
    e.preventDefault()
    cancel()
  } else if (e.key === 'Enter' && !e.isComposing) {
    // Let a focused button handle its own Enter (Cancel stays Cancel).
    if (e.target instanceof HTMLButtonElement && e.target.closest('.dh-box')) return
    e.preventDefault()
    accept()
  } else if (e.key === 'Tab') {
    // Keep focus inside the dialog.
    const btns = [...document.querySelectorAll('.dh-box button')]
    if (!btns.length) return
    const i = btns.indexOf(document.activeElement)
    e.preventDefault()
    btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus()
  }
}

function hover(id, on) {
  if (on) held.add(id)
  else held.delete(id)
  holdToast(id, on)
}

async function runAction(tst) {
  dismissToast(tst.id)
  await tst.action?.run?.()
}

onMounted(() => window.addEventListener('keydown', onKey, true))
onUnmounted(() => window.removeEventListener('keydown', onKey, true))
</script>

<style scoped>
/* ── Dialog ───────────────────────────────────────────────────────────────── */
.dh-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(8, 10, 18, 0.5);
  backdrop-filter: blur(6px) saturate(1.1);
  -webkit-backdrop-filter: blur(6px) saturate(1.1);
}

.dh-box {
  position: relative;
  width: min(420px, 100%);
  padding: 26px 24px 20px;
  border-radius: var(--r-xl);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  text-align: center;
  overflow: hidden;
}

/* A soft wash of the dialog's tone behind the icon */
.dh-box::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 120px;
  background: radial-gradient(ellipse at 50% 0%, rgba(var(--accent-rgb), 0.16), transparent 70%);
  pointer-events: none;
}
.dh-danger::before {
  background: radial-gradient(ellipse at 50% 0%, rgba(var(--danger-rgb), 0.16), transparent 70%);
}

.dh-icon {
  position: relative;
  width: 52px;
  height: 52px;
  margin: 0 auto 14px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--adim);
  color: var(--accent);
  animation: dh-icon-in 0.5s var(--ease-spring) both;
}
.dh-danger .dh-icon {
  background: rgba(var(--danger-rgb), 0.14);
  color: var(--danger);
}
/* Expanding ring that pings once when the dialog appears */
.dh-icon::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid currentColor;
  opacity: 0;
  animation: dh-ping 0.9s var(--ease-out) 0.15s;
}

@keyframes dh-icon-in {
  from {
    transform: scale(0.4) rotate(-20deg);
    opacity: 0;
  }
}
@keyframes dh-ping {
  from {
    opacity: 0.6;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(1.7);
  }
}

.dh-title {
  position: relative;
  font-size: 16px;
  font-weight: 700;
  color: var(--t1);
  margin-bottom: 6px;
}

.dh-msg {
  position: relative;
  font-size: 13px;
  color: var(--t2);
  line-height: 1.55;
  white-space: pre-line;
}

.dh-actions {
  position: relative;
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 20px;
}
.dh-actions .btn {
  min-width: 104px;
}

.dh-enter-active {
  transition: opacity 0.2s ease;
}
.dh-enter-active .dh-box {
  transition:
    transform 0.34s var(--ease-spring),
    opacity 0.2s ease;
}
.dh-leave-active {
  transition: opacity 0.16s ease;
}
.dh-leave-active .dh-box {
  transition:
    transform 0.16s ease,
    opacity 0.16s ease;
}
.dh-enter-from,
.dh-leave-to {
  opacity: 0;
}
.dh-enter-from .dh-box {
  transform: translateY(16px) scale(0.94);
  opacity: 0;
}
.dh-leave-to .dh-box {
  transform: scale(0.97);
  opacity: 0;
}

/* ── Toasts ───────────────────────────────────────────────────────────────── */
.dh-toasts {
  position: fixed;
  left: 50%;
  bottom: 84px; /* clears the views' bottom toolbars */
  transform: translateX(-50%);
  z-index: 9100;
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  width: max-content;
  max-width: calc(100vw - 32px);
}

.dh-toast {
  --tone: var(--accent);
  --tone-rgb: var(--accent-rgb);
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 240px;
  max-width: 520px;
  padding: 9px 10px 9px 12px;
  border-radius: var(--r-lg);
  background: var(--glass-soft);
  backdrop-filter: blur(16px) saturate(1.3);
  -webkit-backdrop-filter: blur(16px) saturate(1.3);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  color: var(--t1);
  font-size: 13px;
  font-weight: 500;
  pointer-events: auto;
  overflow: hidden;
}
.dh-toast-success {
  --tone: var(--success);
  --tone-rgb: 76, 175, 114;
}
.dh-toast-warning {
  --tone: var(--warning);
  --tone-rgb: 245, 166, 35;
}
.dh-toast-error {
  --tone: var(--danger);
  --tone-rgb: var(--danger-rgb);
}

.dh-toast-icon {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--tone);
  background: rgba(var(--tone-rgb), 0.16);
  animation: dh-toast-icon 0.5s var(--ease-spring) 0.08s both;
}
@keyframes dh-toast-icon {
  from {
    transform: scale(0) rotate(-90deg);
  }
}

.dh-toast-msg {
  flex: 1;
  min-width: 0;
  line-height: 1.4;
}

.dh-toast-action {
  flex-shrink: 0;
  border: none;
  background: rgba(var(--tone-rgb), 0.16);
  color: var(--tone);
  font-size: 12.5px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: background var(--dur) ease;
}
.dh-toast-action:hover {
  background: rgba(var(--tone-rgb), 0.28);
}

.dh-toast-close {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
}
.dh-toast-close:hover {
  color: var(--t1);
  background: var(--hover);
}

/* Time-left bar along the bottom edge; pauses while hovered */
.dh-toast-bar {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  width: 100%;
  background: var(--tone);
  opacity: 0.7;
  transform-origin: left;
  animation: dh-toast-bar linear forwards;
}
.dh-toast-bar.held {
  animation-play-state: paused;
}
@keyframes dh-toast-bar {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}

.dh-toast-enter-active {
  transition:
    opacity 0.25s ease,
    transform 0.42s var(--ease-spring);
}
.dh-toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  position: absolute;
}
.dh-toast-move {
  transition: transform 0.3s var(--ease-out);
}
.dh-toast-enter-from {
  opacity: 0;
  transform: translateY(18px) scale(0.9);
}
.dh-toast-leave-to {
  opacity: 0;
  transform: scale(0.92);
}

/* ── 水墨 ink theme ───────────────────────────────────────────────────────
   Dialogs are small hanging scrolls (.ink-mount/.ink-unroll/.ink-rollers in
   styles/ink.css) with their icon pressed as a seal; toasts are paper slips
   with a silk edge, and their time-left bar is a brush stroke drying out. */
:root[data-theme='ink'] .dh-box {
  overflow: visible;
  padding: 30px 28px 24px;
}
/* (::before is the top roller in ink, so the tone wash is dropped) */
:root[data-theme='ink'] .dh-icon {
  width: 46px;
  height: 46px;
  border-radius: 3px 5px 2px 6px / 5px 2px 6px 3px;
  background:
    var(--ink-paper-light, none) center / 200px 200px,
    var(--accent);
  background-blend-mode: multiply, normal;
  box-shadow:
    inset 0 0 0 2px rgba(251, 244, 230, 0.5),
    inset 0 0 0 3px rgba(90, 15, 10, 0.25);
  transform: rotate(-3deg);
  animation: dh-ink-stamp 0.5s var(--ease-spring) both;
}
:root[data-theme='ink'] .dh-danger .dh-icon {
  background-color: var(--danger);
}
:root[data-theme='ink'] .dh-icon {
  color: var(--on-accent);
}
@keyframes dh-ink-stamp {
  from {
    transform: scale(1.5) rotate(-12deg);
    opacity: 0;
  }
  60% {
    opacity: 1;
    transform: scale(0.94) rotate(-1deg);
  }
}
/* the ping becomes an ensō rippling out */
:root[data-theme='ink'] .dh-icon::after {
  inset: -14px;
  border: none;
  border-radius: 0;
  background-color: var(--ink-black);
  -webkit-mask: var(--ink-enso) center / contain no-repeat;
  mask: var(--ink-enso) center / contain no-repeat;
}
:root[data-theme='ink'] .dh-title {
  font-family: var(--font-brush);
  font-size: 23px;
  font-weight: 400;
  letter-spacing: 0.02em;
}
:root[data-theme='ink'] .dh-msg {
  font-size: 14px;
}

:root[data-theme='ink'] .dh-toast {
  border-radius: 1px;
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border-color: var(--ink-mount-line);
  box-shadow:
    inset 4px 0 0 var(--tone),
    0 0 0 2px var(--ink-silk),
    0 0 0 3px rgba(58, 42, 22, 0.2),
    var(--shadow);
  font-size: 13.5px;
  padding-left: 16px;
}
:root[data-theme='ink'] .dh-toast-icon {
  border-radius: 2px 3px 2px 4px;
  color: var(--on-accent);
  background: var(--tone);
}
:root[data-theme='ink'] .dh-toast-action {
  border-radius: 2px;
  font-family: var(--font-ink-label);
  background: transparent;
  box-shadow: inset 0 0 0 1px rgba(var(--tone-rgb), 0.5);
}
:root[data-theme='ink'] .dh-toast-action:hover {
  background: rgba(var(--tone-rgb), 0.1);
}
:root[data-theme='ink'] .dh-toast-close {
  border-radius: 3px;
}
:root[data-theme='ink'] .dh-toast-bar {
  height: 4px;
  bottom: 1px;
  left: 8px;
  width: calc(100% - 16px);
  -webkit-mask: var(--ink-underline) center / 100% 100% no-repeat;
  mask: var(--ink-underline) center / 100% 100% no-repeat;
}
:root[data-theme='ink'] .dh-toast-success {
  --tone: var(--green);
  --tone-rgb: 79, 125, 92;
}
:root[data-theme='ink'] .dh-toast-warning {
  --tone: var(--ink-ochre);
  --tone-rgb: 180, 136, 76;
}
</style>
