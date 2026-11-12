---
'@automataframework/content': patch
---
The test of the Vite plugin's HMR update no longer fails on a runner whose file watcher reports a setup write late: it waits for the watcher to catch up before it makes the change it counts. No behaviour of the plugin changes.
