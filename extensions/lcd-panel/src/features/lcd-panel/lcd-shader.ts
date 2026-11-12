// The panel as a post effect's fragment, in GLSL and WGSL (WebGL2 stays at parity with WebGPU, ADR 0002). The mesh is
// a port of `lcd-perfect` v10:
//
//   Copyright (c) 2026 sinedied, MIT licence.
//   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
//   associated documentation files (the "Software"), to deal in the Software without restriction,
//   including without limitation the rights to use, copy, modify, merge, publish, distribute,
//   sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
//   furnished to do so, subject to the following conditions: the above copyright notice and this
//   permission notice shall be included in all copies or substantial portions of the Software. THE
//   SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
//
// The mesh is a sinusoid integrated exactly over each output pixel's footprint rather than sampled at its centre, and
// faded out past Nyquist rather than left to fold into a coarser pattern, which is why it holds up at any size.
// Halation is added before the mesh multiply, so a bright flame lights the grid lines instead of merely failing to
// darken them. Taps are clamped to the frame by `sampleColor`. Uniform names are `LCD_UNIFORMS` (lcd-geometry.ts).

export const LCD_GLSL = `
#define TAU 6.283185307
#define PI 3.141592654
#define COS_TAU_6 0.5
#define SIN_TAU_6 0.866025404
// Mean of a unit sinusoid over one output pixel.
float boxSinc(float f) { float x = PI * max(f, 1e-4); return sin(x) / x; }
vec4 effect(vec2 uv) {
  vec2 t = texel();
  vec2 p = uv / t / uCellSize;
  float f = uCyclesPerPixel;
  vec2 split = vec2(uAberration * uCellSize, 0.0) * t;
  if (uSnap > 0.5 && uAberration > 0.0) split = vec2(max(1.0, floor(uAberration * uCellSize + 0.5)), 0.0) * t;
  vec4 centre = sampleColor(uv);
  vec3 color = vec3(sampleColor(uv + split).r, centre.g, sampleColor(uv - split).b);
  if (uGlow > 0.0) {
    vec2 r = vec2(uGlowRadius * uCellSize) * t;
    vec3 bleed = 0.25 * (sampleColor(uv + vec2(r.x, r.y)).rgb + sampleColor(uv + vec2(-r.x, r.y)).rgb
      + sampleColor(uv + vec2(r.x, -r.y)).rgb + sampleColor(uv + vec2(-r.x, -r.y)).rgb);
    float luma = dot(bleed, vec3(0.2126, 0.7152, 0.0722));
    color += uGlow * max(0.0, luma - uGlowThreshold) * bleed;
  }
  vec2 amp = clamp(uGrid * 2.0 * vec2(1.0 - uBalance, uBalance) + vec2(0.0, uScanlines), 0.0, 1.0) * uFade * (2.0 / (uCells + 1.0));
  float phase = 0.5 * f;
  vec2 q = p / uCells;
  float hh = 0.4995 * f;
  vec2 X = TAU * (q - phase);
  vec2 sinX = sin(X);
  vec2 cosX = cos(X);
  float sinY = sin(TAU * hh);
  vec2 k = amp / TAU;
  vec2 I = max(2.0 * hh - k * (2.0 * cosX * sinY), 1e-6);
  vec2 g = I * (1.0 / (2.0 * hh * (1.0 + amp)));
  float gain = g.x * g.y;
  vec3 stripe = vec3(1.0);
  if (uSubpixels > 0.0) {
    float sinc = boxSinc(f);
    float ac = uSubpixels * sinc * uFade;
    vec2 rg = 1.0 + ac * vec2(COS_TAU_6 * cosX.x + SIN_TAU_6 * sinX.x, -cosX.x);
    stripe = vec3(rg, 3.0 - rg.x - rg.y);
    float M = amp.x * sinc;
    vec3 corr = 1.0 - 0.5 * M * ac * vec3(COS_TAU_6, -1.0, COS_TAU_6);
    stripe /= sqrt(max(corr, vec3(1e-3)));
    if (uLayout >= 0.5) stripe = stripe.bgr;
  }
  // Treating the encoding as a gamma of 2 makes one square root replace the decode and re-encode.
  vec3 m = sqrt(max(stripe * (gain * uBrightness), 0.0));
  if (abs(uGamma - 1.0) > 0.001) color = pow(max(color, vec3(1e-8)), vec3(uGamma));
  color = clamp(color * m, 0.0, 1.0);
  if (uVignette > 0.5) {
    vec2 frame = (uv - vec2(0.5, 0.46)) / vec2(0.72, 0.7);
    float edge = length(frame);
    color *= 1.0 - (edge < 0.82 ? 0.667 * smoothstep(0.52, 0.82, edge) : mix(0.667, 0.933, clamp((edge - 0.82) / 0.18, 0.0, 1.0)));
  }
  return vec4(color, centre.a);
}`

