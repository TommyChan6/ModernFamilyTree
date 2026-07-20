import type { ApiBackend } from '../types'
import type { DB, Env } from '../../../../shared/types'
import { unwrapRequest } from '../../../../shared/auth'
import { channelHandlers, EMPTY_DB } from '../../../../shared/dbCore'
import { ensureProjectFields } from '../../../../shared/fields'
import { ensureProjectRelTypes } from '../../../../shared/relTypes'
import { pickImageAsDataUrl } from './local'

// Supabase backend: the hosted implementation of the api seam. Each channel
// routes to the equivalent Postgres query against the tables in
// supabase/schema.sql, returning the exact { success, data } envelope the
// other backends produce — the store and components never know the difference.
//
// Vocabulary bridge (schema ↔ app): trees == projects, factions == tags,
// scenarios == scenes. Rows in Postgres carry `tree_id` / `owner_id`; the app
// expects `project_id` / `user_id` — the map*() helpers below translate both
// ways so nothing above the seam changes.
//
// Scope: persons / relationships / projects(trees) / tags(factions) +
// membership / scenes(scenarios) + placements / settings / images (photos in
// Supabase Storage, signed at read time), PLUS the trait system (fields:*)
// and relationship-type registry (relTypes:*) — those two reuse the shared
// handlers via the slice engine below. Still pending: characters and
// history/checkpoint — they return a clear "not implemented" error and the
// store keeps its empty defaults.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Payload = any

// ── Client (lazy) ────────────────────────────────────────────────────────────
// supabaseClient.js throws at import time when .env is missing. Importing it
// lazily keeps desktop/local builds bootable without Supabase config — the
// throw only surfaces if this backend is actually selected and used.
let _client: Promise<any> | null = null
function sb(): Promise<any> {
  if (!_client) _client = import('../../supabaseClient').then((m) => m.supabase)
  return _client
}

// Unwrap a supabase-js response, throwing its error so the invoke() catch
// turns it into { success: false, error } — same contract as the shells.
function ok<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

const uuid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

// ── Active tree (client-side selection) ──────────────────────────────────────
// dbCore kept `activeProjectId` inside the DB; on a shared server the "active
// tree" is per-device UI state, not data — so it lives here (module state +
// localStorage), written by projects:setActive and read by every scoped query.
const ACTIVE_KEY = 'familytree.supabase.activeProjectId'
let activeProjectId: string | null = localStorage.getItem(ACTIVE_KEY)

function setActiveProject(id: string | null) {
  activeProjectId = id
  if (id) localStorage.setItem(ACTIVE_KEY, id)
  else localStorage.removeItem(ACTIVE_KEY)
}

function requireActive(): string {
  if (!activeProjectId) throw new Error('No active tree selected')
  return activeProjectId
}

// ── Row ↔ app-shape mappers ──────────────────────────────────────────────────
/** trees row → Project ({ owner_id → user_id }). */
const mapTree = (t: any) => ({
  id: t.id,
  name: t.name,
  user_id: t.owner_id,
  created_at: t.created_at,
  updated_at: t.updated_at
})

/** Generic child row → app entity ({ tree_id → project_id }). */
const mapRow = ({ tree_id, ...rest }: any) => ({ ...rest, project_id: tree_id })

/** factions row → Tag (adds the app's `source` flag; hides member_ids —
 *  membership is served through the entity_tags:* channels below). */
const mapFaction = ({ tree_id, member_ids: _m, ...rest }: any) => ({
  ...rest,
  project_id: tree_id,
  source: 'manual'
})

/** scenarios row → Scene (placements live in their own channels). */
const mapScenario = ({ tree_id, scene_tags: _st, ...rest }: any) => ({
  ...rest,
  project_id: tree_id
})

// ── Small query helpers ──────────────────────────────────────────────────────
/** All rows of `table` in the active tree, oldest first (dbCore's sort). */
async function listForActive(table: string): Promise<any[]> {
  const client = await sb()
  return ok(
    await client
      .from(table)
      .select('*')
      .eq('tree_id', requireActive())
      .order('created_at', { ascending: true })
  )
}

/** Exact row count of `table` within one tree (HEAD request, no payload). */
async function countFor(table: string, treeId: string): Promise<number> {
  const client = await sb()
  const { count, error } = await client
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('tree_id', treeId)
  if (error) throw new Error(error.message)
  return count ?? 0
}

/** The signed-in Supabase user's id (needed where rows carry ownership). */
async function currentUserId(): Promise<string> {
  const client = await sb()
  const { data } = await client.auth.getUser()
  if (!data?.user) throw new Error('Not signed in')
  return data.user.id
}

// ── Photo storage (Supabase Storage, bucket 'images') ────────────────────────
// The DB row stores a bucket PATH (`<treeId>/<uuid>.webp`); the renderer needs
// a fetchable URL. getImageUrl is synchronous, so rows are signed AT READ TIME —
// every handler that returns image rows swaps file_path for a signed URL, and
// getImageUrl stays a passthrough. Storage access itself is policed by the
// policies in supabase/storage_policies.sql (same can_read/can_write rules).

const BUCKET = 'images'
const SIGN_TTL = 60 * 60 * 24 * 7 // signed URLs live a week; re-signed each load

