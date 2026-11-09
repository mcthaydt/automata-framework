// base-3d's words through `t()`: the catalog src/messages/ui/en.json,
// compiled by Paraglide into src/paraglide, read by key. `main.ts` hands Paraglide's runtime to `defineGame`, so the
// runtime's `Locale` answers Paraglide's `getLocale` and `t` speaks the player's language. `t` throws on a key the
// catalog lacks; strings.test.ts keeps the copy's keys and the catalog's equal. Presentation.
import { createT } from '@automata/framework'
import * as messages from '../../paraglide/messages.js'

export const t = createT(messages)
