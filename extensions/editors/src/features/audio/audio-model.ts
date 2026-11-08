// The audio file as a person reads it: sounds made of tones and hisses, music beds made of drones, and what plays when
// something happens. Every name on screen is a person's ("Plays on Effects", "Loudness"); the keys stay in the file.
import type { AudioContent, Bed, BusId, Cue, Voice } from '@automata/audio-synth'
import type { ContentEdit } from '@automata/editor/kit/documents'
import { eventWords } from '../../shared/event-words.ts'
import { type Field, setOrInsert } from '../../shared/fields.ts'
import type { Problem } from '../../shared/toml-session.ts'

const BUS_WORDS: Readonly<Record<BusId, string>> = {
  music: 'Music',
  sfx: 'Effects',
  ui: 'Menus',
  voice: 'Voices',
}
const BUS_ORDER: readonly BusId[] = ['music', 'sfx', 'ui', 'voice']
const WAVE_WORDS: Readonly<Record<string, string>> = {
  sine: 'Smooth',
  square: 'Buzzy',
  sawtooth: 'Bright',
  triangle: 'Soft',
}

export const busWords = (bus: BusId): string => BUS_WORDS[bus]

const busField = (bus: BusId): Field => ({
  key: 'bus',
  label: 'Plays on',
  kind: 'choice',
  value: bus,
  options: BUS_ORDER.map((value) => ({ value, label: BUS_WORDS[value] })),
})
const waveField = (key: string, wave: string): Field => ({
  key,
  label: 'Shape',
  kind: 'choice',
  value: wave,
  options: Object.entries(WAVE_WORDS).map(([value, label]) => ({ value, label })),
})
const hz = (key: string, label: string, value: number): Field => ({
  key,
  label,
  kind: 'number',
  unit: 'Hz',
  min: 20,
  max: 20000,
  step: 10,
  value,
})
const seconds = (key: string, label: string, value: number, min: number): Field => ({
  key,
  label,
  kind: 'number',
  unit: 's',
  min,
  max: 30,
  step: 0.01,
  value,
})
const loudness = (key: string, value: number): Field => ({
  key,
  label: 'Loudness',
  kind: 'number',
  min: 0,
  max: 1,
  step: 0.05,
  value,
})
const about = (value: string | undefined): Field => ({
  key: 'about',
  label: 'What you hear',
  kind: 'text',
  value: value ?? '',
})

export function soundFields(cue: Cue): Field[] {
  return [about(cue.about), busField(cue.bus)]
}

export interface VoiceLine {
  readonly index: number
  readonly words: 'Tone' | 'Hiss'
  readonly fields: readonly Field[]
}

function voiceLine(voice: Voice, index: number): VoiceLine {
  const timing = [
    seconds('at', 'Begins after', voice.at ?? 0, 0),
    seconds('length', 'Lasts', voice.length, 0.01),
  ]
  if (voice.hiss !== undefined) {
    // A hiss whose centre is picked from a range each time keeps its range; the editor shows its middle read only.
    const around = typeof voice.hiss === 'number' ? voice.hiss : (voice.hiss[0] + voice.hiss[1]) / 2
    return {
      index,
      words: 'Hiss',
      fields: [
        hz('hiss', 'Around', around),
        { key: 'q', label: 'How narrow', kind: 'number', min: 0.1, max: 30, step: 0.1, value: voice.q ?? 1 },
        ...timing,
        loudness('volume', voice.volume),
      ],
    }
  }
  return {
    index,
    words: 'Tone',
    fields: [
      waveField('tone', voice.tone ?? 'sine'),
      hz('from', 'Starts at', voice.from ?? 440),
      hz('to', 'Ends at', voice.to ?? 440),
      ...timing,
      loudness('volume', voice.volume),
    ],
  }
}

export const voiceLines = (cue: Cue): VoiceLine[] => cue.voices.map(voiceLine)

export function bedFields(bed: Bed): Field[] {
  return [about(bed.about), busField(bed.bus), loudness('volume', bed.volume)]
}

export function droneFields(drone: Bed['drones'][number]): Field[] {
  return [
    waveField('wave', drone.wave),
    hz('freq', 'Pitch', drone.freq),
    loudness('volume', drone.volume ?? 1),
  ]
}

export interface EventLine {
  readonly index: number
  readonly on: string
  readonly words: string
  readonly cue: string | undefined
  readonly silent: string | undefined
}

export function eventLines(content: AudioContent): EventLine[] {
  return (content.event ?? []).map((row, index) => ({
    index,
    on: row.on,
    words: `When ${eventWords(row.on)}`,
    cue: row.cue,
    silent: row.silent,
  }))
}

/** `sound-1`, `sound-2`, ...: the first name no sound has. */
export function newSoundId(content: AudioContent): string {
  const taken = new Set((content.cue ?? []).map((cue) => cue.id))
  let n = 1
  while (taken.has(`sound-${String(n)}`)) n += 1
  return `sound-${String(n)}`
}

// A new sound is a short falling blip, so Play sounds something at once.
const NEW_TONE: Voice = { tone: 'square', from: 660, to: 330, length: 0.12, volume: 0.4 }
const NEW_HISS: Voice = { hiss: 2000, q: 1, length: 0.1, volume: 0.3 }

/** An insert at the end of an array of tables, or the array itself when the file has none yet. */
const append = (key: string, present: boolean, row: object): ContentEdit =>
  present ? { keyPath: [key], insert: row } : { keyPath: [key], insert: [row] }

export const addSoundEdit = (content: AudioContent, id: string): ContentEdit =>
  append('cue', content.cue !== undefined, { id, bus: 'sfx', voices: [NEW_TONE] })

export const addVoiceEdit = (cue: number, kind: 'tone' | 'hiss'): ContentEdit => ({
  keyPath: ['cue', cue, 'voices'],
  insert: kind === 'tone' ? NEW_TONE : NEW_HISS,
})

export const removeEdit = (...keyPath: (string | number)[]): ContentEdit => ({ keyPath, remove: true })

export const addEventEdit = (content: AudioContent, on: string, cue: string): ContentEdit =>
  append('event', content.event !== undefined, { on, cue })

/** The edits that make one event play `cue`: a silent row loses its reason, since a row is one or the other. */
export function eventSoundEdits(content: AudioContent, index: number, cue: string): ContentEdit[] {
  const row = content.event?.[index]
  if (row?.silent !== undefined)
    return [removeEdit('event', index, 'silent'), { keyPath: ['event', index, 'cue'], insert: cue }]
  return [setOrInsert(['event', index, 'cue'], row?.cue, cue)]
}

/** A problem in the Audio editor's words: the schema's checks name keys and ids. */
export function audioProblemWords(problem: Problem, content: AudioContent): string {
  const [list, index, key] = problem.keyPath
  const message = problem.message
  if (list === 'event' && key === 'cue' && /^no cue /i.test(message))
    return `There is no sound called ${message.replace(/^no cue /i, '').replace(/\.$/, '')}.`
  if (list === 'event' && key === 'on' && typeof index === 'number' && /^two entries answer/i.test(message))
    return `Another row already answers ${eventWords(content.event?.[index]?.on ?? '')}.`
  if (
    (list === 'cue' || list === 'bed') &&
    key === 'id' &&
    typeof index === 'number' &&
    / is listed twice/i.test(message)
  )
    return `Another ${list === 'cue' ? 'sound' : 'music bed'} is called ${String(content[list]?.[index]?.id ?? '')}.`
  return message
}
