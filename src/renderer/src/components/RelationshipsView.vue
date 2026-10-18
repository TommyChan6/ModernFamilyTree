<template>
  <div class="rv">
    <!-- Toolbar -->
    <div class="rv-toolbar">
      <div class="rv-heading">
        <span class="rv-title">{{ t('rail.relationships') }}</span>
        <span class="rv-count">{{ rows.length }}</span>
      </div>

      <div class="rv-controls">
        <div class="rv-search">
          <SearchField v-model="query" :placeholder="t('relsView.searchPh')" />
        </div>

        <div class="rv-chips">
          <button
            v-for="chip in chips"
            :key="chip.id"
            class="rv-chip"
            :class="{ active: typeFilter === chip.id }"
            :style="{ '--chip-c': chip.color }"
            @click="typeFilter = chip.id"
          >
            <span class="rv-chip-dot"></span>
            <span>{{ chip.label }}</span>
            <span class="rv-chip-count">{{ chip.count }}</span>
          </button>
          <Transition name="rv-chip-pop">
            <button
              v-if="issueCount > 0"
              class="rv-chip rv-chip-issues"
              :class="{ active: typeFilter === 'issues' }"
              :title="t('relsView.issuesHint')"
              @click="typeFilter = 'issues'"
            >
              <UiIcon name="triangle-alert" :size="14" />
              <span>{{ t('relsView.issues') }}</span>
              <span class="rv-chip-count">{{ issueCount }}</span>
            </button>
          </Transition>
        </div>

        <button
          class="rv-filter-btn"
          :class="{ active: filtersOpen || activeFilterCount > 0 }"
          @click="filtersOpen = !filtersOpen"
        >
          <UiIcon name="sliders-horizontal" :size="16" />
          {{ t('relsView.filters') }}
          <Transition name="rv-badge">
            <span v-if="activeFilterCount" class="rv-filter-badge">{{ activeFilterCount }}</span>
          </Transition>
        </button>

        <button
          v-if="store.caps.customRelTypes"
          class="rv-filter-btn"
          :class="{ active: typesOpen }"
          :title="t('relsView.manageTypes')"
          @click="typesOpen = true"
        >
          <UiIcon name="settings" :size="16" />
          {{ t('relsView.types') }}
        </button>

        <button class="btn btn-primary rv-add-btn" @click="toggleAdd">
          <UiIcon :name="editing?.id === 'new' ? 'x' : 'plus'" :size="16" />
          {{ editing?.id === 'new' ? t('dialog.cancel') : t('relsView.addRel') }}
        </button>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="rv-fade">
        <RelTypesPanel v-if="typesOpen" @close="typesOpen = false" />
      </Transition>
    </Teleport>

    <!-- Secondary facet panel: slides open beneath the toolbar -->
    <div class="rv-filters" :class="{ open: filtersOpen }">
      <div class="rv-filters-inner">
        <div class="rv-facet">
          <span class="rv-facet-label">{{ t('relsView.dates') }}</span>
          <div class="rv-facet-chips">
            <button
              class="rv-fchip"
              :class="{ on: dateFilter === 'all' }"
              @click="dateFilter = 'all'"
            >
              {{ t('relsView.any') }}
            </button>
            <button
              class="rv-fchip"
              :class="{ on: dateFilter === 'dated' }"
              @click="dateFilter = dateFilter === 'dated' ? 'all' : 'dated'"
            >
              <UiIcon name="calendar" :size="14" />
              {{ t('relsView.dated') }}
            </button>
            <button
              class="rv-fchip"
              :class="{ on: dateFilter === 'undated' }"
              @click="dateFilter = dateFilter === 'undated' ? 'all' : 'undated'"
            >
              <UiIcon name="circle-dashed" :size="14" />
              {{ t('relsView.undated') }}
            </button>
          </div>
        </div>

        <div v-if="hasSpouses" class="rv-facet">
          <span class="rv-facet-label">{{ t('relsView.marriage') }}</span>
          <div class="rv-facet-chips">
            <button
              class="rv-fchip"
              :class="{ on: marriageFilter === 'all' }"
              @click="marriageFilter = 'all'"
            >
              {{ t('relsView.any') }}
            </button>
            <button
              class="rv-fchip m-current"
              :class="{ on: marriageFilter === 'current' }"
              @click="marriageFilter = marriageFilter === 'current' ? 'all' : 'current'"
            >
              <UiIcon name="heart" :size="14" />
              {{ t('relsView.together') }}
            </button>
            <button
              class="rv-fchip m-ended"
              :class="{ on: marriageFilter === 'ended' }"
              @click="marriageFilter = marriageFilter === 'ended' ? 'all' : 'ended'"
            >
              <UiIcon name="heart-crack" :size="14" />
              {{ t('personForm.ended') }}
            </button>
          </div>
        </div>

        <div v-if="store.caps.tags && groupOptions.length" class="rv-facet rv-facet-groups">
          <span class="rv-facet-label">{{ t('relsView.groupLens') }}</span>
          <div class="rv-facet-chips">
            <button
              v-for="g in groupOptions"
              :key="g.id"
              class="rv-fchip"
              :class="{ on: groupSel.has(g.id) }"
              :style="{ '--fchip-c': g.color }"
              @click="toggleGroup(g.id)"
            >
              <span class="rv-fchip-dot" :style="{ background: g.color }"></span>
              <UiIcon v-if="g.icon" class="rv-fchip-icon" :name="g.icon" :size="14" />
              {{ defaultNameLabel(g.label) }}
            </button>
          </div>
          <Transition name="rv-clear">
            <div v-if="groupSel.size" class="rv-endpoints" :title="t('relsView.endpointsHint')">
              <button
                class="rv-seg"
                :class="{ on: groupMode === 'either' }"
                @click="groupMode = 'either'"
              >
                {{ t('relsView.either') }}
              </button>
              <button
                class="rv-seg"
                :class="{ on: groupMode === 'both' }"
                @click="groupMode = 'both'"
              >
                {{ t('relsView.both') }}
              </button>
            </div>
          </Transition>
        </div>

        <Transition name="rv-clear">
          <button v-if="activeFilterCount" class="rv-clear" @click="clearFilters">
            <UiIcon name="x" :size="14" />
            {{
              t(
                activeFilterCount > 1 ? 'relsView.clearFilters.other' : 'relsView.clearFilters.one',
                {
                  n: activeFilterCount
                }
              )
            }}
          </button>
        </Transition>
      </div>
    </div>

    <!-- New relationship editor -->
    <Transition name="rv-expand">
      <div v-if="editing && editing.id === 'new'" class="rv-editor rv-editor-new">
        <div class="rv-editor-label">{{ t('relsView.newRel') }}</div>
        <div class="rv-editor-grid">
          <div class="rv-field rv-field-picker">
            <label>{{ t('relsView.personA') }}</label>
            <button class="rv-pick-btn" type="button" @click="togglePicker('a')">
              {{ pickedLabel(editing.person_a_id) }}
            </button>
            <PersonPicker
              v-if="pickerSide === 'a'"
              class="rv-picker-pop"
              :exclude="[editing.person_b_id].filter(Boolean)"
              @pick="onPickPerson"
              @cancel="pickerSide = null"
            />
          </div>
          <button
            class="rv-swap-btn"
            :title="t('relsView.swapAB')"
            :aria-label="t('relsView.swapAB')"
            @click="swapEditing"
          >
            <UiIcon name="arrow-left-right" :size="16" />
          </button>
          <div class="rv-field">
            <label>{{ t('relsView.relationship') }}</label>
            <select v-model="editing.type">
              <option v-for="d in store.relTypes" :key="d.key" :value="d.key">
                {{ typeOptionLabel(d) }}
              </option>
            </select>
          </div>
          <div class="rv-field rv-field-picker">
            <label>{{ t('relsView.personB') }}</label>
            <button class="rv-pick-btn" type="button" @click="togglePicker('b')">
              {{ pickedLabel(editing.person_b_id) }}
            </button>
            <PersonPicker
              v-if="pickerSide === 'b'"
              class="rv-picker-pop"
              :exclude="[editing.person_a_id].filter(Boolean)"
              @pick="onPickPerson"
              @cancel="pickerSide = null"
            />
          </div>
          <div class="rv-field rv-field-sm">
            <label>{{
              editing.type === 'spouse' ? t('relsView.marriedYear') : t('relsView.sinceYear')
            }}</label>
            <input
              v-model="editing.formed_year"
              type="number"
              :placeholder="t('personForm.input.year')"
              min="1"
              max="2200"
              @keydown.enter="saveEdit"
            />
          </div>
          <div v-if="statusesOf(editing.type).length > 1" class="rv-field rv-field-sm">
            <label>{{ t('relsView.endedYear') }}</label>
            <input
              v-model="editing.ended_year"
              type="number"
              placeholder="—"
              min="1"
              max="2200"
              @keydown.enter="saveEdit"
            />
          </div>
          <div v-if="statusesOf(editing.type).length > 1" class="rv-field rv-field-sm">
            <label>{{ t('personForm.status') }}</label>
            <select v-model="editing.status">
              <option v-for="s in statusesOf(editing.type)" :key="s" :value="s">
                {{ statusLabel(editing.type, s) }}
              </option>
            </select>
          </div>
        </div>
        <div class="rv-editor-footer">
          <div class="rv-editor-preview" :style="{ '--rel-c': meta(editing.type).color }">
            {{ previewSentence }}
          </div>
          <Transition name="rv-fade">
            <span v-if="editError" class="rv-editor-error">{{ editError }}</span>
          </Transition>
          <button class="btn btn-ghost btn-sm" @click="cancelEdit">{{ t('dialog.cancel') }}</button>
          <button class="btn btn-primary btn-sm" @click="saveEdit">
            {{ t('personForm.create') }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- Table (virtualized rows: only the visible window exists in the DOM) -->
    <div ref="scrollEl" class="rv-scroll" @scroll.passive="onScroll">
      <div v-if="rows.length" class="rv-table">
        <!-- Header -->
        <div class="rv-head">
          <button class="rv-th" @click="setSort('from')">
            {{ t('relsView.colFrom') }}
            <UiIcon
              class="rv-sort-arrow"
              :class="arrowClass('from')"
              name="chevron-up"
              :size="12"
            />
          </button>
          <button class="rv-th rv-th-center" @click="setSort('type')">
            {{ t('relsView.colRelation') }}
            <UiIcon
              class="rv-sort-arrow"
              :class="arrowClass('type')"
              name="chevron-up"
              :size="12"
            />
          </button>
          <button class="rv-th" @click="setSort('to')">
            {{ t('relsView.colTo') }}
            <UiIcon class="rv-sort-arrow" :class="arrowClass('to')" name="chevron-up" :size="12" />
          </button>
          <button class="rv-th" @click="setSort('since')">
            {{ t('personForm.since') }}
            <UiIcon
              class="rv-sort-arrow"
              :class="arrowClass('since')"
              name="chevron-up"
              :size="12"
            />
          </button>
          <div class="rv-th rv-th-plain"></div>
        </div>

        <!-- Rows -->
        <div :key="listVersion" class="rv-body" :style="{ height: bodyH + 'px' }">
          <div
            v-for="row in visibleRows"
            :key="row.rel.id"
            class="rv-rowwrap"
            :class="{
              issue: row.issues.length,
              expanded: editing?.id === row.rel.id,
              'rv-animate': animWindow
            }"
            :style="{
              transform: `translateY(${row._y}px)`,
              '--i': row._stagger,
              '--rel-c': meta(row.rel.type).color
            }"
          >
            <div
              class="rv-row"
              @click="editing?.id === row.rel.id ? cancelEdit() : startEdit(row.rel)"
            >
              <!-- From person -->
              <button
                class="rv-person"
                :disabled="!row.a"
                :title="row.a ? t('relsView.viewPerson', { name: row.a.name }) : ''"
                @click.stop="row.a && store.selectPerson(row.a.id)"
              >
                <div class="rv-avatar" :style="{ background: avatarGradient(row.a?.gender) }">
                  <img
                    v-if="row.a?.primary_image && imageUrl(row.a.primary_image)"
                    class="rv-avatar-img"
                    :src="imageUrl(row.a.primary_image)"
                    alt=""
                  />
                  <svg v-else class="rv-avatar-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path :d="PERSON_ICON_PATH" transform="translate(-5.28 -2.16) scale(1.44)" />
                  </svg>
                </div>
                <div class="rv-pinfo">
                  <div class="rv-pname" :class="{ unknown: !row.a }">
                    {{ row.a?.name || t('relsView.unknown') }}
                  </div>
                  <div class="rv-psub">
                    {{ roleLabel(row.rel.type, 'a')
                    }}<template v-if="row.a?.birth?.year">
                      · {{ t('personForm.bornAbbr', { year: row.a.birth.year }) }}</template
                    >
                  </div>
                </div>
              </button>

              <!-- Connector -->
              <div class="rv-connector">
                <button
                  class="rv-conn-pill"
                  :class="{ toggleable: row.rel.type === 'spouse' }"
                  :title="row.rel.type === 'spouse' ? t('relsView.toggleMarried') : ''"
                  @click.stop="row.rel.type === 'spouse' ? toggleStatus(row) : startEdit(row.rel)"
                >
                  <span v-if="relGlyph(row.rel.type)" class="rv-glyph" aria-hidden="true">{{
                    relGlyph(row.rel.type)
                  }}</span
                  >{{ connLabel(row.rel) }}
                </button>
                <div
                  class="rv-track-wrap"
                  :class="[row.rel.type, { divorced: row.rel.status === 'divorced' }]"
                >
                  <!-- 红线: the red thread of fate, knotted (or cut, once ended) -->
                  <svg
                    v-if="inkThread(row.rel)"
                    class="rv-thread"
                    :class="{ oneway: isDirected(row.rel.type) }"
                    viewBox="0 0 190 14"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <template v-if="row.rel.status === 'divorced' || row.rel.ended">
                      <path class="rv-thread-line" d="M3 7C25 3 50 11 82 7" />
                      <path class="rv-thread-line" d="M108 7C140 3 165 11 187 7" />
                      <path class="rv-thread-fray" d="M82 7l5-3M82 7l6 1M108 7l-5 3M108 7l-6-1" />
                    </template>
                    <template v-else>
                      <path class="rv-thread-line" d="M3 7C35 2 62 12 95 7S155 2 187 7" />
                      <path
                        class="rv-thread-knot"
                        d="M95 7c-5-7-12-3-7 1s7-1 7-1 1 5 7 1-2-8-7-1"
                      />
                    </template>
                  </svg>
                  <template v-else-if="row.rel.type === 'spouse'">
                    <span class="rv-dot rv-dot-left"></span>
                    <template v-if="row.rel.status === 'divorced'">
                      <span class="rv-track rv-track-top rv-seg-left"></span>
                      <span class="rv-track rv-track-top rv-seg-right"></span>
                      <span class="rv-track rv-track-bottom rv-seg-left"></span>
                      <span class="rv-track rv-track-bottom rv-seg-right"></span>
                      <span class="rv-cut rv-cut-1"></span>
                      <span class="rv-cut rv-cut-2"></span>
                    </template>
                    <template v-else>
                      <span class="rv-track rv-track-top"></span>
                      <span class="rv-track rv-track-bottom"></span>
                    </template>
                    <span class="rv-dot rv-dot-right"></span>
                  </template>
                  <template v-else>
                    <span class="rv-dot rv-dot-left"></span>
                    <span class="rv-track" :class="{ dashed: isDashed(row.rel.type) }"></span>
                    <span v-if="isDirected(row.rel.type)" class="rv-arrow"></span>
                    <span v-else class="rv-dot rv-dot-right"></span>
                  </template>
                </div>
              </div>

              <!-- To person -->
              <button
                class="rv-person"
                :disabled="!row.b"
                :title="row.b ? t('relsView.viewPerson', { name: row.b.name }) : ''"
                @click.stop="row.b && store.selectPerson(row.b.id)"
              >
                <div class="rv-avatar" :style="{ background: avatarGradient(row.b?.gender) }">
                  <img
                    v-if="row.b?.primary_image && imageUrl(row.b.primary_image)"
                    class="rv-avatar-img"
                    :src="imageUrl(row.b.primary_image)"
                    alt=""
                  />
                  <svg v-else class="rv-avatar-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path :d="PERSON_ICON_PATH" transform="translate(-5.28 -2.16) scale(1.44)" />
                  </svg>
                </div>
                <div class="rv-pinfo">
                  <div class="rv-pname" :class="{ unknown: !row.b }">
                    {{ row.b?.name || t('relsView.unknown') }}
                  </div>
                  <div class="rv-psub">
                    {{ roleLabel(row.rel.type, 'b')
                    }}<template v-if="row.b?.birth?.year">
                      · {{ t('personForm.bornAbbr', { year: row.b.birth.year }) }}</template
                    >
                  </div>
                </div>
              </button>

              <!-- Since (inline editable) -->
              <div class="rv-since" @click.stop>
                <input
                  type="number"
                  class="rv-since-input"
                  :value="row.rel.formed?.year || ''"
                  placeholder="—"
                  min="1"
                  max="2200"
                  :title="t('relsView.formedHint')"
                  @change="setSince(row, $event.target.value)"
                />
              </div>

              <!-- Actions -->
              <div class="rv-actions" @click.stop>
                <span v-if="row.issues.length" class="rv-warn" :title="row.issues.join('\n')">
                  <UiIcon name="triangle-alert" :size="16" :label="t('relsView.issues')" />
                </span>
                <button
                  v-if="isDirected(row.rel.type)"
                  class="rv-action-btn"
                  :title="t('relsView.swapDirection')"
                  :aria-label="t('relsView.swapDirection')"
                  @click="swapRel(row)"
                >
                  <UiIcon name="arrow-left-right" :size="14" />
                </button>
                <button
                  class="rv-action-btn"
                  :title="t('personModal.edit')"
                  :aria-label="t('relsView.editRel')"
                  @click="startEdit(row.rel)"
                >
                  <UiIcon name="pencil" :size="14" />
                </button>
                <button
                  class="rv-action-btn rv-action-del"
                  :title="t('dialog.delete')"
                  :aria-label="t('relsView.deleteRel')"
                  @click="removeRel(row)"
                >
                  <UiIcon name="trash-2" :size="14" />
                </button>
              </div>
            </div>

            <!-- Inline row editor -->
            <Transition name="rv-fade">
              <div v-if="editing?.id === row.rel.id" class="rv-editor" @click.stop>
                <div class="rv-editor-grid">
                  <div class="rv-field rv-field-picker">
                    <label>{{ t('relsView.personA') }}</label>
                    <button class="rv-pick-btn" type="button" @click="togglePicker('a')">
                      {{ pickedLabel(editing.person_a_id) }}
                    </button>
                    <PersonPicker
                      v-if="pickerSide === 'a'"
                      class="rv-picker-pop"
                      :exclude="[editing.person_b_id].filter(Boolean)"
                      @pick="onPickPerson"
                      @cancel="pickerSide = null"
                    />
                  </div>
                  <button
                    class="rv-swap-btn"
                    :title="t('relsView.swapAB')"
                    :aria-label="t('relsView.swapAB')"
                    @click="swapEditing"
                  >
                    <UiIcon name="arrow-left-right" :size="16" />
                  </button>
                  <div class="rv-field">
                    <label>{{ t('relsView.relationship') }}</label>
                    <select v-model="editing.type">
                      <option v-for="d in store.relTypes" :key="d.key" :value="d.key">
                        {{ typeOptionLabel(d) }}
                      </option>
                    </select>
                  </div>
                  <div class="rv-field rv-field-picker">
                    <label>{{ t('relsView.personB') }}</label>
                    <button class="rv-pick-btn" type="button" @click="togglePicker('b')">
                      {{ pickedLabel(editing.person_b_id) }}
                    </button>
                    <PersonPicker
                      v-if="pickerSide === 'b'"
                      class="rv-picker-pop"
                      :exclude="[editing.person_a_id].filter(Boolean)"
                      @pick="onPickPerson"
                      @cancel="pickerSide = null"
                    />
                  </div>
                  <div class="rv-field rv-field-sm">
                    <label>{{
                      editing.type === 'spouse'
                        ? t('relsView.marriedYear')
                        : t('relsView.sinceYear')
                    }}</label>
                    <input
                      v-model="editing.formed_year"
                      type="number"
                      :placeholder="t('personForm.input.year')"
                      min="1"
                      max="2200"
                      @keydown.enter="saveEdit"
                    />
                  </div>
                  <div v-if="statusesOf(editing.type).length > 1" class="rv-field rv-field-sm">
                    <label>{{ t('relsView.endedYear') }}</label>
                    <input
                      v-model="editing.ended_year"
                      type="number"
                      placeholder="—"
                      min="1"
                      max="2200"
                      @keydown.enter="saveEdit"
                    />
                  </div>
                  <div v-if="statusesOf(editing.type).length > 1" class="rv-field rv-field-sm">
                    <label>{{ t('personForm.status') }}</label>
                    <select v-model="editing.status">
                      <option v-for="s in statusesOf(editing.type)" :key="s" :value="s">
                        {{ statusLabel(editing.type, s) }}
                      </option>
                    </select>
                  </div>
                </div>
                <div class="rv-editor-footer">
                  <div class="rv-editor-preview" :style="{ '--rel-c': meta(editing.type).color }">
                    {{ previewSentence }}
                  </div>
                  <Transition name="rv-fade">
                    <span v-if="editError" class="rv-editor-error">{{ editError }}</span>
                  </Transition>
                  <button class="btn btn-ghost btn-sm" @click="cancelEdit">
                    {{ t('dialog.cancel') }}
                  </button>
                  <button class="btn btn-primary btn-sm" @click="saveEdit">
                    {{ t('relsView.save') }}
                  </button>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="rv-empty">
        <div class="rv-empty-icon">
          <UiIcon :name="emptyIcon" :size="44" :stroke="1.5" />
        </div>
        <div class="rv-empty-title">
          {{
            store.relationships.length
              ? typeFilter === 'issues'
                ? t('relsView.empty.noIssues')
                : t('relsView.empty.noMatches')
              : t('relsView.empty.noRels')
          }}
        </div>
        <div class="rv-empty-text">
          {{
            store.relationships.length
              ? typeFilter === 'issues'
                ? t('relsView.empty.noIssuesText')
                : t('relsView.empty.noMatchesText')
              : t('relsView.empty.noRelsText')
          }}
        </div>
        <button
          v-if="!store.relationships.length && store.persons.length >= 2"
          class="btn btn-primary btn-sm"
          @click="startAdd"
        >
          <UiIcon name="plus" :size="14" />
          {{ t('relsView.addRel') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useMainStore } from '../store/index.js'
import { api } from '../api'
import { yearDate } from '../../../shared/calendarMath'
import PersonPicker from './personForm/PersonPicker.vue'
import RelTypesPanel from './RelTypesPanel.vue'
import UiIcon from './ui/UiIcon.js'
import SearchField from './ui/SearchField.vue'
import { derivedSiblings } from './graph/graphInsights.js'
import { confirmDialog } from '../lib/dialogs.js'
import { undoToast } from '../lib/undoToast.js'
import { translate as tr, useI18n } from '../i18n'
import { defaultNameLabel, relRoleLabel, relStatusLabel, relTypeLabel } from '../lib/dataLabels'
import { inkAvatarBg, inkRelColor, inkRelGlyph, isRomanticType } from './ui/inkChrome'

const store = useMainStore()
const { t } = useI18n()
const typesOpen = ref(false)

// ── searchable person picking (replaces the old scroll-forever dropdowns) ────
const pickerSide = ref(null) // 'a' | 'b' | null

function togglePicker(side) {
  pickerSide.value = pickerSide.value === side ? null : side
}

function pickedLabel(id) {
  const p = id ? store.persons.find((x) => x.id === id) : null
  if (!p) return tr('relsView.selectPerson')
  const name = p.name || tr('personForm.unnamed')
  return p.birth?.year
    ? tr('relsView.nameBorn', { name, born: tr('personForm.bornAbbr', { year: p.birth.year }) })
    : name
}

function onPickPerson(person) {
  if (!editing.value || !pickerSide.value) return
  if (pickerSide.value === 'a') editing.value.person_a_id = person.id
  else editing.value.person_b_id = person.id
  pickerSide.value = null
}

const PERSON_ICON_PATH =
  'M12 12.5c2.49 0 4.5-2.01 4.5-4.5S14.49 3.5 12 3.5 7.5 5.51 7.5 8s2.01 4.5 4.5 4.5zm0 2.25c-3 0-9 1.51-9 4.5V22h18v-2.75c0-2.99-6-4.5-9-4.5z'

// Virtualization geometry: every row is a fixed 57px (56 + 1px border); the
// expanded inline editor adds a fixed block below its row.
const ROW_H = 57
const EDITOR_EXPAND = 152
const HEAD_OFFSET = 55 // scroll padding + sticky header above the row body
const OVERSCAN_ROWS = 5

const query = ref('')
const typeFilter = ref('all') // 'all' | 'parent_child' | 'spouse' | 'adopted' | 'issues'
const sortKey = ref('type')
const sortDir = ref(1)

// ── Secondary filters (the sliding facet panel) ─────────────────────────────
// Complements the type chips: whether the bond is dated, marriage state, and a
// "group lens" that narrows to bonds touching (or bridging) chosen groups.
const filtersOpen = ref(false)
const dateFilter = ref('all') // 'all' | 'dated' | 'undated'
const marriageFilter = ref('all') // 'all' | 'current' | 'ended'
const groupSel = ref(new Set())
const groupMode = ref('either') // 'either' | 'both' endpoints in a chosen group

const hasSpouses = computed(() => store.relationships.some((r) => r.type === 'spouse'))

// Group facets — tags with at least one member person, busiest first.
const groupOptions = computed(() => {
  const personIds = new Set(store.persons.map((p) => p.id))
  return store.tags
    .map((t) => {
      const members = store.membersOf.get(t.id) || []
      const count = members.reduce((n, id) => n + (personIds.has(id) ? 1 : 0), 0)
      return { id: t.id, label: t.label, color: t.color || 'var(--accent)', icon: t.icon, count }
    })
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
})

function personInSelectedGroup(personId) {
  const tags = store.tagsOf.get(personId)
  return tags ? tags.some((t) => groupSel.value.has(t.id)) : false
}

function toggleGroup(id) {
  const next = new Set(groupSel.value)
  next.has(id) ? next.delete(id) : next.add(id)
  groupSel.value = next
}

const activeFilterCount = computed(
  () =>
    (dateFilter.value !== 'all' ? 1 : 0) +
    (marriageFilter.value !== 'all' ? 1 : 0) +
    groupSel.value.size
)

function clearFilters() {
  dateFilter.value = 'all'
  marriageFilter.value = 'all'
  groupSel.value = new Set()
}
const editing = ref(null) // { id: 'new' | relId, person_a_id, person_b_id, type, formed_year, status }
const editError = ref('')

function imageUrl(filename) {
  return api.getImageUrl(filename) || ''
}
function avatarGradient(gender) {
  if (store.isInk) return inkAvatarBg(gender)
  if (gender === 'male') return 'linear-gradient(135deg, #3a7bd5, #2351a0)'
  if (gender === 'female') return 'linear-gradient(135deg, #c95fa0, #923075)'
  return 'linear-gradient(135deg, #5c6bc0, #3c4a9e)'
}

const personById = computed(() => {
  const m = {}
  store.persons.forEach((p) => {
    m[p.id] = p
  })
  return m
})
function meta(type) {
  const m = baseMeta(type)
  return { ...m, color: inkRelColor(type, m.color, store.isInk) }
}
function baseMeta(type) {
  const gs = store.graphSettings
  // The legacy trio keeps following the Style panel's colors.
  if (type === 'spouse') return { label: tr('personModal.kin.spouse'), color: gs.spouseColor }
  if (type === 'adopted') return { label: tr('data.relTypes.adopted'), color: gs.adoptedColor }
  if (type === 'parent_child') {
    return { label: tr('relsView.parentOf'), color: gs.parentChildColor }
  }
  const def = store.relTypeByKey.get(type)
  return { label: relTypeLabel(def) || type, color: def?.color || gs.parentChildColor }
}
// Ink theme: romantic bonds are drawn as the red thread of fate (红线), and
// every pill is stamped with the type's brushed character.
function inkThread(rel) {
  return store.isInk && isRomanticType(rel.type)
}
function relGlyph(type) {
  return store.isInk ? inkRelGlyph(type, defOf(type)?.label) : ''
}
function defOf(type) {
  return store.relTypeByKey.get(type)
}
function isDirected(type) {
  const def = defOf(type)
  return def ? def.directed : type !== 'spouse'
}
function isDashed(type) {
  if (type === 'adopted') return true
  const def = defOf(type)
  return !!def && def.weight < 0.5 && type !== 'parent_child' && type !== 'spouse'
}
function statusesOf(type) {
  return defOf(type)?.statuses || ['active']
}
function statusLabel(type, s) {
  if (type === 'spouse' && s === 'active') return tr('personForm.married')
  return s ? relStatusLabel(s) : s
}
function typeOptionLabel(def) {
  return def.directed
    ? `${relRoleLabel(def, 'a') || 'A'} → ${relRoleLabel(def, 'b') || 'B'}`
    : relTypeLabel(def)
}
function connLabel(rel) {
  if (rel.label) return rel.label // per-edge custom label wins
  if (rel.type === 'spouse') {
    return rel.status === 'divorced' ? relStatusLabel('divorced') : tr('personForm.married')
  }
  if (rel.type === 'parent_child') return tr('relsView.parentOf')
  if (rel.type === 'adopted') return tr('data.relTypes.adopted')
  return meta(rel.type).label
}
function roleLabel(type, side) {
  if (type === 'spouse') return tr('relsView.partner')
  const def = defOf(type)
  if (!def) return side === 'a' ? tr('personModal.kin.parent') : tr('personModal.kin.child')
  if (def.directed) return relRoleLabel(def, side) || relTypeLabel(def)
  return relTypeLabel(def)
}

// ── Consistency checks ──────────────────────────────────────────────────────
const issuesByRel = computed(() => {
  const out = {}
  const add = (id, msg) => {
    ;(out[id] ||= []).push(msg)
  }
  const rels = store.relationships
  const pairKey = (r) => [r.person_a_id, r.person_b_id].sort().join('~')

  const byPairType = {}
  const parentCount = {} // childId -> number of biological parents
  rels.forEach((r) => {
    ;(byPairType[pairKey(r) + '~' + r.type] ||= []).push(r.id)
    if (r.type === 'parent_child')
      parentCount[r.person_b_id] = (parentCount[r.person_b_id] || 0) + 1
  })

  rels.forEach((r) => {
    const a = personById.value[r.person_a_id]
    const b = personById.value[r.person_b_id]
    if (r.person_a_id === r.person_b_id) add(r.id, tr('relsView.issue.self'))
    if (!a || !b) add(r.id, tr('relsView.issue.missing'))
    if (byPairType[pairKey(r) + '~' + r.type].length > 1) add(r.id, tr('relsView.issue.duplicate'))
    // A pair holding several DIFFERENT bonds (married + parent, mentor +
    // rival…) is deliberate and allowed — only exact duplicates are flagged.
    if (
      (r.type === 'parent_child' || r.type === 'adopted') &&
      a?.birth?.year &&
      b?.birth?.year &&
      a.birth.year >= b.birth.year
    ) {
      add(r.id, tr('relsView.issue.parentYounger', { a: a.birth.year, b: b.birth.year }))
    }
    if (r.type === 'parent_child' && parentCount[r.person_b_id] > 2) {
      add(
        r.id,
        tr('relsView.issue.tooManyParents', { name: b?.name || tr('relsView.issue.thisChild') })
      )
    }
    // Siblinghood is derived from shared parents — an explicit row on top of
    // that is redundant (explicit rows are for half/step cases the tree can't see).
    if (
      r.type === 'sibling' &&
      derivedSibs.value.get(r.person_a_id)?.has(r.person_b_id) &&
      r.person_a_id !== r.person_b_id
    ) {
      add(r.id, tr('relsView.issue.redundantSibling'))
    }
  })
  return out
})

// Derived siblinghood (shared vertical-edge parent) — feeds the redundancy check.
const derivedSibs = computed(() =>
  derivedSiblings(
    store.relationships,
    store.relTypeRoles.size ? (t) => store.relTypeRoles.get(t) || 'none' : undefined
  )
)
const issueCount = computed(() => Object.keys(issuesByRel.value).length)

// If the user is on the Issues filter and the last issue gets fixed, fall back to All
watch(issueCount, (n) => {
  if (n === 0 && typeFilter.value === 'issues') typeFilter.value = 'all'
})

// ── Filter chips ────────────────────────────────────────────────────────────
// One chip per registry type that's actually in use, in registry order.
const chips = computed(() => {
  const rels = store.relationships
  const counts = new Map()
  rels.forEach((r) => counts.set(r.type, (counts.get(r.type) || 0) + 1))
  const list = [
    { id: 'all', label: tr('relsView.all'), count: rels.length, color: 'var(--accent)' }
  ]
  for (const def of store.relTypes) {
    const count = counts.get(def.key) || 0
    if (!count) continue
    list.push({
      id: def.key,
      label: def.key === 'parent_child' ? tr('personModal.kin.parent') : relTypeLabel(def),
      count,
      color: meta(def.key).color
    })
  }
  return list
})

// ── Rows (filter + sort) ────────────────────────────────────────────────────
const rows = computed(() => {
  const q = query.value.trim().toLowerCase()
  let list = store.relationships.map((r) => ({
    rel: r,
    a: personById.value[r.person_a_id] || null,
    b: personById.value[r.person_b_id] || null,
    issues: issuesByRel.value[r.id] || []
  }))
  if (typeFilter.value === 'issues') list = list.filter((x) => x.issues.length)
  else if (typeFilter.value !== 'all') list = list.filter((x) => x.rel.type === typeFilter.value)
  if (q) {
    list = list.filter(
      (x) =>
        (x.a?.name || '').toLowerCase().includes(q) || (x.b?.name || '').toLowerCase().includes(q)
    )
  }
  if (dateFilter.value !== 'all') {
    const wantDated = dateFilter.value === 'dated'
    list = list.filter((x) => !!x.rel.formed?.year === wantDated)
  }
  if (marriageFilter.value !== 'all') {
    // Marriage state only applies to spouse bonds, so this narrows to marriages.
    const wantEnded = marriageFilter.value === 'ended'
    list = list.filter(
      (x) => x.rel.type === 'spouse' && (x.rel.status === 'divorced') === wantEnded
    )
  }
  if (groupSel.value.size) {
    list = list.filter((x) => {
      const aIn = x.a ? personInSelectedGroup(x.a.id) : false
      const bIn = x.b ? personInSelectedGroup(x.b.id) : false
      return groupMode.value === 'both' ? aIn && bIn : aIn || bIn
    })
  }
  const dir = sortDir.value
  const nm = (p) => (p?.name || '').toLowerCase()
  const yr = (r) => r.formed?.year || 9e9
  list.sort((x, y) => {
    let c = 0
    if (sortKey.value === 'from') c = nm(x.a).localeCompare(nm(y.a))
    else if (sortKey.value === 'to') c = nm(x.b).localeCompare(nm(y.b))
    else if (sortKey.value === 'since') c = yr(x.rel) - yr(y.rel)
    else c = x.rel.type.localeCompare(y.rel.type)
    if (c === 0) c = nm(x.a).localeCompare(nm(y.a))
    return c * dir
  })
  return list
})

function setSort(key) {
  if (sortKey.value === key) sortDir.value = -sortDir.value
  else {
    sortKey.value = key
    sortDir.value = 1
  }
}
const emptyIcon = computed(() =>
  store.relationships.length ? (typeFilter.value === 'issues' ? 'circle-check' : 'search') : 'link'
)

function arrowClass(key) {
  if (sortKey.value !== key) return 'hidden'
  return sortDir.value === 1 ? 'asc' : 'desc'
}

// ── Virtual window ──────────────────────────────────────────────────────────
const scrollEl = ref(null)
const scrollTop = ref(0)
const viewH = ref(600)

let scrollRaf = 0
function onScroll() {
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    scrollTop.value = scrollEl.value?.scrollTop || 0
  })
}

