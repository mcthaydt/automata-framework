// `vitest/browser` (loaded by the browser-mode tests) declares `toHaveTextContent(string | number)`, which shadows
// jest-dom's `(string | RegExp)` for the jsdom tests when one program holds both. This puts the RegExp form back.
import 'vitest'

declare module 'vitest' {
  interface Assertion<T = any> {
    toHaveTextContent(text: string | RegExp, options?: { normalizeWhitespace: boolean }): T
  }
}
