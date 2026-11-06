// consumer-smoke's bundle step: a page importing the sim, the host and one ui component, built
// by Vite as a game would. run.ts then checks the output has no eval from AF and one copy of Ruken's SDK.

import { Dialog } from '@mcthaydt/automata'
import { createHosting } from '@mcthaydt/automata/target'
import { createSim } from '@mcthaydt/automata-sim'
import { mount } from 'svelte'

const app = document.getElementById('app') as HTMLElement
mount(Dialog, { target: app, props: { title: 'Hello', onclose: () => {} } })
const sim = await createSim({ seed: 1, plugins: [] })
console.log(sim.hash(), typeof createHosting)
