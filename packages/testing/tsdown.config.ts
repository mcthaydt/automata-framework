import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// The published build (M2.4 spec §3.4). Host types come from `@mcthaydt/automata-host` (DIST spec §5).
// M2.3's `./sim`, `./sim/commands` and `./sim/property` entries are built here too (M2.4 spec §3.1).
export default publishedBuild(import.meta.url, {
  entry: {
    index: 'src/index.ts',
    'sim/index': 'src/sim/index.ts',
    'sim/commands': 'src/sim/commands.ts',
    'sim/property': 'src/sim/property.ts',
    'input/fake-gamepads': 'src/input/fake-gamepads.ts',
    'host/index': 'src/host/index.ts',
    'e2e/index': 'src/e2e/index.ts',
  },
  platform: 'browser',
})
