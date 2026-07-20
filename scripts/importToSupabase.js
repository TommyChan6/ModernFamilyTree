// ============================================================================
// importToSupabase.js — one-time desktop → cloud importer (deployment plan 3.1)
// ============================================================================
//
// Reads a desktop familytree.json, runs the SAME migrations the app runs on
// load (imported from src/shared/dbCore.ts — this is also why the script runs
// through `tsx`), then inserts every project/person/relationship/tag/scene/
// image/setting into Supabase as the given user's trees. Photos are uploaded
// to the private `images` Storage bucket.
//
// Usage (PowerShell):
//   $env:SUPABASE_SERVICE_KEY = "<service_role key>"
//   npx tsx scripts/importToSupabase.js "$env:APPDATA\family-tree\db\familytree.json" --user <auth-user-uuid>
//
// Flags:
//   --user <uuid>   REQUIRED. The Supabase auth user who will own the trees
//                   (dashboard → Authentication → Users → copy the UUID).
//   --dry-run       Parse + migrate + count everything, but touch no network.
//
// Env:
//   SUPABASE_SERVICE_KEY  REQUIRED (unless --dry-run). The service_role key —
//                         a SECRET; env var only, never written to any file.
//   VITE_SUPABASE_URL     Optional — read from .env automatically if unset.
//
// Notes:
//   • Close the desktop app first if you plan to keep using this file — the
//     app rewrites it on save/close. (Reading while open is harmless.)
//   • Re-running is safe: rows upsert by their original ids (photos are
//     re-uploaded under fresh names; previous uploads become unused).
//   • The DB plan-limit triggers apply to imports too (free: 10 trees /
//     2500 people / 300 photos per user) — a huge file can hit them.
//   • CharacterDocs are skipped (no characters table yet) and reported.
// ============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID, webcrypto } from 'node:crypto'

// Node 18 doesn't expose WebCrypto globally; the shared auth module expects it.
if (!globalThis.crypto) globalThis.crypto = webcrypto

const {
  EMPTY_DB,
  nowStr,
  migrateTreesToProjects,
  migrateYearsToDateValues,
  migrateScenariosToScenes,
  migrateFactionsToTags,
  migrateGraphStateToScenes,
  migrateSceneLayouts,
  migrateFieldSystem,
  migrateRelationshipTypes
} = await import('../src/shared/dbCore.ts')

// ── CLI ───────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const userFlag = args.indexOf('--user')
const ownerId = userFlag >= 0 ? args[userFlag + 1] : null
const filePath = args.find((a) => !a.startsWith('--') && a !== ownerId)

function die(msg) {
  console.error(`\n✖ ${msg}\n`)
  process.exit(1)
}

if (!filePath)
  die('Usage: npx tsx scripts/importToSupabase.js <familytree.json> --user <uuid> [--dry-run]')
if (!fs.existsSync(filePath)) die(`File not found: ${filePath}`)
if (!ownerId && !dryRun)
  die('Missing --user <auth-user-uuid> (Supabase dashboard → Authentication → Users)')

// ── Load + migrate (the exact pipeline the app runs on startup) ──────────────
const env = { uuid: randomUUID, nowStr, storeImageFile: (p) => p, removeImageFile: () => {} }
const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
const db = { ...EMPTY_DB(), ...raw }

migrateTreesToProjects(db)
migrateYearsToDateValues(db)
migrateScenariosToScenes(db)
migrateFactionsToTags(db, env)
migrateGraphStateToScenes(db, env)
migrateSceneLayouts(db)
migrateFieldSystem(db, env)
migrateRelationshipTypes(db, env)

const projects = Object.values(db.projects)
if (projects.length === 0) {
  die(
    'This file has no projects — it predates the multi-project format. Open it once in the desktop app (which migrates it), close the app, and re-run.'
  )
}

// ── Map the JSON shapes onto the Postgres tables ──────────────────────────────
// Original UUIDs are kept everywhere (a project's id becomes its tree's id),
// so every cross-reference survives verbatim and re-runs upsert cleanly.
const val = (o) => Object.values(o || {})
const projectIds = new Set(projects.map((p) => p.id))
const skipped = []

const trees = projects.map((p) => ({
  id: p.id,
  owner_id: ownerId,
  name: p.name || 'Untitled',
  created_at: p.created_at,
  updated_at: p.updated_at
}))

