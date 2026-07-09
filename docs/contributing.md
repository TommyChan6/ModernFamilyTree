# Contributing

Thanks for contributing to FamilyTree. This guide covers the workflow and
expectations for changes.

## Before you start

- Read [architecture.md](./architecture.md) to understand the process model, and
  [conventions.md](./conventions.md) for coding style.
- Set up your environment per [developer.md](./developer.md) (`npm install`,
  `npm run dev`).

## Workflow

1. **Branch** off `master`. Use a short, descriptive branch name
   (`feature/timeline-zoom`, `fix/image-delete-cascade`).
2. **Make focused changes.** One logical change per branch/PR. Keep the diff scoped
   to the task.
3. **Match the surrounding code.** Follow the file's existing style, structure, and
   naming — see [conventions.md](./conventions.md).
4. **Test.** Run `npm test`. If you touched the data layer (`db.js`, data shape, IPC
   handlers), add or update tests in [`tests/db.test.js`](../tests/db.test.js).
5. **Verify by hand.** Run `npm run dev` and exercise the affected UI — the graph,
   views, and modals have no automated coverage.
6. **Commit** with clear, present-tense messages describing *what* and *why*.
7. **Open a PR** against `master` with a description of the change, screenshots or
   clips for anything visual, and notes on how you tested.

## Definition of done

- [ ] `npm test` passes.
- [ ] New/changed data-layer behavior has test coverage.
- [ ] Manually verified in `npm run dev` (both dark and light themes if visual).
- [ ] No new Node APIs leaked into the renderer; sandbox posture preserved
      (see [conventions.md](./conventions.md#security)).
- [ ] New persistence goes through the store → api → IPC layers, not direct calls.
- [ ] Docs updated if you changed architecture, the data model, or the IPC surface.

## Adding features

- **New IPC channel?** Follow the recipe in
  [ipc-api.md](./ipc-api.md#adding-a-new-channel): handler → store action → component.
- **New graph behavior?** Keep layout math in pure functions under
  [`components/graph/`](../src/renderer/src/components/graph/); confine D3 DOM work to
  `GraphCanvas.vue`. See [graph.md](./graph.md).
- **New data field?** Update `db.js` (creation defaults + any migration),
  [data-model.md](./data-model.md), and the tests.

## Roadmap

Planned and possible features are tracked informally in
[`designDraft.txt`](../designDraft.txt) and summarized in
[design.md](./design.md#roadmap). Check there before proposing large features so work
isn't duplicated.

## Reporting issues

When filing a bug, include: what you did, what you expected, what happened, your OS,
and anything from the DevTools console (Ctrl+Shift+I) or the `npm run dev` terminal.