/** Storage path → signed URL, in batch (one round-trip for N paths). Paths
 *  that are already URLs (data:/http, e.g. character renders mid-migration)
 *  pass through untouched. */
async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const toSign = paths.filter((p) => p && !/^(data:|https?:)/.test(p))
  for (const p of paths) if (!toSign.includes(p)) map.set(p, p)
  if (toSign.length) {
    const client = await sb()
    const rows = ok(await client.storage.from(BUCKET).createSignedUrls(toSign, SIGN_TTL)) as any[]
    for (const r of rows) if (r.signedUrl) map.set(r.path, r.signedUrl)
  }
  return map
}

/** Replace file_path with a signed URL on a batch of image rows. */
async function signImageRows(rows: any[]): Promise<any[]> {
  const signed = await signPaths(rows.map((r) => r.file_path))
  return rows.map((r) => ({ ...r, file_path: signed.get(r.file_path) ?? r.file_path }))
}

/** Sign the primary_image field on an engine result ({...person} or {person}). */
async function signPersonResult<T extends Record<string, any>>(res: T): Promise<T> {
  const target = res && typeof res === 'object' && 'person' in res ? res.person : res
  if (target?.primary_image) {
    const signed = await signPaths([target.primary_image])
    target.primary_image = signed.get(target.primary_image) ?? target.primary_image
  }
  return res
}

/** Compress a picked image before upload: fit within 512px, encode WebP
 *  (keeps transparency). This is the "hard client-side compression" from the
 *  image-storage plan — it keeps 300 photos comfortably inside the free
 *  Storage tier. Falls back to the original bytes if decoding fails (e.g. an
 *  exotic format the browser can't rasterize). */
async function compressForUpload(dataUrl: string): Promise<{ blob: Blob; ext: string }> {
  const original = await (await fetch(dataUrl)).blob()
  try {
    const bmp = await createImageBitmap(original)
    const scale = Math.min(1, 512 / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * scale))
    const h = Math.max(1, Math.round(bmp.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
    bmp.close()
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.85))
    if (blob) return { blob, ext: 'webp' }
  } catch {
    /* fall through to the original bytes */
  }
  const ext = (original.type.split('/')[1] || 'bin').toLowerCase()
  return { blob: original, ext }
}

/** Best-effort removal of stored objects (rows are the source of truth; a
 *  failed removal only leaks an orphan file, never breaks the delete). */
async function removeStorageObjects(paths: string[]): Promise<void> {
  const real = paths.filter((p) => p && !/^(data:|https?:)/.test(p))
  if (!real.length) return
  const client = await sb()
  await client.storage.from(BUCKET).remove(real)
}

/** Every stored object path for a set of image rows queried by column. */
async function imagePathsWhere(column: string, value: string): Promise<string[]> {
  const client = await sb()
  const rows = ok(await client.from('images').select('file_path').eq(column, value)) as any[]
  return rows.map((r) => r.file_path)
}

// ── Trait / registry engine (fields:*, relTypes:*, persons:create/update) ────
// These channels carry intricate, tested logic in the shared core (snapshot
// recompute, slot rules, value coercion, type validation, cascade). Instead of
// reimplementing it in SQL, we hydrate a small in-memory DB slice for the
// active tree, run the REAL shared channel handler against it, then persist
// whatever changed back to Postgres. The trait math thus has ONE source of
// truth, shared with desktop and the browser-local backend.
//
// Scale note: this loads the active tree's people/traits per call — fine within
// the plan's per-user caps; a later optimization can scope it tighter.

const engineEnv: Env = {
  uuid,
  nowStr: now,
  storeImageFile: (p: string) => p,
  removeImageFile: () => {}
}

// How one Postgres table maps to one in-memory DB map. The app-internal
// registries (field_defs / field_values / rel_type_defs) store the whole entity
// as a `doc` JSONB column, so hydrate/persist is trivial; the others map column
// by column. `readOnly` tables are hydrated for context but never written back.
interface TableSpec {
  table: string
  map: keyof DB
  toEntity: (row: any) => any
  toRow?: (entity: any, treeId: string) => any
  readOnly?: boolean
}

const personsSpec: TableSpec = {
  table: 'persons',
  map: 'persons',
  toEntity: (r) => ({
    id: r.id,
    project_id: r.tree_id,
    name: r.name,
    birth: r.birth,
    death: r.death,
    gender: r.gender,
    gender_t: r.gender_t,
    bio: r.bio,
    occupation: r.occupation,
    location: r.location,
    graph_label: r.graph_label,
    highlight: r.highlight,
    created_at: r.created_at,
    updated_at: r.updated_at
  }),
  toRow: (p, treeId) => ({
    id: p.id,
    tree_id: treeId,
    name: p.name ?? '',
    birth: p.birth ?? null,
    death: p.death ?? null,
    gender: p.gender ?? 'unknown',
    gender_t: p.gender_t ?? null,
    bio: p.bio ?? '',
    occupation: p.occupation ?? '',
    location: p.location ?? '',
    graph_label: p.graph_label ?? p.name ?? '',
    highlight: p.highlight ?? null,
    created_at: p.created_at,
    updated_at: p.updated_at
  })
}

