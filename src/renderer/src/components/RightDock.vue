<template>
  <!-- Collapsed: a slim strip with just the expand handle -->
  <aside v-if="collapsed" class="right-dock collapsed">
    <button
      class="dock-collapse"
      :title="t('dock.expand')"
      :aria-label="t('dock.expand')"
      @click="$emit('toggle-collapse')"
    >
      <UiIcon name="chevron-left" :size="16" />
    </button>
  </aside>

  <aside v-else class="right-dock">
    <div class="dock-tabs">
      <button
        class="dock-tab"
        :class="{ active: store.inspectorTab === 'inspector' }"
        @click="store.inspectorTab = 'inspector'"
      >
        {{ t('dock.inspector') }}
      </button>
      <button
        class="dock-tab"
        :class="{ active: store.inspectorTab === 'directory' }"
        @click="store.inspectorTab = 'directory'"
      >
        {{ t('rail.directory') }}
      </button>
      <button
        class="dock-collapse"
        :title="t('dock.collapse')"
        :aria-label="t('dock.collapse')"
        @click="$emit('toggle-collapse')"
      >
        <UiIcon name="chevron-right" :size="16" />
      </button>
    </div>

    <!-- Inspector: the selected entity's details + quick edit -->
    <div v-if="store.inspectorTab === 'inspector'" class="dock-body inspector">
      <template v-if="person">
        <div class="insp-hero">
          <div
            class="insp-avatar"
            :style="{ background: avatarGradient(person.gender, person.id) }"
          >
            <img
              v-if="person.primary_image && imageUrl(person.primary_image)"
              class="insp-avatar-img"
              :src="imageUrl(person.primary_image)"
              alt=""
            />
            <span v-else class="insp-initials">{{ initials(person.name) }}</span>
          </div>
          <div class="insp-name">{{ person.name || t('directory.common.unnamed') }}</div>
          <div class="insp-dates">
            <template v-if="person.birth?.year || person.death?.year">
              {{ person.birth?.year || '?' }}
              <template v-if="person.death?.year"> – {{ person.death.year }}</template>
            </template>
            <template v-else>{{ t('dock.noDates') }}</template>
          </div>
        </div>

        <div class="insp-fields">
          <div v-if="person.occupation" class="insp-field">
            <span class="insp-label">{{ t('data.fields.occupation') }}</span
            >{{ person.occupation }}
          </div>
          <div v-if="person.location" class="insp-field">
            <span class="insp-label">{{ t('data.fields.location') }}</span
            >{{ person.location }}
          </div>
          <div v-if="person.bio" class="insp-field insp-bio">
            <span class="insp-label">{{ t('data.fields.bio') }}</span
            >{{ person.bio }}
          </div>
        </div>

        <div v-if="store.caps.tags" class="insp-section">
          <div class="insp-label">{{ t('dock.tags') }}</div>
          <TagChipsEditor :entity-id="person.id" />
        </div>

        <div class="insp-actions">
          <button class="btn btn-ghost btn-sm" @click="store.selectPerson(person.id)">
            {{ t('dock.openProfile') }}
          </button>
          <button class="btn btn-primary btn-sm" @click="store.openForm(person)">
            <UiIcon name="pencil" :size="14" />
            {{ t('dock.edit') }}
          </button>
        </div>
      </template>

      <div v-else class="insp-empty">
        <div class="insp-empty-icon">
          <UiIcon name="mouse-pointer-click" :size="28" :stroke="1.6" />
        </div>
        <div class="insp-empty-text">
          {{ t('dock.emptyHint') }}
        </div>
      </div>
    </div>

    <!-- Directory: the searchable, draggable roster -->
    <RightSidebar v-else class="dock-body" />
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useMainStore } from '../store/index.js'
import { useI18n } from '../i18n'
import { api } from '../api'
import RightSidebar from './RightSidebar.vue'
import TagChipsEditor from './TagChipsEditor.vue'
import { inkAvatarBg } from './ui/inkChrome'
import { medievalAvatarBg } from '../lib/medievalArt'
import UiIcon from './ui/UiIcon.js'

// The tabbed, collapsible right dock: Inspector (selection details + quick
// edit) and Directory (the draggable member roster, dragged onto a canvas to
// place/assign).
const store = useMainStore()
const { t } = useI18n()

defineProps({ collapsed: { type: Boolean, default: false } })
defineEmits(['toggle-collapse'])

const person = computed(() => store.selectedPerson)

function imageUrl(filename) {
  return api.getImageUrl(filename) || ''
}