const persons = val(db.persons)
  .filter((p) => projectIds.has(p.project_id))
  .map((p) => ({
    id: p.id,
    tree_id: p.project_id,
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
  }))
const personTree = new Map(persons.map((p) => [p.id, p.tree_id]))

const relationships = val(db.relationships)
  .filter((r) => projectIds.has(r.project_id))
  .map((r) => ({
    id: r.id,
    tree_id: r.project_id,
    person_a_id: r.person_a_id,
    person_b_id: r.person_b_id,
    type: r.type,
    status: r.status ?? '',
    formed: r.formed ?? null,
    ended: r.ended ?? null,
    label: r.label ?? null,
    created_at: r.created_at
  }))

// Registries store the whole entity as `doc` (matching the app's backend).
const fieldDefs = val(db.field_defs)
  .filter((d) => projectIds.has(d.project_id))
  .map((d) => ({ id: d.id, tree_id: d.project_id, doc: d, created_at: d.created_at }))

const fieldValues = val(db.field_values)
  .filter((v) => personTree.has(v.person_id))
  .map((v) => ({
    id: v.id,
    tree_id: personTree.get(v.person_id),
    person_id: v.person_id,
    doc: v,
    created_at: v.created_at
  }))

const relTypeDefs = val(db.rel_type_defs)
  .filter((d) => projectIds.has(d.project_id))
  .map((d) => ({ id: d.id, tree_id: d.project_id, key: d.key, doc: d, created_at: d.created_at }))

// Tags + entity_tags → factions with an inline member_ids array.
const membersByTag = new Map()
for (const row of val(db.entity_tags)) {
  if (!membersByTag.has(row.tag_id)) membersByTag.set(row.tag_id, [])
  if (personTree.has(row.entity_id)) membersByTag.get(row.tag_id).push(row.entity_id)
}
const factions = val(db.tags)
  .filter((t) => projectIds.has(t.project_id))
  .map((t) => ({
    id: t.id,
    tree_id: t.project_id,
    label: t.label ?? '',
    type: t.type ?? '',
    color: t.color ?? '',
    icon: t.icon ?? '',
    member_ids: membersByTag.get(t.id) || [],
    created_at: t.created_at,
    updated_at: t.updated_at
  }))

// Scenes + scene_tags → scenarios with inline placement rows.
const placementsByScene = new Map()
for (const st of val(db.scene_tags)) {
  if (!placementsByScene.has(st.scene_id)) placementsByScene.set(st.scene_id, [])
  placementsByScene.get(st.scene_id).push(st)
}
const scenarios = val(db.scenes)
  .filter((s) => projectIds.has(s.project_id))
  .map((s) => ({
    id: s.id,
    tree_id: s.project_id,
    view: s.view || 'groups',
    name: s.name ?? '',
    type: s.type ?? null,
    config: s.config || {},
    positions: s.positions || {},
    layouts: s.layouts ?? null,
    scene_tags: placementsByScene.get(s.id) || [],
    created_at: s.created_at,
    updated_at: s.updated_at
  }))

// Settings: `${projectId}:key` → one (tree_id, key, value) row.
const settings = []
for (const [k, value] of Object.entries(db.settings || {})) {
  const sep = k.indexOf(':')
  if (sep < 0) continue
  const treeId = k.slice(0, sep)
  if (projectIds.has(treeId)) settings.push({ tree_id: treeId, key: k.slice(sep + 1), value })
}

// Images: rows now; the files upload during the network phase. Desktop paths
// that no longer exist are skipped (reported), data: URLs decode directly.
const CONTENT_TYPES = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif'
}
const images = []
for (const img of val(db.images)) {
  if (!projectIds.has(img.project_id) || !personTree.has(img.person_id)) continue
  const src = img.file_path || ''
  const ext = (
    src.startsWith('data:') ? src.slice(11, src.indexOf(';')) : path.extname(src).slice(1)
  ).toLowerCase()
  if (!src.startsWith('data:') && !fs.existsSync(src)) {
    skipped.push(`image ${img.id} — file missing: ${src}`)
    continue
  }
  images.push({
    row: {
      id: img.id,
      tree_id: img.project_id,
      person_id: img.person_id,
      file_path: `${img.project_id}/${randomUUID()}.${ext || 'bin'}`,
      is_primary: !!img.is_primary,
      role: img.role || '',
      source: img.source || '',
      created_at: img.created_at
    },
    src,
    contentType: CONTENT_TYPES[ext] || 'application/octet-stream'
  })
}

