// <UiIcon name="trash-2" :size="16" /> — the app's one icon component.
// `name` is any value icons.js resolves: a Lucide kebab-case name, an app icon
// (graph, directory, timeline…), an alias, or a legacy stored glyph. Renders a
// 24×24 currentColor stroke SVG as render-function vnodes (no v-html); it is
// inline-flex-safe (block-level box, no baseline gap) so it centres in any
// flex button. Unknown names render an empty box of the same size, keeping
// layouts stable.
import { h } from 'vue'
import { iconNode } from './icons.js'

export { ICON_NAMES, resolveIcon, hasIcon } from './icons.js'

export default {
  name: 'UiIcon',
  props: {
    name: { type: String, default: '' },
    size: { type: [Number, String], default: 16 },
    stroke: { type: [Number, String], default: 2 },
    /** Accessible label; when set the icon is announced instead of hidden. */
    label: { type: String, default: '' }
  },
  setup(props) {
    return () => {
      const node = iconNode(props.name) || []
      return h(
        'svg',
        {
          class: 'ui-icon',
          xmlns: 'http://www.w3.org/2000/svg',
          viewBox: '0 0 24 24',
          width: props.size,
          height: props.size,
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': props.stroke,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          focusable: 'false',
          ...(props.label ? { role: 'img', 'aria-label': props.label } : { 'aria-hidden': 'true' })
        },
        node.map(([tag, attrs]) => h(tag, attrs))
      )
    }
  }
}