// A registry table whose row is { id, tree_id, doc, ...extra } and whose entity
// IS the doc. `extra` adds denormalized columns (person_id / key) for FKs/lookups.
const docSpec = (table: string, map: keyof DB, extra?: (e: any) => any): TableSpec => ({
  table,
  map,
  toEntity: (r) => r.doc,
  toRow: (e, treeId) => ({ id: e.id, tree_id: treeId, doc: e, ...(extra ? extra(e) : {}) })
})

const fieldDefsSpec = docSpec('field_defs', 'field_defs')
const fieldValuesSpec = docSpec('field_values', 'field_values', (v) => ({ person_id: v.person_id }))
const relTypeDefsSpec = docSpec('rel_type_defs', 'rel_type_defs', (d) => ({ key: d.key }))

const imagesSpec: TableSpec = {
  table: 'images',
  map: 'images',
  readOnly: true, // hydrated only so primaryImageOf() resolves; never written here
  toEntity: (r) => ({
    id: r.id,
    project_id: r.tree_id,
    person_id: r.person_id,
    file_path: r.file_path,
    is_primary: r.is_primary,
    role: r.role,
    source: r.source,
    created_at: r.created_at
  })
}

const relationshipsSpec: TableSpec = {
  table: 'relationships',
  map: 'relationships',
  toEntity: (r) => ({
    id: r.id,
    project_id: r.tree_id,
    person_a_id: r.person_a_id,
    person_b_id: r.person_b_id,
    type: r.type,
    status: r.status,
    formed: r.formed,
    ended: r.ended,
    label: r.label,
    created_at: r.created_at
  }),
  toRow: (r, treeId) => ({
    id: r.id,
    tree_id: treeId,
    person_a_id: r.person_a_id,
    person_b_id: r.person_b_id,
    type: r.type,
    status: r.status,
    formed: r.formed ?? null,
    ended: r.ended ?? null,
    label: r.label ?? null,
    created_at: r.created_at
  })
}

// fields:* and persons:create/update touch people + their traits (+ images for
// the returned primary photo). relTypes:* touch the registry (+ relationships,
// which a custom-type delete cascades away).
const TRAIT_SPECS = [personsSpec, fieldDefsSpec, fieldValuesSpec, imagesSpec]
const RELTYPE_SPECS = [relTypeDefsSpec, relationshipsSpec]

// Hydrate → run the shared handler → persist the diff. The handler's result is
// already in app shape (project_id, etc.), so it's returned verbatim.
async function runEngine(
  channel: string,
  data: Payload,
  specs: TableSpec[],
  opts: { seedFields?: boolean; seedRelTypes?: boolean } = {}
): Promise<unknown> {
  const treeId = requireActive()
  const client = await sb()
  const db = EMPTY_DB()
  db.activeProjectId = treeId

  // 1. Hydrate the active tree's rows into the in-memory slice.
  await Promise.all(
    specs.map(async (spec) => {
      const rows = ok(await client.from(spec.table).select('*').eq('tree_id', treeId)) as any[]
      const target = db[spec.map] as Record<string, any>
      for (const r of rows) target[r.id] = spec.toEntity(r)
    })
  )

  // 2. Snapshot the writable maps so we can tell what changed. This MUST come
  // before the self-heal seeding below: seeded defs are new rows that need to
  // reach Postgres, so they have to register as diffs. (Seeding after the
  // snapshot once made every call re-seed transient defs with fresh ids that
  // were never persisted — trait saves pointed at ghosts and silently no-oped.)
  const before = new Map<string, Map<string, string>>()
  for (const spec of specs) {
    if (spec.readOnly) continue
    const m = new Map<string, string>()
    for (const [id, e] of Object.entries(db[spec.map] as Record<string, any>)) {
      m.set(id, JSON.stringify(e))
    }
    before.set(spec.table, m)
  }

  // Self-heal: a tree missing its default trait defs / built-in rel types gets
  // them now (idempotent — a no-op once seeded, and persisted via the diff).
  // Covers trees created before this step and adopts any legacy person columns
  // into trait values.
  if (opts.seedFields) ensureProjectFields(db, treeId, engineEnv)
  if (opts.seedRelTypes) ensureProjectRelTypes(db, treeId, engineEnv)

  // 3. Run the real shared channel handler (no ctx.user → app-level quota is
  //    skipped; the DB triggers enforce plan limits instead).
  const result = await channelHandlers[channel](db, data, engineEnv, { user: null, token: null })

  // 4. Persist inserts/updates (changed JSON) and deletes (gone from the map).
  for (const spec of specs) {
    if (spec.readOnly || !spec.toRow) continue
    const prev = before.get(spec.table) as Map<string, string>
    const after = db[spec.map] as Record<string, any>
    const upserts: any[] = []
    for (const [id, e] of Object.entries(after)) {
      if (prev.get(id) !== JSON.stringify(e)) upserts.push(spec.toRow(e, treeId))
    }
    const deletes: string[] = []
    for (const id of prev.keys()) if (!(id in after)) deletes.push(id)
    if (upserts.length) ok(await client.from(spec.table).upsert(upserts))
    if (deletes.length) ok(await client.from(spec.table).delete().in('id', deletes))
  }

  return result
}

