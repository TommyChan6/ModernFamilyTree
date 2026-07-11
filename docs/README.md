# FamilyTree documentation

Developer and design documentation for the FamilyTree desktop app. If you're new
here, read them roughly in this order:

| Doc | What it covers |
|-----|----------------|
| [client-structure.md](./client-structure.md) | **Visual guide** to projects, views, layout types, scenes, tags/groups & state (the target design). Read this first for the mental model. |
| [OVERHAUL_GUIDE.md](./OVERHAUL_GUIDE.md) | Step-by-step build plan for the client overhaul — hand each step to Claude. |
| [architecture.md](./architecture.md) | Process model, layers, data flow, module map. |
| [data-model.md](./data-model.md) | The JSON store shape, entities, IDs, migrations. |
| [ipc-api.md](./ipc-api.md) | Every IPC channel, the request/response envelope, and the preload bridge. |
| [graph.md](./graph.md) | The graph engine — layout modes, saved states, guides, highlights, persistence. |
| [conventions.md](./conventions.md) | Coding conventions and the patterns to follow. |
| [developer.md](./developer.md) | Setup, scripts, project layout, testing, build internals. |
| [contributing.md](./contributing.md) | Branch/PR workflow and the definition of done. |
| [design.md](./design.md) | Product vision, UX principles, the visual design system, roadmap. |

### How the docs fit together

```mermaid
flowchart TD
    CS["🧭 client-structure.md<br/><i>the mental model</i>"]
    OG["🛠️ OVERHAUL_GUIDE.md<br/><i>build steps</i>"]
    ARCH["🏛️ architecture.md<br/><i>process & layers</i>"]
    DM["🗄️ data-model.md<br/><i>data shapes</i>"]
    IPC["🔌 ipc-api.md<br/><i>channels</i>"]
    GRAPH["🌳 graph.md<br/><i>graph engine</i>"]
    DES["🎨 design.md<br/><i>vision & tokens</i>"]
    DEV["🛠️ developer.md<br/><i>run/test/build</i>"]

    CS --> ARCH --> DM --> IPC
    ARCH --> GRAPH
    CS --> DES
    CS --> OG
    ARCH --> DEV

    style CS fill:#6c8ef5,color:#fff
```

For a user-facing overview and quick start, see the [project README](../README.md).
