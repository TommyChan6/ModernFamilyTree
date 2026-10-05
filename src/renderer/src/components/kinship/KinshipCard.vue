<template>
  <!-- "How are they related?" — the headline answer in the chosen naming
       language (both directions), the kinship arch through the common
       ancestor, and the numbers: degree, expected shared DNA, and — for a
       couple who share blood — the Bloodline meter. -->
  <div class="kc" :style="{ '--kc': relColor }">
    <div class="kc-top">
      <span class="kc-eyebrow"><span class="kc-helix">🧬</span> Kinship</span>
      <KinLangPicker />
      <button
        class="kc-swap"
        :class="{ spun: flipped }"
        title="Flip the question"
        @click="flipped = !flipped"
      >
        ⇄
      </button>
    </div>

    <Transition name="kc-morph" mode="out-in">
      <div :key="A + '>' + B + ':' + kinLang" class="kc-headline">
        <template v-if="kin && kin.kind !== 'distant'">
          <div class="kc-sentence">
            <template v-for="(part, i) in sentence(B, A, relName)" :key="i">
              <b v-if="part.who" class="kc-who" :style="{ color: personColor(part.who) }">{{
                personName(part.who)
              }}</b>
              <span v-else-if="part.rel" class="kc-rel">{{ part.rel }}</span>
              <span v-else>{{ part.text }}</span>
            </template>
          </div>
          <div v-if="revName" class="kc-reverse">
            <span class="kc-rev-ic">↺</span>
            <template v-for="(part, i) in sentence(A, B, revName)" :key="i">
              <b v-if="part.who" :style="{ color: personColor(part.who) }">{{
                personName(part.who)
              }}</b>
              <span v-else-if="part.rel" class="kc-rel-soft">{{ part.rel }}</span>
              <span v-else>{{ part.text }}</span>
            </template>
          </div>
        </template>
        <div v-else class="kc-sentence kc-none">
          <b :style="{ color: personColor(B) }">{{ personName(B) }}</b>
          <span> and </span>
          <b :style="{ color: personColor(A) }">{{ personName(A) }}</b>
          <span>
            {{
              kin ? ` aren't family — ${kin.hops} links apart` : ' share no connection at all'
            }}</span
          >
        </div>
      </div>
    </Transition>

    <div v-if="archPoints.length > 1" class="kc-body">
      <KinArch
        :key="A + '>' + B"
        class="kc-arch"
        :points="archPoints"
        :partner="archPartner"
        :width="300"
        @pick="(id) => $emit('pick', id)"
      />
      <div class="kc-facts">
        <div v-if="ancestorsText" class="kc-fact" style="--i: 0">
          <span class="kc-fact-k">{{ viaLabel }}</span>
          <span class="kc-fact-v">{{ ancestorsText }}</span>
        </div>
        <div v-if="degree" class="kc-fact" style="--i: 1">
          <span class="kc-fact-k">Degree</span>
          <span class="kc-fact-v">{{ ordinalNum(degree) }}-degree relative</span>
        </div>
        <div v-if="r > 0" class="kc-fact kc-dna" style="--i: 2">
          <span class="kc-fact-k">Shared DNA</span>
          <span class="kc-fact-v">
            ≈ {{ rPct }} · ~{{ cm.toLocaleString() }} cM
            <span class="kc-dna-bar"
              ><span :style="{ width: Math.min(100, r * 200) + '%' }"></span
            ></span>
          </span>
        </div>
        <div
          v-else-if="kin && kin.kind !== 'blood' && kin.kind !== 'self'"
          class="kc-fact"
          style="--i: 2"
        >
          <span class="kc-fact-k">Shared DNA</span>
          <span class="kc-fact-v kc-dim">none — family by {{ bondWord }}</span>
        </div>
        <div v-if="alsoNames.length" class="kc-fact kc-also" style="--i: 3">
          <span class="kc-fact-k">Also</span>
          <span class="kc-fact-v">
            <span v-for="n in alsoNames" :key="n" class="kc-also-chip">{{ n }}</span>
          </span>
        </div>
        <div v-if="showMeter" class="kc-fact kc-meter" style="--i: 4">
          <span class="kc-fact-k">Bloodline</span>
          <BloodMeter :phi="phi" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useKinship, kinClass, kinPalette } from './useKinship'
import { kinRoute, altAsKin, expectedCM } from './kinshipGraph'
import { civilDegree } from './kinshipNames'
import KinArch from './KinArch.vue'
import BloodMeter from './BloodMeter.vue'
import KinLangPicker from './KinLangPicker.vue'

