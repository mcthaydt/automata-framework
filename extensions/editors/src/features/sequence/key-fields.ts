// The fields of one step of a cutscene, in the spec's words, and the edits each one makes. A field never shows a key
// name; a name the game does not have any more (a line removed in Writer) is kept and said in words.

import type { CutsceneScript } from '@automata/cutscenes/sim'
import type { ContentEdit } from '@automata/editor/kit/documents'
import { type Field, setOrInsert } from '../../shared/fields.ts'
import { retimeEdit } from './key-edits.ts'
import { keysOf, type TrackId } from './tracks.ts'

/** The names a game offers, read from the whole game because a cutscene names no scene. */
export interface SequenceNames {
  readonly lines: readonly { readonly id: string; readonly words: string; readonly file: string }[]
  readonly actors: readonly string[]
  readonly anchors: readonly string[]
  readonly clips: Readonly<Record<string, readonly string[]>>
  readonly lamps: readonly string[]
  readonly doors: readonly string[]
  readonly props: readonly string[]
}

export const NO_NAMES: SequenceNames = {
  lines: [],
  actors: [],
  anchors: [],
  clips: {},
  lamps: [],
  doors: [],
  props: [],
}

export interface KeyField {
  readonly field: Field
  /** Shown only under **More**. */
  readonly more?: boolean
  /** A sentence about this field's value, when the game does not have what it names. */
  readonly problem?: string | undefined
  /** The edits the field makes when it takes `value`; none when nothing would change. */
  readonly edits: (value: string | number) => ContentEdit[]
}

type Record_ = Readonly<Record<string, unknown>>

const WORDS_REMOVED = 'This step’s words were removed.'
const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const

/** A lens in millimetres as a word a person can picture. */
export function lensWords(mm: number): string {
  if (mm < 35) return 'wide'
  if (mm > 70) return 'close'
  return 'normal'
}

/** A list of choices that always holds the value in the file, named in words when the game no longer has it. */
function withCurrent(
  options: readonly { value: string; label: string }[],
  current: string | undefined,
  missingWords: string,
): { value: string; label: string }[] {
  const list = [...options]
  if (current !== undefined && current !== '' && !list.some((option) => option.value === current))
    list.push({ value: current, label: missingWords })
  return list
}

