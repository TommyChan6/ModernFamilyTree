<template>
  <div class="h3e" :class="{ 'h3e-loading-on': loading }">
    <!-- ── Category rail ─────────────────────────────────────────────────── -->
    <nav class="h3e-rail" :aria-label="L('categories', 'Categories')">
      <button
        v-for="c in CATEGORIES"
        :key="c.id"
        class="h3e-cat"
        :class="{ on: category === c.id }"
        :title="L('cat.' + c.id, c.label)"
        @click="selectCategory(c.id)"
      >
        <span class="h3e-cat-icon">{{ c.icon }}</span>
        <span class="h3e-cat-label">{{ L('cat.' + c.id, c.label) }}</span>
      </button>
    </nav>

    <!-- ── Stage ─────────────────────────────────────────────────────────── -->
    <div
      ref="stageHost"
      class="h3e-stage"
      :class="{ sculpting: !!drag, 'can-sculpt': sculptMode && hoverRegion?.sculptX }"
      @pointerdown.capture="onStageDown"
      @pointermove="onStageMove"
      @pointerup="onStageUp"
      @pointercancel="onStageUp"
      @pointerleave="onStageLeave"
    >
      <Transition name="h3e-fade">
        <div v-if="loading || error" class="h3e-loading">
          <div v-if="!error" class="h3e-loader">
            <div class="h3e-silhouette">🧍</div>
            <div class="h3e-loader-bar"><span></span></div>
            <p>{{ L('loading', 'Sculpting your character…') }}</p>
          </div>
          <div v-else class="h3e-loader">
            <div class="h3e-silhouette">⚠️</div>
            <p>{{ L('loadFailed', 'The 3D model could not be loaded.') }}</p>
            <code>{{ error }}</code>
          </div>
        </div>
      </Transition>

      <div class="h3e-crumb">
        <span class="h3e-crumb-icon">{{ currentCategory.icon }}</span>
        <span>{{ L('cat.' + category, currentCategory.label) }}</span>
        <template v-if="subLabel">
          <span class="h3e-crumb-sep">›</span>
          <span class="h3e-crumb-sub">{{ subLabel }}</span>
        </template>
      </div>

      <div class="h3e-topright">
        <div class="h3e-chips" role="group" :aria-label="L('camera', 'Camera')">
          <button
            v-for="cam in CAMERAS"
            :key="cam.id"
            class="h3e-chip"
            :title="L('cam.' + cam.id, cam.label)"
            @click="stage?.focus(cam.id)"
          >
            {{ cam.icon }}
          </button>
        </div>
        <div class="h3e-chips" role="group" :aria-label="L('lighting', 'Lighting')">
          <button
            v-for="lp in LIGHT_PRESETS"
            :key="lp.id"
            class="h3e-chip"
            :class="{ on: model.light === lp.id }"
            :title="L('light.' + lp.id, lp.label)"
            @click="setField('light', lp.id)"
          >
            {{ lp.icon }}
          </button>
        </div>
      </div>

      <Transition name="h3e-fade">
        <div
          v-if="hoverRegion && !drag && !loading"
          class="h3e-hover-tag"
          :style="{ left: hoverXY.x + 'px', top: hoverXY.y + 'px' }"
        >
          <b>{{ L('region.' + hoverRegion.id, hoverRegion.label) }}</b>
          <span v-if="sculptMode && hoverRegion.sculptX">{{
            L('dragToSculpt', 'drag to sculpt · click to edit')
          }}</span>
          <span v-else>{{ L('clickToEdit', 'click to edit') }}</span>
        </div>
      </Transition>
      <div v-if="drag" class="h3e-sculpt-hud">
        <span>↔ {{ sliderLabel(drag.region.sculptX) }}</span>
        <span>↕ {{ sliderLabel(drag.region.sculptY) }}</span>
      </div>

      <div class="h3e-expr" role="group" :aria-label="L('expression', 'Expression')">
        <button
          v-for="e in EXPRESSIONS"
          :key="e.id"
          class="h3e-expr-btn"
          :class="{ on: model.expression === e.id }"
          :title="L('expr.' + e.id, e.label)"
          @click="setField('expression', e.id)"
        >
          {{ e.icon }}
        </button>
      </div>

      <div class="h3e-toolbar">
        <button
          class="h3e-tool"
          :disabled="!canUndo"
          :title="L('undo', 'Undo') + ' (Ctrl+Z)'"
          @click="undo"
        >
          ↩
        </button>
        <button
          class="h3e-tool"
          :disabled="!canRedo"
          :title="L('redo', 'Redo') + ' (Ctrl+X)'"
          @click="redo"
        >
          ↪
        </button>
        <span class="h3e-tool-sep"></span>
        <button
          class="h3e-tool h3e-dice"
          :title="L('randomizeAll', 'Randomize everything') + ' (R)'"
          @click="randomize()"
        >
          🎲
        </button>
        <button
          class="h3e-tool"
          :class="{ on: sculptMode }"
          :title="L('sculptMode', 'Sculpt mode: drag features on the face')"
          @click="sculptMode = !sculptMode"
        >
          🗿
        </button>
        <button
          class="h3e-tool"
          :class="{ on: turntable }"
          :title="L('turntable', 'Turntable')"
          @click="toggleTurntable"
        >
          🔄
        </button>
        <button
          class="h3e-tool"
          :class="{ on: gaze }"
          :title="L('gaze', 'Eye contact')"
          @click="toggleGaze"
        >
          👀
        </button>
        <span class="h3e-tool-sep"></span>
        <button class="h3e-tool" :title="L('photo', 'Save a photo')" @click="savePhoto('portrait')">
          📸
        </button>
        <button
          class="h3e-tool h3e-primary"
          :disabled="portraitBusy || loading"
          @click="emit('set-portrait')"
        >
          {{ portraitDone ? '✓' : '🖼' }} {{ L('setPortrait', 'Set as portrait') }}
        </button>
      </div>
      <div v-if="flashOn" class="h3e-flash"></div>
    </div>

    <!-- ── Inspector ─────────────────────────────────────────────────────── -->
    <aside class="h3e-panel">
      <header class="h3e-panel-head">
        <h3 class="h3e-title">
          <span>{{ currentCategory.icon }}</span>
          {{ L('cat.' + category, currentCategory.label) }}
        </h3>
        <div v-if="subTabs.length" class="h3e-subtabs" role="tablist">
          <button
            v-for="st in subTabs"
            :key="st.id"
            class="h3e-subtab"
            :class="{ on: sub === st.id }"
            role="tab"
            @click="selectSub(st.id)"
          >
            <span>{{ st.icon }}</span
            >{{ st.label }}
          </button>
        </div>
        <div v-if="category === 'face' || category === 'body'" class="h3e-search-row">
          <input
            v-model="search"
            class="h3e-search"
            type="search"
            :placeholder="L('searchSliders', 'Search sliders…')"
          />
          <button
            v-if="category === 'face'"
            class="h3e-mini"
            :class="{ on: !symmetric }"
            :title="L('asymmetry', 'Edit left and right separately')"
            @click="symmetric = !symmetric"
          >
            {{ symmetric ? '⇋' : '⇆' }}
          </button>
          <button class="h3e-mini" :title="L('resetGroup', 'Reset this group')" @click="resetGroup">
            ↺
          </button>
          <button
            class="h3e-mini"
            :title="L('randomizeGroup', 'Randomize this group')"
            @click="randomizeGroup"
          >
            🎲
          </button>
        </div>
      </header>

      <div class="h3e-panel-body">
        <!-- Presets -->
        <template v-if="category === 'presets'">
          <section class="h3e-sec">
            <h4>{{ L('archetypes', 'Archetypes') }}</h4>
            <div class="h3e-cards">
              <button v-for="p in PRESETS_3D" :key="p.id" class="h3e-card" @click="applyPreset(p)">
                <span class="h3e-card-icon">{{ p.icon }}</span>
                <span class="h3e-card-label">{{ L('preset.' + p.id, p.label) }}</span>
              </button>
            </div>
          </section>
          <section class="h3e-sec">
            <h4>🧬 {{ L('family', 'Family resemblance') }}</h4>
            <template v-if="parents.length">
              <p class="h3e-hint">
                {{ L('familyHint', 'Blend this face from the parents’ 3D looks.') }}
                <b>{{ parents.map((x) => x.name).join(' + ') }}</b>
              </p>
              <H3Slider
                :label="L('resemblance', 'Resemblance')"
                :model-value="resemblance"
                :min="0"
                :max="1"
                :neutral="0.8"
                :ends="[L('end.Wild card', 'Wild card'), L('end.Spitting image', 'Spitting image')]"
                @live="setResemblance"
                @done="noop"
              />
              <button class="btn btn-soft btn-sm h3e-wide" @click="inherit">
                🧬 {{ L('rollChild', 'Roll a family face') }}
              </button>
            </template>
            <p v-else class="h3e-hint">
              {{
                L(
                  'noParents3d',
                  'Give this person’s parents a 3D look to inherit features from them.'
                )
              }}
            </p>
          </section>
          <section class="h3e-sec">
            <h4>{{ L('randomize', 'Randomize') }}</h4>
            <p class="h3e-hint">
              {{ L('randomizeHint', 'Locked sections keep their look when you roll the dice.') }}
            </p>
            <div class="h3e-locks">
              <button
                v-for="lk in LOCKS"
                :key="lk.id"
                class="h3e-lock"
                :class="{ on: locks.includes(lk.id) }"
                @click="toggleLock(lk.id)"
              >
                {{ locks.includes(lk.id) ? '🔒' : '🔓' }} {{ L('lock.' + lk.id, lk.label) }}
              </button>
            </div>
            <button class="btn btn-primary btn-sm h3e-wide" @click="randomize()">
              🎲 {{ L('randomizeAll', 'Randomize everything') }}
            </button>
          </section>
          <section class="h3e-sec">
            <h4>{{ L('reset', 'Start over') }}</h4>
            <div class="h3e-row">
              <button class="btn btn-soft btn-sm" @click="resetFace">
                {{ L('resetFace', 'Neutral face') }}
              </button>
              <button class="btn btn-soft btn-sm" @click="resetAll">
                {{ L('resetAll', 'Default human') }}
              </button>
            </div>
          </section>
        </template>

        <!-- Body -->
        <template v-else-if="category === 'body'">
          <template v-if="sub === 'shape' && !search">
            <section class="h3e-sec">
              <H3Slider
                v-for="m in MACRO_SLIDERS"
                :key="m.key"
                :label="L('macro.' + m.key, m.label)"
                :model-value="model.body[m.key]"
                :min="m.min ?? 0"
                :max="m.max ?? 1"
                :step="m.step ?? 0.01"
                :neutral="m.key === 'age' ? 25 : 0.5"
                :ends="m.ends"
                :format="m.key === 'age' ? fmtAge : null"
                @live="(v) => liveBody(m.key, v)"
                @done="done"
              />
            </section>
            <section class="h3e-sec">
              <h4>{{ L('heritage', 'Heritage blend') }}</h4>
              <p class="h3e-hint">
                {{
                  L('heritageHint', 'Shapes the face and body; the three always add up to 100%.')
                }}
              </p>
              <div class="h3e-heritage-bar">
                <span
                  v-for="a in ANCESTRY"
                  :key="a.key"
                  :style="{ flex: heritageShare(a.key), background: a.color }"
                ></span>
              </div>
              <H3Slider
                v-for="a in ANCESTRY"
                :key="a.key"
                :label="L('anc.' + a.key, a.label)"
                :model-value="heritageShare(a.key)"
                :min="0"
                :max="1"
                :neutral="1 / 3"
                :format="pct"
                @live="(v) => liveHeritage(a.key, v)"
                @done="done"
              />
            </section>
          </template>
          <section v-for="g in visibleBodyGroups" :key="g.id" class="h3e-sec">
            <h4 v-if="search || visibleBodyGroups.length > 1">
              {{ g.icon }} {{ L('group.' + g.id, g.label) }}
            </h4>
            <template v-for="s in g.sliders" :key="s.id">
              <H3Slider
                :label="sliderLabel(s.id)"
                :model-value="shapeValue(s.id)"
                :min="s.unipolar ? 0 : -1"
                :max="1"
                :ends="
                  s.ends
                    ? [L('end.' + s.ends[0], s.ends[0]), L('end.' + s.ends[1], s.ends[1])]
                    : null
                "
                @live="(v) => liveShape(s.id, v)"
                @done="done"
              />
            </template>
          </section>
        </template>

        <!-- Face -->
        <template v-else-if="category === 'face'">
          <section v-for="g in visibleFaceGroups" :key="g.id" class="h3e-sec">
            <h4 v-if="search">{{ g.icon }} {{ L('group.' + g.id, g.label) }}</h4>
            <template v-for="s in g.sliders" :key="s.id">
              <template v-if="!symmetric && s.sides">
                <div class="h3e-pair">
                  <div class="h3e-pair-label">{{ sliderLabel(s.id) }}</div>
                  <H3Slider
                    compact
                    :label="L('left', 'Left')"
                    :model-value="shapeValue(s.id) + shapeValue(s.id + '@l')"
                    @live="(v) => liveShape(s.id + '@l', v - shapeValue(s.id))"
                    @done="done"
                  />
                  <H3Slider
                    compact
                    :label="L('right', 'Right')"
                    :model-value="shapeValue(s.id) + shapeValue(s.id + '@r')"
                    @live="(v) => liveShape(s.id + '@r', v - shapeValue(s.id))"
                    @done="done"
                  />
                </div>
              </template>
              <H3Slider
                v-else
                :label="sliderLabel(s.id)"
                :model-value="shapeValue(s.id)"
                :min="s.unipolar ? 0 : -1"
                :max="1"
                :ends="
                  s.ends
                    ? [L('end.' + s.ends[0], s.ends[0]), L('end.' + s.ends[1], s.ends[1])]
                    : null
                "
                @live="(v) => liveShape(s.id, v)"
                @done="done"
              />
            </template>
          </section>
          <p v-if="!visibleFaceGroups.length" class="h3e-hint">
            {{ L('noMatches', 'No sliders match.') }}
          </p>
        </template>

        <!-- Skin -->
        <template v-else-if="category === 'skin'">
          <section class="h3e-sec">
            <h4>{{ L('skinTone', 'Skin tone') }}</h4>
            <div class="h3e-tone-ramp">
              <button
                v-for="c in SKIN_TONES"
                :key="c"
                class="h3e-tone"
                :class="{ on: model.skin.tone === c }"
                :style="{ background: c }"
                :title="c"
                @click="setIn('skin', 'tone', c)"
              ></button>
            </div>
            <SwatchRow
              :model-value="model.skin.tone"
              :colors="[]"
              @live="(c) => liveIn('skin', 'tone', c)"
              @done="done"
            />
          </section>
          <section class="h3e-sec">
            <H3Slider
              v-for="k in SKIN_SLIDERS"
              :key="k.key"
              :label="L('skin.' + k.key, k.label)"
              :model-value="model.skin[k.key]"
              :min="0"
              :max="1"
              :neutral="DEFAULT_HUMAN3D.skin[k.key]"
              @live="(v) => liveIn('skin', k.key, v)"
              @done="done"
            />
          </section>
        </template>

        <!-- Makeup -->
        <template v-else-if="category === 'makeup'">
          <section v-for="grp in MAKEUP" :key="grp.id" class="h3e-sec">
            <h4>{{ grp.icon }} {{ L('makeup.' + grp.id, grp.label) }}</h4>
            <SwatchRow
              v-if="grp.color"
              :model-value="model.makeup[grp.color]"
              :colors="grp.palette"
              @pick="(c) => setIn('makeup', grp.color, c)"
              @live="(c) => liveIn('makeup', grp.color, c)"
              @done="done"
            />
            <H3Slider
              v-for="k in grp.sliders"
              :key="k.key"
              :label="L('makeup.' + k.key, k.label)"
              :model-value="model.makeup[k.key]"
              :min="0"
              :max="1"
              :neutral="0"
              @live="(v) => liveIn('makeup', k.key, v)"
              @done="done"
            />
          </section>
        </template>

        <!-- Hair -->
        <template v-else-if="category === 'hair'">
          <template v-if="sub === 'hair'">
            <section class="h3e-sec">
              <h4>{{ L('style', 'Style') }}</h4>
              <div class="h3e-cards h3e-cards-sm">
                <button
                  v-for="h in HAIR_STYLES"
                  :key="h.id"
                  class="h3e-card"
                  :class="{ on: model.hair.style === h.id }"
                  @click="setIn('hair', 'style', h.id)"
                >
                  <span class="h3e-card-icon">{{ h.icon }}</span>
                  <span class="h3e-card-label">{{ L('hairStyle.' + h.id, h.label) }}</span>
                </button>
              </div>
            </section>
            <section class="h3e-sec">
              <h4>{{ L('fringeTitle', 'Fringe') }}</h4>
              <div class="h3e-chiprow">
                <button
                  v-for="f in FRINGES"
                  :key="f.id"
                  class="h3e-pill"
                  :class="{ on: model.hair.fringe === f.id }"
                  @click="setIn('hair', 'fringe', f.id)"
                >
                  {{ L('fringe.' + f.id, f.label) }}
                </button>
              </div>
            </section>
            <section class="h3e-sec">
              <h4>{{ L('hairColor', 'Colour') }}</h4>
              <SwatchRow
                :model-value="model.hair.color"
                :colors="[...HAIR_COLORS, ...FANTASY_HAIR]"
                @pick="pickHairColor"
                @live="(c) => liveIn('hair', 'color', c)"
                @done="done"
              />
              <label class="h3e-toggle">
                <input
                  type="checkbox"
                  class="switch"
                  :checked="!!model.hair.tip"
                  @change="toggleTip"
                />
                {{ L('ombre', 'Ombré tips') }}
              </label>
              <SwatchRow
                v-if="model.hair.tip"
                :model-value="model.hair.tip"
                :colors="[...HAIR_COLORS, ...FANTASY_HAIR]"
                @pick="(c) => setIn('hair', 'tip', c)"
                @live="(c) => liveIn('hair', 'tip', c)"
                @done="done"
              />
              <label class="h3e-toggle">
                <input
                  type="checkbox"
                  class="switch"
                  :checked="!!model.hair.highlight"
                  @change="toggleHighlight"
                />
                {{ L('highlights', 'Highlights') }}
              </label>
              <SwatchRow
                v-if="model.hair.highlight"
                :model-value="model.hair.highlight"
                :colors="[...HAIR_COLORS, ...FANTASY_HAIR]"
                @pick="(c) => setIn('hair', 'highlight', c)"
                @live="(c) => liveIn('hair', 'highlight', c)"
                @done="done"
              />
            </section>
            <section class="h3e-sec">
              <H3Slider
                v-for="k in HAIR_SLIDERS"
                :key="k.key"
                :label="L('hair.' + k.key, k.label)"
                :model-value="model.hair[k.key]"
                :min="k.key === 'part' ? -1 : 0"
                :max="1"
                :neutral="DEFAULT_HUMAN3D.hair[k.key]"
                :ends="
                  k.ends
                    ? [L('end.' + k.ends[0], k.ends[0]), L('end.' + k.ends[1], k.ends[1])]
                    : null
                "
                @live="(v) => liveIn('hair', k.key, v)"
                @done="done"
              />
            </section>
          </template>
          <template v-else-if="sub === 'brows'">
            <section class="h3e-sec">
              <div class="h3e-chiprow">
                <button
                  v-for="b in BROW_STYLES"
                  :key="b.id"
                  class="h3e-pill"
                  :class="{ on: model.brows.style === b.id }"
                  @click="setIn('brows', 'style', b.id)"
                >
                  {{ L('brow.' + b.id, b.label) }}
                </button>
              </div>
            </section>
            <section class="h3e-sec">
              <SwatchRow
                :model-value="model.brows.color"
                :colors="HAIR_COLORS"
                @pick="(c) => setIn('brows', 'color', c)"
                @live="(c) => liveIn('brows', 'color', c)"
                @done="done"
              />
              <H3Slider
                :label="L('brows.thickness', 'Thickness')"
                :model-value="model.brows.thickness"
                :min="0"
                :max="1"
                :neutral="0.5"
                @live="(v) => liveIn('brows', 'thickness', v)"
                @done="done"
              />
              <H3Slider
                :label="L('brows.density', 'Density')"
                :model-value="model.brows.density"
                :min="0"
                :max="1"
                :neutral="0.7"
                @live="(v) => liveIn('brows', 'density', v)"
                @done="done"
              />
              <H3Slider
                :label="L('brows.arch', 'Arch')"
                :model-value="model.brows.arch"
                :min="-1"
                :max="1"
                :neutral="0.4"
                @live="(v) => liveIn('brows', 'arch', v)"
                @done="done"
              />
            </section>
          </template>
          <template v-else>
            <section class="h3e-sec">
              <div class="h3e-cards h3e-cards-sm">
                <button
                  v-for="b in BEARD_STYLES"
                  :key="b.id"
                  class="h3e-card"
                  :class="{ on: model.beard.style === b.id }"
                  @click="setIn('beard', 'style', b.id)"
                >
                  <span class="h3e-card-icon">{{ b.icon }}</span>
                  <span class="h3e-card-label">{{ L('beard.' + b.id, b.label) }}</span>
                </button>
              </div>
            </section>
            <section class="h3e-sec">
              <SwatchRow
                :model-value="model.beard.color"
                :colors="HAIR_COLORS"
                @pick="(c) => setIn('beard', 'color', c)"
                @live="(c) => liveIn('beard', 'color', c)"
                @done="done"
              />
              <H3Slider
                :label="L('beard.length', 'Length')"
                :model-value="model.beard.length"
                :min="0"
                :max="1"
                :neutral="0.4"
                @live="(v) => liveIn('beard', 'length', v)"
                @done="done"
              />
              <H3Slider
                :label="L('beard.density', 'Density')"
                :model-value="model.beard.density"
                :min="0"
                :max="1"
                :neutral="0.7"
                @live="(v) => liveIn('beard', 'density', v)"
                @done="done"
              />
              <H3Slider
                :label="L('beard.stubble', 'Shadow / stubble')"
                :model-value="model.beard.stubble"
                :min="0"
                :max="1"
                :neutral="0"
                @live="(v) => liveIn('beard', 'stubble', v)"
                @done="done"
              />
            </section>
          </template>
        </template>

        <!-- Eyes -->
        <template v-else-if="category === 'eyes'">
          <section class="h3e-sec">
            <h4>{{ L('iris', 'Iris') }}</h4>
            <SwatchRow
              :model-value="model.eyes.iris"
              :colors="[...EYE_COLORS, ...FANTASY_EYES]"
              @pick="pickIris"
              @live="(c) => liveIn('eyes', 'iris', c)"
              @done="done"
            />
            <h4>{{ L('irisRing', 'Outer ring') }}</h4>
            <SwatchRow
              :model-value="model.eyes.irisOuter"
              :colors="EYE_COLORS"
              @pick="(c) => setIn('eyes', 'irisOuter', c)"
              @live="(c) => liveIn('eyes', 'irisOuter', c)"
              @done="done"
            />
            <label class="h3e-toggle">
              <input
                type="checkbox"
                class="switch"
                :checked="!!model.eyes.irisRight"
                @change="toggleHetero"
              />
              {{ L('hetero', 'Different right eye (heterochromia)') }}
            </label>
            <SwatchRow
              v-if="model.eyes.irisRight"
              :model-value="model.eyes.irisRight"
              :colors="[...EYE_COLORS, ...FANTASY_EYES]"
              @pick="(c) => setIn('eyes', 'irisRight', c)"
              @live="(c) => liveIn('eyes', 'irisRight', c)"
              @done="done"
            />
          </section>
          <section class="h3e-sec">
            <H3Slider
              v-for="k in EYE_SLIDERS"
              :key="k.key"
              :label="L('eyes.' + k.key, k.label)"
              :model-value="model.eyes[k.key]"
              :min="0"
              :max="1"
              :neutral="DEFAULT_HUMAN3D.eyes[k.key]"
              @live="(v) => liveIn('eyes', k.key, v)"
              @done="done"
            />
          </section>
        </template>

        <!-- Outfit -->
        <template v-else-if="category === 'outfit'">
          <template v-if="sub === 'top'">
            <section class="h3e-sec">
              <div class="h3e-cards h3e-cards-sm">
                <button
                  v-for="g in TOPS"
                  :key="g.id"
                  class="h3e-card"
                  :class="{ on: model.outfit.top === g.id }"
                  @click="setIn('outfit', 'top', g.id)"
                >
                  <span class="h3e-card-icon">{{ g.icon }}</span>
                  <span class="h3e-card-label">{{ L('top.' + g.id, g.label) }}</span>
                </button>
              </div>
            </section>
            <section class="h3e-sec">
              <h4>{{ L('mainColor', 'Main colour') }}</h4>
              <SwatchRow
                :model-value="model.outfit.topColor"
                :colors="CLOTH_COLORS"
                @pick="(c) => setIn('outfit', 'topColor', c)"
                @live="(c) => liveIn('outfit', 'topColor', c)"
                @done="done"
              />
              <h4>{{ L('secondColor', 'Second colour') }}</h4>
              <SwatchRow
                :model-value="model.outfit.topColor2"
                :colors="CLOTH_COLORS"
                @pick="(c) => setIn('outfit', 'topColor2', c)"
                @live="(c) => liveIn('outfit', 'topColor2', c)"
                @done="done"
              />
              <h4>{{ L('patternTitle', 'Pattern') }}</h4>
              <div class="h3e-chiprow">
                <button
                  v-for="pt in PATTERNS"
                  :key="pt"
                  class="h3e-pill"
                  :class="{ on: model.outfit.topPattern === pt }"
                  @click="setIn('outfit', 'topPattern', pt)"
                >
                  {{ L('pattern.' + pt, PATTERN_LABELS[pt]) }}
                </button>
              </div>
            </section>
          </template>
          <template v-else-if="sub === 'bottom'">
            <section class="h3e-sec">
              <div class="h3e-cards h3e-cards-sm">
                <button
                  v-for="g in BOTTOMS"
                  :key="g.id"
                  class="h3e-card"
                  :class="{ on: model.outfit.bottom === g.id }"
                  @click="setIn('outfit', 'bottom', g.id)"
                >
                  <span class="h3e-card-icon">{{ g.icon }}</span>
                  <span class="h3e-card-label">{{ L('bottom.' + g.id, g.label) }}</span>
                </button>
              </div>
            </section>
            <section class="h3e-sec">
              <SwatchRow
                :model-value="model.outfit.bottomColor"
                :colors="CLOTH_COLORS"
                @pick="(c) => setIn('outfit', 'bottomColor', c)"
                @live="(c) => liveIn('outfit', 'bottomColor', c)"
                @done="done"
              />
            </section>
          </template>
          <template v-else-if="sub === 'shoes'">
            <section class="h3e-sec">
              <div class="h3e-cards h3e-cards-sm">
                <button
                  v-for="g in SHOES"
                  :key="g.id"
                  class="h3e-card"
                  :class="{ on: model.outfit.shoes === g.id }"
                  @click="setIn('outfit', 'shoes', g.id)"
                >
                  <span class="h3e-card-icon">{{ g.icon }}</span>
                  <span class="h3e-card-label">{{ L('shoes.' + g.id, g.label) }}</span>
                </button>
              </div>
            </section>
            <section class="h3e-sec">
              <SwatchRow
                :model-value="model.outfit.shoesColor"
                :colors="CLOTH_COLORS"
                @pick="(c) => setIn('outfit', 'shoesColor', c)"
                @live="(c) => liveIn('outfit', 'shoesColor', c)"
                @done="done"
              />
            </section>
          </template>
          <template v-else>
            <section class="h3e-sec">
              <div class="h3e-cards h3e-cards-sm">
                <button
                  v-for="g in ACCESSORIES"
                  :key="g.id"
                  class="h3e-card"
                  :class="{ on: model.outfit.accessories.includes(g.id) }"
                  @click="toggleAccessory(g.id)"
                >
                  <span class="h3e-card-icon">{{ g.icon }}</span>
                  <span class="h3e-card-label">{{ L('acc.' + g.id, g.label) }}</span>
                </button>
              </div>
            </section>
            <section class="h3e-sec">
              <h4>{{ L('metal', 'Metal & trim') }}</h4>
              <SwatchRow
                :model-value="model.outfit.metal"
                :colors="METAL_COLORS"
                @pick="(c) => setIn('outfit', 'metal', c)"
                @live="(c) => liveIn('outfit', 'metal', c)"
                @done="done"
              />
            </section>
          </template>
        </template>

        <!-- Pose & expression -->
        <template v-else-if="category === 'pose'">
          <section class="h3e-sec">
            <h4>{{ L('poseTitle', 'Pose') }}</h4>
            <div class="h3e-cards h3e-cards-sm">
              <button
                v-for="p in POSES"
                :key="p.id"
                class="h3e-card"
                :class="{ on: model.pose === p.id }"
                @click="setField('pose', p.id)"
              >
                <span class="h3e-card-icon">{{ p.icon }}</span>
                <span class="h3e-card-label">{{ L('pose.' + p.id, p.label) }}</span>
              </button>
            </div>
          </section>
          <section class="h3e-sec">
            <h4>{{ L('expression', 'Expression') }}</h4>
            <div class="h3e-cards h3e-cards-sm">
              <button
                v-for="e in EXPRESSIONS"
                :key="e.id"
                class="h3e-card"
                :class="{ on: model.expression === e.id }"
                @click="setField('expression', e.id)"
              >
                <span class="h3e-card-icon">{{ e.icon }}</span>
                <span class="h3e-card-label">{{ L('expr.' + e.id, e.label) }}</span>
              </button>
            </div>
          </section>
        </template>

        <!-- Studio -->
        <template v-else>
          <section class="h3e-sec">
            <h4>{{ L('lighting', 'Lighting') }}</h4>
            <div class="h3e-cards h3e-cards-sm">
              <button
                v-for="lp in LIGHT_PRESETS"
                :key="lp.id"
                class="h3e-card h3e-light-card"
                :class="{ on: model.light === lp.id }"
                :style="{ '--bg1': lp.bg[0], '--bg2': lp.bg[1] }"
                @click="setField('light', lp.id)"
              >
                <span class="h3e-card-icon">{{ lp.icon }}</span>
                <span class="h3e-card-label">{{ L('light.' + lp.id, lp.label) }}</span>
              </button>
            </div>
          </section>
          <section class="h3e-sec">
            <h4>{{ L('qualityTitle', 'Render quality') }}</h4>
            <div class="seg h3e-seg">
              <button
                v-for="qo in QUALITIES"
                :key="qo.id"
                class="seg-btn"
                :class="{ on: quality === qo.id, active: quality === qo.id }"
                @click="setQuality(qo.id)"
              >
                {{ L('quality.' + qo.id, qo.label) }}
              </button>
            </div>
            <p class="h3e-hint">
              {{
                L(
                  'qualityHint',
                  'High adds ambient occlusion, 4× anti-aliasing and full hair density.'
                )
              }}
            </p>
          </section>
          <section class="h3e-sec">
            <h4>{{ L('photo', 'Save a photo') }}</h4>
            <div class="h3e-row">
              <button class="btn btn-soft btn-sm" @click="savePhoto('portrait')">
                🖼 {{ L('photoPortrait', 'Portrait') }}
              </button>
              <button class="btn btn-soft btn-sm" @click="savePhoto('full')">
                🧍 {{ L('photoFull', 'Full body') }}
              </button>
              <button class="btn btn-soft btn-sm" @click="savePhoto('current')">
                🎥 {{ L('photoView', 'This view') }}
              </button>
            </div>
            <label class="h3e-toggle">
              <input v-model="photoTransparent" type="checkbox" class="switch" />
              {{ L('transparent', 'Transparent background') }}
            </label>
          </section>
          <section class="h3e-sec">
            <h4>{{ L('credits', 'About this model') }}</h4>
            <p class="h3e-hint">
              {{
                L(
                  'creditsText',
                  'Human base mesh, morph targets and rig from MakeHuman (CC0). Hair, skin, eyes and clothing are generated procedurally.'
                )
              }}
            </p>
          </section>
        </template>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, shallowRef } from 'vue'
