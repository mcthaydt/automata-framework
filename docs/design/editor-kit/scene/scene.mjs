// Scene kit: write a screen once as a small tree of frames, text and vectors, then render the same tree
// to HTML (for artifacts and review) or to Figma frames (auto-layout, token-bound fills, text styles).
//
// `makeScene` is self-contained on purpose: figma.mjs stringifies it to run the same code inside
// `use_figma`, so nothing in it may reference an import or an outer variable.

export function makeScene() {
  // ── Tokens: the Last Light editor look, as the "Editor Kit" Figma variable collection names them ──
  const TOKENS = {
    'bg/app': '#111214',
    'bg/surface': '#1a1b1e',
    'bg/raised': '#23252a',
    'bg/field': '#15161a',
    'bg/canvas': '#0a0b0d',
    'border/default': '#33363c',
    'border/strong': '#454952',
    'text/primary': '#e8e6e1',
    'text/dim': '#8e8c85',
    'text/faint': '#5f5e5a',
    'accent/default': '#e0a54a',
    'accent/ink': '#1a1204',
    'accent/soft': '#e0a54a29',
    'state/ok': '#6fbf73',
    'state/bad': '#d9645a',
    'state/warn': '#e6c35c',
    'layer/sky': '#6aa8e8',
    'layer/city': '#a58be0',
    'layer/tiles': '#6fbf9a',
    'layer/entities': '#e07a6a',
    'layer/intgrid': '#e6c35c',
    'phase/teach': '#5aa9a0',
    'phase/combine': '#7e8de0',
    'phase/recover': '#6fbf73',
    'phase/finish': '#e0734a',
  }
  const NUMBERS = {
    'space/1': 4,
    'space/2': 8,
    'space/3': 12,
    'space/4': 16,
    'space/5': 24,
    'space/6': 32,
    'radius/sm': 6,
    'radius/md': 8,
    'radius/lg': 12,
    'radius/xl': 16,
    'size/hit': 44,
    'size/primary': 48,
  }
  // Text styles, as the Figma file defines them (family, weight, size, line height, letter spacing).
  const TEXT = {
    'Display/20': { mono: false, wt: 600, size: 20, lh: 26, ls: 0 },
    'Title/15': { mono: false, wt: 600, size: 15, lh: 20, ls: 0 },
    'Body/13': { mono: false, wt: 400, size: 13, lh: 18, ls: 0 },
    'Body/13 Medium': { mono: false, wt: 500, size: 13, lh: 18, ls: 0 },
    'Label/12': { mono: false, wt: 500, size: 12, lh: 16, ls: 0 },
    'Eyebrow/11': { mono: false, wt: 600, size: 11, lh: 14, ls: 0.9 },
    'Mono/12': { mono: true, wt: 400, size: 12, lh: 16, ls: 0 },
    'Mono/11': { mono: true, wt: 400, size: 11, lh: 14, ls: 0 },
  }
  const SHADOWS = {
    card: [{ x: 0, y: 2, blur: 8, spread: 0, color: 'rgba(0,0,0,0.35)' }],
    pop: [{ x: 0, y: 10, blur: 30, spread: 0, color: 'rgba(0,0,0,0.5)' }],
    sheet: [{ x: 0, y: -8, blur: 30, spread: 0, color: 'rgba(0,0,0,0.45)' }],
  }

  const defineTokens = (colors, numbers) => {
    Object.assign(TOKENS, colors || {})
    Object.assign(NUMBERS, numbers || {})
  }
  const defineIcons = (more) => Object.assign(ICONS, more)

  // ── Colour and number resolution ──
  const hexParts = (h) => {
    let s = h.replace('#', '')
    if (s.length === 3) s = s.replace(/./g, (c) => c + c)
    return {
      r: Number.parseInt(s.slice(0, 2), 16) / 255,
      g: Number.parseInt(s.slice(2, 4), 16) / 255,
      b: Number.parseInt(s.slice(4, 6), 16) / 255,
      a: s.length >= 8 ? Number.parseInt(s.slice(6, 8), 16) / 255 : 1,
    }
  }
  // spec: token name, '#rgb[a]', 'rgba(r,g,b,a)', or { c: spec, a: alpha }. Returns r, g, b (0..1), a, token.
  const resolve = (spec) => {
    if (spec == null) return null
    if (typeof spec === 'object') {
      const base = resolve(spec.c)
      return {
        ...base,
        a: base.a * (spec.a == null ? 1 : spec.a),
        token: base.token,
        tokenAlpha: base.tokenAlpha,
      }
    }
    if (spec[0] === '#') return { ...hexParts(spec), token: null, tokenAlpha: 1 }
    const m = /^rgba?\(([^)]+)\)$/.exec(spec)
    if (m) {
      const p = m[1].split(',').map((x) => Number.parseFloat(x))
      return {
        r: p[0] / 255,
        g: p[1] / 255,
        b: p[2] / 255,
        a: p.length > 3 ? p[3] : 1,
        token: null,
        tokenAlpha: 1,
      }
    }
    const hex = TOKENS[spec]
    if (!hex) throw new Error(`unknown colour token "${spec}"`)
    const parts = hexParts(hex)
    return { ...parts, token: spec, tokenAlpha: parts.a }
  }
  const css = (spec) => {
    const c = resolve(spec)
    if (!c) return 'transparent'
    const byte = (v) => Math.round(v * 255)
    return `rgba(${byte(c.r)},${byte(c.g)},${byte(c.b)},${+c.a.toFixed(3)})`
  }
  const hex6 = (spec) => {
    const c = resolve(spec)
    const h = (v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, '0')
    return `#${h(c.r)}${h(c.g)}${h(c.b)}`
  }
  const num = (v) => (typeof v === 'string' ? NUMBERS[v] : v)
  const alpha = (c, a) => ({ c, a })

  // ── Tree builders ──
  const flat = (list) => list.flat(Infinity).filter((x) => x != null && x !== false)
  // Frame. w/h: number | 'fill' | 'hug'. lay: 'row' | 'col' (auto-layout); without lay, children are placed at x, y.
  const F = (props = {}, ...kids) => ({ k: 'f', ...props, c: flat(kids) })
  const row = (props = {}, ...kids) => F({ lay: 'row', ay: 'center', ...props }, ...kids)
  const col = (props = {}, ...kids) => F({ lay: 'col', ...props }, ...kids)
  const spacer = () => F({ name: 'spacer', w: 'fill', h: 'fill' })
  const T = (s, props = {}) => ({ k: 't', s: String(s), ...props })
  // Raw vector. svg must carry width, height and viewBox. tint: colour to bind every stroke and fill to.
  const V = (svg, props = {}) => ({ k: 'v', svg, ...props })

  const ICONS = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.2v.1"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.1"/>',
    'chevron-down': '<path d="M6 9l6 6 6-6"/>',
    'chevron-up': '<path d="M6 15l6-6 6 6"/>',
    'chevron-left': '<path d="M15 6l-6 6 6 6"/>',
    'chevron-right': '<path d="M9 6l6 6-6 6"/>',
    'arrow-up': '<path d="M12 19V5M6 11l6-6 6 6"/>',
    'arrow-down': '<path d="M12 5v14M6 13l6 6 6-6"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    'eye-off':
      '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/><path d="M4 4l16 16"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    grid: '<path d="M4 4h16v16H4zM4 12h16M12 4v16"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12.5l9 5 9-5M3 17l9 5 9-5"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    magnet: '<path d="M6 3v9a6 6 0 0 0 12 0V3h-4v9a2 2 0 0 1-4 0V3zM6 7h4M14 7h4"/>',
    cursor: '<path d="M5 3l14 7-6 2-2 6z"/>',
    pencil: '<path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M14 6l4 4"/>',
    polygon:
      '<path d="M5 7l9-3 5 6-3 9H6z"/><circle cx="5" cy="7" r="1"/><circle cx="14" cy="4" r="1"/><circle cx="19" cy="10" r="1"/>',
    vertex:
      '<rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/><rect x="9.5" y="16" width="5" height="5"/><path d="M8 5.5h8M5.5 8l5 8M18.5 8l-5 8"/>',
    portal: '<path d="M4 4v16M20 4v16"/><path d="M8 12h8M13 8l4 4-4 4"/>',
    door: '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><path d="M4 21h16"/><path d="M15 12.5v.1"/>',
    window: '<rect x="5" y="4" width="14" height="16" rx="1"/><path d="M12 4v16M5 12h14"/>',
    pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    lamp: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    nav: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="9" r="2.5"/><circle cx="9" cy="18" r="2.5"/><path d="M8.3 6.4l7.4 2M7 8.3l1.4 7.2M16.7 11.3l-5.9 5.2"/>',
    camera: '<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3z"/>',
    drop: '<path d="M12 3c4 4.5 6 7.5 6 10a6 6 0 0 1-12 0c0-2.5 2-5.5 6-10z"/>',
    ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
    world:
      '<rect x="3" y="4" width="8" height="7" rx="1"/><rect x="13" y="4" width="8" height="5" rx="1"/><rect x="3" y="13" width="5" height="7" rx="1"/><rect x="10" y="11" width="11" height="9" rx="1"/>',
    cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12L4 7.5M12 12v9"/>',
    plan: '<path d="M4 4h16v16H4z"/><path d="M4 11h9v9M13 4v7"/>',
    split: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>',
    orbit: '<path d="M20 12a8 4 0 1 1-8-4"/><path d="M13 5l-1 3 3 1"/><circle cx="12" cy="12" r="1.5"/>',
    walk: '<circle cx="12" cy="5" r="2"/><path d="M12 8v6M12 14l-3 6M12 14l3 6M8 10l4-2 4 2"/>',
    fly: '<path d="M3 11l18-8-8 18-2-8z"/>',
    cloud: '<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9.5 4.3 4.3 0 0 1 17.5 18z"/>',
    sparkle:
      '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
    more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    rotate: '<path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M20 4v5h-5"/>',
    crosshair: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
    keyboard:
      '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>',
    box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    anchor: '<circle cx="12" cy="6" r="2.5"/><path d="M12 8.5V21M6 14c0 3.5 3 6 6 6s6-2.5 6-6"/>',
    flag: '<path d="M6 21V4M6 5h11l-2 4 2 4H6"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    image:
      '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',
    hand: '<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 7-6 7-2.5 0-4-1-5.5-3L3 14a1.5 1.5 0 0 1 2.4-1.8L8 15"/>',
  }
  // Icon: 24 x 24 stroke icon from the dictionary, drawn in `color` (a token or colour spec).
  const I = (name, props = {}) => {
    const { size = 20, color = 'text/primary', sw = 1.75, ...rest } = props
    const body = ICONS[name]
    if (!body) throw new Error(`unknown icon "${name}"`)
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
      `stroke="${hex6(color)}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
    return V(svg, { name: `icon/${name}`, w: size, h: size, tint: color, ...rest })
  }

  // ── HTML renderer ──
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const shadowCss = (sh) =>
    (typeof sh === 'string' ? SHADOWS[sh] : sh).map(
      (s) => `${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${css(s.color)}`,
    )
  const FLEX = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    between: 'space-between',
    stretch: 'stretch',
  }
  const padOf = (p) => {
    if (p == null) return [0, 0, 0, 0]
    if (Array.isArray(p)) {
      const q = p.map(num)
      return q.length === 2 ? [q[0], q[1], q[0], q[1]] : q
    }
    return [num(p), num(p), num(p), num(p)]
  }
  const radiusCss = (r) => (Array.isArray(r) ? r.map((x) => `${num(x)}px`).join(' ') : `${num(r)}px`)

  // Placement shared by every node: size and position inside its parent (ctx: 'row' | 'col' | null for x/y).
  const place = (n, ctx, st) => {
    const free = ctx === null || n.abs
    if (free) {
      st.push('position:absolute', `left:${n.x || 0}px`, `top:${n.y || 0}px`)
    } else st.push('position:relative', 'flex-shrink:0')
    for (const [dim, size, main, edge] of [
      ['width', n.w, 'row', 'right'],
      ['height', n.h, 'col', 'bottom'],
    ]) {
      if (typeof size === 'number') st.push(`${dim}:${size}px`)
      else if (size === 'fill') {
        if (free) st.push(`${edge}:0`)
        else if (ctx === main) st.push('flex:1 1 0', dim === 'width' ? 'min-width:0' : 'min-height:0')
        else st.push('align-self:stretch')
      }
    }
  }

  const toHTML = (n, ctx = null) => {
    if (n.k === 't') return textHTML(n, ctx)
    if (n.k === 'v') return vectorHTML(n, ctx)
    const st = ['box-sizing:border-box']
    place(n, ctx, st)
    if (n.fill) st.push(`background:${css(n.fill)}`)
    const shadows = []
    if (n.stroke && !n.dash) shadows.push(`inset 0 0 0 ${n.sw == null ? 1 : n.sw}px ${css(n.stroke)}`)
    if (n.shadow) shadows.push(...shadowCss(n.shadow))
    if (shadows.length) st.push(`box-shadow:${shadows.join(',')}`)
    if (n.stroke && n.dash) {
      const w = n.sw == null ? 1 : n.sw
      st.push(`outline:${w}px dashed ${css(n.stroke)}`, `outline-offset:-${w}px`)
    }
    if (n.r != null) st.push(`border-radius:${radiusCss(n.r)}`)
    if (n.clip) st.push('overflow:hidden')
    if (n.op != null) st.push(`opacity:${n.op}`)
    if (n.lay) {
      const [pt, pr, pb, pl] = padOf(n.pad)
      st.push(
        'display:flex',
        `flex-direction:${n.lay === 'row' ? 'row' : 'column'}`,
        `gap:${num(n.gap) || 0}px`,
        `padding:${pt}px ${pr}px ${pb}px ${pl}px`,
        `justify-content:${FLEX[n.ax || 'start']}`,
        `align-items:${FLEX[n.ay || 'start']}`,
      )
    }
    const kids = n.c.map((k) => toHTML(k, n.lay || null)).join('')
    return `<div${n.name ? ` data-name="${esc(n.name)}"` : ''} style="${st.join(';')}">${kids}</div>`
  }

  const styleOf = (n) => {
    const base = TEXT[n.style || (n.size || n.wt || n.mono ? null : 'Body/13')] || TEXT['Body/13']
    return {
      mono: n.mono == null ? base.mono : n.mono,
      wt: n.wt || base.wt,
      size: n.size || base.size,
      lh: n.lh || (n.size ? Math.round(n.size * 1.4) : base.lh),
      ls: n.ls == null ? base.ls : n.ls,
    }
  }
  const FONT = (mono) =>
    mono ? "'IBM Plex Mono',ui-monospace,monospace" : "'IBM Plex Sans',system-ui,sans-serif"
  const textHTML = (n, ctx) => {
    const t = styleOf(n)
    const st = ['box-sizing:border-box', 'margin:0']
    place({ ...n, h: undefined }, ctx, st)
    st.push(
      `font-family:${FONT(t.mono)}`,
      `font-size:${t.size}px`,
      `font-weight:${t.wt}`,
      `line-height:${t.lh}px`,
      `letter-spacing:${t.ls}px`,
      `color:${css(n.color || 'text/primary')}`,
    )
    if (n.align) st.push(`text-align:${n.align}`)
    if (n.up) st.push('text-transform:uppercase')
    if (n.trunc) st.push('overflow:hidden', 'text-overflow:ellipsis', 'white-space:nowrap')
    else st.push(n.w == null ? 'white-space:pre' : 'white-space:pre-wrap')
    if (n.op != null) st.push(`opacity:${n.op}`)
    return `<div${n.name ? ` data-name="${esc(n.name)}"` : ''} style="${st.join(';')}">${esc(n.s)}</div>`
  }
  const vectorHTML = (n, ctx) => {
    const st = ['box-sizing:border-box', 'line-height:0']
    place(n, ctx, st)
    if (n.op != null) st.push(`opacity:${n.op}`)
    const svg = n.svg.replace(/^<svg /, '<svg style="display:block;width:100%;height:100%" ')
    return `<div${n.name ? ` data-name="${esc(n.name)}"` : ''} style="${st.join(';')}">${svg}</div>`
  }

  const baseCss =
    '*{box-sizing:border-box}body{margin:0;background:#0a0b0d;-webkit-font-smoothing:antialiased}' +
    '[data-name]{font-synthesis:none}'
  const fontsHref =
    'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap'

  return {
    F,
    row,
    col,
    spacer,
    T,
    V,
    I,
    alpha,
    resolve,
    css,
    hex6,
    num,
    defineTokens,
    defineIcons,
    toHTML,
    tokens: TOKENS,
    numbers: NUMBERS,
    text: TEXT,
    shadows: SHADOWS,
    icons: ICONS,
    baseCss,
    fontsHref,
    padOf,
    styleOf,
  }
}

export const S = makeScene()