const editIdx = computed(() => {
  if (!editing.value || editing.value.id === 'new') return -1
  return rows.value.findIndex((r) => r.rel.id === editing.value.id)
})

const bodyH = computed(() => rows.value.length * ROW_H + (editIdx.value >= 0 ? EDITOR_EXPAND : 0))

// Primitive computeds so the window only shifts when the scroll actually
// crosses a row boundary — not on every scrolled pixel.
const startIdx = computed(() => {
  let rel = scrollTop.value - HEAD_OFFSET
  if (editIdx.value >= 0 && rel > editIdx.value * ROW_H + EDITOR_EXPAND) rel -= EDITOR_EXPAND
  return Math.max(0, Math.floor(rel / ROW_H) - OVERSCAN_ROWS)
})
const endIdx = computed(() =>
  Math.min(rows.value.length, startIdx.value + Math.ceil(viewH.value / ROW_H) + OVERSCAN_ROWS * 2)
)

const visibleRows = computed(() => {
  const out = []
  const list = rows.value
  const eIdx = editIdx.value
  for (let i = startIdx.value; i < endIdx.value; i++) {
    out.push({
      ...list[i],
      _y: i * ROW_H + (eIdx >= 0 && i > eIdx ? EDITOR_EXPAND : 0),
      _stagger: Math.min(i - startIdx.value, 20)
    })
  }
  return out
})

