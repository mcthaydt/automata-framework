// The retro pass as a post effect's fragment, in GLSL and WGSL (WebGL2 stays at parity with WebGPU, ADR 0002): unsharp
// mask, the grade, the vignette, the film fade, then the ordered-dither quantise when the profile asks. The maths is
// retro-colour.ts's; the uniform names are `RETRO_UNIFORMS` (retro-uniforms.ts). The pass runs after the look's DUEL
// snap, so with `RETRO_NEUTRAL` an exact DUEL colour comes out as it went in.

export const RETRO_GLSL = `
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float bayer8(vec2 p) {
  float v = 0.0;
  for (int i = 0; i < 3; i++) {
    vec2 bit = mod(floor(p / exp2(float(i))), 2.0);
    v = v * 4.0 + mod(bit.x + bit.y, 2.0) * 2.0 + bit.y;
  }
  return v;
}
vec4 effect(vec2 uv) {
  vec4 s = sampleColor(uv);
  vec2 t = texel();
  vec2 pixel = floor(uv / t);
  vec2 cell = floor(pixel / uCell);
  vec3 c = s.rgb;
  if (uSharpness > 0.001) {
    vec3 blur = (sampleColor(uv + vec2(t.x, 0.0)).rgb + sampleColor(uv - vec2(t.x, 0.0)).rgb
      + sampleColor(uv + vec2(0.0, t.y)).rgb + sampleColor(uv - vec2(0.0, t.y)).rgb) * 0.25;
    c = clamp(c + (c - blur) * uSharpness, 0.0, 1.0);
  }
  float lumaRaw = dot(c, LUMA);
  vec3 base = c;
  c *= uGain;
  c.r += uWarmR;
  c.b += uWarmB;
  c.g += uTintG;
  c += (1.0 - dot(c, LUMA)) * uBrilliance;
  c = (c - 0.5) * uContrast + 0.5;
  float lumaHS = clamp(dot(c, LUMA), 0.0, 1.0);
  c += smoothstep(0.5, 1.0, lumaHS) * uHighlights + (1.0 - smoothstep(0.0, 0.5, lumaHS)) * uShadows;
  c = clamp(c, 0.0, 1.0);
  float grey = dot(c, LUMA);
  c = mix(vec3(grey), c, uSaturation);
  float currentSat = (max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b))) / (max(c.r, max(c.g, c.b)) + 0.001);
  float vivid = dot(c, LUMA);
  c = clamp(mix(vec3(vivid), c, 1.0 + uVibrance * (1.0 - currentSat)), 0.0, 1.0);
  float finalLuma = dot(c, LUMA);
  if (finalLuma < uBlackCrush) c = vec3(finalLuma);
  c = mix(base, c, uMood);
  vec2 screen = uv - 0.5;
  c *= 1.0 - smoothstep(0.2, 0.72, length(screen * vec2(1.0, 0.85))) * uVignette;
  c = mix(vec3(uFadeR, uFadeG, uFadeB), vec3(uFadeWhite), clamp(c, 0.0, 1.0));
  float frame = floor(uFilmTime * uFps);
  c += (hash(pixel + frame * vec2(37.0, 17.0)) - 0.5) * uGrain;
  float speck = hash(floor(cell / uSpeck) + frame * vec2(91.7, 13.3));
  if (speck > 1.0 - uSpecks) c = mix(c, speck > 1.0 - uSpecks / 3.0 ? vec3(uFadeWhite) : vec3(uFadeR, uFadeG, uFadeB) * 0.4, 0.55);
  if (hash(vec2(frame, 7.0)) < uScratch && abs(pixel.x - floor(hash(vec2(frame, 3.0)) / t.x)) < 0.5) c += 0.05;
  if (uQuantise > 0.5) {
    float rawThreshold = bayer8(mod(cell, 8.0)) / 64.0 - 0.5;
    float threshold = rawThreshold * (1.0 - lumaRaw * uLumaWeight) * smoothstep(0.02, 0.08, lumaRaw);
    c = clamp(floor(c * uQuantise + 0.5 + threshold) / uQuantise, 0.0, 1.0);
  }
  return vec4(c, s.a);
}`

