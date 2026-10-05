<template>
  <div class="cv-view">
    <ViewHeader
      icon="🎭"
      :title="t('rail.character')"
      :count="store.persons.length ? personDocs.length : null"
      :hint="`🧪 ${t('character.experimental')}`"
    />

    <!-- ── Top strip: who, which look, which style ─────────────────────────── -->
    <header class="cv-topstrip">
      <label class="cv-person">
        <span class="cv-person-avatar">
          <img v-if="person?.primary_image" :src="avatarUrl" alt="" />
          <span v-else>{{ (person?.name || '?').charAt(0) }}</span>
        </span>
        <select v-model="personId" class="cv-select" :title="t('character.person')">
          <option v-for="p in store.persons" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </label>
      <input
        v-if="draft"
        class="cv-label-input"
        :value="draft.label"
        :placeholder="t('character.labelPh')"
        @input="liveEdit((d) => (d.label = $event.target.value))"
        @change="endEdit"
      />
      <div v-if="draft" class="cv-styles" role="tablist">
        <button
          v-for="s in STYLE_LIST"
          :key="s.id"
          class="cv-style"
          :class="{
            on:
              !is3D &&
              (draft.style_id === s.id || (!stylePacks[draft.style_id] && s === STYLE_LIST[0]))
          }"
          role="tab"
          :title="styleBlurb(s.id)"
          @click="setStyle(s.id)"
        >
          <img class="cv-style-thumb" :src="styleThumbs[s.id]" alt="" />
          <span class="cv-style-name">{{ styleName(s.id) }}</span>
        </button>
        <button
          class="cv-style cv-style-3d"
          :class="{ on: is3D }"
          role="tab"
          :title="styleBlurb(HUMAN3D_STYLE)"
          @click="setStyle(HUMAN3D_STYLE)"
        >
          <span class="cv-style-thumb cv-3d-thumb">
            <img v-if="draft && thumb3d.get(draft.id)" :src="thumb3d.get(draft.id)" alt="" />
            <span v-else>🧊</span>
          </span>
          <span class="cv-style-name">{{ styleName(HUMAN3D_STYLE) }}</span>
          <span class="cv-3d-badge">3D</span>
        </button>
      </div>
    </header>

    <div class="cv-root" :class="{ 'cv-solo': !draft || show3D }">
      <!-- ── Wardrobe rail: grouped slot categories ─────────────────────────── -->
      <aside v-if="draft && !show3D" class="cv-wardrobe">
        <div v-for="g in GROUPS" :key="g.id" class="cv-group">
          <div class="cv-group-label">{{ t('character.groups.' + g.id) }}</div>
          <button
            v-for="slotId in g.slots"
            :key="slotId"
            class="cv-slot-btn"
            :class="{
              active: selectedSlot === slotId,
              empty: !effectivePart(slotId),
              locked: locks.includes(slotId)
            }"
            :title="t('character.slots.' + slotId)"
            @click="selectSlot(slotId)"
          >
            <span class="cv-slot-icon">{{ slotIcon(slotId) }}</span>
            <span class="cv-slot-name">{{ t('character.slots.' + slotId) }}</span>
            <span v-if="locks.includes(slotId)" class="cv-slot-lock">🔒</span>
          </button>
        </div>
      </aside>

      <!-- ── Stage column ───────────────────────────────────────────────────── -->
      <div class="cv-center">
        <!-- 3D style: the full-screen 3D creator replaces stage + inspector -->
        <div v-if="show3D" class="cv-3d-host">
          <Character3DEditor
            ref="editor3d"
            :key="draft.id"
            :model="draft.model3d"
            :live-edit="live3D"
            :end-edit="endEdit"
            :commit="commit3D"
            :undo="undo"
            :redo="redo"
            :can-undo="undoStack.length > 0"
            :can-redo="redoStack.length > 0"
            :portrait-busy="portraitBusy"
            :portrait-done="portraitDone"
            :parents="parentModels3D"
            :file-base="fileBase()"
            @set-portrait="setAsPortrait()"
            @thumb="onThumb3D"
          />
          <Transition name="cv-toast">
            <div v-if="toast" class="cv-toast">{{ toast }}</div>
          </Transition>
        </div>
        <div v-else class="cv-stage-area">
          <template v-if="!store.persons.length">
            <div class="cv-empty">
              <div class="cv-empty-mark">🎭</div>
              <p>{{ t('character.noPersons') }}</p>
            </div>
          </template>

          <!-- Style chooser: the "new game" screen for a look -->
          <div v-else-if="!draft || chooserOpen" class="cv-chooser">
            <button v-if="draft" class="cv-chooser-close" @click="chooserOpen = false">✕</button>
            <p class="cv-chooser-kicker">{{ person?.name }}</p>
            <h2 class="cv-chooser-title">
              {{
                draft
                  ? t('character.newLookTitle')
                  : t('character.emptyTitle', { name: personName })
              }}
            </h2>
            <p class="cv-chooser-hint">{{ t('character.chooseStyle') }}</p>
            <button class="cv-chooser-3d" @click="createLook(HUMAN3D_STYLE)">
              <span class="cv-chooser-3d-art" aria-hidden="true">🧑‍🎨</span>
              <span class="cv-chooser-3d-text">
                <span class="cv-chooser-3d-kicker">✦ {{ t('character.new3d') }}</span>
                <span class="cv-chooser-name">🧊 {{ styleName(HUMAN3D_STYLE) }}</span>
                <span class="cv-chooser-blurb">{{ styleBlurb(HUMAN3D_STYLE) }}</span>
              </span>
            </button>
            <div class="cv-chooser-grid">
              <button
                v-for="(s, i) in STYLE_LIST"
                :key="s.id"
                class="cv-chooser-card"
                :style="{ '--i': i }"
                @click="createLook(s.id)"
              >
                <img class="cv-chooser-img" :src="chooserThumbs[s.id]" alt="" />
                <span class="cv-chooser-name">{{ s.icon }} {{ styleName(s.id) }}</span>
                <span class="cv-chooser-blurb">{{ styleBlurb(s.id) }}</span>
              </button>
            </div>
            <div class="cv-chooser-extras">
              <label class="cv-check">
                <input v-model="startRandom" type="checkbox" />
                🎲 {{ t('character.startRandom') }}
              </label>
              <label v-if="parentLooks.length" class="cv-check">
                <input v-model="startInherit" type="checkbox" />
                🧬 {{ t('character.startInherit') }}
              </label>
            </div>
          </div>

          <template v-else>
            <CharacterStage
              ref="stageRef"
              :doc="displayDoc"
              :pack="pack"
              :selected-slot="selectedSlot"
              :focus="cameraFocus"
              :backdrop="draft.backdrop || 'studio'"
              :fx="fx"
              :emote="emote"
              @select-slot="selectSlot"
            />

            <!-- Camera presets -->
            <div class="cv-cams">
              <button
                v-for="c in CAMERAS"
                :key="c.id"
                class="cv-chip"
                :class="{ on: cameraMode === c.id }"
                :title="t('character.cams.' + c.id)"
                @click="cameraMode = c.id"
              >
                {{ c.icon }} <span>{{ t('character.cams.' + c.id) }}</span>
              </button>
            </div>

            <!-- Backdrops + FX -->
            <div class="cv-backdrops">
              <button
                v-for="b in BACKDROPS"
                :key="b.id"
                class="cv-bd"
                :class="{ on: (draft.backdrop || 'studio') === b.id }"
                :title="t('character.backdrops.' + b.id)"
                @click="setBackdrop(b.id)"
              >
                {{ b.icon }}
              </button>
              <div class="cv-bd-sep"></div>
              <button
                class="cv-bd"
                :class="{ on: fx }"
                :title="t('character.fxToggle')"
                @click="toggleFx"
              >
                ✨
              </button>
            </div>

            <!-- Emote dock: resting expression (hover to preview) -->
            <div class="cv-emotes">
              <button
                v-for="e in EXPRESSIONS"
                :key="e.id"
                class="cv-emote"
                :class="{ on: (draft.expression || 'neutral') === e.id }"
                :title="t('character.expr.' + e.id)"
                @click="setExpression(e.id)"
                @pointerenter="emote = e.id"
                @pointerleave="emote = null"
              >
                {{ e.icon }}
              </button>
            </div>

            <!-- Tool pill -->
            <div class="cv-pill">
              <button
                class="cv-pill-btn cv-dice"
                :title="t('character.randomize') + ' (R)'"
                @click="shuffle"
              >
                🎲
              </button>
              <button class="cv-pill-btn" :title="t('character.mirror') + ' (M)'" @click="mirror">
                ⇄
              </button>
              <div class="cv-pill-sep"></div>
              <button
                class="cv-pill-btn"
                :disabled="!undoStack.length"
                :title="t('character.undo') + ' (Ctrl+Z)'"
                @click="undo"
              >
                ↩
              </button>
              <button
                class="cv-pill-btn"
                :disabled="!redoStack.length"
                :title="t('character.redo') + ' (Ctrl+X)'"
                @click="redo"
              >
                ↪
              </button>
              <div class="cv-pill-sep"></div>
              <button
                class="cv-pill-btn"
                :title="t('character.zoomIn')"
                @click="stageRef?.zoomBy(1.2)"
              >
                ⊕
              </button>
              <button
                class="cv-pill-btn"
                :title="t('character.zoomOut')"
                @click="stageRef?.zoomBy(1 / 1.2)"
              >
                ⊖
              </button>
              <div class="cv-pill-sep"></div>
              <button
                class="cv-pill-btn"
                :title="t('character.photo.open') + ' (P)'"
                @click="photoOpen = true"
              >
                📸
              </button>
              <button
                class="cv-pill-btn cv-pill-primary"
                :disabled="portraitBusy"
                @click="setAsPortrait()"
              >
                {{ portraitDone ? '✓ ' : '🖼 ' }}{{ t('character.setPortrait') }}
              </button>
            </div>
          </template>

          <Transition name="cv-toast">
            <div v-if="toast" class="cv-toast">{{ toast }}</div>
          </Transition>

          <Teleport to="body">
            <PhotoStudio
              v-if="photoOpen && draft"
              :doc="draft"
              :pack="pack"
              :person="person"
              :style-label="`${pack.icon} ${styleName(pack.id)}`"
              :stars="rarity"
              :busy="portraitBusy"
              @close="photoOpen = false"
              @set-framed="setAsPortrait"
            />
          </Teleport>
        </div>

        <!-- Looks filmstrip -->
        <div v-if="personId && store.persons.length" class="cv-filmstrip">
          <TransitionGroup name="cv-look">
            <button
              v-for="doc in personDocs"
              :key="doc.id"
              class="cv-look"
              :class="{ active: doc.id === activeDocId }"
              @click="activeDocId = doc.id"
            >
              <img class="cv-look-thumb" :src="thumbOf(doc)" alt="" />
              <span class="cv-look-name">{{ doc.label }}</span>
              <span
                v-if="doc.is_portrait"
                class="cv-look-star"
                :title="t('character.portraitBadge')"
                >★</span
              >
              <span class="cv-look-style">{{ packOf(doc.style_id).icon }}</span>
              <span v-if="ageLabel(doc)" class="cv-look-age">{{ ageLabel(doc) }}</span>
            </button>
          </TransitionGroup>
          <button
            class="cv-look cv-look-add"
            :title="t('character.addLook')"
            @click="chooserOpen = true"
          >
            ＋
          </button>
        </div>
      </div>

      <!-- ── Inspector ──────────────────────────────────────────────────────── -->
      <aside v-if="draft && !show3D" class="cv-inspector">
        <nav class="cv-tabs">
          <button
            v-for="tab in TABS"
            :key="tab.id"
            class="cv-tab"
            :class="{ on: inspectorTab === tab.id }"
            @click="inspectorTab = tab.id"
          >
            <span>{{ tab.icon }}</span>
            {{ t('character.tabs.' + tab.id) }}
          </button>
        </nav>

        <div class="cv-tab-body">
          <Transition name="cv-pane" mode="out-in">
            <!-- Parts -->
            <div v-if="inspectorTab === 'parts'" key="parts" class="cv-pane">
              <section class="cv-section">
                <div class="cv-section-head">
                  <h4 class="cv-section-title">
                    {{ slotDef?.icon }} {{ t('character.slots.' + selectedSlot) }}
                  </h4>
                  <button
                    class="cv-mini"
                    :class="{ on: currentSlotState.flip }"
                    :title="t('character.flipPart')"
                    @click="flipSlot"
                  >
                    ⇄
                  </button>
                  <button
                    class="cv-mini"
                    :class="{ on: locks.includes(selectedSlot) }"
                    :title="t('character.lockHint')"
                    @click="toggleLock(selectedSlot)"
                  >
                    {{ locks.includes(selectedSlot) ? '🔒' : '🔓' }}
                  </button>
                </div>
                <PartGrid
                  :doc="draft"
                  :pack="pack"
                  :slot-id="selectedSlot"
                  @pick="pickPart"
                  @hover="onPartHover"
                />
                <label class="cv-slider-row">
                  <span>{{ t('character.size') }}</span>
                  <input
                    type="range"
                    min="0.7"
                    max="1.4"
                    step="0.02"
                    :value="currentSlotState.scale"
                    @input="liveEdit((d) => setSlotScale(d, Number($event.target.value)))"
                    @change="endEdit"
                    @dblclick="commit((d) => setSlotScale(d, 1))"
                  />
                </label>
              </section>
              <section v-for="ch in slotChannels" :key="ch" class="cv-section">
                <h4 class="cv-section-title cv-sub">🎨 {{ t('character.palette.' + ch) }}</h4>
                <SwatchRow
                  :model-value="draft.palette[ch]"
                  :colors="swatchesFor(pack, ch)"
                  @pick="(c) => commit((d) => (d.palette[ch] = c))"
                  @live="(c) => liveEdit((d) => (d.palette[ch] = c))"
                  @done="endEdit"
                />
              </section>
            </div>

            <!-- Colors -->
            <div v-else-if="inspectorTab === 'colors'" key="colors" class="cv-pane">
              <section class="cv-section">
                <div class="cv-section-head">
                  <h4 class="cv-section-title">✨ {{ t('character.presets') }}</h4>
                  <button
                    class="cv-mini"
                    :class="{ on: locks.includes('palette') }"
                    :title="t('character.lockHint')"
                    @click="toggleLock('palette')"
                  >
                    {{ locks.includes('palette') ? '🔒' : '🔓' }}
                  </button>
                </div>
                <div class="cv-presets">
                  <button
                    v-for="(p, i) in pack.palettePresets"
                    :key="i"
                    class="cv-preset"
                    :title="t('character.applyPreset')"
                    @click="applyPreset(p)"
                  >
                    <span
                      v-for="ch in ['skin', 'hair', 'outfitA', 'accent']"
                      :key="ch"
                      :style="{ background: p[ch] }"
                    ></span>
                  </button>
                </div>
              </section>
              <section v-for="ch in pack.paletteChannels" :key="ch" class="cv-section">
                <h4 class="cv-section-title cv-sub">{{ t('character.palette.' + ch) }}</h4>
                <SwatchRow
                  :model-value="draft.palette[ch]"
                  :colors="swatchesFor(pack, ch)"
                  @pick="(c) => commit((d) => (d.palette[ch] = c))"
                  @live="(c) => liveEdit((d) => (d.palette[ch] = c))"
                  @done="endEdit"
                />
              </section>
              <section class="cv-section">
                <h4 class="cv-section-title">🌈 {{ t('character.harmony') }}</h4>
                <p class="cv-hint">{{ t('character.harmonyHint') }}</p>
                <div class="cv-btn-row">
                  <button
                    v-for="m in HARMONY_MODES"
                    :key="m"
                    class="cv-soft-btn"
                    @click="applyHarmony(m)"
                  >
                    {{ t('character.harmonies.' + m) }}
                  </button>
                </div>
              </section>
              <section v-if="personTags.length" class="cv-section">
                <h4 class="cv-section-title">🏷 {{ t('character.groupColors') }}</h4>
                <p class="cv-hint">{{ t('character.groupColorsHint') }}</p>
                <div class="cv-btn-row">
                  <button
                    v-for="tag in personTags"
                    :key="tag.id"
                    class="cv-soft-btn cv-tag-btn"
                    :style="{ '--c': tag.color }"
                    @click="wearTag(tag)"
                  >
                    <span class="cv-tag-dot"></span>{{ tag.name }}
                  </button>
                </div>
              </section>
            </div>

            <!-- Body -->
            <div v-else-if="inspectorTab === 'body'" key="body" class="cv-pane">
              <section class="cv-section">
                <div class="cv-section-head">
                  <h4 class="cv-section-title">⏳ {{ t('character.age') }}</h4>
                  <span class="cv-age-badge">{{ ageStage }}</span>
                </div>
                <input
                  class="cv-age-slider"
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  :value="draft.morph.age || 0"
                  @input="
                    liveEdit((d) => (d.morph = { ...d.morph, age: Number($event.target.value) }))
                  "
                  @change="endEdit"
                />
                <div class="cv-age-ticks">
                  <span>{{ t('character.ageStages.child') }}</span>
                  <span>{{ t('character.ageStages.adult') }}</span>
                  <span>{{ t('character.ageStages.elder') }}</span>
                </div>
              </section>
              <section class="cv-section">
                <div class="cv-section-head">
                  <h4 class="cv-section-title">🧍 {{ t('character.body') }}</h4>
                  <button
                    class="cv-mini"
                    :class="{ on: locks.includes('morph') }"
                    :title="t('character.lockHint')"
                    @click="toggleLock('morph')"
                  >
                    {{ locks.includes('morph') ? '🔒' : '🔓' }}
                  </button>
                </div>
                <label v-for="m in ['height', 'build', 'headSize']" :key="m" class="cv-slider-row">
                  <span>{{ t('character.' + m) }}</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.05"
                    :value="draft.morph[m] || 0"
                    @input="
                      liveEdit((d) => (d.morph = { ...d.morph, [m]: Number($event.target.value) }))
                    "
                    @change="endEdit"
                    @dblclick="commit((d) => (d.morph = { ...d.morph, [m]: 0 }))"
                  />
                </label>
                <p class="cv-hint">{{ t('character.resetHint') }}</p>
              </section>
              <section class="cv-section">
                <h4 class="cv-section-title">📅 {{ t('character.ages') }}</h4>
                <p class="cv-hint">{{ t('character.ageHint') }}</p>
                <div class="cv-ages">
                  <input
                    type="number"
                    min="0"
                    class="cv-age-input"
                    :placeholder="t('character.ageFrom')"
                    :value="draft.age_from ?? ''"
                    @input="liveEdit((d) => (d.age_from = toAge($event.target.value)))"
                    @change="endEdit"
                  />
                  <span class="cv-age-dash">–</span>
                  <input
                    type="number"
                    min="0"
                    class="cv-age-input"
                    :placeholder="t('character.ageTo')"
                    :value="draft.age_to ?? ''"
                    @input="liveEdit((d) => (d.age_to = toAge($event.target.value)))"
                    @change="endEdit"
                  />
                </div>
              </section>
            </div>

            <!-- Genes & sharing -->
            <div v-else key="genes" class="cv-pane">
              <section class="cv-section cv-gene-card">
                <h4 class="cv-section-title">🧬 {{ t('character.inherit') }}</h4>
                <template v-if="parentLooks.length">
                  <div class="cv-parents">
                    <div v-for="pl in parentLooks" :key="pl.person.id" class="cv-parent">
                      <img :src="thumbOf(pl.doc)" alt="" />
                      <span>{{ pl.person.name }}</span>
                    </div>
                  </div>
                  <label class="cv-slider-row">
                    <span>{{ t('character.resemblance') }}</span>
                    <input v-model.number="resemblance" type="range" min="0" max="1" step="0.05" />
                  </label>
                  <button class="btn btn-primary btn-sm cv-wide" @click="inheritFromParents">
                    🧬 {{ t('character.rollChild') }}
                  </button>
                </template>
                <p v-else class="cv-hint">
                  {{ parentIds.length ? t('character.parentsNoLooks') : t('character.noParents') }}
                </p>
              </section>
              <section class="cv-section">
                <h4 class="cv-section-title">🌍 {{ t('character.genePool') }}</h4>
                <p class="cv-hint">{{ t('character.genePoolHint') }}</p>
                <button
                  class="cv-soft-btn cv-wide"
                  :disabled="worldDocs.length < 2"
                  @click="genePool"
                >
                  🎲 {{ t('character.rollGenePool') }}
                </button>
              </section>
              <section class="cv-section">
                <h4 class="cv-section-title">🔗 {{ t('character.dna') }}</h4>
                <p class="cv-hint">{{ t('character.dnaHint') }}</p>
                <button class="cv-soft-btn cv-wide" @click="copyDNA">
                  📋 {{ t('character.copyDna') }}
                </button>
                <div class="cv-dna-row">
                  <input
                    v-model="dnaInput"
                    class="cv-dna-input"
                    :placeholder="t('character.pasteDna')"
                  />
                  <button class="cv-soft-btn" :disabled="!dnaInput.trim()" @click="applyDNA">
                    {{ t('character.apply') }}
                  </button>
                </div>
              </section>
              <section class="cv-section">
                <h4 class="cv-section-title">⬇ {{ t('character.export') }}</h4>
                <div class="cv-btn-row">
                  <button class="cv-soft-btn" @click="exportPNG">PNG</button>
                  <button class="cv-soft-btn" @click="exportSVG">SVG</button>
                </div>
              </section>
              <button class="btn btn-danger btn-sm cv-delete" @click="deleteLook">
                {{ t('character.deleteLook') }}
              </button>
            </div>
          </Transition>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useMainStore } from '../../store/index.js'