// Stagger entrance replays when the filter/sort/search changes; rows scrolled
// into view afterwards appear instantly.
const listVersion = ref(0)
const animWindow = ref(true)
let animTimer = setTimeout(() => {
  animWindow.value = false
}, 1100)
watch(
  [query, typeFilter, sortKey, sortDir, dateFilter, marriageFilter, groupSel, groupMode],
  () => {
    listVersion.value++
    animWindow.value = true
    clearTimeout(animTimer)
    animTimer = setTimeout(() => {
      animWindow.value = false
    }, 1100)
  }
)

let ro = null
onMounted(() => {
  const measure = () => {
    viewH.value = scrollEl.value?.clientHeight || 600
  }
  measure()
  ro = new ResizeObserver(measure)
  if (scrollEl.value) ro.observe(scrollEl.value)
})
onBeforeUnmount(() => {
  if (ro) ro.disconnect()
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
  if (animTimer) clearTimeout(animTimer)
})

// ── Editing ─────────────────────────────────────────────────────────────────
function startAdd() {
  editError.value = ''
  editing.value = {
    id: 'new',
    person_a_id: '',
    person_b_id: '',
    type: 'parent_child',
    formed_year: '',
    ended_year: '',
    status: 'active'
  }
}
function startEdit(rel) {
  editError.value = ''
  editing.value = {
    id: rel.id,
    person_a_id: rel.person_a_id,
    person_b_id: rel.person_b_id,
    type: rel.type,
    formed_year: rel.formed?.year || '',
    ended_year: rel.ended?.year || '',
    status: rel.status || 'active'
  }
}
function toggleAdd() {
  if (editing.value?.id === 'new') cancelEdit()
  else startAdd()
}
function cancelEdit() {
  editing.value = null
  editError.value = ''
  pickerSide.value = null
}
function swapEditing() {
  const e = editing.value
  if (!e) return
  ;[e.person_a_id, e.person_b_id] = [e.person_b_id, e.person_a_id]
}