const props = defineProps({
  a: { type: String, required: true },
  b: { type: String, required: true }
})
defineEmits(['pick'])

const K = useKinship()
const { kinLang, personName, personColor } = K
const flipped = ref(false)
const A = computed(() => (flipped.value ? props.b : props.a))
const B = computed(() => (flipped.value ? props.a : props.b))

const kin = computed(() => K.lensOf(A.value).get(B.value) || null)
const rev = computed(() => K.lensOf(B.value).get(A.value) || null)
const relName = computed(() => K.nameOf(kin.value, A.value, B.value))
const revName = computed(() => (rev.value ? K.nameOf(rev.value, B.value, A.value) : ''))
const relColor = computed(() => {
  const c = kinClass(kin.value)
  return c ? kinPalette()[c] : 'var(--accent)'
})

/** "{who} is {owner}'s {rel}", per language word order. */
function sentence(who, owner, rel) {
  const l = kinLang.value
  if (l === 'no') {
    const on = personName(owner)
    return [
      { who },
      { text: ' er ' },
      { who: owner },
      { text: /[sxz]$/i.test(on) ? ' ' : 's ' },
      { rel }
    ]
  }
  if (l === 'zh-Hans' || l === 'zh-Hant') {
    return [{ who }, { text: '是' }, { who: owner }, { text: '的' }, { rel }]
  }
  const on = personName(owner)
  return [
    { who },
    { text: ' is ' },
    { who: owner },
    { text: /s$/i.test(on) ? "' " : "'s " },
    { rel }
  ]
}

// ── Arch ─────────────────────────────────────────────────────────────────
const archPoints = computed(() => {
  const k = kin.value
  if (!k || k.kind === 'social' || k.kind === 'distant' || k.kind === 'self') return []
  // A couple who are also blood kin: draw the tangled root (their blood arch)
  // rather than the plain marriage line.
  const route = k.kind === 'spouse' && k.also?.length ? k.also[0] : k
  return kinRoute(K.index.value, A.value, B.value, route).map((p) => ({
    ...p,
    name: personName(p.id),
    color: personColor(p.id)
  }))
})
const archPartner = computed(() => {
  const k0 = kin.value
  const k = k0?.kind === 'spouse' && k0.also?.length ? k0.also[0] : k0
  const cas = k?.kind === 'blood' || k?.kind === 'inlaw' || k?.kind === 'affine' ? k.cas : []
  if (!cas || cas.length < 2) return null
  const key = archPoints.value.find((p) => p.keystone)?.id
  const other = cas.find((c) => c !== key)
  return other ? { name: personName(other), color: personColor(other) } : null
})

// ── Facts ────────────────────────────────────────────────────────────────
const viaLabel = computed(() => {
  const k = kin.value
  if (!k) return ''
  if (k.kind === 'blood') return k.cas.length > 1 ? 'Common ancestors' : 'Common ancestor'
  return 'Through'
})
const ancestorsText = computed(() => {
  const k = kin.value
  if (!k) return ''
  if (k.kind === 'blood') {
    if (!k.cas.length) return 'an explicit sibling bond'
    if (k.up === 0 || k.down === 0) return 'a direct line'
    return k.cas.map(personName).join(' & ')
  }
  if (k.via) return personName(k.via)
  return ''
})
const degree = computed(() => civilDegree(kin.value))
const r = computed(() => K.coef.value.relatedness(A.value, B.value))
const rPct = computed(() => {
  const v = r.value * 100
  return (v < 1 ? v.toFixed(2) : v < 20 ? +v.toFixed(1) : v.toFixed(0)) + '%'
})
const cm = computed(() => {
  const k = kin.value
  const full = k?.kind === 'blood' && k.up === 1 && k.down === 1 && !k.half
  return expectedCM(r.value, full)
})
const bondWord = computed(() => {
  const c = kinClass(kin.value)
  return c === 'step' ? 'a stepfamily' : c === 'spouse' ? 'marriage' : 'marriage'
})
const phi = computed(() => K.coef.value.phi(A.value, B.value))
const showMeter = computed(() => kin.value?.kind === 'spouse' && phi.value > 0)

const alsoNames = computed(() => {
  const k = kin.value
  if (!k) return []
  const out = []
  for (const extra of k.also || []) out.push(K.nameOf(extra, A.value, B.value))
  for (const alt of k.alts || []) {
    out.push(K.nameOf(altAsKin(K.index.value, A.value, B.value, alt), A.value, B.value))
  }
  return [...new Set(out)].filter((n) => n !== relName.value).slice(0, 4)
})

