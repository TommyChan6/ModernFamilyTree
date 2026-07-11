import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api'
import { latestDataYear } from './currentYear.js'

export const useMainStore = defineStore('main', () => {
  // ── Project management ────────────────────────────────────────────────────
  const projects = ref([])
  const activeProjectId = ref(null)

  // ── State ──────────────────────────────────────────────────────────────────
  const persons = ref([])
  const relationships = ref([])
  const tags = ref([])
  const entityTags = ref([]) // the entity↔tag membership join rows
  const factions = ref([]) // all factions of the project, across groups scenes
  const scenes = ref([]) // every saved Scene of the project, all views
  const sceneTags = ref([]) // tag placements ("Groups"): {id, scene_id, tag_id, x, y, visible}
  // Which scene is open — for the GROUPS view only for now (Phase 5 makes this
  // per-view when graph/timeline scenes land).
  const activeSceneId = ref(null)
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
  const activeProject = computed(
    () => projects.value.find((p) => p.id === activeProjectId.value) || null
  )
  const groupsScenes = computed(() => scenes.value.filter((s) => s.view === 'groups'))
  const activeScene = computed(() => scenes.value.find((s) => s.id === activeSceneId.value) || null)
  const activeFactions = computed(() =>
    factions.value.filter((f) => f.scenario_id === activeSceneId.value)
  )
  // O(1) membership lookups in both directions, rebuilt when the join changes:
  // tagsOf.get(entityId) → Tag[]; membersOf.get(tagId) → entityId[]
  const tagById = computed(() => new Map(tags.value.map((t) => [t.id, t])))
  const tagsOf = computed(() => {
    const m = new Map()
    for (const row of entityTags.value) {
      const tag = tagById.value.get(row.tag_id)
      if (!tag) continue
      if (!m.has(row.entity_id)) m.set(row.entity_id, [])
      m.get(row.entity_id).push(tag)
    }
    return m
  })
  const membersOf = computed(() => {
    const m = new Map()
    for (const row of entityTags.value) {
      if (!m.has(row.tag_id)) m.set(row.tag_id, [])
      m.get(row.tag_id).push(row.entity_id)
    }
    return m
  })

  // ── Project actions ───────────────────────────────────────────────────────
  async function loadProjects() {
    const res = await api.invoke('projects:getAll')
    if (res.success) {
      projects.value = res.data.projects
      activeProjectId.value = res.data.activeProjectId
    }
  }

  async function createProject(name) {
    const res = await api.invoke('projects:create', { name: name || 'Unnamed Project' })
    if (res.success) {
      projects.value.push(res.data)
      return res.data
    }
    return null
  }

  async function renameProject(id, name) {
    const res = await api.invoke('projects:rename', { id, name })
    if (res.success) {
      const idx = projects.value.findIndex((p) => p.id === id)
      if (idx !== -1) projects.value[idx] = res.data
    }
  }

  async function deleteProject(id) {
    const res = await api.invoke('projects:delete', { id })
    if (res.success) {
      projects.value = projects.value.filter((p) => p.id !== id)
      if (res.data.newActiveProjectId) {
        await switchProject(res.data.newActiveProjectId)
      }
    }
  }

  async function switchProject(id) {
    if (id === activeProjectId.value) return
    const res = await api.invoke('projects:setActive', { id })
    if (res.success) {
      activeProjectId.value = id
      // Reset UI state
      selectedPersonId.value = null
      modalOpen.value = false
      formOpen.value = false
      editingPerson.value = null
      relPopup.value = null
      graphDirty.value = false
      userCurrentYear.value = null // revert to auto; restored from the project's saved layout
      // Reload data for new project
      await loadAll()
    }
  }

  // ── Data actions ──────────────────────────────────────────────────────────
  async function loadAll() {
    const [
      personsRes,
      relsRes,
      tagsRes,
      entityTagsRes,
      factionsRes,
      scenesRes,
      sceneTagsRes,
      settingsRes
    ] = await Promise.all([
      api.invoke('persons:getAll'),
      api.invoke('relationships:getAll'),
      api.invoke('tags:getAll'),
      api.invoke('entity_tags:getAll'),
      api.invoke('factions:getAll'),
      api.invoke('scenes:getAll'),
      api.invoke('scene_tags:getAll'),
      api.invoke('settings:getAll')
    ])
    if (personsRes.success) persons.value = personsRes.data
    if (relsRes.success) relationships.value = relsRes.data
    if (tagsRes.success) tags.value = tagsRes.data
    if (entityTagsRes.success) entityTags.value = entityTagsRes.data
    if (factionsRes.success) factions.value = factionsRes.data
    if (scenesRes.success) scenes.value = scenesRes.data
    if (sceneTagsRes.success) sceneTags.value = sceneTagsRes.data
    // Restore the project's active groups scene; the legacy activeScenarioId
    // setting still works because scenes kept the scenario ids. Fall back to
    // the first groups scene.
    const saved = settingsRes.success ? settingsRes.data : {}
    const savedId = saved['activeSceneId:groups'] ?? saved.activeScenarioId ?? null
    activeSceneId.value =
      groupsScenes.value.find((s) => s.id === savedId)?.id ?? groupsScenes.value[0]?.id ?? null
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
      entityTags.value = entityTags.value.filter((row) => row.entity_id !== id)
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

  // ── Tag actions ───────────────────────────────────────────────────────────
  async function createTag(data) {
    const res = await api.invoke('tags:create', data)
    if (res.success) tags.value.push(res.data)
    return res
  }

  async function updateTag(data) {
    const res = await api.invoke('tags:update', data)
    if (res.success) {
      const idx = tags.value.findIndex((t) => t.id === data.id)
      if (idx !== -1) tags.value[idx] = res.data
    }
    return res
  }

  async function deleteTag(id) {
    const res = await api.invoke('tags:delete', { id })
    if (res.success) {
      tags.value = tags.value.filter((t) => t.id !== id)
      entityTags.value = entityTags.value.filter((row) => row.tag_id !== id)
      sceneTags.value = sceneTags.value.filter((row) => row.tag_id !== id)
    }
    return res
  }

  async function addEntityTag(entityId, tagId) {
    if (entityTags.value.some((row) => row.entity_id === entityId && row.tag_id === tagId))
      return null
    const res = await api.invoke('entity_tags:add', { entity_id: entityId, tag_id: tagId })
    if (res.success && !entityTags.value.some((row) => row.id === res.data.id)) {
      entityTags.value.push(res.data)
    }
    return res
  }

  async function removeEntityTag(entityId, tagId) {
    const res = await api.invoke('entity_tags:remove', { entity_id: entityId, tag_id: tagId })
    if (res.success) {
      entityTags.value = entityTags.value.filter(
        (row) => !(row.entity_id === entityId && row.tag_id === tagId)
      )
    }
    return res
  }

  // ── Scene actions (groups view only for now) ──────────────────────────────
  /** Create the default groups scene if the project has none yet. Concurrent
   *  callers share one in-flight request so only a single default is ever
   *  created. */
  let ensureGroupsScenePromise = null
  async function ensureGroupsScene() {
    if (activeSceneId.value) return activeSceneId.value
    if (!ensureGroupsScenePromise) {
      ensureGroupsScenePromise = api
        .invoke('scenes:create', { view: 'groups', name: 'Scenario 1' })
        .then((res) => {
          if (res.success) {
            scenes.value.push(res.data.scene)
            activeSceneId.value = res.data.scene.id
          }
          return activeSceneId.value
        })
        .finally(() => {
          ensureGroupsScenePromise = null
        })
    }
    return ensureGroupsScenePromise
  }

  async function createGroupsScene(name, cloneFromId = null) {
    const res = await api.invoke('scenes:create', {
      view: 'groups',
      name,
      clone_from: cloneFromId
    })
    if (res.success) {
      scenes.value.push(res.data.scene)
      factions.value.push(...res.data.factions)
    }
    return res
  }

  async function renameScene(id, name) {
    const res = await api.invoke('scenes:rename', { id, name })
    if (res.success) {
      const idx = scenes.value.findIndex((s) => s.id === id)
      if (idx !== -1) scenes.value[idx] = res.data
    }
    return res
  }

  async function deleteScene(id) {
    const res = await api.invoke('scenes:delete', { id })
    if (res.success) {
      scenes.value = scenes.value.filter((s) => s.id !== id)
      factions.value = factions.value.filter((f) => f.scenario_id !== id)
      sceneTags.value = sceneTags.value.filter((row) => row.scene_id !== id)
      if (activeSceneId.value === id) {
        setActiveScene(groupsScenes.value[0]?.id ?? null)
      }
    }
    return res
  }

  // ── Scene-tag (placement) actions ─────────────────────────────────────────
  async function addSceneTag(sceneId, tagId, opts = {}) {
    const res = await api.invoke('scene_tags:add', {
      scene_id: sceneId,
      tag_id: tagId,
      ...opts
    })
    if (res.success && !sceneTags.value.some((row) => row.id === res.data.id)) {
      sceneTags.value.push(res.data)
    }
    return res
  }

  async function moveSceneTag(id, x, y) {
    const res = await api.invoke('scene_tags:move', { id, x, y })
    if (res.success) {
      const idx = sceneTags.value.findIndex((row) => row.id === id)
      if (idx !== -1) sceneTags.value[idx] = res.data
    }
    return res
  }

  async function setSceneTagVisible(id, visible) {
    const res = await api.invoke('scene_tags:setVisible', { id, visible })
    if (res.success) {
      const idx = sceneTags.value.findIndex((row) => row.id === id)
      if (idx !== -1) sceneTags.value[idx] = res.data
    }
    return res
  }

  async function removeSceneTag(id) {
    const res = await api.invoke('scene_tags:remove', { id })
    if (res.success) sceneTags.value = sceneTags.value.filter((row) => row.id !== id)
    return res
  }

  function setActiveScene(id) {
    if (id === activeSceneId.value) return
    activeSceneId.value = id
    // Fire-and-forget persistence — switching stays instant
    if (id) api.invoke('settings:set', { key: 'activeSceneId:groups', value: id })
  }

  // ── Faction actions ───────────────────────────────────────────────────────
  async function createFaction(data) {
    const sceneId = await ensureGroupsScene()
    const res = await api.invoke('factions:create', { ...data, scenario_id: sceneId })
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
    // project
    projects,
    activeProjectId,
    activeProject,
    loadProjects,
    createProject,
    renameProject,
    deleteProject,
    switchProject,
    // state
    persons,
    relationships,
    tags,
    entityTags,
    factions,
    scenes,
    sceneTags,
    activeSceneId,
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
    groupsScenes,
    activeScene,
    activeFactions,
    tagsOf,
    membersOf,
    // actions
    loadAll,
    createPerson,
    updatePerson,
    deletePerson,
    createRelationship,
    updateRelationship,
    deleteRelationship,
    createTag,
    updateTag,
    deleteTag,
    addEntityTag,
    removeEntityTag,
    createFaction,
    updateFaction,
    deleteFaction,
    addPersonToFaction,
    removePersonFromFaction,
    ensureGroupsScene,
    createGroupsScene,
    renameScene,
    deleteScene,
    setActiveScene,
    addSceneTag,
    moveSceneTag,
    setSceneTagVisible,
    removeSceneTag,
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
