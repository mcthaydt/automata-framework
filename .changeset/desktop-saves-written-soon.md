---
'@automata/framework': patch
---
On the desktop (`tauri`), a save now reaches the disk half a second after the game's last change to it, one
write per burst of changes, instead of only on Quit or a window close: an app that crashes or is killed keeps what the
player did up to that moment.