import { useI18n } from '../../i18n'
import { api } from '../../api'
import CharacterStage from './CharacterStage.vue'
import PartGrid from './PartGrid.vue'
import SwatchRow from './SwatchRow.vue'
import PhotoStudio from './PhotoStudio.vue'
import ViewHeader from '../ViewHeader.vue'
import { STYLE_LIST, stylePacks, packOf, DEFAULT_STYLE } from './styles'
import {
  EXPRESSIONS,
  HARMONY_MODES,
  defaultParts,
  defaultPalette,
  effectivePartId,
  focusRegion,
  harmonize,
  randomizeDoc,
  remapDoc,
  shadeColor,
  slotOf,
  slotState,
  swatchesFor
} from './characterModel'
import { inheritDoc, encodeDNA, decodeDNA } from './characterGenes'
import { rasterize, renderToCanvas, portraitRegion } from './render/SpriteCompositor2D'
import { docToSvg } from './render/svgExport'
import { BACKDROPS, paintBackdrop } from './render/backdrops'
import { confirmDialog, toast as appToast } from '../../lib/dialogs.js'
import Character3DEditor from './human3d/Character3DEditor.vue'
import { HUMAN3D_STYLE, sanitizeModel3D } from '../../../../shared/character3d'
import {
  inheritModel3D,
  model3dForPerson,
  model3dFrom2D,
  paletteFrom3D,
  randomizeModel3D
} from './human3d/model3d'

