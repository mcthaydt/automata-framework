---
'@automataframework/ui-screens': patch
---
`@automataframework/ui-screens/splash` adds a studio splash: `splashStep({ logo })` is an opening step that shows the logo for a moment (1.5 seconds unless `holdMs` says otherwise) and ends early on any key, click or tap. It runs after the host is ready, so it never holds the ready signal back, and it makes no sound. The line under the logo is translated into the framework's six languages; the package's words are in `@automataframework/ui-screens/words/<language>.json`.
