<template>
  <div class="tag-editor">
    <!-- Assigned tags as chips -->
    <div v-if="assignedTags.length" class="tag-chips">
      <span
        v-for="tag in assignedTags"
        :key="tag.id"
        class="tag-chip"
        :style="{ '--chip-c': tag.color }"
      >
        <input
          type="color"
          class="chip-color"
          :value="tag.color"
          title="Tag color"
          @input="store.updateTag({ id: tag.id, color: $event.target.value })"
        />
        <span class="chip-label">{{ tag.icon ? tag.icon + ' ' : '' }}{{ tag.label }}</span>
        <span v-if="tag.type" class="chip-type" :title="`Tag type: ${tag.type}`">{{
          tag.type
        }}</span>
        <button class="chip-remove" title="Remove tag" @click="removeTag(tag.id)">✕</button>
      </span>
    </div>
    <div v-else class="tag-empty">No tags yet.</div>

    <!-- Assign an existing tag -->
    <div class="tag-add-row">
      <select v-model="selectedTagId" class="tag-select">
        <option value="">Add existing tag…</option>
        <option v-for="tag in availableTags" :key="tag.id" :value="tag.id">
          {{ tag.label }}
        </option>
      </select>
      <button class="btn btn-ghost btn-sm" :disabled="!selectedTagId" @click="assignSelected">
        Assign
      </button>
    </div>

    <!-- Create a new tag and assign it -->
    <div class="tag-add-row">
      <input
        v-model="newLabel"
        class="tag-new-input"
        placeholder="New tag label…"
        @keydown.enter="createAndAssign"
      />
      <input
        v-model="newType"
        class="tag-new-input tag-type-input"
        placeholder="type (optional)"
        list="tag-type-suggestions"
        title="Tags with the same type can be compared in the Groups view (e.g. 'family')"
        @keydown.enter="createAndAssign"
      />
      <datalist id="tag-type-suggestions">
        <option v-for="t in knownTypes" :key="t" :value="t" />
      </datalist>
      <input v-model="newColor" type="color" class="tag-new-color" title="Tag color" />
      <button class="btn btn-ghost btn-sm" :disabled="!newLabel.trim()" @click="createAndAssign">
        ＋ Add
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useMainStore } from '../store/index.js'

const props = defineProps({
  entityId: { type: String, required: true }
})

const store = useMainStore()
const selectedTagId = ref('')
const newLabel = ref('')
const newType = ref('')
const newColor = ref('#6c8ef5')

const assignedTags = computed(() => store.tagsOf.get(props.entityId) || [])
/** Types already used in this project, for the datalist suggestions. */
const knownTypes = computed(() => [...new Set(store.tags.map((t) => t.type).filter(Boolean))])
const availableTags = computed(() => {
  const assigned = new Set(assignedTags.value.map((t) => t.id))
  return store.tags.filter((t) => !assigned.has(t.id) && t.source !== 'derived')
})

async function assignSelected() {
  if (!selectedTagId.value) return
  await store.addEntityTag(props.entityId, selectedTagId.value)
  selectedTagId.value = ''
}

async function createAndAssign() {
  const label = newLabel.value.trim()
  if (!label) return
  const res = await store.createTag({
    label,
    color: newColor.value,
    type: newType.value.trim()
  })
  if (res.success) {
    await store.addEntityTag(props.entityId, res.data.id)
    newLabel.value = ''
    newType.value = ''
  }
}

function removeTag(tagId) {
  store.removeEntityTag(props.entityId, tagId)
}
</script>

<style scoped>
.tag-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--chip-c);
  background: color-mix(in srgb, var(--chip-c) 14%, transparent);
  color: var(--t1);
  font-size: 12px;
  font-weight: 500;
}

.chip-color {
  width: 14px;
  height: 14px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  cursor: pointer;
}

.chip-color::-webkit-color-swatch-wrapper {
  padding: 0;
}

.chip-color::-webkit-color-swatch {
  border: none;
  border-radius: 50%;
}

.chip-label {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-type {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--t3);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 1px 5px;
}

.tag-type-input {
  flex: 0 1 120px;
}

.chip-remove {
  border: none;
  background: transparent;
  color: var(--t3);
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.chip-remove:hover {
  color: #ef5350;
}

.tag-empty {
  font-size: 12px;
  color: var(--t3);
}

.tag-add-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tag-select,
.tag-new-input {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12px;
  outline: none;
}

.tag-select:focus,
.tag-new-input:focus {
  border-color: var(--accent);
}

.tag-new-color {
  width: 28px;
  height: 28px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--elevated);
  cursor: pointer;
  flex-shrink: 0;
}
</style>