// The experimental Character view (Advanced + 🧪 Labs): a game-style
// character creator. A person owns any number of looks (docs), each in one
// art style (styles/); edits autosave (debounced) through characters:save;
// "Set as portrait" explicitly rasterizes the figure into the regular images
// pipeline so every view's avatar picks it up. Pure logic lives in
// characterModel / characterGenes; drawing in render/. See
// docs/CHARACTER_VIEW_PROPOSAL.md.

const store = useMainStore()
const { t } = useI18n()

const GROUPS = [
  { id: 'face', slots: ['head', 'eyes', 'brows', 'nose', 'mouth', 'marks'] },
  { id: 'hair', slots: ['hair', 'facialHair'] },
  { id: 'outfit', slots: ['torso', 'legs', 'feet'] },
  { id: 'extras', slots: ['headwear', 'accessory', 'back'] }
]
const TABS = [
  { id: 'parts', icon: '🧩' },
  { id: 'colors', icon: '🎨' },
  { id: 'body', icon: '🧍' },
  { id: 'genes', icon: '🧬' }
]
const CAMERAS = [
  { id: 'auto', icon: '🎯' },
  { id: 'full', icon: '🧍' },
  { id: 'portrait', icon: '🖼' },
  { id: 'face', icon: '🙂' }
]
// Which palette channels a slot is painted with (the Parts tab's quick colors)
const SLOT_CHANNELS = {
  head: ['skin'],
  eyes: ['eyes'],
  brows: ['hair'],
  nose: ['skin'],
  mouth: ['skin'],
  marks: ['accent'],
  hair: ['hair'],
  facialHair: ['hair'],
  torso: ['outfitA', 'accent'],
  legs: ['outfitB'],
  feet: ['accent'],
  headwear: ['accent'],
  accessory: ['accent'],
  back: ['accent', 'outfitA']
}

const stageRef = ref(null)
const selectedSlot = ref('hair')
const inspectorTab = ref('parts')
const cameraMode = ref('auto')
const emote = ref(null)
const chooserOpen = ref(false)
const photoOpen = ref(false)
const startRandom = ref(false)
const startInherit = ref(false)
const resemblance = ref(0.8)
const dnaInput = ref('')
const locks = ref([])
const toast = ref('')
let toastTimer = 0

function readPref(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v
  } catch {
    return fallback
  }
}
function writePref(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* private mode — the preference just doesn't stick */
  }
}
const fx = ref(readPref('ft.character.fx', '1') !== '0')
function toggleFx() {
  fx.value = !fx.value
  writePref('ft.character.fx', fx.value ? '1' : '0')
}

function flashToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2200)
}

// Draft + edit-gesture state — declared before the immediate watchers below,
// which flush/clear it as they pick the initial person and look.
const draft = ref(null) // local working copy of the active doc (autosaved)
const undoStack = ref([])
const redoStack = ref([])
let pendingSnapshot = null
let saveTimer = 0

// ── Person / look selection ───────────────────────────────────────────────────
const personId = ref(store.selectedPersonId || store.persons[0]?.id || null)
const person = computed(() => store.persons.find((p) => p.id === personId.value) || null)
const personName = computed(() => person.value?.name || '')
const personDocs = computed(() => store.characters.filter((c) => c.person_id === personId.value))
const activeDocId = ref(null)
const avatarUrl = computed(() => {
  const p = person.value?.primary_image
  return p ? api.getImageUrl(p) || '' : ''
})

watch(
  personId,
  () => {
    flushSave()
    const docs = personDocs.value
    activeDocId.value = (docs.find((d) => d.is_portrait) || docs[0])?.id ?? null
    undoStack.value = []
    redoStack.value = []
    chooserOpen.value = false
  },
  { immediate: true }
)

// Keep a valid person selected as data loads / changes
watch(
  () => store.persons,
  (list) => {
    if (!list.some((p) => p.id === personId.value)) personId.value = list[0]?.id ?? null
  },
  { deep: false }
)

// Docs can land after mount (async load) or disappear (delete elsewhere) —
// keep the active look pointing at something real.
watch(personDocs, (docs) => {
  if (!activeDocId.value && docs.length) {
    activeDocId.value = (docs.find((d) => d.is_portrait) || docs[0]).id
  } else if (activeDocId.value && !docs.some((d) => d.id === activeDocId.value)) {
    activeDocId.value = docs[0]?.id ?? null
  }
})

// ── The working draft follows the active look ────────────────────────────────
watch(
  activeDocId,
  (id, old) => {
    if (id !== old) flushSave()
    const doc = store.characters.find((c) => c.id === id)
    draft.value = doc ? normalize(JSON.parse(JSON.stringify(doc))) : null
    chooserOpen.value = false
  },
  { immediate: true }
)

