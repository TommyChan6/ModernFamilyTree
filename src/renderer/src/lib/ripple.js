// Material-style click ripple for the shared button system.
//
// One delegated pointerdown listener on the document (no per-button wiring):
// any `.btn` or `[data-ripple]` element gets a circle that blooms out from the
// press point and fades. The element needs `position: relative; overflow:
// hidden` — `.btn` already has both (see styles/global.css → .ui-ripple).
// Honors prefers-reduced-motion.

const SELECTOR = '.btn, [data-ripple]'

let installed = false

export function installRipple(root = document) {
  if (installed || typeof window === 'undefined') return
  installed = true
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  root.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0 || reduce?.matches) return
      const el = e.target instanceof Element ? e.target.closest(SELECTOR) : null
      if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return
      const rect = el.getBoundingClientRect()
      const size = Math.hypot(rect.width, rect.height) * 2
      const dot = document.createElement('span')
      dot.className = 'ui-ripple'
      dot.style.width = dot.style.height = `${size}px`
      dot.style.left = `${e.clientX - rect.left - size / 2}px`
      dot.style.top = `${e.clientY - rect.top - size / 2}px`
      el.appendChild(dot)
      dot.addEventListener('animationend', () => dot.remove(), { once: true })
      // Safety net if the animation never runs (element hidden mid-press).
      setTimeout(() => dot.remove(), 900)
    },
    { passive: true }
  )
}