import { useI18n } from '../../../i18n'
import { HumanStage } from './HumanStage'
import H3Slider from './H3Slider.vue'
import SwatchRow from '../SwatchRow.vue'
import { BODY_GROUPS, FACE_GROUPS, MACRO_SLIDERS, SLIDER_BY_ID } from './catalog'
import { HAIR_STYLES, FRINGES, BROW_STYLES, BEARD_STYLES } from './hairStyles'
import { TOPS, BOTTOMS, SHOES, ACCESSORIES } from './wardrobe'
import { PATTERNS } from './fabricMaterial'
import { POSES, EXPRESSIONS } from './poses'
import { LIGHT_PRESETS } from './studio'
import { REGION_BY_GROUP } from './regions'
import {
  BLUSH_COLORS,
  CLOTH_COLORS,
  EYE_COLORS,
  FANTASY_EYES,
  FANTASY_HAIR,
  HAIR_COLORS,
  LIP_COLORS,
  METAL_COLORS,
  PRESETS_3D,
  SHADOW_COLORS,
  SKIN_TONES,
  darken,
  inheritModel3D,
  randomizeModel3D,
  resetShape
} from './model3d'
import { DEFAULT_HUMAN3D, defaultModel3D } from '../../../../../shared/character3d'

// The 3D character editor (Character view → 🧊 3D style). Owns a HumanStage
// (Three.js) and the inspector; every edit goes through the parent's
// liveEdit / endEdit / commit so undo/redo and autosave work exactly as in
// the 2D styles. See human3d/ for the engine and docs/CHARACTER_VIEW_PROPOSAL.md.