/** Fill fields older docs predate. */
function normalize(d) {
  if (d.style_id === HUMAN3D_STYLE) {
    d.model3d = d.model3d
      ? sanitizeModel3D(d.model3d)
      : model3dFrom2D(d, model3dForPerson(person.value, refYearFor(person.value), seed3D()))
  }
  d.morph = { height: 0, build: 0, headSize: 0, age: 0, ...(d.morph || {}) }
  d.expression = d.expression || 'neutral'
  d.backdrop = d.backdrop || 'studio'
  return d
}

const pack = computed(() => packOf(draft.value?.style_id))
const is3D = computed(() => draft.value?.style_id === HUMAN3D_STYLE)
const show3D = computed(() => is3D.value && !chooserOpen.value && store.persons.length > 0)
const editor3d = ref(null)
/** Latest rendered thumbnails of 3D looks (doc id → data URL), session-only. */
const thumb3d = ref(new Map())
function onThumb3D(url) {
  if (!draft.value || !url) return
  const next = new Map(thumb3d.value)
  next.set(draft.value.id, url)
  thumb3d.value = next
}
/** Edits from the 3D editor target draft.model3d. */
function live3D(fn) {
  liveEdit((d) => fn(d.model3d))
}
function commit3D(fn) {
  commit((d) => fn(d.model3d))
}

/** The current year (or a person's death year) for age seeding. */
function refYearFor(p) {
  const now = new Date().getFullYear()
  return p?.death?.year ?? now
}
function seed3D() {
  return [...(personId.value || 'x')].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0
}
const slotDef = computed(() => slotOf(pack.value, selectedSlot.value))
const currentSlotState = computed(() =>
  draft.value ? slotState(draft.value, pack.value, selectedSlot.value) : { partId: null, scale: 1 }
)
const slotChannels = computed(() => SLOT_CHANNELS[selectedSlot.value] || [])

function slotIcon(id) {
  return slotOf(pack.value, id)?.icon || '•'
}
function effectivePart(slotId) {
  return draft.value ? effectivePartId(draft.value, pack.value, slotId, 'neutral') : null
}

function styleName(id) {
  const key = 'character.styleNames.' + id
  const s = t(key)
  if (s !== key) return s
  return id === HUMAN3D_STYLE ? '3D' : packOf(id).name
}
function styleBlurb(id) {
  const key = 'character.styleBlurbs.' + id
  const s = t(key)
  return s === key ? '' : s
}

// ── What the stage shows: shuffle frames > hover try-on > the draft ─────────
const shuffleDoc = ref(null)
const hoverPart = ref(undefined) // undefined = no try-on; null = trying "none"
const displayDoc = computed(() => {
  if (shuffleDoc.value) return shuffleDoc.value
  const d = draft.value
  if (hoverPart.value === undefined || !d) return d
  const slot = selectedSlot.value
  return {
    ...d,
    parts: { ...d.parts, [slot]: { ...slotState(d, pack.value, slot), partId: hoverPart.value } }
  }
})

function onPartHover(partId, entering) {
  hoverPart.value = entering ? partId : undefined
  if (entering) stageRef.value?.pop(selectedSlot.value, { sparkle: false })
}

const cameraFocus = computed(() => {
  const p = pack.value
  switch (cameraMode.value) {
    case 'full':
      return null
    case 'portrait':
      return p.portrait
    case 'face':
      return p.face
    default:
      return selectedSlot.value === 'back' ? null : focusRegion(p, selectedSlot.value)
  }
})

function selectSlot(id) {
  selectedSlot.value = id
  inspectorTab.value = 'parts'
  hoverPart.value = undefined
}

// ── Edits: live mutation + debounced autosave + undo/redo ────────────────────
// liveEdit() mutates the draft (capturing ONE undo snapshot for the whole
// gesture — a slider drag is a single undo step); endEdit() seals the gesture.
function snapshot() {
  const d = draft.value
  return JSON.stringify({
    parts: d.parts,
    palette: d.palette,
    morph: d.morph,
    label: d.label,
    age_from: d.age_from,
    age_to: d.age_to,
    style_id: d.style_id,
    expression: d.expression,
    backdrop: d.backdrop,
    model3d: d.model3d || null
  })
}

function liveEdit(mutate) {
  if (!draft.value) return
  if (!pendingSnapshot) pendingSnapshot = snapshot()
  mutate(draft.value)
  scheduleSave()
}

function endEdit() {
  if (!pendingSnapshot) return
  if (pendingSnapshot !== snapshot()) {
    undoStack.value.push(pendingSnapshot)
    if (undoStack.value.length > 80) undoStack.value.shift()
    redoStack.value = []
  }
  pendingSnapshot = null
}

/** A discrete edit = one whole gesture. */
function commit(mutate) {
  liveEdit(mutate)
  endEdit()
}

function applySnapshot(json) {
  const prevStyle = draft.value.style_id
  const snap = JSON.parse(json)
  if (!snap.model3d) delete snap.model3d
  Object.assign(draft.value, snap)
  if (prevStyle !== draft.value.style_id) stageRef.value?.beginTransition()
  stageRef.value?.popAll()
  scheduleSave()
}

function undo() {
  if (!undoStack.value.length) return
  redoStack.value.push(snapshot())
  applySnapshot(undoStack.value.pop())
}

function redo() {
  if (!redoStack.value.length) return
  undoStack.value.push(snapshot())
  applySnapshot(redoStack.value.pop())
}

function scheduleSave() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(flushSave, 600)
}

function flushSave() {
  clearTimeout(saveTimer)
  saveTimer = 0
  const d = draft.value
  if (!d?.id) return
  // Plain-JSON clone: keep Vue proxies out of the IPC structured clone
  store.saveCharacter(
    JSON.parse(
      JSON.stringify({
        id: d.id,
        label: d.label,
        style_id: d.style_id,
        age_from: d.age_from,
        age_to: d.age_to,
        parts: d.parts,
        palette: d.palette,
        morph: d.morph,
        expression: d.expression,
        backdrop: d.backdrop,
        ...(d.model3d ? { model3d: d.model3d } : {})
      })
    )
  )
}

// ── Look management ───────────────────────────────────────────────────────────
async function createLook(styleId) {
  if (!personId.value) return
  if (styleId === HUMAN3D_STYLE) return createLook3D()
  const p = packOf(styleId)
  let look = {
    parts: defaultParts(p),
    palette: defaultPalette(p),
    morph: { height: 0, build: 0, headSize: 0, age: 0 }
  }
  if (startRandom.value) look = randomizeDoc(p)
  if (startInherit.value && parentLooks.value.length) {
    look = inheritDoc(
      p,
      parentLooks.value.map((pl) => pl.doc),
      look,
      { resemblance: resemblance.value }
    )
  }
  const res = await store.saveCharacter(
    JSON.parse(
      JSON.stringify({
        person_id: personId.value,
        style_id: p.id,
        label: t('character.lookName', { n: personDocs.value.length + 1 }),
        ...look,
        expression: 'neutral',
        backdrop: p.id === 'simple' ? 'paper' : p.id === 'anime' ? 'sakura' : 'studio'
      })
    )
  )
  if (res.success) {
    activeDocId.value = res.data.id
    chooserOpen.value = false
    requestAnimationFrame(() => stageRef.value?.popAll({ sparkle: true }))
  }
}

async function createLook3D() {
  let m = model3dForPerson(person.value, refYearFor(person.value), seed3D())
  if (startRandom.value) m = randomizeModel3D(m, Math.random, ['body'])
  if (startInherit.value && parentModels3D.value.length) {
    m = inheritModel3D(
      parentModels3D.value.map((x) => x.model),
      m,
      { resemblance: resemblance.value }
    )
  }
  const p0 = packOf(DEFAULT_STYLE)
  const res = await store.saveCharacter(
    JSON.parse(
      JSON.stringify({
        person_id: personId.value,
        style_id: HUMAN3D_STYLE,
        label: t('character.lookName', { n: personDocs.value.length + 1 }),
        parts: defaultParts(p0),
        palette: { ...defaultPalette(p0), ...paletteFrom3D(m) },
        morph: { height: 0, build: 0, headSize: 0, age: 0 },
        expression: 'neutral',
        backdrop: 'studio',
        model3d: m
      })
    )
  )
  if (res.success) {
    activeDocId.value = res.data.id
    chooserOpen.value = false
  }
}

async function deleteLook() {
  if (!draft.value) return
  const ok = await confirmDialog({
    title: t('character.confirmDelete', { name: draft.value.label }),
    confirmLabel: t('confirm.deleteLook'),
    tone: 'danger'
  })
  if (!ok || !draft.value) return
  const id = draft.value.id
  clearTimeout(saveTimer)
  saveTimer = 0
  draft.value = null
  await store.deleteCharacter(id)
  activeDocId.value = personDocs.value[0]?.id ?? null
}

// ── Style switching (non-destructive within the session) ────────────────────
// Each look remembers the exact parts it had in every style you've tried it
// in, so hopping Anime → Realistic → Anime brings the original back.
const styleMemory = new Map() // docId → { styleId → parts }

