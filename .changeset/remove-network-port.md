---
'@mcthaydt/automata': patch
---

BREAKING: removes `NetworkPort` and `AuthoritativeSnapshot`, which no game or extension used. The `net` extension that was to provide the port is not built; when it is, it will bring its own port.
