# IPC API reference

All communication between the renderer and main process goes through named IPC
channels. The channel *logic* lives in the shared data core
([`src/shared/dbCore.ts`](../src/shared/dbCore.ts) — `channelHandlers`);
[`src/main/ipc.js`](../src/main/ipc.js) registers each one with `ipcMain` and adds the
few platform-bound channels (file dialog, file bytes). The renderer calls them via the
store, which uses the [`api`](../src/renderer/src/api/index.ts) seam over the preload
bridge. (On the web build the same channels run in-page against IndexedDB via
[`api/backends/local.ts`](../src/renderer/src/api/backends/local.ts) — same names,
same envelopes.)

## Calling convention

```js
import { api } from './api'
const res = await api.invoke('persons:getAll')
if (res.success) { /* use res.data */ }
```

Every handler returns a uniform envelope:

```jsonc
{ "success": true,  "data": <payload> }       // ok
{ "success": false, "error": "<message>" }    // failure
```

Handlers wrap their body in `try/catch` and never throw across the process boundary.
Callers must check `success` before reading `data`. All write handlers call
`save()` before returning, so a successful response means the change is on disk.

## Preload bridge

Exposed on `window.electronAPI` by [`src/preload/index.js`](../src/preload/index.js):

| Method | Description |
|--------|-------------|
| `invoke(channel, data)` | Forwards to `ipcRenderer.invoke`. |
| `getImageUrl(filePath)` | Converts an absolute image path to an `appimg://` URL (each path segment is URL-encoded). Returns `null` for a falsy path. |

## Channels

Most write channels operate on the **active project** implicitly — new records are
tagged with the current `activeProjectId`, and `getAll` handlers filter by it.

### Projects

| Channel | Payload | Returns |
|---------|---------|---------|
| `projects:getAll` | — | `{ projects: Project[], activeProjectId }` |
| `projects:create` | `{ name? }` | the new `Project` |
| `projects:rename` | `{ id, name }` | the updated `Project` |
| `projects:delete` | `{ id }` | `{ id, newActiveProjectId }` — cascades persons, relationships, tags (+joins +placements), scenes (+placements), images (files unlinked) and project-scoped settings; switches active project if needed |
| `projects:setActive` | `{ id }` | `{ activeProjectId }` |

### Persons

| Channel | Payload | Returns |
|---------|---------|---------|
| `persons:getAll` | — | `Person[]`, each enriched with `primary_image` |
| `persons:create` | person fields (`birth`/`death` are DateValues) | the new `Person` (`primary_image: null`) |
| `persons:update` | `{ id, ...fields }` | the updated `Person` |
| `persons:delete` | `{ id }` | `{ id }` — cascades the person's relationships, images and `entity_tags` rows |

### Relationships

| Channel | Payload | Returns |
|---------|---------|---------|
| `relationships:getAll` | — | `Relationship[]` (active project) |
| `relationships:create` | `{ person_a_id, person_b_id, type, status?, formed? }` | the new `Relationship` |
| `relationships:update` | `{ id, ...partial }` | the updated `Relationship` (only provided fields change) |
| `relationships:delete` | `{ id }` | `{ id }` |

### Tags

| Channel | Payload | Returns |
|---------|---------|---------|
| `tags:getAll` | — | `Tag[]` (active project) |
| `tags:create` | `{ label?, type?, source?, color?, icon? }` | the new `Tag` (defaults filled in) |
| `tags:update` | `{ id, ...partial }` | the updated `Tag` |
| `tags:delete` | `{ id }` | `{ id }` — cascades the tag's `entity_tags` and `scene_tags` rows; people are untouched |

### Entity tags (membership join)

| Channel | Payload | Returns |
|---------|---------|---------|
| `entity_tags:getAll` | — | `EntityTag[]` (rows whose tag belongs to the active project) |
| `entity_tags:add` | `{ entity_id, tag_id }` | the join row — idempotent: re-adding an existing pair returns the existing row |
| `entity_tags:remove` | `{ entity_id, tag_id }` | `{ entity_id, tag_id, removed }` |

