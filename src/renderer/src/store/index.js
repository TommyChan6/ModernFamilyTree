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
  const scenes = ref([]) // every saved Scene of the project, all views
  const sceneTags = ref([]) // tag placements ("Groups"): {id, scene_id, tag_id, x, y, visible}
  // Which scene is open, per spatial view ('groups' | 'graph' | 'timeline').
  const activeSceneIds = ref({ groups: null, graph: null, timeline: null })
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
  // The saved checkpoint: the user's last explicit Save of the project's
  // arrangement (scenes + placements + current-year override). Everything
  // autosaves; this is what Revert goes back to. null = never saved one.
  const checkpoint = ref(null)
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
  const graphScenes = computed(() => scenes.value.filter((s) => s.view === 'graph'))
  const timelineScenes = computed(() => scenes.value.filter((s) => s.view === 'timeline'))
  /** The Groups view's active scene id (kept as an alias — that view predates
   *  the per-view map). */
  const activeSceneId = computed(() => activeSceneIds.value.groups)
  const activeScene = computed(() => scenes.value.find((s) => s.id === activeSceneId.value) || null)
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
  // Canonical, timestamp-free form of the arrangement state, for comparing the
  // working copy against the checkpoint.
  function arrangementFingerprint(sceneList, placements, userYear) {
    const s = sceneList
      .map(({ id, view, name, type, config, positions }) => ({
        id,
        view,
        name,
        type,
        config,
        positions
      }))
      .sort((a, b) => (a.id < b.id ? -1 : 1))
    const t = placements
      .map(({ id, scene_id, tag_id, x, y, visible }) => ({ id, scene_id, tag_id, x, y, visible }))
      .sort((a, b) => (a.id < b.id ? -1 : 1))
    return JSON.stringify({ s, t, y: userYear ?? null })
  }

  const hasUnsavedChanges = computed(() => {
    if (!checkpoint.value) return false // nothing to diverge from — first Save creates it
    const current = arrangementFingerprint(scenes.value, sceneTags.value, userCurrentYear.value)
    const saved = arrangementFingerprint(
      Object.values(checkpoint.value.scenes || {}),
      Object.values(checkpoint.value.scene_tags || {}),
      checkpoint.value.userCurrentYear
    )
    return current !== saved
  })

  // The Groups view's display list: every tag placed in the active groups
  // scene, joined with its identity (tag) and members (entity_tags). Identity
  // is the TAG id — stable across scenes, so scene switches glide naturally.
  const activeGroups = computed(() => {
    const out = []
    for (const st of sceneTags.value) {
      if (st.scene_id !== activeSceneIds.value.groups) continue
      const tag = tagById.value.get(st.tag_id)
      if (!tag) continue
      out.push({
        id: tag.id,
        placement_id: st.id,
        name: tag.label,
        color: tag.color,
        icon: tag.icon,
        member_ids: membersOf.value.get(tag.id) || [],
        x: st.x,
        y: st.y,
        visible: st.visible !== false
      })
    }
    return out
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
      userCurrentYear.value = null // revert to auto; restored from the project's saved layout
      // Reload data for new project
      await loadAll()
    }
  }

  // ── Data actions ──────────────────────────────────────────────────────────
  async function loadAll() {
    const [personsRes, relsRes, tagsRes, entityTagsRes, scenesRes, sceneTagsRes, settingsRes] =
      await Promise.all([
        api.invoke('persons:getAll'),
        api.invoke('relationships:getAll'),
        api.invoke('tags:getAll'),
        api.invoke('entity_tags:getAll'),
        api.invoke('scenes:getAll'),
        api.invoke('scene_tags:getAll'),
        api.invoke('settings:getAll')
      ])
    if (personsRes.success) persons.value = personsRes.data
    if (relsRes.success) relationships.value = relsRes.data
    if (tagsRes.success) tags.value = tagsRes.data
    if (entityTagsRes.success) entityTags.value = entityTagsRes.data
    if (scenesRes.success) scenes.value = scenesRes.data
    if (sceneTagsRes.success) sceneTags.value = sceneTagsRes.data
    // Restore each view's active scene (the legacy activeScenarioId key still
    // works for groups because scenes kept the scenario ids), falling back to
    // the view's first scene.
    const saved = settingsRes.success ? settingsRes.data : {}
    const pick = (view, legacyKey) => {
      const savedId = saved[`activeSceneId:${view}`] ?? (legacyKey ? saved[legacyKey] : null)
      const list = scenes.value.filter((s) => s.view === view)
      return list.find((s) => s.id === savedId)?.id ?? list[0]?.id ?? null
    }
    activeSceneIds.value = {
      groups: pick('groups', 'activeScenarioId'),
      graph: pick('graph'),
      timeline: pick('timeline')
    }
    // Restore the current-year override (used to live in the graphState blob)
    const savedYear = parseInt(saved.userCurrentYear)
    userCurrentYear.value = Number.isFinite(savedYear) && savedYear > 0 ? savedYear : null
    // Restore the saved checkpoint (if the user ever saved one)
    try {
      checkpoint.value = saved.checkpoint ? JSON.parse(saved.checkpoint) : null
    } catch {
      checkpoint.value = null
    }
  }

  // ── Save model: checkpoint + revert ────────────────────────────────────────
  async function saveCheckpoint() {
    const res = await api.invoke('checkpoint:save')
    if (res.success) checkpoint.value = res.data
    return res
  }

  async function revertToCheckpoint() {
    const res = await api.invoke('checkpoint:revert')
    if (res.success) {
      const byDate = (a, b) => (a.created_at > b.created_at ? 1 : -1)
      scenes.value = Object.values(res.data.scenes || {}).sort(byDate)
      sceneTags.value = Object.values(res.data.scene_tags || {}).sort(byDate)
      const y = parseInt(res.data.userCurrentYear)
      userCurrentYear.value = Number.isFinite(y) && y > 0 ? y : null
      // Re-validate each view's active scene (it may have been created after
      // the checkpoint and just got reverted away)
      const next = { ...activeSceneIds.value }
      for (const view of ['groups', 'graph', 'timeline']) {
        if (!scenes.value.some((s) => s.id === next[view] && s.view === view)) {
          next[view] = scenes.value.find((s) => s.view === view)?.id ?? null
        }
      }
      activeSceneIds.value = next
    }
    return res
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

  // ── Scene actions ──────────────────────────────────────────────────────────
  /** Create a view's default scene if it has none yet (and make it active).
   *  Concurrent callers share one in-flight request per view so only a single
   *  default is ever created. */
  const ensureScenePromises = {}
  async function ensureScene(view, name, extra = {}) {
    if (activeSceneIds.value[view]) return activeSceneIds.value[view]
    if (!ensureScenePromises[view]) {
      ensureScenePromises[view] = api
        .invoke('scenes:create', { view, name, ...extra })
        .then((res) => {
          if (res.success) {
            scenes.value.push(res.data)
            setActiveScene(view, res.data.id)
          }
          return activeSceneIds.value[view]
        })
        .finally(() => {
          ensureScenePromises[view] = null
        })
    }
    return ensureScenePromises[view]
  }

  async function createScene(view, name, extra = {}) {
    const res = await api.invoke('scenes:create', { view, name, ...extra })
    if (res.success) scenes.value.push(res.data)
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

  /** Deep-copy a scene (config/positions and its tag placements). */
  async function duplicateScene(id, name) {
    const res = await api.invoke('scenes:duplicate', { id, name })
    if (res.success) {
      scenes.value.push(res.data.scene)
      sceneTags.value.push(...res.data.scene_tags)
    }
    return res
  }

  /** Persist a scene's arrangement (type/config/positions, optionally name). */
  async function saveScene(patch) {
    const res = await api.invoke('scenes:save', patch)
    if (res.success) {
      const idx = scenes.value.findIndex((s) => s.id === patch.id)
      if (idx !== -1) scenes.value[idx] = res.data
    }
    return res
  }

  async function deleteScene(id) {
    const scene = scenes.value.find((s) => s.id === id)
    const res = await api.invoke('scenes:delete', { id })
    if (res.success) {
      scenes.value = scenes.value.filter((s) => s.id !== id)
      sceneTags.value = sceneTags.value.filter((row) => row.scene_id !== id)
      if (scene && activeSceneIds.value[scene.view] === id) {
        const next = scenes.value.find((s) => s.view === scene.view)
        setActiveScene(scene.view, next?.id ?? null)
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

  function setActiveScene(view, id) {
    if (id === activeSceneIds.value[view]) return
    activeSceneIds.value = { ...activeSceneIds.value, [view]: id }
    // Fire-and-forget persistence — switching stays instant
    if (id) api.invoke('settings:set', { key: `activeSceneId:${view}`, value: id })
  }

  // ── Group actions (the Groups view's verbs over tags + placements) ─────────
  /** Find the active scene's placement of a tag. */
  function placementOf(tagId) {
    return (
      sceneTags.value.find(
        (row) => row.scene_id === activeSceneIds.value.groups && row.tag_id === tagId
      ) || null
    )
  }

  /** Create a tag and place it in the active groups scene. Returns the tag. */
  async function createGroup({ name, color, icon, x = 0, y = 0 } = {}) {
    const sceneId = await ensureScene('groups', 'Scenario 1')
    const tagRes = await createTag({ label: name, color, icon })
    if (!tagRes.success) return tagRes
    const placeRes = await addSceneTag(sceneId, tagRes.data.id, { x, y })
    return placeRes.success ? tagRes : placeRes
  }

  /** Rename / recolor / re-icon a group — edits the shared tag identity. */
  function updateGroup({ id, name, color, icon }) {
    return updateTag({ id, label: name, color, icon })
  }

  /** Remove a group from the active scene. If the tag isn't placed in any
   *  other scene, delete the tag too (membership included) — matching the old
   *  "delete faction" outcome; people are never deleted. */
  async function deleteGroup(tagId) {
    const placement = placementOf(tagId)
    if (placement) {
      const res = await removeSceneTag(placement.id)
      if (!res.success) return res
    }
    const placedElsewhere = sceneTags.value.some((row) => row.tag_id === tagId)
    if (!placedElsewhere) return deleteTag(tagId)
    return { success: true }
  }

  function moveGroup(tagId, x, y) {
    const placement = placementOf(tagId)
    return placement ? moveSceneTag(placement.id, x, y) : null
  }

  function setGroupVisible(tagId, visible) {
    const placement = placementOf(tagId)
    return placement ? setSceneTagVisible(placement.id, visible) : null
  }

  function addPersonToGroup(personId, tagId) {
    return addEntityTag(personId, tagId)
  }

  function removePersonFromGroup(personId, tagId) {
    return removeEntityTag(personId, tagId)
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
  // reverts to auto-tracking the latest year in the data. Persisted as its
  // own per-project setting.
  function setCurrentYear(year) {
    const y = parseInt(year)
    userCurrentYear.value = Number.isFinite(y) && y > 0 ? y : null
    api.invoke('settings:set', { key: 'userCurrentYear', value: userCurrentYear.value })
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
    scenes,
    sceneTags,
    activeSceneId,
    activeSceneIds,
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
    graphScenes,
    timelineScenes,
    activeScene,
    activeGroups,
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
    createGroup,
    updateGroup,
    deleteGroup,
    moveGroup,
    setGroupVisible,
    addPersonToGroup,
    removePersonFromGroup,
    ensureScene,
    createScene,
    renameScene,
    duplicateScene,
    saveScene,
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
    hasUnsavedChanges,
    saveCheckpoint,
    revertToCheckpoint
  }
})
