// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { AFTER_FIRST_PAINT, FALLBACK_MS, hydrateAfterFirstPaint } from '#src/shared/html/hydration.ts'

// QB.3j. The first Mac run of QB.3j's code measured the pages at 2.57 to 3.01 s where the hosted runner and a quiet
// container measure 1.7 to 2.1 s, to the millisecond on two runs, whatever else the Mac was doing. Lighthouse simulates
// the slow phone from what the browser did, and it charges the first paint with every request that finished before the
// paint. SvelteKit starts hydration, a chain of about 30 small module requests, as soon as its inline script runs. On a
// host fast enough to finish that chain before the first paint (the Mac, from a local server: everything is done in 70
// ms, the paint comes at 90) the simulation counts all of it, 350 KB, as needed to paint text that was already in the
// HTML. A container reproduces the Mac's numbers when the stylesheet is held back 400 ms: 3.18 s on the home page,
// 2.11 s on /docs, 2.6 s on /start, 2.9 s on /examples. The cure is the order a mobile browser would have anyway: the
// page paints, then it hydrates.

/** The inline script SvelteKit 2.16 writes at the end of every prerendered page (tabs as in the build). */
const START = `<script>
\t\t\t\t{
\t\t\t\t\t__sveltekit_8ja7bm = {
\t\t\t\t\t\tbase: new URL(".", location).pathname.slice(0, -1)
\t\t\t\t\t};

\t\t\t\t\tconst element = document.currentScript.parentElement;

\t\t\t\t\tPromise.all([
\t\t\t\t\t\timport("./_app/immutable/entry/start.jY8BrUgD.js"),
\t\t\t\t\t\timport("./_app/immutable/entry/app.D5VQ2W4f.js")
\t\t\t\t\t]).then(([kit, app]) => {
\t\t\t\t\t\tkit.start(app, element, {
\t\t\t\t\t\t\tnode_ids: [0, 12],
\t\t\t\t\t\t\tdata: [null,null],
\t\t\t\t\t\t\tform: null,
\t\t\t\t\t\t\terror: null
\t\t\t\t\t\t});
\t\t\t\t\t});
\t\t\t\t}
\t\t\t</script>`
const page = (script: string) =>
  `<!doctype html><html><head><title>x</title></head><body><div style="display: contents"><p>text</p>\n\t\t\t${script}\n\t\t</div></body></html>`