export const LCD_WGSL = `
const TAU = 6.283185307;
const PI = 3.141592654;
const COS_TAU_6 = 0.5;
const SIN_TAU_6 = 0.866025404;
fn boxSinc(f: f32) -> f32 { let x = PI * max(f, 1e-4); return sin(x) / x; }
fn effect(uv: vec2<f32>) -> vec4<f32> {
  let t = texel();
  let p = uv / t / fx.uCellSize;
  let f = fx.uCyclesPerPixel;
  var split = vec2<f32>(fx.uAberration * fx.uCellSize, 0.0) * t;
  if (fx.uSnap > 0.5 && fx.uAberration > 0.0) { split = vec2<f32>(max(1.0, floor(fx.uAberration * fx.uCellSize + 0.5)), 0.0) * t; }
  let centre = sampleColor(uv);
  var color = vec3<f32>(sampleColor(uv + split).r, centre.g, sampleColor(uv - split).b);
  if (fx.uGlow > 0.0) {
    let r = vec2<f32>(fx.uGlowRadius * fx.uCellSize) * t;
    let bleed = 0.25 * (sampleColor(uv + vec2<f32>(r.x, r.y)).rgb + sampleColor(uv + vec2<f32>(-r.x, r.y)).rgb
      + sampleColor(uv + vec2<f32>(r.x, -r.y)).rgb + sampleColor(uv + vec2<f32>(-r.x, -r.y)).rgb);
    let luma = dot(bleed, vec3<f32>(0.2126, 0.7152, 0.0722));
    color += fx.uGlow * max(0.0, luma - fx.uGlowThreshold) * bleed;
  }
  let amp = clamp(fx.uGrid * 2.0 * vec2<f32>(1.0 - fx.uBalance, fx.uBalance) + vec2<f32>(0.0, fx.uScanlines), vec2<f32>(0.0), vec2<f32>(1.0)) * fx.uFade * (2.0 / (fx.uCells + 1.0));
  let phase = 0.5 * f;
  let q = p / fx.uCells;
  let hh = 0.4995 * f;
  let X = TAU * (q - vec2<f32>(phase));
  let sinX = sin(X);
  let cosX = cos(X);
  let sinY = sin(TAU * hh);
  let k = amp / TAU;
  let I = max(vec2<f32>(2.0 * hh) - k * (2.0 * cosX * sinY), vec2<f32>(1e-6));
  let g = I * (1.0 / (2.0 * hh * (vec2<f32>(1.0) + amp)));
  let gain = g.x * g.y;
  var stripe = vec3<f32>(1.0);
  if (fx.uSubpixels > 0.0) {
    let sinc = boxSinc(f);
    let ac = fx.uSubpixels * sinc * fx.uFade;
    let rg = vec2<f32>(1.0) + ac * vec2<f32>(COS_TAU_6 * cosX.x + SIN_TAU_6 * sinX.x, -cosX.x);
    stripe = vec3<f32>(rg, 3.0 - rg.x - rg.y);
    let M = amp.x * sinc;
    let corr = vec3<f32>(1.0) - 0.5 * M * ac * vec3<f32>(COS_TAU_6, -1.0, COS_TAU_6);
    stripe /= sqrt(max(corr, vec3<f32>(1e-3)));
    if (fx.uLayout >= 0.5) { stripe = stripe.bgr; }
  }
  let m = sqrt(max(stripe * (gain * fx.uBrightness), vec3<f32>(0.0)));
  if (abs(fx.uGamma - 1.0) > 0.001) { color = pow(max(color, vec3<f32>(1e-8)), vec3<f32>(fx.uGamma)); }
  color = clamp(color * m, vec3<f32>(0.0), vec3<f32>(1.0));
  if (fx.uVignette > 0.5) {
    let frame = (uv - vec2<f32>(0.5, 0.46)) / vec2<f32>(0.72, 0.7);
    let edge = length(frame);
    var shade = mix(0.667, 0.933, clamp((edge - 0.82) / 0.18, 0.0, 1.0));
    if (edge < 0.82) { shade = 0.667 * smoothstep(0.52, 0.82, edge); }
    color = color * (1.0 - shade);
  }
  return vec4<f32>(color, centre.a);
}`
