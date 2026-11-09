// The face as point marks on the head: an eye each side (two tall when afraid or surprised, a lid when blinking), brows
// that slant with the mood, and a mouth that shows only when it means something. The view draws each as a small quad facing
// out of the head, shown toward the camera (: faces are decals); the painter's drawn face is not The mouth's swatch is
// the eyes' `mouth` (the library's `mouth` by default).

import type { V3 } from '../../../../shared/math/math.ts'
import type { Decal } from '../../body/mesh.ts'
import { J, type Skeleton } from '../../body/rig.ts'
import { SIDES } from './head.ts'

export function face(s: Skeleton, eyes: string, lid: string, brow: string, mouth: string): Decal[] {
  const g = s.genes
  const hw = (g.head * g.headWidth) / 2
  const hd = (g.head * g.headDepth) / 2
  const h = g.head
  const front = hd * (1 + g.faceAhead) + 0.006
  const out: Decal[] = []
  for (const [, x] of SIDES) {
    const place: V3 = [x * hw * 0.42, h * 0.45, front]
    const normal: V3 = [x * 0.5, 0, 0.86]
    out.push(
      {
        bone: J.head,
        at: place,
        normal,
        material: eyes,
        when: ['neutral', 'sad', 'angry', 'talk'],
        blink: false,
      },
      {
        bone: J.head,
        at: [place[0], h * 0.47, front],
        normal,
        material: eyes,
        size: [1, 2],
        when: ['fear', 'surprised'],
        blink: false,
      },
      { bone: J.head, at: place, normal, material: lid, blink: true },
      // Brows: worried (fear, sad) lifts the inner end, angry drops it.
      { bone: J.head, at: [x * hw * 0.25, h * 0.6, front], normal, material: brow, when: ['fear', 'sad'] },
      {
        bone: J.head,
        at: [x * hw * 0.52, h * 0.56, front],
        normal,
        material: brow,
        when: ['fear', 'sad', 'angry'],
      },
      { bone: J.head, at: [x * hw * 0.25, h * 0.53, front], normal, material: brow, when: ['angry'] },
    )
  }
  out.push(
    {
      bone: J.head,
      at: [0, h * 0.2, hd * 0.86],
      normal: [0, -0.2, 1],
      material: mouth,
      when: ['fear', 'surprised', 'mouthOpen'],
    },
    {
      bone: J.head,
      at: [0, h * 0.22, hd * 0.86],
      normal: [0, -0.2, 1],
      material: mouth,
      size: [2, 1],
      when: ['sad', 'angry'],
    },
  )
  // Tagged, so the view can tell the face's marks from a garment's.
  return out.map((d) => ({ ...d, tag: 'face' }))
}
