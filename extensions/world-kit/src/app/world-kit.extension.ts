// The world kit: ready-made props, furnished rooms, signs and generated maps for 3D worlds. Add it to a game's
// `extensions` after `3d` and a library preset can name a chair or a car, a room can say `dress = { as = "office" }`
// and `dressLevel` fills it, and `generateMap` makes an apartment or a block. Without it a preset naming a chair is
// reported ("unknown-generator") and a room that asks to be dressed is drawn bare with a note.
//
// An extension has no setup hook, so the generators register when the file below loads: loading this file adds them.
import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import { worldKitContent } from '../features/furnish/kit.content.ts'
import '../features/props/register-props.ts'

export const worldKitExtension: ExtensionDef<'world-kit'> = defineExtension({
  name: 'world-kit',
  requires: ['3d'],
  content: [worldKitContent],
})