// ── Channel handlers ─────────────────────────────────────────────────────────
const handlers: Record<string, (data: Payload) => Promise<unknown>> = {
  // ── projects (trees) ───────────────────────────────────────────────────────

  // projects:getAll → SELECT trees (RLS narrows to mine/shared/public).
  // activeProjectId is the client-side selection, defaulted to the first tree.
  async 'projects:getAll'() {
    const client = await sb()
    const rows = ok(
      await client.from('trees').select('*').order('created_at', { ascending: true })
    ) as any[]
    if (!rows.some((t) => t.id === activeProjectId)) setActiveProject(rows[0]?.id ?? null)
    return { projects: rows.map(mapTree), activeProjectId }
  },

  // projects:overview → trees + per-tree HEAD counts (persons/relationships/
  // images) for the profile page's cards.
  async 'projects:overview'() {
    const client = await sb()
    const rows = ok(
      await client.from('trees').select('*').order('created_at', { ascending: true })
    ) as any[]
    const projects = await Promise.all(
      rows.map(async (t) => ({
        ...mapTree(t),
        counts: {
          persons: await countFor('persons', t.id),
          relationships: await countFor('relationships', t.id),
          images: await countFor('images', t.id)
        }
      }))
    )
    return { projects, activeProjectId }
  },

  // projects:create → INSERT a tree owned by the signed-in user. The plan
  // quota is enforced by the trees_enforce_limit DB trigger (its error message
  // surfaces here). Default trait/relType defs are seeded in the fields step.
  async 'projects:create'(data) {
    const client = await sb()
    const row = ok(
      await client
        .from('trees')
        .insert({ name: data?.name || 'Unnamed Project', owner_id: await currentUserId() })
        .select()
        .single()
    )
    return mapTree(row)
  },

  // projects:rename → UPDATE trees.name (RLS: owner/editor only).
  async 'projects:rename'(data) {
    const client = await sb()
    const row = ok(
      await client
        .from('trees')
        .update({ name: data.name, updated_at: now() })
        .eq('id', data.id)
        .select()
        .single()
    )
    return mapTree(row)
  },

  // projects:delete → DELETE the tree row; every FK in schema.sql is
  // ON DELETE CASCADE, so persons/relationships/factions/scenarios/images/
  // settings vanish server-side (dbCore did this cascade by hand). The tree's
  // photo files are removed from the bucket first (rows are about to cascade).
  async 'projects:delete'(data) {
    await removeStorageObjects(await imagePathsWhere('tree_id', data.id))
    const client = await sb()
    ok(await client.from('trees').delete().eq('id', data.id))
    if (activeProjectId === data.id) {
      const remaining = ok(
        await client.from('trees').select('id').order('created_at', { ascending: true }).limit(1)
      ) as any[]
      setActiveProject(remaining[0]?.id ?? null)
    }
    return { id: data.id, newActiveProjectId: activeProjectId }
  },

  // projects:setActive → no server write: the active tree is device-local
  // UI state now. We just verify the tree is visible to us (RLS answers).
  async 'projects:setActive'(data) {
    const client = await sb()
    const rows = ok(await client.from('trees').select('id').eq('id', data.id).limit(1)) as any[]
    if (!rows.length) throw new Error('Project not found')
    setActiveProject(data.id)
    return { activeProjectId: data.id }
  },

  // ── persons ───────────────────────────────────────────────────────────────

  // persons:getAll → SELECT persons in the active tree, plus each person's
  // primary photo (one query for the whole tree, batch-signed).
  async 'persons:getAll'() {
    const client = await sb()
    const [rows, primaries] = await Promise.all([
      listForActive('persons'),
      client
        .from('images')
        .select('person_id, file_path')
        .eq('tree_id', requireActive())
        .eq('is_primary', true)
        .then(ok) as Promise<any[]>
    ])
    const signed = await signPaths(primaries.map((i) => i.file_path))
    const byPerson = new Map(primaries.map((i) => [i.person_id, signed.get(i.file_path) ?? null]))
    return rows.map((r) => ({ ...mapRow(r), primary_image: byPerson.get(r.id) ?? null }))
  },

  // persons:create → runs the shared handler on a trait slice, so the legacy
  // column payload AND any `values` are adopted into trait rows and the node
  // snapshots (name/gender/birth/graph_label) are recomputed — exactly like
  // desktop. The persons_enforce_limit DB trigger raises if the cap is hit.
  'persons:create': (data) => runEngine('persons:create', data, TRAIT_SPECS, { seedFields: true }),

  // persons:update → same slice engine; keeps snapshots consistent with traits.
  // The returned primary_image is a storage path — sign it for display.
  'persons:update': (data) =>
    runEngine('persons:update', data, TRAIT_SPECS, { seedFields: true }).then((r) =>
      signPersonResult(r as Record<string, any>)
    ),

  // persons:delete → DELETE the person; the FK cascades take their
  // relationships and image ROWS (dbCore looped over both tables by hand);
  // the stored photo files are removed from the bucket explicitly first.
  // Faction membership arrays are scrubbed here, mirroring cascadeEntityTags.
  async 'persons:delete'(data) {
    await removeStorageObjects(await imagePathsWhere('person_id', data.id))
    const client = await sb()
    const factions = ok(
      await client
        .from('factions')
        .select('id, member_ids')
        .eq('tree_id', requireActive())
        .contains('member_ids', JSON.stringify([data.id]))
    ) as any[]
    for (const f of factions) {
      ok(
        await client
          .from('factions')
          .update({
            member_ids: (f.member_ids || []).filter((m: string) => m !== data.id),
            updated_at: now()
          })
          .eq('id', f.id)
      )
    }
    ok(await client.from('persons').delete().eq('id', data.id))
    return { id: data.id }
  },

  // ── fields (the trait system) ───────────────────────────────────────────────
  // Every fields:* channel runs its shared handler on the trait slice. seedFields
  // guarantees the tree has its default locked defs first (self-healing older
  // trees). fields:list is the read the store issues on load; the rest mutate.
  'fields:list': (data) => runEngine('fields:list', data, TRAIT_SPECS, { seedFields: true }),
  'fields:createDef': (data) =>
    runEngine('fields:createDef', data, TRAIT_SPECS, { seedFields: true }),
  'fields:updateDef': (data) =>
    runEngine('fields:updateDef', data, TRAIT_SPECS, { seedFields: true }),
  'fields:deleteDef': (data) =>
    runEngine('fields:deleteDef', data, TRAIT_SPECS, { seedFields: true }),
  'fields:reorderDefs': (data) =>
    runEngine('fields:reorderDefs', data, TRAIT_SPECS, { seedFields: true }),
  'fields:setSlot': (data) => runEngine('fields:setSlot', data, TRAIT_SPECS, { seedFields: true }),
  // (the three below return the person snapshot — sign its primary_image)
  'fields:setValue': (data) =>
    runEngine('fields:setValue', data, TRAIT_SPECS, { seedFields: true }).then((r) =>
      signPersonResult(r as Record<string, any>)
    ),
  'fields:setValues': (data) =>
    runEngine('fields:setValues', data, TRAIT_SPECS, { seedFields: true }).then((r) =>
      signPersonResult(r as Record<string, any>)
    ),
  'fields:removeValue': (data) =>
    runEngine('fields:removeValue', data, TRAIT_SPECS, { seedFields: true }).then((r) =>
      signPersonResult(r as Record<string, any>)
    ),
  'fields:applyDisplayAll': (data) =>
    runEngine('fields:applyDisplayAll', data, TRAIT_SPECS, { seedFields: true }),

  // ── relationship types (the registry) ───────────────────────────────────────
  // Same pattern on the rel-type slice. seedRelTypes ensures the built-in defs
  // exist; relTypes:delete cascades its relationships away inside the slice, and
  // the diff removes those relationship rows too.
  'relTypes:getAll': (data) =>
    runEngine('relTypes:getAll', data, RELTYPE_SPECS, { seedRelTypes: true }),
  'relTypes:create': (data) =>
    runEngine('relTypes:create', data, RELTYPE_SPECS, { seedRelTypes: true }),
  'relTypes:update': (data) =>
    runEngine('relTypes:update', data, RELTYPE_SPECS, { seedRelTypes: true }),
  'relTypes:delete': (data) =>
    runEngine('relTypes:delete', data, RELTYPE_SPECS, { seedRelTypes: true }),

  // ── relationships ─────────────────────────────────────────────────────────

  // relationships:getAll → SELECT relationships in the active tree.
  async 'relationships:getAll'() {
    const rows = await listForActive('relationships')
    return rows.map(mapRow)
  },

  // relationships:create → INSERT an edge. dbCore validated data.type against
  // the per-project registry; that check returns with the relTypes:* step.
  async 'relationships:create'(data) {
    const client = await sb()
    const row = ok(
      await client
        .from('relationships')
        .insert({
          tree_id: requireActive(),
          person_a_id: data.person_a_id,
          person_b_id: data.person_b_id,
          type: data.type,
          status: data.status || 'active',
          formed: data.formed ?? null,
          ended: data.ended ?? null,
          label: data.label ?? null
        })
        .select()
        .single()
    )
    return mapRow(row)
  },

  // relationships:update → UPDATE only the fields present in the payload
  // (dbCore's `!== undefined` contract).
  async 'relationships:update'(data) {
    const patch: Record<string, unknown> = {}
    for (const k of ['type', 'status', 'formed', 'ended', 'label', 'person_a_id', 'person_b_id']) {
      if (data[k] !== undefined) patch[k] = data[k]
    }
    const client = await sb()
    const row = ok(
      await client.from('relationships').update(patch).eq('id', data.id).select().single()
    )
    return mapRow(row)
  },

  // relationships:delete → DELETE the edge row.
  async 'relationships:delete'(data) {
    const client = await sb()
    ok(await client.from('relationships').delete().eq('id', data.id))
    return { id: data.id }
  },

  // ── tags (factions) ───────────────────────────────────────────────────────

  // tags:getAll → SELECT factions in the active tree, shaped as Tags.
  async 'tags:getAll'() {
    const rows = await listForActive('factions')
    return rows.map(mapFaction)
  },

  // tags:create → INSERT a faction (empty membership).
  async 'tags:create'(data) {
    const client = await sb()
    const row = ok(
      await client
        .from('factions')
        .insert({
          tree_id: requireActive(),
          label: data?.label || 'New Tag',
          type: data?.type || '',
          color: data?.color || '#6c8ef5',
          icon: data?.icon || '',
          member_ids: []
        })
        .select()
        .single()
    )
    return mapFaction(row)
  },

  // tags:update → UPDATE label/type/color/icon when present.
  async 'tags:update'(data) {
    const patch: Record<string, unknown> = { updated_at: now() }
    for (const k of ['label', 'type', 'color', 'icon']) {
      if (data[k] !== undefined) patch[k] = data[k]
    }
    const client = await sb()
    const row = ok(await client.from('factions').update(patch).eq('id', data.id).select().single())
    return mapFaction(row)
  },

  // tags:delete → DELETE the faction (membership goes with the row) and scrub
  // its placements out of every scenario (dbCore's cascadeSceneTags).
  async 'tags:delete'(data) {
    const client = await sb()
    const scenarios = ok(
      await client.from('scenarios').select('id, scene_tags').eq('tree_id', requireActive())
    ) as any[]
    for (const s of scenarios) {
      const rows = (s.scene_tags || []) as any[]
      const kept = rows.filter((st) => st.tag_id !== data.id)
      if (kept.length !== rows.length) {
        ok(await client.from('scenarios').update({ scene_tags: kept }).eq('id', s.id))
      }
    }
    ok(await client.from('factions').delete().eq('id', data.id))
    return { id: data.id }
  },

  // ── entity_tags (tag membership) ──────────────────────────────────────────
  // Stored as factions.member_ids (a person-id array) rather than join rows;
  // these handlers synthesize the row shape dbCore returned, with a stable
  // derived id of `${tag_id}:${entity_id}`.

  // entity_tags:getAll → flatten every faction's member list into join rows.
  async 'entity_tags:getAll'() {
    const rows = await listForActive('factions')
    return rows.flatMap((f: any) =>
      ((f.member_ids || []) as string[]).map((eid) => ({
        id: `${f.id}:${eid}`,
        entity_id: eid,
        tag_id: f.id,
        created_at: f.updated_at
      }))
    )
  },

  // entity_tags:add → append to member_ids (idempotent, like dbCore).
  async 'entity_tags:add'(data) {
    const { entity_id, tag_id } = data
    const client = await sb()
    const f = ok(
      await client.from('factions').select('id, member_ids, updated_at').eq('id', tag_id).single()
    ) as any
    const members = (f.member_ids || []) as string[]
    if (!members.includes(entity_id)) {
      ok(
        await client
          .from('factions')
          .update({ member_ids: [...members, entity_id], updated_at: now() })
          .eq('id', tag_id)
      )
    }
    return { id: `${tag_id}:${entity_id}`, entity_id, tag_id, created_at: now() }
  },

  // entity_tags:remove → drop from member_ids.
  async 'entity_tags:remove'(data) {
    const { entity_id, tag_id } = data
    const client = await sb()
    const f = ok(
      await client.from('factions').select('id, member_ids').eq('id', tag_id).single()
    ) as any
    const members = (f.member_ids || []) as string[]
    if (members.includes(entity_id)) {
      ok(
        await client
          .from('factions')
          .update({ member_ids: members.filter((m) => m !== entity_id), updated_at: now() })
          .eq('id', tag_id)
      )
    }
    return { entity_id, tag_id, removed: [`${tag_id}:${entity_id}`] }
  },

  // ── scenes (scenarios) ────────────────────────────────────────────────────

  // scenes:getAll → SELECT scenarios in the active tree (optional view filter).
  async 'scenes:getAll'(data) {
    const client = await sb()
    let q = client
      .from('scenarios')
      .select('*')
      .eq('tree_id', requireActive())
      .order('created_at', { ascending: true })
    if (data?.view) q = q.eq('view', data.view)
    return (ok(await q) as any[]).map(mapScenario)
  },

  // scenes:create → INSERT a scenario (graph scenes start their layouts map).
  async 'scenes:create'(data) {
    const view = data?.view || 'groups'
    const client = await sb()
    const row = ok(
      await client
        .from('scenarios')
        .insert({
          tree_id: requireActive(),
          view,
          name: data?.name || 'New Scene',
          type: data?.type ?? null,
          config: data?.config || {},
          positions: data?.positions || {},
          layouts: data?.layouts ?? (view === 'graph' ? {} : null),
          scene_tags: []
        })
        .select()
        .single()
    )
    return mapScenario(row)
  },

  // scenes:rename → UPDATE scenarios.name.
  async 'scenes:rename'(data) {
    const client = await sb()
    const row = ok(
      await client
        .from('scenarios')
        .update({ name: data.name, updated_at: now() })
        .eq('id', data.id)
        .select()
        .single()
    )
    return mapScenario(row)
  },

  // scenes:duplicate → copy the scenario row plus its tag placements (fresh
  // ids), exactly like dbCore's deep copy. Membership stays on the factions.
  async 'scenes:duplicate'(data) {
    const client = await sb()
    const src = ok(await client.from('scenarios').select('*').eq('id', data.id).single()) as any
    const ts = now()
    const clonedPlacements = ((src.scene_tags || []) as any[]).map((st) => ({
      ...st,
      id: uuid(),
      created_at: ts,
      updated_at: ts
    }))
    const row = ok(
      await client
        .from('scenarios')
        .insert({
          tree_id: src.tree_id,
          view: src.view,
          name: data?.name || `${src.name} copy`,
          type: src.type,
          config: src.config || {},
          positions: src.positions || {},
          layouts: src.layouts,
          scene_tags: clonedPlacements
        })
        .select()
        .single()
    ) as any
    // Placement rows carry their scene's id — restamp onto the new scene.
    const placed = clonedPlacements.map((st) => ({ ...st, scene_id: row.id }))
    if (placed.length) {
      ok(await client.from('scenarios').update({ scene_tags: placed }).eq('id', row.id))
    }
    return { scene: mapScenario(row), scene_tags: placed }
  },

  // scenes:save → UPDATE whichever of name/type/config/positions/layouts the
  // payload carries (the autosave path for arrangements).
  async 'scenes:save'(data) {
    const patch: Record<string, unknown> = { updated_at: now() }
    for (const k of ['name', 'type', 'config', 'positions', 'layouts']) {
      if (data[k] !== undefined) patch[k] = data[k]
    }
    const client = await sb()
    const row = ok(await client.from('scenarios').update(patch).eq('id', data.id).select().single())
    return mapScenario(row)
  },

  // scenes:delete → DELETE the scenario (placements live inside the row).
  async 'scenes:delete'(data) {
    const client = await sb()
    ok(await client.from('scenarios').delete().eq('id', data.id))
    return { id: data.id }
  },

  // ── scene_tags (tag placements in a groups scene) ─────────────────────────
  // Stored inline as scenarios.scene_tags (a jsonb array of placement rows) —
  // see schema.sql. Each handler rewrites its scene's array.

  // scene_tags:getAll → flatten every scenario's placement array.
  async 'scene_tags:getAll'() {
    const client = await sb()
    const rows = ok(
      await client.from('scenarios').select('scene_tags').eq('tree_id', requireActive())
    ) as any[]
    return rows.flatMap((s) => (s.scene_tags || []) as any[])
  },

  // scene_tags:add → append a placement (idempotent per scene+tag pair).
  async 'scene_tags:add'(data) {
    const { scene_id, tag_id } = data
    const client = await sb()
    const s = ok(
      await client.from('scenarios').select('id, scene_tags').eq('id', scene_id).single()
    ) as any
    const rows = (s.scene_tags || []) as any[]
    const existing = rows.find((st) => st.tag_id === tag_id)
    if (existing) return existing
    const ts = now()
    const row = {
      id: uuid(),
      scene_id,
      tag_id,
      x: data.x ?? 0,
      y: data.y ?? 0,
      visible: data.visible !== false,
      created_at: ts,
      updated_at: ts
    }
    ok(
      await client
        .from('scenarios')
        .update({ scene_tags: [...rows, row] })
        .eq('id', scene_id)
    )
    return row
  },

  // scene_tags:move → rewrite the placement's x/y inside its scene's array.
  async 'scene_tags:move'(data) {
    return updatePlacement(data.id, (row) => {
      if (data.x !== undefined) row.x = data.x
      if (data.y !== undefined) row.y = data.y
    })
  },

  // scene_tags:setVisible → toggle the placement's visibility flag.
  async 'scene_tags:setVisible'(data) {
    return updatePlacement(data.id, (row) => {
      row.visible = !!data.visible
    })
  },

  // scene_tags:remove → drop the placement from its scene's array.
  async 'scene_tags:remove'(data) {
    const client = await sb()
    const scenarios = ok(
      await client.from('scenarios').select('id, scene_tags').eq('tree_id', requireActive())
    ) as any[]
    for (const s of scenarios) {
      const rows = (s.scene_tags || []) as any[]
      if (!rows.some((st) => st.id === data.id)) continue
      ok(
        await client
          .from('scenarios')
          .update({ scene_tags: rows.filter((st) => st.id !== data.id) })
          .eq('id', s.id)
      )
      break
    }
    return { id: data.id }
  },

  // ── images (photos in Supabase Storage + rows in the images table) ─────────

  // images:openDialog → the same <input type="file"> picker the browser-local
  // backend uses; resolves to a data: URL (or null on cancel).
  'images:openDialog': () => pickImageAsDataUrl(),

  // images:bytes → fetch the (signed) URL and hand back raw bytes — feeds the
  // renderer-side createImageBitmap thumbnailing (which stays as-is on the web).
  async 'images:bytes'(data) {
    const filePath = data?.filePath
    if (!filePath) throw new Error('missing')
    const res = await fetch(filePath)
    return new Uint8Array(await res.arrayBuffer())
  },

  // images:getByPerson → SELECT the person's rows (primary first, like dbCore),
  // with file_path swapped for a signed URL.
  async 'images:getByPerson'(data) {
    const client = await sb()
    const rows = ok(
      await client
        .from('images')
        .select('*')
        .eq('person_id', data.personId)
        .order('created_at', { ascending: true })
    ) as any[]
    rows.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
    return (await signImageRows(rows)).map(mapRow)
  },

  // images:add → compress the picked data URL (≤512px WebP), upload it to the
  // Storage bucket at <treeId>/<uuid>.<ext>, then INSERT the row. Mirrors
  // dbCore: isPrimary demotes the person's other photos; a named role evicts
  // its previous occupant. The images_enforce_limit DB trigger owns the quota.
  async 'images:add'(data) {
    const treeId = requireActive()
    const { personId, srcPath, isPrimary } = data
    if (!srcPath?.startsWith('data:')) throw new Error('Expected a picked image (data URL)')
    const client = await sb()

    const { blob, ext } = await compressForUpload(srcPath)
    const path = `${treeId}/${uuid()}.${ext}`
    ok(await client.storage.from(BUCKET).upload(path, blob, { contentType: blob.type }))

    if (isPrimary) {
      ok(await client.from('images').update({ is_primary: false }).eq('person_id', personId))
    }
    const role = ['portrait', 'fullbody', 'background'].includes(data.role) ? data.role : ''
    if (role) {
      // One image per named slot — the previous occupant becomes an extra.
      ok(
        await client.from('images').update({ role: '' }).eq('person_id', personId).eq('role', role)
      )
    }
    const row = ok(
      await client
        .from('images')
        .insert({
          tree_id: treeId,
          person_id: personId,
          file_path: path,
          is_primary: !!isPrimary,
          role,
          source: data.source || ''
        })
        .select()
        .single()
    )
    return mapRow((await signImageRows([row]))[0])
  },

  // images:setRole → assign a named slot ('' clears); evicts the previous
  // occupant of that slot, like dbCore.
  async 'images:setRole'(data) {
    const { imageId, personId } = data
    const role = ['portrait', 'fullbody', 'background', ''].includes(data.role) ? data.role : ''
    const client = await sb()
    if (role) {
      ok(
        await client.from('images').update({ role: '' }).eq('person_id', personId).eq('role', role)
      )
    }
    const row = ok(await client.from('images').update({ role }).eq('id', imageId).select().single())
    return mapRow((await signImageRows([row]))[0])
  },

  // images:setPrimary → demote the person's photos, promote this one.
  async 'images:setPrimary'(data) {
    const { imageId, personId } = data
    const client = await sb()
    ok(await client.from('images').update({ is_primary: false }).eq('person_id', personId))
    ok(await client.from('images').update({ is_primary: true }).eq('id', imageId))
    return { imageId }
  },

  // images:delete → remove the stored file, then the row (dbCore's
  // env.removeImageFile + delete, in the same order).
  async 'images:delete'(data) {
    const client = await sb()
    const rows = ok(await client.from('images').select('file_path').eq('id', data.imageId)) as any[]
    if (rows.length) {
      await removeStorageObjects([rows[0].file_path])
      ok(await client.from('images').delete().eq('id', data.imageId))
    }
    return { imageId: data.imageId }
  },

  // ── settings ──────────────────────────────────────────────────────────────

  // settings:getAll → SELECT the active tree's key/value rows as one object
  // (dbCore stored them as `${projectId}:key` — the table is keyed properly).
  async 'settings:getAll'() {
    const client = await sb()
    const rows = ok(
      await client.from('settings').select('key, value').eq('tree_id', requireActive())
    ) as any[]
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  },

  // settings:set → UPSERT one (tree, key) row.
  async 'settings:set'(data) {
    const client = await sb()
    ok(
      await client
        .from('settings')
        .upsert(
          { tree_id: requireActive(), key: data.key, value: data.value, updated_at: now() },
          { onConflict: 'tree_id,key' }
        )
    )
    return { key: data.key, value: data.value }
  },

  // ── global settings ───────────────────────────────────────────────────────
  // Device-level preferences (theme, …) — not tree data, so they stay in
  // localStorage instead of Postgres, same as the active-tree selection.
  async 'globalSettings:getAll'() {
    try {
      return JSON.parse(localStorage.getItem('familytree.globalSettings') || '{}')
    } catch {
      return {}
    }
  },

  async 'globalSettings:set'(data) {
    const all = (await handlers['globalSettings:getAll']({})) as Record<string, unknown>
    all[data.key] = data.value
    localStorage.setItem('familytree.globalSettings', JSON.stringify(all))
    return { key: data.key, value: data.value }
  }
}

