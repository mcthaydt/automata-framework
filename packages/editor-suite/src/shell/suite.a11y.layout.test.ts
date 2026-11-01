import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import '../main.css'
import { SIZES } from '@mcthaydt/automata-editor-kit/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { axeViolations } from '../testing/a11y'
import { EDITOR_CASES, type OpenSuite, openCase } from '../testing/editor-cases'

// An accessibility pass (axe-core) over the suite's Home and each 1.0 editor open in the one shell, in Chromium, WebKit
// and Firefox at the phone and the wide size (editor suite spec §12, plan EDS.10 step 2). Colour contrast is axe's
// blind spot over canvases and is the kit's own test; every other rule runs.

let opened: OpenSuite | undefined
afterEach(async () => {
  await opened?.handle.dispose()
  opened?.target.remove()
  opened = undefined
})

const SAMPLE_SIZES = SIZES.filter(
  (size) => size.name === 'phone-portrait' || size.name === 'ipad-pro-11-landscape',
)

describe.each(SAMPLE_SIZES)('Suite accessibility at $name ($width x $height)', (size) => {
  test.each(EDITOR_CASES)('$name has no axe violations', async (which) => {
    opened = await openCase(size, which)
    expect(await axeViolations(document.body)).toEqual([])
  })
})
