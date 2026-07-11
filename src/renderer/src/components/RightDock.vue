<template>
  <!-- Collapsed: a slim strip with just the expand handle -->
  <aside v-if="collapsed" class="right-dock collapsed">
    <button class="dock-collapse" title="Expand panel" @click="$emit('toggle-collapse')">◀</button>
  </aside>

  <aside v-else class="right-dock">
    <div class="dock-tabs">
      <button
        class="dock-tab"
        :class="{ active: store.inspectorTab === 'inspector' }"
        @click="store.inspectorTab = 'inspector'"
      >
        Inspector
      </button>
      <button
        class="dock-tab"
        :class="{ active: store.inspectorTab === 'directory' }"
        @click="store.inspectorTab = 'directory'"
      >
        Directory
      </button>
      <button class="dock-collapse" title="Collapse panel" @click="$emit('toggle-collapse')">
        ▶
      </button>
    </div>

    <!-- Inspector: the selected entity's details + quick edit -->
    <div v-if="store.inspectorTab === 'inspector'" class="dock-body inspector">
      <template v-if="person">
        <div class="insp-hero">
          <div class="insp-avatar" :style="{ background: avatarGradient(person.gender) }">
            <img
              v-if="person.primary_image && imageUrl(person.primary_image)"
              class="insp-avatar-img"
              :src="imageUrl(person.primary_image)"
              alt=""
            />
            <span v-else class="insp-initials">{{ initials(person.name) }}</span>
          </div>
          <div class="insp-name">{{ person.name || 'Unnamed' }}</div>
          <div class="insp-dates">
            <template v-if="person.birth?.year || person.death?.year">
              {{ person.birth?.year || '?' }}
              <template v-if="person.death?.year"> – {{ person.death.year }}</template>
            </template>
            <template v-else>No dates recorded</template>
          </div>
        </div>

        <div class="insp-fields">
          <div v-if="person.occupation" class="insp-field">
            <span class="insp-label">Occupation</span>{{ person.occupation }}
          </div>
          <div v-if="person.location" class="insp-field">
            <span class="insp-label">Location</span>{{ person.location }}
          </div>
          <div v-if="person.bio" class="insp-field insp-bio">
            <span class="insp-label">Bio</span>{{ person.bio }}
          </div>
        </div>

        <div v-if="store.caps.tags" class="insp-section">
          <div class="insp-label">Tags</div>
          <TagChipsEditor :entity-id="person.id" />
        </div>

        <div class="insp-actions">
          <button class="btn btn-ghost btn-sm" @click="store.selectPerson(person.id)">
            Open profile
          </button>
          <button class="btn btn-primary btn-sm" @click="store.openForm(person)">✎ Edit</button>
        </div>
      </template>

      <div v-else class="insp-empty">
        <div class="insp-empty-icon">◈</div>
        <div class="insp-empty-text">
          Select a person on the canvas — or pick one from the Directory tab — to inspect and edit
          them here.
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
import { api } from '../api'
import RightSidebar from './RightSidebar.vue'
import TagChipsEditor from './TagChipsEditor.vue'

// The tabbed, collapsible right dock: Inspector (selection details + quick
// edit) and Directory (the draggable member roster, dragged onto a canvas to
// place/assign).
const store = useMainStore()

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

function avatarGradient(gender) {
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
  font-size: 12px;
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
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--t3);
  font-size: 10px;
  cursor: pointer;
  flex-shrink: 0;
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
  font-size: 12px;
  color: var(--t3);
}

.insp-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.insp-field {
  font-size: 12.5px;
  color: var(--t2);
}

.insp-bio {
  white-space: pre-wrap;
}

.insp-label {
  display: block;
  font-size: 10px;
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
  font-size: 28px;
  opacity: 0.5;
}

.insp-empty-text {
  font-size: 12px;
  color: var(--t3);
  line-height: 1.6;
  max-width: 200px;
}
</style>
