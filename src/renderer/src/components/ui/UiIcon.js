// <UiIcon name="graph" :size="20" /> — the app's shared stroke icon set
// (24×24 viewBox, currentColor, round caps). Icons are written as plain SVG
// markup for readability and compiled once into render-function vnodes (no
// v-html). Add new icons to ICONS; keep them single-color strokes so they
// inherit text color in both themes.
import { h } from 'vue'

const ICONS = {
  graph:
    '<circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="7" r="2.4"/><circle cx="12" cy="18" r="2.4"/><path d="M8.2 7.1 15.7 7M7.3 8.1l3.5 7.7M16.8 9.2l-3.6 6.8"/>',
  directory:
    '<circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c.6-3.3 3.1-5.2 6-5.2s5.4 1.9 6 5.2"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.6c1.7.6 2.8 2.2 3 4.9"/>',
  relationships:
    '<path d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 0 0-6-6l-1 1"/><path d="M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 0 0 6 6l1-1"/>',
  timeline:
    '<path d="M3 12h18"/><circle cx="7" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><path d="M7 5v5M15 14v5M11 4H7M19 20h-4"/>',
  groups: '<path d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4z"/><circle cx="12" cy="12" r="2.6"/>',
  map: '<path d="M9 4 3 6.5V20l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
  character:
    '<circle cx="12" cy="8.5" r="4.2"/><path d="M4.5 20.5c1-3.8 4-5.8 7.5-5.8s6.5 2 7.5 5.8"/><path d="M10.4 8.3h.01M13.6 8.3h.01"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
  style:
    '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.8-1.8 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.1"/><circle cx="10.5" cy="7" r="1.1"/><circle cx="15" cy="7.5" r="1.1"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  image:
    '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m20.5 16-5-5-8.5 8.5"/>'
}

// Flat, self-closing SVG markup → [tag, attrs] pairs.
function compile(markup) {
  const out = []
  for (const m of markup.matchAll(/<(\w+)([^>]*?)\/>/g)) {
    const attrs = {}
    for (const a of m[2].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]] = a[2]
    out.push([m[1], attrs])
  }
  return out
}
const COMPILED = Object.fromEntries(Object.entries(ICONS).map(([k, v]) => [k, compile(v)]))

export const ICON_NAMES = Object.keys(ICONS)

export default {
  name: 'UiIcon',
  props: {
    name: { type: String, required: true },
    size: { type: [Number, String], default: 18 },
    stroke: { type: [Number, String], default: 1.8 }
  },
  setup(props) {
    return () =>
      h(
        'svg',
        {
          class: 'ui-icon',
          viewBox: '0 0 24 24',
          width: props.size,
          height: props.size,
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': props.stroke,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'aria-hidden': 'true'
        },
        (COMPILED[props.name] || []).map(([tag, attrs]) => h(tag, attrs))
      )
  }
}
