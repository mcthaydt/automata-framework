import { COURSE_TUNABLE_NAMES, type CourseTunableName } from '../course-tuning'
import type { StageDocument } from '../stage-document'
import { TUNABLES, type TunableDeclaration } from '../tunables'

// What the Stage view shows (plan EDFF.2a-1 step 3; 2D editor spec §10.6, the Stage row): the stage's identity, its
// presentation block and the course tuning it overrides. An override keeps its value whatever it is: a value outside
// its declaration is a finding of the checks, so the form only shows the declaration beside it.

export interface StageIdentity {
  readonly id: string
  readonly name: string
  /** `''` when the stage is open from the start. */
  readonly unlock: string
  readonly platformAlias: string
}

export interface StagePresentationForm {
  readonly refraction: number
  readonly horizonLift: number
  /** `undefined` leaves the light where the game puts it. */
  readonly lightHeight: number | undefined
  readonly lightShimmer: boolean
  readonly silhouette: boolean
}

export interface TuningOverride {
  readonly name: string
  readonly value: number
  /** `undefined` for a name the game does not declare (the checks report it). */
  readonly declared: TunableDeclaration | undefined
}

export interface StageForm {
  readonly identity: StageIdentity
  /** `undefined` when the stage has no presentation block. */
  readonly presentation: StagePresentationForm | undefined
  /** In the course's order, then any other names in the order the file has them. */
  readonly overrides: readonly TuningOverride[]
  /** The course tunables not overridden yet. */
  readonly available: readonly CourseTunableName[]
}

export function stageForm(document: StageDocument): StageForm {
  const { value } = document
  const presentation = value.theme.presentation
  const tuning = value.courseTuning
  const names = Object.keys(tuning)
  const course: readonly string[] = COURSE_TUNABLE_NAMES
  const ordered = [
    ...COURSE_TUNABLE_NAMES.filter((name) => Object.hasOwn(tuning, name)),
    ...names.filter((name) => !course.includes(name)),
  ]
  return {
    identity: {
      id: value.id,
      name: value.displayName,
      unlock: value.unlock ?? '',
      platformAlias: value.platformAlias,
    },
    presentation:
      presentation === undefined
        ? undefined
        : {
            refraction: presentation.refractionIntensity,
            horizonLift: presentation.horizonLift,
            lightHeight: presentation.lightHeight,
            lightShimmer: presentation.lightShimmer ?? false,
            silhouette: presentation.silhouette ?? false,
          },
    overrides: ordered.map((name) => ({
      name,
      value: tuning[name] as number,
      declared: Object.hasOwn(TUNABLES, name) ? TUNABLES[name] : undefined,
    })),
    available: COURSE_TUNABLE_NAMES.filter((name) => !Object.hasOwn(tuning, name)),
  }
}