const characterCount = val(db.characters).length
if (characterCount)
  skipped.push(`${characterCount} CharacterDoc(s) — no characters table in the cloud schema yet`)

// ── Summary of what will happen ───────────────────────────────────────────────
const plan = [
  ['trees', trees.length],
  ['persons', persons.length],
  ['relationships', relationships.length],
  ['field_defs', fieldDefs.length],
  ['field_values', fieldValues.length],
  ['rel_type_defs', relTypeDefs.length],
  ['factions', factions.length],
  ['scenarios', scenarios.length],
  ['settings', settings.length],
  ['images (+ file uploads)', images.length]
]
console.log(`\nImport plan for ${filePath}:`)
for (const [label, n] of plan) console.log(`  ${String(n).padStart(5)}  ${label}`)
for (const s of skipped) console.log(`  skip:  ${s}`)

if (dryRun) {
  console.log('\n--dry-run: no network calls made. Remove the flag to import.\n')
  process.exit(0)
}

// ── Connect (service_role bypasses RLS; plan-limit triggers still apply) ─────
function readEnvFile(key) {
  try {
    const envFile = fs.readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env'),
      'utf8'
    )
    const m = envFile.match(new RegExp(`^${key}=(.+)$`, 'm'))
    return m ? m[1].trim() : null
  } catch {
    return null
  }
}

const url = process.env.VITE_SUPABASE_URL || readEnvFile('VITE_SUPABASE_URL')
const serviceKey = process.env.SUPABASE_SERVICE_KEY
if (!url) die('No Supabase URL: set VITE_SUPABASE_URL (or keep it in .env)')
if (!serviceKey)
  die(
    'Set the SUPABASE_SERVICE_KEY env var (dashboard → Project Settings → API → service_role). Never commit or paste it into a file.'
  )

const { createClient } = await import('@supabase/supabase-js')

// supabase-js constructs its realtime client eagerly, and on Node < 22 that
// throws ("native WebSocket not found"). This script never opens a realtime
// channel, so hand it an inert transport instead of requiring Node 22 or a
// ws dependency. persistSession off: server scripts have no session storage.
class NoRealtimeTransport {
  close() {}
}
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
  realtime: { transport: NoRealtimeTransport }
})

// The owner must exist, or every FK below fails with a confusing error.
{
  const { data, error } = await supabase.auth.admin.getUserById(ownerId)
  if (error || !data?.user)
    die(`No auth user with id ${ownerId} — copy the UUID from Authentication → Users`)
  console.log(`\nImporting as ${data.user.email || data.user.id}…`)
}

async function upsert(table, rows, conflict = 'id') {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: conflict })
    if (error) die(`${table}: ${error.message}`)
  }
  if (rows.length) console.log(`  ✓ ${table}: ${rows.length}`)
}

// Parents before children (FK order).
await upsert('trees', trees)
await upsert('persons', persons)
await upsert('relationships', relationships)
await upsert('field_defs', fieldDefs)
await upsert('field_values', fieldValues)
await upsert('rel_type_defs', relTypeDefs)
await upsert('factions', factions)
await upsert('scenarios', scenarios)
await upsert('settings', settings, 'tree_id,key')

// Photos: upload each file, then insert its row.
let uploaded = 0
for (const { row, src, contentType } of images) {
  const bytes = src.startsWith('data:')
    ? Buffer.from(src.slice(src.indexOf(',') + 1), 'base64')
    : fs.readFileSync(src)
  const up = await supabase.storage.from('images').upload(row.file_path, bytes, { contentType })
  if (up.error) {
    skipped.push(`image ${row.id} — upload failed: ${up.error.message}`)
    continue
  }
  const ins = await supabase.from('images').upsert([row])
  if (ins.error) die(`images: ${ins.error.message}`)
  uploaded++
  if (uploaded % 25 === 0) console.log(`  … photos ${uploaded}/${images.length}`)
}
console.log(`  ✓ images: ${uploaded} rows + files`)

console.log('\nDone.')
for (const s of skipped) console.log(`  skipped: ${s}`)
console.log('\nOpen the web app and sign in as that user — the trees are there.\n')