// Switching the type resets the status to the new type's default when the
// current one isn't valid for it.
watch(
  () => editing.value?.type,
  (t) => {
    const e = editing.value
    if (!e || !t) return
    const valid = statusesOf(t)
    if (!valid.includes(e.status)) e.status = valid[0] || 'active'
  }
)

const previewSentence = computed(() => {
  const e = editing.value
  if (!e) return ''
  const a = personById.value[e.person_a_id]?.name || tr('relsView.personA')
  const b = personById.value[e.person_b_id]?.name || tr('relsView.personB')
  if (e.type === 'spouse') {
    return e.status === 'divorced'
      ? tr('relsView.preview.divorced', { a, b })
      : tr('relsView.preview.married', { a, b })
  }
  if (e.type === 'adopted') return tr('relsView.preview.adopted', { a, b })
  if (e.type === 'parent_child') return tr('relsView.preview.parent', { a, b })
  const def = defOf(e.type)
  if (!def) return tr('relsView.preview.generic', { a, b })
  if (def.directed) {
    const role = (relRoleLabel(def, 'a') || relTypeLabel(def)).toLowerCase()
    return tr('relsView.preview.directed', { a, b, role })
  }
  return tr('relsView.preview.symmetric', { a, b, type: relTypeLabel(def).toLowerCase() })
})

