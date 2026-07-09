import { ref, onBeforeUnmount } from 'vue'

// Grab-and-drag navigation for a native scroll container: press and pull the page
// to move it, like a hand tool. Native wheel/trackpad scrolling keeps working
// alongside this. scrollTop writes are rAF-coalesced so a fast drag updates at
// most once per frame.
//
//   dragging     — reactive flag (drive the grab/grabbing cursor)
//   onPointerDown — bind to the scroll container's @pointerdown
//   wasDragged()  — true if the gesture that just ended actually moved; call it
//                   from child click handlers to swallow the click after a drag
export function useDragScroll(scrollEl, opts = {}) {
  const threshold = opts.threshold ?? 5

  const dragging = ref(false)
  let active = false
  let moved = false
  let startY = 0
  let startTop = 0

  let raf = 0
  let pendingTop = 0
  function flush() {
    raf = 0
    if (scrollEl.value) scrollEl.value.scrollTop = pendingTop
  }
  function scheduleScroll(top) {
    pendingTop = top
    if (!raf) raf = requestAnimationFrame(flush)
  }

  function onPointerDown(e) {
    // Left button only, and never hijack drags that start on a form control.
    if (e.button !== 0 || !scrollEl.value) return
    if (e.target.closest('input, textarea, select, [contenteditable]')) return
    active = true
    moved = false
    startY = e.clientY
    startTop = scrollEl.value.scrollTop
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  function onPointerMove(e) {
    if (!active) return
    const dy = e.clientY - startY
    if (!moved) {
      if (Math.abs(dy) <= threshold) return
      moved = true
      dragging.value = true // suppress card hover/hit-testing while panning
    }
    scheduleScroll(startTop - dy)
    e.preventDefault()
  }

  function onPointerUp() {
    active = false
    dragging.value = false
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    // `moved` stays set until the follow-up click reads it via wasDragged().
  }

  function wasDragged() {
    if (moved) { moved = false; return true }
    return false
  }

  onBeforeUnmount(() => {
    if (raf) cancelAnimationFrame(raf)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  })

  return { dragging, onPointerDown, wasDragged }
}
