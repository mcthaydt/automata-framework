import type { ContentAnimation } from '@automata/content/level-2d'
import { describe, expect, it } from 'vitest'
import {
  addClip,
  addFrame,
  animationModel,
  frameCount,
  newAnimation,
  removeClip,
  removeLastFrame,
  renameClip,
  setFps,
  setFrameSize,
  setLoop,
} from '#src/features/characters/animation-model.ts'

const hero = (): ContentAnimation => newAnimation('assets/hero.png', { w: 16, h: 24 })

describe('frameCount', () => {
  it('is the cells the frame size cuts the picture into', () => {
    expect(frameCount({ w: 16, h: 24 }, { w: 64, h: 24 })).toBe(4)
    expect(frameCount({ w: 16, h: 24 }, { w: 64, h: 48 })).toBe(8)
  })
  it('is 0 while the picture’s size is not known, and for a frame bigger than the picture', () => {
    expect(frameCount({ w: 16, h: 24 }, undefined)).toBe(0)
    expect(frameCount({ w: 16, h: 24 }, { w: 8, h: 8 })).toBe(0)
  })
})

describe('animationModel', () => {
  it('says how many frames the picture has and flags a clip that uses one it lacks', () => {
    const animation = addFrame(addFrame(hero(), 'idle', 6), 'idle', 1)
    const { frames, clips } = animationModel(animation, { w: 64, h: 24 })
    expect(frames).toBe(4)
    expect(clips[0]?.problem).toBe('This clip uses frame 6, but the picture has 4.')
  })
  it('has no frames and no clips for a character with no animation', () => {
    expect(animationModel(undefined, undefined)).toEqual({ frames: 0, clips: [] })
  })
})

describe('the edits', () => {
  it('start an animation with one clip, "idle", on frame 0, then name the next "clip 2", "clip 3"', () => {
    const one = hero()
    expect(one.clips).toEqual([{ id: 'idle', frames: [0], fps: 8, loop: true }])
    const three = addClip(addClip(one))
    expect(three.clips.map((clip) => clip.id)).toEqual(['idle', 'clip 2', 'clip 3'])
  })
  it('add frames in the order they are tapped and take the last one back, never leaving a clip empty', () => {
    const tapped = addFrame(addFrame(hero(), 'idle', 2), 'idle', 1)
    expect(tapped.clips[0]?.frames).toEqual([0, 2, 1])
    const back = removeLastFrame(removeLastFrame(removeLastFrame(tapped, 'idle'), 'idle'), 'idle')
    expect(back.clips[0]?.frames).toEqual([0])
  })
  it('set the speed within 1 to 60 and whether the clip repeats', () => {
    expect(setFps(hero(), 'idle', 12).clips[0]?.fps).toBe(12)
    expect(setFps(hero(), 'idle', 0).clips[0]?.fps).toBe(1)
    expect(setFps(hero(), 'idle', 600).clips[0]?.fps).toBe(60)
    expect(setLoop(hero(), 'idle', false).clips[0]?.loop).toBe(false)
  })
  it('rename a clip, refusing a name another clip has in a sentence', () => {
    const two = addClip(hero())
    expect(renameClip(two, 'clip 2', 'run').clips.map((clip) => clip.id)).toEqual(['idle', 'run'])
    expect(() => renameClip(two, 'clip 2', 'idle')).toThrow('Two clips are called "idle".')
    expect(() => renameClip(two, 'clip 2', '  ')).toThrow('A clip needs a name.')
  })
  it('remove a clip, and removing the last one removes the animation', () => {
    expect(removeClip(addClip(hero()), 'idle')?.clips.map((clip) => clip.id)).toEqual(['clip 2'])
    expect(removeClip(hero(), 'idle')).toBeUndefined()
  })
  it('change the frame size, which is a whole number of pixels', () => {
    expect(setFrameSize(hero(), { w: 8, h: 12 }).frame).toEqual({ w: 8, h: 12 })
    expect(() => setFrameSize(hero(), { w: 0, h: 12 })).toThrow('A frame is at least 1 px each way.')
  })
})
