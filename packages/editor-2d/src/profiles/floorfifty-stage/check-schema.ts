import type { Diagnostic } from '../profile'
import { inRange, problem, rangeText } from './check-types'
import { PHRASE_NAMES } from './stage.schema'
import type { StageDocument } from './stage-document'

// The stage-level rules the vendored schema enforces, as findings (EDFF.1b decision 1): the stage's identity, the aliases
// that may not be empty, the presentation's ranges and the shape of the course. A command can leave a document that
// breaks them, so they are checked on the value, not left to `parseStage`.

const CONTENT_ID = /^[a-z0-9-]+$/
const NAME_MAX_LENGTH = 48
const PURPOSE_MAX_LENGTH = 240

function checkIdentity(document: StageDocument): Diagnostic[] {
  const { id, unlock, displayName } = document.value
  const found: Diagnostic[] = []
  if (id === '') found.push(problem('id', 'id', 'The stage needs an id.'))
  else if (!CONTENT_ID.test(id))
    found.push(problem('id', 'id', `The id "${id}" may only use lowercase letters, digits and hyphens.`))
  if (unlock === '')
    found.push(
      problem('id', 'unlock', 'The unlock is empty; leave it out for a stage that is open from the start.'),
    )
  else if (unlock !== undefined && !CONTENT_ID.test(unlock))
    found.push(
      problem('id', 'unlock', `The unlock "${unlock}" may only use lowercase letters, digits and hyphens.`),
    )
  if (displayName === '') found.push(problem('displayName', 'displayName', 'The stage needs a name.'))
  else if (displayName.length > NAME_MAX_LENGTH)
    found.push(
      problem(
        'displayName',
        'displayName',
        `The name is ${displayName.length} characters; the select screen has room for ${NAME_MAX_LENGTH}.`,
      ),
    )
  return found
}

function checkAliases(document: StageDocument): Diagnostic[] {
  const { platformAlias, theme } = document.value
  const found: Diagnostic[] = []
  const empty = (path: string, what: string, advice = '.'): void => {
    found.push(problem('emptyAlias', path, `The ${what} alias is empty${advice}`))
  }
  if (platformAlias === '') empty('platformAlias', 'platform')
  if (theme.backdropAlias === '') empty('theme.backdropAlias', 'backdrop')
  if (theme.lightAlias === '')
    empty('theme.lightAlias', 'light', '; leave it out for a stage with no sun or moon.')
  if (theme.previewAlias === '')
    empty('theme.previewAlias', 'preview', '; leave it out for a stage with no select-screen still.')
  if (theme.ambienceAlias === '')
    empty('theme.ambienceAlias', 'ambience', '; leave it out for a stage with no ambience.')
  return found
}

function checkPresentation(document: StageDocument): Diagnostic[] {
  const presentation = document.value.theme.presentation
  if (presentation === undefined) return []
  const found: Diagnostic[] = []
  const range = (field: string, label: string, value: number | undefined, min: number, max: number): void => {
    if (value === undefined || inRange(value, min, max)) return
    found.push(
      problem(
        'presentationRange',
        `theme.presentation.${field}`,
        rangeText(label, `${label} is`, value, min, max),
      ),
    )
  }
  range('refractionIntensity', 'Refraction intensity', presentation.refractionIntensity, 0, 0.8)
  range('horizonLift', 'Horizon lift', presentation.horizonLift, 0, 48)
  range('lightHeight', 'Light height', presentation.lightHeight, -200, 600)
  const sink = presentation.citySink
  if (sink !== undefined)
    for (const phrase of PHRASE_NAMES) {
      const label = `The city sink for the ${phrase} phrase`
      const value = sink[phrase]
      if (!inRange(value, 0, 720))
        found.push(
          problem(
            'presentationRange',
            `theme.presentation.citySink.${phrase}`,
            rangeText(label, `${label} is`, value, 0, 720),
          ),
        )
    }
  return found
}

const FLOOR_ADVICE = 'a floor is a whole number from 1.'

/** The floors and the purpose of a phrase or an extension entry. */
function checkStretch(
  found: Diagnostic[],
  path: string,
  label: string,
  stretch: { readonly fromFloor: number; readonly toFloor: number; readonly purpose: string },
  purposeAdvice: string,
): void {
  const { fromFloor, toFloor, purpose } = stretch
  const isFloor = (floor: number): boolean => Number.isInteger(floor) && floor >= 1
  if (!isFloor(fromFloor))
    found.push(
      problem('phraseRange', `${path}.fromFloor`, `${label} starts at floor ${fromFloor}; ${FLOOR_ADVICE}`),
    )
  if (!isFloor(toFloor))
    found.push(
      problem('phraseRange', `${path}.toFloor`, `${label} ends at floor ${toFloor}; ${FLOOR_ADVICE}`),
    )
  else if (toFloor < fromFloor)
    found.push(
      problem(
        'phraseRange',
        `${path}.toFloor`,
        `${label} ends at floor ${toFloor}, before it starts at floor ${fromFloor}.`,
      ),
    )
  if (purpose === '')
    found.push(problem('emptyPurpose', `${path}.purpose`, `${label} has no purpose; ${purposeAdvice}`))
  else if (purpose.length > PURPOSE_MAX_LENGTH)
    found.push(
      problem(
        'purposeTooLong',
        `${path}.purpose`,
        `The purpose of ${label.charAt(0).toLowerCase()}${label.slice(1)} is ${purpose.length} characters; the limit is ${PURPOSE_MAX_LENGTH}.`,
      ),
    )
}

function checkCourse(document: StageDocument): Diagnostic[] {
  const course = document.value.course
  if (course === undefined) return []
  const found: Diagnostic[] = []
  if (!Number.isInteger(course.seed) || course.seed < 0)
    found.push(problem('seedInvalid', 'course.seed', `The seed ${course.seed} is not a whole number from 0.`))
  const names = course.phrases.map((phrase) => phrase.name)
  if (names.length !== PHRASE_NAMES.length || names.some((name, i) => name !== PHRASE_NAMES[i]))
    found.push(
      problem(
        'phraseOrder',
        'course.phrases',
        `The course needs the four phrases ${PHRASE_NAMES.slice(0, -1).join(', ')} and ${PHRASE_NAMES.at(-1)}, once each, in that order.`,
      ),
    )
  course.phrases.forEach((phrase, index) => {
    checkStretch(
      found,
      `course.phrases[${index}]`,
      `The ${phrase.name} phrase`,
      phrase,
      'say what the player learns there.',
    )
  })
  ;(course.extension ?? []).forEach((entry, index) => {
    checkStretch(
      found,
      `course.extension[${document.ids.extension[index] ?? index}]`,
      `The extension entry ${index + 1}`,
      entry,
      'say what the stretch is for.',
    )
  })
  return found
}

/** The rules of the stage's identity, aliases, presentation and course shape. */
export function checkSchema(document: StageDocument): Diagnostic[] {
  return [
    ...checkIdentity(document),
    ...checkAliases(document),
    ...checkPresentation(document),
    ...checkCourse(document),
  ]
}