function setStyle(styleId) {
  const d = draft.value
  if (!d || d.style_id === styleId) return
  if (styleId === HUMAN3D_STYLE) {
    // into 3D: keep the 2D parts (switching back restores them)
    commit((doc) => {
      doc.style_id = HUMAN3D_STYLE
      if (!doc.model3d) {
        doc.model3d = model3dFrom2D(
          doc,
          model3dForPerson(person.value, refYearFor(person.value), seed3D())
        )
      }
    })
    return
  }
  if (d.style_id === HUMAN3D_STYLE) {
    // out of 3D: the 2D look takes the 3D colours
    const to = packOf(styleId)
    commit((doc) => {
      const m = doc.model3d
      doc.style_id = styleId
      const remapped = remapDoc(
        { parts: doc.parts, palette: { ...doc.palette, ...(m ? paletteFrom3D(m) : {}) } },
        to
      )
      doc.parts = remapped.parts
      doc.palette = remapped.palette
    })
    requestAnimationFrame(() => stageRef.value?.popAll({ sparkle: true }))
    return
  }
  const mem = styleMemory.get(d.id) || {}
  mem[d.style_id] = JSON.parse(JSON.stringify(d.parts))
  styleMemory.set(d.id, mem)
  const to = packOf(styleId)
  const remapped = remapDoc(d, to)
  stageRef.value?.beginTransition()
  commit((doc) => {
    doc.style_id = styleId
    doc.parts = mem[styleId] ? JSON.parse(JSON.stringify(mem[styleId])) : remapped.parts
    doc.palette = remapped.palette
  })
  requestAnimationFrame(() => stageRef.value?.popAll({ sparkle: true }))
}

// ── Tools ─────────────────────────────────────────────────────────────────────
function pickPart(partId) {
  hoverPart.value = undefined
  commit((d) => {
    const prev = slotState(d, pack.value, selectedSlot.value)
    d.parts[selectedSlot.value] = { ...prev, partId }
  })
  stageRef.value?.pop(selectedSlot.value)
}

function setSlotScale(d, scale) {
  const prev = slotState(d, pack.value, selectedSlot.value)
  d.parts[selectedSlot.value] = { ...prev, scale }
}

function flipSlot() {
  commit((d) => {
    const prev = slotState(d, pack.value, selectedSlot.value)
    d.parts[selectedSlot.value] = { ...prev, flip: !prev.flip }
  })
  stageRef.value?.pop(selectedSlot.value, { sparkle: false })
}

function toggleLock(id) {
  const i = locks.value.indexOf(id)
  if (i === -1) locks.value.push(id)
  else locks.value.splice(i, 1)
}

// Slot-machine shuffle: a few rapid random frames, then it lands
let shuffling = 0
function shuffle() {
  if (!draft.value || shuffling) return
  const opts = { locks: [...locks.value], base: draft.value }
  let n = 0
  const frames = fx.value ? 7 : 0
  const step = () => {
    if (n++ < frames) {
      shuffleDoc.value = { ...draft.value, ...randomizeDoc(pack.value, Math.random, opts) }
      stageRef.value?.popAll()
      shuffling = setTimeout(step, 55 + n * 12)
      return
    }
    shuffleDoc.value = null
    shuffling = 0
    const next = randomizeDoc(pack.value, Math.random, opts)
    commit((d) => Object.assign(d, next))
    stageRef.value?.popAll({ sparkle: true })
  }
  step()
}

function mirror() {
  commit((d) => {
    for (const s of pack.value.slots) {
      const prev = slotState(d, pack.value, s.id)
      d.parts[s.id] = { ...prev, flip: !prev.flip }
    }
  })
  stageRef.value?.beginTransition()
}

function setExpression(id) {
  emote.value = null
  commit((d) => (d.expression = id))
  stageRef.value?.pop('mouth', { sparkle: false })
  stageRef.value?.pop('eyes', { sparkle: false })
  stageRef.value?.pop('brows', { sparkle: false })
}

function setBackdrop(id) {
  commit((d) => (d.backdrop = id))
}

function applyPreset(p) {
  commit((d) => (d.palette = { ...p }))
  stageRef.value?.popAll()
}

function applyHarmony(mode) {
  commit((d) => (d.palette = harmonize(d.palette, mode)))
  for (const s of ['torso', 'legs', 'feet']) stageRef.value?.pop(s, { sparkle: s === 'torso' })
}

const personTags = computed(() =>
  (store.tagsOf?.get?.(personId.value) || []).filter((tg) => tg.color)
)
function wearTag(tag) {
  commit((d) => {
    d.palette = { ...d.palette, outfitA: tag.color, accent: shadeColor(tag.color, 0.35) }
  })
  stageRef.value?.pop('torso')
}

function toAge(v) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function ageLabel(doc) {
  if (doc.age_from == null && doc.age_to == null) return ''
  return `${doc.age_from ?? 0}–${doc.age_to ?? '∞'}`
}

const ageStage = computed(() => {
  const a = draft.value?.morph?.age || 0
  const key =
    a < -0.6 ? 'child' : a < -0.2 ? 'teen' : a < 0.35 ? 'adult' : a < 0.7 ? 'middle' : 'elder'
  return t('character.ageStages.' + key)
})

// ── Genetics ──────────────────────────────────────────────────────────────────
// Parents = the other end of vertical (parent→child) edges into this person;
// adoption is vertical but not genetic, so it's skipped.
const parentIds = computed(() => {
  const roles = store.relTypeRoles
  const roleOf = (type) =>
    roles?.get?.(type) || (type === 'parent_child' || type === 'adopted' ? 'vertical' : 'none')
  return [
    ...new Set(
      store.relationships
        .filter(
          (r) =>
            r.person_b_id === personId.value &&
            r.type !== 'adopted' &&
            roleOf(r.type) === 'vertical'
        )
        .map((r) => r.person_a_id)
    )
  ]
})

const parentLooks = computed(() =>
  parentIds.value
    .map((id) => {
      const docs = store.characters.filter((c) => c.person_id === id)
      const doc = docs.find((c) => c.is_portrait) || docs[0]
      return { person: store.persons.find((p) => p.id === id), doc }
    })
    .filter((x) => x.person && x.doc)
)

/** Parents' 3D looks (portrait doc first, else any 3D doc). */
const parentModels3D = computed(() =>
  parentIds.value
    .map((id) => {
      const docs = store.characters.filter((c) => c.person_id === id && c.model3d)
      const doc = docs.find((c) => c.is_portrait) || docs[0]
      const p = store.persons.find((x) => x.id === id)
      return doc && p ? { name: p.name, model: doc.model3d } : null
    })
    .filter(Boolean)
)

function landLook(next) {
  commit((d) => Object.assign(d, next))
  stageRef.value?.beginTransition()
  requestAnimationFrame(() => stageRef.value?.popAll({ sparkle: true }))
}

function inheritFromParents() {
  if (!draft.value || !parentLooks.value.length) return
  landLook(
    inheritDoc(
      pack.value,
      parentLooks.value.map((pl) => pl.doc),
      draft.value,
      { resemblance: resemblance.value }
    )
  )
  flashToast(t('character.inherited'))
}

// Gene pool: this project's other looks in the same style
const worldDocs = computed(() =>
  store.characters.filter((c) => c.style_id === pack.value.id && c.id !== draft.value?.id)
)
function genePool() {
  const pool = worldDocs.value
  if (pool.length < 2 || !draft.value) return
  const a = pool[Math.floor(Math.random() * pool.length)]
  let b = pool[Math.floor(Math.random() * pool.length)]
  if (b === a) b = pool[(pool.indexOf(a) + 1) % pool.length]
  landLook(inheritDoc(pack.value, [a, b], draft.value, { resemblance: 0.7 }))
}

// ── DNA codes & export ────────────────────────────────────────────────────────
async function copyDNA() {
  const d = draft.value
  if (!d) return
  const code = encodeDNA(d)
  try {
    await navigator.clipboard.writeText(code)
    flashToast(t('character.dnaCopied'))
  } catch {
    dnaInput.value = code
    flashToast(t('character.dnaShown'))
  }
}

function applyDNA() {
  try {
    const dna = decodeDNA(dnaInput.value)
    const to = packOf(dna.style_id)
    const styleChanged = to.id !== draft.value.style_id
    if (styleChanged) stageRef.value?.beginTransition()
    commit((d) => {
      d.style_id = to.id
      d.parts = remapDoc({ parts: dna.parts, palette: dna.palette }, to).parts
      d.palette = { ...defaultPalette(to), ...dna.palette }
      d.morph = { ...d.morph, ...dna.morph }
      if (dna.expression) d.expression = dna.expression
      if (dna.backdrop) d.backdrop = dna.backdrop
    })
    requestAnimationFrame(() => stageRef.value?.popAll({ sparkle: true }))
    dnaInput.value = ''
    flashToast(t('character.dnaApplied'))
  } catch {
    flashToast(t('character.dnaBad'))
  }
}

function fileBase() {
  return (
    `${personName.value || 'character'}-${draft.value?.label || ''}`
      .replace(/[^\w\- ]+/g, '')
      .trim() || 'character'
  )
}

function downloadHref(href, name) {
  const a = document.createElement('a')
  a.download = name
  a.href = href
  a.click()
}

function exportPNG() {
  const canvas = renderToCanvas(draft.value, pack.value, { size: 1400 })
  downloadHref(canvas.toDataURL('image/png'), fileBase() + '.png')
}

