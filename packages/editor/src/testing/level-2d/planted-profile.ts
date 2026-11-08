import type { IdSource } from '../../shared/level-2d/model/ids'
import type { Diagnostic, Profile, ProjectContext } from '../../shared/level-2d/profiles/profile'

// A second profile for the app's tests, so the code that opens, lists and creates documents is shown to be
// profile-blind (G-s) without depending on a profile that lives in another stack. A "note" file is `NOTE`, a line of
// text, and a line `# saved N` that the printer counts up from the text it is given as `base`, which is what a codec
// that patches the text it loaded to keep its comments does. So a save that forgets to hand the next one the
// text it wrote prints the same number twice.

export interface Note {
  readonly text: string
}

const SAVED = /^# saved (\d+)$/m

export function savedCount(text: string): number {
  const match = SAVED.exec(text)
  return match === null ? 0 : Number(match[1])
}

export function noteText(text: string, saved = 0): string {
  return `NOTE\n${text}\n${saved === 0 ? '' : `# saved ${saved}\n`}`
}

const slug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'note'

export function plantedProfile(overrides: Partial<Profile<Note>> = {}): Profile<Note> {
  return {
    id: 'planted',
    label: 'Planted note',
    sniff: (fileName, text) => fileName.endsWith('.note') || text.startsWith('NOTE\n'),
    parse(text) {
      if (!text.startsWith('NOTE\n'))
        return {
          ok: false,
          error: [{ code: 'notNote', message: 'A note starts with NOTE.', line: 1, column: 1 }],
        }
      return { ok: true, value: { text: text.split('\n')[1] ?? '' } }
    },
    print: (base, note) => noteText(note.text, savedCount(base) + 1),
    check(note: Note, _context: ProjectContext): readonly Diagnostic[] {
      const found: Diagnostic[] = []
      if (note.text === '')
        found.push({ severity: 'warning', code: 'emptyNote', path: 'text', message: 'The note is empty.' })
      if (note.text.includes('BAD'))
        found.push({ severity: 'error', code: 'badNote', path: 'text', message: 'The note says BAD.' })
      return found
    },
    templates: [
      { id: 'one', label: 'One', create: (ids: IdSource): Note => ({ text: `note ${ids.next()}` }) },
      { id: 'two', label: 'Two', create: (): Note => ({ text: 'second' }) },
    ],
    views: [{ id: 'note', label: 'Note', component: 'NoteView' }],
    exports: [
      {
        id: 'note',
        label: 'Note',
        files: (note) => [{ path: `notes/${slug(note.text)}.note`, contents: noteText(note.text) }],
      },
    ],
    ...overrides,
  }
}
