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
import { burnMaskUrl } from './medievalArt'

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
 * @param {{ style?: 'circle' | 'ink' | 'burn' }} [opts] how the new theme
 *   grows out of the click point: a circle (default); 'ink' — a ragged ink
 *   blot (the 水墨 theme's own reveal); 'burn' — a flame-edged hole burning
 *   through the page (the medieval theme's).
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
  if (opts.style === 'ink' || opts.style === 'burn') {
    maskReveal(vt, x, y, r, opts.style)
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

// Mask reveals: the incoming snapshot is masked by a shape that grows from
// the click point. 'ink' — an ink blot (lib/inkArt.ts) that blooms fast at
// first, then creeps as the ink wicks into the paper; 'burn' — a hole burning
// through the vellum (lib/medievalArt.ts) while the old page scorches. The
// mask image lives in CSS (html.ink-reveal / html.med-reveal, see
// styles/ink.css and styles/medieval.css); only its size/position animate.
const MASKS = {
  ink: { prop: '--ink-blot-mask', cls: 'ink-reveal', url: () => inkBlotMaskUrl(17), ms: 1500 },
  burn: { prop: '--med-burn-mask', cls: 'med-reveal', url: () => burnMaskUrl(23), ms: 1400 }
}

function maskReveal(vt, x, y, r, style) {
  const m = MASKS[style]
  const root = document.documentElement
  root.style.setProperty(m.prop, `url("${m.url()}")`)
  root.classList.add(m.cls)
  const S = ((2 * r) / 0.84) * 1.08 // shape radius is 0.42·S — make it overrun the far corner
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
          duration: m.ms,
          easing: 'cubic-bezier(0.3, 0.6, 0.25, 1)',
          pseudoElement: '::view-transition-new(root)'
        }
      )
    })
    .catch(() => {})
  vt.finished.finally(() => root.classList.remove(m.cls))
}
