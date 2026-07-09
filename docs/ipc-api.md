# IPC API reference

All communication between the renderer and main process goes through named IPC
channels registered in [`src/main/ipc.js`](../src/main/ipc.js). The renderer calls
them via the store, which uses the [`api`](../src/renderer/src/api.js) wrapper over
the preload bridge.

## Calling convention

```js
import { api } from './api.js'
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

Most write channels operate on the **active tree** implicitly — new records are
tagged with the current `activeTreeId`, and `getAll` handlers filter by it.

### Trees

| Channel | Payload | Returns |
|---------|---------|---------|
| `trees:getAll` | — | `{ trees: Tree[], activeTreeId }` |
| `trees:create` | `{ name? }` | the new `Tree` |
| `trees:rename` | `{ id, name }` | the updated `Tree` |
| `trees:delete` | `{ id }` | `{ id, newActiveTreeId }` — cascades persons, relationships, factions, scenarios, images (files unlinked) and tree-scoped settings; switches active tree if needed |
| `trees:setActive` | `{ id }` | `{ activeTreeId }` |

### Persons

| Channel | Payload | Returns |
|---------|---------|---------|
| `persons:getAll` | — | `Person[]`, each enriched with `primary_image` |
| `persons:create` | person fields | the new `Person` (`primary_image: null`) |
| `persons:update` | `{ id, ...fields }` | the updated `Person` |
| `persons:delete` | `{ id }` | `{ id }` — cascades the person's relationships and images, and removes them from all faction member lists |

### Relationships

| Channel | Payload | Returns |
|---------|---------|---------|
| `relationships:getAll` | — | `Relationship[]` (active tree) |
| `relationships:create` | `{ person_a_id, person_b_id, type, status?, formed_date? }` | the new `Relationship` |
| `relationships:update` | `{ id, ...partial }` | the updated `Relationship` (only provided fields change) |
| `relationships:delete` | `{ id }` | `{ id }` |

### Factions

| Channel | Payload | Returns |
|---------|---------|---------|
| `factions:getAll` | — | `Faction[]` (active tree, all scenarios — the renderer filters by active scenario) |
| `factions:create` | `{ scenario_id, name?, description?, color?, icon?, member_ids?, x?, y?, visible? }` | the new `Faction` (defaults filled in) |
| `factions:update` | `{ id, ...partial }` | the updated `Faction` (only provided fields change) |
| `factions:delete` | `{ id }` | `{ id }` — members are untouched |

### Scenarios

| Channel | Payload | Returns |
|---------|---------|---------|
| `scenarios:getAll` | — | `Scenario[]` (active tree) |
| `scenarios:create` | `{ name?, clone_from? }` | `{ scenario, factions }` — with `clone_from`, the source scenario's factions are duplicated into the new one and returned |
| `scenarios:rename` | `{ id, name }` | the updated `Scenario` |
| `scenarios:delete` | `{ id }` | `{ id }` — cascades the scenario's factions; people are untouched |

### Images

| Channel | Payload | Returns |
|---------|---------|---------|
| `images:getByPerson` | `{ personId }` | `Image[]`, primary first |
| `images:openDialog` | — | selected absolute file path, or `null` if cancelled |
| `images:add` | `{ personId, srcPath, isPrimary }` | the new `Image` — copies the file into `userData/images/` |
| `images:setPrimary` | `{ imageId, personId }` | `{ imageId }` |
| `images:delete` | `{ imageId }` | `{ imageId }` — unlinks the file |

### Settings (per-tree)

| Channel | Payload | Returns |
|---------|---------|---------|
| `settings:getAll` | — | flat map of the active tree's settings (prefix stripped) |
| `settings:set` | `{ key, value }` | `{ key, value }` — stored under `"<activeTreeId>:<key>"` |

### Global settings

| Channel | Payload | Returns |
|---------|---------|---------|
| `globalSettings:getAll` | — | the global settings map (e.g. `{ theme }`) |
| `globalSettings:set` | `{ key, value }` | `{ key, value }` |

## The `appimg://` protocol

Registered as a privileged scheme in [`index.js`](../src/main/index.js) and handled
at app-ready. It maps an `appimg://` URL back to an absolute filesystem path and
streams the file via `net.fetch('file:///…')`. This lets locally-stored photos
render in the renderer without enabling `file://` access or loosening the CSP. Build
these URLs with `electronAPI.getImageUrl(path)` — never hand-construct them.

## Adding a new channel

1. Add an `ipcMain.handle('domain:action', …)` in [`ipc.js`](../src/main/ipc.js),
   wrapped in `try/catch`, returning the `{ success, data }` envelope and calling
   `save()` after any mutation.
2. Add a store action in [`store/index.js`](../src/renderer/src/store/index.js) that
   calls `api.invoke(...)` and updates reactive state on success.
3. Call the store action from components — never `api.invoke` directly from a view.

See [conventions.md](./conventions.md) for the rationale behind these layers.
