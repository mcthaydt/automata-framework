---
'@automataframework/automata': patch
---

The root entry of `@automataframework/automata` is smaller: 600 names became 274.

It keeps the define verbs and the types `defineGame` takes, the host contract, and every name that a game, the 3D game, an editor or a tool in this repository imports, plus the seams the extension tests pin (`AudioBuses`, `PresentationBus`, `settingsStore`, `typedBus`, `createPostFilterSlot` and their neighbours). The rest of the runtime, renderer and ui kit surface is no longer exported from the root: the widget kit internals, the runtime's layer builders and error classes, and the helper types of the draw and view code. `AudioLive` and `audioLayer` are deleted: nothing used them. Nothing about the `/testing`, `/extension` and `/target` entries changes.
