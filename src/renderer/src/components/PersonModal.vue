<template>
  <Transition name="modal">
    <div
      v-if="store.modalOpen && store.selectedPerson"
      class="modal-backdrop"
      @click.self="store.closeModal()"
    >
      <div class="modal-box">
        <!-- Hero -->
        <div class="modal-hero" :style="{ background: heroGradient(store.selectedPerson.gender) }">
          <button class="modal-close" @click="store.closeModal()">✕</button>
          <div class="hero-avatar">{{ initials(store.selectedPerson.name) }}</div>
          <div class="hero-name">{{ store.selectedPerson.name }}</div>
          <div class="hero-dates">
            <span v-if="store.selectedPerson.birth_year">b. {{ store.selectedPerson.birth_year }}</span>
            <span v-if="store.selectedPerson.birth_year && store.selectedPerson.death_year"> – </span>
            <span v-if="store.selectedPerson.death_year">d. {{ store.selectedPerson.death_year }}</span>
            <span v-if="!store.selectedPerson.birth_year && !store.selectedPerson.death_year" class="text-muted">No dates recorded</span>
          </div>
          <div v-if="store.selectedPerson.location" class="hero-location">📍 {{ store.selectedPerson.location }}</div>
        </div>

        <!-- Body -->
        <div class="modal-body">
          <!-- Fields Grid -->
          <div class="fields-grid">
            <div class="field-item">
              <div class="field-label">Full Name</div>
              <div class="field-value">{{ store.selectedPerson.name }}</div>
            </div>
            <div class="field-item">
              <div class="field-label">Born – Died</div>
              <div class="field-value">
                {{ store.selectedPerson.birth_year || '—' }}
                <span v-if="store.selectedPerson.death_year"> – {{ store.selectedPerson.death_year }}</span>
              </div>
            </div>
            <div class="field-item">
              <div class="field-label">Gender</div>
              <div class="field-value" style="text-transform: capitalize;">{{ store.selectedPerson.gender || '—' }}</div>
            </div>
            <div class="field-item">
              <div class="field-label">Occupation</div>
              <div class="field-value">{{ store.selectedPerson.occupation || '—' }}</div>
            </div>
            <div class="field-item" style="grid-column: span 2;">
              <div class="field-label">Location</div>
              <div class="field-value">{{ store.selectedPerson.location || '—' }}</div>
            </div>
          </div>

          <!-- Bio -->
          <div v-if="store.selectedPerson.bio" class="section">
            <div class="section-label">Biography</div>
            <p class="bio-text">{{ store.selectedPerson.bio }}</p>
          </div>

          <!-- Photos -->
          <div v-if="images.length > 0" class="section">
            <div class="section-label">Photos</div>
            <div class="photo-gallery">
              <div
                v-for="img in images"
                :key="img.id"
                class="photo-thumb"
                :class="{ primary: img.is_primary }"
              >
                <img :src="imageUrl(img.file_path)" :alt="store.selectedPerson.name" />
                <div v-if="img.is_primary" class="primary-badge">Primary</div>
              </div>
            </div>
          </div>

          <!-- Relationships -->
          <div v-if="relationshipChips.length > 0" class="section">
            <div class="section-label">Relationships</div>
            <div class="chips-wrap">
              <button
                v-for="chip in relationshipChips"
                :key="chip.id"
                class="rel-chip"
                :class="chip.colorClass"
                @click="store.selectPerson(chip.otherId)"
              >
                <span class="chip-role">{{ chip.role }}</span>
                <span class="chip-name">{{ chip.name }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="store.openForm(store.selectedPerson)">
            ✏ Edit
          </button>
          <button class="btn btn-danger" @click="handleDelete">
            🗑 Delete
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useMainStore } from '../store/index.js'
import { api } from '../api.js'

const store = useMainStore()
const images = ref([])

async function loadImages(personId) {
  if (!personId) { images.value = []; return }
  const res = await api.invoke('images:getByPerson', { personId })
  if (res.success) images.value = res.data
  else images.value = []
}

watch(() => store.selectedPerson, (p) => {
  if (p) loadImages(p.id)
  else images.value = []
}, { immediate: true })

function imageUrl(filePath) {
  return api.getImageUrl(filePath) || ''
}