const props = defineProps({
  model: { type: Object, required: true },
  liveEdit: { type: Function, required: true },
  endEdit: { type: Function, required: true },
  commit: { type: Function, required: true },
  undo: { type: Function, required: true },
  redo: { type: Function, required: true },
  canUndo: { type: Boolean, default: false },
  canRedo: { type: Boolean, default: false },
  portraitBusy: { type: Boolean, default: false },
  portraitDone: { type: Boolean, default: false },
  fileBase: { type: String, default: 'character' },
  /** Parents' 3D looks for inheritance: [{ name, model }]. */
  parents: { type: Array, default: () => [] }
})
const emit = defineEmits(['set-portrait', 'thumb', 'ready'])
const { t } = useI18n()

/** i18n with an English fallback (keys live under `human3d.`). */
function L(key, fallback) {
  const k = 'human3d.' + key
  const s = t(k)
  return s === k ? fallback : s
}

const CATEGORIES = [
  { id: 'presets', icon: '✨', label: 'Presets' },
  { id: 'body', icon: '🧍', label: 'Body' },
  { id: 'face', icon: '🙂', label: 'Face' },
  { id: 'skin', icon: '🎨', label: 'Skin' },
  { id: 'makeup', icon: '💄', label: 'Makeup' },
  { id: 'hair', icon: '💇', label: 'Hair' },
  { id: 'eyes', icon: '👁', label: 'Eyes' },
  { id: 'outfit', icon: '👕', label: 'Outfit' },
  { id: 'pose', icon: '🎭', label: 'Pose' },
  { id: 'studio', icon: '💡', label: 'Studio' }
]
const CAMERAS = [
  { id: 'full', icon: '🧍', label: 'Full body' },
  { id: 'torso', icon: '👕', label: 'Upper body' },
  { id: 'portrait', icon: '🖼', label: 'Portrait' },
  { id: 'eyes', icon: '👁', label: 'Close-up' }
]
const QUALITIES = [
  { id: 'high', label: 'High' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'fast', label: 'Fast' }
]
const ANCESTRY = [
  { key: 'african', label: 'African', color: '#8a5a3a' },
  { key: 'asian', label: 'East Asian', color: '#d9a066' },
  { key: 'caucasian', label: 'European', color: '#e8c4a8' }
]
const SKIN_SLIDERS = [
  { key: 'flush', label: 'Rosiness' },
  { key: 'freckles', label: 'Freckles' },
  { key: 'moles', label: 'Moles & beauty marks' },
  { key: 'circles', label: 'Under-eye shadows' },
  { key: 'wrinkles', label: 'Lines & wrinkles' },
  { key: 'sheen', label: 'Dewiness' },
  { key: 'detail', label: 'Pores & texture' },
  { key: 'sss', label: 'Translucency' }
]
const MAKEUP = [
  {
    id: 'lips',
    icon: '💋',
    label: 'Lips',
    color: 'lipColor',
    palette: LIP_COLORS,
    sliders: [
      { key: 'lips', label: 'Lipstick' },
      { key: 'gloss', label: 'Gloss' }
    ]
  },
  {
    id: 'eyes',
    icon: '✨',
    label: 'Eyes',
    color: 'shadowColor',
    palette: SHADOW_COLORS,
    sliders: [
      { key: 'shadow', label: 'Eyeshadow' },
      { key: 'liner', label: 'Eyeliner' },
      { key: 'mascara', label: 'Mascara' }
    ]
  },
  {
    id: 'cheeks',
    icon: '🌸',
    label: 'Cheeks',
    color: 'blushColor',
    palette: BLUSH_COLORS,
    sliders: [{ key: 'blush', label: 'Blush' }]
  }
]
const HAIR_SLIDERS = [
  { key: 'length', label: 'Length', ends: ['Short', 'Long'] },
  { key: 'volume', label: 'Volume', ends: ['Flat', 'Full'] },
  { key: 'curl', label: 'Wave & curl', ends: ['Straight', 'Coily'] },
  { key: 'frizz', label: 'Frizz' },
  { key: 'part', label: 'Parting', ends: ['Left', 'Right'] },
  { key: 'density', label: 'Density' },
  { key: 'gloss', label: 'Shine' },
  { key: 'grey', label: 'Grey hair' }
]
const EYE_SLIDERS = [
  { key: 'pupil', label: 'Pupil size' },
  { key: 'pattern', label: 'Iris detail' },
  { key: 'scleraRed', label: 'Redness' },
  { key: 'lashLength', label: 'Lash length' },
  { key: 'lashDensity', label: 'Lash density' }
]
const PATTERN_LABELS = {
  solid: 'Solid',
  stripes: 'Stripes',
  pinstripe: 'Pinstripe',
  plaid: 'Plaid',
  dots: 'Polka dots',
  gradient: 'Gradient',
  camo: 'Camo'
}
const LOCKS = [
  { id: 'body', label: 'Body' },
  { id: 'face', label: 'Face' },
  { id: 'skin', label: 'Skin' },
  { id: 'hair', label: 'Hair' },
  { id: 'eyes', label: 'Eyes' },
  { id: 'makeup', label: 'Makeup' },
  { id: 'outfit', label: 'Outfit' }
]

