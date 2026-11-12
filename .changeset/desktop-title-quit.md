---
'@automata/framework': patch
---
On the desktop (`tauri`), the default title screen has a Quit button after Play (or after the save slots), as tall as
Play, in every language the screens ship (`title_quit`). It quits the app through `Hosting.exit`, so the game's exit
handlers and the save flush run first. The web, itch.io and Ruken titles are unchanged: there the browser or the host
owns leaving.
