<template>
  <Transition name="slide">
    <div
      v-if="store.formOpen"
      class="form-backdrop"
      @click.self="store.closeForm()"
    >
      <div class="form-panel">
        <!-- Header -->
        <div class="form-header">
          <h2 class="form-title">{{ formTitle }}</h2>
          <button class="icon-btn" @click="store.closeForm()">✕</button>
        </div>

        <!-- Scrollable body -->
        <div class="form-body">
          <!-- Basic Info -->
          <div class="form-section">
            <div class="form-section-label">Basic Information</div>
            <div class="form-row">
              <div class="form-field">
                <label class="field-label">First Name <span class="required">*</span></label>
                <input
                  v-model="form.firstName"
                  placeholder="e.g. John"
                  :class="{ 'input-error': errors.firstName }"
                  @input="errors.firstName = ''"
                />
                <span v-if="errors.firstName" class="error-text">{{ errors.firstName }}</span>
              </div>
              <div class="form-field">
                <label class="field-label">Last Name</label>
                <input v-model="form.lastName" placeholder="e.g. Smith" />
              </div>
            </div>

            <div class="form-field">
              <label class="field-label">Gender</label>
              <select v-model="form.gender">
                <option value="unknown">Unknown</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div class="form-row">
              <div class="form-field">
                <label class="field-label">Birth Year</label>
                <input
                  v-model.number="form.birthYear"
                  type="number"
                  placeholder="e.g. 1950"
                  min="1"
                  max="2100"
                />
              </div>
              <div class="form-field">
                <label class="field-label">Death Year</label>
                <input
                  v-model.number="form.deathYear"
                  type="number"
                  placeholder="e.g. 2020"
                  min="1"
                  max="2100"
                />
              </div>
            </div>

            <div class="form-field">
              <label class="field-label">Occupation</label>
              <input v-model="form.occupation" placeholder="e.g. Engineer, Teacher…" />
            </div>

            <div class="form-field">
              <label class="field-label">Location</label>
              <input v-model="form.location" placeholder="e.g. New York, NY" />
            </div>

            <div class="form-field">
              <label class="field-label">Biography</label>
              <textarea
                v-model="form.bio"
                placeholder="A short biography or notes about this person…"
                rows="3"
              ></textarea>
            </div>
          </div>

          <!-- Relationships -->
          <div class="form-section">
            <div class="form-section-label">Relationships</div>

            <!-- Existing relationships (edit mode) -->
            <div v-if="store.editingPerson && existingRels.length > 0" class="existing-rels">
              <div
                v-for="rel in existingRels"
                :key="rel.id"
                class="rel-card"
              >
                <div class="rel-card-top">
                  <span class="chip-rel-type">{{ rel.roleLabel }}</span>
                  <span class="chip-person-name">{{ rel.otherName }}</span>
                  <span v-if="rel.status === 'divorced'" class="chip-divorced">Divorced</span>
                  <button class="chip-remove" @click="removeExistingRel(rel.id)">✕</button>
                </div>
                <div class="rel-card-fields">
                  <div v-if="rel.relType === 'spouse'" class="rel-inline-field">
                    <label class="rel-field-label">Status</label>
                    <select :value="rel.status" @change="updateExistingRelStatus(rel.id, $event.target.value)" class="rel-mini-select">
                      <option value="active">Married</option>
                      <option value="divorced">Divorced</option>
                    </select>
                  </div>
                  <div class="rel-inline-field">
                    <label class="rel-field-label">{{ rel.relType === 'spouse' ? 'Married' : 'Since' }}</label>
                    <input type="number" :value="rel.formedDate" @change="updateExistingRelDate(rel.id, $event.target.value)" class="rel-mini-input" placeholder="Year" min="1" max="2100" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Pending new relationships -->
            <div v-if="pendingLinks.length > 0" class="existing-rels">
              <div
                v-for="(link, idx) in pendingLinks"
                :key="'p'+idx"
                class="rel-card rel-card-new"
              >
                <div class="rel-card-top">
                  <span class="chip-rel-type">{{ relTypeLabel(link.relType) }}</span>
                  <span class="chip-person-name">{{ personName(link.personId) }}</span>
                  <button class="chip-remove" @click="removeLink(idx)">✕</button>
                </div>
                <div class="rel-card-fields">
                  <div v-if="link.relType === 'spouse_of'" class="rel-inline-field">
                    <label class="rel-field-label">Status</label>
                    <select v-model="link.divorced" class="rel-mini-select">
                      <option :value="false">Married</option>
                      <option :value="true">Divorced</option>
                    </select>
                  </div>
                  <div class="rel-inline-field">
                    <label class="rel-field-label">{{ link.relType === 'spouse_of' ? 'Married' : 'Since' }}</label>
                    <input type="number" v-model.number="link.formedDate" class="rel-mini-input" placeholder="Year" min="1" max="2100" />
                  </div>
                </div>
              </div>
            </div>

            <div class="link-add-row">
              <select v-model="newLink.personId" class="link-select">
                <option value="">Select person…</option>
                <option
                  v-for="p in availablePersons"
                  :key="p.id"
                  :value="p.id"
                >{{ p.name }}</option>
              </select>
              <select v-model="newLink.relType" class="link-select">
                <option value="child_of">Is child of</option>
                <option value="parent_of">Is parent of</option>
                <option value="spouse_of">Is spouse of</option>
                <option value="adopted_by">Was adopted by</option>
              </select>
              <button
                class="btn btn-ghost btn-sm"
                :disabled="!newLink.personId"
                @click="addLink"
              >
                ＋ Add
              </button>
            </div>
          </div>

          <!-- Photos (edit only) -->
          <div v-if="store.editingPerson" class="form-section">
            <div class="form-section-label">Photos</div>
            <div v-if="photos.length > 0" class="photo-gallery">
              <div
                v-for="photo in photos"
                :key="photo.id"
                class="photo-thumb"
                :class="{ primary: photo.is_primary }"
              >
                <img :src="photoUrl(photo.file_path)" :alt="'Photo'" />
                <div class="photo-overlay">
                  <button
                    v-if="!photo.is_primary"
                    class="photo-action-btn"
                    title="Set as primary"
                    @click="setPrimary(photo)"
                  >⭐</button>
                  <button
                    class="photo-action-btn photo-delete-btn"
                    title="Delete photo"
                    @click="deletePhoto(photo)"
                  >🗑</button>
                </div>
                <div v-if="photo.is_primary" class="primary-badge">Primary</div>
              </div>
            </div>
            <button class="btn btn-ghost btn-sm" @click="addPhoto">
              📷 Add Photo
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="form-footer">
          <button class="btn btn-ghost" @click="store.closeForm()">Cancel</button>
          <button class="btn btn-primary" :disabled="submitting" @click="handleSubmit">
            {{ submitting ? 'Saving…' : (store.editingPerson ? 'Save Changes' : 'Create Person') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useMainStore } from '../store/index.js'
import { api } from '../api.js'

const store = useMainStore()

const form = ref({
  firstName: '',
  lastName: '',
  gender: 'unknown',
  birthYear: null,
  deathYear: null,
  occupation: '',
  location: '',
  bio: ''
})

const errors = ref({ firstName: '' })
const submitting = ref(false)
const pendingLinks = ref([])
const newLink = ref({ personId: '', relType: 'child_of', formedDate: '', divorced: false })
const photos = ref([])
const existingRels = ref([])

const formTitle = computed(() => {
  if (store.editingPerson) return `Edit: ${store.editingPerson.name}`
  return 'Add Person'
})

// Filter out self and already-linked persons from the dropdown
const availablePersons = computed(() => {
  const editId = store.editingPerson?.id
  const linkedIds = new Set()
  if (editId) {
    existingRels.value.forEach(r => linkedIds.add(r.otherId))
  }
  pendingLinks.value.forEach(l => linkedIds.add(l.personId))
  return store.persons.filter(p => p.id !== editId && !linkedIds.has(p.id))
})

function buildExistingRels(personId) {
  const rels = []
  store.relationships.forEach(r => {
    if (r.person_a_id !== personId && r.person_b_id !== personId) return
    const otherId = r.person_a_id === personId ? r.person_b_id : r.person_a_id
    const other = store.persons.find(p => p.id === otherId)
    if (!other) return
    let roleLabel = ''
    if (r.type === 'spouse') {
      roleLabel = 'Spouse of'
    } else if (r.type === 'parent_child') {
      roleLabel = r.person_a_id === personId ? 'Parent of' : 'Child of'
    } else if (r.type === 'adopted') {
      roleLabel = r.person_a_id === personId ? 'Adoptive parent of' : 'Adopted by'
    }
    rels.push({
      id: r.id, otherId, otherName: other.name, roleLabel,
      relType: r.type,
      status: r.status || 'active',
      formedDate: r.formed_date || null,
    })
  })
  return rels
}

async function removeExistingRel(relId) {
  await store.deleteRelationship(relId)
  existingRels.value = existingRels.value.filter(r => r.id !== relId)
}

async function updateExistingRelStatus(relId, status) {
  await store.updateRelationship({ id: relId, status })
  const rel = existingRels.value.find(r => r.id === relId)
  if (rel) rel.status = status
}

async function updateExistingRelDate(relId, val) {
  const formedDate = val ? +val : null
  await store.updateRelationship({ id: relId, formed_date: formedDate })
  const rel = existingRels.value.find(r => r.id === relId)
  if (rel) rel.formedDate = formedDate
}

// Populate form when editing
watch(() => store.editingPerson, async (person) => {
  if (person) {
    const parts = person.name.trim().split(/\s+/)
    form.value = {
      firstName: parts.slice(0, -1).join(' ') || parts[0] || '',
      lastName: parts.length > 1 ? parts[parts.length - 1] : '',
      gender: person.gender || 'unknown',
      birthYear: person.birth_year || null,
      deathYear: person.death_year || null,
      occupation: person.occupation || '',
      location: person.location || '',
      bio: person.bio || ''
    }
    errors.value.firstName = ''
    existingRels.value = buildExistingRels(person.id)
    pendingLinks.value = []
    // Load photos
    const res = await api.invoke('images:getByPerson', { personId: person.id })
    if (res.success) photos.value = res.data
    else photos.value = []
  } else {
    form.value = {
      firstName: '',
      lastName: '',
      gender: 'unknown',
      birthYear: null,
      deathYear: null,
      occupation: '',
      location: '',
      bio: ''
    }
    errors.value.firstName = ''
    pendingLinks.value = []
    existingRels.value = []
    photos.value = []
  }
}, { immediate: true })

function fullName() {
  const first = form.value.firstName.trim()
  const last = form.value.lastName.trim()
  return last ? `${first} ${last}` : first
}

function relTypeLabel(relType) {
  const map = {
    child_of: 'Child of',
    parent_of: 'Parent of',
    spouse_of: 'Spouse of',
    adopted_by: 'Adopted by'
  }
  return map[relType] || relType
}

function personName(pid) {
  const p = store.persons.find(x => x.id === pid)
  return p ? p.name : pid
}

function addLink() {
  if (!newLink.value.personId) return
  pendingLinks.value.push({ ...newLink.value })
  newLink.value = { personId: '', relType: 'child_of', formedDate: '', divorced: false }
}

function removeLink(idx) {
  pendingLinks.value.splice(idx, 1)
}

function photoUrl(filePath) {
  return api.getImageUrl(filePath) || ''
}

async function addPhoto() {
  if (!store.editingPerson) return
  const res = await api.invoke('images:openDialog')
  if (!res.success || !res.data) return
  const srcPath = res.data
  const isPrimary = photos.value.length === 0
  const addRes = await api.invoke('images:add', {
    personId: store.editingPerson.id,
    srcPath,
    isPrimary
  })
  if (addRes.success) {
    photos.value.push(addRes.data)
    // Update primary_image on person in store
    if (isPrimary) {
      await store.updatePerson({ ...store.editingPerson, primary_image: addRes.data.file_path })
    }
  }
}

async function setPrimary(photo) {
  if (!store.editingPerson) return
  await api.invoke('images:setPrimary', { imageId: photo.id, personId: store.editingPerson.id })
  photos.value.forEach(p => { p.is_primary = p.id === photo.id ? 1 : 0 })
}

async function deletePhoto(photo) {
  await api.invoke('images:delete', { imageId: photo.id })
  photos.value = photos.value.filter(p => p.id !== photo.id)
}

function validate() {
  let ok = true
  if (!form.value.firstName.trim()) {
    errors.value.firstName = 'First name is required.'
    ok = false
  }
  return ok
}

async function handleSubmit() {
  if (!validate()) return
  submitting.value = true

  try {
    const personData = {
      name: fullName(),
      birth_year: form.value.birthYear || null,
      death_year: form.value.deathYear || null,
      gender: form.value.gender,
      bio: form.value.bio,
      occupation: form.value.occupation,
      location: form.value.location
    }

    if (store.editingPerson) {
      // Update existing
      await store.updatePerson({ id: store.editingPerson.id, ...personData })
      // Create any new pending relationships
      for (const link of pendingLinks.value) {
        let person_a_id, person_b_id, type
        const editId = store.editingPerson.id
        if (link.relType === 'child_of') { person_a_id = link.personId; person_b_id = editId; type = 'parent_child' }
        else if (link.relType === 'parent_of') { person_a_id = editId; person_b_id = link.personId; type = 'parent_child' }
        else if (link.relType === 'spouse_of') { person_a_id = editId; person_b_id = link.personId; type = 'spouse' }
        else if (link.relType === 'adopted_by') { person_a_id = link.personId; person_b_id = editId; type = 'adopted' }
        await store.createRelationship({
          person_a_id, person_b_id, type,
          status: link.divorced ? 'divorced' : 'active',
          formed_date: link.formedDate || null,
        })
      }
    } else {
      // Create new
      const res = await store.createPerson(personData)
      if (res.success) {
        const newPersonId = res.data.id
        // Create pending relationships
        for (const link of pendingLinks.value) {
          let person_a_id, person_b_id, type

          if (link.relType === 'child_of') {
            person_a_id = link.personId
            person_b_id = newPersonId
            type = 'parent_child'
          } else if (link.relType === 'parent_of') {
            person_a_id = newPersonId
            person_b_id = link.personId
            type = 'parent_child'
          } else if (link.relType === 'spouse_of') {
            person_a_id = newPersonId
            person_b_id = link.personId
            type = 'spouse'
          } else if (link.relType === 'adopted_by') {
            person_a_id = link.personId
            person_b_id = newPersonId
            type = 'adopted'
          }

          await store.createRelationship({
            person_a_id, person_b_id, type,
            status: link.divorced ? 'divorced' : 'active',
            formed_date: link.formedDate || null,
          })
        }
      }
    }

    store.closeForm()
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.form-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: stretch;
  justify-content: flex-end;
  z-index: 200;
}

.form-panel {
  width: 420px;
  max-width: 100vw;
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.form-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--t1);
}

.form-body {
  flex: 1 1 0;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-section-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--t3);
  padding-bottom: 2px;
  border-bottom: 1px solid var(--border);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--t2);
}

