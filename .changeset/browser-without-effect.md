---
'@mcthaydt/automata': patch
---

BREAKING: the browser runtime is moving off Effect (D2), one feature at a time. So far:

- `display`, `locale`, `settings`, `audio` and `saves` are plain factories (`createDisplayPolicy`, `createLocale`, `createSettings`, `createAudio`, `createSaves`); their refusals are `Result`s and their errors plain `Error`s with a `_tag`.
- Loading: `createLoadMeter(clock)` and `createAssets(options)` replace `makeLoadMeter` and `makeAssets`; `load(screen, onProgress?, signal?)` answers a `Result` with `AssetLoadFailed` or `LoadStalled`.
- Input: `createInput(options)` replaces `makeInput` and returns the Input with `dispose()`; `device`, `profile` and `pads` are plain `Subscribable`s, `rebind` answers a `Result`, `resetBindings()` is a method and `capture(device, signal?)` resolves a `Result`. The rebind errors are plain `Error`s, and the unused `Input` tag is gone (the `Input` type stays).
- Extensions: `ExtensionError` is a plain `Error`; the `layers` field (Effect layers, which no game used) is removed.

The runtime's Effect tags (`Audio`, `Settings`, `Haptics` and the rest) stay until the app itself is plain.