describe('hydrateAfterFirstPaint', () => {
  it('starts the hydration imports from a function that waits for the first paint, and nothing else changes', () => {
    const out = hydrateAfterFirstPaint(page(START))
    expect(out).toContain('afterFirstPaint(() => Promise.all([')
    expect(out).toContain('import("./_app/immutable/entry/start.jY8BrUgD.js")')
    expect(out).toContain('import("./_app/immutable/entry/app.D5VQ2W4f.js")')
    expect(out).toContain('node_ids: [0, 12]')
    expect(out).toContain('<p>text</p>')
    expect(out).toMatch(/\}\)\);\s*\}\s*<\/script>/)
  })

  it('reads the element the script sits in at once, since document.currentScript is gone after the script has run', () => {
    const out = hydrateAfterFirstPaint(page(START))
    expect(out.indexOf('const element = document.currentScript.parentElement;')).toBeLessThan(
      out.indexOf('afterFirstPaint(() =>'),
    )
  })

  it('defines the helper before it is used, inside the same block', () => {
    const out = hydrateAfterFirstPaint(page(START))
    expect(out.indexOf('const afterFirstPaint =')).toBeGreaterThan(out.indexOf('__sveltekit_8ja7bm'))
    expect(out.indexOf('const afterFirstPaint =')).toBeLessThan(out.indexOf('afterFirstPaint(() =>'))
    expect(out.match(/const afterFirstPaint =/g)).toHaveLength(1)
  })

  it('produces script text that parses', () => {
    const body = /<script>([\s\S]*)<\/script>/.exec(hydrateAfterFirstPaint(page(START)))![1]!
    expect(() => new Function(body)).not.toThrow()
  })

  it('does it once: a page that is already wrapped comes back unchanged', () => {
    const once = hydrateAfterFirstPaint(page(START))
    expect(hydrateAfterFirstPaint(once)).toBe(once)
  })

  it('leaves a page without the start script alone, and other inline scripts, and the empty string', () => {
    const other = page('<script>window.x = Promise.all([import("./a.js")]).then(() => {});</script>')
    expect(hydrateAfterFirstPaint(other)).toBe(other)
    // Another block script that happens to end like the start script does.
    const sameEnding = page(
      '<script>\n\t{\n\t\twindow.addEventListener("load", () => {\n\t\t});\n\t}\n</script>',
    )
    expect(hydrateAfterFirstPaint(sameEnding)).toBe(sameEnding)
    const noScript = '<!doctype html><title>x</title><p>no script</p>'
    expect(hydrateAfterFirstPaint(noScript)).toBe(noScript)
    expect(hydrateAfterFirstPaint('')).toBe('')
  })

  it('works on a nested page, where the module paths climb out of the folder', () => {
    const nested = START.replaceAll('"./_app', '"../_app')
    const out = hydrateAfterFirstPaint(page(nested))
    expect(out).toContain('afterFirstPaint(() => Promise.all([')
    expect(out).toContain('import("../_app/immutable/entry/start.jY8BrUgD.js")')
  })

  it('does not end at a closing "});" inside the page data', () => {
    const tricky = START.replace('data: [null,null]', 'data: [{"type":"data","text":"});"}]')
    const out = hydrateAfterFirstPaint(page(tricky))
    expect(out).toContain('"text":"});"')
    expect(() => new Function(/<script>([\s\S]*)<\/script>/.exec(out)![1]!)).not.toThrow()
  })
})

