// The music player: imported tracks, one at a time, switched with a fade. It plays what the director picks into the music bus;
// it never makes a note. The context is a recording fake, so the fades are read off the gain's calls.
import { describe, expect, it, vi } from 'vitest'
import { createMusicPlayer } from '#src/features/synth/music-player.ts'
import type { Slot } from '#src/shared/audio.schema.ts'
import { type FakeContext, type FakeNode, fakeContext } from '#src/testing/fake-audio.ts'

const slot = (id: string, more: Partial<Slot> = {}): Slot => ({ id, mode: 'loop', volume: 0.5, ...more })

function setup(tracks: Record<string, string> = { calm: '/music/calm.ogg', chase: '/music/chase.ogg' }) {
  const context = fakeContext() as FakeContext & Record<string, unknown>
  context.decodeAudioData = vi.fn((bytes: ArrayBuffer) => Promise.resolve({ decoded: bytes.byteLength }))
  const output = (context.createGain as () => FakeNode)()
  const fetched: string[] = []
  const faults: string[] = []
  const player = createMusicPlayer({
    context: context as unknown as BaseAudioContext,
    output: output as unknown as AudioNode,
    tracks,
    load: (url) => {
      fetched.push(url)
      return Promise.resolve(new ArrayBuffer(4))
    },
    onFault: (message) => void faults.push(message),
  })
  const sources = () => context.nodes.filter((n) => n.kind === 'buffer')
  const gainOf = (source: FakeNode) => source.connections[0] as FakeNode
  const settle = async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve()
  }
  return { context, output, player, fetched, faults, sources, gainOf, settle }
}

describe('createMusicPlayer', () => {
  it('loads the slot’s track once, plays it into the music bus and fades it in', async () => {
    const { player, fetched, sources, gainOf, output, settle } = setup()
    player.play(slot('calm', { fade: 2 }))
    await settle()
    const [source] = sources()
    expect(fetched).toEqual(['/music/calm.ogg'])
    expect((source as unknown as { loop: boolean }).loop).toBe(true)
    expect(source?.calls).toEqual(['start 0'])
    const gain = gainOf(source as FakeNode)
    expect(gain.connections).toContain(output)
    expect(gain.params.gain?.calls).toEqual(['set 0 @0', 'lin 0.5 @2'])
    // Asked again for the same slot, it neither loads nor starts a second source.
    player.play(slot('calm', { fade: 2 }))
    await settle()
    expect(sources()).toHaveLength(1)
    expect(fetched).toHaveLength(1)
  })

  it('switches by fading the old track out while the new one fades in', async () => {
    const { player, context, sources, gainOf, settle } = setup()
    player.play(slot('calm'))
    await settle()
    context.currentTime = 10
    player.play(slot('chase', { fade: 1, volume: 0.8 }))
    await settle()
    const [calm, chase] = sources()
    const out = gainOf(calm as FakeNode).params.gain?.calls ?? []
    expect(out.slice(-2)).toEqual(['set 1 @10', 'lin 0 @11'])
    expect(calm?.calls).toContain('stop 11')
    expect(gainOf(chase as FakeNode).params.gain?.calls).toEqual(['set 0 @10', 'lin 0.8 @11'])
  })

  it('fades to silence when the game wants none', async () => {
    const { player, context, sources, gainOf, settle } = setup()
    player.play(slot('calm', { fade: 3 }))
    await settle()
    context.currentTime = 5
    player.play(null)
    expect(gainOf(sources()[0] as FakeNode).params.gain?.calls.slice(-1)).toEqual(['lin 0 @8'])
    expect(player.wanted()).toBeNull()
  })

  it('waits the slot’s delay before it sounds, and plays a once-track without looping', async () => {
    const { player, sources, settle } = setup()
    player.play(slot('calm', { mode: 'once', delay: 1.5 }))
    await settle()
    const [source] = sources()
    expect((source as unknown as { loop: boolean }).loop).toBe(false)
    expect(source?.calls).toEqual(['start 1.5'])
  })

  it('does not play a once-track again until the game wants something else, then wants it', async () => {
    const { player, sources, settle } = setup()
    const sting = slot('calm', { mode: 'once' })
    player.play(sting)
    await settle()
    ;(sources()[0] as unknown as { onended: () => void }).onended()
    player.play(sting)
    await settle()
    expect(sources()).toHaveLength(1)
    player.play(slot('chase'))
    await settle()
    player.play(sting)
    await settle()
    expect(sources()).toHaveLength(3)
  })

  it('plays a fallback through the radio filter when the slot’s own file is missing', async () => {
    const { player, sources, settle, context } = setup({ calm: '/music/calm.ogg' })
    player.play(slot('chase', { fallback: [{ sound: 'calm', volume: 0.5, filter: 'radio' }] }))
    await settle()
    const filters = context.nodes.filter((n) => n.kind === 'biquad')
    expect(filters).toHaveLength(2)
    expect(sources()).toHaveLength(1)
  })

  it('says so, once, when no file exists for a slot, and stays silent', async () => {
    const { player, sources, faults, settle } = setup({})
    player.play(slot('chase'))
    player.play(slot('chase'))
    await settle()
    expect(sources()).toHaveLength(0)
    expect(faults).toEqual(['There is no music file for “chase” yet. Put one in assets/music.'])
  })

  it('says so when a track will not load or decode, and keeps playing what it had', async () => {
    const { player, sources, faults, settle, context } = setup()
    player.play(slot('calm'))
    await settle()
    ;(context.decodeAudioData as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('bad'))
    player.play(slot('chase'))
    await settle()
    expect(sources()).toHaveLength(1)
    expect(faults[0]).toContain('chase')
  })

  it('skips a track that became unwanted while it loaded', async () => {
    const { player, sources, settle } = setup()
    player.play(slot('calm'))
    player.play(slot('chase'))
    await settle()
    expect(sources()).toHaveLength(1)
    expect(player.wanted()).toBe('chase')
  })

  it('stops everything on dispose', async () => {
    const { player, sources, settle } = setup()
    player.play(slot('calm'))
    await settle()
    player.dispose()
    expect(sources()[0]?.calls.some((c) => c.startsWith('stop'))).toBe(true)
  })
})