function initials(name) {
  return (name || '?')
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function avatarGradient(gender, id) {
  if (store.isInk) return inkAvatarBg(gender)
  if (store.isMedieval) return medievalAvatarBg(gender, id) // their coat of arms
  if (gender === 'male') return 'linear-gradient(135deg, #3a7bd5, #2351a0)'
  if (gender === 'female') return 'linear-gradient(135deg, #c95fa0, #923075)'
  return 'linear-gradient(135deg, #5c6bc0, #3c4a9e)'
}
</script>

<style scoped>
.right-dock {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-left: 1px solid var(--border);
  min-width: 0;
  overflow: hidden;
}

.right-dock.collapsed {
  align-items: center;
  padding-top: 8px;
}

.dock-tabs {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 8px 0;
  border-bottom: 1px solid var(--border);
}

.dock-tab {
  flex: 1;
  padding: 7px 10px 9px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--t3);
  font-size: 12.5px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  transition:
    color 0.12s,
    border-color 0.12s;
}

.dock-tab:hover {
  color: var(--t1);
}

.dock-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.dock-collapse {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--ctl-sm);
  height: var(--ctl-sm);
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  flex-shrink: 0;
}
.dock-tabs .dock-collapse {
  margin-bottom: 4px;
}

.dock-collapse:hover {
  background: var(--hover);
  color: var(--t1);
}

.dock-body {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ── Inspector ── */
.inspector {
  overflow-y: auto;
  padding: 16px 14px;
  gap: 14px;
}

.insp-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}

.insp-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.insp-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.insp-initials {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}

.insp-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--t1);
}

.insp-dates {
  font-size: 12.5px;
  color: var(--t3);
}

.insp-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.insp-field {
  font-size: 13px;
  color: var(--t2);
}

.insp-bio {
  white-space: pre-wrap;
}

.insp-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--t3);
  margin-bottom: 3px;
}

.insp-section {
  display: flex;
  flex-direction: column;
}

.insp-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  padding-top: 4px;
}

.insp-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  padding: 24px;
}

.insp-empty-icon {
  display: flex;
  color: var(--t3);
}

.insp-empty-text {
  font-size: 12.5px;
  color: var(--t3);
  line-height: 1.6;
  max-width: 200px;
}

/* ── 水墨 ink theme: the dock is a side panel of the mount — paper with a
   silk band along its inner edge; the active tab is underlined by a brush ── */
:root[data-theme='ink'] .right-dock {
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  border-left-color: var(--ink-mount-line);
  box-shadow:
    inset 4px 0 0 var(--ink-silk),
    inset 5px 0 0 rgba(58, 42, 22, 0.18);
}
:root[data-theme='ink'] .dock-tabs {
  border-bottom-color: rgba(48, 36, 20, 0.14);
  padding-left: 12px;
}
:root[data-theme='ink'] .dock-tab {
  position: relative;
  border-bottom: none;
  font-family: var(--font-ink-label);
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: 0.03em;
}
:root[data-theme='ink'] .dock-tab::after {
  content: '';
  position: absolute;
  left: 14%;
  right: 14%;
  bottom: 1px;
  height: 6px;
  background-color: var(--accent);
  -webkit-mask: var(--ink-underline) center / 100% 100% no-repeat;
  mask: var(--ink-underline) center / 100% 100% no-repeat;
  clip-path: inset(0 100% 0 0);
  transition: clip-path 0.5s var(--ease-out);
}
:root[data-theme='ink'] .dock-tab.active::after {
  clip-path: inset(0 0 0 0);
}
:root[data-theme='ink'] .dock-tab:hover:not(.active)::after {
  background-color: rgba(28, 26, 23, 0.3);
  clip-path: inset(0 0 0 0);
}
:root[data-theme='ink'] .dock-collapse {
  border-radius: 3px;
}
:root[data-theme='ink'] .insp-avatar {
  box-shadow:
    0 0 0 3px var(--surface),
    0 0 0 4px rgba(48, 36, 20, 0.2);
}
:root[data-theme='ink'] .insp-initials {
  font-family: var(--font-brush);
  font-weight: 400;
  font-size: 24px;
  color: #fbf4e6;
}
:root[data-theme='ink'] .insp-name {
  font-family: var(--font-brush);
  font-size: 22px;
  font-weight: 400;
}
:root[data-theme='ink'] .insp-label {
  font-family: var(--font-ink-label);
  font-size: 12.5px;
  font-weight: 600;
  font-variant: small-caps;
  text-transform: lowercase;
  letter-spacing: 0.12em;
}
:root[data-theme='ink'] .insp-field {
  font-size: 13.5px;
}
:root[data-theme='ink'] .insp-empty-icon {
  position: relative;
  width: 84px;
  height: 84px;
  display: grid;
  place-items: center;
  color: var(--accent);
}
:root[data-theme='ink'] .insp-empty-icon .ui-icon {
  width: 24px;
  height: 24px;
}
:root[data-theme='ink'] .insp-empty-icon::before {
  content: '';
  position: absolute;
  inset: 0;
  background-color: var(--ink-black);
  -webkit-mask: var(--ink-enso) center / contain no-repeat;
  mask: var(--ink-enso) center / contain no-repeat;
  animation: ink-enso-draw 1.4s var(--ease-out) both;
}
:root[data-theme='ink'] .insp-empty-text {
  font-size: 13px;
}
</style>
