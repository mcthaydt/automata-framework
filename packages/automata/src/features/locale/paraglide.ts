// Paraglide's compiled messages, answering in the `Locale` service's locale.
// Extracted from FloorFifty apps/client/src/i18n/strategy.ts (ac72660), which defined a custom client
// strategy reading the settings store. Here the generated runtime's `getLocale` and `setLocale` are replaced
// outright: Paraglide's own strategies (cookie, localStorage, URL, reload) never run, so the locale comes only
// from negotiation over the host (Hosting.locale) and a change never reloads the page.
//
// The runtime depends on Paraglide's generated code structurally: a game passes its own `paraglide/runtime.js`.

/** The parts of a Paraglide-generated `runtime.js` the runtime uses. Method syntax, so a narrower `Locale` union fits. */
export interface ParaglideRuntime {
  readonly locales: readonly string[]
  readonly baseLocale: string
  overwriteGetLocale(fn: () => string): void
  overwriteSetLocale(fn: (locale: string) => void): void
}

/** Where the bound messages read and write the locale; the `Locale` service in a running game. */
export interface LocaleSource {
  current(): string
  set(locale: string): void
}

export function bindParaglide(runtime: ParaglideRuntime, source: LocaleSource): void {
  runtime.overwriteGetLocale(() => source.current())
  runtime.overwriteSetLocale((locale) => source.set(locale))
}

/** One compiled message: Paraglide passes its inputs as one object. */
// biome-ignore lint/suspicious/noExplicitAny: inputs vary per message; `createT` recovers each one's type.
export type MessageFunction = (inputs?: any) => string

/** A message's inputs as `t`'s rest arguments: none, optional or required. Paraglide's second (options) argument is left out. */
type InputsOf<M> = M extends (...args: infer P) => string
  ? P extends []
    ? []
    : P extends [infer I, ...unknown[]]
      ? [inputs: I]
      : P extends [(infer I)?, ...unknown[]]
        ? [inputs?: I]
        : []
  : never

/** The typed `t` verb: `t('hello', { name })`, checked against the game's compiled messages. */
export type Translate<Messages> = <K extends keyof Messages & string>(
  key: K,
  ...inputs: InputsOf<Messages[K]>
) => string

/**
 * `t` over a messages module (`import * as m from './paraglide/messages.js'`). Each call reads the current
 * locale, so a screen that calls `t` again after `'locale.changed'` shows the new language without a remount.
 * An unknown key throws, naming it: the types already forbid it, so it means the catalog and the code drifted.
 */
export function createT<Messages extends Record<string, unknown>>(messages: Messages): Translate<Messages> {
  return (key, ...inputs) => {
    const message = messages[key]
    if (typeof message !== 'function') throw new Error(`t: no message '${key}' in the compiled catalog`)
    return (message as MessageFunction)(inputs[0])
  }
}
