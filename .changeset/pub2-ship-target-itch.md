---
'@mcthaydt/automata-ship': patch
---

Add `--target itch` to `automata-ship prepare` and `publish`: itch.io's index.html, limit, case and ruken.toml checks, a byte-reproducible `<id>-<version>-itch.zip`, and `butler push` with `--userversion` and `--if-changed`. `ShipConfig` gains an optional `itch` section. The Ruken path is unchanged.
