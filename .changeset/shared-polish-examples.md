---
'@automataframework/tools': patch
'@automataframework/ui-screens': patch
---
`passFirstRun` in `@automataframework/tools/e2e` no longer hangs when the language screen is followed at once by the flashing warning: after a press it waits only for the screen it pressed. `@automataframework/ui-screens/credits` adds `showCredits`, which shows the credits panel in a screen's layer for a game that is plain TypeScript and has no Svelte of its own to mount it with, and hands back how to close it.
