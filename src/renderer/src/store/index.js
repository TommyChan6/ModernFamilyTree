import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { api } from '../api'
import { setSessionToken, clearSessionToken, getSessionToken } from '../api/session'
import { latestDataYear } from './currentYear.js'
import { locale, setLocale, isSupportedLocale } from '../i18n'

export const useMainStore = defineStore('main', () => {
  // ── Account / session ─────────────────────────────────────────────────────
  const authUser = ref(null) // { id, username, plan, created_at } or null
  const authUsage = ref(null) // { projects, maxProjects, persons, … } or null
  const authReady = ref(false) // true once the stored session was checked
  // A passwordless "look around" visitor. Guests are held to Standard mode —
  // Advanced (physics, Labs, 3D) is a signed-in-account affordance.
  const isGuest = computed(() => authUser.value?.plan === 'guest')

  // ── Project management ────────────────────────────────────────────────────
  const projects = ref([])
  const activeProjectId = ref(null)

  // ── State ──────────────────────────────────────────────────────────────────
  const persons = ref([])
  const fieldDefs = ref([]) // trait definitions (FieldDef[]), ordered by `order`
  const fieldValues = ref([]) // per-person trait values (FieldValue[])
  const relationships = ref([])
  const tags = ref([])
  const entityTags = ref([]) // the entity↔tag membership join rows
  const scenes = ref([]) // every saved Scene of the project, all views
  const sceneTags = ref([]) // tag placements ("Groups"): {id, scene_id, tag_id, x, y, visible}
  const characters = ref([]) // CharacterDocs (experimental Character view)
  // Which scene is open, per spatial view ('groups' | 'graph' | 'timeline').
  const activeSceneIds = ref({ groups: null, graph: null, timeline: null })
  const draggingPersonId = ref(null) // person being dragged from the member list
  const selectedPersonId = ref(null)
  const inspectorTab = ref('directory') // right dock tab: 'inspector' | 'directory'
  const modalOpen = ref(false)
  const formOpen = ref(false)
  const editingPerson = ref(null)
  const theme = ref('dark')
  const settingsOpen = ref(false) // graph "Style" side panel
  const appSettingsOpen = ref(false) // the app-wide Settings modal (language, help, feedback)
  const userPageOpen = ref(false) // the full-screen profile / account page
  // Cinematic transition curtain: a full-screen animated overlay shown during
  // sign in / out, project switches, and opening the profile. It doubles as a
  // loading screen — `runWithCurtain` keeps it up for the work plus a minimum
  // play time so the animation always completes. { active, kind, label, sub }.
  const curtain = ref({ active: false, kind: 'login', label: '', sub: '' })
  // Display language. The i18n `locale` ref is the source of truth for
  // rendering; this store field mirrors it so components already wired to the
  // store stay reactive, and persistence flows through globalSettings.
  const language = ref(locale.value)
  const lockNodes = ref(false)
  const lockLines = ref(false)
  const relPopup = ref(null)
  const cleanView = ref(false)
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
  const activeView = ref('graph') // 'graph' | 'directory' | 'relationships' | 'timeline' | 'groups'
  // What this project calls its entries ('Person', 'Character', 'Ship'…).
  // Per-project setting; the data layer keeps saying "person" regardless.
  const noun = ref('Person')
  // App-wide feature tier (progressive disclosure): 'simple' | 'standard' | 'advanced'
  const programMode = ref('standard')
  // Labs: the explicit opt-in for experimental features (Advanced mode only).
  const labsEnabled = ref(false)
  // Whether the Space (3D) controls hints were already shown once.
  const spaceHintSeen = ref(false)

  // Graph visual settings
  const graphSettings = ref({
    nodeRadius: 22,
    parentChildColor: '#8b6cc5',
    parentChildWidth: 1.8,
    spouseColor: '#d4af37',
    spouseWidth: 2,
    adoptedColor: '#2bb3a3',
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
  // Trait lookups: fieldDefById.get(id) → FieldDef;
  // fieldValuesOf.get(personId) → Map(fieldId → FieldValue)
  const fieldDefById = computed(() => new Map(fieldDefs.value.map((d) => [d.id, d])))
  const fieldValuesOf = computed(() => {
    const m = new Map()
    for (const v of fieldValues.value) {
      if (!m.has(v.person_id)) m.set(v.person_id, new Map())
      m.get(v.person_id).set(v.field_id, v)
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

  // Capability flags derived from the program mode — components read these
  // (never the mode itself) so features gate in exactly one place.
  //   Simple:   Graph + Directory only, one auto scene, Organic type only,
  //             no Focus / Style / tags
  //   Standard: all views, scenes, Focus + basic Style, manual tags
  //   Advanced: everything (full Style incl. physics sliders)
  const caps = computed(() => {
    // Guests never get Advanced — clamp the effective mode so every derived
    // capability (Labs, full Style, 3D Space, extra time controls) folds back
    // to Standard in one place.
    const m = isGuest.value && programMode.value === 'advanced' ? 'standard' : programMode.value
    const labs = m === 'advanced' && labsEnabled.value
    return {
      views:
        m === 'simple'
          ? ['graph', 'directory']
          : [
              'graph',
              'directory',
              'relationships',
              'timeline',
              'groups',
              // The experimental Character view rides the same gate as Space 3D
              ...(labs ? ['character'] : [])
            ],
      scenes: m !== 'simple',
      typePicker: m !== 'simple',
      focus: m !== 'simple',
      /** 'none' | 'basic' (no physics sliders) | 'full' */
      style: m === 'simple' ? 'none' : m === 'standard' ? 'basic' : 'full',
      tags: m !== 'simple',
      /** The Labs toggle itself is an Advanced-mode affordance… */
      labs: m === 'advanced',
      /** Extra Time Travel transport (speed / reverse / event skip / loop);
       *  the slider itself is available in every mode. */
      timeControls: m === 'advanced',
      /** …and the experimental Space (3D) graph type needs it switched on too. */
      space3d: labs,
      /** The experimental Character view (buildable portraits). */
      character: labs
    }
  })

  function setLabsEnabled(on) {
    labsEnabled.value = !!on
    api.invoke('globalSettings:set', {
      key: 'labsEnabled',
      value: labsEnabled.value ? 'on' : 'off'
    })
  }

  // A hidden view must never stay active — whatever hid it (mode change, Labs
  // switched off, the guest clamp on sign-in), fall back to the graph.
  watch(caps, (c) => {
    if (!c.views.includes(activeView.value)) activeView.value = 'graph'
  })

  function markSpaceHintSeen() {
    spaceHintSeen.value = true
    api.invoke('globalSettings:set', { key: 'space3dHintSeen', value: 'yes' })
  }

  function setProgramMode(mode) {
    if (!['simple', 'standard', 'advanced'].includes(mode) || mode === programMode.value) return
    if (mode === 'advanced' && isGuest.value) return // Advanced is off-limits to guests
    programMode.value = mode
    api.invoke('globalSettings:set', { key: 'programMode', value: mode })
    // A hidden view must never stay active
    if (!caps.value.views.includes(activeView.value)) activeView.value = 'graph'
    if (mode === 'simple') settingsOpen.value = false
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

  // Run an async task behind the transition curtain. The curtain shows the
  // given kind/label, stays up for at least `min` ms so the animation plays in
  // full even on instant operations, and comes down once the work is done.
  async function runWithCurtain(kind, label, task, opts = {}) {
    const { min = 900, sub = '' } = opts
    curtain.value = { active: true, kind, label, sub }
    const started = Date.now()
    try {
      return await (typeof task === 'function' ? task() : task)
    } finally {
      const wait = Math.max(0, min - (Date.now() - started))
      if (wait) await new Promise((r) => setTimeout(r, wait))
      curtain.value = { ...curtain.value, active: false }
    }
  }

  // ── Account actions ───────────────────────────────────────────────────────
  // Auth mirrors the future hosted flow: register/login hand back a bearer
  // token the api seam then attaches to every request. After either succeeds
  // the user's data is (re)loaded exactly like a project switch.
  async function restoreSession() {
    try {
      if (!getSessionToken()) return false
      const res = await api.invoke('auth:session')
      if (!res.success) {
        clearSessionToken()
        return false
      }
      authUser.value = res.data.user
      authUsage.value = res.data.usage
      // A restored guest may carry a persisted Advanced setting (device-level,
      // applied before the session resolves) — clamp to Standard, same as sign-in.
      if (authUser.value?.plan === 'guest' && programMode.value === 'advanced') {
        programMode.value = 'standard'
      }
      return true
    } finally {
      authReady.value = true
    }
  }

  async function completeSignIn(res) {
    if (!res.success) return res
    setSessionToken(res.data.token)
    authUser.value = res.data.user
    // A persisted Advanced setting is device-level; a guest may inherit it.
    // Clamp to Standard locally without overwriting the device preference.
    if (authUser.value?.plan === 'guest' && programMode.value === 'advanced') {
      programMode.value = 'standard'
    }
    const name = authUser.value?.display_name || authUser.value?.username
    const welcome =
      authUser.value?.plan === 'guest' ? 'Welcome, guest' : `Welcome${name ? ', ' + name : ''}`
    await runWithCurtain(
      'login',
      welcome,
      async () => {
        await loadProjects()
        await loadAll()
      },
      { min: 1200, sub: 'Growing your family tree…' }
    )
    refreshUsage()
    return res
  }

  function register({ username, password, acceptedTerms }) {
    return api.invoke('auth:register', { username, password, acceptedTerms }).then(completeSignIn)
  }

  function login({ username, password }) {
    return api.invoke('auth:login', { username, password }).then(completeSignIn)
  }

  function guestLogin() {
    return api.invoke('auth:guest').then(completeSignIn)
  }

  async function logout() {
    // Close the profile page first so it doesn't linger over the curtain.
    userPageOpen.value = false
    await runWithCurtain(
      'logout',
      'Signing out…',
      async () => {
        await api.invoke('auth:logout')
        clearSessionToken()
        authUser.value = null
        authUsage.value = null
        // Drop everything owned by the account so the next sign-in starts clean
        projects.value = []
        activeProjectId.value = null
        persons.value = []
        fieldDefs.value = []
        fieldValues.value = []
        relationships.value = []
        tags.value = []
        entityTags.value = []
        scenes.value = []
        sceneTags.value = []
        characters.value = []
        activeSceneIds.value = { groups: null, graph: null, timeline: null }
        selectedPersonId.value = null
        modalOpen.value = false
        formOpen.value = false
        editingPerson.value = null
        relPopup.value = null
        checkpoint.value = null
        userCurrentYear.value = null
      },
      { min: 950, sub: 'See you soon' }
    )
  }

  async function refreshUsage() {
    const res = await api.invoke('auth:usage')
    if (res.success) authUsage.value = res.data
  }

  // Profile fields only (display name / bio / avatar hue) — the handler
  // returns the fresh PublicUser, which replaces authUser wholesale.
  async function updateProfile(fields) {
    const res = await api.invoke('auth:updateProfile', fields)
    if (res.success) authUser.value = res.data
    return res
  }

  function changePassword({ currentPassword, newPassword }) {
    return api.invoke('auth:changePassword', { currentPassword, newPassword })
  }

  // Per-project headline counts for the profile page's project cards.
  // Returned (not stored) — the page fetches fresh numbers each open.
  async function fetchProjectsOverview() {
    const res = await api.invoke('projects:overview')
    return res.success ? res.data.projects : []
  }

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
      refreshUsage()
      return res.data
    }
    if (res.error?.includes('limit')) alert(res.error)
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
    const target = projects.value.find((p) => p.id === id)
    await runWithCurtain(
      'switch',
      target?.name ? `Opening ${target.name}` : 'Switching project…',
      async () => {
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
      },
      { min: 850, sub: 'Loading people & relationships…' }
    )
  }

  // ── Data actions ──────────────────────────────────────────────────────────
  async function loadAll() {
    const [
      personsRes,
      fieldsRes,
      relsRes,
      tagsRes,
      entityTagsRes,
      scenesRes,
      sceneTagsRes,
      charactersRes,
      settingsRes
    ] = await Promise.all([
      api.invoke('persons:getAll'),
      api.invoke('fields:list'),
      api.invoke('relationships:getAll'),
      api.invoke('tags:getAll'),
      api.invoke('entity_tags:getAll'),
      api.invoke('scenes:getAll'),
      api.invoke('scene_tags:getAll'),
      api.invoke('characters:getAll'),
      api.invoke('settings:getAll')
    ])
    if (personsRes.success) persons.value = personsRes.data
    if (fieldsRes.success) {
      fieldDefs.value = fieldsRes.data.defs
      fieldValues.value = fieldsRes.data.values
    }
    if (relsRes.success) relationships.value = relsRes.data
    if (tagsRes.success) tags.value = tagsRes.data
    if (entityTagsRes.success) entityTags.value = entityTagsRes.data
    if (scenesRes.success) scenes.value = scenesRes.data
    if (sceneTagsRes.success) sceneTags.value = sceneTagsRes.data
    if (charactersRes.success) characters.value = charactersRes.data
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
    // Restore the project's noun for its entries (default 'Person')
    noun.value = typeof saved.noun === 'string' && saved.noun.trim() ? saved.noun.trim() : 'Person'
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
    if (res.success) {
      persons.value.push(res.data)
      refreshFields() // the payload was adopted into trait values server-side
      refreshUsage()
    } else if (res.error?.includes('limit')) {
      alert(res.error)
    }
    return res
  }

  async function updatePerson(data) {
    const res = await api.invoke('persons:update', data)
    if (res.success) {
      const idx = persons.value.findIndex((p) => p.id === data.id)
      if (idx !== -1) persons.value[idx] = res.data
      refreshFields()
    }
    return res
  }

  async function deletePerson(id) {
    const res = await api.invoke('persons:delete', { id })
    if (res.success) {
      persons.value = persons.value.filter((p) => p.id !== id)
      fieldValues.value = fieldValues.value.filter((v) => v.person_id !== id)
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

  // ── Trait actions (field defs + per-person values) ─────────────────────────
  /** Re-fetch defs + values wholesale — def-level mutations recompute every
   *  person's snapshot server-side, so persons refresh alongside. */
  async function refreshFields({ withPersons = false } = {}) {
    const [fieldsRes, personsRes] = await Promise.all([
      api.invoke('fields:list'),
      withPersons ? api.invoke('persons:getAll') : Promise.resolve(null)
    ])
    if (fieldsRes.success) {
      fieldDefs.value = fieldsRes.data.defs
      fieldValues.value = fieldsRes.data.values
    }
    if (personsRes?.success) persons.value = personsRes.data
  }

  async function createFieldDef(data) {
    const res = await api.invoke('fields:createDef', data)
    if (res.success) {
      fieldDefs.value.push(res.data.def)
      if (res.data.value) fieldValues.value.push(res.data.value)
    }
    return res
  }

  async function updateFieldDef(patch) {
    const res = await api.invoke('fields:updateDef', patch)
    if (res.success) {
      const idx = fieldDefs.value.findIndex((d) => d.id === patch.id)
      if (idx !== -1) fieldDefs.value[idx] = res.data
      refreshFields({ withPersons: true })
    }
    return res
  }

  async function deleteFieldDef(id) {
    const res = await api.invoke('fields:deleteDef', { id })
    if (res.success) {
      fieldDefs.value = fieldDefs.value.filter((d) => d.id !== id)
      fieldValues.value = fieldValues.value.filter((v) => v.field_id !== id)
      refreshFields({ withPersons: true })
    }
    return res
  }

  async function reorderFieldDefs(orderedIds) {
    // Optimistic: reorder locally, then persist.
    const byId = new Map(fieldDefs.value.map((d) => [d.id, d]))
    fieldDefs.value = orderedIds.map((id) => byId.get(id)).filter(Boolean)
    const res = await api.invoke('fields:reorderDefs', { orderedIds })
    if (res.success) fieldDefs.value = res.data
    return res
  }

  async function setFieldSlot(fieldId, slot, slotOrder) {
    const res = await api.invoke('fields:setSlot', { fieldId, slot, slotOrder })
    if (res.success) {
      fieldDefs.value = res.data
      refreshFields({ withPersons: true })
    }
    return res
  }

  /** Batch-save one person's trait values (the form's save path).
   *  values: [{ field_id, value, timeframe?, display_in_graph? }],
   *  removals: [fieldId]. */
  async function setFieldValues(personId, values, removals = []) {
    const res = await api.invoke('fields:setValues', { personId, values, removals })
    if (res.success) {
      const idx = persons.value.findIndex((p) => p.id === personId)
      if (idx !== -1) persons.value[idx] = res.data.person
      fieldValues.value = fieldValues.value
        .filter((v) => v.person_id !== personId)
        .concat(res.data.values)
    }
    return res
  }

  async function applyFieldDisplayAll(fieldId, on) {
    const res = await api.invoke('fields:applyDisplayAll', { fieldId, on })
    if (res.success) refreshFields({ withPersons: true })
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
    const sceneId = await ensureScene('groups', 'Scene 1')
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

  // ── Character actions (experimental Character view) ────────────────────────
  /** Upsert a CharacterDoc (create without an id; patch with one). */
  async function saveCharacter(data) {
    const res = await api.invoke('characters:save', data)
    if (res.success) {
      const idx = characters.value.findIndex((c) => c.id === res.data.id)
      if (idx !== -1) characters.value[idx] = res.data
      else characters.value.push(res.data)
    }
    return res
  }

  async function deleteCharacter(id) {
    const res = await api.invoke('characters:delete', { id })
    if (res.success) characters.value = characters.value.filter((c) => c.id !== id)
    return res
  }

  /** Mark one of a person's docs as THE portrait (null clears). The rendered
   *  image itself goes through the images pipeline separately (CharacterView). */
  async function setCharacterPortrait(personId, characterId) {
    const res = await api.invoke('characters:setPortrait', { personId, characterId })
    if (res.success) {
      characters.value = characters.value.map((c) =>
        c.person_id === personId ? { ...c, is_portrait: c.id === characterId } : c
      )
    }
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

  function toggleAppSettings(open) {
    appSettingsOpen.value = typeof open === 'boolean' ? open : !appSettingsOpen.value
  }

  function toggleUserPage(open) {
    userPageOpen.value = typeof open === 'boolean' ? open : !userPageOpen.value
  }

  // Open the profile page behind the curtain so the (brief) fetch of the
  // per-project overview is hidden and the entrance feels deliberate.
  function openUserPage() {
    return runWithCurtain(
      'profile',
      'Your profile',
      async () => {
        userPageOpen.value = true
        // Give the page a beat to mount and kick off its overview fetch.
        await new Promise((r) => setTimeout(r, 80))
      },
      { min: 700, sub: 'Gathering your account…' }
    )
  }

  // Switch the display language app-wide and remember it. Guards against
  // unknown codes so a stale/garbage stored value can't wedge the UI.
  function setLanguage(code) {
    if (!isSupportedLocale(code)) return
    language.value = code
    setLocale(code)
    api.invoke('globalSettings:set', { key: 'language', value: code })
  }

  // Set (or clear, with a falsy value) the explicit current year. Clearing
  // reverts to auto-tracking the latest year in the data. Persisted as its
  // own per-project setting.
  function setCurrentYear(year) {
    const y = parseInt(year)
    userCurrentYear.value = Number.isFinite(y) && y > 0 ? y : null
    api.invoke('settings:set', { key: 'userCurrentYear', value: userCurrentYear.value })
  }

  /** Rename what this project calls its entries (blank reverts to 'Person'). */
  function setNoun(word) {
    const w = String(word ?? '').trim()
    noun.value = w || 'Person'
    api.invoke('settings:set', { key: 'noun', value: noun.value })
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
      spouseColor: '#d4af37',
      spouseWidth: 2,
      adoptedColor: '#2bb3a3',
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
    // account
    authUser,
    authUsage,
    authReady,
    isGuest,
    restoreSession,
    register,
    login,
    guestLogin,
    logout,
    refreshUsage,
    updateProfile,
    changePassword,
    fetchProjectsOverview,
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
    fieldDefs,
    fieldValues,
    fieldDefById,
    fieldValuesOf,
    relationships,
    tags,
    entityTags,
    scenes,
    sceneTags,
    characters,
    activeSceneId,
    activeSceneIds,
    draggingPersonId,
    selectedPersonId,
    inspectorTab,
    modalOpen,
    formOpen,
    editingPerson,
    theme,
    settingsOpen,
    appSettingsOpen,
    userPageOpen,
    curtain,
    runWithCurtain,
    openUserPage,
    language,
    graphSettings,
    lockNodes,
    cleanView,
    currentDate,
    userCurrentYear,
    autoCurrentYear,
    lockLines,
    relPopup,
    activeView,
    noun,
    setNoun,
    programMode,
    caps,
    setProgramMode,
    labsEnabled,
    setLabsEnabled,
    spaceHintSeen,
    markSpaceHintSeen,
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
    refreshFields,
    createFieldDef,
    updateFieldDef,
    deleteFieldDef,
    reorderFieldDefs,
    setFieldSlot,
    setFieldValues,
    applyFieldDisplayAll,
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
    saveCharacter,
    deleteCharacter,
    setCharacterPortrait,
    selectPerson,
    openForm,
    closeModal,
    closeForm,
    setTheme,
    toggleSettings,
    toggleAppSettings,
    toggleUserPage,
    setLanguage,
    setCurrentYear,
    updateGraphSetting,
    resetGraphSettings,
    hasUnsavedChanges,
    saveCheckpoint,
    revertToCheckpoint
  }
})
