---
'@mcthaydt/automata-host': patch
---

`Hosting.onExiting` handlers now run one after another in registration order, then the built-in `saves.flush`, all inside one `HOST_EXIT_CAP`, so a write a handler makes is flushed before the host is answered (the SDK ran its exiting listeners together, so the flush could leave first). A handler that never returns costs the flush, and the host is still answered at the cap. Adds `Hosting.round.ended`, a stream with one item per round that ended (its outcome) that ends when Hosting shuts down; a dropped end gives none.