export const RETRO_WGSL = `
const LUMA = vec3<f32>(0.2126, 0.7152, 0.0722);
fn hash(p: vec2<f32>) -> f32 { return fract(sin(dot(p, vec2<f32>(12.9898, 78.233))) * 43758.5453); }
fn bayer8(p: vec2<f32>) -> f32 {
  let a = (u32(p.x) ^ u32(p.y)) & 7u;
  let b = u32(p.y) & 7u;
  var v = 0u;
  for (var i = 0u; i < 3u; i++) { v = (v << 2u) | (((a >> i) & 1u) << 1u) | ((b >> i) & 1u); }
  return f32(v);
}
fn effect(uv: vec2<f32>) -> vec4<f32> {
  let s = sampleColor(uv);
  let t = texel();
  let pixel = floor(uv / t);
  let cell = floor(pixel / fx.uCell);
  var c = s.rgb;
  if (fx.uSharpness > 0.001) {
    let blur = (sampleColor(uv + vec2<f32>(t.x, 0.0)).rgb + sampleColor(uv - vec2<f32>(t.x, 0.0)).rgb
      + sampleColor(uv + vec2<f32>(0.0, t.y)).rgb + sampleColor(uv - vec2<f32>(0.0, t.y)).rgb) * 0.25;
    c = clamp(c + (c - blur) * fx.uSharpness, vec3<f32>(0.0), vec3<f32>(1.0));
  }
  let lumaRaw = dot(c, LUMA);
  let base = c;
  c *= fx.uGain;
  c.r += fx.uWarmR;
  c.b += fx.uWarmB;
  c.g += fx.uTintG;
  c += vec3<f32>((1.0 - dot(c, LUMA)) * fx.uBrilliance);
  c = (c - vec3<f32>(0.5)) * fx.uContrast + vec3<f32>(0.5);
  let lumaHS = clamp(dot(c, LUMA), 0.0, 1.0);
  c += vec3<f32>(smoothstep(0.5, 1.0, lumaHS) * fx.uHighlights + (1.0 - smoothstep(0.0, 0.5, lumaHS)) * fx.uShadows);
  c = clamp(c, vec3<f32>(0.0), vec3<f32>(1.0));
  let grey = dot(c, LUMA);
  c = mix(vec3<f32>(grey), c, vec3<f32>(fx.uSaturation));
  let currentSat = (max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b))) / (max(c.r, max(c.g, c.b)) + 0.001);
  let vivid = dot(c, LUMA);
  c = clamp(mix(vec3<f32>(vivid), c, vec3<f32>(1.0 + fx.uVibrance * (1.0 - currentSat))), vec3<f32>(0.0), vec3<f32>(1.0));
  let finalLuma = dot(c, LUMA);
  if (finalLuma < fx.uBlackCrush) { c = vec3<f32>(finalLuma); }
  c = mix(base, c, vec3<f32>(fx.uMood));
  let screen = uv - vec2<f32>(0.5);
  c *= 1.0 - smoothstep(0.2, 0.72, length(screen * vec2<f32>(1.0, 0.85))) * fx.uVignette;
  let black = vec3<f32>(fx.uFadeR, fx.uFadeG, fx.uFadeB);
  c = mix(black, vec3<f32>(fx.uFadeWhite), clamp(c, vec3<f32>(0.0), vec3<f32>(1.0)));
  let frame = floor(fx.uFilmTime * fx.uFps);
  c += vec3<f32>((hash(pixel + frame * vec2<f32>(37.0, 17.0)) - 0.5) * fx.uGrain);
  let speck = hash(floor(cell / fx.uSpeck) + frame * vec2<f32>(91.7, 13.3));
  if (speck > 1.0 - fx.uSpecks) { c = mix(c, select(black * 0.4, vec3<f32>(fx.uFadeWhite), speck > 1.0 - fx.uSpecks / 3.0), vec3<f32>(0.55)); }
  if (hash(vec2<f32>(frame, 7.0)) < fx.uScratch && abs(pixel.x - floor(hash(vec2<f32>(frame, 3.0)) / t.x)) < 0.5) { c += vec3<f32>(0.05); }
  if (fx.uQuantise > 0.5) {
    let rawThreshold = bayer8(cell % vec2<f32>(8.0)) / 64.0 - 0.5;
    let threshold = rawThreshold * (1.0 - lumaRaw * fx.uLumaWeight) * smoothstep(0.02, 0.08, lumaRaw);
    c = clamp(floor(c * fx.uQuantise + 0.5 + threshold) / fx.uQuantise, vec3<f32>(0.0), vec3<f32>(1.0));
  }
  return vec4<f32>(c, s.a);
}`
