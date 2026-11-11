# Pending: the fourth example of the shared polish

`ui-splash-credits.example.ts.txt` and its journey `ui-splash-credits.journey.ts.txt` (`.txt` so no tool treats them as code) are written and were run in Chromium (the
journey passes at the phone and compact sizes, and the smoke test boots the example). They wait here, outside the
examples catalog, because the site's playground can import only `@automata/framework` and `zod` and the site's unit tests
compile every catalog example: putting them in `examples/2d` before the playground knows `@automata/ui-screens` fails the
site. Task 15's step 4 (the playground's runtime, import map, Vite input and compile allow-list) does that; then add `"@automata/ui-screens": "workspace:*"` to `examples/2d/package.json` (it was removed so `knip` does not flag it
while no catalog example uses it), move the two files (dropping `.txt`) to `examples/2d/ui/ui-splash-credits.ts` and `examples/2d/tests/e2e/ui-splash-credits.test.ts`, add the README row
(`| [\`2d/ui/ui-splash-credits.ts\`](2d/ui/ui-splash-credits.ts) | A studio splash, then a title with Credits |`), raise the
site's example counts (`site/tests/unit/examples/examples-pages.test.ts`: 20 becomes 21, and the `ui` module is listed), and
delete this folder. The example's `Tier` is `core`: the catalog makes `ui` a core module.
