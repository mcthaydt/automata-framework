# Site motion: build audit

Stage 5 of the site motion pipeline (Opus, medium; superpowers `verification-before-completion` as the standard; no
subagents). Audited 2026-11-09 on AF #549 (`c42e0c79`, on #542 with #543 merged in) against the
[spec](2026-11-08-site-motion-spec.md), the [plan](2026-11-08-site-motion-plan.md) and its
[plan audit](2026-11-08-site-motion-plan-audit.md). Everything below was measured in this session in Chromium on a fresh
`pnpm build` of the site; nothing is copied from the build log.

**Verdict: ship it.** The motion is as subtle as the Owner asked: nothing moves more than 8 px or takes longer than
0.48 s, the first screen never moves, a click is never slowed, and a visitor who asked for less motion gets the site
exactly as before and downloads none of it. No finding blocks the merge. One small bug (B1) and two wrong statements in
the build log (B2) are for the fix stage; WebKit has never run the motion journeys (G1) and needs the Mac.

## What was checked, and what it showed

| Area | How | Result |
| --- | --- | --- |
| Unit tests and types | `vitest run` in `site/`; `pnpm check` (svelte-check) | 501 of 501 pass; 0 errors, 0 warnings. |
| Motion journeys | `playwright test tests/e2e/motion.e2e.ts --project=chromium` | 20 of 20 pass. |
| Size budget | `pnpm build` (root), `pnpm build` + `pnpm check:site` (site) | Motion chunks **32,941 B gzip** of 36,000; 47 pages verified; no page preloads a motion chunk. |
| Lighthouse | `lhci autorun --config=lighthouserc.json` (3 runs a page, motion on: Lighthouse does not ask for reduced motion) | Performance **100** on all six pages, every run. Home LCP 1,583 ms, TBT 5 ms (median); other pages TBT 0. CLS 0 everywhere. 0 assertion failures. |
| GSAP pin and licence | `node_modules/gsap/package.json`; npm registry; <https://gsap.com/standard-license> fetched today | Pinned exactly at 3.15.0 (3.15.1 is 5 days old, eligible 2026-11-18; 4.0.0-beta.3 not taken). Renovate holds `<4` with the 14-day `minimumReleaseAge`. Licence still "Last modified date: May 30, 2025". The website is free, so it is a permitted use. Lenis 1.3.27, MIT, latest. Lenis's stylesheet is byte-for-byte its own. |
| Feel, desktop (1280 × 800) | Probes with a real wheel, keys and screenshots | A notch glides and lands; a section's heading goes from hidden to full in about 300 ms once it crosses the line. 56 parts wait on a fresh Home; none is ever in view and hidden after it settles. |
| Feel, phone (iPhone 13) | Same, touch device | No Lenis and no Lenis download (the page keeps its own momentum); sections still ease in. A fast fling to the end leaves nothing hidden in the window. |
| Keyboard | Tab through all of Home with motion on, 700 ms per stop | Every focused control is fully visible and on screen. Tab into a waiting section reveals it (A3 holds). |
| Anchors | `/#play` deep link; contents links (journey) | Lands with nothing hidden in view. |
| Reload mid-page | Reload at half way down Home | The browser restores the place; nothing in view is hidden. |
| Find in page | `window.find` on the last section's heading | Found, scrolled to and revealed (heading opacity 1). Straight after a wheel it is lost (B1). |
| Reduced motion | Switched on during a reveal; off again; on during a page change | On: no inline style left, nothing hidden, Lenis gone. Off again: Lenis back, sections below the window wait again. On mid page change: no mark left, `main` at opacity 1. |
| Rapid clicks | Six header links 60 ms apart | Ends on the right page, `main` at opacity 1, no mark left. |
| Errors | Console and page errors on every probe | None. |

## The Owner's audit rule: make something, play it, reload, reopen

- **As a visitor:** read Home with the wheel, opened the Editor page, pressed *Try the editor*, made a platformer level
  (four coins and a ledge), and downloaded it with Share (`untitled-platformer.af2d.json`, a valid level file). Played
  Emberwick on Home with motion on, straight after a wheel: it started and ran, with no error.
- **Reload and close/reopen:** the level **is kept**. After a reload, and after closing the tab and opening a new one,
  the try-it editor opens on *What do you want to change?*; the Levels card names *Untitled platformer*, and opening it
  shows the four coins where they were. It lives in the browser's private file storage (OPFS, `sample-game`), which is
  why the build stage's probe of localStorage and IndexedDB found nothing (B2).
- **Play the level made:** not possible in the browser. The try-it editor has no Play (its top bar shows Play only when a
  game serves one), so a visitor can make a level but not play it (B3). Playing the download needs a local game; that
  was not repeated here (motion never touches a game or the editor, which loads no motion code).

## Findings

