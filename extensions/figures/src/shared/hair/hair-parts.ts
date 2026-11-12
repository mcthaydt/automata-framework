import { headForm } from '../body/head'
import { type Decal, type Material, type Mesh, type Part, reach, superquadric } from '../body/parts'
import { J } from '../body/rig'
import { add, clamp, cross, hash, lerp, normalize, scale, smooth, sub, type V3 } from '../math/math'
import { FACE_SEAM } from '../paint/paint'
import { alignY, along, onHead, shell, skull, spline, sweep, toHead } from './hair-geometry'
import { CROWN, finish, HAIR_SEAM, PIECES, PPM, texels } from './hair-registry'
import type {
  Bun,
  Fall,
  Fringe,
  HairCtx,
  HairInput,
  HairLook,
  HairStyle,
  OwnPiece,
  Rope,
  Tail,
  Tie,
  Tone,
} from './hair-types'
/** A style's parts on the head and its swinging joints, fitted to the skeleton's head and the body under it. */
export function hairParts(i: HairInput, style: HairStyle): HairLook {
  const { s, m } = i,
    k = skull(s),
    form = headForm(m, s),
    head = s.rest[J.head],
    hw = k.r[0],
    parts: Part[] = [],
    decals: Decal[] = [],
    made: Record<string, Material> = {}
  const ppm = i.ppm ?? PPM
  /** A tie's swatch: the style's own, or the wearer's (true), else a band in the hair's own lit tone. */
  /** A tone's material in the style's finish. */
  const tone = (t: Tone, matte?: boolean) => finish(i, style.finish, t, made, matte)
  const tieOf = (t: Tie | undefined) => (!t ? null : typeof t === 'string' ? t : (i.tie ?? tone('lit')))
  let seam = HAIR_SEAM + 100
  /** A rigid piece on the head. */
  const rigid = (mesh: Mesh, t: Tone, own = HAIR_SEAM, lit?: Mesh, matte?: boolean) => {
    parts.push({ bone: J.head, mesh, material: tone(t, matte), group: 1, seam: own })
    if (lit) parts.push({ bone: J.head, mesh: lit, material: tone('lit', matte), group: 1, seam: own })
  }
  /** A skinned piece: its points in head space, each weighted from the head toward `joint` by `w` of its way along. */
  const hung = (
    mesh: Mesh,
    ts: number[],
    to: Tone,
    swing: (t: number) => [number, number][],
    own: number,
    lit?: Mesh,
    matte?: boolean,
  ) => {
    for (const [m, t] of [[mesh, to], ...(lit ? [[lit, 'lit']] : [])] as [Mesh, Tone][]) {
      const placed = { ...m, positions: m.positions.map((v, n) => v + head[n % 3]) }
      parts.push({ mesh: placed, material: tone(t, matte), group: 1, seam: own, skin: ts.map(swing) })
    }
  }
  /** What a registered piece (a fork's, registerHairPiece) is given: the same helpers and the one seam counter. */
  const ctx: HairCtx = {
    i,
    k,
    form,
    head,
    hw,
    ppm,
    parts,
    decals,
    rigid,
    hung,
    tone,
    tieOf,
    seam: () => seam++,
  }
  for (const piece of style.pieces) {
    const first = parts.length
    // The generators' own pieces are told apart by their key; any other is a registered piece, handled last.
    const own = piece as OwnPiece
    if ('scalp' in own) {
      const o = own.scalp
      // A fade: the head's own surface graded up the band in tiers, the skin at its foot (its material, so it shades on
      // unbroken from the neck and the ear), then the hair's tones mixed toward the skin's, then the stubble (the hair's,
      // matte), each tier one solid tone, so it grades with no speckle and no line where it meets the top.
      if (o.tone === 'fade') {
        const grade = o.grade ?? [],
          tier = (row: number) => grade.reduce((n, [at], q) => ((row + 0.5) / 18 >= at ? q : n), -1)
        for (let n = -1; n < grade.length; n++) {
          const { mesh } = shell(k, o, form, (row) => tier(row) === n)
          if (mesh.indices.length)
            parts.push({
              bone: J.head,
              mesh,
              material: n < 0 ? i.skin : tone(grade[n][1], true),
              group: 1,
              seam: FACE_SEAM,
            })
        }
      } else {
        const sh = shell(k, o, form)
        rigid(sh.mesh, o.tone ?? 'hair', HAIR_SEAM, sh.lit)
        if (sh.part) rigid(sh.part, 'parting', HAIR_SEAM)
      }
    } else if ('rows' in own) {
      // Rows from the hairline, gathered to one point, or each straight back over the top to the nape, keeping its
      // place across the head (in the skull's units) so the rows run parallel and the scalp shows evenly between them.
      const o = own.rows
      for (let r = 0; r < o.count; r++) {
        const a = (o.at ?? 0) + (o.count === 1 ? 0 : -o.span + (2 * o.span * r) / (o.count - 1)),
          start = sub(onHead(form, k, a, along(o.from, a)), k.c)
        const path: V3[] = []
        if (o.to === 'nape') {
          const end = sub(onHead(form, k, Math.PI - a, along(o.nape ?? [[0, -0.5]], Math.PI - a)), k.c)
          const u = (d: V3) => normalize([d[0] / k.r[0], d[1] / k.r[1], d[2] / k.r[2]]),
            us = u(start),
            ue = u(end)
          const f0 = Math.atan2(us[1], us[2]),
            f1 = Math.atan2(ue[1], ue[2]) + (Math.atan2(ue[1], ue[2]) < f0 ? 2 * Math.PI : 0)
          for (let q = 0; q <= 16; q++) {
            const t = q / 16,
              x = lerp(us[0], ue[0], t),
              f = lerp(f0, f1, t),
              c = Math.sqrt(1 - x * x)
            path.push(
              toHead(form, k, [x * k.r[0], c * Math.sin(f) * k.r[1], c * Math.cos(f) * k.r[2]], o.lift),
            )
          }
        } else {
          const to = scale(normalize(o.to), Math.hypot(...start))
          for (let q = 0; q <= 8; q++)
            path.push(
              toHead(form, k, add(scale(normalize(start), 1 - q / 8), scale(normalize(to), q / 8)), o.lift),
            )
        }
        // A slanted plait turns against the next row's, half a bead on, so rows side by side read as a herringbone.
        const slant = o.rope.slant ? { phase: (r % 2) * 0.5, slant: (r % 2 ? 1 : -1) * o.rope.slant } : {}
        const { mesh, lit } = sweep(path, { tip: 'blunt', ...o.rope, ...slant }, hw, (p) => sub(p, k.c))
        rigid(mesh, o.tone ?? 'hair', o.apart === false ? HAIR_SEAM : seam++, lit, o.matte)
      }
    } else if ('tail' in own) tail(own.tail)
    else if ('bun' in own) bun(own.bun)
    else if ('fall' in own) fall(own.fall)
    else if ('fringe' in own) fringe(own.fringe)
    else {
      const name = Object.keys(piece)[0],
        p = PIECES.get(name)
      if (!p) throw new Error(`no hair piece ${name}`)
      p.build(ctx, (piece as Record<string, unknown>)[name])
    }
    // The hair's top over the crown (its shells and rows; never a tail, a fade): what is worn up lies on it, not on
    // whatever stands furthest out.
    if (
      'rows' in own ||
      ('scalp' in own && own.scalp.tone !== 'fade') ||
      PIECES.get(Object.keys(piece)[0])?.crown
    )
      for (let n = first; n < parts.length; n++) parts[n].tag = CROWN
  }
  /**
   * A bun: one rope wound in a flattened spiral about the direction `at` (a disc standing off the skull, its coils fused into a
   * mass by their own thickness), from its outer edge in to near its middle, rising along `at` as it goes in, so it
   * domes. Its root rides the head's form (toHead) and the whole of it lies outside it, a rope's radius and a little over.
   */
  function bun(o: Bun) {
    const dir = normalize(o.at),
      P = toHead(form, k, dir, 0),
      R = o.r * hw,
      ra = o.rope.r * hw,
      turns = o.turns ?? 2.5,
      flat = o.flat ?? 0.6
    const u = normalize(cross(dir, Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])),
      w = cross(dir, u),
      lift = ra * 1.5,
      n = Math.max(24, Math.round(turns * 24))
    // A disc `flat` of its width deep: the coils rise from `lift` at the rim to `flat * R` at the middle.
    const at = (q: number): V3 => {
      const th = 2 * Math.PI * turns * q,
        rho = R * (1 - 0.8 * q),
        h = lift + flat * R * smooth(q)
      return add(P, add(scale(u, Math.cos(th) * rho), add(scale(w, Math.sin(th) * rho), scale(dir, h))))
    }
    const path = Array.from({ length: n + 1 }, (_, i) => at(i / n))
    const { mesh, lit } = sweep(path, { tip: 'round', ...o.rope }, hw, () => dir)
    rigid(mesh, 'hair', seam++, lit)
    const band = tieOf(o.tie)
    if (band)
      parts.push({
        bone: J.head,
        mesh: superquadric({
          at: add(P, scale(dir, lift * 0.8)),
          r: [R * 0.45, texels(0.04 * s.genes.head, ppm) / 2, R * 0.45],
          e: [0.25, 1],
          seg: 14,
          rings: 4,
          turn: alignY(dir),
        }),
        material: band,
        group: 1,
        seam: seam++,
      })
  }
  /** The twin of `trunkBack`, forward: the head-space z a clump at `x` clears the dressed trunk's front by (`clear` off it), or none where the trunk is not (above the shoulders, beside them). */
  function frontOf(clear: number) {
    return (x: number, y: number) => {
      const r = reach(i.trunk ?? [], s.rest, [x + head[0], y + head[1], 0], [0, 0, 1])
      return r > 0 ? r - head[2] + clear : -Infinity
    }
  }
  /**
   * Loose hair: each clump from the crown over the scalp to its hairline, past the ear and the jaw (always outside the head's
   * form, `volume` standing it further off), then straight down, drifting behind the dressed trunk by the shoulders and clear
   * of it (as the tail's `trunkBack` takes it) to the length; a wave or a spiral about that path by `curl`. A share of the
   * clumps rooted ahead of the ear (`front`) stay ahead of it instead: down beside the face, in front of the shoulder and
   * over the chest, never in front of the trunk's own surface; the ends turn under or out by `turn`.
   */
  function fall(o: Fall) {
    const curl = clamp(o.curl ?? 0, 0, 1),
      volume = clamp(o.volume ?? 0, 0, 1),
      kk = m.k,
      texel = 1 / ppm
    // Curls are fatter and shorter than straight hair.
    const rope: Rope = { ...o.rope, r: o.rope.r * (1 + 0.5 * curl), root: 0.02 },
      ra = rope.r * hw,
      clear = ra * 1.2 + texel
    const chin = s.chinY - head[1],
      shoulder = s.shoulderY - head[1],
      chest = s.chestY - head[1]
    // Up to the chest as it always was; past it, on to the waist (the body's, fit.ts `waistY`).
    const front = clamp(o.front ?? 0, 0, 1),
      turn = clamp(o.turn ?? 0, -1, 1),
      waist = s.hipY + 0.155 * kk - head[1]
    const yEnd =
      o.length <= 1
        ? lerp(chin, chest, clamp(o.length, 0, 1) * (1 - 0.35 * curl))
        : lerp(chest, waist, clamp(o.length - 1, 0, 1))
    const trunkBack = (y: number) => {
      const r = reach(i.trunk ?? [], s.rest, [0, y + head[1], 0], [0, 0, -1])
      return r > 0 ? -r - head[2] - clear : Infinity
    }
    const trunkFront = frontOf(clear)
    // Ahead of the ear is the face's side: the clumps there that stay ahead keep outside the outer eye (this far round the head).
    const AHEAD = 1.45,
      FACE = 1.2
    // Out of the head's form by the rope's own radius (and a little over), and further by the volume.
    const lift = rope.r * 1.6 + 0.55 * volume,
      gap = 0.35,
      part = o.part ?? 0
    for (let j = 0; j < o.count; j++) {
      const a0 = part + gap + ((2 * Math.PI - 2 * gap) * (j + 0.5 + 0.2 * (hash(j * 3 + 1) - 0.5))) / o.count,
        a = ((((a0 + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI
      const y0 = along(o.from, a),
        yb = Math.max(-0.7, y0 + 0.1),
        sideRide = Math.abs(Math.sin(a)) > 0.55
      // Down the scalp to the hairline, then down the head to the jaw: a clump that starts in front of the ear sweeps round
      // behind it (past 2.4 rad from the front), so it never lies across the face and reaches the back of the neck, not the sides.
      const stays = front > 0 && Math.abs(a) < AHEAD && hash(j * 7 + 3) < front
      const aEar = stays
          ? Math.sign(a) * Math.max(Math.abs(a), FACE)
          : Math.sign(a) * Math.max(Math.abs(a), 2.4),
        path: V3[] = []
      // From the crown itself (every clump's root meets there, lifted by the volume), so the mass closes over the top.
      for (let q = 0; q <= 4; q++) path.push(onHead(form, k, a, lerp(0.97, yb, q / 4), lift + (0.03 * q) / 4))
      for (let q = 1; q <= 5; q++)
        path.push(
          onHead(
            form,
            k,
            lerp(a, aEar, smooth(Math.min(1, q / 2.5))),
            lerp(yb, -0.76, q / 5),
            lift + 0.03 + (0.02 * q) / 5,
          ),
        )
      const jaw = path[path.length - 1]
      // Below the jaw: straight down, behind the trunk from the shoulders on (and by the shoulders already, drifting back).
      const yJ = jaw[1],
        zBack = Math.min(jaw[2], trunkBack(Math.max(shoulder + 0.03 * kk, yEnd)))
      const steps = yEnd < yJ - 1e-4 ? Math.max(2, Math.ceil((yJ - yEnd) / (0.05 * kk))) : 0
      for (let q = 1; q <= steps; q++) {
        const y = lerp(yJ, yEnd, q / steps),
          w = smooth((yJ - y) / Math.max(1e-6, yJ - shoulder))
        if (stays) {
          // In front of the shoulder: where the body is, it is no wider than a little in from the trunk's own side (never out over the arm), and never behind its front.
          const half = reach(i.trunk ?? [], s.rest, [head[0], y + head[1], 0], [1, 0, 0]),
            x = half > 0 ? Math.sign(jaw[0]) * Math.min(Math.abs(jaw[0]), 0.7 * half) : jaw[0]
          // The trunk's front a half step either side too: the spline between the samples must not cut a corner through a bust or a shoulder.
          const half2 = (0.5 * (yJ - yEnd)) / steps
          path.push([
            x,
            y,
            Math.max(jaw[2], trunkFront(x, y), trunkFront(x, y + half2), trunkFront(x, y - half2)),
          ])
          continue
        }
        // It follows the back and the tops of the shoulders: narrowing toward the spine as it falls, never out.
        path.push([jaw[0] * (1 - 0.3 * w), y, Math.min(lerp(jaw[2], zBack, w), trunkBack(y))])
      }
      let P = spline(path, 40)
      if (curl > 0 && steps) {
        // A wave (curl under a half) or a spiral (from a half): about the path below the jaw, out and across it, fading in.
        const radial = normalize([jaw[0], 0, jaw[2] - k.c[2]]),
          tangent: V3 = [-radial[2], 0, radial[0]],
          amp = ra * (0.4 + 1.2 * curl),
          cycles = 1.5 + 4 * curl,
          ph = hash(j * 5 + 2) * 2 * Math.PI
        P = P.map((p, n) => {
          const q = n / (P.length - 1),
            f =
              smooth((yJ - p[1]) / Math.max(1e-6, (yJ - yEnd) * 0.25)) *
              (p[1] < yJ ? 1 : 0) *
              (1 - 0.7 * smooth((q - 0.8) / 0.2))
          if (!f) return p
          const th = 2 * Math.PI * cycles * q + ph,
            c = curl < 0.5 ? Math.sin(th) : Math.cos(th),
            t = curl < 0.5 ? 0 : Math.sin(th)
          const q2 = add(p, add(scale(radial, c * amp * f), scale(tangent, t * amp * f)))
          return [
            q2[0],
            q2[1],
            stays ? Math.max(q2[2], trunkFront(q2[0], q2[1])) : Math.min(q2[2], trunkBack(q2[1])),
          ] as V3
        })
      }
      // The ends' turn: over the last fifth of the clump, below the jaw, toward the neck (positive) or out (negative), still clear of the trunk.
      if (turn && steps) {
        const radial = (p: V3) => normalize([p[0], 0, p[2] - k.c[2]])
        P = P.map((p, n) => {
          const f = smooth((n / (P.length - 1) - 0.8) / 0.2) * smooth((yJ - p[1]) / (0.03 * kk))
          if (!f) return p
          const q2 = add(p, scale(radial(p), -turn * 2 * ra * f))
          return [
            q2[0],
            q2[1],
            stays ? Math.max(q2[2], trunkFront(q2[0], q2[1])) : Math.min(q2[2], trunkBack(q2[1])),
          ] as V3
        })
      }
      const { mesh, lit, t } = sweep(P, rope, hw, (p) => normalize([p[0], 0, p[2] - k.c[2]]))
      const bone = sideRide ? (Math.sin(a) > 0 ? 'hair.L' : 'hair.R') : 'hair.back'
      const swing = 0.5,
        swingOf = (tt: number): [number, number][] => {
          const w = smooth((tt - 0.08) / 0.4),
            lay = smooth((tt - 0.45) / 0.55) * (1 - swing)
          return [
            [J.head, 1 - w],
            [J[bone], w * (1 - lay)],
            [J.neck, w * lay],
          ]
        }
      if (o.rest === 'trunk') {
        // Skinned by the vertex's own height: u runs 0 at the chin to 1 at the shoulder line, and the head's skinning gives way to the chest's.
        const ys = mesh.positions.filter((_, n) => n % 3 === 1)
        hung(
          mesh,
          ys.map((_, n) => n),
          'hair',
          (n) => {
            const u = smooth((chin - ys[n]) / (chin - shoulder))
            return [...swingOf(t[n]).map(([b, w]) => [b, w * (1 - u)] as [number, number]), [J.chest, u]]
          },
          seam++,
          lit,
          curl >= 0.5 ? true : undefined,
        )
        continue
      }
      hung(mesh, t, 'hair', swingOf, seam++, lit, curl >= 0.5 ? true : undefined)
    }
  }
  /**
   * A fringe (`Fringe`): each clump from the crown over the scalp to the hairline on the head's own form, then down the
   * forehead (on the form) and, below the brow, down in front of the face (a plane clear of the nose by the rope and a
   * texel), past the chin in front of the neck and over the chest clear of the dressed trunk (`frontOf`, as `Fall.front`).
   * `sweep` drifts the clumps toward a side as they fall. The tip of a clump of length 1 stops a texel over the brow, above any eye.
   */
  function fringe(o: Fringe) {
    const rope: Rope = { ...o.rope, root: 0.02 },
      ra = rope.r * hw,
      texel = 1 / ppm,
      clear = ra * 1.2 + texel,
      g = s.genes,
      h = g.head,
      hd = (h * g.headDepth) / 2
    const chin = s.chinY - head[1],
      chest = s.chestY - head[1],
      shoulder = s.shoulderY - head[1],
      front = frontOf(clear)
    const lift = rope.r * 1.3 + texel / hw,
      length = clamp(o.length, 0, 3),
      comb = clamp(o.sweep ?? 0, -1, 1)
    // The levels a length names, head space: the hairline, a tip over the brow, the chin, the chest.
    const Y0 = onHead(form, k, 0, along(o.from, 0), lift)[1],
      Y1 = Math.min(Y0, chin + 0.6 * h + ra + texel),
      Y2 = chin + ra,
      Y3 = chest
    const yEnd =
      length <= 1 ? lerp(Y0, Y1, length) : length <= 2 ? lerp(Y1, Y2, length - 1) : lerp(Y2, Y3, length - 2)
    // The face's front plane: the nose's tip, then the rope and a texel clear of it; the forehead above the brow rides the head's own form.
    const zFace = hd * (g.faceAhead + 1.15 + 0.08 * m.face.bridge) + clear,
      yBrow = chin + 0.6 * h
    const unit = (y: number) => clamp((2 * (y - chin)) / h - 1, -1, 1)
    for (let j = 0; j < o.count; j++) {
      const a0 = o.count === 1 ? 0 : -o.width + (2 * o.width * j) / (o.count - 1),
        path: V3[] = []
      const aAt = (y: number) =>
        a0 + comb * o.width * 1.2 * clamp((Y0 - y) / Math.max(1e-6, Y0 - Math.min(yEnd, Y1)), 0, 1)
      // From the crown to the hairline, on the form.
      for (let q = 0; q <= 4; q++) path.push(onHead(form, k, a0, lerp(0.97, along(o.from, a0), q / 4), lift))
      const yH = path[path.length - 1][1],
        steps = yEnd < yH - 1e-4 ? Math.max(2, Math.ceil((yH - yEnd) / (0.04 * m.k))) : 0
      for (let q = 1; q <= steps; q++) {
        const y = lerp(yH, yEnd, q / steps),
          a = aAt(y),
          on = onHead(form, k, a, unit(Math.max(y, yBrow)), lift)
        // Above the brow, on the head's form; below it, a plane in front of the face (and of the trunk where it is, past the chin).
        path.push(
          y >= yBrow
            ? onHead(form, k, a, unit(y), lift)
            : [
                on[0],
                y,
                Math.max(on[2], zFace, front(on[0], y), front(on[0], y + (0.5 * (yH - yEnd)) / steps)),
              ],
        )
      }
      const { mesh, lit } = sweep(spline(path, 24), { tip: 'round', ...rope }, hw, (p) =>
        normalize(sub(p, k.c)),
      )
      // Rigid on the head to the chin; past it, skinned by height from the head's to the chest's, as `Fall.rest: 'trunk'`.
      if (length <= 2) rigid(mesh, 'hair', seam++, lit)
      else {
        const ys = mesh.positions.filter((_, n) => n % 3 === 1)
        hung(
          mesh,
          ys.map((_, n) => n),
          'hair',
          (n) => {
            const u = smooth((chin - ys[n]) / (chin - shoulder))
            return [
              [J.head, 1 - u],
              [J.chest, u],
            ]
          },
          seam++,
          lit,
        )
      }
    }
  }
  /**
   * A high ponytail: tied on the crown, its ropes gathered in a ring at the tie, rising out of it, arcing back over the
   * top and falling onto the back of the head still gathered (narrower than the head, so the round skull and the rows
   * climbing it to the tie show either side), then down the back, fanning a little, clear of the dressed trunk by a
   * rope and a texel. Every other rope is thinner and in the hair's dark, sunk between its neighbours on either face: the
   * partings between the ropes, seen from behind and from the side alike. Their plaits run on a slant, turned against their neighbours' and half a bead apart, so the tail reads as ropes
   * running down in a herringbone, never as rungs across it.
   */
  function tail(o: Tail) {
    const base = toHead(form, k, o.at, 0.05),
      g = s.genes,
      kk = m.k
    // A low pony's ropes gather in a ring across the fall (horizontal), its axis straight up; a high one's axis is out of the crown.
    const up: V3 = o.hang ? [0, 1, 0] : normalize(sub(base, k.c)),
      side: V3 = o.hang ? [1, 0, 0] : normalize(cross(up, [0, 0, 1])),
      fore: V3 = o.hang ? [0, 0, 1] : cross(side, up)
    const texel = 1 / ppm,
      ar = o.rope.r * hw,
      shoulder = s.shoulderY - head[1],
      end = shoulder - o.length * g.head
    const rise = o.rise * g.head,
      tie = add(base, scale(up, rise * 0.45)),
      bundle = o.spread[0] * hw,
      x1 = o.spread[1] * hw,
      clear = ar * 1.2 + texel
    // The back of the head at a height (head space), and the dressed trunk's furthest back down the tail's length.
    const headBack = (y: number) => form.back(clamp(y / form.h, 0.02, 0.98))
    const trunkBack = (y: number) => {
      const r = reach(i.trunk ?? [], s.rest, [0, y + head[1], 0], [0, 0, -1])
      return r > 0 ? -r - head[2] : Infinity
    }
    const hang =
      Math.min(
        headBack(k.c[1] - 0.6 * k.r[1]),
        ...[0, 0.2, 0.4, 0.6, 0.8, 1].map((q) => trunkBack(lerp(shoulder + 0.03 * kk, end, q))),
      ) - clear
    // Its fall stands off the back of the head as it comes down from the crown (the nape shows under it in profile, and
    // in three-quarter the tail shows past the head), and hangs from the shoulder blades.
    const nape = k.c[1] - 0.55 * k.r[1],
      off = 0.25,
      napeZ = Math.min(headBack(nape) - off * k.r[2], trunkBack(nape)) - clear
    for (let r = 0; r < o.count; r++) {
      const u = o.count === 1 ? 0 : (r / (o.count - 1)) * 2 - 1,
        ring = (2 * Math.PI * (r + 0.5)) / o.count,
        jit = hash(r * 7 + 3) - 0.5
      // A layer out from the back (−z) for the ropes on top, so those under lie nearer the body, between them.
      const top = r % 2 === 0,
        layer = 0,
        x = (w: number) => u * lerp(bundle, x1, w)
      const at = (p: V3, w: number) =>
        add(p, add(scale(side, Math.cos(ring) * bundle * w), scale(fore, Math.sin(ring) * bundle * w)))
      // A low pony runs from its tie straight down the back of the head to the nape: no rise, no arc.
      const down = (y: number) =>
        [x(0.15), y, Math.min(headBack(y) - off * 0.6 * k.r[2], base[2]) - clear - layer] as V3
      const path: V3[] = [
        at(base, 0.8),
        at(tie, 1),
        ...(o.hang
          ? [down((base[1] + nape) / 2)]
          : [
              // Up out of the tie, over the top still gathered, and down onto the back of the head.
              add(at(tie, 1.05), add(scale(up, rise * 0.45), [0, 0, -0.25 * k.r[2]])),
              add(at(tie, 1.15), [0, rise * 0.3, -0.62 * k.r[2] - layer]),
              [
                x(0.15),
                k.c[1] + 0.5 * k.r[1],
                headBack(k.c[1] + 0.5 * k.r[1]) - off * 0.6 * k.r[2] - clear - layer,
              ] as V3,
            ]),
        [x(0.4), nape, napeZ - layer],
        [x(0.85), shoulder, Math.min(napeZ, hang) - layer],
        [x(1), end + jit * 0.1 * g.head, hang - layer - 0.01 * kk],
      ]
      // The ropes on top plait on a slant, turned against the next one's and half a bead on; those under are its partings.
      const n2 = r >> 1,
        rope: Rope = top
          ? {
              ...o.rope,
              root: 0.02,
              phase: (n2 % 2) * 0.5 + hash(r * 5 + 1) * 0.2,
              slant: (n2 % 2 ? 1 : -1) * (o.rope.slant ?? 0),
            }
          : { ...o.rope, r: o.rope.r * 0.7, root: 0.02, plait: false }
      const { mesh, lit, t } = sweep(path, rope, hw, (_p, tt) => (tt < 0.2 ? fore : [0, 0, -1]))
      // The top rides the head, the length swings from the back pivot and settles toward the neck as it falls (never the
      // chest: a heavy tail skinned to it would ride the torso's turn and lean).
      const swing = 0.5,
        swingOf = (tt: number): [number, number][] => {
          const w = smooth((tt - 0.08) / 0.4),
            lay = smooth((tt - 0.45) / 0.55) * (1 - swing)
          return [
            [J.head, 1 - w],
            [J['hair.back'], w * (1 - lay)],
            [J.neck, w * lay],
          ]
        }
      hung(mesh, t, top ? 'hair' : 'parting', swingOf, seam++, lit, o.matte)
      // A cuff on every other braid near its end, staggered, only where it can be two texels tall (from three times the
      // brand kit's density): below that a cuff is a speck.
      if (o.cuffs && top && ppm >= PPM * 1.5) {
        const P = spline(path, 20),
          q = 14 + Math.round(hash(r * 11 + 1) * 4),
          c = P[q],
          dir = normalize(sub(P[q + 1], P[q - 1]))
        const cuff = superquadric({
          at: c,
          r: [ar * 1.15, texels(0.03 * g.head, ppm, 2) / 2, ar * 1.15],
          e: [0.3, 1],
          seg: 8,
          rings: 4,
          turn: alignY(dir),
        })
        hung(
          cuff,
          cuff.positions.filter((_, n) => n % 3 === 0).map(() => 0.85),
          o.cuffs,
          swingOf,
          seam++,
        )
      }
    }
    // The tie: a band round the gathered ropes where they rise from the crown, whole texels tall (two at the judged
    // size), so it reads as the pony's root.
    const band = tieOf(o.tie)
    if (band)
      parts.push({
        bone: J.head,
        mesh: superquadric({
          at: add(base, scale(up, rise * 0.3)),
          r: [bundle + ar * 1.1, texels(0.05 * g.head, ppm) / 2, bundle + ar * 1.1],
          e: [0.25, 1],
          seg: 14,
          rings: 4,
          turn: alignY(up),
        }),
        material: band,
        group: 1,
        seam: seam++,
      })
  }
  return { parts, decals, materials: made }
}
