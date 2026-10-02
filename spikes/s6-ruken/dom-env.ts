import type { RukenEnv } from './protocol'

/** RukenEnv backed by the real window (used by the two-origin browser check). */
export function domEnv(): RukenEnv {
  return {
    isTopLevel: window.parent === window,
    parent: window.parent,
    gameOrigin: location.origin,
    postToParent: (msg) => window.parent.postMessage(msg, '*'),
    addMessageListener: (fn) => {
      const handler = (ev: MessageEvent) =>
        fn({ data: ev.data, origin: ev.origin, source: ev.source, ports: [...ev.ports] })
      window.addEventListener('message', handler)
      return () => window.removeEventListener('message', handler)
    },
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id as number),
    localStorage: window.localStorage,
  }
}
