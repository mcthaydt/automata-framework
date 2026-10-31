---
"@mcthaydt/automata-ship": patch
---

`automata-ship publish --target itch --from tauri` pushes a game's desktop bundles from `dist-tauri/` to itch.io as
Downloadable files (DIST.5c, DIST spec §6.4). It pushes one bundle per OS, each to its own butler channel: Linux's
AppImage, macOS's dmg and Windows's NSIS installer, on the channels `linux`, `mac` and `windows`. The new
`itch.downloads` setting can rename any of them. It needs the same `itch` section, key and butler as an HTML5 push, and
fails before anything runs when no bundle of this version is there (`ItchDownloadsMissing`). New exports:
`publishDownloadsToItch` and `ItchDownloadsMissing`.

`game-release.yml` takes `desktop: true`, which builds unsigned bundles on each of `desktop-runners` (default
`af-linux` and `af-mac`), keeps them as an artifact and, with `itch: true`, pushes them to itch.io. With
`desktop-signing: true` it builds the signed and notarized macOS bundle in the `release` environment, using the
`APPLE_*` secrets; a missing secret fails the job by name.
