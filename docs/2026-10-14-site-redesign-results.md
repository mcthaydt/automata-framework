# Automata site redesign results

Implemented the audit fixes and replaced the original dark card-based presentation with the approved Design Taste direction. Canonical and social URLs use https://automata.ruken.com. Changes are local and have not been deployed.

## Design and content

Direction: **Type and nothing else**, seed **2089695647**, Chivo, **Candy chapters**. The site uses large type, flat yellow/white/pink/cyan/orange sections, square controls, a plain navigation bar and a full-width closing wordmark. Hairline panels, decorative gradients, bento components and Lucide icons were removed. Styling now uses a single plain CSS token system; unused styling and icon dependencies were removed from the manifest and lockfile.

One blueprint redraw: “Headline you can type” became “Live demo with controls.” Automata produces playable games rather than editable headlines. No palette redraws or invented product imagery. The imagery is the actual bundled game and example interfaces; no stock images, mock customer data, sample testimonials or external image credits were introduced. The social image is an original typography graphic.

The page argument moves from game programming to the playable Emberwick room, then focused demos, ownership boundaries and setup. The homepage embeds the starter. Other demo interfaces start on request, avoiding several simultaneous GPU sessions; the stop control unloads the iframe. Reduced-motion users get stopped embeds and no entrance or control animation.

Copy changes remove AI guarantees, first-attempt promises, crash guarantees, invented public installers, milestone jargon, fixed performance labels and unsupported reference-project claims. The source sample is now a complete simulation example checked against the current framework types. The API page is explicitly a selected reference, not an exhaustive specification. Generated docs were corrected at the generator and regenerated into JSON and both plain-text endpoints.

## Audit closeout

| Finding | Implementation |
| --- | --- |
| Incompatible starter and invented APIs | Published snippet typechecks against the adjacent simulation source; listed exports are checked against package entry points. Async creation, actual instance methods, runtime boot, physics, host and content entries are corrected. |
| Ignored demo deep links | Universal page load reads demo selection from the URL on the client; anchors preserve navigation and history. Unknown slugs use the catalog fallback. |
| Missing mobile navigation | Native details menu exposes the same primary destinations, with current-page semantics and adequate control sizing. Docs sections also collapse on phones. |
| Unsupported AI claims/installers | Replaced with project context, architectural guidance and verification instructions. |
| Misleading and inaccessible search | Native modal dialog searches pages, documentation content, API signatures and demos; arrow navigation, labelled input, Escape, modal focus and focus restoration are implemented. |
| False copy success | Shared copy control reports denied clipboard access and suggests manual selection. |
| Placeholder homepage demo | Actual starter bundle embedded, with explicit controls and standalone link. |
| Iframe load mistaken for game readiness | Reads existing trusted bundle boot markers; detects failure, bounds loading to 20 seconds, supports retry and clears timers between attempts. Only catalog bundle URLs can be embedded. |
| Missing landmarks, metadata and current page | Main landmark, skip link, visible focus, current-page semantics, one managed title/description, canonical and social metadata, social PNG and branded error route. |
| Slash stealing editable input | Shared editable-target guard excludes fields and open dialogs. |
| Clipped demo instructions | Header extraction now preserves continuation lines. The sync pipeline no longer manufactures an empty canvas claiming readiness when a bundle is missing. |
| Heavy highlighting surface | Load the highlighter on demand with only the needed languages/theme and a JavaScript regex engine. No all-language or Wasm bundle is loaded by the highlighting module. |

## Verification

- Full website unit suite: **16 files, 35 tests passed**.
- Nearest affected suite after final homepage/control edits: **3 files, 9 tests passed**.
- Svelte check: **0 errors, 0 warnings**.
- Static production build: passed with strict prerender errors and compressed outputs.
- `pnpm check:site`: verified **14 built pages** for unique title/description, main landmark, canonical origin, social image, internal destinations and anchors.
- In-process built server with the full manifest: `/` and `/docs/overview` returned **200**; `/docs/no-such-page` returned **404** with the branded error copy.
- Design Taste source lint: **0 FAIL, 0 WARN**; output saved in `.taste-skill/source-lint.txt`.
- `git diff --check`: passed.
- Dependency lockfile regenerated offline in an isolated temporary directory after the shared pnpm store rejected writes. No dependency versions were upgraded.

## Visual and runtime acceptance remains open

A native Chrome view of the built homepage from disk showed the oversized yellow first screen and navigation. That review exposed excessive hero padding and a long supporting sentence; both were reduced. File-origin viewing does not establish client routing, clipboard permissions or live demo behavior.

The session cannot bind a local preview server (`listen EPERM`). Design Taste's viewport inspector therefore cannot run. Subsequent native screenshot capture failed with ScreenCaptureKit error `-3811`. Reliable final captures at 1440, 768 and 390 pixels, a scored screenshot critique, live HTTP interaction checks, host CSP and actual device/GPU acceptance have **not passed**. No numeric visual score is assigned without those captures.

The build also emits warnings from SvelteKit's generated `root.svelte` about initial store references. Application Svelte diagnostics are clean; generated framework files were not edited or warning filters added. Chivo is requested from Google Fonts with a system fallback; network/font loading and final line wrapping still need the browser pass.

Run `pnpm preview --host 127.0.0.1 --port 5198` in an environment that permits local servers, then use the Design Taste inspector against that URL. These are acceptance steps, not completed checks.
