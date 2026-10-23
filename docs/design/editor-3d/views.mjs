// Viewport drawings for the 3D editor mockups, from real Last Light geometry (data.mjs):
// a top-down plan, a cutaway "dollhouse" at the game's 30 degree pitch, a first-person walk view and thumbnails.
// Every renderer returns SVG text (plus labels to set as real text), so one drawing serves HTML and Figma.
//
// Self-contained on purpose: the Figma kit stringifies makeViews and runs it inside `use_figma`.

export function makeViews(S, D) {
  // Viewport colours. The ent/* tokens are the 3D editor's own; Figma binds them to the "Editor 3D" collection.
  const ENT = {
    'ent/wall': '#cfd3dc',
    'ent/portal': '#5aa9e6',
    'ent/door': '#d98c5f',
    'ent/window': '#7fd1e8',
    'ent/hotspot': '#e8836b',
    'ent/lamp': '#f4e285',
    'ent/spawn': '#6fbf73',
    'ent/anchor': '#f08fc0',
    'ent/nav': '#4fd1c5',
    'ent/zone': '#a78bfa',
    'ent/box': '#8f9bb3',
    'view/plan': '#0c0d10',
    'view/game': '#07080a',
  }
  S.defineTokens(ENT)
  const P = (k) => ENT[k]
  const AMBER = S.tokens['accent/default']
  const INK = S.tokens['bg/app']

  // ── small helpers ──
  const hexRgb = (h) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16))
  const rgbHex = (c) =>
    `#${c
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')}`
  const mix = (a, b, t) => {
    const p = hexRgb(a)
    const q = hexRgb(b)
    return rgbHex(p.map((v, i) => v + (q[i] - v) * t))
  }
  const scale = (h, k) => rgbHex(hexRgb(h).map((v) => v * k))
  const f1 = (n) => +n.toFixed(1)
  const svgOf = (w, h, body) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`
  const pts = (a) => a.map((p) => `${f1(p[0])},${f1(p[1])}`).join(' ')
  const poly = (a, attrs) => `<polygon points="${pts(a)}" ${attrs}/>`
  const room = (scene, id) => D.scenes[scene].rooms.find((r) => r.id === id)

  // Signed area in the (x, z) plane; the interior normal of edge a to b follows from it.
  const area = (p) => {
    let s = 0
    for (let i = 0; i < p.length; i++) {
      const a = p[i]
      const b = p[(i + 1) % p.length]
      s += a[0] * b[1] - b[0] * a[1]
    }
    return s / 2
  }
  const interiorNormal = (a, b, ar) => {
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const l = Math.hypot(dx, dz) || 1
    return ar > 0 ? [-dz / l, dx / l] : [dz / l, -dx / l]
  }
  const bounds = (list) => {
    const xs = list.map((p) => p[0])
    const zs = list.map((p) => p[1])
    return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }
  }

  // ── Plan ──
  // o: scene, w, h, cx, cz (world point at the centre), ppm (pixels per metre), sel (room ids),
  //    layers { nav, hot, lamps, boxes, zones, verts, labels }, draft, drag, cam, rulers, flag
  const plan = (o) => {
    const sc = D.scenes[o.scene || 'clinic']
    const { w, h, ppm } = o
    const X = (x) => f1((x - o.cx) * ppm + w / 2)
    const Y = (z) => f1((z - o.cz) * ppm + h / 2)
    const L = {
      nav: true,
      hot: true,
      lamps: true,
      boxes: true,
      zones: false,
      verts: true,
      labels: true,
      ...(o.layers || {}),
    }
    const sel = new Set(o.sel || [])
    const out = []
    const labels = []

    // grid: minor every `grid` metres, major at whole metres
    const g = o.grid || 0.5
    let minor = ''
    let major = ''
    const i0 = Math.ceil((o.cx - w / 2 / ppm) / g)
    const i1 = Math.floor((o.cx + w / 2 / ppm) / g)
    for (let i = i0; i <= i1; i++) {
      const x = i * g
      const d = `M${X(x)} 0V${h}`
      if (Math.abs(x - Math.round(x)) < 1e-6) major += d
      else minor += d
    }
    const j0 = Math.ceil((o.cz - h / 2 / ppm) / g)
    const j1 = Math.floor((o.cz + h / 2 / ppm) / g)
    for (let j = j0; j <= j1; j++) {
      const z = j * g
      const d = `M0 ${Y(z)}H${w}`
      if (Math.abs(z - Math.round(z)) < 1e-6) major += d
      else minor += d
    }
    if (minor) out.push(`<path d="${minor}" stroke="#ffffff" stroke-opacity=".045" stroke-width="1"/>`)
    out.push(`<path d="${major}" stroke="#ffffff" stroke-opacity=".09" stroke-width="1"/>`)

    // camera zones sit under the rooms
    if (L.zones && sc.zones) {
      const zr = [
        { id: 'corridor', x0: -6, x1: 6, z0: -8.5, z1: -1.25 },
        { id: 'closet', x0: 1.7, x1: 6, z0: -8.5, z1: -1.25 },
      ]
      for (const z of zr) {
        out.push(
          `<rect x="${X(z.x0)}" y="${Y(z.z0)}" width="${f1((z.x1 - z.x0) * ppm)}" height="${f1((z.z1 - z.z0) * ppm)}" fill="${P('ent/zone')}" fill-opacity=".05" stroke="${P('ent/zone')}" stroke-opacity=".8" stroke-width="1.5" stroke-dasharray="3 5"/>`,
        )
        labels.push({
          x: X(z.x0) + 8,
          y: Y(z.z0) + 6,
          w: 200,
          text: `camera zone ${z.id}`,
          tone: 'zone',
          mono: true,
        })
      }
    }

    // room fills, tinted by floor height
    const FLOOR = {
      hall: '#262b36',
      ward: '#252c38',
      counter: '#4a4032',
      mouth: '#22262f',
      corridor: '#1f232b',
      doorway: '#22262f',
      closet: '#272c34',
    }
    for (const r of sc.rooms) {
      const d =
        `M${r.pts.map((p) => `${X(p[0])} ${Y(p[1])}`).join('L')}Z` +
        (r.holes || []).map((hh) => `M${hh.map((p) => `${X(p[0])} ${Y(p[1])}`).join('L')}Z`).join('')
      const fill = FLOOR[r.id] || mix('#1d2128', '#3a4458', Math.min(1, r.f / 1.1))
      out.push(`<path d="${d}" fill="${fill}" fill-rule="evenodd"/>`)
      if (sel.has(r.id)) out.push(`<path d="${d}" fill="${AMBER}" fill-opacity=".16" fill-rule="evenodd"/>`)
    }

    // walls: solid, portal, door and window pieces
    const solids = []
    const selSolids = []
    const portals = []
    const doors = []
    const windows = []
    for (const r of sc.rooms) {
      const n = r.pts.length
      for (let i = 0; i < n; i++) {
        const a = r.pts[i]
        const b = r.pts[(i + 1) % n]
        const fl = a[2] || ''
        const seg = `M${X(a[0])} ${Y(a[1])}L${X(b[0])} ${Y(b[1])}`
        if (fl.includes('p')) portals.push(seg)
        else (sel.has(r.id) ? selSolids : solids).push(seg)
        const mx = (a[0] + b[0]) / 2
        const mz = (a[1] + b[1]) / 2
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
        const ux = (b[0] - a[0]) / len
        const uz = (b[1] - a[1]) / len
        const piece = (cx, cz, half) =>
          `M${X(cx - ux * half)} ${Y(cz - uz * half)}L${X(cx + ux * half)} ${Y(cz + uz * half)}`
        if (fl.includes('d')) doors.push(piece(mx, mz, Math.min(0.5, len / 3)))
        if (fl.includes('w'))
          windows.push(piece(a[0] + ux * len * 0.3, a[1] + uz * len * 0.3, Math.min(0.3, len / 6)))
      }
      for (const hh of r.holes || []) {
        const d = `M${hh.map((p) => `${X(p[0])} ${Y(p[1])}`).join('L')}Z`
        solids.push(d)
      }
    }
    const stroke = (d, c, wd, extra = '') =>
      d.length
        ? `<path d="${d.join('')}" fill="none" stroke="${c}" stroke-width="${wd}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`
        : ''
    out.push(stroke(solids, '#b4bac6', 2.5))
    out.push(stroke(portals, P('ent/portal'), 1.75, 'stroke-dasharray="6 4"'))
    out.push(stroke(selSolids, AMBER, 3.5))
    out.push(stroke(doors, P('ent/door'), 5))
    out.push(stroke(windows, P('ent/window'), 4))

    // boxes
    if (L.boxes && sc.boxList) {
      for (const b of sc.boxList) {
        const c = b[7] === 'door' ? P('ent/door') : P('ent/box')
        out.push(
          `<rect x="${X(b[1] - b[4] / 2)}" y="${Y(b[2] - b[6] / 2)}" width="${f1(b[4] * ppm)}" height="${f1(b[6] * ppm)}" fill="${c}" fill-opacity=".2" stroke="${c}" stroke-opacity=".85" stroke-width="1.25"/>`,
        )
      }
    }

    // nav graph
    if (L.nav && sc.nav) {
      let d = ''
      for (const e of sc.nav.edges) {
        const a = sc.nav.nodes[e[0]]
        const b = sc.nav.nodes[e[1]]
        d += `M${X(a[0])} ${Y(a[1])}L${X(b[0])} ${Y(b[1])}`
      }
      out.push(`<path d="${d}" stroke="${P('ent/nav')}" stroke-opacity=".6" stroke-width="1.5" fill="none"/>`)
      for (const k of Object.keys(sc.nav.nodes)) {
        const n = sc.nav.nodes[k]
        out.push(
          `<circle cx="${X(n[0])}" cy="${Y(n[1])}" r="3.5" fill="${P('ent/nav')}" stroke="${INK}" stroke-width="1"/>`,
        )
      }
    }

    // hotspots (with their reach when asked), lamps, spawn
    if (L.hot && sc.hotspots) {
      for (const hs of sc.hotspots) {
        if (o.reach?.includes(hs[0])) {
          out.push(
            `<circle cx="${X(hs[1])}" cy="${Y(hs[2])}" r="${f1(hs[3] * ppm)}" fill="${P('ent/hotspot')}" fill-opacity=".07" stroke="${P('ent/hotspot')}" stroke-opacity=".5" stroke-dasharray="4 4"/>`,
          )
        }
        out.push(
          `<circle cx="${X(hs[1])}" cy="${Y(hs[2])}" r="5.5" fill="${P('ent/hotspot')}" stroke="${INK}" stroke-width="1.5"/>`,
        )
      }
    }
    if (L.lamps && sc.lampList) {
      for (const lp of sc.lampList) {
        const x = X(lp[2])
        const y = Y(lp[4])
        if (o.lampRange && o.lampRange === lp[0]) {
          out.push(
            `<circle cx="${x}" cy="${y}" r="${f1(lp[5] * ppm)}" fill="${P('ent/lamp')}" fill-opacity=".07" stroke="${P('ent/lamp')}" stroke-opacity=".45" stroke-dasharray="4 4"/>`,
          )
        }
        out.push(
          `<path d="M${x} ${y - 6.5}L${x + 6.5} ${y}L${x} ${y + 6.5}L${x - 6.5} ${y}Z" fill="${P('ent/lamp')}" stroke="${INK}" stroke-width="1.5"/>`,
        )
      }
    }
    const [sx, sz, sf] = sc.spawn
    const dir = [Math.sin(sf), Math.cos(sf)]
    const px = -dir[1]
    const pz = dir[0]
    const tip = [X(sx) + dir[0] * 11, Y(sz) + dir[1] * 11]
    out.push(
      poly(
        [
          tip,
          [X(sx) - dir[0] * 6 + px * 7, Y(sz) - dir[1] * 6 + pz * 7],
          [X(sx) - dir[0] * 3, Y(sz) - dir[1] * 3],
          [X(sx) - dir[0] * 6 - px * 7, Y(sz) - dir[1] * 6 - pz * 7],
        ],
        `fill="${P('ent/spawn')}" stroke="${INK}" stroke-width="1.25"`,
      ),
    )

    // vertices
    if (L.verts) {
      for (const r of sc.rooms) {
        const on = sel.has(r.id)
        for (let i = 0; i < r.pts.length; i++) {
          const a = r.pts[i]
          const b = r.pts[(i + 1) % r.pts.length]
          if (on) {
            out.push(
              `<circle cx="${X((a[0] + b[0]) / 2)}" cy="${Y((a[1] + b[1]) / 2)}" r="3" fill="${AMBER}" fill-opacity=".55"/>`,
            )
            out.push(
              `<rect x="${X(a[0]) - 4.5}" y="${Y(a[1]) - 4.5}" width="9" height="9" fill="#e8e6e1" stroke="${AMBER}" stroke-width="2"/>`,
            )
          } else out.push(`<rect x="${X(a[0]) - 2}" y="${Y(a[1]) - 2}" width="4" height="4" fill="#b4bac6"/>`)
        }
      }
    }

    // draft sector (the draw tool in progress)
    if (o.draft) {
      const d = o.draft
      const all = [...d.pts, d.cursor]
      out.push(
        poly(
          all.map((p) => [X(p[0]), Y(p[1])]),
          `fill="${AMBER}" fill-opacity=".13"`,
        ),
      )
      out.push(
        `<path d="M${d.pts.map((p) => `${X(p[0])} ${Y(p[1])}`).join('L')}" fill="none" stroke="${AMBER}" stroke-width="2.5" stroke-linejoin="round"/>`,
      )
      const last = d.pts[d.pts.length - 1]
      out.push(
        `<path d="M${X(last[0])} ${Y(last[1])}L${X(d.cursor[0])} ${Y(d.cursor[1])}L${X(d.pts[0][0])} ${Y(d.pts[0][1])}" fill="none" stroke="${AMBER}" stroke-width="2" stroke-dasharray="6 5"/>`,
      )
      for (const p of d.pts)
        out.push(
          `<rect x="${X(p[0]) - 5}" y="${Y(p[1]) - 5}" width="10" height="10" fill="#e8e6e1" stroke="${AMBER}" stroke-width="2"/>`,
        )
      // snap guides through the cursor
      out.push(
        `<path d="M${X(d.cursor[0])} 0V${h}M0 ${Y(d.cursor[1])}H${w}" stroke="${P('ent/nav')}" stroke-opacity=".55" stroke-dasharray="3 5" fill="none"/>`,
      )
      out.push(
        `<circle cx="${X(d.cursor[0])}" cy="${Y(d.cursor[1])}" r="9" fill="none" stroke="${P('ent/nav')}" stroke-width="2"/>`,
      )
      out.push(`<circle cx="${X(d.cursor[0])}" cy="${Y(d.cursor[1])}" r="2.5" fill="${P('ent/nav')}"/>`)
    }

    // a dragged vertex: touch ring, guides and coordinate bubble anchor
    if (o.drag) {
      const x = X(o.drag[0])
      const y = Y(o.drag[1])
      out.push(
        `<path d="M${x} 0V${h}M0 ${y}H${w}" stroke="${P('ent/nav')}" stroke-opacity=".55" stroke-dasharray="3 5" fill="none"/>`,
      )
      out.push(
        `<circle cx="${x}" cy="${y}" r="24" fill="${AMBER}" fill-opacity=".14" stroke="${AMBER}" stroke-opacity=".7" stroke-width="1.5"/>`,
      )
      out.push(
        `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" fill="#e8e6e1" stroke="${AMBER}" stroke-width="2.5"/>`,
      )
    }

    // 3D camera wedge
    if (o.cam) {
      const c = o.cam
      const x = X(c.x)
      const y = Y(c.z)
      const r = 64
      const half = (c.fov || 1.15) / 2
      const a0 = c.yaw - half
      const a1 = c.yaw + half
      const at = (a) => [x + Math.sin(a) * r, y - Math.cos(a) * r]
      const p0 = at(a0)
      const p1 = at(a1)
      out.push(
        `<path d="M${x} ${y}L${f1(p0[0])} ${f1(p0[1])}A${r} ${r} 0 0 1 ${f1(p1[0])} ${f1(p1[1])}Z" fill="#e8e6e1" fill-opacity=".1" stroke="#e8e6e1" stroke-opacity=".55" stroke-width="1.25"/>`,
      )
      out.push(`<circle cx="${x}" cy="${y}" r="6" fill="#e8e6e1" stroke="${INK}" stroke-width="2"/>`)
    }

    // room labels
    if (L.labels) {
      for (const r of sc.rooms) {
        if (r.pts.length < 4 && r.id === 'doorway') continue
        const b = bounds(r.pts)
        const wide = (b.x1 - b.x0) * ppm
        const high = (b.z1 - b.z0) * ppm
        if (wide < 34 || high < 22) continue
        let lx = (b.x0 + b.x1) / 2
        let lz = (b.z0 + b.z1) / 2
        if (r.id === 'hall') {
          lx = 0
          lz = 4.6
        }
        if (r.id === 'ward') {
          lx = -3.4
          lz = -2.4
        }
        labels.push({
          x: X(lx) - 70,
          y: Y(lz) - 8,
          w: 140,
          text: r.id,
          sub: wide > 70 && high > 40 ? `F ${r.f.toFixed(2)}  C ${r.c.toFixed(2)}` : '',
          tone: sel.has(r.id) ? 'sel' : 'room',
        })
      }
    }

    // rulers: a strip along the top and the left, ticks at whole metres
    if (o.rulers) {
      const rs = 20
      let t = ''
      for (let i = Math.ceil(o.cx - w / 2 / ppm); i <= Math.floor(o.cx + w / 2 / ppm); i++) {
        t += `M${X(i)} ${rs}V${i % 2 === 0 ? rs - 9 : rs - 5}`
        if (i % 2 === 0 && X(i) > 30)
          labels.push({
            x: X(i) - 20,
            y: 1,
            w: 40,
            text: String(i),
            tone: 'ruler',
            mono: true,
            align: 'center',
          })
      }
      for (let i = Math.ceil(o.cz - h / 2 / ppm); i <= Math.floor(o.cz + h / 2 / ppm); i++) {
        t += `M${rs} ${Y(i)}H${i % 2 === 0 ? rs - 9 : rs - 5}`
        if (i % 2 === 0 && Y(i) > 34)
          labels.push({
            x: 0,
            y: Y(i) - 7,
            w: 11,
            text: String(i),
            tone: 'ruler',
            mono: true,
            align: 'right',
          })
      }
      out.push(
        `<rect x="0" y="0" width="${w}" height="${rs}" fill="#15161a" fill-opacity=".92"/><rect x="0" y="0" width="${rs}" height="${h}" fill="#15161a" fill-opacity=".92"/>`,
      )
      out.push(`<path d="${t}" stroke="#8e8c85" stroke-width="1" stroke-opacity=".8"/>`)
    }

    return { svg: svgOf(w, h, out.join('')), labels, X, Y }
  }

  // ── Dollhouse: cutaway orthographic view at the game's pitch ──
  // o: scene, w, h, yaw, pitch, s (px per metre), cx, cz, dy, sel (room id), lamps (bool)
  const doll = (o) => {
    const sc = D.scenes[o.scene || 'clinic']
    const { w, h } = o
    const yaw = o.yaw == null ? -0.62 : o.yaw
    const pitch = o.pitch == null ? 0.5236 : o.pitch
    const s = o.s || 34
    const cy = Math.cos(yaw)
    const sy = Math.sin(yaw)
    const cp = Math.cos(pitch)
    const sp = Math.sin(pitch)
    const toCam = [-sy, cy]
    const rot = (x, z) => [(x - o.cx) * cy + (z - o.cz) * sy, -(x - o.cx) * sy + (z - o.cz) * cy]
    const pr = (x, y, z) => {
      const [xr, zr] = rot(x, z)
      return [w / 2 + xr * s, h / 2 + (o.dy || 0) + (zr * sp - y * cp) * s]
    }
    const dep = (x, y, z) => rot(x, z)[1] * cp + y * sp
    const items = []
    const add = (depth, layer, svg) => items.push({ depth, layer, svg })

    const FLOOR = {
      hall: '#2a303c',
      ward: '#283140',
      counter: '#5a4c39',
      mouth: '#262b35',
      corridor: '#222630',
      doorway: '#262b35',
      closet: '#2b323c',
    }
    const W_LIT = '#566380'
    const W_MID = '#445069'
    const CAP = '#8d99b6'
    const OUT = '#242b3b'
    const selId = o.sel

    for (const r of sc.rooms) {
      const ar = area(r.pts)
      const base = FLOOR[r.id] || '#272c34'
      const floorPoly = r.pts.map((p) => pr(p[0], r.f, p[1]))
      const holes = (r.holes || []).map((hh) => hh.map((p) => pr(p[0], r.f, p[1])))
      const d = `M${floorPoly.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}Z${holes.map((hp) => `M${hp.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}Z`).join('')}`
      let body = `<path d="${d}" fill="${base}" fill-rule="evenodd"/>`
      if (r.id === selId) {
        body += `<path d="${d}" fill="${AMBER}" fill-opacity=".3" fill-rule="evenodd"/>`
        body += `<path d="M${floorPoly.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}Z" fill="none" stroke="${AMBER}" stroke-width="2.5" stroke-linejoin="round"/>`
      }
      add(r.f, 0, body)

      const n = r.pts.length
      for (let i = 0; i < n; i++) {
        const a = r.pts[i]
        const b = r.pts[(i + 1) % n]
        const fl = a[2] || ''
        const nm = interiorNormal(a, b, ar)
        const back = nm[0] * toCam[0] + nm[1] * toCam[1] > 0
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
        if (fl.includes('p')) {
          // a raised neighbour (the counter) shows its sides as risers
          const other = room(o.scene || 'clinic', a[3])
          if (other && r.f > other.f + 0.01 && !back) {
            const q = [
              pr(a[0], r.f, a[1]),
              pr(b[0], r.f, b[1]),
              pr(b[0], other.f, b[1]),
              pr(a[0], other.f, a[1]),
            ]
            add(dep(mid[0], r.f, mid[1]), 1, poly(q, `fill="#7a6a52"`))
            add(
              dep(mid[0], r.f, mid[1]),
              1,
              poly(
                [q[0], q[1], [q[1][0], q[1][1] - 0.01], [q[0][0], q[0][1] - 0.01]],
                `fill="#a8967a" stroke="#a8967a" stroke-width="1"`,
              ),
            )
          }
          continue
        }
        const top = back ? r.c : Math.min(r.c, r.f + 0.45)
        const q = [pr(a[0], r.f, a[1]), pr(b[0], r.f, b[1]), pr(b[0], top, b[1]), pr(a[0], top, a[1])]
        const lit = back ? (nm[0] * 0.55 + nm[1] * 0.83 > 0 ? W_LIT : W_MID) : OUT
        let body2 = poly(q, `fill="${lit}"`)
        if (back) {
          const sk = [
            pr(a[0], r.f, a[1]),
            pr(b[0], r.f, b[1]),
            pr(b[0], r.f + 0.3, b[1]),
            pr(a[0], r.f + 0.3, a[1]),
          ]
          body2 += poly(sk, `fill="#000" fill-opacity=".22"`)
          if (fl.includes('w')) {
            const wa = [a[0] + (b[0] - a[0]) * 0.3, a[1] + (b[1] - a[1]) * 0.3]
            const wb = [a[0] + (b[0] - a[0]) * 0.42, a[1] + (b[1] - a[1]) * 0.42]
            body2 += poly(
              [
                pr(wa[0], r.f + 2.4, wa[1]),
                pr(wb[0], r.f + 2.4, wb[1]),
                pr(wb[0], r.f + 3.1, wb[1]),
                pr(wa[0], r.f + 3.1, wa[1]),
              ],
              `fill="#7fd1e8" fill-opacity=".55"`,
            )
          }
          if (fl.includes('d')) {
            const wa = [a[0] + (b[0] - a[0]) * 0.45, a[1] + (b[1] - a[1]) * 0.45]
            const wb = [a[0] + (b[0] - a[0]) * 0.6, a[1] + (b[1] - a[1]) * 0.6]
            body2 += poly(
              [
                pr(wa[0], r.f, wa[1]),
                pr(wb[0], r.f, wb[1]),
                pr(wb[0], r.f + 2.1, wb[1]),
                pr(wa[0], r.f + 2.1, wa[1]),
              ],
              `fill="#d98c5f" fill-opacity=".75"`,
            )
          }
        }
        // top cap, thickness 0.18 outward
        const th = 0.18
        const a2 = [a[0] - nm[0] * th, a[1] - nm[1] * th]
        const b2 = [b[0] - nm[0] * th, b[1] - nm[1] * th]
        body2 += poly(
          [pr(a[0], top, a[1]), pr(b[0], top, b[1]), pr(b2[0], top, b2[1]), pr(a2[0], top, a2[1])],
          `fill="${CAP}"`,
        )
        add(dep(mid[0], top / 2, mid[1]), 2, body2)
      }
    }

    // light pools under the lamps, then furniture
    if (o.lamps !== false && sc.lampList) {
      for (const lp of sc.lampList) {
        if (lp[3] < 1.8) continue
        const rr = lp[5] * 0.32
        const ring = []
        for (let k = 0; k < 20; k++)
          ring.push(
            pr(
              lp[2] + Math.cos((k / 20) * Math.PI * 2) * rr,
              0.01,
              lp[4] + Math.sin((k / 20) * Math.PI * 2) * rr,
            ),
          )
        add(0.5, 0.5, poly(ring, `fill="#f6c97a" fill-opacity=".09"`))
      }
    }
    const BOX = {
      desk: '#8b6c4c',
      bed: '#8fa0b8',
      bench: '#6f7d92',
      door: '#d98c5f',
      furniture: '#7b8497',
      exit: '#c9704a',
    }
    for (const b of sc.boxList || []) {
      if (b[7] === 'door') continue
      const [, bx, bz, by, bw, bh, bd, kind] = b
      const base = BOX[kind] || '#7b8497'
      const x0 = bx - bw / 2
      const x1 = bx + bw / 2
      const z0 = bz - bd / 2
      const z1 = bz + bd / 2
      const y0 = by - bh / 2
      const y1 = by + bh / 2
      const faces = [
        {
          n: [0, 1],
          c: [
            [x0, z1],
            [x1, z1],
          ],
        },
        {
          n: [0, -1],
          c: [
            [x0, z0],
            [x1, z0],
          ],
        },
        {
          n: [1, 0],
          c: [
            [x1, z0],
            [x1, z1],
          ],
        },
        {
          n: [-1, 0],
          c: [
            [x0, z0],
            [x0, z1],
          ],
        },
      ]
      let body = ''
      for (const f of faces) {
        if (f.n[0] * toCam[0] + f.n[1] * toCam[1] <= 0.001) continue
        const sh = f.n[0] * 0.55 + f.n[1] * 0.83 > 0 ? 0.92 : 0.7
        body += poly(
          [
            pr(f.c[0][0], y0, f.c[0][1]),
            pr(f.c[1][0], y0, f.c[1][1]),
            pr(f.c[1][0], y1, f.c[1][1]),
            pr(f.c[0][0], y1, f.c[0][1]),
          ],
          `fill="${scale(base, sh)}"`,
        )
      }
      body += poly(
        [pr(x0, y1, z0), pr(x1, y1, z0), pr(x1, y1, z1), pr(x0, y1, z1)],
        `fill="${mix(base, '#ffffff', 0.18)}"`,
      )
      add(dep(bx, by, bz) + 0.2, 2, body)
    }

    // the selected room's ceiling outline, to read its height
    let handle = null
    if (selId) {
      const r = room(o.scene || 'clinic', selId)
      const top = r.pts.map((p) => pr(p[0], r.c, p[1]))
      const bot = r.pts.map((p) => pr(p[0], r.f, p[1]))
      let d = `M${top.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}Z`
      for (let i = 0; i < top.length; i++)
        d += `M${f1(top[i][0])} ${f1(top[i][1])}L${f1(bot[i][0])} ${f1(bot[i][1])}`
      add(
        9999,
        3,
        `<path d="${d}" fill="none" stroke="${AMBER}" stroke-width="1.5" stroke-opacity=".75" stroke-dasharray="5 4"/>`,
      )
      const b = bounds(r.pts)
      handle = {
        ceil: pr((b.x0 + b.x1) / 2, r.c, (b.z0 + b.z1) / 2),
        floor: pr((b.x0 + b.x1) / 2, r.f, (b.z0 + b.z1) / 2),
      }
    }

    items.sort((p, q) => p.layer - q.layer || p.depth - q.depth)
    // floors first (layer 0), pools, then walls and boxes together by depth
    const floors = items.filter((i) => i.layer === 0 || i.layer === 0.5)
    const rest = items
      .filter((i) => i.layer >= 1)
      .sort((p, q) => (p.layer === 3 || q.layer === 3 ? p.layer - q.layer : p.depth - q.depth))
    return { svg: svgOf(w, h, [...floors, ...rest].map((i) => i.svg).join('')), handle }
  }

  // ── First person ──
  // o: scene, w, h, cam { x, y, z, yaw }, fov, sel { room, edge }
  const walk = (o) => {
    const sc = D.scenes[o.scene || 'clinic']
    const { w, h } = o
    const cam = o.cam
    const fov = o.fov || 1.2
    const focal = w / 2 / Math.tan(fov / 2)
    const fx = Math.sin(cam.yaw)
    const fz = -Math.cos(cam.yaw)
    const rx = Math.cos(cam.yaw)
    const rz = Math.sin(cam.yaw)
    const NEAR = 0.12
    const toC = (x, y, z) => [
      (x - cam.x) * rx + (z - cam.z) * rz,
      y - cam.y,
      (x - cam.x) * fx + (z - cam.z) * fz,
    ]
    const clip = (poly3) => {
      const out = []
      for (let i = 0; i < poly3.length; i++) {
        const p = poly3[i]
        const q = poly3[(i + 1) % poly3.length]
        const pin = p[2] >= NEAR
        const qin = q[2] >= NEAR
        if (pin) out.push(p)
        if (pin !== qin) {
          const t = (NEAR - p[2]) / (q[2] - p[2])
          out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, NEAR])
        }
      }
      return out
    }
    const screen = (p) => [w / 2 + (p[0] / p[2]) * focal, h / 2 - (p[1] / p[2]) * focal]
    const drawn = []
    const quad = (world, fill, depthKey, layer, extra = '') => {
      const c = clip(world.map((p) => toC(p[0], p[1], p[2])))
      if (c.length < 3) return
      drawn.push({ layer, depth: depthKey, svg: poly(c.map(screen), `fill="${fill}" ${extra}`) })
    }
    const light = (x, z) => {
      let v = 0.3
      for (const lp of sc.lampList || []) {
        if (lp[3] < 1.8 && lp[1] !== 'desk') continue
        const d = Math.hypot(x - lp[2], z - lp[4])
        v += Math.max(0, 1 - d / lp[5]) ** 1.4 * 0.85
      }
      return Math.min(1.35, v)
    }
    const inside = (x, z, poly) => {
      let c = false
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i]
        const b = poly[j]
        if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c
      }
      return c
    }
    // Floor tile lines at whole metres, kept inside the room, near-clipped, as one path per room.
    const tileLines = (r, shadeFn) => {
      const b = bounds(r.pts)
      let d = ''
      const seg = (x0, z0, x1, z1) => {
        let p = toC(x0, r.f, z0)
        let q = toC(x1, r.f, z1)
        if (p[2] < NEAR && q[2] < NEAR) return
        if (p[2] < NEAR)
          p = [
            p[0] + (q[0] - p[0]) * ((NEAR - p[2]) / (q[2] - p[2])),
            p[1] + (q[1] - p[1]) * ((NEAR - p[2]) / (q[2] - p[2])),
            NEAR,
          ]
        if (q[2] < NEAR)
          q = [
            q[0] + (p[0] - q[0]) * ((NEAR - q[2]) / (p[2] - q[2])),
            q[1] + (p[1] - q[1]) * ((NEAR - q[2]) / (p[2] - q[2])),
            NEAR,
          ]
        const a = screen(p)
        const c = screen(q)
        d += `M${f1(a[0])} ${f1(a[1])}L${f1(c[0])} ${f1(c[1])}`
      }
      const step = 0.25
      for (let x = Math.ceil(b.x0); x <= b.x1; x++) {
        for (let z = b.z0; z < b.z1; z += step) {
          const m = z + step / 2
          if (inside(x, m, r.pts) && !(r.holes || []).some((hh) => inside(x, m, hh)))
            seg(x, z, x, Math.min(z + step, b.z1))
        }
      }
      for (let z = Math.ceil(b.z0); z <= b.z1; z++) {
        for (let x = b.x0; x < b.x1; x += step) {
          const m = x + step / 2
          if (inside(m, z, r.pts) && !(r.holes || []).some((hh) => inside(m, z, hh)))
            seg(x, z, Math.min(x + step, b.x1), z)
        }
      }
      return d ? `<path d="${d}" fill="none" stroke="${shadeFn}" stroke-opacity=".55" stroke-width="1"/>` : ''
    }
    const FOG = '#07080a'
    const shade = (hex, x, z, depth, k = 1) => {
      const t = Math.min(1, depth / 15)
      return mix(scale(mix(hex, '#f6d9a8', 0.1), light(x, z) * k), FOG, t * 0.7)
    }
    const FLOOR = {
      hall: '#303745',
      ward: '#2e3848',
      counter: '#6a5a44',
      mouth: '#2a303b',
      corridor: '#262b36',
      doorway: '#2a303b',
      closet: '#323a46',
    }
    const WALL = '#5d6a88'
    const dist = (x, z) => Math.hypot(x - cam.x, z - cam.z)

    for (const r of sc.rooms) {
      const ar = area(r.pts)
      const mx = r.pts.reduce((a, p) => a + p[0], 0) / r.pts.length
      const mz = r.pts.reduce((a, p) => a + p[1], 0) / r.pts.length
      quad(
        r.pts.map((p) => [p[0], r.f, p[1]]),
        shade(FLOOR[r.id] || '#2a303b', mx, mz, dist(mx, mz), 0.9),
        -dist(mx, mz),
        0,
        `stroke="${shade(FLOOR[r.id] || '#2a303b', mx, mz, dist(mx, mz), 0.9)}" stroke-width=".6"`,
      )
      quad(
        r.pts.map((p) => [p[0], r.c, p[1]]),
        shade('#363e50', mx, mz, dist(mx, mz), 0.55),
        -dist(mx, mz),
        0,
      )
      drawn.push({ layer: 0.2, depth: -dist(mx, mz), svg: tileLines(r, '#0b0c10') })
      const n = r.pts.length
      for (let i = 0; i < n; i++) {
        const a = r.pts[i]
        const b = r.pts[(i + 1) % n]
        const fl = a[2] || ''
        const ex = (a[0] + b[0]) / 2
        const ez = (a[1] + b[1]) / 2
        const dd = dist(ex, ez)
        const nm = interiorNormal(a, b, ar)
        if (fl.includes('p')) {
          const other = room(o.scene || 'clinic', a[3])
          if (other && r.c > other.c + 0.01)
            quad(
              [
                [a[0], other.c, a[1]],
                [b[0], other.c, b[1]],
                [b[0], r.c, b[1]],
                [a[0], r.c, a[1]],
              ],
              shade(WALL, ex, ez, dd, 0.8),
              dd,
              1,
            )
          if (other && r.f > other.f + 0.01) {
            quad(
              [
                [a[0], other.f, a[1]],
                [b[0], other.f, b[1]],
                [b[0], r.f, b[1]],
                [a[0], r.f, a[1]],
              ],
              shade('#8a7a60', ex, ez, dd, 0.85),
              dd,
              1,
            )
          }
          continue
        }
        const k = 0.7 + 0.3 * Math.abs(nm[0] * 0.3 + nm[1] * 0.95)
        const isSel = o.sel && o.sel.room === r.id && o.sel.edge === i
        quad(
          [
            [a[0], r.f, a[1]],
            [b[0], r.f, b[1]],
            [b[0], r.c, b[1]],
            [a[0], r.c, a[1]],
          ],
          shade(WALL, ex, ez, dd, k),
          dd,
          1,
        )
        quad(
          [
            [a[0], r.f, a[1]],
            [b[0], r.f, b[1]],
            [b[0], r.f + 0.28, b[1]],
            [a[0], r.f + 0.28, a[1]],
          ],
          shade('#2f3850', ex, ez, dd, 0.9),
          dd - 0.01,
          1,
        )
        quad(
          [
            [a[0], r.c - 0.12, a[1]],
            [b[0], r.c - 0.12, b[1]],
            [b[0], r.c, b[1]],
            [a[0], r.c, a[1]],
          ],
          shade('#8794b4', ex, ez, dd, 0.7),
          dd - 0.01,
          1,
        )
        const lerp = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
        if (fl.includes('d')) {
          const p0 = lerp(0.4)
          const p1 = lerp(0.62)
          quad(
            [
              [p0[0], r.f, p0[1]],
              [p1[0], r.f, p1[1]],
              [p1[0], r.f + 2.1, p1[1]],
              [p0[0], r.f + 2.1, p0[1]],
            ],
            shade('#c47a52', ex, ez, dd, 0.95),
            dd - 0.02,
            1,
          )
        }
        if (fl.includes('w')) {
          const p0 = lerp(0.26)
          const p1 = lerp(0.4)
          quad(
            [
              [p0[0], r.f + 2.35, p0[1]],
              [p1[0], r.f + 2.35, p1[1]],
              [p1[0], r.f + 3.1, p1[1]],
              [p0[0], r.f + 3.1, p0[1]],
            ],
            '#9bd8ee',
            dd - 0.02,
            1,
          )
        }
        if (isSel)
          quad(
            [
              [a[0], r.f, a[1]],
              [b[0], r.f, b[1]],
              [b[0], r.c, b[1]],
              [a[0], r.c, a[1]],
            ],
            AMBER,
            dd - 0.05,
            4,
            `fill-opacity=".32" stroke="${AMBER}" stroke-width="2.5"`,
          )
      }
      for (const hh of r.holes || []) {
        // the hall's counter hole: sides are drawn by the counter room's risers
        void hh
      }
    }
    const BOX = { desk: '#8b6c4c', bed: '#8fa0b8', bench: '#6f7d92', furniture: '#7b8497', exit: '#c9704a' }
    for (const b of sc.boxList || []) {
      if (b[7] === 'door') continue
      const [, bx, bz, by, bw, bh, bd, kind] = b
      const base = BOX[kind] || '#7b8497'
      const x0 = bx - bw / 2
      const x1 = bx + bw / 2
      const z0 = bz - bd / 2
      const z1 = bz + bd / 2
      const y0 = by - bh / 2
      const y1 = by + bh / 2
      const dd = dist(bx, bz)
      const faces = [
        [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0.95, [0, 1]],
        [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], 0.95, [0, -1]],
        [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], 0.75, [1, 0]],
        [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], 0.75, [-1, 0]],
        [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], 1.15, null],
      ]
      for (const f of faces) {
        if (f[5]) {
          const toward = (cam.x - bx) * f[5][0] + (cam.z - bz) * f[5][1]
          const half = f[5][0] ? bw / 2 : bd / 2
          if (toward <= half) continue
        }
        quad(f.slice(0, 4), shade(base, bx, bz, dd, f[4]), dd - 0.1 + (f[5] ? 0 : 0.01), 2)
      }
    }

    // light pools
    for (const lp of sc.lampList || []) {
      if (lp[3] < 1.8) continue
      const rr = lp[5] * 0.3
      const ring = []
      for (let k = 0; k < 24; k++)
        ring.push([
          lp[2] + Math.cos((k / 24) * Math.PI * 2) * rr,
          0.012,
          lp[4] + Math.sin((k / 24) * Math.PI * 2) * rr,
        ])
      quad(ring, '#f6c97a', -dist(lp[2], lp[4]) + 0.5, 0.5, 'fill-opacity=".1"')
    }

    drawn.sort((p, q) => p.layer - q.layer || (p.layer === 0 ? p.depth - q.depth : q.depth - p.depth))
    // walls and boxes share layers 1 to 4: far first
    const lower = drawn.filter((d) => d.layer < 1)
    const upper = drawn
      .filter((d) => d.layer >= 1)
      .sort((p, q) => (p.layer === 4 || q.layer === 4 ? p.layer - q.layer : q.depth - p.depth))
    return {
      svg: svgOf(w, h, [...lower, ...upper].map((d) => d.svg).join('')),
      screen: (x, y, z) => screen(toC(x, y, z)),
    }
  }

  // ── Thumbnails (world view) ──
  const thumb = (sceneId, w, h, o = {}) => {
    const sc = D.scenes[sceneId]
    const all = sc.rooms.flatMap((r) => r.pts)
    const b = bounds(all)
    const pad = o.pad == null ? 12 : o.pad
    const ppm = Math.min((w - pad * 2) / (b.x1 - b.x0), (h - pad * 2) / (b.z1 - b.z0))
    const ox = (w - (b.x1 - b.x0) * ppm) / 2
    const oz = (h - (b.z1 - b.z0) * ppm) / 2
    const X = (x) => f1((x - b.x0) * ppm + ox)
    const Y = (z) => f1((z - b.z0) * ppm + oz)
    const out = []
    let solids = ''
    let portals = ''
    for (const r of sc.rooms) {
      out.push(
        `<path d="M${r.pts.map((p) => `${X(p[0])} ${Y(p[1])}`).join('L')}Z" fill="${o.fill || '#2a3040'}"/>`,
      )
      const n = r.pts.length
      for (let i = 0; i < n; i++) {
        const a = r.pts[i]
        const c = r.pts[(i + 1) % n]
        const seg = `M${X(a[0])} ${Y(a[1])}L${X(c[0])} ${Y(c[1])}`
        if ((a[2] || '').includes('p')) portals += seg
        else solids += seg
      }
    }
    out.push(
      `<path d="${solids}" stroke="${o.wall || '#aeb4c0'}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
    )
    out.push(
      `<path d="${portals}" stroke="${P('ent/portal')}" stroke-width="1" stroke-dasharray="3 3" fill="none"/>`,
    )
    const [sx, sz] = sc.spawn
    out.push(`<circle cx="${X(sx)}" cy="${Y(sz)}" r="3" fill="${P('ent/spawn')}"/>`)
    return { svg: svgOf(w, h, out.join('')), size: [b.x1 - b.x0, b.z1 - b.z0] }
  }

  return { plan, doll, walk, thumb, mix, scale, ENT }
}
