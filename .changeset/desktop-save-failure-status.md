---
'@automata/framework': patch
---
On the desktop (`tauri`), a save that cannot be written to disk (a full disk, a read-only data folder) is no longer
reported as saved: `savesStatus` turns `retry`, the write is tried again half a second later, and `saved` returns once
one lands. A `flush` that fails is still refused `INTERNAL`, and says `retry` too.
