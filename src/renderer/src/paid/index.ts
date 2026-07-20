// The paid-features gate (deployment plan Step 2.8).
//
// This module is the ONLY place allowed to import capability-gated features —
// today the experimental 3D Space view and the Character view. They're pulled
// in with dynamic import(), so they compile into separate lazy chunks (named
// `paid-*` by vite.config.web.js) that a browser only downloads when the gate
// approves. Two payoffs: a future free user's browser never even RECEIVES
// paid code, and everyone's first page load gets lighter.
//
// The gate consults the caps/plan switchboard (store.caps ← PLAN_FEATURES in
// src/shared/auth.ts, Step 2.7) at load time. Usage sites already v-if on the
// same caps flags, so the refusal screen is defense-in-depth — it renders only
// if something bypasses those checks (or a future paid tier flips a flag).

import { defineAsyncComponent, defineComponent, h } from 'vue'
import type { Component } from 'vue'
import { useMainStore } from '../store/index.js'

/** Friendly refusal, shown instead of a gated feature the plan doesn't allow.
 *  Styled with the design tokens so it fits both themes. */
const PlanRefusal = defineComponent({
  name: 'PlanRefusal',
  setup() {
    return () =>
      h(
        'div',
        {
          style:
            'display:grid;place-items:center;position:absolute;inset:0;' +
            'background:var(--bg);color:var(--t2);font-family:var(--font);z-index:5;'
        },
        h(
          'div',
          {
            style:
              'text-align:center;max-width:340px;padding:28px;border:1px solid var(--border);' +
              'border-radius:var(--radius);background:var(--surface);box-shadow:var(--shadow);'
          },
          [
            h('div', { style: 'font-size:28px;margin-bottom:10px;' }, '🔒'),
            h(
              'div',
              { style: 'font-weight:700;color:var(--t1);margin-bottom:6px;font-size:15px;' },
              'This feature needs a higher plan'
            ),
            h(
              'div',
              { style: 'font-size:12.5px;line-height:1.5;' },
              'Your current plan doesn’t include this feature yet.'
            )
          ]
        )
      )
  }
})

/** Wrap a gated feature: check the switchboard, then (and only then) fetch its
 *  chunk. Vue forwards refs through async components to the resolved inner
 *  component, so callers keep using template refs as if the import were static. */
function gated(flag: string, loader: () => Promise<Component>): Component {
  return defineAsyncComponent({
    loader: async () => {
      const store = useMainStore()
      return store.caps?.[flag] ? loader() : PlanRefusal
    }
  })
}

/** The experimental Space (3D) graph view — Advanced mode + 🧪 Labs. */
export const Graph3DView = gated('space3d', () =>
  import('../components/Graph3DView.vue').then((m) => m.default)
)

/** The experimental Character view (buildable portraits) — same gates. */
export const CharacterView = gated('character', () =>
  import('../components/character/CharacterView.vue').then((m) => m.default)
)