// ── Navigation ──────────────────────────────────────────────────────────────
const category = ref('face')
const sub = ref('eyes')
const search = ref('')
const symmetric = ref(true)
const locks = ref([])

const currentCategory = computed(
  () => CATEGORIES.find((c) => c.id === category.value) || CATEGORIES[0]
)

const subTabs = computed(() => {
  switch (category.value) {
    case 'face':
      return FACE_GROUPS.map((g) => ({
        id: g.id,
        icon: g.icon,
        label: L('group.' + g.id, g.label)
      }))
    case 'body':
      return [{ id: 'shape', icon: '📐', label: L('group.shape', 'Proportions') }].concat(
        BODY_GROUPS.map((g) => ({ id: g.id, icon: g.icon, label: L('group.' + g.id, g.label) }))
      )
    case 'hair':
      return [
        { id: 'hair', icon: '💇', label: L('sub.hair', 'Hair') },
        { id: 'brows', icon: '〰', label: L('sub.brows', 'Brows') },
        { id: 'beard', icon: '🧔', label: L('sub.beard', 'Beard') }
      ]
    case 'outfit':
      return [
        { id: 'top', icon: '👕', label: L('sub.top', 'Top') },
        { id: 'bottom', icon: '👖', label: L('sub.bottom', 'Bottom') },
        { id: 'shoes', icon: '👟', label: L('sub.shoes', 'Shoes') },
        { id: 'acc', icon: '👓', label: L('sub.acc', 'Accessories') }
      ]
    default:
      return []
  }
})

