import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api.js'
import { latestDataYear } from './currentYear.js'

export const useMainStore = defineStore('main', () => {
  // ── Tree management ───────────────────────────────────────────────────────
  const trees = ref([])
  const activeTreeId = ref(null)

  // ── State ──────────────────────────────────────────────────────────────────
  const persons = ref([])
  const relationships = ref([])
  const factions = ref([]) // all factions of the tree, across scenarios
  const scenarios = ref([])
  const activeScenarioId = ref(null)
  const draggingPersonId = ref(null) // person being dragged from the member list
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
  // Current year. `userCurrentYear` is the explicit user override (null = follow
  // the data). While it's null the current year tracks the latest year present
  // in the data; once the user sets a value it stays pinned there regardless of
  // newly added later dates. `currentDate` ({ year } | null) is the effective
  // value every view reads.
  const userCurrentYear = ref(null)
  const autoCurrentYear = computed(() => latestDataYear(persons.value, relationships.value))
  const currentDate = computed(() => {
    const y = userCurrentYear.value ?? autoCurrentYear.value
    return y != null ? { year: y } : null
  })
  const graphDirty = ref(false)
  const activeView = ref('tree') // 'tree' | 'people' | 'relationships' | 'timeline' | 'factions'

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
    showAge: false,
    lineCurvature: 0.04,
    glowOnHover: true,
    nodeOpacity: 1.0,
    linkOpacity: 0.6
  })

  // ── Computed ───────────────────────────────────────────────────────────────
  const selectedPerson = computed(
    () => persons.value.find((p) => p.id === selectedPersonId.value) || null
  )
  const personCount = computed(() => persons.value.length)
  const coupleCount = computed(() => relationships.value.filter((r) => r.type === 'spouse').length)
  const activeTree = computed(() => trees.value.find((t) => t.id === activeTreeId.value) || null)
  const activeScenario = computed(
    () => scenarios.value.find((s) => s.id === activeScenarioId.value) || null
  )
  const activeFactions = computed(() =>
    factions.value.filter((f) => f.scenario_id === activeScenarioId.value)
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
      const idx = trees.value.findIndex((t) => t.id === id)
      if (idx !== -1) trees.value[idx] = res.data
    }
  }

  async function deleteTree(id) {
    const res = await api.invoke('trees:delete', { id })
    if (res.success) {
      trees.value = trees.value.filter((t) => t.id !== id)
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
      userCurrentYear.value = null // revert to auto; restored from the tree's saved layout
      // Reload data for new tree
      await loadAll()
    }
  }

  // ── Data actions ──────────────────────────────────────────────────────────
  async function loadAll() {
    const [personsRes, relsRes, factionsRes, scenariosRes, settingsRes] = await Promise.all([
      api.invoke('persons:getAll'),
      api.invoke('relationships:getAll'),
      api.invoke('factions:getAll'),
      api.invoke('scenarios:getAll'),
      api.invoke('settings:getAll')
    ])
    if (personsRes.success) persons.value = personsRes.data
    if (relsRes.success) relationships.value = relsRes.data
    if (factionsRes.success) factions.value = factionsRes.data
    if (scenariosRes.success) scenarios.value = scenariosRes.data
    // Restore the tree's active scenario; fall back to the first one
    const savedId = settingsRes.success ? settingsRes.data.activeScenarioId : null
    activeScenarioId.value =
      scenarios.value.find((s) => s.id === savedId)?.id ?? scenarios.value[0]?.id ?? null
  }

  async function createPerson(data) {
    const res = await api.invoke('persons:create', data)
    if (res.success) persons.value.push(res.data)
    return res
  }

  async function updatePerson(data) {
    const res = await api.invoke('persons:update', data)
    if (res.success) {
      const idx = persons.value.findIndex((p) => p.id === data.id)
      if (idx !== -1) persons.value[idx] = res.data
    }
    return res
  }

  async function deletePerson(id) {
    const res = await api.invoke('persons:delete', { id })
    if (res.success) {
      persons.value = persons.value.filter((p) => p.id !== id)
      relationships.value = relationships.value.filter(
        (r) => r.person_a_id !== id && r.person_b_id !== id
      )
      factions.value.forEach((f) => {
        if (f.member_ids?.includes(id)) {
          f.member_ids = f.member_ids.filter((pid) => pid !== id)
        }
      })
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
      const idx = relationships.value.findIndex((r) => r.id === data.id)
      if (idx !== -1) relationships.value[idx] = res.data
    }
    return res
  }

  async function deleteRelationship(id) {
    const res = await api.invoke('relationships:delete', { id })
    if (res.success) relationships.value = relationships.value.filter((r) => r.id !== id)
    return res
  }

  // ── Scenario actions ──────────────────────────────────────────────────────
  /** Create the default scenario if the tree has none yet. Concurrent callers
   *  share one in-flight request so only a single default is ever created. */
  let ensureScenarioPromise = null
  async function ensureScenario() {
    if (activeScenarioId.value) return activeScenarioId.value
    if (!ensureScenarioPromise) {
      ensureScenarioPromise = api
        .invoke('scenarios:create', { name: 'Scenario 1' })
        .then((res) => {
          if (res.success) {
            scenarios.value.push(res.data.scenario)
            activeScenarioId.value = res.data.scenario.id
          }
          return activeScenarioId.value
        })
        .finally(() => {
          ensureScenarioPromise = null
        })
    }
    return ensureScenarioPromise
  }

  async function createScenario(name, cloneFromId = null) {
    const res = await api.invoke('scenarios:create', { name, clone_from: cloneFromId })
    if (res.success) {
      scenarios.value.push(res.data.scenario)
      factions.value.push(...res.data.factions)
    }
    return res
  }

  async function renameScenario(id, name) {
    const res = await api.invoke('scenarios:rename', { id, name })
    if (res.success) {
      const idx = scenarios.value.findIndex((s) => s.id === id)
      if (idx !== -1) scenarios.value[idx] = res.data
    }
    return res
  }

  async function deleteScenario(id) {
    const res = await api.invoke('scenarios:delete', { id })
    if (res.success) {
      scenarios.value = scenarios.value.filter((s) => s.id !== id)
      factions.value = factions.value.filter((f) => f.scenario_id !== id)
      if (activeScenarioId.value === id) {
        setActiveScenario(scenarios.value[0]?.id ?? null)
      }
    }
    return res
  }

  function setActiveScenario(id) {
    if (id === activeScenarioId.value) return
    activeScenarioId.value = id
    // Fire-and-forget persistence — switching stays instant
    if (id) api.invoke('settings:set', { key: 'activeScenarioId', value: id })
  }

  // ── Faction actions ───────────────────────────────────────────────────────
  async function createFaction(data) {
    const scenarioId = await ensureScenario()
    const res = await api.invoke('factions:create', { ...data, scenario_id: scenarioId })
    if (res.success) factions.value.push(res.data)
    return res
  }

  async function updateFaction(data) {
    const res = await api.invoke('factions:update', data)
    if (res.success) {
      const idx = factions.value.findIndex((f) => f.id === data.id)
      if (idx !== -1) factions.value[idx] = res.data
    }
    return res
  }

  async function deleteFaction(id) {
    const res = await api.invoke('factions:delete', { id })
    if (res.success) factions.value = factions.value.filter((f) => f.id !== id)
    return res
  }

  async function addPersonToFaction(personId, factionId) {
    const f = factions.value.find((x) => x.id === factionId)
    if (!f || f.member_ids?.includes(personId)) return null
    return updateFaction({ id: factionId, member_ids: [...(f.member_ids || []), personId] })
  }

  async function removePersonFromFaction(personId, factionId) {
    const f = factions.value.find((x) => x.id === factionId)
    if (!f || !f.member_ids?.includes(personId)) return null
    return updateFaction({
      id: factionId,
      member_ids: f.member_ids.filter((pid) => pid !== personId)
    })
  }

  function selectPerson(id) {
    selectedPersonId.value = id
    modalOpen.value = !!id
  }

  function openForm(person = null) {
    editingPerson.value = person || null
    formOpen.value = true
  }

  function closeModal() {
    modalOpen.value = false
  }
  function closeForm() {
    formOpen.value = false
    editingPerson.value = null
  }

  function setTheme(t) {
    theme.value = t
    document.documentElement.dataset.theme = t
    api.invoke('globalSettings:set', { key: 'theme', value: t })
  }

  function toggleSettings() {
    settingsOpen.value = !settingsOpen.value
  }

  // Set (or clear, with a falsy value) the explicit current year. Clearing
  // reverts to auto-tracking the latest year in the data. Part of the saved
  // layout, so an explicit change lights up the unsaved-layout indicator.
  function setCurrentYear(year) {
    const y = parseInt(year)
    userCurrentYear.value = Number.isFinite(y) && y > 0 ? y : null
    graphDirty.value = true
  }

  function updateGraphSetting(key, value) {
    graphSettings.value[key] = value
    api.invoke('settings:set', { key: `graph_${key}`, value: JSON.stringify(value) })
  }

  function resetGraphSettings() {
    graphSettings.value = {
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
      showAge: false,
      lineCurvature: 0.04,
      glowOnHover: true,
      nodeOpacity: 1.0,
      linkOpacity: 0.6
    }
  }

  return {
    // tree
    trees,
    activeTreeId,
    activeTree,
    loadTrees,
    createTree,
    renameTree,
    deleteTree,
    switchTree,
    // state
    persons,
    relationships,
    factions,
    scenarios,
    activeScenarioId,
    draggingPersonId,
    selectedPersonId,
    modalOpen,
    formOpen,
    editingPerson,
    theme,
    settingsOpen,
    graphSettings,
    lockNodes,
    cleanTree,
    currentDate,
    userCurrentYear,
    autoCurrentYear,
    lockLines,
    relPopup,
    activeView,
    // computed
    selectedPerson,
    personCount,
    coupleCount,
    activeScenario,
    activeFactions,
    // actions
    loadAll,
    createPerson,
    updatePerson,
    deletePerson,
    createRelationship,
    updateRelationship,
    deleteRelationship,
    createFaction,
    updateFaction,
    deleteFaction,
    addPersonToFaction,
    removePersonFromFaction,
    createScenario,
    renameScenario,
    deleteScenario,
    setActiveScenario,
    selectPerson,
    openForm,
    closeModal,
    closeForm,
    setTheme,
    toggleSettings,
    setCurrentYear,
    updateGraphSetting,
    resetGraphSettings,
    graphDirty,
    markGraphDirty() {
      graphDirty.value = true
    },
    clearGraphDirty() {
      graphDirty.value = false
    },
    async saveGraphState(graphState) {
      await api.invoke('settings:set', { key: 'graphState', value: JSON.stringify(graphState) })
      graphDirty.value = false
    },
    async loadGraphState() {
      const res = await api.invoke('settings:getAll')
      if (res.success && res.data.graphState) {
        try {
          return JSON.parse(res.data.graphState)
        } catch {
          return null
        }
      }
      return null
    }
  }
})
