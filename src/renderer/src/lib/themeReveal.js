// Theme switch as a circular reveal: the new theme grows out of the point the
// user clicked (the topbar toggle, a Settings button…) until it covers the
// window. Uses the View Transitions API (Chromium 111+, so both Electron and
// modern browsers); anywhere it's missing — or with reduced motion — the
// change just applies instantly.
//
// `apply` must perform the DOM change synchronously (e.g. set
// document.documentElement.dataset.theme) — the browser snapshots the page
// before and after it.

import { inkBlotMaskUrl } from './inkArt'

let lastPointer = null

// Remember where the last press happened so callers that don't pass an
// origin (store actions) still reveal from the control that triggered them.
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    (e) => {
      lastPointer = { x: e.clientX, y: e.clientY, at: performance.now() }
    },
    { capture: true, passive: true }
  )
}

/** The last press position if it happened within `ms`, else null — lets an
 *  animation start from the control that triggered it (view switches too). */
export function recentPointer(ms = 1500) {
  return lastPointer && performance.now() - lastPointer.at < ms ? lastPointer : null
}

function originPoint(origin) {
  if (origin && Number.isFinite(origin.x)) return origin
  return recentPointer() ?? { x: window.innerWidth - 80, y: 24 } // topbar toggle area
}

/**
 * @param {() => unknown} apply
 * @param {{x:number,y:number}} [origin]
 * @param {{ ink?: boolean }} [opts] ink: the new theme bleeds out of the click
 *   point as a ragged ink blot (the 水墨 theme's own reveal) instead of a circle.
 */
export function revealTransition(apply, origin, opts = {}) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  if (!document.startViewTransition || reduce || document.hidden) {
    apply()
    return
  }
  const { x, y } = originPoint(origin)
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  let vt
  try {
    vt = document.startViewTransition(apply)
  } catch {
    apply()
    return
  }
  if (opts.ink) {
    inkReveal(vt, x, y, r)
    return
  }
  vt.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`]
        },
        {
          duration: 620,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          pseudoElement: '::view-transition-new(root)'
        }
      )
    })
    .catch(() => {})
}

// Ink reveal: the incoming snapshot is masked by an ink blot (lib/inkArt.ts)
// that blooms from the click point — fast at first, then creeping as the ink
// wicks into the paper. The mask image lives in CSS (html.ink-reveal, see
// styles/ink.css); only its size/position animate.
function inkReveal(vt, x, y, r) {
  const root = document.documentElement
  root.style.setProperty('--ink-blot-mask', `url("${inkBlotMaskUrl(17)}")`)
  root.classList.add('ink-reveal')
  const S = ((2 * r) / 0.84) * 1.08 // blot radius is 0.42·S — make it overrun the far corner
  vt.ready
    .then(() => {
      root.animate(
        {
          maskSize: ['0px 0px', `${S * 0.3}px ${S * 0.3}px`, `${S}px ${S}px`],
          maskPosition: [
            `${x}px ${y}px`,
            `${x - S * 0.15}px ${y - S * 0.15}px`,
            `${x - S / 2}px ${y - S / 2}px`
          ],
          offset: [0, 0.4, 1]
        },
        {
          duration: 1500,
          easing: 'cubic-bezier(0.3, 0.6, 0.25, 1)',
          pseudoElement: '::view-transition-new(root)'
        }
      )
    })
    .catch(() => {})
  vt.finished.finally(() => root.classList.remove('ink-reveal'))
}
