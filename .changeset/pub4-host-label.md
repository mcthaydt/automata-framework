---
'@mcthaydt/automata-ui': patch
---

The boot-failure panel's exit button names the host and needs the `exit` grant: `BootFailurePanel` takes `hostName` and `canExit`, `bootFailureView` takes `canExit`, the default copy is `Back to {host}` (filled by the new `withHostName`), and "Back to …" is never drawn when the host did not grant `exit`. The (unpublished) runtime passes them from `Hosting`. Inside Ruken, which always grants `exit`, the panel still says "Back to Ruken".

BREAKING: `BootFailurePanel` gains the required props `hostName` and `canExit`, and `bootFailureView` gains the required third parameter `canExit`, so a caller that draws the panel itself must pass them. The default `exit` copy changes from `Back to Ruken` to `Back to {host}`; a game's own copy may use `{host}` too.