const subLabel = computed(() => subTabs.value.find((s) => s.id === sub.value)?.label || '')

const FIRST_SUB = { face: 'eyes', body: 'shape', hair: 'hair', outfit: 'top' }
const CATEGORY_FOCUS = {
  presets: 'full',
  body: 'full',
  skin: 'portrait',
  makeup: 'portrait',
  hair: 'hair',
  eyes: 'eyes',
  outfit: 'full',
  pose: 'full',
  studio: 'full'
}

function selectCategory(id) {
  if (category.value === id) return
  category.value = id
  search.value = ''
  sub.value = FIRST_SUB[id] || ''
  focusFor(id, sub.value)
}

function selectSub(id) {
  sub.value = id
  search.value = ''
  focusFor(category.value, id)
}

function focusFor(cat, s) {
  if (!stage.value) return
  if ((cat === 'face' || (cat === 'body' && s !== 'shape')) && REGION_BY_GROUP.get(s)) {
    stage.value.focus(REGION_BY_GROUP.get(s).id)
  } else if (cat === 'hair' && s === 'brows') stage.value.focus('forehead')
  else if (cat === 'hair' && s === 'beard') stage.value.focus('jaw')
  else if (cat === 'outfit' && s === 'acc') stage.value.focus('portrait')
  else if (cat === 'outfit' && s === 'shoes') stage.value.focus('legs')
  else stage.value.focus(CATEGORY_FOCUS[cat] || 'full')
}