async function saveEdit() {
  const e = editing.value
  if (!e) return
  if (!e.person_a_id || !e.person_b_id) {
    editError.value = tr('relsView.err.chooseBoth')
    return
  }
  if (e.person_a_id === e.person_b_id) {
    editError.value = tr('relsView.err.self')
    return
  }
  const dup = store.relationships.some(
    (r) =>
      r.id !== e.id &&
      r.type === e.type &&
      ((r.person_a_id === e.person_a_id && r.person_b_id === e.person_b_id) ||
        (r.person_a_id === e.person_b_id && r.person_b_id === e.person_a_id))
  )
  if (dup) {
    editError.value = tr('relsView.err.exists')
    return
  }

  const validStatuses = statusesOf(e.type)
  const payload = {
    person_a_id: e.person_a_id,
    person_b_id: e.person_b_id,
    type: e.type,
    formed: yearDate(e.formed_year),
    ended: yearDate(e.ended_year),
    status: validStatuses.includes(e.status) ? e.status : validStatuses[0] || 'active'
  }
  const res =
    e.id === 'new'
      ? await store.createRelationship(payload)
      : await store.updateRelationship({ id: e.id, ...payload })
  if (!res.success) {
    editError.value = res.error || tr('relsView.err.couldNotSave')
    return
  }
  cancelEdit()
}

// ── Quick row actions ───────────────────────────────────────────────────────
async function removeRel(row) {
  const aName = row.a?.name || tr('relsView.unknown')
  const bName = row.b?.name || tr('relsView.unknown')
  const kind =
    row.rel.type === 'spouse'
      ? tr('relsView.kind.marriage')
      : row.rel.type === 'adopted'
        ? tr('relsView.kind.adoption')
        : row.rel.type === 'parent_child'
          ? tr('relsView.kind.parentChild')
          : (meta(row.rel.type).label || '').toLowerCase()
  const ok = await confirmDialog({
    title: tr('confirm.deleteBond', { kind }),
    message: tr('confirm.deleteBondBetween', { a: aName, b: bName }) + ' ' + tr('dialog.undoHint'),
    tone: 'danger'
  })
  if (!ok) return
  if (editing.value?.id === row.rel.id) cancelEdit()
  const res = await store.deleteRelationship(row.rel.id)
  if (res?.success) undoToast(tr('toasts.deletedBond'), 'relationships:delete')
}
async function swapRel(row) {
  await store.updateRelationship({
    id: row.rel.id,
    person_a_id: row.rel.person_b_id,
    person_b_id: row.rel.person_a_id
  })
}
async function setSince(row, val) {
  const y = parseInt(val)
  await store.updateRelationship({ id: row.rel.id, formed: y && y > 0 ? yearDate(y) : null })
}
async function toggleStatus(row) {
  if (row.rel.type !== 'spouse') return
  await store.updateRelationship({
    id: row.rel.id,
    status: row.rel.status === 'divorced' ? 'active' : 'divorced'
  })
}
</script>

<style scoped>
.rv {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background:
    radial-gradient(1200px 600px at 20% -10%, rgba(240, 98, 146, 0.06), transparent 60%), var(--bg);
  min-height: 0;
}

/* ── Toolbar ─────────────────────────────────────────────── */
.rv-toolbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 22px;
  border-bottom: 1px solid var(--border);
  background: var(--glass-soft);
  backdrop-filter: blur(10px);
  flex-wrap: wrap;
  z-index: 2;
}
.rv-heading {
  display: flex;
  align-items: center;
  gap: 10px;
}
.rv-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: var(--t1);
}
.rv-count {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--accent);
  background: var(--adim);
  padding: 2px 9px;
  border-radius: 20px;
}
.rv-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

/* ── Filter toggle button + facet panel ──────────────────── */
.rv-filter-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: var(--ctl-md);
  padding: 0 13px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.18s,
    background 0.18s,
    border-color 0.18s;
}
.rv-filter-btn:hover {
  color: var(--t1);
  background: var(--hover);
}
.rv-filter-btn.active {
  color: var(--t1);
  border-color: rgba(var(--accent-rgb), 0.45);
}
.rv-filter-badge {
  min-width: 17px;
  height: 17px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 11.5px;
  font-weight: 800;
}
.rv-badge-enter-active,
.rv-badge-leave-active {
  transition:
    transform 0.24s cubic-bezier(0.34, 1.5, 0.5, 1),
    opacity 0.2s ease;
}
.rv-badge-enter-from,
.rv-badge-leave-to {
  transform: scale(0);
  opacity: 0;
}

