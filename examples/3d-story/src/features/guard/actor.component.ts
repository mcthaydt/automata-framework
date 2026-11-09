import { defineComponent } from '@automata/sim'

/**
 * A character the systems move, as the screen draws it: where its feet are on the floor (metres, y up), the way it
 * faces (radians, 0 toward +z and growing toward +x), whether it is walking and which of the behaviour file's characters
 * it is (its place in that file's list). The sim copies it from the character's place on the floor plan each tick;
 * nothing else writes it.
 */
export const Actor = defineComponent('actor', {
  x: 'f32',
  y: 'f32',
  z: 'f32',
  yaw: 'f32',
  walking: 'bool',
  index: 'u32',
})
