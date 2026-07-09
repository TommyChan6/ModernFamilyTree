import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { columnCount, gridHeight, rowWindow, CARD_W, GAP, PAD, ROW_H, OVERSCAN_ROWS } from './peopleLayout.js'

// Windowed CSS-grid virtualization over a native scroll container.
//
// Owns the reactive glue that the pure math in peopleLayout.js can't: the element
// measurements (via ResizeObserver) and the scroll position (rAF-coalesced so we
// touch state at most once per frame, no matter how fast wheel/trackpad events
// fire). All listeners/observers/frames are torn down on unmount.
//
//   scrollEl  — ref to the scroll container element
//   count     — ref or getter returning the current item count
//   opts      — geometry overrides (defaults come from peopleLayout.js)
//
// Returns reactive { cols, totalHeight, win: {startIndex,endIndex,offsetY}, onScroll, remeasure }.
export function useVirtualGrid(scrollEl, count, opts = {}) {
  const cardW = opts.cardW ?? CARD_W
  const gap = opts.gap ?? GAP
  const pad = opts.pad ?? PAD
  const rowH = opts.rowH ?? ROW_H
  const overscan = opts.overscan ?? OVERSCAN_ROWS

  const scrollTop = ref(0)
  const viewW = ref(0)
  const viewH = ref(0)

  const itemCount = () => (typeof count === 'function' ? count() : count.value)

  const cols = computed(() => columnCount(viewW.value - pad * 2, cardW, gap))
  const totalHeight = computed(() => gridHeight(itemCount(), cols.value, rowH, pad, gap))
  const win = computed(() =>
    rowWindow(scrollTop.value, viewH.value, itemCount(), cols.value, { rowH, pad, overscan })
  )

  // Coalesce a burst of scroll events into a single state write per frame.
  let raf = 0
  function onScroll() {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      scrollTop.value = scrollEl.value?.scrollTop || 0
    })
  }

  // Re-read the container box. clientWidth/Height exclude the scrollbar, so the
  // column math stays honest whether or not the scrollbar is showing. Also resync
  // the cached scroll position — after the list shrinks the browser clamps the
  // real scrollTop, and this keeps our window from lagging a frame behind.
  function remeasure() {
    const el = scrollEl.value
    if (!el) return
    viewW.value = el.clientWidth
    viewH.value = el.clientHeight
    scrollTop.value = el.scrollTop
  }

  let ro = null
  onMounted(() => {
    remeasure()
    ro = new ResizeObserver(remeasure)
    if (scrollEl.value) ro.observe(scrollEl.value)
  })
  onBeforeUnmount(() => {
    if (ro) { ro.disconnect(); ro = null }
    if (raf) { cancelAnimationFrame(raf); raf = 0 }
  })

  return { cols, totalHeight, win, onScroll, remeasure }
}