const q = (s) => s.toLowerCase()
function matches(slider) {
  if (!search.value) return true
  return q(sliderLabel(slider.id)).includes(q(search.value))
}
const visibleFaceGroups = computed(() => {
  if (search.value) {
    return FACE_GROUPS.map((g) => ({ ...g, sliders: g.sliders.filter(matches) })).filter(
      (g) => g.sliders.length
    )
  }
  return FACE_GROUPS.filter((g) => g.id === sub.value)
})
const visibleBodyGroups = computed(() => {
  if (search.value) {
    return BODY_GROUPS.map((g) => ({ ...g, sliders: g.sliders.filter(matches) })).filter(
      (g) => g.sliders.length
    )
  }
  return BODY_GROUPS.filter((g) => g.id === sub.value)
})

function sliderLabel(id) {
  const s = SLIDER_BY_ID.get(id)
  if (!s) return id || ''
  return L('slider.' + id, s.label)
}

// ── Edits (all through the parent's undo-aware draft) ────────────────────────
function live(fn) {
  props.liveEdit(fn)
}
function done() {
  props.endEdit()
}
function set(fn) {
  props.commit(fn)
}
function setField(key, value) {
  set((m) => {
    m[key] = value
  })
}
function setIn(section, key, value) {
  set((m) => {
    m[section][key] = value
  })
}
function liveIn(section, key, value) {
  live((m) => {
    m[section][key] = value
  })
}
function liveBody(key, v) {
  live((m) => {
    m.body[key] = v
  })
}
function shapeValue(id) {
  return props.model.shape[id] || 0
}
function liveShape(id, v) {
  live((m) => {
    const x = Math.max(-1, Math.min(1, Math.round(v * 100) / 100))
    if (Math.abs(x) < 0.005) delete m.shape[id]
    else m.shape[id] = x
  })
}

function heritageShare(key) {
  const b = props.model.body
  const sum = b.african + b.asian + b.caucasian || 1
  return b[key] / sum
}
/** Move one share; the other two keep their ratio and fill the rest. */
function liveHeritage(key, v) {
  live((m) => {
    const keys = ['african', 'asian', 'caucasian']
    const others = keys.filter((k) => k !== key)
    const sum = m.body.african + m.body.asian + m.body.caucasian || 1
    const rest = others.reduce((a, k) => a + m.body[k] / sum, 0)
    const left = 1 - v
    for (const k of others) m.body[k] = rest > 1e-4 ? (m.body[k] / sum / rest) * left : left / 2
    m.body[key] = v
  })
}

const pct = (v) => Math.round(v * 100) + '%'
function fmtAge(v) {
  return Math.round(v) + ' ' + L('years', 'y')
}

function pickHairColor(c) {
  set((m) => {
    m.hair.color = c
    // brows/beard follow unless the user set them apart
    m.brows.color = darken(c, 0.15)
    m.beard.color = c
  })
}
function pickIris(c) {
  set((m) => {
    m.eyes.iris = c
    m.eyes.irisOuter = darken(c, 0.45)
  })
}
function toggleTip(e) {
  setIn('hair', 'tip', e.target.checked ? HAIR_COLORS[8] : '')
}
function toggleHighlight(e) {
  setIn('hair', 'highlight', e.target.checked ? HAIR_COLORS[7] : '')
}
function toggleHetero(e) {
  setIn('eyes', 'irisRight', e.target.checked ? EYE_COLORS[9] : '')
}
function toggleAccessory(id) {
  set((m) => {
    const list = m.outfit.accessories
    const i = list.indexOf(id)
    if (i >= 0) list.splice(i, 1)
    else {
      // one hat at a time
      const HATS = ['beanie', 'cap', 'crown', 'headband']
      const EYEWEAR = ['glasses', 'sunglasses']
      for (const group of [HATS, EYEWEAR]) {
        if (group.includes(id)) m.outfit.accessories = list.filter((x) => !group.includes(x))
      }
      m.outfit.accessories.push(id)
    }
  })
}
function toggleLock(id) {
  const i = locks.value.indexOf(id)
  if (i >= 0) locks.value.splice(i, 1)
  else locks.value.push(id)
}

function replaceModel(next) {
  set((m) => {
    for (const k of Object.keys(next)) m[k] = next[k]
  })
}

function randomize(only) {
  const all = ['body', 'face', 'skin', 'hair', 'eyes', 'makeup', 'outfit']
  const lockList = only ? all.filter((k) => k !== only) : locks.value
  const next = randomizeModel3D(JSON.parse(JSON.stringify(props.model)), Math.random, lockList)
  replaceModel(next)
  flash()
}

function randomizeGroup() {
  const groups = category.value === 'face' ? FACE_GROUPS : BODY_GROUPS
  const g = groups.find((x) => x.id === sub.value)
  if (!g) {
    if (category.value === 'body') randomize('body')
    return
  }
  set((m) => {
    for (const s of g.sliders) {
      delete m.shape[s.id]
      if (Math.random() < 0.55) {
        const v = s.unipolar ? Math.random() * 0.6 : (Math.random() + Math.random() - 1) * 0.8
        if (Math.abs(v) > 0.04) m.shape[s.id] = Math.round(v * 100) / 100
      }
    }
  })
}

function resetGroup() {
  set((m) => resetShape(m, sub.value))
}
function resetFace() {
  set((m) => {
    for (const g of FACE_GROUPS) resetShape(m, g.id)
  })
}
function resetAll() {
  replaceModel(defaultModel3D())
}

const resemblance = ref(0.8)
function setResemblance(v) {
  resemblance.value = v
}
function noop() {}
function inherit() {
  const next = inheritModel3D(
    props.parents.map((x) => x.model),
    JSON.parse(JSON.stringify(props.model)),
    { resemblance: resemblance.value }
  )
  replaceModel(next)
  flash()
}

function applyPreset(p) {
  set((m) => p.apply(m))
  flash()
}

// ── Stage ───────────────────────────────────────────────────────────────────
const stageHost = ref(null)
const stage = shallowRef(null)
const loading = ref(true)
const error = ref('')
const flashOn = ref(false)
const turntable = ref(false)
const gaze = ref(true)
const sculptMode = ref(true)
const photoTransparent = ref(false)

