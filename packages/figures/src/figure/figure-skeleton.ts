// A figure's skeleton from its definition (M3 spec §4.4.1 `skeleton(def)`), and the check that refuses an
// impossible one at content compile (§6: "a negative bone length … content compile error naming the slider").
// `genesOf` is FigureBuilder's `fromDef` gene step (src/render/figure/cast.ts at a1f7246): the sliders through
// `measure`, then the figure's own gene overrides.

import { measure, type Sliders } from '../genes/genes'
import { type Genes, type Skeleton, skeletonFromGenes } from '../rig/rig'

/** The part of a figure definition the skeleton depends on. */
export interface FigureBody {
  readonly sliders: Partial<Sliders>
  readonly genes?: Partial<Genes> | undefined
}

export function genesOf(body: FigureBody): Genes {
  return { ...measure(body.sliders).genes, ...body.genes }
}

/** The shared 27-joint rig with this figure's proportions: one generator for every figure (F-a). */
export function skeleton(body: FigureBody): Skeleton {
  return skeletonFromGenes(genesOf(body))
}

export interface SkeletonProblem {
  /** Where to report it: the slider or gene override that sets the bone. */
  readonly path: readonly string[]
  readonly message: string
}

/**
 * Each bone the skeleton builds, how to measure it, and what sets it: the sliders first (the ones an author
 * moves), then the genes a figure can override. A bone of zero or negative length cannot be drawn or solved.
 */
const BONES: readonly {
  readonly name: string
  readonly length: (s: Skeleton) => number
  readonly sliders: readonly (keyof Sliders)[]
  readonly genes: readonly (keyof Genes)[]
}[] = [
  { name: 'head', length: (s) => s.genes.head, sliders: ['head'], genes: ['head'] },
  { name: 'neck', length: (s) => s.genes.neck, sliders: ['neckLength'], genes: ['neck'] },
  {
    // From the pelvis up to the chest joint: long legs under a big head and a long neck leave no torso.
    name: 'spine',
    length: (s) => s.chestY - (s.hipY + 0.05 * (s.genes.height / 1.62)),
    sliders: ['legs', 'head', 'neckLength', 'chunk'],
    genes: ['legs', 'head', 'neck', 'height'],
  },
  { name: 'upper arm', length: (s) => s.upperArm, sliders: ['arms'], genes: ['arms', 'forearm'] },
  { name: 'forearm', length: (s) => s.foreArm, sliders: ['arms'], genes: ['arms', 'forearm'] },
  { name: 'thigh', length: (s) => s.thigh, sliders: ['legs', 'chunk'], genes: ['legs', 'ankle', 'height'] },
  { name: 'shin', length: (s) => s.shin, sliders: ['legs', 'chunk'], genes: ['legs', 'ankle', 'height'] },
  { name: 'foot', length: (s) => s.genes.foot, sliders: ['feet'], genes: ['foot'] },
]

const metres = (value: number): string => `${Math.round(value * 1000) / 1000} m`

/**
 * Every bone of zero or negative length, reported at the first thing the figure sets that drives it: a gene
 * override if it has one (it wins over the sliders), else the first authored slider in the bone's list. The
 * message names it and the other drivers the figure set, so the author knows which numbers to move.
 */
export function skeletonProblems(body: FigureBody): SkeletonProblem[] {
  const s = skeleton(body)
  const problems: SkeletonProblem[] = []
  for (const bone of BONES) {
    const length = bone.length(s)
    if (length > 0) continue
    const genes = bone.genes.filter((gene) => body.genes?.[gene] !== undefined)
    const sliders = bone.sliders.filter((slider) => body.sliders[slider] !== undefined)
    const gene = genes[0]
    const slider = sliders[0]
    const at = gene !== undefined ? ['genes', gene] : slider !== undefined ? ['sliders', slider] : ['sliders']
    const named =
      gene !== undefined
        ? `genes.${gene} ${body.genes?.[gene]}`
        : slider !== undefined
          ? `${slider} ${body.sliders[slider]}`
          : 'the default sliders'
    const others = [
      ...sliders.filter((other) => other !== slider),
      ...genes.filter((other) => other !== gene),
    ]
    const also = others.length > 0 ? `; also set: ${others.join(', ')}` : ''
    problems.push({
      path: at,
      message: `${named} gives the ${bone.name} a length of ${metres(length)}; a bone must be longer than 0${also}`,
    })
  }
  return problems
}
