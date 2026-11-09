/**
 * SvelteKit's inline script at the end of every prerendered page imports the app (a chain of about 30 small modules) and
 * hydrates it the moment the script runs, which is before the first paint on a fast host. Lighthouse charges the paint
 * with every request that finished before it, so the Owner's Mac, which finishes the whole chain in 70 ms and paints at
 * 90, measured 350 KB as needed for text that was already in the HTML (the home page 3.2 s, /docs 2.1 s, /examples 3.0
 * s, against 1.7 to 2.1 s on a host that paints first). This starts the imports once the browser has reported the first
 * contentful paint, which is the order a phone on a mobile link gets anyway, so every host measures the same page.
 * Nothing the reader sees changes: the text, links and pictures are in the HTML, and hydration begins a frame or so
 * later on a fast link and exactly when it did on a slow one.
 */

/** The longest hydration waits for a paint report: a tab nobody looks at never paints. */
export const FALLBACK_MS = 3000

/**
 * Written into the page ahead of the script's imports. It starts `start` once: when the first contentful paint is
 * reported (already-reported paints are delivered too), when the tab's visibility changes, on the visitor's first
 * press, or after FALLBACK_MS. A browser that does not report paint timing starts at once, as SvelteKit does.
 *
 * A press on a `[data-play]` control marks `<html data-play-pressed>`: the page is prerendered, so its Play button is
 * there before the script that answers it, and the press itself would be lost. The demo reads the mark when it mounts
 * and starts, so the visitor presses once. The listeners stay until the demo mounts (and says so with
 * `data-play-mounted`), so a visitor who scrolls or taps elsewhere first, which starts the app but does not mount the
 * demo, still has the press on Play it kept.
 */
export const AFTER_FIRST_PAINT = `const afterFirstPaint = start => {
\t\t\t\t\t\tlet started = false;
\t\t\t\t\t\tconst go = () => { if (!started) { started = true; start(); } };
\t\t\t\t\t\tif (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes?.includes("paint")) {
\t\t\t\t\t\t\tnew PerformanceObserver((list, observer) => {
\t\t\t\t\t\t\t\tif (list.getEntriesByName("first-contentful-paint").length) { observer.disconnect(); go(); }
\t\t\t\t\t\t\t}).observe({ type: "paint", buffered: true });
\t\t\t\t\t\t\tdocument.addEventListener("visibilitychange", go, { once: true });
\t\t\t\t\t\t\tconst press = event => {
\t\t\t\t\t\t\t\tconst root = document.documentElement;
\t\t\t\t\t\t\t\tif (!("playMounted" in root.dataset) && event.target?.closest?.("[data-play]")) root.dataset.playPressed = "";
\t\t\t\t\t\t\t\tgo();
\t\t\t\t\t\t\t};
\t\t\t\t\t\t\tdocument.addEventListener("pointerdown", press, { capture: true });
\t\t\t\t\t\t\tdocument.addEventListener("keydown", press, { capture: true });
\t\t\t\t\t\t\tsetTimeout(go, ${FALLBACK_MS});
\t\t\t\t\t\t} else go();
\t\t\t\t\t};`

const SCRIPT = /(<script>)([\s\S]*?)(<\/script>)/g
/** The statement that loads and starts the app, as SvelteKit writes it: both entry modules, then `.then(`. */
const HYDRATION =
  /Promise\.all\(\[\s*import\("[^"]*\/entry\/start\.[^"]*"\),\s*import\("[^"]*\/entry\/app\.[^"]*"\)\s*\]\)\.then\(/
/**
 * The end of that statement: the script's last `});`, then the block's closing brace. Page data never ends a script. A
 * wrapped script ends `}));`, which this does not match, so a page is never wrapped twice.
 */
const HYDRATION_END = /\}\);(\s*\}\s*)$/

/** Starts the hydration of every page that has SvelteKit's start script after the first paint, and leaves the rest as it is. */
export function hydrateAfterFirstPaint(html: string): string {
  return html.replace(SCRIPT, (whole, open: string, body: string, close: string) => {
    if (!HYDRATION.test(body) || !HYDRATION_END.test(body)) return whole
    const deferred = body
      .replace(HYDRATION, (call) => `${AFTER_FIRST_PAINT}\n\n\t\t\t\t\tafterFirstPaint(() => ${call}`)
      .replace(HYDRATION_END, '}));$1')
    return open + deferred + close
  })
}
