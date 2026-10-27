import { defineStore } from 'pinia'
import { ref, computed, watch, nextTick } from 'vue'
import { api, onUndoableMutation } from '../api'
import { planHasFeature } from '../../../shared/auth'
import { isPaidPlan, planHasPerk } from '../../../shared/billing'
import { setSessionToken, clearSessionToken, getSessionToken } from '../api/session'
import { latestDataYear } from './currentYear.js'
import { locale, setLocale, isSupportedLocale, translate } from '../i18n'
import { defaultNameLabel } from '../lib/dataLabels'
import { accentVars, normalizeHex, DEFAULT_ACCENT } from '../lib/accent.js'
import { revealTransition } from '../lib/themeReveal.js'
import { installInkAssets } from '../lib/inkArt'
import { installMedievalAssets } from '../lib/medievalArt'
import { toast } from '../lib/dialogs.js'
import { resolveAuras } from '../../../shared/auras'
import { computeFingerprintFeatures } from '../../../shared/fingerprint'
import { dynamicsPalette as resolveDynamicsPalette } from '../../../shared/sentiment'

/** Validate the saved Sheet layout JSON: widths are clamped positive numbers,
 *  hidden is a string list, sort is { key, dir: ±1 } or null. Anything else
 *  falls back to the defaults. */
function parseSheetPrefs(raw) {
  let v = null
  try {
    v = raw ? JSON.parse(raw) : null
  } catch {
    v = null
  }
  const widths = {}
  if (v?.widths && typeof v.widths === 'object') {
    for (const [k, w] of Object.entries(v.widths)) {
      if (Number.isFinite(w)) widths[k] = Math.min(900, Math.max(48, Math.round(w)))
    }
  }
  const hidden = Array.isArray(v?.hidden) ? v.hidden.filter((k) => typeof k === 'string') : []
  const sort =
    typeof v?.sort?.key === 'string' && (v.sort.dir === 1 || v.sort.dir === -1)
      ? { key: v.sort.key, dir: v.sort.dir }
      : null
  return { widths, hidden, sort }
}