export function keyFields(
  script: CutsceneScript,
  track: TrackId,
  index: number,
  names: SequenceNames = NO_NAMES,
): KeyField[] {
  const key = keysOf(script, track)[index] as Record_ | readonly number[] | undefined
  if (key === undefined) return []
  const base = [track, index] as const
  const at = (...rest: (string | number)[]): (string | number)[] => [...base, ...rest]
  const row = key as Record_

  const timeField = (label: string, value: number, end = false): KeyField => ({
    field: {
      key: end ? 'end' : 'start',
      label,
      kind: 'number',
      unit: 's',
      min: 0,
      max: script.duration,
      step: 0.1,
      value,
    },
    edits: (next) => {
      const edit = retimeEdit(script, track, index, Number(next), end)
      return edit === undefined ? [] : [edit]
    },
  })
  const numberField = (
    label: string,
    path: (string | number)[],
    value: number,
    range: { min: number; max: number; step: number; unit?: string },
  ): KeyField => ({
    field: { key: path.join('.'), label, kind: 'number', ...range, value },
    edits: (next) => {
      const number = Number(next)
      return number === value
        ? []
        : [setOrInsert(at(...path), row[path[0] as string] === undefined ? undefined : value, number)]
    },
  })
  const vector = (
    label: string,
    name: 'pos' | 'look' | 'at',
    words: [string, string, string],
  ): KeyField[] => {
    const value = (row[name] as readonly number[] | undefined) ?? [0, 0, 0]
    return value.map((component, place) => ({
      field: {
        key: `${name}.${String(place)}`,
        label: `${label} (${words[place] as string})`,
        kind: 'number' as const,
        unit: 'm',
        min: -1000,
        max: 1000,
        step: 0.1,
        value: component,
      },
      edits: (next: string | number) =>
        Number(next) === component
          ? []
          : [{ keyPath: at(name, place), expected: component, set: Number(next) }],
    }))
  }
  const textField = (label: string, name: string): KeyField => ({
    field: { key: name, label, kind: 'text', value: String(row[name] ?? '') },
    edits: (next) => (String(next) === row[name] ? [] : [setOrInsert(at(name), row[name], String(next))]),
  })
  const nameField = (
    label: string,
    name: string,
    options: readonly string[],
    missingWords: string,
  ): KeyField => {
    if (options.length === 0 && row[name] === undefined) return textField(label, name)
    const current = row[name] as string | undefined
    const list = withCurrent(
      options.map((value) => ({ value, label: value })),
      current,
      missingWords,
    )
    return {
      field: { key: name, label, kind: 'choice', value: current ?? '', options: list },
      problem:
        current !== undefined && !options.includes(current) && options.length > 0 ? missingWords : undefined,
      edits: (next) => (String(next) === current ? [] : [setOrInsert(at(name), current, String(next))]),
    }
  }
  // A key stores the way an actor faces in radians; a person turns a dial in degrees.
  const facingField = (): KeyField => {
    const radians = (row.facing as number | undefined) ?? 0
    const degrees = Math.round(((((radians * 180) / Math.PI) % 360) + 360) % 360)
    return {
      field: {
        key: 'facing',
        label: 'Facing',
        kind: 'number',
        unit: '°',
        min: 0,
        max: 360,
        step: 1,
        value: degrees,
      },
      edits: (next) =>
        Number(next) === degrees
          ? []
          : [
              setOrInsert(
                at('facing'),
                row.facing,
                Math.round(((Number(next) * Math.PI) / 180) * 1000) / 1000,
              ),
            ],
    }
  }
  const yesNo = (label: string, name: string, onValue: boolean): KeyField => ({
    field: {
      key: name,
      label,
      kind: 'choice',
      value: row[name] === onValue ? 'yes' : 'no',
      options: YES_NO,
    },
    edits: (next) => {
      const yes = next === 'yes'
      if (yes === (row[name] === onValue)) return []
      if (yes) return [setOrInsert(at(name), row[name], onValue)]
      return row[name] === undefined ? [] : [{ keyPath: at(name), remove: true }]
    },
  })
  /** Cut / Moves smoothly / Moves (its own curve): a curve is kept as written, and only **Moves smoothly** removes it. */
  const arrives = (cuts: string, moves: string, hasCurve: boolean): KeyField => {
    const value = row.cut === true ? 'cut' : hasCurve ? 'curve' : 'smooth'
    return {
      field: {
        key: 'arrives',
        label: 'Arrives',
        kind: 'choice',
        value,
        options: [
          { value: 'cut', label: cuts },
          { value: 'smooth', label: moves },
          ...(hasCurve ? [{ value: 'curve', label: 'Moves (its own curve)' }] : []),
        ],
      },
      edits: (next) => {
        if (next === value || next === 'curve') return []
        const edits: ContentEdit[] = []
        if (next === 'cut') edits.push(setOrInsert(at('cut'), row.cut, true))
        else {
          if (row.cut !== undefined) edits.push({ keyPath: at('cut'), remove: true })
          if (row.ease !== undefined) edits.push({ keyPath: at('ease'), remove: true })
        }
        return edits
      },
    }
  }

  switch (track) {
    case 'camera': {
      const lens = (row.lens as number | undefined) ?? script.lens ?? 50
      return [
        timeField('When', row.t as number),
        ...vector('Stands at', 'pos', ['across', 'height', 'along']),
        ...vector('Looks at', 'look', ['across', 'height', 'along']),
        {
          ...numberField(`Lens, ${lensWords(lens)}`, ['lens'], lens, {
            min: 8,
            max: 200,
            step: 1,
            unit: 'mm',
          }),
          edits: (next) => (Number(next) === lens ? [] : [setOrInsert(at('lens'), row.lens, Number(next))]),
        },
        arrives('Cut', 'Moves smoothly', row.ease !== undefined),
      ]
    }
    case 'actor': {
      const place = row.at as string | undefined
      const fields: KeyField[] = [
        timeField('When', row.t as number),
        nameField('Who', 'who', names.actors, WORDS_REMOVED),
      ]
      // Where: a named place, or a point on the plan.
      fields.push({
        field: {
          key: 'where',
          label: 'Where',
          kind: 'choice',
          value: place ?? 'point',
          options: withCurrent(
            [
              { value: 'point', label: 'A point on the plan' },
              ...names.anchors.map((value) => ({ value, label: value })),
            ],
            place,
            place ?? '',
          ),
        },
        edits: (next) => {
          if (next === (place ?? 'point')) return []
          if (next === 'point') {
            return [
              { keyPath: at('at'), remove: true },
              ...(row.x === undefined ? [{ keyPath: at('x'), insert: 0 } as ContentEdit] : []),
              ...(row.z === undefined ? [{ keyPath: at('z'), insert: 0 } as ContentEdit] : []),
            ]
          }
          return [
            setOrInsert(at('at'), place, String(next)),
            ...(row.x === undefined ? [] : [{ keyPath: at('x'), remove: true } as ContentEdit]),
            ...(row.z === undefined ? [] : [{ keyPath: at('z'), remove: true } as ContentEdit]),
          ]
        },
      })
      if (place === undefined) {
        fields.push(
          numberField('Across', ['x'], (row.x as number | undefined) ?? 0, {
            min: -1000,
            max: 1000,
            step: 0.1,
            unit: 'm',
          }),
          numberField('Along', ['z'], (row.z as number | undefined) ?? 0, {
            min: -1000,
            max: 1000,
            step: 0.1,
            unit: 'm',
          }),
        )
      }
      fields.push(
        facingField(),
        yesNo('Walking', 'moving', true),
        textField('Pose', 'pose'),
        arrives('Cut', 'Walks there', false),
        numberField('Seen', ['alpha'], (row.alpha as number | undefined) ?? 1, { min: 0, max: 1, step: 0.1 }),
        yesNo('Through walls', 'through', true),
        {
          ...numberField('Height', ['y'], (row.y as number | undefined) ?? 0, {
            min: -100,
            max: 100,
            step: 0.1,
            unit: 'm',
          }),
          more: true,
        },
        {
          ...numberField('Shiver', ['shiver'], (row.shiver as number | undefined) ?? 0, {
            min: 0,
            max: 10,
            step: 0.01,
            unit: 'm',
          }),
          more: true,
        },
        {
          ...numberField('Detail', ['density'], (row.density as number | undefined) ?? 1, {
            min: 0,
            max: 8,
            step: 1,
          }),
          more: true,
        },
        { ...textField('Face', 'face'), more: true },
        {
          ...numberField('Which picture', ['frame'], (row.frame as number | undefined) ?? 0, {
            min: 0,
            max: 999,
            step: 1,
          }),
          more: true,
        },
      )
      return fields
    }
    case 'caption': {
      const line = row.line as string
      const found = names.lines.find((candidate) => candidate.id === line)
      const options = names.lines.map((candidate) => ({
        value: candidate.id,
        label: candidate.words === '' ? 'Nothing written yet' : candidate.words,
      }))
      return [
        timeField('From', row.t as number),
        timeField('Until', row.until as number, true),
        {
          field: {
            key: 'line',
            label: 'Which line',
            kind: 'choice',
            value: line,
            options: withCurrent(options, line, WORDS_REMOVED),
          },
          problem: found === undefined ? WORDS_REMOVED : undefined,
          edits: (next) =>
            String(next) === line ? [] : [{ keyPath: at('line'), expected: line, set: String(next) }],
        },
        nameField('Who says it', 'speaker', names.actors, WORDS_REMOVED),
      ]
    }
    case 'light':
      return [
        timeField('When', row.t as number),
        nameField('Which lamp', 'lamp', names.lamps, WORDS_REMOVED),
        numberField('How bright', ['level'], row.level as number, { min: 0, max: 1, step: 0.1 }),
      ]
    case 'doors':
      return [
        timeField('When', row.t as number),
        nameField('Which door', 'door', names.doors, WORDS_REMOVED),
        numberField('How open', ['open'], row.open as number, { min: 0, max: 1, step: 0.1 }),
      ]
    case 'time':
      return [timeField('When', row.t as number), textField('Which', 'time')]
    case 'grade':
      return [timeField('When', row.t as number), textField('Which', 'grade')]
    case 'props': {
      const where = (row.at as readonly number[] | undefined) ?? [0, 0, 0]
      return [
        timeField('When', row.t as number),
        nameField('Which prop', 'prop', names.props, WORDS_REMOVED),
        ...vector('Where', 'at', ['across', 'height', 'along']).map((field, place) => ({
          ...field,
          edits: (next: string | number) =>
            Number(next) === where[place]
              ? []
              : row.at === undefined
                ? [{ keyPath: at('at'), insert: where.map((c, p) => (p === place ? Number(next) : c)) }]
                : [{ keyPath: at('at', place), expected: where[place], set: Number(next) }],
        })),
        numberField('Turned', ['turn'], (row.turn as number | undefined) ?? 0, {
          min: 0,
          max: 360,
          step: 1,
          unit: '°',
        }),
      ]
    }
    case 'cues': {
      const who = row.who as string
      return [
        {
          field: {
            key: 'at',
            label: 'When',
            kind: 'number',
            unit: 's',
            min: 0,
            max: script.duration,
            step: 0.1,
            value: row.at as number,
          },
          edits: (next) => {
            const edit = retimeEdit(script, 'cues', index, Number(next))
            return edit === undefined ? [] : [edit]
          },
        },
        nameField('Who', 'who', names.actors, WORDS_REMOVED),
        nameField('Which clip', 'clip', names.clips[who] ?? [], WORDS_REMOVED),
      ]
    }
    case 'shake': {
      const bar = key as readonly number[]
      return [
        timeField('From', bar[0] as number),
        timeField('To', bar[1] as number, true),
        {
          field: {
            key: 'hard',
            label: 'How hard',
            kind: 'number',
            unit: 'm',
            min: 0,
            max: 5,
            step: 0.05,
            value: bar[2] as number,
          },
          edits: (next) =>
            Number(next) === bar[2] ? [] : [{ keyPath: at(2), expected: bar[2], set: Number(next) }],
        },
      ]
    }
    case 'flicker': {
      const bar = key as readonly number[]
      return [timeField('From', bar[0] as number), timeField('To', bar[1] as number, true)]
    }
    case 'fade':
      return [
        timeField('When', row.t as number),
        numberField('How dark', ['value'], row.value as number, { min: 0, max: 1, step: 0.1 }),
      ]
    case 'sound':
      return []
  }
}

