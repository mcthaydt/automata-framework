# Site audit, 14 October 2026

Historical findings. Implementation and current verification are recorded in [the redesign results](2026-10-14-site-redesign-results.md).

The highest priorities are developer trust and working navigation: the site publishes an incompatible starter example, ignores demo deep links, hides primary navigation on phones, and overstates what AI instructions guarantee. Fix these before visual polish.

Scope: local `automata_website` source at `265315d`, its design specification, and targeted comparisons with the adjacent framework source. No application files changed. This is a source audit, not deployed-site acceptance.

## Findings in priority order

| Priority | Finding and evidence | Recommended change |
| --- | --- | --- |
| High | **Starter code and API reference disagree with the implementation.** `src/routes/+page.svelte:23` imports `runApp`; the runtime exports `runGame`, not `runApp` (`../automata-framework/packages/runtime/src/index.ts:15`). `src/data/cheatsheet.ts:25` documents synchronous `createSim(...): SimInstance`; the implementation returns `Promise<Sim>` (`../automata-framework/packages/sim/src/world/sim.ts:152`). The cheatsheet also documents `runApp`. | Derive the starter from a runnable current example and validate published snippets against actual exports and types. Review the rest of the hand-written API inventory for drift. |
| High | **Demo links ignore their destination.** Home and command search link to `/examples?demo=...`, but `src/routes/examples/+page.svelte:22` initializes from the first catalog entry and never reads the query parameter. | Make the URL own demo selection. Support direct entry, selection changes, and browser history, with a safe fallback for unknown slugs. |
| High | **Primary navigation disappears on phones.** `src/lib/components/Header.svelte:26` hides the only header navigation below `md`; no mobile menu replaces it. Footer and search remain indirect alternatives. | Add a plainly named mobile navigation control with accessible expanded state and keyboard operation. |
| High | **AI claims promise outcomes instructions cannot guarantee.** `src/routes/ai/+page.svelte:173` says “Eliminate hallucinations” and “guarantee zero-eval CSP compliance”; line 324 promises working code “on the first attempt.” | Describe what the guidance contains and require users to run checks. Remove guarantees and unsubstantiated first-attempt claims. |
| Medium | **Command search overpromises its coverage and controls.** The header says “Search docs & API,” but `CommandMenu.svelte:16–40` searches navigation descriptions and demo metadata, not documentation bodies or API entries. The footer advertises arrow navigation, but its key handler only implements Escape. No focus trap, background inertness, or focus restoration is implemented. | Either implement the advertised scope or rename it “Find a page or demo.” Implement keyboard selection and proper modal focus behavior. Give the input a programmatic label. |
| Medium | **Clipboard failures display success.** Catch paths in `TerminalBox.svelte:18`, `CodeBlock.svelte:41`, `cheatsheet/+page.svelte:40`, and `ai/+page.svelte` set the copied state even when `writeText` rejects. | Announce a failure and offer manual selection. Show success only after a successful copy. |
| Medium | **The homepage's main demonstration is a placeholder.** `src/routes/+page.svelte:96–134` presents window chrome and “60 fps,” but contains an icon, prose, and a link rather than a running demo. The design spec explicitly calls for a live experience. | Embed a verified demo with loading, failure, and pause behavior, or show an actual screenshot with an accurate launch label. Remove runtime-looking performance labels from a static frame. |
| Medium | **Demo error handling cannot establish readiness.** `DemoRunner.svelte:71–78` equates iframe load with success and relies on iframe error events. HTTP errors and application boot failures can still produce load events; no application-ready signal or timeout exists. | Distinguish document load from game readiness. Use a verified ready/error signal with source/origin validation and a bounded timeout. Treat this as a design gap; no browser failure reproduction was possible here. |
| Medium | **Page semantics and metadata are incomplete.** The shared layout has no main landmark or skip link. Header links have no current-page state. Page head blocks contain titles but no description, canonical URL, or social metadata. `app.html:7` also hardcodes a title outside Svelte's managed head. | Add the main landmark and skip target, current-page semantics, and page metadata. Keep one managed title. Inspect generated HTML afterward. |
| Medium | **Global `/` shortcuts interfere with text entry.** Cheatsheet and docs handlers only exclude their own search field, so typing `/` in the global command palette can redirect focus into the underlying page. | Ignore shortcuts in editable targets and when another modal owns input. |

## Copy review

The useful message is already present: deterministic simulation, TypeScript, PixiJS presentation, and Effect outside the simulation. The current copy buries that message under internal milestones, unexplained terms, absolute claims, and repeated declarations of being “Spartan.” Keep the technical specificity, but introduce it in the order a new developer needs it.

