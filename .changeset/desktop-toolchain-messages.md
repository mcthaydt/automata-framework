---
'@automata/tools': patch
---
`automata ship prepare --target tauri` says what is missing in plain words, with the one command that installs it:
Rust (also when `cargo` is not on the path at all, which used to print `could not run cargo: spawn cargo ENOENT`),
the Linux desktop libraries (now Tauri 2's whole Debian and Ubuntu list, not just WebKitGTK), the game's Tauri CLI,
and a missing web build (`run pnpm build:tauri first`, instead of an `lstat` error).