describe('afterFirstPaint (the helper inside the page)', () => {
  type Entries = { getEntriesByName(name: string): unknown[] }
  /** A fake browser: the paint observer, the document and the timers, each under the test's control. */
  function browser(options: { paint?: boolean } = {}) {
    const listeners: Record<string, (event?: unknown) => void> = {}
    const listenerOptions: Record<string, unknown> = {}
    const state: {
      callback?: (list: Entries, observer: { disconnect(): void }) => void
      disconnected: number
      observed?: unknown
    } = { disconnected: 0 }
    class FakeObserver {
      static supportedEntryTypes = options.paint === false ? ['resource'] : ['paint', 'resource']
      constructor(callback: typeof state.callback) {
        state.callback = callback
      }
      observe(init: unknown) {
        state.observed = init
      }
      disconnect() {
        state.disconnected++
      }
    }
    const document = {
      documentElement: { dataset: {} as Record<string, string> },
      addEventListener: (type: string, listener: (event?: unknown) => void, options?: unknown) => {
        listeners[type] = listener
        listenerOptions[type] = options
      },
    }
    const setTimer = vi.fn((callback: () => void, delay: number) => {
      timers.push({ callback, delay })
    })
    const timers: { callback: () => void; delay: number }[] = []
    const make = new Function(
      'PerformanceObserver',
      'document',
      'setTimeout',
      `${AFTER_FIRST_PAINT}; return afterFirstPaint`,
    )
    const afterFirstPaint = make(FakeObserver, document, setTimer) as (start: () => void) => void
    const paint = (name: string) =>
      state.callback!(
        { getEntriesByName: (n) => (n === name ? [{}] : []) },
        { disconnect: () => state.disconnected++ },
      )
    return { afterFirstPaint, state, listeners, listenerOptions, timers, paint, document }
  }

  it('does not start before the browser reports the first contentful paint, then starts once', () => {
    const { afterFirstPaint, paint, state } = browser()
    const start = vi.fn()
    afterFirstPaint(start)
    expect(start).not.toHaveBeenCalled()
    expect(state.observed).toEqual({ type: 'paint', buffered: true })
    paint('first-paint')
    expect(start).not.toHaveBeenCalled()
    paint('first-contentful-paint')
    paint('first-contentful-paint')
    expect(start).toHaveBeenCalledTimes(1)
    expect(state.disconnected).toBeGreaterThan(0)
  })

  it('starts when the tab changes visibility, since a tab nobody looks at never paints', () => {
    const { afterFirstPaint, listeners, listenerOptions } = browser()
    const start = vi.fn()
    afterFirstPaint(start)
    expect(listenerOptions.visibilitychange, 'the listener removes itself after it has run').toEqual({
      once: true,
    })
    listeners.visibilitychange!()
    listeners.visibilitychange!()
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('the deferred start also begins on the first pointerdown or keydown', () => {
    for (const type of ['pointerdown', 'keydown']) {
      const { afterFirstPaint, listeners, listenerOptions } = browser()
      const start = vi.fn()
      afterFirstPaint(start)
      expect(listenerOptions[type], `${type} listens before the page's own handlers`).toEqual({
        capture: true,
      })
      expect(start).not.toHaveBeenCalled()
      listeners[type]!({ target: { closest: () => null } })
      listeners[type]!({ target: { closest: () => null } })
      expect(start).toHaveBeenCalledTimes(1)
    }
  })

  it('a press on [data-play] before hydration sets data-play-pressed, and any other press does not', () => {
    const playButton = { closest: (selector: string) => (selector === '[data-play]' ? {} : null) }
    for (const type of ['pointerdown', 'keydown']) {
      const pressed = browser()
      pressed.afterFirstPaint(vi.fn())
      pressed.listeners[type]!({ target: playButton })
      expect(pressed.document.documentElement.dataset.playPressed).toBe('')
      const elsewhere = browser()
      elsewhere.afterFirstPaint(vi.fn())
      elsewhere.listeners[type]!({ target: { closest: () => null } })
      expect(elsewhere.document.documentElement.dataset.playPressed).toBeUndefined()
    }
  })

  it('keeps listening after a first press elsewhere, so a later press on [data-play] is still kept', () => {
    const playButton = { closest: (selector: string) => (selector === '[data-play]' ? {} : null) }
    const view = browser()
    const start = vi.fn()
    view.afterFirstPaint(start)
    view.listeners.pointerdown!({ target: { closest: () => null } })
    expect(view.document.documentElement.dataset.playPressed).toBeUndefined()
    view.listeners.pointerdown!({ target: playButton })
    expect(view.document.documentElement.dataset.playPressed).toBe('')
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('stops marking presses once the demo has mounted', () => {
    const playButton = { closest: (selector: string) => (selector === '[data-play]' ? {} : null) }
    const view = browser()
    view.afterFirstPaint(vi.fn())
    view.document.documentElement.dataset.playMounted = ''
    view.listeners.pointerdown!({ target: playButton })
    expect(view.document.documentElement.dataset.playPressed).toBeUndefined()
  })

  it('starts after the fallback delay if no paint is ever reported', () => {
    const { afterFirstPaint, timers, paint } = browser()
    const start = vi.fn()
    afterFirstPaint(start)
    expect(timers.map((timer) => timer.delay)).toEqual([FALLBACK_MS])
    timers[0]!.callback()
    expect(start).toHaveBeenCalledTimes(1)
    paint('first-contentful-paint')
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('starts at once in a browser that does not report paint timing, as before', () => {
    const { afterFirstPaint, timers } = browser({ paint: false })
    const start = vi.fn()
    afterFirstPaint(start)
    expect(start).toHaveBeenCalledTimes(1)
    expect(timers).toEqual([])
  })

  it('starts at once in a browser with no PerformanceObserver at all', () => {
    const make = new Function(
      'PerformanceObserver',
      'document',
      'setTimeout',
      `${AFTER_FIRST_PAINT}; return afterFirstPaint`,
    )
    const afterFirstPaint = make(undefined, { addEventListener() {} }, () => {}) as (
      start: () => void,
    ) => void
    const start = vi.fn()
    afterFirstPaint(start)
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('waits at most three seconds', () => {
    expect(FALLBACK_MS).toBe(3000)
  })
})
