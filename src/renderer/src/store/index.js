import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api.js'

export const useMainStore = defineStore('main', () => {
  // ── Tree management ───────────────────────────────────────────────────────
  const trees = ref([])
  const activeTreeId = ref(null)

  // ── State ──────────────────────────────────────────────────────────────────
  const persons = ref([])
  const relationships = ref([])
  const selectedPersonId = ref(null)
  const modalOpen = ref(false)
  const formOpen = ref(false)
  const editingPerson = ref(null)
  const theme = ref('dark')
  const settingsOpen = ref(false)
  const lockNodes = ref(false)
  const lockLines = ref(false)
  const relPopup = ref(null)
  const cleanTree = ref(false)
  const currentDate = ref(null)
  const graphDirty = ref(false)

  // Graph visual settings
  const graphSettings = ref({
    nodeRadius: 22,
    parentChildColor: '#8b6cc5',
    parentChildWidth: 1.8,
    spouseColor: '#f06292',
    spouseWidth: 2,
    adoptedColor: '#f5a623',
    adoptedWidth: 1.8,
    maleColor: '#3a7bd5',
    femaleColor: '#c95fa0',
    unknownColor: '#5c6bc0',
    linkDistance: 160,
    chargeStrength: -380,
    labelSize: 10,
    showLabels: true,
    lineCurvature: 0.04,
    glowOnHover: true,
    nodeOpacity: 1.0,
    linkOpacity: 0.6,
  })

  // ── Computed ───────────────────────────────────────────────────────────────
  const selectedPerson = computed(() =>
    persons.value.find(p => p.id === selectedPersonId.value) || null
  )
  const personCount = computed(() => persons.value.length)
  const coupleCount = computed(() =>
    relationships.value.filter(r => r.type === 'spouse').length
  )
  const activeTree = computed(() =>
    trees.value.find(t => t.id === activeTreeId.value) || null
  )

  // ── Tree actions ──────────────────────────────────────────────────────────
  async function loadTrees() {
    const res = await api.invoke('trees:getAll')
    if (res.success) {
      trees.value = res.data.trees
      activeTreeId.value = res.data.activeTreeId
    }
  }

  async function createTree(name) {
    const res = await api.invoke('trees:create', { name: name || 'Unnamed Family Tree' })
    if (res.success) {
      trees.value.push(res.data)
      return res.data
    }
    return null
  }

  async function renameTree(id, name) {
    const res = await api.invoke('trees:rename', { id, name })
    if (res.success) {
      const idx = trees.value.findIndex(t => t.id === id)
      if (idx !== -1) trees.value[idx] = res.data
    }
  }

  async function deleteTree(id) {
    const res = await api.invoke('trees:delete', { id })
    if (res.success) {
      trees.value = trees.value.filter(t => t.id !== id)
      if (res.data.newActiveTreeId) {
        await switchTree(res.data.newActiveTreeId)
      }
    }
  }

  async function switchTree(id) {
    if (id === activeTreeId.value) return
    const res = await api.invoke('trees:setActive', { id })
    if (res.success) {
      activeTreeId.value = id
      // Reset UI state
      selectedPersonId.value = null
      modalOpen.value = false
      formOpen.value = false
      editingPerson.value = null
      relPopup.value = null
      graphDirty.value = false
      // Reload data for new tree
      await loadAll()
    }
  }

  // ── Data actions ──────────────────────────────────────────────────────────
  async function loadAll() {
    const [personsRes, relsRes] = await Promise.all([
      api.invoke('persons:getAll'),
      api.invoke('relationships:getAll')
    ])
    if (personsRes.success) persons.value = personsRes.data
    if (relsRes.success) relationships.value = relsRes.data
  }

  async function createPerson(data) {
    const res = await api.invoke('persons:create', data)
    if (res.success) persons.value.push(res.data)
    return res
  }

  async function updatePerson(data) {
    const res = await api.invoke('persons:update', data)
    if (res.success) {
      const idx = persons.value.findIndex(p => p.id === data.id)
      if (idx !== -1) persons.value[idx] = res.data
    }
    return res
  }

  async function deletePerson(id) {
    const res = await api.invoke('persons:delete', { id })
    if (res.success) {
      persons.value = persons.value.filter(p => p.id !== id)
      relationships.value = relationships.value.filter(
        r => r.person_a_id !== id && r.person_b_id !== id
      )
      if (selectedPersonId.value === id) {
        selectedPersonId.value = null
        modalOpen.value = false
      }
    }
    return res
  }

  async function createRelationship(data) {
    const res = await api.invoke('relationships:create', data)
    if (res.success) relationships.value.push(res.data)
    return res
  }

  async function updateRelationship(data) {
    const res = await api.invoke('relationships:update', data)
    if (res.success) {
      const idx = relationships.value.findIndex(r => r.id === data.id)
      if (idx !== -1) relationships.value[idx] = res.data
    }
    return res
  }

  async function deleteRelationship(id) {
    const res = await api.invoke('relationships:delete', { id })
    if (res.success) relationships.value = relationships.value.filter(r => r.id !== id)
    return res
  }

  function selectPerson(id) {
    selectedPersonId.value = id
    modalOpen.value = !!id
  }

  function openForm(person = null) {
    editingPerson.value = person || null
    formOpen.value = true
  }

  function closeModal() { modalOpen.value = false }
  function closeForm() { formOpen.value = false; editingPerson.value = null }

  function setTheme(t) {
    theme.value = t
    document.documentElement.dataset.theme = t
    api.invoke('globalSettings:set', { key: 'theme', value: t })
  }

  function toggleSettings() { settingsOpen.value = !settingsOpen.value }

  function updateGraphSetting(key, value) {
    graphSettings.value[key] = value
    api.invoke('settings:set', { key: `graph_${key}`, value: JSON.stringify(value) })
  }

  function resetGraphSettings() {
    graphSettings.value = {
      nodeRadius: 22, parentChildColor: '#8b6cc5', parentChildWidth: 1.8,
      spouseColor: '#f06292', spouseWidth: 2, adoptedColor: '#f5a623', adoptedWidth: 1.8,
      maleColor: '#3a7bd5', femaleColor: '#c95fa0', unknownColor: '#5c6bc0',
      linkDistance: 160, chargeStrength: -380, labelSize: 10, showLabels: true,
      lineCurvature: 0.04, glowOnHover: true, nodeOpacity: 1.0, linkOpacity: 0.6,
    }
  }

  return {
    // tree
    trees, activeTreeId, activeTree,
    loadTrees, createTree, renameTree, deleteTree, switchTree,
    // state
    persons, relationships, selectedPersonId, modalOpen, formOpen,
    editingPerson, theme, settingsOpen, graphSettings,
    lockNodes, cleanTree, currentDate, lockLines, relPopup,
    // computed
    selectedPerson, personCount, coupleCount,
    // actions
    loadAll, createPerson, updatePerson, deletePerson,
    createRelationship, updateRelationship, deleteRelationship,
    selectPerson, openForm, closeModal, closeForm,
    setTheme, toggleSettings, updateGraphSetting, resetGraphSettings,
    graphDirty,
    markGraphDirty() { graphDirty.value = true },
    clearGraphDirty() { graphDirty.value = false },
    async saveGraphState(graphState) {
      await api.invoke('settings:set', { key: 'graphState', value: JSON.stringify(graphState) })
      graphDirty.value = false
    },
    async loadGraphState() {
      const res = await api.invoke('settings:getAll')
      if (res.success && res.data.graphState) {
        try { return JSON.parse(res.data.graphState) } catch { return null }
      }
      return null
    },
  }
})
