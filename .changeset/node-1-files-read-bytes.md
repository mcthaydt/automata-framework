---
'@mcthaydt/automata-node': patch
---

`Files.readBytes(path)` reads a file's exact bytes as a `Uint8Array` of their own, for binary inputs such as images: reading them with `readText` replaces every byte that is not valid UTF-8. A failed read fails with the same `FileError` as `readText` (NODE.1).

BREAKING: `FilesService` gains the required `readBytes`, so a custom `Files` implementation (a test fake) must add it; code that only calls `Files` or provides `FilesLive` compiles unchanged.