.required {
  color: #ef5350;
}

.input-error {
  border-color: #ef5350 !important;
}

.error-text {
  font-size: 11px;
  color: #ef5350;
  margin-top: 2px;
}

/* Pending relationship links */
.pending-links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pending-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--adim);
  border: 1px solid rgba(108, 142, 245, 0.2);
  border-radius: 16px;
  padding: 4px 10px 4px 10px;
  font-size: 12px;
  color: var(--accent);
}

.chip-rel-type {
  font-weight: 700;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  opacity: 0.8;
}

.chip-person-name {
  color: var(--t1);
}

.chip-remove {
  background: none;
  border: none;
  color: var(--t3);
  cursor: pointer;
  font-size: 11px;
  padding: 0;
  line-height: 1;
  display: flex;
  align-items: center;
  margin-left: 2px;
}

.chip-remove:hover {
  color: #ef5350;
}

.pending-chip-new {
  border-color: rgba(76, 175, 114, 0.25);
  background: rgba(76, 175, 114, 0.08);
}

.link-add-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.link-select {
  flex: 1;
  min-width: 120px;
  font-size: 12px;
}

/* Photo gallery */
.photo-gallery {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.photo-thumb {
  width: 72px;
  height: 72px;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  border: 2px solid var(--border);
  flex-shrink: 0;
}

.photo-thumb.primary {
  border-color: var(--accent);
}

.photo-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  opacity: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: opacity 0.15s;
}

