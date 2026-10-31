// The puzzle extension (M6 spec §4.5): the plugin and the `puzzle` content kind built from one set of options, so the
// calls the plugin runs are exactly the calls content may name.
import { expect, it } from 'vitest'
import { puzzleExtension } from './index'
import { TOY } from './testing/toy-room'

const extensions = ['systems', 'cutscenes', 'narrative']

it('registers the puzzle plugin and the puzzle content kind', () => {
  const extension = puzzleExtension({ extensions })
  expect(extension.name).toBe('puzzle')
  expect(extension.sim?.map((plugin) => plugin.name)).toEqual(['puzzle'])
  expect(extension.content?.map((kind) => kind.kind)).toEqual(['puzzle'])
})

it('lets content name exactly the calls the plugin was given', () => {
  const accepts = (extension: ReturnType<typeof puzzleExtension>) =>
    extension.content?.[0]?.schema.safeParse(TOY).success
  expect(accepts(puzzleExtension({ calls: { glow: () => {} }, extensions }))).toBe(true)
  expect(accepts(puzzleExtension({ extensions }))).toBe(false)
})
