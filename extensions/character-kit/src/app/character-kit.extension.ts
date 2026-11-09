// The character kit: the clothes, hairstyles and seats core's figures leave out. Add it to a game's `extensions`
// after `figures` and a figure can wear a skirt, an apron or a coat, a style can carry a bun, rows or a ponytail, and a
// seat is a content file. Without it a figure naming a skirt is refused ("a garment has one of: …" when the figure file
// compiles, "No garment called skirt is registered" when one is dressed), and a style naming a bun is refused the same way.
//
// An extension has no setup hook, so the kinds register when the files below load: loading this file is what adds them.

import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import '../features/garments/register-wardrobe.ts'
import '../features/hair/register-hair.ts'
import { figureSeatContent } from '../features/seats/seat.content.ts'

export const characterKitExtension: ExtensionDef<'character-kit'> = defineExtension({
  name: 'character-kit',
  requires: ['figures'],
  content: [figureSeatContent],
})
