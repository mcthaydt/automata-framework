import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import { type MountedFixture, mountFixture, settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import LayersPanel from '#src/features/level/LayersPanel.svelte'
import type { LayerDef } from '#src/shared/level-2d/model/project-types.ts'

// The layer list in the 264 px column the iPad gives the panel, beside its two 44 px buttons: what a layer holds is
// read whole on a second line, never cut to "Tiles that pla…" (editors v2 build audit, F9).

const layer = (id: string, label: string, kind: LayerDef['kind']) => ({ id, label, kind }) as LayerDef
const LAYERS = [
  layer('props', 'Props', 'entities'),
  layer('solid', 'Solid', 'intgrid'),
  layer('look', 'Look', 'auto'),
  layer('ground', 'Ground', 'tiles'),
]

let mounted: MountedFixture | undefined
afterEach(async () => {
  await mounted?.unmount()
  mounted = undefined
})

describe('the layer list in a narrow column', () => {
  test('says what each layer holds in full', async () => {
    await page.viewport(1194, 834)
    const column = document.body.appendChild(document.createElement('div'))
    column.style.width = '264px'
    mounted = mountFixture(
      LayersPanel,
      {
        layers: LAYERS,
        current: 'props',
        hidden: new Set<string>(),
        locked: new Set<string>(),
        onselect: () => {},
        onhidden: () => {},
        onlocked: () => {},
      },
      column,
    )
    await settleLayout()
    const kinds = [...document.querySelectorAll<HTMLElement>('.kind')]
    expect(kinds.map((kind) => kind.textContent)).toEqual([
      'Characters and items',
      'Walls and floors',
      'Tiles that place themselves',
      'Tiles',
    ])
    for (const kind of kinds) {
      expect(kind.scrollWidth, kind.textContent ?? '').toBeLessThanOrEqual(kind.clientWidth + 1)
      expect(kind.getBoundingClientRect().right).toBeLessThanOrEqual(column.getBoundingClientRect().right)
    }
    column.remove()
  })
})