/** Find the scenario holding placement `id`, apply `mutate`, write it back. */
async function updatePlacement(id: string, mutate: (row: any) => void): Promise<any> {
  const client = await sb()
  const scenarios = ok(
    await client.from('scenarios').select('id, scene_tags').eq('tree_id', requireActive())
  ) as any[]
  for (const s of scenarios) {
    const rows = (s.scene_tags || []) as any[]
    const row = rows.find((st) => st.id === id)
    if (!row) continue
    mutate(row)
    row.updated_at = now()
    ok(await client.from('scenarios').update({ scene_tags: rows }).eq('id', s.id))
    return row
  }
  throw new Error('Placement not found')
}

// ── The backend ──────────────────────────────────────────────────────────────
export const supabaseBackend: ApiBackend = {
  async invoke(channel, raw) {
    try {
      // Strip the request envelope; the session token inside it is the local
      // backends' auth. Here Supabase's own session (supabase.auth) will take
      // that role when the auth:* step lands.
      const { data } = unwrapRequest(raw)
      const handler = handlers[channel]
      if (!handler) {
        return {
          success: false,
          error: `Supabase backend: '${channel}' is not implemented yet (images/auth/fields/relTypes come in later steps)`
        }
      }
      return { success: true, data: await handler(data) }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  },
  // Rows already carry signed Storage URLs (signed at read time, since this
  // must stay synchronous) — so this is a passthrough, like the local backend.
  getImageUrl: (ref) => ref || null
}
