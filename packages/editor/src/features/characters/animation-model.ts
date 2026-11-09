import type { ContentAnimation, ContentClip } from '@automata/content/level-2d'
import type { Size } from '../../shared/level-2d/model/project-types'

// A character's animation as the Characters view edits it: pure functions from one animation to the next, so each edit
// is one value the session puts in one undo step. The shape is `@automata/content`'s (the editor and the game read the
// same one); this file only says how a person builds it: a picture, a frame size, and clips tapped together from frames.

const DEFAULT_FPS = 8
const MIN_FPS = 1
const MAX_FPS = 60

/** The cells a `frame`-sized grid cuts `image` into; 0 while the picture's size is not known. */
export function frameCount(frame: Size, image: Size | undefined): number {
  if (image === undefined) return 0
  return Math.floor(image.w / frame.w) * Math.floor(image.h / frame.h)
}

export interface ClipRow extends ContentClip {
  /** In words, when the clip uses a frame the picture does not have. */
  readonly problem?: string | undefined
}

/** What the section shows: how many frames the picture has and each clip, with its problem if it has one. */
export function animationModel(
  animation: ContentAnimation | undefined,
  image: Size | undefined,
): { frames: number; clips: readonly ClipRow[] } {
  if (animation === undefined) return { frames: 0, clips: [] }
  const frames = frameCount(animation.frame, image)
  const clips = animation.clips.map((clip): ClipRow => {
    const beyond = clip.frames.find((frame) => frame >= frames)
    return beyond === undefined || image === undefined
      ? clip
      : { ...clip, problem: `This clip uses frame ${beyond}, but the picture has ${frames}.` }
  })
  return { frames, clips }
}

/** An animation of the picture at `image` cut into `frame`-sized cells, with one clip, "idle", on the first frame. */
export function newAnimation(image: string, frame: Size): ContentAnimation {
  return { image, frame, clips: [{ id: 'idle', frames: [0], fps: DEFAULT_FPS, loop: true }] }
}

const mapClip = (
  animation: ContentAnimation,
  id: string,
  change: (clip: ContentClip) => ContentClip,
): ContentAnimation => {
  if (!animation.clips.some((clip) => clip.id === id)) throw new RangeError(`There is no clip "${id}".`)
  return { ...animation, clips: animation.clips.map((clip) => (clip.id === id ? change(clip) : clip)) }
}

/** A new clip on the first frame, named "clip 2", "clip 3" … the first not taken. */
export function addClip(animation: ContentAnimation): ContentAnimation {
  const taken = new Set(animation.clips.map((clip) => clip.id))
  let n = animation.clips.length + 1
  while (taken.has(`clip ${n}`)) n++
  return {
    ...animation,
    clips: [...animation.clips, { id: `clip ${n}`, frames: [0], fps: DEFAULT_FPS, loop: true }],
  }
}

export function renameClip(animation: ContentAnimation, id: string, name: string): ContentAnimation {
  const next = name.trim()
  if (next === '') throw new RangeError('A clip needs a name.')
  if (next !== id && animation.clips.some((clip) => clip.id === next))
    throw new RangeError(`Two clips are called "${next}".`)
  return mapClip(animation, id, (clip) => ({ ...clip, id: next }))
}

/** Appends `frame` to the clip: the frames play in the order they were tapped, and a frame may come again. */
export function addFrame(animation: ContentAnimation, id: string, frame: number): ContentAnimation {
  return mapClip(animation, id, (clip) => ({ ...clip, frames: [...clip.frames, frame] }))
}

/** Takes the last frame back; a clip keeps at least one. */
export function removeLastFrame(animation: ContentAnimation, id: string): ContentAnimation {
  return mapClip(animation, id, (clip) =>
    clip.frames.length <= 1 ? clip : { ...clip, frames: clip.frames.slice(0, -1) },
  )
}

export function setFps(animation: ContentAnimation, id: string, fps: number): ContentAnimation {
  const whole = Math.round(Number.isFinite(fps) ? fps : DEFAULT_FPS)
  return mapClip(animation, id, (clip) => ({ ...clip, fps: Math.min(MAX_FPS, Math.max(MIN_FPS, whole)) }))
}

export function setLoop(animation: ContentAnimation, id: string, loop: boolean): ContentAnimation {
  return mapClip(animation, id, (clip) => ({ ...clip, loop }))
}

/** Without the clip; the last clip taken away takes the whole animation with it (`undefined`). */
export function removeClip(animation: ContentAnimation, id: string): ContentAnimation | undefined {
  const clips = animation.clips.filter((clip) => clip.id !== id)
  return clips.length === 0 ? undefined : { ...animation, clips }
}

export function setFrameSize(animation: ContentAnimation, frame: Size): ContentAnimation {
  if (!(Number.isInteger(frame.w) && Number.isInteger(frame.h)) || frame.w < 1 || frame.h < 1)
    throw new RangeError('A frame is at least 1 px each way.')
  return { ...animation, frame }
}