function exportSVG() {
  const svg = docToSvg(draft.value, pack.value, { size: 1400 })
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  downloadHref(url, fileBase() + '.svg')
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

// Card rarity: a nod to gacha screens — the more connected, the rarer
const rarity = computed(() => {
  const n = store.relationships.filter(
    (r) => r.person_a_id === personId.value || r.person_b_id === personId.value
  ).length
  return Math.max(1, Math.min(5, 1 + Math.ceil(n / 2)))
})

// ── Set as portrait: rasterize → the regular images pipeline ─────────────────
const portraitBusy = ref(false)
const portraitDone = ref(false)

/** `framedBackdrop` (from photo mode) bakes that backdrop into the avatar. */
async function setAsPortrait(framedBackdrop) {
  const d = draft.value
  if (!d || portraitBusy.value) return
  portraitBusy.value = true
  try {
    flushSave()
    stageRef.value?.flash()
    const theme = getComputedStyle(document.documentElement)
    const opts = { size: 512, region: portraitRegion(pack.value) }
    if (typeof framedBackdrop === 'string') {
      opts.backdrop = (ctx, size) =>
        paintBackdrop(ctx, framedBackdrop, size, size, 2.5, {
          accent: theme.getPropertyValue('--accent').trim() || '#6c8ef5',
          base: theme.getPropertyValue('--bg').trim() || '#0f1117',
          motion: true
        })
    }
    const dataUrl = is3D.value
      ? editor3d.value?.snapshot({ size: 512, framing: 'portrait', type: 'image/webp' })
      : rasterize(d, pack.value, opts)
    if (!dataUrl) return
    // Replace any previous generated portrait (never a user-picked photo)
    const existing = await api.invoke('images:getByPerson', { personId: d.person_id })
    if (existing.success) {
      for (const img of existing.data.filter((i) => i.source === 'character')) {
        await api.invoke('images:delete', { imageId: img.id })
      }
    }
    const added = await api.invoke('images:add', {
      personId: d.person_id,
      srcPath: dataUrl,
      isPrimary: true,
      source: 'character'
    })
    if (!added.success) {
      if (added.error) appToast(added.error, { tone: 'error' })
      return
    }
    await store.setCharacterPortrait(d.person_id, d.id)
    const idx = store.persons.findIndex((p) => p.id === d.person_id)
    if (idx !== -1) {
      store.persons[idx] = { ...store.persons[idx], primary_image: added.data.file_path }
    }
    store.refreshUsage()
    portraitDone.value = true
    flashToast(t('character.portraitSet'))
    setTimeout(() => (portraitDone.value = false), 1800)
  } finally {
    portraitBusy.value = false
  }
}

// ── Thumbnails (tiny renders, cached) ────────────────────────────────────────
const thumbCache = new Map()
let placeholder3d = ''
function thumbOf(doc) {
  if (doc.style_id === HUMAN3D_STYLE) {
    const hit = thumb3d.value.get(doc.id)
    if (hit) return hit
    if (!placeholder3d) {
      const cv = document.createElement('canvas')
      cv.width = cv.height = 96
      const g = cv.getContext('2d')
      const grad = g.createRadialGradient(48, 40, 6, 48, 48, 60)
      grad.addColorStop(0, '#3a4256')
      grad.addColorStop(1, '#141820')
      g.fillStyle = grad
      g.fillRect(0, 0, 96, 96)
      g.font = '44px serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('🧊', 48, 52)
      placeholder3d = cv.toDataURL()
    }
    return placeholder3d
  }
  const isDraft = doc.id === draft.value?.id
  const live = isDraft ? draft.value : doc
  const stamp = isDraft ? snapshot() : doc.updated_at + doc.style_id
  const hit = thumbCache.get(doc.id)
  if (hit && hit.stamp === stamp) return hit.url
  const p = packOf(live.style_id)
  const url = rasterize(live, p, { size: 96, region: portraitRegion(p) })
  thumbCache.set(doc.id, { stamp, url })
  return url
}

// The top strip's style tabs show THIS look in every style (debounced)
const styleThumbs = ref({})
let styleThumbTimer = 0
function renderStyleThumbs() {
  styleThumbTimer = 0
  const d = draft.value
  if (!d) return
  const out = {}
  for (const p of STYLE_LIST) {
    const r = remapDoc(d, p)
    const look = {
      ...d,
      style_id: p.id,
      parts: styleMemory.get(d.id)?.[p.id] || r.parts,
      palette: r.palette
    }
    if (p.id === d.style_id) look.parts = d.parts
    out[p.id] = rasterize(look, p, { size: 72, region: p.face })
  }
  styleThumbs.value = out
}
watch(
  () => draft.value && snapshot(),
  () => {
    clearTimeout(styleThumbTimer)
    styleThumbTimer = setTimeout(renderStyleThumbs, 260)
  },
  { immediate: true }
)

// The chooser cards: a sample of each style, tinted per person for variety
const chooserThumbs = computed(() => {
  const out = {}
  const seed = [...(personId.value || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0)
  for (const p of STYLE_LIST) {
    const preset = p.palettePresets[seed % p.palettePresets.length]
    const sample = {
      id: 'sample',
      parts: defaultParts(p),
      palette: { ...preset },
      morph: { height: 0, build: 0, headSize: 0, age: 0 },
      expression: 'happy'
    }
    out[p.id] = rasterize(sample, p, { size: 220, region: p.portrait })
  }
  return out
})

// ── Keyboard: view-local shortcuts (captured so Ctrl+Z/X undo THIS editor) ──
function isTyping(e) {
  const el = e.target
  return (
    !!el &&
    (el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      el.isContentEditable)
  )
}

function onKeydown(e) {
  if (!draft.value || photoOpen.value || chooserOpen.value || store.formOpen || !store.authUser)
    return
  if (isTyping(e)) return
  const key = e.key.toLowerCase()
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (key === 'z' || key === 'x')) {
    e.preventDefault()
    e.stopPropagation()
    if (key === 'z') undo()
    else redo()
    return
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (is3D.value) {
    if (key === 'r') editor3d.value?.onKey('r')
    return
  }
  if (key === 'r') shuffle()
  else if (key === 'm') mirror()
  else if (key === 'p') photoOpen.value = true
}

onMounted(() => window.addEventListener('keydown', onKeydown, true))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown, true)
  clearTimeout(shuffling)
  clearTimeout(styleThumbTimer)
  clearTimeout(toastTimer)
  flushSave()
})

// Leaving a slot/tab drops any hover try-on
watch([selectedSlot, inspectorTab], () => (hoverPart.value = undefined))

// Fallback for a doc whose style pack is unknown (e.g. from a newer build)
watch(
  () => draft.value?.style_id,
  (id) => {
    if (id && id !== HUMAN3D_STYLE && !stylePacks[id] && draft.value)
      draft.value.style_id = DEFAULT_STYLE
  }
)
</script>

<style scoped>
.cv-view {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  z-index: 2;
}

/* ── Top strip ── */
.cv-topstrip {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--glass-strong);
  min-height: 58px;
}

.cv-person {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.cv-person-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--adim);
  color: var(--accent);
  font-weight: 700;
  box-shadow: 0 0 0 2px var(--adim);
}

.cv-person-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cv-select,
.cv-label-input {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12.5px;
  outline: none;
}

.cv-select {
  max-width: 180px;
}

.cv-label-input {
  flex: 0 1 180px;
  min-width: 90px;
}

.cv-select:focus,
.cv-label-input:focus {
  border-color: var(--accent);
}

.cv-styles {
  margin-left: auto;
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  border-radius: 14px;
  background: var(--elevated);
  border: 1px solid var(--border);
}

.cv-style {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 3px 10px 3px 3px;
  border: none;
  border-radius: 11px;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.18s,
    color 0.18s,
    transform 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.4);
}

.cv-style:hover {
  color: var(--t1);
  transform: translateY(-1px);
}

.cv-style.on {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 4px 14px var(--adim);
}

.cv-style-thumb {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--bg);
  object-fit: cover;
}

.cv-style-3d {
  position: relative;
}

.cv-3d-thumb {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: radial-gradient(circle at 50% 35%, #3a4256, #141820);
  font-size: 16px;
}

.cv-3d-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cv-3d-badge {
  position: absolute;
  top: -6px;
  right: -4px;
  padding: 1px 5px;
  border-radius: 6px;
  background: linear-gradient(135deg, #7c5cff, #2bb8ff);
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.04em;
  box-shadow: 0 2px 8px rgba(60, 80, 255, 0.4);
}

/* ── 3D creator host ── */
.cv-3d-host {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  display: flex;
}

/* featured 3D card in the chooser */
.cv-chooser-3d {
  display: flex;
  align-items: center;
  gap: 18px;
  width: min(640px, 100%);
  margin: 0 auto 14px;
  padding: 16px 20px;
  border: 1px solid rgba(124, 92, 255, 0.5);
  border-radius: 18px;
  background:
    radial-gradient(circle at 12% 50%, rgba(43, 184, 255, 0.25), transparent 55%),
    linear-gradient(120deg, #191c2b, #241a3a 60%, #13222e);
  color: #f2f4fb;
  font-family: var(--font);
  text-align: left;
  cursor: pointer;
  box-shadow: 0 10px 40px rgba(60, 40, 160, 0.25);
  transition:
    transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.4),
    box-shadow 0.2s;
}

.cv-chooser-3d:hover {
  transform: translateY(-3px) scale(1.01);
  box-shadow: 0 16px 48px rgba(90, 60, 220, 0.4);
}

.cv-chooser-3d-art {
  font-size: 46px;
  filter: drop-shadow(0 4px 12px rgba(43, 184, 255, 0.5));
}

.cv-chooser-3d-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cv-chooser-3d-kicker {
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #8fd8ff;
}

.cv-chooser-3d .cv-chooser-blurb {
  color: #b9c0d4;
}

/* ── Root grid ── */
.cv-root {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  display: grid;
  grid-template-columns: 84px 1fr 316px;
  background: var(--bg);
}

.cv-root.cv-solo {
  grid-template-columns: 1fr;
}

/* ── Wardrobe rail ── */
.cv-wardrobe {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 6px;
  border-right: 1px solid var(--border);
  background: var(--glass-soft);
  overflow-y: auto;
}

.cv-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cv-group-label {
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--t3);
  padding: 0 6px 2px;
}

.cv-slot-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 6px 2px 5px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--t2);
  cursor: pointer;
  transition:
    background 0.14s,
    box-shadow 0.2s,
    transform 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.5);
}

