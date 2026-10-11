// M2.2 spec §3.3: a game types its sim content with one cast, `ctx.content as SimContentData`, and that cast
// is local to the file that writes it. This compiles a real fixture and runs TypeScript over three files in
// one program: a system that reads its rooms, one that reads a kind the sim does not receive, and one that
// calls `createSim` with hand-written content, which must keep compiling.

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Effect } from 'effect'
import { expect, it } from 'vitest'
import { buildContent } from '../compile/write-outputs'
import { copyFixture, simRoomsOptions } from '../testing/fixture-game'

const SRC = join(import.meta.dirname, '..')
const REPO = join(import.meta.dirname, '../../../..')

it('types sim content through one cast, without touching other code in the program', async () => {
  const root = copyFixture('sim-rooms')
  await Effect.runPromise(buildContent(simRoomsOptions(root)))
  writeFileSync(
    join(root, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        types: ['node'],
        typeRoots: [join(SRC, '../node_modules/@types')],
        paths: {
          '@mcthaydt/automata-content': [join(SRC, 'index.ts')],
          '@mcthaydt/automata-sim': [join(REPO, 'packages/sim/src/index.ts')],
        },
      },
      include: ['*.ts', 'content/generated/content.d.ts'],
    }),
  )
  const system = (name: string, body: string): string =>
    [
      "import { defineSystem } from '@mcthaydt/automata-sim'",
      "import type { SimContentData } from 'virtual:automata/content'",
      `export const ${name} = defineSystem({`,
      `  name: '${name}',`,
      "  phase: 'gameplay',",
      '  run(ctx) {',
      '    const content = ctx.content as SimContentData',
      `    ${body}`,
      '  },',
      '})',
      '',
    ].join('\n')
  writeFileSync(
    join(root, 'uses.ts'),
    system('uses', "const rows: readonly string[] = content.room['room-1'].rows; void rows"),
  )
  writeFileSync(join(root, 'bad.ts'), system('bad', 'void content.palette'))
  writeFileSync(
    join(root, 'other.ts'),
    "import { createSim } from '@mcthaydt/automata-sim'\nexport const sim = createSim({ seed: 1, plugins: [], content: { room: 1 } })\n",
  )

  let output = ''
  try {
    execFileSync(join(REPO, 'node_modules/.bin/tsc'), ['-p', '.'], { cwd: root, encoding: 'utf8' })
  } catch (error) {
    output = String((error as { stdout?: string }).stdout)
  }
  const errors = output.split('\n').filter((line) => /error TS\d+/.test(line))
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatch(
    /^bad\.ts\(\d+,\d+\): error TS2339: Property 'palette' does not exist on type 'SimContentData'/,
  )
}, 60_000)
