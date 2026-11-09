import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PACKAGE_ROOT, screenSources } from '#src/testing/copy-screens.ts'

// The screens rule over the screens' sources, using the framework's own checker (one contract owner): no `{@html}`, no platform chrome (a password field, a credential autocomplete, the host's name,
// sign-in or payment wording). The planted cases show the checker would catch them in these screens.

interface Finding {
  readonly rule: string
  readonly message: string
}
type CheckSvelte = (file: string, code: string) => Finding[]

async function checker(): Promise<CheckSvelte> {
  const file = join(PACKAGE_ROOT, '..', '..', 'tooling', 'check-style', 'src', 'svelte.ts')
  const loaded: { checkSvelte: CheckSvelte } = await import(pathToFileURL(file).href)
  return loaded.checkSvelte
}

describe('the screens rule', () => {
  it('finds nothing in the screens’ sources', async () => {
    const check = await checker()
    expect(
      screenSources().flatMap(({ from, text }) =>
        check(from, text).map((f) => `${from}: ${f.rule}: ${f.message}`),
      ),
    ).toEqual([])
  })

  it('would catch {@html} and platform chrome if one were added', async () => {
    const check = await checker()
    const planted = '<p>{@html "<b>x</b>"}</p><input type="password" /><p>Sign in</p>'
    expect(new Set(check('planted.svelte', planted).map((f) => f.rule))).toEqual(
      new Set(['no-html', 'platform-chrome']),
    )
  })
})