.photo-thumb:hover .photo-overlay {
  opacity: 1;
}

.photo-action-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 5px;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.12s;
}

.photo-action-btn:hover {
  background: rgba(255, 255, 255, 0.35);
}

.photo-delete-btn:hover {
  background: rgba(239, 83, 80, 0.5);
}

.primary-badge {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(108, 142, 245, 0.85);
  font-size: 8px;
  font-weight: 700;
  color: #fff;
  text-align: center;
  padding: 2px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Relationship cards */
.existing-rels {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rel-card {
  background: var(--elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rel-card-new {
  border-color: rgba(76, 175, 114, 0.25);
  background: rgba(76, 175, 114, 0.05);
}

.rel-card-top {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.chip-divorced {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #ef5350;
  background: rgba(239, 83, 80, 0.12);
  padding: 2px 7px;
  border-radius: 8px;
}

.rel-card-fields {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.rel-inline-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 90px;
}

.rel-field-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--t3);
}

.rel-mini-select {
  font-size: 11px;
  padding: 5px 8px;
  min-width: 0;
  border-radius: 6px;
}

.rel-mini-input {
  font-size: 11px;
  padding: 5px 8px;
  min-width: 0;
  border-radius: 6px;
  width: 100%;
}

/* Footer */
.form-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
</style>