/** The words a read-only row says when a game's file has sounds. */
export const SOUNDS_WORDS = 'Sounds in cutscenes don’t play yet.'

/** What the scene holds apart from its keys: its length, default lens and whether it ends the game. */
export function sceneFields(script: CutsceneScript): KeyField[] {
  const lens = script.lens ?? 50
  return [
    {
      field: {
        key: 'duration',
        label: 'Length',
        kind: 'number',
        unit: 's',
        min: 0.1,
        max: 3600,
        step: 0.1,
        value: script.duration,
      },
      // The length is changed through `durationEdits`, which asks first when it would take steps away.
      edits: () => [],
    },
    {
      field: {
        key: 'lens',
        label: `Lens, ${lensWords(lens)}`,
        kind: 'number',
        unit: 'mm',
        min: 8,
        max: 200,
        step: 1,
        value: lens,
      },
      edits: (next) => (Number(next) === lens ? [] : [setOrInsert(['lens'], script.lens, Number(next))]),
    },
    {
      field: {
        key: 'victory',
        label: 'Ends the game when it ends',
        kind: 'choice',
        value: script.victory === true ? 'yes' : 'no',
        options: YES_NO,
      },
      edits: (next) => {
        const yes = next === 'yes'
        if (yes === (script.victory === true)) return []
        if (yes) return [setOrInsert(['victory'], script.victory, true)]
        return script.victory === undefined ? [] : [{ keyPath: ['victory'], remove: true }]
      },
    },
  ]
}
