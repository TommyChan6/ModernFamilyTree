<template>
  <div class="rtp-backdrop" @click.self="$emit('close')">
    <div class="rtp">
      <div class="rtp-head">
        <div class="rtp-title">Relationship types</div>
        <button class="rtp-x" @click="$emit('close')">✕</button>
      </div>
      <div class="rtp-hint">
        Every relationship points at a type. Tune a type's look here
        <template v-if="store.caps.tuneAffinity">
          — and its <b>structural ↔ affinity</b> weight: structural types pull hard on the layout
          (family skeleton), affinity types are decorative overlays, negative weights push people
          apart (rivals).
        </template>
      </div>

      <div class="rtp-list">
        <div v-for="def in store.relTypes" :key="def.id" class="rtp-row">
          <div class="rtp-row-main">
            <span class="rtp-glyph" :style="{ color: swatchOf(def) }">{{ def.glyph }}</span>
            <input
              class="rtp-label"
              :value="def.label"
              @change="patch(def, { label: $event.target.value })"
            />
            <span v-if="def.directed" class="rtp-badge" :title="`${def.role_a} → ${def.role_b}`">
              {{ def.role_a }} → {{ def.role_b }}
            </span>
            <span v-else class="rtp-badge rtp-badge-sym">symmetric</span>
            <input
              class="rtp-color"
              type="color"
              :value="swatchOf(def)"
              :title="def.color ? 'Type color' : 'Colored by the Style panel'"
              @change="patch(def, { color: $event.target.value })"
            />
            <button
              v-if="!def.builtin"
              class="rtp-del"
              title="Delete this type (removes its relationships)"
              @click="removeDef(def)"
            >
              ✕
            </button>
            <span v-else class="rtp-builtin" title="Built-in — tunable, not deletable">●</span>
          </div>
          <div class="rtp-row-gen">
            <span class="rtp-w-label" title="How the generations layout treats this type's edges">
              Generations
            </span>
            <div class="rtp-seg">
              <button
                v-for="opt in GEN_ROLES"
                :key="opt.role"
                class="rtp-seg-btn"
                :class="{ 'is-on': def.symmetryRole === opt.role }"
                :title="opt.hint"
                @click="patch(def, { symmetryRole: opt.role })"
              >
                {{ opt.glyph }} {{ opt.label }}
              </button>
            </div>
          </div>
          <div v-if="store.caps.tuneAffinity" class="rtp-row-weight">
            <span class="rtp-w-label">Repel</span>
            <input
              class="rtp-slider"
              type="range"
              min="-1"
              max="1"
              step="0.05"
              :value="def.weight"
              @input="patchWeight(def, $event.target.value)"
            />
            <span class="rtp-w-label">Structural</span>
            <span class="rtp-w-val">{{ def.weight.toFixed(2) }}</span>
          </div>
        </div>
      </div>

      <!-- New custom type -->
      <div v-if="store.caps.customRelTypes" class="rtp-new">
        <div class="rtp-new-title">New custom type</div>
        <div class="rtp-new-grid">
          <input v-model="draft.label" class="rtp-input" placeholder="Label (e.g. Sworn enemies)" />
          <input v-model="draft.glyph" class="rtp-input rtp-input-glyph" placeholder="◆" />
          <input v-model="draft.color" type="color" class="rtp-color" />
          <label class="rtp-check">
            <input v-model="draft.directed" type="checkbox" />
            Directed
          </label>
          <template v-if="draft.directed">
            <input v-model="draft.role_a" class="rtp-input" placeholder="Role A (e.g. Master)" />
            <input v-model="draft.role_b" class="rtp-input" placeholder="Role B (e.g. Servant)" />
          </template>
          <button class="btn btn-primary btn-sm" :disabled="!draft.label.trim()" @click="create">
            ＋ Add type
          </button>
        </div>
        <div class="rtp-row-gen rtp-new-gen">
          <span class="rtp-w-label" title="How the generations layout treats this type's edges">
            Generations
          </span>
          <div class="rtp-seg">
            <button
              v-for="opt in GEN_ROLES"
              :key="opt.role"
              class="rtp-seg-btn"
              :class="{ 'is-on': draft.symmetryRole === opt.role }"
              :title="opt.hint"
              @click="draft.symmetryRole = opt.role"
            >
              {{ opt.glyph }} {{ opt.label }}
            </button>
          </div>
        </div>
        <div v-if="store.caps.tuneAffinity" class="rtp-row-weight rtp-new-weight">
          <span class="rtp-w-label">Repel</span>
          <input
            v-model.number="draft.weight"
            class="rtp-slider"
            type="range"
            min="-1"
            max="1"
            step="0.05"
          />
          <span class="rtp-w-label">Structural</span>
          <span class="rtp-w-val">{{ draft.weight.toFixed(2) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import { useMainStore } from '../store/index.js'

defineEmits(['close'])
const store = useMainStore()

// The generational role a type plays in the generations layout. Maps 1:1 to
// RelationshipTypeDef.symmetryRole — the field the pure tree math reads.
const GEN_ROLES = [
  {
    role: 'vertical',
    glyph: '↓',
    label: 'Generational',
    hint: 'Parent → child — the child sits one generation below.'
  },
  {
    role: 'horizontal',
    glyph: '⚭',
    label: 'Same generation',
    hint: 'A couple — both partners share a row, side by side.'
  },
  {
    role: 'none',
    glyph: '—',
    label: 'Non-generational',
    hint: 'Ignored by the generations layout (still drawn and pulls in force layouts).'
  }
]

// The legacy trio has color '' (the Style panel drives it) — show the Style
// panel's current color in the swatch; picking a color moves the type onto
// its own swatch.
function swatchOf(def) {
  if (def.color) return def.color
  const gs = store.graphSettings
  if (def.key === 'spouse') return gs.spouseColor
  if (def.key === 'adopted') return gs.adoptedColor
  return gs.parentChildColor
}

function patch(def, fields) {
  store.updateRelType({ id: def.id, ...fields })
}

let weightTimer = null
function patchWeight(def, val) {
  // Sliders fire per pixel — update the local copy live, persist debounced.
  const w = Math.max(-1, Math.min(1, Number(val) || 0))
  def.weight = w
  clearTimeout(weightTimer)
  weightTimer = setTimeout(() => store.updateRelType({ id: def.id, weight: w }), 300)
}

async function removeDef(def) {
  const inUse = store.relationships.filter((r) => r.type === def.key).length
  const msg = inUse
    ? `Delete "${def.label}"? Its ${inUse} relationship${inUse > 1 ? 's' : ''} will be deleted too.`
    : `Delete "${def.label}"?`
  if (!confirm(msg)) return
  await store.deleteRelType(def.id)
}

const draft = reactive({
  label: '',
  glyph: '◆',
  color: '#8a93a6',
  directed: false,
  role_a: '',
  role_b: '',
  weight: 0,
  symmetryRole: 'none'
})

async function create() {
  if (!draft.label.trim()) return
  const res = await store.createRelType({
    label: draft.label,
    glyph: draft.glyph || '◆',
    color: draft.color,
    directed: draft.directed,
    role_a: draft.directed ? draft.role_a : '',
    role_b: draft.directed ? draft.role_b : '',
    weight: draft.weight,
    symmetryRole: draft.symmetryRole
  })
  if (res.success) {
    draft.label = ''
    draft.role_a = ''
    draft.role_b = ''
    draft.weight = 0
    draft.directed = false
    draft.symmetryRole = 'none'
  }
}
</script>

<style scoped>
.rtp-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 120;
}
.rtp {
  width: min(640px, calc(100vw - 40px));
  max-height: calc(100vh - 80px);
  overflow: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 18px 20px;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.4);
}
.rtp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.rtp-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--t1);
}
.rtp-x {
  border: none;
  background: transparent;
  color: var(--t3);
  font-size: 14px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
}
.rtp-x:hover {
  color: var(--t1);
  background: var(--hover);
}
.rtp-hint {
  font-size: 12px;
  color: var(--t2);
  margin-bottom: 14px;
  line-height: 1.5;
}
.rtp-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rtp-row {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 10px;
  background: var(--elevated);
}
.rtp-row-main {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rtp-glyph {
  width: 22px;
  text-align: center;
  font-size: 15px;
  flex-shrink: 0;
}
.rtp-label {
  flex: 1;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--t1);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 7px;
}
.rtp-label:hover {
  border-color: var(--border);
}
.rtp-label:focus {
  border-color: var(--accent);
  background: var(--surface);
}
.rtp-badge {
  font-size: 10px;
  font-weight: 700;
  color: var(--t3);
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 2px 8px;
  border-radius: 12px;
  white-space: nowrap;
}
.rtp-badge-sym {
  opacity: 0.7;
}
.rtp-color {
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
}
.rtp-del {
  border: none;
  background: transparent;
  color: var(--t3);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
}
.rtp-del:hover {
  color: #ef5350;
  background: rgba(239, 83, 80, 0.12);
}
.rtp-builtin {
  color: var(--t3);
  font-size: 8px;
  padding: 0 7px;
  opacity: 0.6;
}
.rtp-row-weight {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding-left: 30px;
}
.rtp-row-gen {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding-left: 30px;
}
.rtp-seg {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--surface);
}
.rtp-seg-btn {
  border: none;
  border-left: 1px solid var(--border);
  background: transparent;
  color: var(--t2);
  font-size: 11px;
  font-weight: 600;
  padding: 5px 10px;
  cursor: pointer;
  white-space: nowrap;
}
.rtp-seg-btn:first-child {
  border-left: none;
}
.rtp-seg-btn:hover {
  background: var(--hover);
  color: var(--t1);
}
.rtp-seg-btn.is-on {
  background: var(--accent);
  color: #fff;
}
.rtp-w-label {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--t3);
  flex-shrink: 0;
}
.rtp-slider {
  flex: 1;
  min-width: 0;
  height: 22px;
  accent-color: var(--accent);
  background: transparent;
  border: none;
  padding: 0;
  box-shadow: none;
}
.rtp-w-val {
  font-size: 11px;
  font-weight: 700;
  color: var(--t2);
  width: 40px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.rtp-new {
  margin-top: 14px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}
.rtp-new-title {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--t3);
  margin-bottom: 8px;
}
.rtp-new-grid {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.rtp-input {
  height: 30px;
  padding: 0 9px;
  font-size: 12.5px;
  border-radius: 8px;
  flex: 1;
  min-width: 130px;
}
.rtp-input-glyph {
  flex: 0 0 44px;
  min-width: 44px;
  text-align: center;
}
.rtp-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--t2);
  white-space: nowrap;
  cursor: pointer;
}
.rtp-new-weight {
  padding-left: 0;
  margin-top: 10px;
}
.rtp-new-gen {
  padding-left: 0;
  margin-top: 10px;
}
</style>