| Current copy | Issue | Suggested replacement or action |
| --- | --- | --- |
| “M1 & M2 Foundation Live: 2D Renderer, Base-2D & Deterministic Core” | Internal milestone names require project history. | “Explore the 2D starter and framework demos.” |
| “The deterministic game framework for the web & Ruken.” | Clear category, but Ruken is unexplained. | “Build deterministic games in TypeScript.” Explain Ruken in supporting copy or a link. |
| “Pure synchronous ECS simulation, PixiJS 2D & 3D rendering, and Effect runtime boundaries…” | Too many architectural terms at once; current and planned rendering scope are blended. | “Write gameplay in TypeScript, render with PixiJS, and explore the runnable 2D examples.” Explain simulation determinism in the next paragraph. |
| “Built for Spartan Programmers” | Describes an identity rather than a capability. | “Keep gameplay in the simulation.” |
| “complete determinism,” “rock-solid boundaries,” “zero untrapped crashes” | Broad or absolute assurances without a stated scope. | Describe the mechanism: “The simulation advances in fixed ticks. Effect manages resources and errors outside it.” Link replay claims to their tested conditions. |
| “WebGL2 default with WebGPU fallback” | Conflicts with the framework rule that WebGPU is opt-in. | “WebGL2 by default, with opt-in WebGPU.” |
| “Ready to enjoy videogames programming?” | Awkward phrasing and a vague next action. | “Start your first Automata game.” |
| “No graphical editors, no bloatware” | Dismissive language does not explain the workflow. | “Write your game in TypeScript.” |
| “Eliminate hallucinations…guarantee zero-eval CSP compliance.” | Claims instructions can enforce correctness. | “Give your coding agent Automata's simulation, rendering, and CSP rules. Run the project checks to verify its changes.” |
| “Tested prompt patterns…on the first attempt.” | No evidence for the universal outcome. | “Example prompts for common Automata tasks.” |
| “100% compliant with strict Content Security Policy.” | CSP includes directives beyond dynamic evaluation. | “Avoid dynamic code evaluation under Ruken's CSP.” Keep the exact supported policy in technical docs. |
| “Made with Automata” over reference projects | Does not distinguish framework consumers from projects that informed the framework. | Label starter templates, reference projects, and verified consumers accurately. Confirm each relationship before publication. |
| “Demo Bundle Unavailable…Please ensure demo bundles are compiled.” | Gives visitors a build-system instruction they cannot act on. | “This demo couldn't start. Try again or open it in a new tab.” Provide diagnostics separately for maintainers. |

The copyable `npx automata create-game my-game` command also needs publication verification. The adjacent CLI package is named `@mcthaydt/automata-cli`, is private, and targets GitHub Packages. The local source does not establish that an unscoped public `automata` package supplies this command. Do not substitute another install command until the actual distribution and authentication flow is verified.

The AI installation commands and `automata.dev` URLs likewise need end-to-end verification. They are unverified here, not confirmed broken. Instructions can provide context; describe them separately from compiler, lint, and runtime enforcement.

## Design assessment and skill results

Applied `redesign-existing-projects` for the UX/design checklist and `design-taste-frontend` for source lint and attempted viewport inspection. Applied `better-writing` and `llm-writing` for the copy review, with intent and information-hierarchy guidance for the report.

Design Taste's source linter reported **157 FAIL and 16 WARN matches across 24 files**. These are opinionated house-style matches, not 157 usability defects. The site's own brief explicitly requests dark surfaces, hairlines, bento cards, Lucide icons, and subtle motion; do not remove approved conventions merely to satisfy the linter. Some matches are false positives or context-dependent: `min-h-screen` matched its `h-screen` pattern, dialog shadows are appropriate, and check/cross symbols are not inherently a defect.

Source-level concerns worth visual review are the placeholder media, repeated framed surfaces, monospace UI and headings, tiny secondary labels, and repeated centered marketing sections. The showcase repeats gamepad icons instead of showing the games. Actual game imagery would provide stronger product evidence. These are recommendations for screenshot review, not a visual acceptance verdict.

No numeric design score is assigned without rendered screenshots. Contrast, overflow, headline wrapping, real touch targets, animation, and desktop/tablet/mobile composition remain unverified.

## Proof and limits

- `pnpm check`: passed, zero errors and zero warnings.
- `pnpm test`: passed, 12 files and 26 tests.
- Tests reviewed include render/presence assertions; passing them does not validate copied code against framework exports, demo query routing, or modal focus behavior.
- Design Taste source lint completed; results interpreted above.
- Browser inspection attempted but blocked: no connected browser was available and headless Chrome exited at startup. No screenshots or live-browser behavior were verified.
- External links, package publication, AI installation commands, deployed HTTP behavior, and real-device/GPU performance were not verified.
- Existing build output contains large JavaScript chunks, but it predates this audit and no network trace was captured. This is a reason to measure transferred route payloads later, not evidence that every chunk loads on entry.

Recommended sequence: correct technical examples and claims; repair URL and keyboard behavior; restore direct mobile navigation; then review screenshots and replace placeholder product media.