function readPref(key, fb) {
  try {
    return localStorage.getItem(key) || fb
  } catch {
    return fb
  }
}
function writePref(key, v) {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* private mode */
  }
}
const quality = ref(readPref('ft.character3d.quality', 'high'))
function setQuality(qv) {
  quality.value = qv
  writePref('ft.character3d.quality', qv)
  stage.value?.setQuality(qv)
}
function toggleTurntable() {
  turntable.value = !turntable.value
  if (stage.value) stage.value.turntable = turntable.value
}
function toggleGaze() {
  gaze.value = !gaze.value
  if (stage.value) stage.value.lookAtCamera = gaze.value
}

function flash() {
  flashOn.value = true
  setTimeout(() => (flashOn.value = false), 380)
}

let applyRaf = 0
let thumbTimer = 0
function plainModel() {
  return JSON.parse(JSON.stringify(props.model))
}
watch(
  () => JSON.stringify(props.model),
  () => {
    if (!stage.value) return
    cancelAnimationFrame(applyRaf)
    applyRaf = requestAnimationFrame(() => stage.value?.apply(plainModel()))
    scheduleThumb()
  }
)

function scheduleThumb() {
  clearTimeout(thumbTimer)
  thumbTimer = setTimeout(() => {
    if (!stage.value || loading.value) return
    try {
      emit('thumb', stage.value.snapshot({ size: 160, framing: 'portrait', type: 'image/webp' }))
    } catch {
      /* a lost context mid-snapshot — the next edit retries */
    }
  }, 1600)
}

onMounted(() => {
  const s = new HumanStage(stageHost.value, { quality: quality.value })
  s.lookAtCamera = gaze.value
  s.onReady = () => {
    s.apply(plainModel(), true)
    s.focus('full', true)
    // a cinematic first look: glide to the face
    setTimeout(() => focusFor(category.value, sub.value), 250)
    loading.value = false
    emit('ready')
    scheduleThumb()
  }
  s.onError = (e) => {
    error.value = String(e?.message || e)
  }
  stage.value = s
})

onBeforeUnmount(() => {
  cancelAnimationFrame(applyRaf)
  clearTimeout(thumbTimer)
  stage.value?.dispose()
  stage.value = null
})

// ── Direct manipulation: hover regions, click to edit, drag to sculpt ───────
const hoverRegion = ref(null)
const hoverXY = ref({ x: 0, y: 0 })
const drag = ref(null)
let downAt = null

function regionCategory(r) {
  if (FACE_GROUPS.some((g) => g.id === r.group)) return ['face', r.group]
  if (BODY_GROUPS.some((g) => g.id === r.group)) return ['body', r.group]
  return [r.group, '']
}

function onStageMove(e) {
  const s = stage.value
  if (!s || loading.value) return
  const rect = stageHost.value.getBoundingClientRect()
  hoverXY.value = { x: e.clientX - rect.left + 16, y: e.clientY - rect.top + 12 }
  if (drag.value) {
    const d = drag.value
    const dx = (e.clientX - d.x0) / 220
    const dy = -(e.clientY - d.y0) / 220
    live((m) => {
      for (const [id, start, delta] of [
        [d.region.sculptX, d.sx, dx],
        [d.region.sculptY, d.sy, dy]
      ]) {
        if (!id) continue
        const v = Math.max(-1, Math.min(1, Math.round((start + delta) * 100) / 100))
        if (Math.abs(v) < 0.005) delete m.shape[id]
        else m.shape[id] = v
      }
    })
    return
  }
  if (e.buttons) return
  const r = s.pick(e.clientX, e.clientY)
  if (r !== hoverRegion.value) {
    hoverRegion.value = r
    s.setHighlight(r)
  }
}

function onStageDown(e) {
  const s = stage.value
  if (!s || loading.value || e.button !== 0) return
  downAt = { x: e.clientX, y: e.clientY, region: hoverRegion.value }
  const r = hoverRegion.value
  if (sculptMode.value && r && (r.sculptX || r.sculptY)) {
    // claim the drag before OrbitControls sees it
    s.controls.enabled = false
    drag.value = {
      region: r,
      x0: e.clientX,
      y0: e.clientY,
      sx: shapeValue(r.sculptX),
      sy: shapeValue(r.sculptY)
    }
    stageHost.value.setPointerCapture?.(e.pointerId)
  }
}

function onStageUp(e) {
  const s = stage.value
  const moved = downAt ? Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) : 99
  if (drag.value) {
    drag.value = null
    if (s) s.controls.enabled = true
    done()
  }
  if (downAt?.region && moved < 4) {
    const [cat, sb] = regionCategory(downAt.region)
    category.value = cat
    sub.value = sb || FIRST_SUB[cat] || ''
    search.value = ''
    focusFor(cat, sub.value)
  }
  downAt = null
}

function onStageLeave() {
  if (drag.value) return
  hoverRegion.value = null
  stage.value?.setHighlight(null)
}