### Scenes

| Channel | Payload | Returns |
|---------|---------|---------|
| `scenes:getAll` | `{ view? }` | `Scene[]` (active project, optionally one view's) |
| `scenes:create` | `{ view?, name?, type?, config?, positions? }` | the new `Scene` |
| `scenes:rename` | `{ id, name }` | the updated `Scene` |
| `scenes:duplicate` | `{ id, name? }` | `{ scene, scene_tags }` — deep-copies config/positions and the scene's tag placements (membership is shared, never copied) |
| `scenes:save` | `{ id, type?, name?, config?, positions? }` | the updated `Scene` — how layout autosave persists arrangements |
| `scenes:delete` | `{ id }` | `{ id }` — cascades the scene's `scene_tags` rows |

### Scene tags (Groups placements)

| Channel | Payload | Returns |
|---------|---------|---------|
| `scene_tags:getAll` | — | `SceneTag[]` (rows whose scene belongs to the active project) |
| `scene_tags:add` | `{ scene_id, tag_id, x?, y?, visible? }` | the placement — idempotent per `(scene, tag)` pair |
| `scene_tags:move` | `{ id, x, y }` | the updated placement |
| `scene_tags:setVisible` | `{ id, visible }` | the updated placement |
| `scene_tags:remove` | `{ id }` | `{ id }` |

### Checkpoint (save model)

| Channel | Payload | Returns |
|---------|---------|---------|
| `checkpoint:save` | — | the checkpoint — snapshots the project's arrangement state (scenes + placements + Present override) into the `checkpoint` setting |
| `checkpoint:revert` | — | the restored checkpoint — wholesale-replaces the project's scenes and placements with it (original ids); throws if none was ever saved |

### Images

| Channel | Payload | Returns |
|---------|---------|---------|
| `images:getByPerson` | `{ personId }` | `Image[]`, primary first |
| `images:openDialog` | — | selected absolute file path, or `null` if cancelled |
| `images:add` | `{ personId, srcPath, isPrimary }` | the new `Image` — copies the file into `userData/images/` |
| `images:setPrimary` | `{ imageId, personId }` | `{ imageId }` |
| `images:delete` | `{ imageId }` | `{ imageId }` — unlinks the file |

### Settings (per-project)

| Channel | Payload | Returns |
|---------|---------|---------|
| `settings:getAll` | — | flat map of the active project's settings (prefix stripped) |
| `settings:set` | `{ key, value }` | `{ key, value }` — stored under `"<activeProjectId>:<key>"` |

### Global settings

| Channel | Payload | Returns |
|---------|---------|---------|
| `globalSettings:getAll` | — | the global settings map (e.g. `{ theme, programMode }`) |
| `globalSettings:set` | `{ key, value }` | `{ key, value }` |

## The `appimg://` protocol

Registered as a privileged scheme in [`index.js`](../src/main/index.js) and handled
at app-ready. It maps an `appimg://` URL back to an absolute filesystem path and
streams the file via `net.fetch('file:///…')`. This lets locally-stored photos
render in the renderer without enabling `file://` access or loosening the CSP. Build
these URLs with `electronAPI.getImageUrl(path)` — never hand-construct them.

## Adding a new channel

1. Add a handler to `channelHandlers` in
   [`src/shared/dbCore.ts`](../src/shared/dbCore.ts) (and the channel to
   `WRITE_CHANNELS` if it mutates) — both shells register it automatically and
   persist after writes.
2. Add a store action in [`store/index.js`](../src/renderer/src/store/index.js) that
   calls `api.invoke(...)` and updates reactive state on success.
3. Call the store action from components — never `api.invoke` directly from a view.

See [conventions.md](./conventions.md) for the rationale behind these layers.