.cv-slot-btn:hover {
  background: var(--hover);
  transform: translateX(2px);
}

.cv-slot-btn.active {
  background: var(--adim);
  color: var(--t1);
  box-shadow: inset 3px 0 0 var(--accent);
}

.cv-slot-btn.empty .cv-slot-icon {
  opacity: 0.45;
  filter: grayscale(0.6);
}

.cv-slot-icon {
  font-size: 18px;
  line-height: 1;
  transition: transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.6);
}

.cv-slot-btn.active .cv-slot-icon {
  transform: scale(1.15);
}

.cv-slot-name {
  font-size: 9.5px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.cv-slot-lock {
  position: absolute;
  top: 2px;
  right: 6px;
  font-size: 9px;
}

/* ── Center ── */
.cv-center {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  position: relative;
}

.cv-stage-area {
  flex: 1 1 0;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.cv-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--t2);
  text-align: center;
  padding: 24px;
}

.cv-empty-mark {
  font-size: 44px;
  filter: drop-shadow(0 6px 18px var(--adim));
}

/* Style chooser */
.cv-chooser {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  overflow-y: auto;
  background: radial-gradient(ellipse at 50% 30%, var(--adim), transparent 65%), var(--bg);
  animation: cv-fade 0.3s ease both;
}

.cv-chooser-close {
  position: absolute;
  top: 12px;
  right: 14px;
  border: none;
  background: var(--elevated);
  color: var(--t2);
  border-radius: 50%;
  width: 30px;
  height: 30px;
  cursor: pointer;
}

.cv-chooser-kicker {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--accent);
}

.cv-chooser-title {
  font-size: 24px;
  font-weight: 800;
  color: var(--t1);
  text-align: center;
}

.cv-chooser-hint {
  font-size: 13px;
  color: var(--t3);
  margin-bottom: 12px;
}

.cv-chooser-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 210px));
  gap: 14px;
  justify-content: center;
  width: 100%;
  max-width: 920px;
}

.cv-chooser-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  padding: 10px 10px 14px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--surface);
  color: var(--t1);
  font-family: var(--font);
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  animation: cv-card-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
  animation-delay: calc(var(--i) * 70ms);
  transition:
    transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.4),
    border-color 0.2s,
    box-shadow 0.25s;
}

.cv-chooser-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    115deg,
    transparent 35%,
    rgba(255, 255, 255, 0.18) 50%,
    transparent 65%
  );
  transform: translateX(-120%);
  transition: transform 0.6s ease;
  pointer-events: none;
}

.cv-chooser-card:hover {
  transform: translateY(-6px) scale(1.02);
  border-color: var(--accent);
  box-shadow:
    var(--shadow),
    0 0 0 3px var(--adim);
}

.cv-chooser-card:hover::after {
  transform: translateX(120%);
}

.cv-chooser-img {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 12px;
  background: radial-gradient(circle at 50% 40%, var(--adim), var(--elevated));
}

.cv-chooser-name {
  font-size: 15px;
  font-weight: 800;
  margin-top: 6px;
}

.cv-chooser-blurb {
  font-size: 11.5px;
  color: var(--t2);
  line-height: 1.45;
}

.cv-chooser-extras {
  display: flex;
  gap: 18px;
  margin-top: 16px;
  flex-wrap: wrap;
  justify-content: center;
}

.cv-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--t2);
  cursor: pointer;
}

.cv-check input {
  width: 16px;
  height: 16px;
  padding: 0;
  appearance: auto;
  accent-color: var(--accent);
}

/* Stage overlays */
.cv-cams {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  gap: 4px;
  padding: 3px;
  border-radius: 999px;
  background: var(--glass-strong);
  border: 1px solid var(--border);
  backdrop-filter: blur(10px);
}

.cv-chip {
  border: none;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 11.5px;
  font-weight: 600;
  padding: 5px 10px;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 0.15s,
    color 0.15s;
}

.cv-chip:hover {
  color: var(--t1);
}

.cv-chip.on {
  background: var(--accent);
  color: #fff;
}

.cv-backdrops {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  background: var(--glass-strong);
  border: 1px solid var(--border);
  backdrop-filter: blur(10px);
}

.cv-bd {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: transparent;
  font-size: 14px;
  cursor: pointer;
  transition:
    background 0.15s,
    transform 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.6);
}

.cv-bd:hover {
  background: var(--hover);
  transform: scale(1.12);
}

.cv-bd.on {
  background: var(--adim);
  box-shadow: inset 0 0 0 1.5px var(--accent);
}

.cv-bd-sep {
  width: 1px;
  height: 18px;
  background: var(--border);
  margin: 0 3px;
}

.cv-emotes {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 4px;
  border-radius: 18px;
  background: var(--glass-strong);
  border: 1px solid var(--border);
  backdrop-filter: blur(10px);
}

.cv-emote {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
  transition:
    transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.8),
    background 0.15s;
}

.cv-emote:hover {
  transform: scale(1.22) rotate(-6deg);
  background: var(--hover);
}

.cv-emote.on {
  background: var(--adim);
  box-shadow: inset 0 0 0 1.5px var(--accent);
}

.cv-pill {
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--glass-strong);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow);
  animation: cv-rise 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
}

.cv-pill-btn {
  border: none;
  background: transparent;
  color: var(--t2);
  font-size: 15px;
  font-family: var(--font);
  padding: 6px 9px;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 0.12s,
    color 0.12s,
    transform 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.6);
}

.cv-pill-btn:hover:not(:disabled) {
  background: var(--hover);
  color: var(--t1);
  transform: translateY(-2px);
}

.cv-dice:hover:not(:disabled) {
  transform: rotate(-20deg) scale(1.15);
}

.cv-pill-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.cv-pill-primary {
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
}

.cv-pill-sep {
  width: 1px;
  height: 18px;
  background: var(--border);
  margin: 0 4px;
}

.cv-toast {
  position: absolute;
  left: 50%;
  top: 58px;
  transform: translateX(-50%);
  padding: 7px 16px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  box-shadow: var(--shadow);
  z-index: 20;
}

.cv-toast-enter-active,
.cv-toast-leave-active {
  transition:
    opacity 0.2s,
    transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1.4);
}

.cv-toast-enter-from,
.cv-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px) scale(0.95);
}

/* ── Filmstrip ── */
.cv-filmstrip {
  display: flex;
  align-items: stretch;
  gap: 8px;
  padding: 8px 14px;
  border-top: 1px solid var(--border);
  background: var(--glass-soft);
  overflow-x: auto;
}

.cv-look {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--elevated);
  color: var(--t2);
  font-size: 11px;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    border-color 0.15s,
    box-shadow 0.2s,
    transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.5);
}

.cv-look:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}

.cv-look.active {
  border-color: var(--accent);
  background: var(--adim);
  color: var(--t1);
  box-shadow: 0 0 12px var(--adim);
}

.cv-look-thumb {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: var(--bg);
  object-fit: cover;
}

.cv-look-name {
  max-width: 76px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cv-look-star {
  position: absolute;
  top: 2px;
  right: 5px;
  color: var(--amber);
  font-size: 12px;
}

.cv-look-style {
  position: absolute;
  top: 3px;
  left: 5px;
  font-size: 10px;
}

.cv-look-age {
  font-size: 9px;
  color: var(--t3);
}

.cv-look-add {
  justify-content: center;
  font-size: 20px;
  color: var(--t3);
  border-style: dashed;
  min-width: 60px;
}

.cv-look-add:hover {
  color: var(--accent);
}

.cv-look-enter-active {
  transition:
    opacity 0.3s,
    transform 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.4);
}

.cv-look-enter-from {
  opacity: 0;
  transform: scale(0.6);
}

/* ── Inspector ── */
.cv-inspector {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-left: 1px solid var(--border);
  background: var(--glass-soft);
}

.cv-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
  padding: 8px 8px 0;
  border-bottom: 1px solid var(--border);
}

.cv-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 6px 2px 8px;
  border: none;
  background: transparent;
  color: var(--t3);
  font-family: var(--font);
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition:
    color 0.15s,
    border-color 0.2s;
}

.cv-tab span {
  font-size: 16px;
  transition: transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.6);
}

.cv-tab:hover {
  color: var(--t1);
}

.cv-tab.on {
  color: var(--t1);
  border-bottom-color: var(--accent);
}

.cv-tab.on span {
  transform: translateY(-1px) scale(1.12);
}

.cv-tab-body {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 14px;
}

.cv-pane {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.cv-pane-enter-active,
.cv-pane-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.2s ease;
}

.cv-pane-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.cv-pane-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

.cv-section-head {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 10px;
}

.cv-section-head .cv-section-title {
  margin: 0;
  flex: 1;
}