// ── Output ──────────────────────────────────────────────────────────────────
function savePhoto(framing) {
  const s = stage.value
  if (!s) return
  flash()
  const url = s.snapshot({
    size: 2048,
    framing,
    transparent: photoTransparent.value,
    type: 'image/png'
  })
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.fileBase}-${framing}.png`
  a.click()
}

/** For "Set as portrait" (the parent pushes it through the images pipeline). */
function snapshot(opts) {
  return stage.value?.snapshot(opts) || ''
}

function onKey(key) {
  if (key === 'r') randomize()
}

defineExpose({ snapshot, randomize, flash, onKey })
</script>

<style scoped>
.h3e {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  display: grid;
  grid-template-columns: 76px 1fr 340px;
  background: var(--bg);
}

/* ── Rail ── */
.h3e-rail {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 6px;
  overflow-y: auto;
  border-right: 1px solid var(--border);
  background: var(--glass-strong);
}

.h3e-cat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 2px 7px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
  position: relative;
  transition:
    background 0.18s,
    color 0.18s;
}

.h3e-cat:hover {
  background: var(--hover);
  color: var(--t1);
}

.h3e-cat.on {
  background: rgba(var(--accent-rgb), 0.14);
  color: var(--accent);
}

.h3e-cat.on::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--accent);
}

.h3e-cat-icon {
  font-size: 20px;
  line-height: 1;
  filter: saturate(0.9);
}

/* ── Stage ── */
.h3e-stage {
  position: relative;
  min-width: 0;
  background: #0d1016;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
}

.h3e-stage:active {
  cursor: grabbing;
}

.h3e-stage.can-sculpt {
  cursor: move;
}

.h3e-stage.sculpting {
  cursor: grabbing;
}

.h3e-stage :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

.h3e-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at 50% 45%, #1e2430, #0b0d12 70%);
  z-index: 5;
}

.h3e-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  color: #c9cfdb;
  font-size: 13px;
  text-align: center;
  max-width: 320px;
}

.h3e-loader code {
  font-size: 11px;
  opacity: 0.7;
}

.h3e-silhouette {
  font-size: 64px;
  filter: grayscale(1) brightness(0.6);
  animation: h3e-breathe 2.4s ease-in-out infinite;
}

@keyframes h3e-breathe {
  50% {
    transform: scale(1.06);
    filter: grayscale(1) brightness(0.9);
  }
}

.h3e-loader-bar {
  width: 180px;
  height: 3px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.h3e-loader-bar span {
  display: block;
  width: 40%;
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
  animation: h3e-slide 1.2s ease-in-out infinite;
}

@keyframes h3e-slide {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(250%);
  }
}

.h3e-crumb {
  position: absolute;
  top: 14px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px;
  border-radius: 12px;
  background: rgba(10, 12, 18, 0.55);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #e8ecf4;
  font-size: 12.5px;
  font-weight: 600;
  pointer-events: none;
  letter-spacing: 0.01em;
}

.h3e-crumb-sep {
  opacity: 0.4;
}

.h3e-crumb-sub {
  color: var(--accent);
}

.h3e-topright {
  position: absolute;
  top: 12px;
  right: 14px;
  display: flex;
  gap: 8px;
}

.h3e-chips {
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 12px;
  background: rgba(10, 12, 18, 0.55);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.h3e-chip {
  width: 30px;
  height: 28px;
  border: none;
  border-radius: 9px;
  background: transparent;
  font-size: 14px;
  cursor: pointer;
  transition:
    background 0.15s,
    transform 0.15s;
}

.h3e-chip:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}

.h3e-chip.on {
  background: rgba(var(--accent-rgb), 0.35);
  box-shadow: inset 0 0 0 1px rgba(var(--accent-rgb), 0.8);
}

.h3e-hover-tag {
  position: absolute;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(10, 12, 18, 0.75);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(var(--accent-rgb), 0.5);
  color: #fff;
  font-size: 12px;
  pointer-events: none;
  white-space: nowrap;
}

.h3e-hover-tag span {
  font-size: 10.5px;
  color: #aeb6c6;
}

.h3e-sculpt-hud {
  position: absolute;
  top: 56px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 14px;
  padding: 7px 14px;
  border-radius: 12px;
  background: rgba(var(--accent-rgb), 0.85);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  pointer-events: none;
  box-shadow: 0 6px 24px rgba(var(--accent-rgb), 0.4);
}

.h3e-expr {
  position: absolute;
  left: 16px;
  bottom: 18px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  border-radius: 14px;
  background: rgba(10, 12, 18, 0.5);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.07);
  max-height: calc(100% - 120px);
  overflow-y: auto;
  scrollbar-width: none;
}

.h3e-expr-btn {
  width: 34px;
  height: 32px;
  border: none;
  border-radius: 10px;
  background: transparent;
  font-size: 17px;
  cursor: pointer;
  transition: transform 0.15s cubic-bezier(0.2, 0.9, 0.3, 1.4);
}

.h3e-expr-btn:hover {
  transform: scale(1.2);
}

.h3e-expr-btn.on {
  background: rgba(var(--accent-rgb), 0.35);
}

.h3e-toolbar {
  position: absolute;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 5px;
  border-radius: 16px;
  background: rgba(10, 12, 18, 0.62);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.09);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.45);
}

.h3e-tool {
  min-width: 36px;
  height: 34px;
  padding: 0 8px;
  border: none;
  border-radius: 11px;
  background: transparent;
  color: #e8ecf4;
  font-family: var(--font);
  font-size: 15px;
  cursor: pointer;
  transition:
    background 0.15s,
    transform 0.15s;
}

.h3e-tool:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.h3e-tool:disabled {
  opacity: 0.35;
  cursor: default;
}

.h3e-tool.on {
  background: rgba(var(--accent-rgb), 0.3);
}

.h3e-dice:hover {
  transform: rotate(-12deg) scale(1.08);
}

.h3e-primary {
  white-space: nowrap;
  background: var(--accent);
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  padding: 0 14px;
  margin-left: 2px;
}

.h3e-primary:hover:not(:disabled) {
  background: var(--accent);
  filter: brightness(1.1);
}

.h3e-tool-sep {
  width: 1px;
  height: 20px;
  margin: 0 3px;
  background: rgba(255, 255, 255, 0.12);
}

.h3e-flash {
  position: absolute;
  inset: 0;
  background: #fff;
  pointer-events: none;
  animation: h3e-flash 0.38s ease-out forwards;
}

@keyframes h3e-flash {
  from {
    opacity: 0.35;
  }
  to {
    opacity: 0;
  }
}

/* ── Panel ── */
.h3e-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-left: 1px solid var(--border);
  background: var(--glass-strong);
}

.h3e-panel-head {
  padding: 14px 14px 8px;
  border-bottom: 1px solid var(--border);
}

.h3e-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 700;
  color: var(--t1);
}

.h3e-subtabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.h3e-subtab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 9px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
}

.h3e-subtab:hover {
  color: var(--t1);
  border-color: rgba(var(--accent-rgb), 0.5);
}

.h3e-subtab.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.h3e-search-row {
  display: flex;
  gap: 4px;
}

.h3e-search {
  flex: 1 1 auto;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12px;
  outline: none;
}

.h3e-search:focus {
  border-color: var(--accent);
}

.h3e-mini {
  width: 30px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--elevated);
  color: var(--t2);
  cursor: pointer;
  font-size: 13px;
}

.h3e-mini:hover,
.h3e-mini.on {
  color: var(--accent);
  border-color: var(--accent);
}

.h3e-panel-body {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 8px 24px;
}

.h3e-sec {
  padding: 6px 4px 10px;
  border-bottom: 1px solid var(--border);
}

.h3e-sec:last-child {
  border-bottom: none;
}

.h3e-sec h4 {
  margin: 6px 6px 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--t3);
}

.h3e-hint {
  margin: 0 6px 8px;
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--t3);
}

.h3e-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 0 4px;
}

.h3e-cards-sm {
  grid-template-columns: repeat(4, 1fr);
}

.h3e-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 10px 4px 8px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  cursor: pointer;
  transition:
    transform 0.16s cubic-bezier(0.2, 0.9, 0.3, 1.4),
    border-color 0.15s,
    background 0.15s,
    box-shadow 0.15s;
}

.h3e-card:hover {
  transform: translateY(-2px);
  border-color: rgba(var(--accent-rgb), 0.55);
  color: var(--t1);
}

.h3e-card.on {
  border-color: var(--accent);
  background: rgba(var(--accent-rgb), 0.12);
  color: var(--t1);
  box-shadow: 0 0 0 1px var(--accent) inset;
}

.h3e-card-icon {
  font-size: 22px;
  line-height: 1.1;
}

.h3e-card-label {
  font-size: 10.5px;
  font-weight: 600;
  text-align: center;
  line-height: 1.2;
}

.h3e-light-card {
  background: linear-gradient(160deg, var(--bg1), var(--bg2));
  color: #f2f4f8;
  border-color: rgba(255, 255, 255, 0.12);
}

.h3e-light-card:hover {
  color: #fff;
}

.h3e-chiprow {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 0 6px 6px;
}

.h3e-pill {
  padding: 5px 11px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
}

.h3e-pill:hover {
  color: var(--t1);
  border-color: rgba(var(--accent-rgb), 0.5);
}

.h3e-pill.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.h3e-tone-ramp {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
  padding: 0 6px 8px;
}

.h3e-tone {
  aspect-ratio: 1;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: inset 0 -3px 6px rgba(0, 0, 0, 0.18);
  transition: transform 0.14s;
}

.h3e-tone:hover {
  transform: scale(1.12);
}

.h3e-tone.on {
  border-color: var(--accent);
  box-shadow:
    0 0 0 2px var(--bg),
    0 0 0 4px var(--accent);
}

.h3e-heritage-bar {
  display: flex;
  height: 8px;
  margin: 0 8px 8px;
  border-radius: 6px;
  overflow: hidden;
}

.h3e-heritage-bar span {
  transition: flex 0.2s;
}

.h3e-pair {
  padding: 4px 0;
  border-radius: 10px;
}

.h3e-pair-label {
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--t1);
}

.h3e-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 4px;
  font-size: 12px;
  color: var(--t2);
  cursor: pointer;
}

.h3e-locks {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 0 6px 10px;
}

.h3e-lock {
  padding: 4px 9px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 11px;
  cursor: pointer;
}

.h3e-lock.on {
  border-color: var(--amber, #e0a030);
  color: var(--t1);
}

.h3e-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 6px 6px;
}

.h3e-wide {
  margin: 0 6px;
  width: calc(100% - 12px);
}

.h3e-seg {
  margin: 0 6px 8px;
}

.h3e-fade-enter-active,
.h3e-fade-leave-active {
  transition: opacity 0.25s;
}

.h3e-fade-enter-from,
.h3e-fade-leave-to {
  opacity: 0;
}

@media (max-width: 1100px) {
  .h3e {
    grid-template-columns: 64px 1fr 290px;
  }
  .h3e-cat-label {
    display: none;
  }
}

@media (max-width: 760px) {
  .h3e {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr 45%;
  }
  .h3e-rail {
    flex-direction: row;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
  .h3e-cat.on::before {
    display: none;
  }
  .h3e-panel {
    border-left: none;
    border-top: 1px solid var(--border);
  }
  .h3e-expr {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .h3e-silhouette,
  .h3e-loader-bar span {
    animation: none;
  }
}
</style>