export const useMainStore = defineStore('main', () => {
  // ── Account / session ─────────────────────────────────────────────────────
  const authUser = ref(null) // { id, username, plan, created_at } or null
  const authUsage = ref(null) // { projects, maxProjects, persons, … } or null
  const authReady = ref(false) // true once the stored session was checked
  // A passwordless "look around" visitor. Guests are held to Standard mode —
  // Advanced (physics, Labs, 3D) is a signed-in-account affordance.
  const isGuest = computed(() => authUser.value?.plan === 'guest')

  // ── Supabase Auth (hosted web build only) ─────────────────────────────────
  // Active only when the app runs against the hosted Postgres backend
  // (VITE_API_BACKEND=supabase). Login is Supabase Auth's own email/password;
  // `user` / `session` mirror its state, and `authUser` above is derived from
  // `user` so the rest of the app (AccountMenu, undo gating, caps) is unchanged.
  const usingSupabase = import.meta.env.VITE_API_BACKEND === 'supabase'
  const user = ref(null) // the raw Supabase auth user, or null
  const session = ref(null) // the raw Supabase session, or null

  // ── Project management ────────────────────────────────────────────────────
  const projects = ref([])
  const activeProjectId = ref(null)

  // ── State ──────────────────────────────────────────────────────────────────
  const persons = ref([])
  const fieldDefs = ref([]) // trait definitions (FieldDef[]), ordered by `order`
  const fieldValues = ref([]) // per-person trait values (FieldValue[])
  const relationships = ref([])
  const relTypes = ref([]) // RelationshipTypeDef[], ordered by `order`
  const tags = ref([])
  const entityTags = ref([]) // the entity↔tag membership join rows
  const scenes = ref([]) // every saved Scene of the project, all views
  const sceneTags = ref([]) // tag placements ("Groups"): {id, scene_id, tag_id, x, y, visible}
  const characters = ref([]) // CharacterDocs (experimental Character view)
  const maps = ref([]) // MapDocs (the Map view)
  const eras = ref([]) // the chronicle: named stretches of time (shared/chronicle.ts)
  const events = ref([]) // the chronicle: story events with their cast
  // The era / event editor dialog (ChronicleEditor.vue, mounted once in App):
  // { kind: 'era' | 'event', data: {…draft} } or null.
  const chronicleEditor = ref(null)
  const activeMapId = ref(null) // the map the Map view shows (per project)
  // Which scene is open, per spatial view ('groups' | 'graph' | 'timeline').
  const activeSceneIds = ref({ groups: null, graph: null, timeline: null })
  const draggingPersonId = ref(null) // person being dragged from the member list
  const selectedPersonId = ref(null)
  const selectedPersonIds = ref([]) // multi-selection set (graph canvas shift-click)
  const selectedRelationshipIds = ref([]) // multi-selected bonds (graph marquee)
  // Graph marquee selection: which object kinds it captures / the action pane
  // narrows to ('both' | 'nodes' | 'bonds'), the region shape, and whether a
  // marquee selection is currently the active one (drives the action pane mode).
  const selectionFilter = ref('both')
  const marqueeTool = ref('box') // 'box' | 'lasso'
  const marqueeActive = ref(false)
  const lastMarquee = ref({ personIds: [], relIds: [] }) // full capture, re-filtered live
  const inspectorTab = ref('directory') // right dock tab: 'inspector' | 'directory'
  const modalOpen = ref(false)
  const formOpen = ref(false)
  const editingPerson = ref(null)
  // 'dark' | 'light' | 'ink' | 'medieval' — ink (水墨) is a light, rice-paper
  // theme with calligraphy and a cinnabar accent (styles/ink.css,
  // lib/inkArt.ts); medieval is an illuminated codex on vellum with lapis and
  // gold (styles/medieval.css, lib/medievalArt.ts).
  const theme = ref('dark')
  const THEMES = ['dark', 'light', 'ink', 'medieval']
  /** Renderers' `isLight` flag — ink and medieval paint on pale paper too. */
  const isLightTheme = computed(() => theme.value !== 'dark')
  const isInk = computed(() => theme.value === 'ink')
  const isMedieval = computed(() => theme.value === 'medieval')
  // The plain theme to return to when the ink / medieval toggle is switched
  // off (session only).
  const returnTheme = ref('light')
  const accent = ref(DEFAULT_ACCENT) // user accent color (hex) — see lib/accent.js
  const settingsOpen = ref(false) // the Style Studio (components/style/StyleStudio.vue)
  // Which studio layer is in front: 'view' (this view's own style) or 'app'
  // (the foundation every view paints on). Session only.
  const styleLayer = ref('view')
  const appSettingsOpen = ref(false) // the app-wide Settings modal (language, help, feedback)
  const appSettingsTab = ref('general') // which Settings tab opens (see openAppSettings)
  const userPageOpen = ref(false) // the full-screen profile / account page
  const projectsPageOpen = ref(false) // the full-screen Projects library page
  const browsePageOpen = ref(false) // the full-screen Browse (community trees) page
  // Monetization (src/shared/billing.ts, docs/MONETIZATION.md): the pricing /
  // checkout dialog, plus the server's view of the account's subscription.
  const pricingOpen = ref(false)
  const pricingContext = ref({}) // { reason: 'menu'|'quota'|'ads'|'feature', detail?, plan? }
  const billingCatalog = ref(null) // billing:catalog — provider mode ('sandbox'|'none')
  const billingStatus = ref(null) // billing:status — { plan, subscription, invoices }
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
  // Time drag (graph Birth layout + timeline toggle): dragging people up/down
  // retimes their lives instead of only moving them on screen.
  const timeDrag = ref(false)
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
  const activeView = ref('graph') // 'graph' | 'directory' | 'relationships' | 'timeline' | 'groups' | 'map'
  // What this project calls its entries ('Person', 'Character', 'Ship'…).
  // Per-project setting; the data layer keeps saying "person" regardless.
  const noun = ref('Person')
  // App-wide feature tier (progressive disclosure): 'simple' | 'standard' | 'advanced'
  const programMode = ref('standard')
  // Labs: the explicit opt-in for experimental features (Advanced mode only).
  const labsEnabled = ref(false)
  // Whether the Space (3D) controls hints were already shown once.
  const spaceHintSeen = ref(false)
  // The graph's Tab-hold action wheel: the user's 8 slot descriptors, or null
  // for the built-in defaults (see components/graph/wheelModes.js). Per project.
  const wheelSlots = ref(null)
  // The Directory Sheet's column layout: { widths: { colKey: px }, hidden:
  // [colKey], sort: { key, dir: 1|-1 } | null }. Per project; colKeys are
  // field-def ids or the sheet's derived columns (see people/sheetModel.ts).
  const sheetPrefs = ref({ widths: {}, hidden: [], sort: null })
  // Directory card style ('classic' | 'poster' | 'holo' | 'neon' | 'arcana').
  // Per-project setting; the picker lives in the Directory toolbar.
  const cardStyle = ref('classic')
  // 'scroll' = the 水墨 hanging scroll (立轴) — see people/PersonCard.vue
  const CARD_STYLES = ['classic', 'poster', 'holo', 'neon', 'arcana', 'scroll', 'moonfan']
  // Person profile (PersonModal) presentation: the cinematic default, or the
  // 水墨 handscroll ('scroll'). Per-project like the card style.
  const profileStyle = ref('cinematic')
  const PROFILE_STYLES = ['cinematic', 'scroll']
  // Directory viewing mode: the classic virtualized grid, one of the 3D card
  // stages (carousel ring / coverflow / hand fan / swipe deck), or a non-card
  // medium — 'hive' (honeycomb of hexagons) / 'reel' (a spinning drum of
  // film-strip rows) / 'sheet' (an editable spreadsheet of every trait).
  // Card style only applies to the card-based modes.
  const viewMode = ref('grid')
  const VIEW_MODES = [
    'grid',
    'wheel',
    'flow',
    'fan',
    'deck',
    'hive',
    'reel',
    'sheet',
    // Showcase mediums (the ✦ gallery in ViewModeSwitch)
    'roster',
    'codex',
    'board',
    'elements',
    'ranks',
    'bubbles',
    // 长卷 — a painted handscroll that unrolls through the family
    'handscroll'
  ]

  // Graph visual settings. GRAPH_SETTING_DEFAULTS is the single source of
  // truth for keys + defaults: init, reset, and the settings:getAll restore
  // (graph_* keys) all read from it, so adding a setting is a one-line change.
  const GRAPH_SETTING_DEFAULTS = {
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
    linkOpacity: 0.6,
    // ── Aesthetics system (see components/graph/graphThemes.js) ─────────────
    nodeShape: 'circle', // circle|square|diamond|hexagon|shield|oval|octagon|heart|gravestone|plate|flatplate|star
    starTwinkle: true, // star nodes: the departed twinkle faintly (constellation skin)
    nodeDecor: 'none', // none|aura|runes|orbit|burst|pulse|enso
    decorColor: '#d4af37',
    linkRoute: 'organic', // organic|straight|arc|elbow|trident|circuit|wave|bezier|brush
    ambientFx: 'none', // none|fireflies|stars|petals|snow|embers|rain|motes|mist|plum
    ambientColorA: '#ffd27a',
    ambientColorB: '#7ac9ff',
    ambientDensity: 0.5,
    renderQuality: 'quality', // 'quality' | 'performance'
    themePreset: 'classic',
    // ── Line effects (components/graph/webgl/lineFx.js) ──────────────────────
    lineFx: 'none', // none|blood|river|neon|helix|ember|aurora|storm|stars|gilded
    lineFxScope: 'lineage', // lineage (parent→child) | family (+ couples) | all
    lineFxSpeed: 1, // animation speed ×
    lineFxGlow: 1, // glow strength ×
    lineFxKeep: false, // true = keep each relationship's own colour
    // ── Perspective tilt: the 2D layouts seen as a board in 3D ─────────────
    viewTilt: false,
    tiltAngle: 48, // degrees (8–64)
    tiltYaw: 0, // degrees the board is turned (-180–180), tilted view only
    // ── Relationship dynamics (the Dynamics lens; src/shared/sentiment.ts) ──
    dynamicsWarm: '', // '' = the theme's default warm
    dynamicsCold: '' // '' = the theme's default cold
  }
  const graphSettings = ref({ ...GRAPH_SETTING_DEFAULTS })
  // The Dynamics lens's warm↔cold ramp: the theme's defaults (muted ink-wash
  // tones on 水墨, lapis/vermilion on the codex) under the user's two picks.
  const dynamicsPalette = computed(() =>
    resolveDynamicsPalette(theme.value, {
      warm: graphSettings.value.dynamicsWarm,
      cold: graphSettings.value.dynamicsCold
    })
  )

  // Timeline visual settings (the Timeline's Style pane) — same persistence
  // scheme as the graph's (timeline_* keys, JSON values, type-checked restore).
  const TIMELINE_SETTING_DEFAULTS = {
    // classic | tube | glass | glow | a line-effect id (blood, river, neon, helix…)
    lifelineStyle: 'classic',
    lifelineWidth: 6,
    shadows: true,
    avatarSize: 1,
    connectors: 'curve', // curve | straight | hidden
    labels: 'full', // full | compact | hidden
    ageTicks: false, // decade ticks along each lifeline
    grid: 'bands', // bands | lines | none
    eraIntensity: 1,
    eventMarkers: 'pills', // pills | dots | hidden
    fxSpeed: 1,
    fxGlow: 1,
    fxKeep: false, // effects keep the person's colour instead of their own palette
    ambientFx: 'none',
    ambientColorA: '#ffd27a',
    ambientColorB: '#7ac9ff',
    ambientDensity: 0.5,
    // Time warp: stretch the year axis where births cluster (timeWarp.ts)
    timeWarp: false,
    warpStrength: 0.7,
    // Perspective tilt: the timeline laid down as a board (timelineTilt.ts);
    // family arcs rise off it by arcLift
    viewTilt: false,
    tiltAngle: 48,
    tiltYaw: 0,
    arcLift: 1,
    // Household rivers mode: unmarried adults get their own channel at this age
    leaveHomeAge: 25
  }
  const timelineSettings = ref({ ...TIMELINE_SETTING_DEFAULTS })

  // Groups view visual settings (the Style Studio's Groups layer) — groups_* keys,
  // same scheme as the timeline's.
  const GROUPS_SETTING_DEFAULTS = {
    zoneStyle: 'rings', // rings (discs + tethers) | venn (membranes wrap shared members)
    membraneSoftness: 0.5, // venn: 0 taut tendrils … 1 broad, fluid pull
    lensGlow: true // venn: shade the overlaps as lit lenses
  }
  const groupsSettings = ref({ ...GROUPS_SETTING_DEFAULTS })

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
  // Relationship-type lookup: relTypeByKey.get(rel.type) → RelationshipTypeDef.
  // Layout/render code reads def.weight and def.symmetryRole through this —
  // never type literals.
  const relTypeByKey = computed(() => new Map(relTypes.value.map((d) => [d.key, d])))
  // rel.type → symmetryRole, the shape the pure layout modules take.
  const relTypeRoles = computed(() => new Map(relTypes.value.map((d) => [d.key, d.symmetryRole])))
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
  // Auras: the special effect each person wears, resolved from tag + trait
  // effects (src/shared/auras.ts). auraOf.get(personId) → ResolvedAura; the
  // graph and timeline read it at draw time. `counts` = bearers per source.
  const auraResolution = computed(() =>
    resolveAuras({
      tags: tags.value,
      entityTags: entityTags.value,
      defs: fieldDefs.value,
      values: fieldValues.value,
      personIds: persons.value.map((p) => p.id)
    })
  )
  const auraOf = computed(() => auraResolution.value.byPerson)
  // What the Style Studio's Special effects chapter should open on
  // ({ kind: 'tag' | 'trait', id } | null) — set by openAuras().
  const auraFocus = ref(null)

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
    // Plan switchboard (deployment plan Step 2.7): gated capabilities consult
    // the account's plan through PLAN_FEATURES before they may turn on — the
    // same clamp pattern as guests below. Free grants '*', so nothing changes
    // for anyone today; future paid tiers flip flags here, nowhere else.
    const allow = (flag) => planHasFeature(authUser.value?.plan, flag)
    // Guests never get Advanced — clamp the effective mode so every derived
    // capability (Labs, full Style, 3D Space, extra time controls) folds back
    // to Standard in one place. A plan without the 'advanced' flag clamps the
    // same way.
    const clamped =
      (isGuest.value || !allow('advanced')) && programMode.value === 'advanced'
        ? 'standard'
        : programMode.value
    const m = clamped
    const labs = m === 'advanced' && labsEnabled.value && allow('labs')
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
              'map',
              // The experimental Character view rides the same gate as Space 3D
              ...(labs && allow('character') ? ['character'] : [])
            ],
      scenes: m !== 'simple',
      typePicker: m !== 'simple',
      focus: m !== 'simple',
      /** 'none' | 'basic' (no physics sliders) | 'full' */
      style: m === 'simple' ? 'none' : m === 'standard' ? 'basic' : 'full',
      tags: m !== 'simple',
      /** Non-family relationship types in pickers (Simple = family band only). */
      relTypePicker: m !== 'simple',
      /** Creating/editing/deleting custom relationship types. */
      customRelTypes: m !== 'simple',
      /** Tuning a type's structural↔affinity weight (the physics of it). */
      tuneAffinity: m === 'advanced',
      /** The Labs toggle itself is an Advanced-mode affordance… */
      labs: m === 'advanced',
      /** Extra Time Travel transport (speed / reverse / event skip / loop);
       *  the slider itself is available in every mode. */
      timeControls: m === 'advanced',
      /** …and the experimental Space (3D) graph type needs it switched on too. */
      space3d: labs && allow('space3d'),
      /** The experimental Character view (buildable portraits). */
      character: labs && allow('character')
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
      authUser.value?.plan === 'guest'
        ? translate('storeMsg.welcomeGuest')
        : name
          ? translate('storeMsg.welcomeName', { name })
          : translate('storeMsg.welcome')
    await runWithCurtain(
      'login',
      welcome,
      async () => {
        await loadProjects()
        await loadAll()
      },
      { min: 1200, sub: translate('storeMsg.growingTree') }
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

  // Drop everything owned by the account so the next sign-in starts clean.
  // Shared by native logout and the Supabase signed-out transition.
  function clearWorkspace() {
    projects.value = []
    fingerprints.value = {}
    fingerprintProjectId.value = null
    activeProjectId.value = null
    persons.value = []
    fieldDefs.value = []
    fieldValues.value = []
    relationships.value = []
    relTypes.value = []
    tags.value = []
    entityTags.value = []
    scenes.value = []
    sceneTags.value = []
    characters.value = []
    maps.value = []
    activeSceneIds.value = { groups: null, graph: null, timeline: null }
    selectedPersonId.value = null
    selectedPersonIds.value = []
    selectedRelationshipIds.value = []
    marqueeActive.value = false
    modalOpen.value = false
    formOpen.value = false
    editingPerson.value = null
    relPopup.value = null
    checkpoint.value = null
    userCurrentYear.value = null
  }

  async function logout() {
    // On the hosted build, sign-out is Supabase's; the state teardown is shared.
    if (usingSupabase) return signOut()
    // Close the profile/projects pages first so they don't linger over the curtain.
    userPageOpen.value = false
    projectsPageOpen.value = false
    browsePageOpen.value = false
    pricingOpen.value = false
    billingStatus.value = null
    await runWithCurtain(
      'logout',
      translate('storeMsg.signingOut'),
      async () => {
        await api.invoke('auth:logout')
        clearSessionToken()
        authUser.value = null
        authUsage.value = null
        clearWorkspace()
      },
      { min: 950, sub: translate('storeMsg.seeYouSoon') }
    )
  }

  // ── Supabase Auth actions (hosted web build) ──────────────────────────────
  // The supabase-js client persists its own session (localStorage) and attaches
  // the JWT to every query, so RLS just works once signed in. We lazy-import
  // the client so desktop/local builds never touch it (its module throws when
  // the .env is unset).
  let _sbClient = null
  function sbClient() {
    if (!_sbClient) _sbClient = import('../supabaseClient').then((m) => m.supabase)
    return _sbClient
  }

  // Derive the app's `authUser` from a Supabase user (or clear it). Keeps the
  // shape AccountMenu / caps expect; plan defaults to free (reads from the
  // profiles table can refine it later).
  function mirrorAuthUser(sbUser) {
    authUser.value = sbUser
      ? {
          id: sbUser.id,
          username: sbUser.email,
          plan: 'free',
          display_name: sbUser.user_metadata?.display_name || null,
          bio: null,
          avatar_hue: null,
          created_at: sbUser.created_at
        }
      : null
  }

  // Only (re)load data when the signed-in user actually changes, so the
  // repeated auth-state events supabase-js emits don't reload on every tick.
  let _loadedUserId = null
  async function applySupabaseSession(newSession, { initial = false } = {}) {
    session.value = newSession
    user.value = newSession?.user ?? null

    if (newSession?.user) {
      mirrorAuthUser(newSession.user)
      if (_loadedUserId === newSession.user.id) return
      _loadedUserId = newSession.user.id
      const load = async () => {
        await loadProjects()
        await loadAll()
      }
      // The very first restore on page load is silent; a fresh sign-in plays
      // the welcome curtain (same as the native flow).
      if (initial) await load()
      else {
        const name = newSession.user.email
        const welcome = name
          ? translate('storeMsg.welcomeName', { name })
          : translate('storeMsg.welcome')
        await runWithCurtain('login', welcome, load, {
          min: 1200,
          sub: translate('storeMsg.growingTree')
        })
      }
    } else {
      _loadedUserId = null
      mirrorAuthUser(null)
      clearWorkspace()
    }
  }

  // Called once on mount (hosted build). Resolves the stored session, then
  // keeps `user`/`session`/`authUser` in sync with Supabase for the app's life.
  async function initSupabaseAuth() {
    try {
      const supabase = await sbClient()
      const { data } = await supabase.auth.getSession()
      await applySupabaseSession(data.session, { initial: true })
      supabase.auth.onAuthStateChange((_event, newSession) => {
        applySupabaseSession(newSession)
      })
    } finally {
      authReady.value = true
    }
  }

  // { success, error?, needsConfirmation? }. With email confirmation on
  // (Supabase default) there is no session until the user confirms — the
  // login screen shows a "check your email" note in that case.
  async function signUp({ email, password }) {
    const supabase = await sbClient()
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { success: false, error: error.message }
    return { success: true, needsConfirmation: !data.session }
  }

  // On success the onAuthStateChange listener does the data load (behind the
  // welcome curtain), so callers just need to know it worked.
  async function signIn({ email, password }) {
    const supabase = await sbClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  async function signOut() {
    userPageOpen.value = false
    projectsPageOpen.value = false
    browsePageOpen.value = false
    pricingOpen.value = false
    billingStatus.value = null
    const supabase = await sbClient()
    await runWithCurtain(
      'logout',
      translate('storeMsg.signingOut'),
      // The listener fires SIGNED_OUT → applySupabaseSession(null) clears state.
      async () => {
        await supabase.auth.signOut()
      },
      { min: 950, sub: translate('storeMsg.seeYouSoon') }
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
    fetchFingerprints() // the cards' mandalas, fetched alongside
    const res = await api.invoke('projects:overview')
    return res.success ? res.data.projects : []
  }

  // ── Family fingerprint (shared/fingerprint.ts → lib/familyFingerprint.ts) ──
  // Structural features per project for the mandala cover art. Non-active
  // projects come from `projects:fingerprints` (cached here); the active one
  // is derived live from the loaded rows — a lazy computed, so it only runs
  // while a mandala is on screen (the component debounces its redraws).
  const fingerprints = ref({}) // projectId → FingerprintFeatures
  const fingerprintProjectId = ref(null) // the large Family fingerprint dialog
  const activeFingerprint = computed(() => {
    if (!activeProjectId.value) return null
    return computeFingerprintFeatures({
      projectId: activeProjectId.value,
      persons: persons.value,
      relationships: relationships.value,
      typeRoles: relTypeRoles.value,
      tags: tags.value,
      entityTags: entityTags.value
    })
  })
  function fingerprintOf(projectId) {
    if (!projectId) return null
    if (projectId === activeProjectId.value) return activeFingerprint.value
    return fingerprints.value[projectId] ?? null
  }
  async function fetchFingerprints() {
    const res = await api.invoke('projects:fingerprints')
    if (res.success && res.data) fingerprints.value = { ...fingerprints.value, ...res.data }
  }
  function openFingerprint(projectId) {
    fingerprintProjectId.value = projectId || activeProjectId.value
    if (fingerprintProjectId.value && !fingerprintOf(fingerprintProjectId.value)) {
      fetchFingerprints()
    }
  }
  function closeFingerprint() {
    fingerprintProjectId.value = null
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
    if (res.error?.includes('limit')) toast(res.error, { tone: 'warning' })
    return null
  }

  async function renameProject(id, name) {
    const res = await api.invoke('projects:rename', { id, name })
    if (res.success) {
      const idx = projects.value.findIndex((p) => p.id === id)
      if (idx !== -1) projects.value[idx] = res.data
    }
  }

  // Card metadata (name / description / visibility / hue / favorite).
  // Returns the api envelope so the Projects page can surface errors inline.
  async function updateProject(id, patch) {
    const res = await api.invoke('projects:update', { id, ...patch })
    if (res.success) {
      const idx = projects.value.findIndex((p) => p.id === id)
      if (idx !== -1) projects.value[idx] = res.data
    }
    return res
  }

  async function duplicateProject(id, name) {
    const res = await api.invoke('projects:duplicate', { id, name })
    if (res.success) {
      projects.value.push(res.data)
      refreshUsage()
    }
    return res
  }

  /** Download a project (default: the active one) as a portable project
   *  file — see projects:export. Resolves { success, data: { file } }. */
  async function exportProjectFile(id = activeProjectId.value) {
    const res = await api.invoke('projects:export', { id })
    if (!res.success) return res
    const base =
      String(res.data.project?.name || 'project')
        .replace(/[\\/:*?"<>|]+/g, '')
        .trim() || 'project'
    const file = `${base}.familytree.json`
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file
    a.click()
    // Revoking in the same tick can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return { success: true, data: { file } }
  }

  /** Import a project file's text as a NEW project (it does not switch to it). */
  async function importProjectFile(text) {
    let file
    try {
      file = JSON.parse(text)
    } catch {
      return { success: false, error: translate('storeMsg.notProjectFile') }
    }
    const res = await api.invoke('projects:import', { file })
    if (res.success) {
      projects.value.push(res.data)
      refreshUsage()
    }
    return res
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
      target?.name
        ? translate('storeMsg.opening', { name: defaultNameLabel(target.name) })
        : translate('storeMsg.switchingProject'),
      async () => {
        const res = await api.invoke('projects:setActive', { id })
        if (res.success) {
          activeProjectId.value = id
          // Reset UI state
          selectedPersonId.value = null
          selectedPersonIds.value = []
          selectedRelationshipIds.value = []
          marqueeActive.value = false
          modalOpen.value = false
          formOpen.value = false
          editingPerson.value = null
          relPopup.value = null
          userCurrentYear.value = null // revert to auto; restored from the project's saved layout
          // Reload data for new project
          await loadAll()
        }
      },
      { min: 850, sub: translate('storeMsg.loadingData') }
    )
  }

  // ── Data actions ──────────────────────────────────────────────────────────
  async function loadAll() {
    const [
      personsRes,
      fieldsRes,
      relsRes,
      relTypesRes,
      tagsRes,
      entityTagsRes,
      scenesRes,
      sceneTagsRes,
      charactersRes,
      mapsRes,
      erasRes,
      eventsRes,
      settingsRes
    ] = await Promise.all([
      api.invoke('persons:getAll'),
      api.invoke('fields:list'),
      api.invoke('relationships:getAll'),
      api.invoke('relTypes:getAll'),
      api.invoke('tags:getAll'),
      api.invoke('entity_tags:getAll'),
      api.invoke('scenes:getAll'),
      api.invoke('scene_tags:getAll'),
      api.invoke('characters:getAll'),
      api.invoke('maps:getAll'),
      api.invoke('eras:getAll'),
      api.invoke('events:getAll'),
      api.invoke('settings:getAll')
    ])
    if (personsRes.success) persons.value = personsRes.data
    if (fieldsRes.success) {
      fieldDefs.value = fieldsRes.data.defs
      fieldValues.value = fieldsRes.data.values
    }
    if (relsRes.success) relationships.value = relsRes.data
    if (relTypesRes.success) relTypes.value = relTypesRes.data
    if (tagsRes.success) tags.value = tagsRes.data
    if (entityTagsRes.success) entityTags.value = entityTagsRes.data
    if (scenesRes.success) scenes.value = scenesRes.data
    if (sceneTagsRes.success) sceneTags.value = sceneTagsRes.data
    if (charactersRes.success) characters.value = charactersRes.data
    if (mapsRes.success) maps.value = mapsRes.data
    // (A backend without the chronicle channels simply shows none.)
    eras.value = erasRes.success ? erasRes.data : []
    events.value = eventsRes.success ? eventsRes.data : []
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
    // Restore the action wheel's custom slots (null / garbage → defaults)
    try {
      const ws = saved.wheelSlots ? JSON.parse(saved.wheelSlots) : null
      wheelSlots.value = Array.isArray(ws) ? ws : null
    } catch {
      wheelSlots.value = null
    }
    // Restore the Sheet's column layout (garbage → defaults)
    sheetPrefs.value = parseSheetPrefs(saved.sheetPrefs)
    // Restore the graph style settings (saved as JSON under graph_* keys).
    // Unknown keys are dropped; missing/garbage ones keep their default.
    const restoredGraph = { ...GRAPH_SETTING_DEFAULTS }
    for (const key of Object.keys(GRAPH_SETTING_DEFAULTS)) {
      const raw = saved[`graph_${key}`]
      if (raw == null) continue
      try {
        const v = JSON.parse(raw)
        if (typeof v === typeof GRAPH_SETTING_DEFAULTS[key]) restoredGraph[key] = v
      } catch {
        /* stale value — keep the default */
      }
    }
    graphSettings.value = restoredGraph
    const restoredTimeline = { ...TIMELINE_SETTING_DEFAULTS }
    for (const key of Object.keys(TIMELINE_SETTING_DEFAULTS)) {
      const raw = saved[`timeline_${key}`]
      if (raw == null) continue
      try {
        const v = JSON.parse(raw)
        if (typeof v === typeof TIMELINE_SETTING_DEFAULTS[key]) restoredTimeline[key] = v
      } catch {
        /* stale value — keep the default */
      }
    }
    timelineSettings.value = restoredTimeline
    const restoredGroups = { ...GROUPS_SETTING_DEFAULTS }
    for (const key of Object.keys(GROUPS_SETTING_DEFAULTS)) {
      const raw = saved[`groups_${key}`]
      if (raw == null) continue
      try {
        const v = JSON.parse(raw)
        if (typeof v === typeof GROUPS_SETTING_DEFAULTS[key]) restoredGroups[key] = v
      } catch {
        /* stale value — keep the default */
      }
    }
    if (!['rings', 'venn'].includes(restoredGroups.zoneStyle)) restoredGroups.zoneStyle = 'rings'
    groupsSettings.value = restoredGroups
    // Restore the directory card style (unknown/stale values → classic)
    cardStyle.value = CARD_STYLES.includes(saved.cardStyle) ? saved.cardStyle : 'classic'
    profileStyle.value = PROFILE_STYLES.includes(saved.profileStyle)
      ? saved.profileStyle
      : 'cinematic'
    // Restore the directory viewing mode (unknown/stale values → grid)
    viewMode.value = VIEW_MODES.includes(saved.directoryViewMode) ? saved.directoryViewMode : 'grid'
    // Restore the Map view's open map (stale ids → the first map)
    activeMapId.value = maps.value.some((m) => m.id === saved.activeMapId)
      ? saved.activeMapId
      : maps.value[0]?.id || null
    // Undo stacks are per project — pick up this project's state
    refreshHistoryStatus()
  }

  // ── Undo / redo (data edits — see src/shared/history.ts) ──────────────────
  // The shared core snapshots every undoable data channel; these actions drive
  // the topbar buttons. Status is kept optimistically in sync (any successful
  // undoable mutation means "can undo, can't redo") and authoritatively after
  // undo/redo/load, so no extra round-trip rides on normal edits.
  //
  // On top of the data stack sits ONE client-side undo timeline per project
  // (the journal): every step the user can take back, in the order it
  // happened — data edits ({ kind: 'data' }, mirrored 1:1 by the server's
  // stack) interleaved with arrangement steps ({ kind: 'layout' }: a node
  // drag, a reshaped curve, a node restyle, a layout refresh). Ctrl+Z always
  // reverts the newest step of either kind. Layout steps carry a memento the
  // owning view (GraphCanvas, via registerLayoutHistory) captured BEFORE the
  // change; restoring it hands back the inverse memento for redo.
  const serverHistory = ref({
    canUndo: false,
    canRedo: false,
    undoChannel: null,
    redoChannel: null
  })
  const journals = new Map() // projectId → { undo: Entry[], redo: Entry[] }
  const journalTick = ref(0)
  const JOURNAL_CAP = 100
  function journalOf(pid = activeProjectId.value) {
    if (!journals.has(pid)) journals.set(pid, { undo: [], redo: [] })
    return journals.get(pid)
  }
  function pushJournal(entry) {
    const j = journalOf()
    j.undo.push(entry)
    if (j.undo.length > JOURNAL_CAP) j.undo.shift()
    j.redo.length = 0 // a new step forks history — the redo branch is gone
    journalTick.value++
  }
  const entryChannel = (e) => (!e ? null : e.kind === 'layout' ? 'layout:' + e.label : e.channel)

  // What the topbar buttons + undo toasts read. With an empty journal (e.g.
  // the desktop renderer reloaded while the main process kept its stacks) the
  // server's own status is the fallback.
  const historyStatus = computed(() => {
    void journalTick.value
    const j = journalOf()
    const s = serverHistory.value
    const top = j.undo[j.undo.length - 1]
    const rtop = j.redo[j.redo.length - 1]
    return {
      canUndo: j.undo.length > 0 || s.canUndo,
      canRedo: j.redo.length > 0 || (!j.undo.length && s.canRedo),
      undoChannel: top ? entryChannel(top) : s.undoChannel,
      redoChannel: rtop ? entryChannel(rtop) : s.redoChannel
    }
  })
  onUndoableMutation((channel) => {
    serverHistory.value = { canUndo: true, canRedo: false, undoChannel: channel, redoChannel: null }
    pushJournal({ kind: 'data', channel })
  })

  async function refreshHistoryStatus() {
    const res = await api.invoke('history:status')
    if (res.success) serverHistory.value = res.data
    journalTick.value++
  }

  // Arrangement history: each view registers the function that restores its
  // mementos (and returns the inverse one) — keyed by the memento's `view`
  // ('graph' when absent); views record steps as they happen.
  const layoutHistoryHandlers = new Map()
  function registerLayoutHistory(fn, view = 'graph') {
    layoutHistoryHandlers.set(view, fn)
    return () => {
      if (layoutHistoryHandlers.get(view) === fn) layoutHistoryHandlers.delete(view)
    }
  }
  /** Record one undoable arrangement step. `state` is the memento from
   *  BEFORE the change; `label` names it for the toast (move / curve / style
   *  / layout). */
  function recordLayoutStep(state, label = 'move') {
    if (!state) return
    pushJournal({ kind: 'layout', label, state })
  }
  /** Groups view: remember where these groups' rings sit (in the active
   *  groups scene) BEFORE they move, as one undo step. */
  function recordGroupMoves(tagIds, label = 'move') {
    const sceneId = activeSceneIds.value.groups
    const moves = []
    for (const tagId of tagIds) {
      const p = sceneTags.value.find((st) => st.scene_id === sceneId && st.tag_id === tagId)
      if (p) moves.push({ tagId, x: p.x, y: p.y })
    }
    if (moves.length)
      pushJournal({ kind: 'layout', label, state: { view: 'groups', sceneId, moves } })
  }
  async function restoreGroupMoves(state) {
    if (!scenes.value.some((s) => s.id === state.sceneId)) return null
    activeView.value = 'groups'
    if (activeSceneIds.value.groups !== state.sceneId) setActiveScene('groups', state.sceneId)
    const inverse = { view: 'groups', sceneId: state.sceneId, moves: [] }
    for (const m of state.moves) {
      const p = sceneTags.value.find((st) => st.scene_id === state.sceneId && st.tag_id === m.tagId)
      if (!p) continue
      inverse.moves.push({ tagId: m.tagId, x: p.x, y: p.y })
      await moveSceneTag(p.id, m.x, m.y)
    }
    return inverse.moves.length ? inverse : null
  }

  /** Forget every arrangement step (a checkpoint revert replaced the scenes
   *  wholesale, so old mementos would resurrect a discarded arrangement). */
  function dropLayoutHistory() {
    for (const j of journals.values()) {
      j.undo = j.undo.filter((e) => e.kind !== 'layout')
      j.redo = j.redo.filter((e) => e.kind !== 'layout')
    }
    journalTick.value++
  }

  /** Re-fetch every data slice a history restore can touch (arrangement state
   *  — scenes, settings — is outside the undo scope) and drop selections that
   *  no longer resolve. */
  async function reloadAfterHistory() {
    const [
      personsRes,
      fieldsRes,
      relsRes,
      relTypesRes,
      tagsRes,
      entityTagsRes,
      sceneTagsRes,
      charactersRes,
      erasRes,
      eventsRes
    ] = await Promise.all([
      api.invoke('persons:getAll'),
      api.invoke('fields:list'),
      api.invoke('relationships:getAll'),
      api.invoke('relTypes:getAll'),
      api.invoke('tags:getAll'),
      api.invoke('entity_tags:getAll'),
      api.invoke('scene_tags:getAll'),
      api.invoke('characters:getAll'),
      api.invoke('eras:getAll'),
      api.invoke('events:getAll')
    ])
    if (personsRes.success) persons.value = personsRes.data
    if (fieldsRes.success) {
      fieldDefs.value = fieldsRes.data.defs
      fieldValues.value = fieldsRes.data.values
    }
    if (relsRes.success) relationships.value = relsRes.data
    if (relTypesRes.success) relTypes.value = relTypesRes.data
    if (tagsRes.success) tags.value = tagsRes.data
    if (entityTagsRes.success) entityTags.value = entityTagsRes.data
    if (sceneTagsRes.success) sceneTags.value = sceneTagsRes.data
    if (charactersRes.success) characters.value = charactersRes.data
    if (erasRes.success) eras.value = erasRes.data
    if (eventsRes.success) events.value = eventsRes.data
    const alive = new Set(persons.value.map((p) => p.id))
    selectedPersonIds.value = selectedPersonIds.value.filter((id) => alive.has(id))
    if (selectedPersonId.value && !alive.has(selectedPersonId.value)) {
      selectedPersonId.value = selectedPersonIds.value.at(-1) ?? null
      modalOpen.value = false
    }
    const relAlive = new Set(relationships.value.map((r) => r.id))
    selectedRelationshipIds.value = selectedRelationshipIds.value.filter((id) => relAlive.has(id))
    // relPopup holds { rel } — the bond stays selected if it survived.
    if (relPopup.value && !relAlive.has(relPopup.value.rel?.id)) relPopup.value = null
    refreshUsage()
  }

  /** Undo/redo the newest step (data or arrangement). Resolves to the
   *  reverted/replayed channel name — 'layout:<label>' for arrangement steps —
   *  for the toast label, or null when there was nothing to do. */
  async function undo() {
    return stepHistory('undo')
  }
  async function redo() {
    return stepHistory('redo')
  }
  async function stepHistory(dir) {
    const j = journalOf()
    const from = dir === 'undo' ? j.undo : j.redo
    const to = dir === 'undo' ? j.redo : j.undo
    const top = from[from.length - 1]
    if (top?.kind === 'layout') {
      const view = top.state?.view || 'graph'
      const restore = view === 'groups' ? restoreGroupMoves : layoutHistoryHandlers.get(view)
      if (!restore) return null
      from.pop()
      const inverse = await restore(top.state)
      if (inverse) to.push({ ...top, state: inverse })
      journalTick.value++
      return entryChannel(top)
    }
    // A data step (or an empty journal → the server's own stack).
    const res = await api.invoke(dir === 'undo' ? 'history:undo' : 'history:redo')
    if (!res.success) {
      // The server has nothing to give (its stack is capped at 50): drop the
      // orphaned marker so the timeline doesn't stall on it.
      if (top) {
        from.pop()
        journalTick.value++
      }
      return null
    }
    if (top) to.push(from.pop())
    serverHistory.value = res.data.status
    journalTick.value++
    await reloadAfterHistory()
    return res.data.channel
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
      dropLayoutHistory() // the arrangement mementos describe discarded scenes
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
      toast(res.error, { tone: 'warning' })
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
      dropFromCasts(new Set([id]))
      selectedPersonIds.value = selectedPersonIds.value.filter((x) => x !== id)
      if (selectedPersonId.value === id) {
        selectedPersonId.value = selectedPersonIds.value.at(-1) ?? null
        modalOpen.value = false
      }
      refreshUsage()
    }
    return res
  }

  /** Create several people as one write / undo step (the Sheet's paste past
   *  the last row). rows: [{ values: [{ field_id, value }] }]. onCreated(ids)
   *  runs synchronously BEFORE the rows reach the store, so a caller can
   *  claim them (e.g. pin them) before any watcher sees them arrive. */
  async function createPersons(rows, { onCreated } = {}) {
    if (!rows.length) return { success: true, data: { persons: [], values: [] } }
    const res = await api.invoke('persons:createMany', { rows: JSON.parse(JSON.stringify(rows)) })
    if (res.success) {
      onCreated?.(res.data.persons.map((p) => p.id))
      persons.value = persons.value.concat(res.data.persons)
      fieldValues.value = fieldValues.value.concat(res.data.values)
      refreshUsage()
    }
    return res
  }

  /** Delete several people as one write / undo step (the Sheet's row delete,
   *  the graph's multi-select delete). `relationshipIds` also removes those
   *  bonds in the same step (a marquee selection of people + links). */
  async function deletePersons(ids, { relationshipIds = [] } = {}) {
    if (!ids.length && !relationshipIds.length) return { success: true, data: { ids: [] } }
    const res = await api.invoke('persons:deleteMany', {
      ids: [...ids],
      relationshipIds: [...relationshipIds]
    })
    if (res.success) {
      const gone = new Set(res.data.ids)
      const relGone = new Set(res.data.relationshipIds || [])
      persons.value = persons.value.filter((p) => !gone.has(p.id))
      fieldValues.value = fieldValues.value.filter((v) => !gone.has(v.person_id))
      relationships.value = relationships.value.filter(
        (r) => !relGone.has(r.id) && !gone.has(r.person_a_id) && !gone.has(r.person_b_id)
      )
      selectedRelationshipIds.value = selectedRelationshipIds.value.filter((id) => !relGone.has(id))
      entityTags.value = entityTags.value.filter((row) => !gone.has(row.entity_id))
      dropFromCasts(gone)
      selectedPersonIds.value = selectedPersonIds.value.filter((x) => !gone.has(x))
      if (gone.has(selectedPersonId.value)) {
        selectedPersonId.value = selectedPersonIds.value.at(-1) ?? null
        modalOpen.value = false
      }
      refreshUsage()
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

  /** Replace a trait's effect rules ([] removes them). One undo step. */
  function setTraitAuras(defId, auras) {
    return updateFieldDef({ id: defId, auras: JSON.parse(JSON.stringify(auras || [])) })
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

  /** Batch-save several people's trait values as ONE atomic write and one
   *  undo step (the Sheet's paste / fill / clear-range path).
   *  updates: [{ personId, values?, removals? }] — same shape per person as
   *  setFieldValues. JSON-cloned: callers often pass values read straight off
   *  reactive store rows, which Electron IPC can't clone. */
  async function setFieldValuesBatch(updates) {
    if (!updates.length) return { success: true, data: { persons: [], values: [] } }
    const res = await api.invoke('fields:setValuesBatch', {
      updates: JSON.parse(JSON.stringify(updates))
    })
    if (res.success) {
      // Patch rows in place (like setFieldValues) so the persons array keeps
      // its identity — views watching it don't rebuild for a cell edit.
      const byId = new Map(res.data.persons.map((p) => [p.id, p]))
      const list = persons.value
      for (let i = 0; i < list.length; i++) {
        const next = byId.get(list[i].id)
        if (next) list[i] = next
      }
      fieldValues.value = fieldValues.value
        .filter((v) => !byId.has(v.person_id))
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

  // ── Relationship-type actions (the registry) ───────────────────────────────
  async function createRelType(data) {
    const res = await api.invoke('relTypes:create', data)
    if (res.success) relTypes.value.push(res.data)
    return res
  }

  async function updateRelType(patch) {
    const res = await api.invoke('relTypes:update', patch)
    if (res.success) {
      const idx = relTypes.value.findIndex((d) => d.id === patch.id)
      if (idx !== -1) relTypes.value[idx] = res.data
    }
    return res
  }

  /** Deleting a custom type also removes its relationships (server cascade). */
  async function deleteRelType(id) {
    const res = await api.invoke('relTypes:delete', { id })
    if (res.success) {
      const removed = new Set(res.data.removedRelationships || [])
      relTypes.value = relTypes.value.filter((d) => d.id !== id)
      relationships.value = relationships.value.filter((r) => !removed.has(r.id))
    }
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

  /** Give a tag a special effect (null removes it). One undo step. */
  function setTagAura(tagId, aura) {
    return updateTag({ id: tagId, aura: aura ? JSON.parse(JSON.stringify(aura)) : null })
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

  // ── Map actions (the Map view) ─────────────────────────────────────────────
  /** Upsert a MapDoc (create without an id; patch the given fields with one).
   *  The Map view edits its own working copy and autosaves through here. */
  async function saveMap(data) {
    const res = await api.invoke('maps:save', data)
    if (res.success) {
      const idx = maps.value.findIndex((m) => m.id === res.data.id)
      if (idx !== -1) maps.value[idx] = res.data
      else maps.value.push(res.data)
    }
    return res
  }

  async function deleteMap(id) {
    const res = await api.invoke('maps:delete', { id })
    if (res.success) {
      maps.value = maps.value.filter((m) => m.id !== id)
      if (activeMapId.value === id) setActiveMapId(maps.value[0]?.id || null)
    }
    return res
  }

  // ── Chronicle actions (eras + story events — src/shared/chronicle.ts) ───────
  // Saves upsert (no id = create). Payloads are JSON-cloned at the boundary
  // (Vue proxies can't cross Electron IPC). Deleting a person drops them from
  // events' casts server-side, so person deletes refresh events below.
  const plain = (v) => JSON.parse(JSON.stringify(v))
  function upsertInto(list, row) {
    const idx = list.value.findIndex((x) => x.id === row.id)
    if (idx !== -1) list.value[idx] = row
    else list.value.push(row)
  }
  async function saveEra(data) {
    const res = await api.invoke('eras:save', plain(data))
    if (res.success) upsertInto(eras, res.data)
    return res
  }
  /** Several eras in one write / one undo step (the preset packs). */
  async function saveEras(list) {
    const res = await api.invoke('eras:saveMany', { eras: plain(list) })
    if (res.success) for (const e of res.data) upsertInto(eras, e)
    return res
  }
  async function deleteEra(id) {
    const res = await api.invoke('eras:delete', { id })
    if (res.success) eras.value = eras.value.filter((e) => e.id !== id)
    return res
  }
  async function saveEvent(data) {
    const res = await api.invoke('events:save', plain(data))
    if (res.success) upsertInto(events, res.data)
    return res
  }
  async function deleteEvent(id) {
    const res = await api.invoke('events:delete', { id })
    if (res.success) events.value = events.value.filter((e) => e.id !== id)
    return res
  }
  /** Mirror the server: deleted people leave every event's cast. */
  function dropFromCasts(gone) {
    if (!events.value.some((e) => e.person_ids.some((p) => gone.has(p)))) return
    events.value = events.value.map((e) =>
      e.person_ids.some((p) => gone.has(p))
        ? { ...e, person_ids: e.person_ids.filter((p) => !gone.has(p)) }
        : e
    )
  }
  async function refreshEvents() {
    const res = await api.invoke('events:getAll')
    if (res.success) events.value = res.data
  }
  /** Open the era editor on an existing era (by id) or a fresh draft. */
  function openEraEditor(seed = {}) {
    const existing = seed.id ? eras.value.find((e) => e.id === seed.id) : null
    chronicleEditor.value = { kind: 'era', data: plain(existing || seed) }
  }
  /** Open the event editor on an existing event (by id) or a fresh draft
   *  (e.g. { date: {year}, person_ids: [id] }). */
  function openEventEditor(seed = {}) {
    const existing = seed.id ? events.value.find((e) => e.id === seed.id) : null
    chronicleEditor.value = { kind: 'event', data: plain(existing || seed) }
  }
  function closeChronicleEditor() {
    chronicleEditor.value = null
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

  function selectPerson(id, { modal = true } = {}) {
    selectedPersonId.value = id
    selectedPersonIds.value = id ? [id] : []
    selectedRelationshipIds.value = []
    marqueeActive.value = false
    if (modal) modalOpen.value = !!id
  }

  // Shift-click on the graph canvas: add/remove a person from the multi-selection
  // without opening the detail modal. The primary selection tracks the last touch.
  function toggleSelectPerson(id) {
    if (!id) return
    const cur = selectedPersonIds.value
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    selectedPersonIds.value = next
    selectedPersonId.value = next.length ? next[next.length - 1] : null
    selectedRelationshipIds.value = []
    marqueeActive.value = false
  }

  // Graph marquee (box / lasso) result: remember the full capture, then apply the
  // active type filter to derive what's actually selected.
  function setMarqueeSelection({ personIds = [], relIds = [] }) {
    lastMarquee.value = { personIds: [...personIds], relIds: [...relIds] }
    marqueeActive.value = personIds.length > 0 || relIds.length > 0
    relPopup.value = null
    applySelectionFilter(selectionFilter.value)
  }
  // Re-derive the selection from the last marquee capture for a given filter, so
  // the action pane's Both / Nodes / Bonds toggle narrows (and restores) live.
  function applySelectionFilter(f) {
    selectionFilter.value = f
    const { personIds, relIds } = lastMarquee.value
    const pids = f === 'bonds' ? [] : personIds
    const rids = f === 'nodes' ? [] : relIds
    selectedPersonIds.value = [...pids]
    selectedPersonId.value = pids.length ? pids[pids.length - 1] : null
    selectedRelationshipIds.value = [...rids]
    if (modalOpen.value) modalOpen.value = false
  }
  function clearGraphSelection() {
    selectedPersonId.value = null
    selectedPersonIds.value = []
    selectedRelationshipIds.value = []
    marqueeActive.value = false
    lastMarquee.value = { personIds: [], relIds: [] }
    relPopup.value = null
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

  // `animate` grows the new theme out of the clicked control as a circle
  // (lib/themeReveal.js); startup restores pass false so nothing flashes.
  function setTheme(t, { animate = true, origin } = {}) {
    if (!THEMES.includes(t)) return
    const changed = t !== theme.value
    const ornate = (th) => th === 'ink' || th === 'medieval'
    if (t === 'ink') installInkAssets() // paper/brush textures as CSS vars, generated once
    if (t === 'medieval') installMedievalAssets() // vellum, flourishes, seal — once
    if (ornate(t) && !ornate(theme.value)) returnTheme.value = theme.value
    const apply = async () => {
      theme.value = t
      document.documentElement.dataset.theme = t
      await nextTick() // let watchers (renderers) recolour inside the snapshot
    }
    // into or out of ink, the new theme bleeds across as an ink blot; into or
    // out of medieval, it burns through the page
    const reveal =
      t === 'medieval' || theme.value === 'medieval'
        ? 'burn'
        : t === 'ink' || theme.value === 'ink'
          ? 'ink'
          : 'circle'
    if (animate && changed) revealTransition(apply, origin, { style: reveal })
    else apply()
    if (animate) api.invoke('globalSettings:set', { key: 'theme', value: t })
  }

  /** Apply (and, unless `persist` is false, save) the UI accent color. */
  function setAccent(hex, { persist = true } = {}) {
    const clean = normalizeHex(hex) ?? DEFAULT_ACCENT
    accent.value = clean
    const style = document.documentElement.style
    for (const [k, v] of Object.entries(accentVars(clean))) style.setProperty(k, v)
    if (persist) api.invoke('globalSettings:set', { key: 'accent', value: clean })
  }

  /** Open the Style Studio on its Special effects chapter, optionally focused
   *  on one tag / trait ({ kind: 'tag' | 'trait', id }). */
  function openAuras(focus = null) {
    auraFocus.value = focus ? { ...focus, at: Date.now() } : { at: Date.now() }
    toggleSettings(true, { layer: 'app' })
  }

  /** Open/close the Style Studio. `open` forces a state; `layer` brings
   *  that layer ('app' | 'view') to the front as it opens. */
  function toggleSettings(open, { layer } = {}) {
    settingsOpen.value = typeof open === 'boolean' ? open : !settingsOpen.value
    if (settingsOpen.value && (layer === 'app' || layer === 'view')) styleLayer.value = layer
  }

  function toggleAppSettings(open) {
    appSettingsOpen.value = typeof open === 'boolean' ? open : !appSettingsOpen.value
    if (appSettingsOpen.value) appSettingsTab.value = 'general'
  }

  /** Open Settings on a specific tab ('general' | 'help' | 'feedback' | 'about'). */
  function openAppSettings(tab = 'general') {
    appSettingsTab.value = tab
    appSettingsOpen.value = true
  }

  function toggleUserPage(open) {
    userPageOpen.value = typeof open === 'boolean' ? open : !userPageOpen.value
  }

  function toggleProjectsPage(open) {
    projectsPageOpen.value = typeof open === 'boolean' ? open : !projectsPageOpen.value
  }

  function toggleBrowsePage(open) {
    browsePageOpen.value = typeof open === 'boolean' ? open : !browsePageOpen.value
  }

  // ── Monetization ───────────────────────────────────────────────────────────
  // Plan perks (not caps flags): paid plans are ad-free and wear a badge.
  const adFree = computed(() => planHasPerk(authUser.value?.plan, 'adFree'))
  const isPaid = computed(() => isPaidPlan(authUser.value?.plan))

  /** Open the pricing dialog. `ctx.reason` tailors its headline (a quota
   *  hit, the "remove ads" link…); `ctx.plan` preselects a tier. */
  function openPricing(ctx = {}) {
    pricingContext.value = ctx
    pricingOpen.value = true
  }
  function closePricing() {
    pricingOpen.value = false
  }

  // The server owns the plan: whenever billing reports one that differs from
  // the session's, adopt it and re-read the (plan-dependent) quotas.
  function applyBillingStatus(status) {
    billingStatus.value = status
    if (authUser.value && status?.plan && authUser.value.plan !== status.plan) {
      authUser.value = { ...authUser.value, plan: status.plan }
      refreshUsage()
    }
  }

  async function loadBilling() {
    const [catalog, status] = await Promise.all([
      api.invoke('billing:catalog', {}),
      api.invoke('billing:status', {})
    ])
    billingCatalog.value = catalog.success ? catalog.data : { provider: 'none' }
    if (status.success) applyBillingStatus(status.data)
    return status
  }

  function quoteBilling(plan, interval, coupon) {
    return api.invoke('billing:quote', { plan, interval, coupon: coupon || null })
  }

  /** Begin checkout. Resolves the session; a real provider will hand back a
   *  hosted-checkout `url` to open (docs/MONETIZATION.md). */
  function startCheckout(plan, interval, coupon) {
    return api.invoke('billing:createCheckout', { plan, interval, coupon: coupon || null })
  }

  /** SANDBOX ONLY — finish a checkout as 'success' | 'fail' | 'cancel'. */
  async function completeSandboxCheckout(id, outcome) {
    const res = await api.invoke('billing:completeSandboxCheckout', { id, outcome })
    if (res.success) applyBillingStatus(res.data.status)
    return res
  }

  async function cancelSubscription() {
    const res = await api.invoke('billing:cancel', {})
    if (res.success) applyBillingStatus(res.data)
    return res
  }

  async function resumeSubscription() {
    const res = await api.invoke('billing:resume', {})
    if (res.success) applyBillingStatus(res.data)
    return res
  }

  // Open the profile page behind the curtain so the (brief) fetch of the
  // per-project overview is hidden and the entrance feels deliberate.
  function openUserPage() {
    return runWithCurtain(
      'profile',
      translate('storeMsg.yourProfile'),
      async () => {
        userPageOpen.value = true
        // Give the page a beat to mount and kick off its overview fetch.
        await new Promise((r) => setTimeout(r, 80))
      },
      { min: 700, sub: translate('storeMsg.gatheringAccount') }
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

  /** Ink theme on/off (the topbar 墨 seal): off returns to the theme it left. */
  function toggleInk(opts = {}) {
    setTheme(theme.value === 'ink' ? returnTheme.value || 'light' : 'ink', opts)
  }

  /** Medieval theme on/off (the topbar shield): off returns to the theme it left. */
  function toggleMedieval(opts = {}) {
    setTheme(theme.value === 'medieval' ? returnTheme.value || 'light' : 'medieval', opts)
  }

  /** Switch the person profile's presentation and remember it for this project. */
  function setProfileStyle(id) {
    if (!PROFILE_STYLES.includes(id) || id === profileStyle.value) return
    profileStyle.value = id
    api.invoke('settings:set', { key: 'profileStyle', value: id })
  }

  /** Switch the Directory's card style and remember it for this project. */
  function setCardStyle(id) {
    if (!CARD_STYLES.includes(id) || id === cardStyle.value) return
    cardStyle.value = id
    api.invoke('settings:set', { key: 'cardStyle', value: id })
  }

  /** Open a map in the Map view and remember it for this project. */
  function setActiveMapId(id) {
    if (id === activeMapId.value) return
    activeMapId.value = id
    api.invoke('settings:set', { key: 'activeMapId', value: id })
  }

  /** Switch the Directory's viewing mode and remember it for this project. */
  function setViewMode(id) {
    if (!VIEW_MODES.includes(id) || id === viewMode.value) return
    viewMode.value = id
    api.invoke('settings:set', { key: 'directoryViewMode', value: id })
  }

  /** Merge a patch into the Sheet's column layout and remember it. */
  function setSheetPrefs(patch) {
    sheetPrefs.value = parseSheetPrefs(JSON.stringify({ ...sheetPrefs.value, ...patch }))
    api.invoke('settings:set', { key: 'sheetPrefs', value: JSON.stringify(sheetPrefs.value) })
  }

  /** Save the action wheel's slot layout (null reverts to the defaults). */
  function setWheelSlots(slots) {
    wheelSlots.value = slots ? JSON.parse(JSON.stringify(slots)) : null
    api.invoke('settings:set', { key: 'wheelSlots', value: JSON.stringify(wheelSlots.value) })
  }

  function updateTimelineSetting(key, value) {
    timelineSettings.value = { ...timelineSettings.value, [key]: value }
    api.invoke('settings:set', { key: `timeline_${key}`, value: JSON.stringify(value) })
  }
  /** Apply several timeline settings at once (looks, chapter resets) — one
   *  reactive update, then persist each key. */
  function applyTimelineSettings(patch) {
    timelineSettings.value = { ...timelineSettings.value, ...patch }
    for (const [key, value] of Object.entries(patch))
      api.invoke('settings:set', { key: `timeline_${key}`, value: JSON.stringify(value) })
  }
  /** Apply Groups view style settings (one control, a chapter reset) — one
   *  reactive update, then persist each key. */
  function applyGroupsSettings(patch) {
    groupsSettings.value = { ...groupsSettings.value, ...patch }
    for (const [key, value] of Object.entries(patch))
      api.invoke('settings:set', { key: `groups_${key}`, value: JSON.stringify(value) })
  }
  function updateGroupsSetting(key, value) {
    applyGroupsSettings({ [key]: value })
  }
  function resetTimelineSettings() {
    for (const [key, value] of Object.entries(TIMELINE_SETTING_DEFAULTS))
      updateTimelineSetting(key, value)
  }

  function updateGraphSetting(key, value) {
    graphSettings.value[key] = value
    api.invoke('settings:set', { key: `graph_${key}`, value: JSON.stringify(value) })
  }

  /** Apply several graph settings at once (theme presets) — one reactive
   *  update, then persist each key. */
  function applyGraphSettings(patch) {
    graphSettings.value = { ...graphSettings.value, ...patch }
    for (const [key, value] of Object.entries(patch))
      api.invoke('settings:set', { key: `graph_${key}`, value: JSON.stringify(value) })
  }

  function resetGraphSettings() {
    applyGraphSettings({ ...GRAPH_SETTING_DEFAULTS })
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
    // Supabase Auth (hosted web build)
    usingSupabase,
    user,
    session,
    initSupabaseAuth,
    signUp,
    signIn,
    signOut,
    refreshUsage,
    updateProfile,
    changePassword,
    fetchProjectsOverview,
    fingerprints,
    fingerprintProjectId,
    activeFingerprint,
    fingerprintOf,
    fetchFingerprints,
    openFingerprint,
    closeFingerprint,
    // project
    projects,
    activeProjectId,
    activeProject,
    loadProjects,
    createProject,
    renameProject,
    updateProject,
    duplicateProject,
    exportProjectFile,
    importProjectFile,
    deleteProject,
    switchProject,
    // state
    persons,
    fieldDefs,
    fieldValues,
    fieldDefById,
    fieldValuesOf,
    relationships,
    relTypes,
    relTypeByKey,
    relTypeRoles,
    tags,
    entityTags,
    scenes,
    sceneTags,
    characters,
    maps,
    eras,
    events,
    chronicleEditor,
    saveEra,
    saveEras,
    deleteEra,
    saveEvent,
    deleteEvent,
    refreshEvents,
    openEraEditor,
    openEventEditor,
    closeChronicleEditor,
    activeSceneId,
    activeSceneIds,
    draggingPersonId,
    selectedPersonId,
    selectedPersonIds,
    selectedRelationshipIds,
    selectionFilter,
    marqueeTool,
    marqueeActive,
    lastMarquee,
    setMarqueeSelection,
    applySelectionFilter,
    clearGraphSelection,
    inspectorTab,
    modalOpen,
    formOpen,
    editingPerson,
    theme,
    isLightTheme,
    isInk,
    toggleInk,
    isMedieval,
    toggleMedieval,
    accent,
    setAccent,
    settingsOpen,
    styleLayer,
    appSettingsOpen,
    userPageOpen,
    projectsPageOpen,
    toggleProjectsPage,
    browsePageOpen,
    toggleBrowsePage,
    pricingOpen,
    pricingContext,
    billingCatalog,
    billingStatus,
    adFree,
    isPaid,
    openPricing,
    closePricing,
    loadBilling,
    quoteBilling,
    startCheckout,
    completeSandboxCheckout,
    cancelSubscription,
    resumeSubscription,
    curtain,
    runWithCurtain,
    openUserPage,
    language,
    graphSettings,
    dynamicsPalette,
    timelineSettings,
    updateTimelineSetting,
    groupsSettings,
    updateGroupsSetting,
    applyGroupsSettings,
    GROUPS_SETTING_DEFAULTS,
    resetTimelineSettings,
    lockNodes,
    cleanView,
    timeDrag,
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
    wheelSlots,
    setWheelSlots,
    cardStyle,
    setCardStyle,
    profileStyle,
    setProfileStyle,
    viewMode,
    setViewMode,
    sheetPrefs,
    setSheetPrefs,
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
    deletePersons,
    createPersons,
    refreshFields,
    createFieldDef,
    updateFieldDef,
    deleteFieldDef,
    reorderFieldDefs,
    setFieldSlot,
    setFieldValues,
    setFieldValuesBatch,
    applyFieldDisplayAll,
    createRelationship,
    updateRelationship,
    deleteRelationship,
    createRelType,
    updateRelType,
    deleteRelType,
    createTag,
    updateTag,
    setTagAura,
    setTraitAuras,
    auraResolution,
    auraOf,
    auraFocus,
    openAuras,
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
    saveMap,
    deleteMap,
    activeMapId,
    setActiveMapId,
    saveCharacter,
    deleteCharacter,
    setCharacterPortrait,
    selectPerson,
    toggleSelectPerson,
    openForm,
    closeModal,
    closeForm,
    setTheme,
    toggleSettings,
    toggleAppSettings,
    openAppSettings,
    appSettingsTab,
    toggleUserPage,
    setLanguage,
    setCurrentYear,
    updateGraphSetting,
    applyGraphSettings,
    resetGraphSettings,
    applyTimelineSettings,
    GRAPH_SETTING_DEFAULTS,
    TIMELINE_SETTING_DEFAULTS,
    hasUnsavedChanges,
    saveCheckpoint,
    revertToCheckpoint,
    historyStatus,
    refreshHistoryStatus,
    undo,
    redo,
    registerLayoutHistory,
    recordLayoutStep,
    recordGroupMoves,
    dropLayoutHistory
  }
})
