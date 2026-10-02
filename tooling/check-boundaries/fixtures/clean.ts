// Must produce no findings. Mentions of Math.random, Date and window in comments are fine.
import type { Thing } from 'anything-type-only'
import { z } from 'zod'
import { local } from './local'

const label = 'Math.random() and Date.now() inside a string are fine'
const obj = { window: 1, document: 2 } // property keys, not references
obj.window = 3 // member property, not a reference
const exact = Math.sqrt(2) + Math.fround(0.1) + Math.imul(3, 4) + Math.max(1, 2) + Math.round(1.5)
const asType = obj as unknown as Thing
const squared = exact * exact

export { asType, label, local, squared, z }
