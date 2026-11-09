// The sounds: each file the game preloads exists as a valid short mono 16-bit WAV, each sound is mapped to a sim event, and
// the committed files are exactly what scripts/make-sounds.ts writes (it is deterministic).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@automata/framework', async (original) => ({
  ...(await original<typeof import('@automata/framework')>()),
  startGame: () => {},
}))
const { base3d } = await import('../../main.ts')

const sounds = join(import.meta.dirname, '..', '..', 'public', 'sounds')

describe('the sounds', () => {
  it('maps the ember, the goal, the fall and the roll to files that are preloaded', () => {
    expect(Object.keys(base3d.sounds ?? {}).sort()).toEqual([
      'ember.taken',
      'goal.reached',
      'hero.fell',
      'hero.rolled',
    ])
    for (const entry of Object.values(base3d.sounds ?? {})) {
      const path = typeof entry === 'string' ? entry : entry.alias
      expect(base3d.preload).toContain(path)
    }
  })

  it('are short mono 16-bit WAV files', () => {
    for (const name of ['ember', 'goal', 'roll', 'fall']) {
      const file = readFileSync(join(sounds, `${name}.wav`))
      expect(file.subarray(0, 4).toString()).toBe('RIFF')
      expect(file.subarray(8, 12).toString()).toBe('WAVE')
      expect(file.readUInt16LE(22)).toBe(1)
      expect(file.readUInt16LE(34)).toBe(16)
      const seconds = file.readUInt32LE(40) / file.readUInt32LE(28)
      expect(seconds).toBeGreaterThan(0.1)
      expect(seconds).toBeLessThan(1)
    }
  })

  it('are what the script writes', () => {
    const out = mkdtempSync(join(tmpdir(), 'b3-sounds-'))
    // The script writes beside itself; run a copy of it with its output directory redirected.
    const script = readFileSync(join(import.meta.dirname, '..', '..', 'scripts', 'make-sounds.ts'), 'utf8')
    const copy = join(out, 'scripts')
    execFileSync('mkdir', ['-p', copy])
    execFileSync('cp', [join(import.meta.dirname, '..', '..', 'scripts', 'make-sounds.ts'), copy])
    expect(script.length).toBeGreaterThan(0)
    execFileSync(process.execPath, [join(copy, 'make-sounds.ts')])
    for (const name of ['ember', 'goal', 'roll', 'fall'])
      expect(
        readFileSync(join(out, 'public', 'sounds', `${name}.wav`)).equals(
          readFileSync(join(sounds, `${name}.wav`)),
        ),
      ).toBe(true)
  })
})
