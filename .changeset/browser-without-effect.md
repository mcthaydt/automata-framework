---
'@mcthaydt/automata': patch
---

BREAKING: the browser runtime is moving off Effect (D2), one feature at a time. So far:

- `display`, `locale`, `settings`, `audio` and `saves` are plain factories (`createDisplayPolicy`, `createLocale`, `createSettings`, `createAudio`, `createSaves`); their refusals are `Result`s and their errors plain `Error`s with a `_tag`.
- Loading: `createLoadMeter(clock)` and `createAssets(options)` replace `makeLoadMeter` and `makeAssets`; `load(screen, onProgress?, signal?)` answers a `Result` with `AssetLoadFailed` or `LoadStalled`.
- Input: `createInput(options)` replaces `makeInput` and returns the Input with `dispose()`; `device`, `profile` and `pads` are plain `Subscribable`s, `rebind` answers a `Result`, `resetBindings()` is a method and `capture(device, signal?)` resolves a `Result`. The rebind errors are plain `Error`s, and the unused `Input` tag is gone (the `Input` type stays).
- Time and the frame loop: `createTime(bus)` and `createAppLoop(options)` replace `makeTime` and `makeAppLoop` (the loop has `dispose()`); `watchLifecycle` returns the function that stops it. The veil is `createVeil({ overlay, reducedMotion, clock })`, its `cover()` and `reveal()` promises. The Effect `makePresentationBus` is gone: `createPresentationBus()` builds the bus.
- Leaderboards: `createLeaderboards(hosting, bus)` replaces `makeLeaderboards`; `submitScore` and `readBoard` answer promises that never reject.
- Screens and the flow: `ScreenDef.enter(context)` is a plain function that may return a promise; a throw or rejection is the screen's failure. `context.screen` (a `Disposables`) holds what the screen undoes when it is left, `context.runtime` what a game keeps across screens, and `context.services` the runtime's services as one object (`hosting`, `bus`, `clock`, `time`, `flow`, `settings`, `saves`, `appLoop`, `assets`, `renderer`, `locale`, `audio`, `leaderboards`, `haptics`). `ScreenDef` has no type parameter; `Flow.settled()` is a method returning a promise and the `Flow` tag is gone. `Disposables`, `disposables()`, `Clock`, `ScreenContext` and `RuntimeServices` are exported.
- Extensions: `ExtensionError` is a plain `Error`; the `layers` field (Effect layers, which no game used) is removed.

The runtime's remaining Effect tags (`Audio`, `Settings`, `Time`, `AppLoop` and the rest) and `RuntimeTest`'s Effect layer stay until boot and the testing helpers are plain.
