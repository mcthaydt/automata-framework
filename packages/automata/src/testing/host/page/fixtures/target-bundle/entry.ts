// The bundle check's entry: it imports the host exactly as the runtime's boot does (`app/boot/boot-program.ts`): the
// contract from `.`, the adapter from `./target`.

import { createHosting } from '@mcthaydt/automata/target'

void createHosting({ gameId: 'bundle-check', wants: ['saves'], pauseBehavior: 'pause' }).then((made) => {
  if (made.ok) {
    console.log(made.value.kind, made.value.hostName)
    made.value.dispose()
  }
})