.rv-filters {
  flex: 0 0 auto;
  display: grid;
  grid-template-rows: 0fr;
  background: var(--glass-soft);
  border-bottom: 1px solid transparent;
  transition:
    grid-template-rows 0.34s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.34s ease;
  z-index: 2;
}
.rv-filters.open {
  grid-template-rows: 1fr;
  border-bottom-color: var(--border);
}
.rv-filters-inner {
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 22px;
  padding: 0 22px;
  transition: padding 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}
.rv-filters.open .rv-filters-inner {
  padding: 13px 22px;
}
.rv-facet {
  display: flex;
  align-items: center;
  gap: 9px;
}
.rv-facet-groups {
  flex-wrap: wrap;
}
.rv-facet-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.7px;
  text-transform: uppercase;
  color: var(--t3);
}
.rv-facet-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.rv-fchip {
  --fchip-c: var(--accent);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 11px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.16s,
    color 0.16s,
    border-color 0.16s,
    transform 0.16s;
}
.rv-fchip:hover {
  transform: translateY(-1px);
  color: var(--t1);
}
.rv-fchip.on {
  background: color-mix(in srgb, var(--fchip-c) 16%, transparent);
  border-color: color-mix(in srgb, var(--fchip-c) 50%, transparent);
  color: var(--t1);
}
.rv-fchip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--fchip-c);
  flex-shrink: 0;
}
.rv-fchip-icon {
  color: var(--fchip-c);
}
.m-current {
  --fchip-c: var(--green);
}
.m-ended {
  --fchip-c: var(--pink);
}
.rv-endpoints {
  display: inline-flex;
  padding: 3px;
  gap: 2px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--elevated);
}
.rv-seg {
  display: inline-flex;
  align-items: center;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--t3);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 700;
  padding: 0 10px;
  border-radius: 6px;
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s;
}
.rv-seg.on {
  background: var(--accent);
  color: var(--on-accent);
}
.rv-clear {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 20px;
  background: transparent;
  color: var(--t3);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s;
}
.rv-clear:hover {
  color: var(--danger);
  background: rgba(var(--danger-rgb), 0.1);
}
.rv-clear-enter-active,
.rv-clear-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.rv-clear-enter-from,
.rv-clear-leave-to {
  opacity: 0;
  transform: translateX(-6px);
}

/* One control height across the toolbar (search, chips, buttons). */
.rv-search {
  width: 220px;
  min-width: 190px;
}
.rv-search .search-field {
  --sf-h: var(--ctl-md);
}
.rv-add-btn {
  gap: 6px;
}

/* Filter chips */
.rv-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.rv-chip {
  --chip-c: var(--accent);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: var(--ctl-md);
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.18s,
    color 0.18s,
    border-color 0.18s,
    transform 0.18s;
}
.rv-chip:hover {
  color: var(--t1);
  transform: translateY(-1px);
}
.rv-chip.active {
  background: color-mix(in srgb, var(--chip-c) 15%, transparent);
  border-color: color-mix(in srgb, var(--chip-c) 45%, transparent);
  color: var(--t1);
}
.rv-chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--chip-c);
  flex-shrink: 0;
  transition: transform 0.2s;
}
.rv-chip.active .rv-chip-dot {
  transform: scale(1.25);
}
.rv-chip-count {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--t3);
}
.rv-chip.active .rv-chip-count {
  color: var(--chip-c);
}

.rv-chip-issues {
  --chip-c: var(--warning);
  color: var(--warning);
  border-color: color-mix(in srgb, var(--warning) 35%, transparent);
}
.rv-chip-issues:hover {
  color: var(--warning);
}
.rv-chip-issues.active {
  color: var(--warning);
}
.rv-chip-issues .rv-chip-count {
  color: var(--warning);
}
.rv-chip-pop-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.rv-chip-pop-leave-active {
  transition: all 0.2s ease;
}
.rv-chip-pop-enter-from,
.rv-chip-pop-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/* ── Editor ──────────────────────────────────────────────── */
.rv-editor {
  background: var(--elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
}
.rv-editor-new {
  margin: 14px 22px 0;
  flex: 0 0 auto;
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.2);
}
.rv-editor-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--accent);
  margin-bottom: 10px;
}
.rv-editor-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr 1fr 92px 92px auto;
  gap: 10px;
  align-items: end;
}
.rv-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.rv-field label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--t3);
}
.rv-field select,
.rv-field input {
  height: 34px;
  padding: 0 10px;
  font-size: 13px;
  background: var(--surface);
}
.rv-field select {
  padding-right: 28px;
}
.rv-field-sm {
  max-width: 130px;
}
.rv-field-picker {
  position: relative;
}

.rv-pick-btn {
  width: 100%;
  text-align: left;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12.5px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: border-color 0.15s;
}

.rv-pick-btn:hover {
  border-color: var(--accent);
}

.rv-picker-pop {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  min-width: 240px;
  z-index: 40;
}

.rv-swap-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  width: 34px;
  padding: 0;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--t2);
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s,
    transform 0.25s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.rv-swap-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
  transform: rotate(180deg);
}
.rv-editor-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}
.rv-editor-preview {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  font-style: italic;
  color: var(--t2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: 10px;
  border-left: 3px solid var(--rel-c, var(--accent));
}
.rv-editor-error {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--danger);
  background: rgba(var(--danger-rgb), 0.12);
  padding: 4px 10px;
  border-radius: 8px;
  white-space: nowrap;
}
.rv-fade-enter-active,
.rv-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.rv-fade-enter-from,
.rv-fade-leave-to {
  opacity: 0;
  transform: translateY(3px);
}

/* New-relationship editor expand/collapse */
.rv-expand-enter-active {
  transition:
    max-height 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.28s ease,
    margin 0.28s ease;
  overflow: hidden;
}
.rv-expand-leave-active {
  transition:
    max-height 0.22s ease,
    opacity 0.18s ease,
    margin 0.18s ease;
  overflow: hidden;
}
.rv-expand-enter-from,
.rv-expand-leave-to {
  max-height: 0;
  opacity: 0;
  margin-top: 0;
  margin-bottom: 0;
}
.rv-expand-enter-to,
.rv-expand-leave-from {
  max-height: 260px;
  opacity: 1;
}

/* ── Table ───────────────────────────────────────────────── */
.rv-scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow: auto;
  padding: 16px 22px 26px;
}
.rv-table {
  --grid: minmax(175px, 1.3fr) minmax(165px, 1fr) minmax(175px, 1.3fr) 76px 120px;
  min-width: 740px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  /* clip (not hidden) — hidden would turn the card into the sticky header's
     scroll container and the header would never pin to the view edge */
  overflow: clip;
  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.14);
}

.rv-head {
  display: grid;
  grid-template-columns: var(--grid);
  align-items: center;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  position: sticky;
  top: 0;
  z-index: 3;
}
.rv-th {
  display: flex;
  align-items: center;
  gap: 5px;
  border: none;
  background: transparent;
  font-family: var(--font);
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: var(--t3);
  text-align: left;
  padding: 11px 14px;
  cursor: pointer;
  transition: color 0.15s;
}
.rv-th:hover {
  color: var(--t1);
}
.rv-th-center {
  justify-content: center;
}
.rv-th-plain {
  cursor: default;
}
.rv-sort-arrow {
  transition:
    transform 0.25s cubic-bezier(0.34, 1.4, 0.5, 1),
    opacity 0.2s;
}
.rv-sort-arrow.hidden {
  opacity: 0;
}
.rv-th:hover .rv-sort-arrow.hidden {
  opacity: 0.35;
}
.rv-sort-arrow.asc {
  opacity: 1;
  color: var(--accent);
}
.rv-sort-arrow.desc {
  opacity: 1;
  color: var(--accent);
  transform: rotate(180deg);
}

/* ── Rows (virtualized: absolutely positioned within a fixed-height body) ── */
.rv-body {
  position: relative;
}

.rv-rowwrap {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  border-bottom: 1px solid var(--border);
  transition:
    background 0.15s,
    box-shadow 0.2s;
  background: var(--surface);
}
.rv-rowwrap.rv-animate {
  animation: rv-row-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: calc(min(var(--i, 0), 20) * 0.022s);
}
@keyframes rv-row-in {
  from {
    opacity: 0;
  }
}
.rv-rowwrap.issue {
  box-shadow: inset 3px 0 0 var(--warning);
}
.rv-rowwrap.expanded {
  background: color-mix(in srgb, var(--elevated) 55%, transparent);
  z-index: 2;
}
.rv-rowwrap.expanded .rv-editor {
  margin: 0 14px 12px;
  height: 128px;
}

.rv-row {
  display: grid;
  grid-template-columns: var(--grid);
  align-items: center;
  height: 56px;
  cursor: pointer;
  transition: background 0.14s;
}
.rv-row:hover {
  background: var(--hover);
}

