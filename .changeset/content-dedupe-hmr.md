---
'@mcthaydt/automata-content': patch
---

Send the dev server's HMR event only when a rebuild's result actually changed, so one save — which macOS may
report as several watcher events, and which the watcher also emits for authored files at startup — never sends
a second, identical `automata:content` or `automata:content-error`.