function ordinalNum(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
</script>

<style scoped>
.kc {
  --kc: var(--accent);
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.kc-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.kc-eyebrow {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--t3);
  margin-right: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.kc-helix {
  display: inline-block;
  animation: kc-twist 4s ease-in-out infinite;
}
@keyframes kc-twist {
  50% {
    transform: rotate(18deg) scale(1.1);
  }
}
.kc-swap {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t2);
  cursor: pointer;
  font-size: 12px;
  transition:
    transform 0.45s var(--ease-spring),
    color 0.2s ease;
}
.kc-swap:hover {
  color: var(--accent);
}
.kc-swap.spun {
  transform: rotate(180deg);
}
.kc-headline {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.kc-sentence {
  font-size: 15px;
  font-weight: 600;
  color: var(--t2);
  line-height: 1.35;
}
.kc-who {
  font-weight: 750;
}
.kc-rel {
  font-size: 17px;
  font-weight: 800;
  background: linear-gradient(120deg, var(--kc), color-mix(in srgb, var(--kc) 55%, var(--t1)));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 10px color-mix(in srgb, var(--kc) 35%, transparent));
}
.kc-reverse {
  font-size: 11px;
  color: var(--t3);
}
.kc-rev-ic {
  margin-right: 4px;
  color: var(--t3);
}
.kc-rel-soft {
  color: var(--t1);
  font-weight: 650;
}
.kc-none {
  font-size: 13px;
}
.kc-body {
  display: grid;
  grid-template-columns: minmax(200px, 300px) minmax(170px, 1fr);
  gap: 14px;
  align-items: center;
}
@media (max-width: 720px) {
  .kc-body {
    grid-template-columns: 1fr;
  }
}
.kc-facts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.kc-fact {
  display: flex;
  flex-direction: column;
  gap: 1px;
  animation: cp-row-in 0.44s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: calc(0.5s + var(--i) * 0.08s);
}
.kc-fact-k {
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--t3);
}
.kc-fact-v {
  font-size: 12px;
  font-weight: 600;
  color: var(--t1);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.kc-dim {
  color: var(--t3);
  font-weight: 500;
}
.kc-dna-bar {
  flex: 1;
  min-width: 50px;
  height: 5px;
  border-radius: 3px;
  background: var(--elevated);
  overflow: hidden;
}
.kc-dna-bar span {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--kin-blood), var(--kin-spouse), var(--kin-blood));
  background-size: 200% 100%;
  animation:
    kc-grow 1s cubic-bezier(0.22, 1, 0.36, 1) 0.6s backwards,
    kc-shimmer 2.4s linear infinite;
  transform-origin: left;
}
@keyframes kc-grow {
  from {
    transform: scaleX(0);
  }
}
@keyframes kc-shimmer {
  to {
    background-position: -200% 0;
  }
}
.kc-also-chip {
  font-size: 10.5px;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: var(--r-pill);
  color: var(--kin-blood);
  background: color-mix(in srgb, var(--kin-blood) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--kin-blood) 35%, transparent);
}
.kc-morph-enter-active,
.kc-morph-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.28s var(--ease-out),
    filter 0.22s ease;
}
.kc-morph-enter-from {
  opacity: 0;
  transform: translateY(6px);
  filter: blur(4px);
}
.kc-morph-leave-to {
  opacity: 0;
  transform: translateY(-6px);
  filter: blur(4px);
}

/* ── 水墨 ink theme: the relation is written in the kin colour, in Kai ──── */
:root[data-theme='ink'] .kc-rel {
  font-family: var(--font-brush);
  font-size: 22px;
  font-weight: 400;
  background: none;
  color: var(--kc);
  filter: none;
}
:root[data-theme='ink'] .kc-sentence {
  font-size: 15px;
}
:root[data-theme='ink'] .kc-who {
  font-family: var(--font-brush);
  font-weight: 400;
}
:root[data-theme='ink'] .kc-eyebrow {
  font-family: var(--font-ink-label);
  font-variant: small-caps;
  text-transform: lowercase;
  letter-spacing: 0.12em;
}
:root[data-theme='ink'] .kc-fact-v {
  font-family: var(--font-brush);
  font-weight: 400;
}
:root[data-theme='ink'] .kc-dna-bar {
  border-radius: 1px;
}
:root[data-theme='ink'] .kc-also-chip,
:root[data-theme='ink'] .kc-swap {
  border-radius: 3px;
}
</style>