/* Person cell */
.rv-person {
  display: flex;
  align-items: center;
  gap: 10px;
  border: none;
  background: transparent;
  font-family: var(--font);
  text-align: left;
  padding: 8px 14px;
  min-width: 0;
  cursor: pointer;
  border-radius: 8px;
}
.rv-person:disabled {
  cursor: default;
}
.rv-person:not(:disabled):hover .rv-pname {
  color: var(--accent);
}
.rv-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
  transition: transform 0.22s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.rv-person:not(:disabled):hover .rv-avatar {
  transform: scale(1.1);
}
.rv-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.rv-avatar-icon {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
  fill: rgba(255, 255, 255, 0.92);
}
.rv-pinfo {
  min-width: 0;
}
.rv-pname {
  font-size: 13px;
  font-weight: 600;
  color: var(--t1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.13s;
}
.rv-pname.unknown {
  color: var(--t3);
  font-style: italic;
}
.rv-psub {
  font-size: 11.5px;
  color: var(--t3);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Connector cell */
.rv-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  min-width: 0;
}
.rv-conn-pill {
  border: none;
  font-family: var(--font);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--rel-c);
  background: color-mix(in srgb, var(--rel-c) 13%, transparent);
  padding: 2px 9px;
  border-radius: 20px;
  cursor: default;
  line-height: 1.5;
  transition:
    background 0.15s,
    transform 0.15s;
}
.rv-conn-pill.toggleable {
  cursor: pointer;
}
.rv-conn-pill.toggleable:hover {
  background: color-mix(in srgb, var(--rel-c) 26%, transparent);
  transform: scale(1.06);
}
.rv-track-wrap {
  position: relative;
  width: 100%;
  max-width: 190px;
  height: 12px;
}

.rv-dot {
  position: absolute;
  top: 2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--rel-c);
  box-shadow: 0 0 6px color-mix(in srgb, var(--rel-c) 55%, transparent);
}
.rv-dot-left {
  left: 0;
}
.rv-dot-right {
  right: 0;
}

.rv-track {
  position: absolute;
  left: 7px;
  right: 12px;
  top: 5px;
  height: 2px;
  background: var(--rel-c);
  border-radius: 2px;
  transition: box-shadow 0.2s;
}
.rv-track.dashed {
  background: repeating-linear-gradient(90deg, var(--rel-c) 0 6px, transparent 6px 11px);
}
.rv-row:hover .rv-track {
  box-shadow: 0 0 8px color-mix(in srgb, var(--rel-c) 60%, transparent);
}
.rv-row:hover .rv-track.dashed {
  animation: rv-dash-flow 0.8s linear infinite;
  box-shadow: none;
}
@keyframes rv-dash-flow {
  to {
    background-position: 11px 0;
  }
}

.rv-arrow {
  position: absolute;
  right: 2px;
  top: 1px;
  width: 0;
  height: 0;
  border-left: 8px solid var(--rel-c);
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
  transition: transform 0.22s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.rv-row:hover .rv-arrow {
  transform: translateX(2px);
}

/* Spouse: double line (genealogy marriage notation) */
.rv-track-wrap.spouse .rv-dot {
  top: 2px;
}
.rv-track-top {
  top: 2px !important;
  left: 7px;
  right: 7px;
}
.rv-track-bottom {
  top: 8px !important;
  left: 7px;
  right: 7px;
}
/* Divorced: double line broken by two red slashes */
.rv-seg-left {
  right: calc(50% + 13px) !important;
}
.rv-seg-right {
  left: calc(50% + 13px) !important;
}
.rv-cut {
  position: absolute;
  top: -2px;
  left: 50%;
  width: 2px;
  height: 16px;
  border-radius: 2px;
  background: var(--danger);
}
.rv-cut-1 {
  transform: translateX(-9px) rotate(26deg);
}
.rv-cut-2 {
  transform: translateX(-1px) rotate(26deg);
}
.rv-track-wrap.divorced .rv-track,
.rv-track-wrap.divorced .rv-dot {
  opacity: 0.55;
}

/* Since cell */
.rv-since {
  padding: 0 8px;
}
.rv-since-input {
  width: 60px;
  height: 28px;
  padding: 0 7px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--t2);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 7px;
  text-align: center;
  transition:
    border-color 0.15s,
    background 0.15s,
    color 0.15s;
  appearance: textfield;
  -moz-appearance: textfield;
}
.rv-since-input::-webkit-outer-spin-button,
.rv-since-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.rv-row:hover .rv-since-input {
  border-color: var(--border);
  background: var(--elevated);
}
.rv-since-input:focus {
  border-color: var(--accent);
  background: var(--elevated);
  color: var(--t1);
  box-shadow: none;
}

/* Actions cell */
.rv-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  padding: 0 12px;
}
.rv-warn {
  display: inline-flex;
  color: var(--warning);
  margin-right: auto;
  cursor: help;
  animation: rv-warn-pulse 2.4s ease-in-out infinite;
}
@keyframes rv-warn-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}
.rv-action-btn {
  width: var(--ctl-sm);
  height: var(--ctl-sm);
  padding: 0;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: translateY(2px);
  transition:
    opacity 0.16s,
    transform 0.16s,
    background 0.13s,
    color 0.13s;
}
.rv-row:hover .rv-action-btn {
  opacity: 1;
  transform: translateY(0);
}
.rv-action-btn:nth-of-type(2) {
  transition-delay: 0.02s;
}
.rv-action-btn:nth-of-type(3) {
  transition-delay: 0.04s;
}
.rv-action-btn:hover {
  background: var(--hover);
  color: var(--t1);
}
.rv-action-del:hover {
  background: rgba(var(--danger-rgb), 0.14);
  color: var(--danger);
}

/* ── Empty state ─────────────────────────────────────────── */
.rv-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
  color: var(--t2);
}
.rv-empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--t3);
}
.rv-empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--t1);
}
.rv-empty-text {
  font-size: 13px;
  max-width: 300px;
}
.rv-empty .btn {
  margin-top: 8px;
}

/* ── 水墨 ink theme ───────────────────────────────────────────────────────
   The table is a mounted handscroll of bonds: rows on paper, each bond a
   brush stroke in its pigment with the type's character stamped on its pill;
   romantic bonds are the red thread of fate (红线), knotted — or cut. */
:root[data-theme='ink'] .rv {
  background: transparent;
}
:root[data-theme='ink'] .rv-toolbar {
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  backdrop-filter: none;
  border-bottom-color: transparent;
  box-shadow: 0 1px 0 rgba(48, 36, 20, 0.14);
}
:root[data-theme='ink'] .rv-title {
  position: relative;
  font-family: var(--font-brush);
  font-size: 25px;
  font-weight: 400;
  letter-spacing: 0.01em;
}
:root[data-theme='ink'] .rv-title::after {
  content: '';
  position: absolute;
  left: -3%;
  right: -6%;
  bottom: -5px;
  height: 7px;
  background-color: var(--accent);
  opacity: 0.75;
  -webkit-mask: var(--ink-underline) center / 100% 100% no-repeat;
  mask: var(--ink-underline) center / 100% 100% no-repeat;
  animation: rv-ink-write 0.9s 0.15s var(--ease-out) backwards;
}
@keyframes rv-ink-write {
  from {
    clip-path: inset(0 100% 0 0);
  }
  to {
    clip-path: inset(0 0 0 0);
  }
}
:root[data-theme='ink'] .rv-count {
  background: transparent;
  box-shadow: inset 0 0 0 1px rgba(179, 53, 42, 0.6);
  border-radius: 2px 3px 2px 4px;
  font-family: var(--font-ink-label);
  padding: 0 7px;
}
:root[data-theme='ink'] .rv-search :deep(.sf-input),
:root[data-theme='ink'] .rv-filter-btn,
:root[data-theme='ink'] .rv-chip,
:root[data-theme='ink'] .rv-fchip,
:root[data-theme='ink'] .rv-clear {
  border-radius: 3px 5px 4px 6px / 5px 3px 6px 4px;
  font-family: var(--font-ink-label);
}
:root[data-theme='ink'] .rv-search :deep(.sf-input) {
  background: rgba(255, 251, 240, 0.55);
  border-color: rgba(48, 36, 20, 0.2);
}
:root[data-theme='ink'] .rv-search :deep(.sf-input:focus) {
  border-color: rgba(179, 53, 42, 0.55);
  box-shadow: 0 0 0 3px rgba(179, 53, 42, 0.1);
}
:root[data-theme='ink'] .rv-filter-btn,
:root[data-theme='ink'] .rv-chip {
  background:
    radial-gradient(closest-side, rgba(40, 30, 18, 0.1), transparent) center / 0% 0% no-repeat,
    color-mix(in srgb, var(--surface) 70%, transparent);
  transition:
    background-size 0.5s var(--ease-out),
    color 0.18s,
    border-color 0.18s,
    transform 0.18s;
}
:root[data-theme='ink'] .rv-filter-btn:hover,
:root[data-theme='ink'] .rv-chip:hover {
  background-size:
    220% 220%,
    auto;
}
:root[data-theme='ink'] .rv-chip.active {
  background-color: color-mix(in srgb, var(--chip-c) 10%, var(--surface));
}
/* chip dots become little ink dabs */
:root[data-theme='ink'] .rv-chip-dot,
:root[data-theme='ink'] .rv-fchip-dot {
  border-radius: 46% 54% 40% 60% / 55% 42% 58% 45%;
}
:root[data-theme='ink'] .rv-filter-badge {
  border-radius: 2px;
  font-family: var(--font-ink-label);
}
:root[data-theme='ink'] .rv-filters {
  background: color-mix(in srgb, var(--surface) 60%, transparent);
}
:root[data-theme='ink'] .rv-seg.on {
  background: var(--accent);
  color: var(--on-accent);
}

