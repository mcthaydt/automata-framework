// consumer-smoke's bundle step (M2.4 spec §3.6): a page importing the sim, the host and one ui component, built
// by Vite as a game would. run.ts then checks the output has no eval from AF and one copy of Ruken's SDK.
import { HostingLive } from '@mcthaydt/automata-host'
import { createSim } from '@mcthaydt/automata-sim'
import { Dialog } from '@mcthaydt/automata-ui'
import { mount } from 'svelte'

const app = document.getElementById('app') as HTMLElement
mount(Dialog, { target: app, props: { title: 'Hello', onclose: () => {} } })
const sim = await createSim({ seed: 1, plugins: [] })
console.log(sim.hash(), typeof HostingLive)