.cv-section-title {
  margin: 0 0 10px;
  font-size: 12.5px;
  font-weight: 800;
  color: var(--t1);
}

.cv-section-title.cv-sub {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--t2);
  margin-bottom: 8px;
}

.cv-mini {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--elevated);
  color: var(--t2);
  font-size: 13px;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;
}

.cv-mini:hover {
  border-color: var(--accent);
}

.cv-mini.on {
  background: var(--adim);
  border-color: var(--accent);
  color: var(--t1);
}

.cv-slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--t2);
}

.cv-slider-row span {
  flex: 0 0 74px;
}

.cv-slider-row input[type='range'],
.cv-age-slider {
  flex: 1;
  accent-color: var(--accent);
}

.cv-age-slider {
  width: 100%;
}

/* Range inputs: slim track + glowing thumb (the global input style would
   otherwise box them like text fields) */
.cv-view input[type='range'] {
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--border);
  border-radius: 4px;
  border: none;
  padding: 0;
  box-shadow: none;
  cursor: pointer;
}

.cv-view input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--surface);
  box-shadow:
    0 1px 4px rgba(0, 0, 0, 0.3),
    0 0 0 4px var(--adim);
  transition: transform 0.14s cubic-bezier(0.2, 0.9, 0.3, 1.6);
}

.cv-view input[type='range']::-webkit-slider-thumb:hover,
.cv-view input[type='range']:active::-webkit-slider-thumb {
  transform: scale(1.25);
}

.cv-view input[type='range']:focus {
  box-shadow: none;
}

.cv-view .cv-age-slider {
  height: 6px;
  background: linear-gradient(90deg, var(--green), var(--accent), var(--amber));
}

.cv-age-badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  background: var(--adim);
  padding: 2px 10px;
  border-radius: 999px;
}

.cv-age-ticks {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--t3);
  margin-top: 2px;
}

.cv-presets {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
  gap: 6px;
}

.cv-preset {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 9px;
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  transition: transform 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.6);
}

.cv-preset:hover {
  transform: translateY(-2px) scale(1.05);
}

.cv-btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cv-soft-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 11px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.15s,
    transform 0.15s;
}

.cv-soft-btn:hover:not(:disabled) {
  border-color: var(--accent);
  transform: translateY(-1px);
}

.cv-soft-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.cv-wide {
  width: 100%;
  margin-top: 8px;
}

.cv-tag-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--c);
}

.cv-hint {
  margin: 0 0 8px;
  font-size: 11px;
  color: var(--t3);
  line-height: 1.5;
}

.cv-gene-card {
  padding: 12px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: linear-gradient(135deg, var(--adim), transparent 70%);
}

.cv-parents {
  display: flex;
  gap: 10px;
}

.cv-parent {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--t2);
  max-width: 80px;
  text-align: center;
}

.cv-parent img {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: var(--bg);
  box-shadow: 0 0 0 2px var(--accent);
}

.cv-dna-row {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.cv-dna-input {
  flex: 1;
  min-width: 0;
  padding: 6px 9px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--elevated);
  color: var(--t1);
  font-family: ui-monospace, monospace;
  font-size: 11px;
  outline: none;
}

.cv-dna-input:focus {
  border-color: var(--accent);
}

.cv-ages {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cv-age-input {
  width: 72px;
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12px;
  outline: none;
}

.cv-age-input:focus {
  border-color: var(--accent);
}

.cv-age-dash {
  color: var(--t3);
}

.cv-delete {
  align-self: flex-start;
  margin-top: 6px;
}

@keyframes cv-fade {
  from {
    opacity: 0;
  }
}

@keyframes cv-rise {
  from {
    opacity: 0;
    transform: translate(-50%, 14px);
  }
}

@keyframes cv-card-in {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.92);
  }
}

/* ── Narrow screens: stack the inspector under the stage ── */
@media (max-width: 900px) {
  .cv-topstrip {
    flex-wrap: wrap;
  }
  .cv-styles {
    margin-left: 0;
    overflow-x: auto;
    max-width: 100%;
  }
  .cv-style-name {
    display: none;
  }
  .cv-root {
    grid-template-columns: 64px 1fr;
    grid-template-rows: 1fr 44%;
  }
  .cv-inspector {
    grid-column: 1 / -1;
    border-left: none;
    border-top: 1px solid var(--border);
  }
  .cv-chip span {
    display: none;
  }
  .cv-slot-name {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cv-chooser-card,
  .cv-pill,
  .cv-chooser {
    animation: none;
  }
}

/* ── 水墨 ink theme: the studio is an artist's table — rice paper, the
   wardrobe and inspector as side panels of the mount, tabs underlined by a
   brush, the style chooser an album of mounted leaves ─────────────────── */
:root[data-theme='ink'] .cv-view,
:root[data-theme='ink'] .cv-root {
  background: transparent;
}
:root[data-theme='ink'] .cv-topstrip {
  background: color-mix(in srgb, var(--surface) 78%, transparent);
  border-bottom-color: rgba(48, 36, 20, 0.16);
}
:root[data-theme='ink'] .cv-wardrobe,
:root[data-theme='ink'] .cv-inspector {
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
}
:root[data-theme='ink'] .cv-wardrobe {
  border-right-color: var(--ink-mount-line);
  box-shadow: inset -4px 0 0 rgba(214, 199, 166, 0.5);
}
:root[data-theme='ink'] .cv-inspector {
  border-left-color: var(--ink-mount-line);
  box-shadow: inset 4px 0 0 rgba(214, 199, 166, 0.5);
}
:root[data-theme='ink'] .cv-group-label,
:root[data-theme='ink'] .cv-chooser-kicker {
  font-family: var(--font-ink-label);
  font-size: 11px;
  font-weight: 600;
  font-variant: small-caps;
  text-transform: lowercase;
  letter-spacing: 0.12em;
}
:root[data-theme='ink'] .cv-slot-btn,
:root[data-theme='ink'] .cv-style,
:root[data-theme='ink'] .cv-chip,
:root[data-theme='ink'] .cv-bd,
:root[data-theme='ink'] .cv-emote,
:root[data-theme='ink'] .cv-mini,
:root[data-theme='ink'] .cv-preset,
:root[data-theme='ink'] .cv-soft-btn,
:root[data-theme='ink'] .cv-look,
:root[data-theme='ink'] .cv-select,
:root[data-theme='ink'] .cv-label-input {
  border-radius: 3px 5px 4px 6px / 5px 3px 6px 4px;
}
:root[data-theme='ink'] .cv-slot-icon,
:root[data-theme='ink'] .cv-tab span,
:root[data-theme='ink'] .cv-empty-mark {
  filter: grayscale(1) sepia(0.4) contrast(1.1);
}
:root[data-theme='ink'] .cv-slot-btn.active {
  background: rgba(179, 53, 42, 0.08);
  box-shadow: inset 3px 0 0 var(--accent);
}
:root[data-theme='ink'] .cv-label-input {
  font-family: var(--font-brush);
  font-size: 17px;
}
:root[data-theme='ink'] .cv-tab {
  position: relative;
  border-bottom-color: transparent;
  font-family: var(--font-ink-label);
  font-size: 12px;
}
:root[data-theme='ink'] .cv-tab::after {
  content: '';
  position: absolute;
  left: 18%;
  right: 18%;
  bottom: 0;
  height: 5px;
  background-color: var(--accent);
  -webkit-mask: var(--ink-underline) center / 100% 100% no-repeat;
  mask: var(--ink-underline) center / 100% 100% no-repeat;
  clip-path: inset(0 100% 0 0);
  transition: clip-path 0.45s var(--ease-out);
}
:root[data-theme='ink'] .cv-tab.on {
  border-bottom-color: transparent;
}
:root[data-theme='ink'] .cv-tab.on::after {
  clip-path: inset(0 0 0 0);
}
:root[data-theme='ink'] .cv-section-title {
  font-family: var(--font-brush);
  font-size: 17px;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0.02em;
}
:root[data-theme='ink'] .cv-chooser-title {
  font-weight: 400;
}
:root[data-theme='ink'] .cv-chooser-card {
  border-radius: 2px;
  border-color: var(--ink-mount-line);
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  box-shadow:
    0 0 0 3px var(--ink-silk),
    0 0 0 4px rgba(58, 42, 22, 0.2),
    var(--shadow-sm);
}
:root[data-theme='ink'] .cv-chooser-name {
  font-family: var(--font-brush);
  font-size: 18px;
  font-weight: 400;
}
:root[data-theme='ink'] .cv-pill {
  border-radius: 2px;
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  backdrop-filter: none;
  box-shadow:
    0 0 0 2px var(--ink-silk),
    0 0 0 3px rgba(58, 42, 22, 0.2),
    var(--shadow);
}
:root[data-theme='ink'] .cv-pill-btn {
  border-radius: 2px;
  font-family: var(--font-ink-label);
}
:root[data-theme='ink'] .cv-pill-primary {
  font-family: var(--font-brush);
  font-size: 15px;
  font-weight: 400;
}
:root[data-theme='ink'] .cv-filmstrip {
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  border-top-color: rgba(48, 36, 20, 0.16);
}
:root[data-theme='ink'] .cv-look-name {
  font-family: var(--font-brush);
  font-weight: 400;
}
:root[data-theme='ink'] .cv-toast {
  border-radius: 2px;
  font-family: var(--font-ink-label);
}
</style>