| # | Severity | Finding | Fix |
| --- | --- | --- | --- |
| G1 | Medium (gap) | The motion journeys have never run in WebKit. The site's Playwright suite is not a pull request check (it runs only in `release-checks.yml`), the cloud container has only Chromium, and the build ran Chromium only. Firefox is not a project in `site/playwright.config.ts` at all. Safari's scrolling and `IntersectionObserver` timing are where Lenis and the reveals would differ. | Run on the Mac before merging the stack's site work: `cd site && pnpm test:e2e tests/e2e/motion.e2e.ts --project=webkit`. Adding a Firefox project is a separate call (it is not in the plan). |
| B1 | Low | A jump the page did not make by wheel (Find in page, a script's `scrollTo`) within about half a second of a wheel notch is undone: Lenis finishes its glide and the page stays where the wheel was sending it. Measured on `/docs`: a jump 100 ms or 400 ms after a notch is lost and **never recovers** (the build log's ruling 3 says it recovers); at 800 ms and later it holds. Keys, clicks, focus and `#` links are already covered. Most likely hit by *Find next* pressed just after scrolling. | In `smooth-scroll.ts`, also settle on a native `scroll` whose position is far from Lenis's own (`Math.abs(scrollY - lenis.animatedScroll)` over a few pixels while Lenis is gliding); a journey that wheels, jumps at 100 ms and expects the jump to hold. |
| B2 | Low | Two statements in the build log are wrong. (1) "Reloading the try-it editor does not bring a new level back": it does (OPFS), see above; the progress tracker and the project memory repeat the claim. (2) Ruling 3 says a lost jump recovers; it does not (B1). Also `site/tests/e2e/editor-try.e2e.ts` says "Nothing is kept there", which is no longer true. | Correct the log, the tracker and the test's comment. Tell the saving thread the level is kept; what a returning visitor sees is the Home of the editor, not their level. |
| B3 | Low (grandma) | Drunk grandma test on the try-it editor: she paints coins and a ledge and looks for Play; there is none, and after a reload she lands on *What do you want to change?* rather than on her level. Not motion's doing; the editors own both. | For the every-editor and saving threads: a Play in the try-it editor, and reopen on the last level edited. |
| B4 | Nit | `smooth-scroll.ts` opens with a comment cut off mid-sentence ("…into a glide; everything else"). | Finish or trim the sentence. |
| B5 | Nit | The Renovate note says "The site and the editors use it free"; no editor imports GSAP today. | Say "the site uses it free" until the editors do. |

Observed and accepted (not findings): a section whose top sits in the window's bottom 15% shows as an empty band until
it crosses the line (by design: the reveal margin); with a fine pointer, the game frame ignores the pointer during a glide
(Lenis's own `iframe { pointer-events: none }`), and the journey *the demo still plays right after a wheel* holds.

## Fix stage (2026-11-09, Sonnet high)

- **B1 fixed.** Two causes, both measured. (1) While Lenis glides it ignores the browser's scroll events and keeps
  writing the scroll position, so a jump made in that time was undone when the glide finished. (2) Find in page does not
  jump on this site: the page's `scroll-behavior: smooth` makes the browser animate it, and Lenis's next write cancels
  an animation before it has moved a pixel, so no position check can ever see it (`window.find` showed it: one scroll
  event with reduced motion, 47 with motion). The fix: `:root.lenis-smooth { scroll-behavior: auto }` in `tokens.css`
  (Lenis puts that class on `<html>` only during a glide, and its older stylesheet carried the same rule), so a jump
  during a glide is instant; and `smooth-scroll.ts` now runs Lenis's frame itself and, if the page is not where Lenis
  left it, calls Lenis's `reset` (ends the glide, writes nothing) before the next write. A unit test holds that `reset`
  still exists on Lenis. New journeys *a scrollTo* and *Find in page soon after a wheel notch holds*, at 50, 150, 400
  and 700 ms: both fail on the old code (the page ends at 300, where the wheel was sending it) and pass now; all 22
  motion journeys pass in Chromium (twice). Probe: Find 50 ms to 1.2 s after a notch always lands the heading 388 px
  from the top. Phone (iPhone 13): no Lenis, Find lands as before.
- **B2, B4, B5 fixed** in the plan's build log, the test's comment, `smooth-scroll.ts` and `renovate.json`. The progress
  tracker's Site table had its stage 5 row overwritten with this audit's text; it is back to Not started.
- **Left:** G1 (WebKit on the Mac) and B3 (the editors and the saving thread).

## For the Owner: GSAP in the paid apps

Not this PR's problem, but it decides the editors' motion. The licence page's plain-English summary (in the page's
markup) says GSAP is free "as long as end users are not charged a fee of any kind to use your product", and its terms
forbid "Competitive Products": "any software, tool, or service that enables users to create, edit, or manage animations
through a visual interface". The paid desktop and mobile apps charge a one-time fee and include the Sequence editor,
which edits animations visually. The website is fine. Before the editors import GSAP, either confirm with Webflow in
writing or do the editors' UI motion with the same tokens through CSS and the Web Animations API, which costs nothing and
needs no permission.

## The drunk grandma test

Could a drunk grandma tell what is happening and what to press? On the site, yes: the first screen is still, Make a game
is there at once, every link she tabs to is visible, the wheel feels like a softer version of her own, and a click shows
the next page at once with a 6 px settle she will not notice. The only snag is outside motion: in the try-it editor she
can build a level but cannot play it, and after a reload she has to find it again (B3).

## Not run

WebKit and Firefox (not installed in the container; G1). Real Find in page (the browser's find bar cannot be driven
headless; `window.find` stands in, which selects and scrolls the same way). A physical trackpad. The GPU runner and
parity (motion touches no game). Root `pnpm check` end to end (the build log lists failures that already exist on this
base: boundaries, source-names, style links, api-index). Playing the downloaded level in a local game.