/* the table is mounted on silk */
:root[data-theme='ink'] .rv-scroll {
  padding: 22px 30px 34px;
}
:root[data-theme='ink'] .rv-table {
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  border-color: var(--ink-mount-line);
  border-radius: 2px;
  box-shadow:
    0 0 0 4px var(--ink-silk),
    0 0 0 5px rgba(58, 42, 22, 0.2),
    0 12px 30px rgba(60, 40, 15, 0.14);
}
:root[data-theme='ink'] .rv-head {
  background: color-mix(in srgb, var(--ink-silk) 45%, var(--surface));
  border-bottom-color: rgba(48, 36, 20, 0.25);
}
:root[data-theme='ink'] .rv-th {
  font-family: var(--font-ink-label);
  font-size: 12.5px;
  font-weight: 600;
  font-variant: small-caps;
  text-transform: lowercase;
  letter-spacing: 0.14em;
  color: var(--t2);
}
:root[data-theme='ink'] .rv-rowwrap {
  background: transparent;
  border-bottom-color: rgba(48, 36, 20, 0.1);
}
:root[data-theme='ink'] .rv-rowwrap.issue {
  box-shadow: inset 3px 0 0 var(--ink-ochre);
}
:root[data-theme='ink'] .rv-rowwrap.expanded {
  background: rgba(214, 199, 166, 0.28);
}
/* hover: a wash of ink blooms across the row */
:root[data-theme='ink'] .rv-row {
  background: radial-gradient(closest-side, rgba(40, 30, 18, 0.075), transparent) center / 0% 0%
    no-repeat;
  transition: background-size 0.6s var(--ease-out);
}
:root[data-theme='ink'] .rv-row:hover {
  background-size: 130% 320%;
}
:root[data-theme='ink'] .rv-pname {
  font-family: var(--font-brush);
  font-size: 16px;
  font-weight: 400;
  letter-spacing: 0.01em;
}
:root[data-theme='ink'] .rv-avatar {
  box-shadow:
    0 0 0 2px var(--surface),
    0 0 0 3px rgba(48, 36, 20, 0.18);
}
:root[data-theme='ink'] .rv-avatar-icon {
  fill: rgba(251, 244, 230, 0.88);
}

/* the pill: the type's character in a tiny seal, then its name */
:root[data-theme='ink'] .rv-conn-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  font-family: var(--font-ink-label);
  font-size: 12.5px;
  font-weight: 600;
  font-variant: small-caps;
  text-transform: lowercase;
  letter-spacing: 0.1em;
  padding: 0 6px 0 0;
  border-radius: 2px;
}
:root[data-theme='ink'] .rv-conn-pill.toggleable:hover {
  background: color-mix(in srgb, var(--rel-c) 10%, transparent);
}
.rv-glyph {
  display: inline-grid;
  place-items: center;
  width: 17px;
  height: 17px;
  font-family: var(--font-brush);
  font-size: 13px;
  font-variant: normal;
  line-height: 1;
  letter-spacing: 0;
  color: #fbf4e6;
  background: var(--rel-c);
  border-radius: 2px 3px 2px 4px;
  box-shadow: inset 0 0 0 1px rgba(251, 244, 230, 0.35);
  transform: rotate(-4deg);
  transition: transform 0.4s var(--ease-spring);
}
.rv-row:hover .rv-glyph {
  transform: rotate(0deg) scale(1.1);
}

/* bonds are brush strokes: tapered, dry at the tail */
:root[data-theme='ink'] .rv-track {
  top: 2px;
  height: 8px;
  border-radius: 0;
  -webkit-mask: var(--ink-underline) center / 100% 100% no-repeat;
  mask: var(--ink-underline) center / 100% 100% no-repeat;
}
:root[data-theme='ink'] .rv-track.dashed {
  background: var(--rel-c);
  -webkit-mask:
    var(--ink-underline) center / 100% 100% no-repeat,
    repeating-linear-gradient(90deg, #000 0 10px, transparent 10px 15px);
  -webkit-mask-composite: source-in;
  mask:
    var(--ink-underline) center / 100% 100% no-repeat,
    repeating-linear-gradient(90deg, #000 0 10px, transparent 10px 15px);
  mask-composite: intersect;
}
:root[data-theme='ink'] .rv-row:hover .rv-track,
:root[data-theme='ink'] .rv-row:hover .rv-track.dashed {
  box-shadow: none;
  animation: none;
}
:root[data-theme='ink'] .rv-rowwrap.rv-animate .rv-track {
  animation: rv-ink-write 0.7s var(--ease-out) backwards;
  animation-delay: calc(0.1s + min(var(--i, 0), 20) * 0.03s);
}
:root[data-theme='ink'] .rv-dot {
  box-shadow: none;
  border-radius: 46% 54% 40% 60% / 55% 42% 58% 45%;
}
:root[data-theme='ink'] .rv-arrow {
  border-left-width: 9px;
}
:root[data-theme='ink'] .rv-cut {
  background: var(--accent);
}

/* 红线 — the red thread of fate */
.rv-thread {
  position: absolute;
  inset: -1px 0 0;
  width: 100%;
  height: 14px;
  overflow: visible;
  fill: none;
  stroke: var(--rel-c);
  stroke-linecap: round;
  stroke-linejoin: round;
}
.rv-thread.oneway {
  -webkit-mask: linear-gradient(90deg, #000 55%, rgba(0, 0, 0, 0.3));
  mask: linear-gradient(90deg, #000 55%, rgba(0, 0, 0, 0.3));
}
.rv-thread-line {
  stroke-width: 1.3px;
  vector-effect: non-scaling-stroke;
  stroke-dasharray: 260;
  stroke-dashoffset: 0;
  animation: rv-thread-draw 1.1s var(--ease-out) backwards;
}
.rv-thread-knot {
  stroke-width: 1.5px;
  vector-effect: non-scaling-stroke;
  transform-box: fill-box;
  transform-origin: center;
  animation: rv-thread-knot 0.6s 0.7s var(--ease-spring) backwards;
}
.rv-thread-fray {
  stroke-width: 1px;
  vector-effect: non-scaling-stroke;
  opacity: 0.8;
}
.rv-row:hover .rv-thread-knot {
  animation: rv-thread-tug 0.7s var(--ease-spring);
}
@keyframes rv-thread-draw {
  from {
    stroke-dashoffset: 260;
  }
}
@keyframes rv-thread-knot {
  from {
    transform: scale(0);
    opacity: 0;
  }
}
@keyframes rv-thread-tug {
  40% {
    transform: scale(1.35) rotate(-10deg);
  }
}

:root[data-theme='ink'] .rv-since-input {
  font-family: var(--font-ink-label);
  font-size: 13px;
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}
:root[data-theme='ink'] .rv-row:hover .rv-since-input {
  background: rgba(255, 251, 240, 0.6);
  border-color: rgba(48, 36, 20, 0.18);
}
:root[data-theme='ink'] .rv-warn {
  color: var(--ink-ochre);
}
:root[data-theme='ink'] .rv-action-btn {
  border-radius: 3px;
}

/* editors: a sheet of paper laid on the scroll */
:root[data-theme='ink'] .rv-editor {
  border-radius: 2px;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  border-color: var(--ink-mount-line);
}
:root[data-theme='ink'] .rv-editor-label {
  font-family: var(--font-brush);
  font-size: 17px;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0.02em;
  color: var(--t1);
}

/* empty state: the ensō, drawn in */
:root[data-theme='ink'] .rv-empty-icon {
  position: relative;
  display: grid;
  place-items: center;
  width: 110px;
  height: 110px;
  color: var(--t2);
}
:root[data-theme='ink'] .rv-empty-icon .ui-icon {
  width: 34px;
  height: 34px;
}
:root[data-theme='ink'] .rv-empty-icon::before {
  content: '';
  position: absolute;
  inset: 0;
  background-color: var(--ink-black);
  opacity: 0.8;
  -webkit-mask: var(--ink-enso) center / contain no-repeat;
  mask: var(--ink-enso) center / contain no-repeat;
  animation: ink-enso-draw 1.4s var(--ease-out) both;
}
:root[data-theme='ink'] .rv-empty-title {
  font-family: var(--font-brush);
  font-size: 22px;
  font-weight: 400;
}
@media (prefers-reduced-motion: reduce) {
  .rv-thread-line,
  .rv-thread-knot,
  .rv-row:hover .rv-thread-knot {
    animation: none;
  }
}
</style>