function initials(name) {
  const parts = (name || '').trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.substring(0, 2).toUpperCase()
}

function heroGradient(gender) {
  if (gender === 'male') return 'linear-gradient(135deg, #2351a0 0%, #3a7bd5 100%)'
  if (gender === 'female') return 'linear-gradient(135deg, #923075 0%, #c95fa0 100%)'
  return 'linear-gradient(135deg, #3c4a9e 0%, #5c6bc0 100%)'
}

const relationshipChips = computed(() => {
  if (!store.selectedPerson) return []
  const pid = store.selectedPerson.id
  const chips = []

  store.relationships.forEach(r => {
    if (r.person_a_id !== pid && r.person_b_id !== pid) return

    const otherId = r.person_a_id === pid ? r.person_b_id : r.person_a_id
    const other = store.persons.find(p => p.id === otherId)
    if (!other) return

    let role = ''
    let colorClass = ''

    if (r.type === 'spouse') {
      role = other.gender === 'male' ? 'Husband' : other.gender === 'female' ? 'Wife' : 'Spouse'
      colorClass = 'chip-pink'
    } else if (r.type === 'parent_child') {
      if (r.person_a_id === pid) {
        // selected is parent, other is child
        role = other.gender === 'male' ? 'Son' : other.gender === 'female' ? 'Daughter' : 'Child'
        colorClass = 'chip-green'
      } else {
        // selected is child, other is parent
        role = other.gender === 'male' ? 'Father' : other.gender === 'female' ? 'Mother' : 'Parent'
        colorClass = 'chip-amber'
      }
    } else if (r.type === 'adopted') {
      if (r.person_a_id === pid) {
        role = 'Adopted Child'
        colorClass = 'chip-green'
      } else {
        role = 'Adoptive Parent'
        colorClass = 'chip-amber'
      }
    }

    chips.push({ id: r.id, role, name: other.name, otherId, colorClass })
  })

  return chips
})

async function handleDelete() {
  if (!store.selectedPerson) return
  const name = store.selectedPerson.name
  if (!confirm(`Delete ${name}? This cannot be undone.`)) return
  await store.deletePerson(store.selectedPerson.id)
  store.closeModal()
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}

.modal-box {
  background: var(--surface);
  border-radius: var(--radius);
  width: 100%;
  max-width: 640px;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow);
  border: 1px solid var(--border);
}

/* Hero */
.modal-hero {
  padding: 28px 24px 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  position: relative;
  flex-shrink: 0;
}

.modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.13s;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.28);
}

.hero-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 12px;
}

.hero-name {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 4px;
}

.hero-dates {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
  margin-bottom: 4px;
}

.hero-location {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
}

/* Body */
.modal-body {
  flex: 1 1 0;
  overflow-y: auto;
  padding: 24px 28px;
  min-height: 320px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.fields-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.field-item {
  background: var(--elevated);
  border-radius: 8px;
  padding: 12px 14px;
}

.field-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--t3);
  margin-bottom: 3px;
}

.field-value {
  font-size: 13px;
  color: var(--t1);
  font-weight: 500;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--t3);
}

.bio-text {
  font-size: 13px;
  color: var(--t2);
  line-height: 1.6;
  background: var(--elevated);
  border-radius: 8px;
  padding: 12px 14px;
}

/* Photo gallery */
.photo-gallery {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.photo-thumb {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  border: 2px solid var(--border);
  transition: border-color 0.13s;
}

.photo-thumb.primary {
  border-color: var(--accent);
}

.photo-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.primary-badge {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(108, 142, 245, 0.85);
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  text-align: center;
  padding: 2px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Relationship chips */
.chips-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.rel-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border-radius: 20px;
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-family: var(--font);
  font-weight: 500;
  transition: opacity 0.13s, transform 0.13s;
}

.rel-chip:hover {
  opacity: 0.85;
  transform: translateY(-1px);
}

.chip-pink {
  background: rgba(240, 98, 146, 0.15);
  color: #f06292;
}

.chip-green {
  background: rgba(76, 175, 114, 0.15);
  color: #4caf72;
}

.chip-amber {
  background: rgba(245, 166, 35, 0.15);
  color: #f5a623;
}

.chip-role {
  font-weight: 700;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.chip-name {
  font-size: 12px;
}

/* Footer */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
</style>
