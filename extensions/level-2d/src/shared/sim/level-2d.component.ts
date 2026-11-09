import { type ComponentDef, defineComponent } from '@automata/sim'

const level2dAtFields = { x: 'f32', y: 'f32' } as const

/**
 * Where something stands in a 2D level, in the level's pixels. A game that already keeps a position of its own tells
 * `level2dPlaces` to use that; this is for a game that has none, so the places still have somewhere to read and write.
 */
export const Level2dAt: ComponentDef<typeof level2dAtFields> = defineComponent('level-2d.at', level2dAtFields)
