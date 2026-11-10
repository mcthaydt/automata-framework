/**
 * The figure viewer: the base pair in a Pixi 3D scene, each the painter's own cell on a quad (src/view.ts). Not part of
 * the base's public surface; `npm run viewer` serves it.
 *
 *   /            the scene: drag to orbit, wheel to zoom, W to walk, ←/→ to turn the figures; `?az=&pitch=&dist=&facing=`
 *                (degrees, metres) start the camera and the figures there, `&walk` walking
 *   /?check=D    one base figure in view D of the 8 (and `&who=1` for base-f) under an orthographic camera at the sheets'
 *                18°, one texel to one pixel, on a 128 × 192 canvas: what `scripts/view-check.ts` compares with the
 *                sheets' cell, texel for texel. It sets `document.body.dataset.ready` once drawn.
 */
import '@pixi/3d';
import { CubeGeometry, FlatMaterial, Mesh3D, View3D } from '@pixi/3d';
import { Application } from 'pixi.js';
import { BASE, member, type V3 } from '../src';
import { FigureSprite } from '../src/view';

const params = new URLSearchParams(location.search);
const check = params.get('check');
const DENSITY = 2;
const deg = Math.PI / 180;

async function main() {
  const app = new Application();
  const [w, h] = check === null ? [innerWidth, innerHeight] : [64 * DENSITY, 96 * DENSITY];
  await app.init({ width: w, height: h, background: check === null ? 0x31222a : 0xffffff, backgroundAlpha: check === null ? 1 : 0, preference: 'webgl', antialias: false, resolution: 1, autoDensity: false, preserveDrawingBuffer: true });
  document.body.appendChild(app.canvas);
  const view = new View3D({ width: w, height: h, toneMapping: 'none' });
  app.stage.addChild(view);

  if (check !== null) {
    // One figure, as the sheets draw it: facing view D, the camera on +z at 18°, orthographic, a texel a pixel.
    const cast = member(BASE[Number(params.get('who') ?? 0)].def, DENSITY), [cw, ch] = cast.cell, ppm = ch / cast.metres;
    const fig = new FigureSprite(cast);
    view.root.addChild(fig.sprite);
    const pitch = 18 * deg, aim = (ch / 2 - cast.feet) / ppm / Math.cos(pitch);
    const target: V3 = [0, aim, 0], eye: V3 = [0, aim + 20 * Math.sin(pitch), 20 * Math.cos(pitch)];
    view.camera.mode = 'orthographic';
    view.camera.orthographicSize = cw / 2 / ppm;
    view.camera.position.set(...eye);
    view.camera.lookAt({ x: target[0], y: target[1], z: target[2] });
    for (let i = 0; i < 3; i++) fig.update(1 / 60, { facing: Number(check) * Math.PI / 4, moving: false, eye, target });
    app.render();
    requestAnimationFrame(() => { app.render(); document.body.dataset.ready = 'true'; });
    return;
  }

  // The scene: a floor, the base pair side by side, an orbit camera.
  const floor = new Mesh3D({ geometry: new CubeGeometry({ width: 8, height: 0.1, depth: 8 }), material: new FlatMaterial({ baseColor: 0x4a353c }) });
  floor.position.set(0, -0.05, 0);
  view.root.addChild(floor);
  const figures = BASE.map((b, i) => {
    const f = new FigureSprite(member(b.def, DENSITY));
    f.sprite.position.set(i === 0 ? -0.6 : 0.6, 0, 0);
    view.root.addChild(f.sprite);
    return f;
  });
  // The camera's start, in degrees and metres (`?az=45&pitch=30&dist=4`), so a view can be shot again.
  const num = (k: string, d: number) => Number(params.get(k) ?? d);
  let az = num('az', 0) * deg, pitch = num('pitch', 18) * deg, dist = num('dist', 6), facing = num('facing', 0) * deg, walking = params.has('walk');
  const target: V3 = [0, 0.9, 0];
  addEventListener('pointermove', (e) => { if (e.buttons) { az -= e.movementX * 0.01; pitch = Math.max(2 * deg, Math.min(80 * deg, pitch + e.movementY * 0.01)); } });
  addEventListener('wheel', (e) => { dist = Math.max(1.5, Math.min(20, dist * (1 + e.deltaY * 0.001))); });
  addEventListener('keydown', (e) => {
    if (e.key === 'w' || e.key === 'W') walking = !walking;
    if (e.key === 'ArrowLeft') facing += Math.PI / 4;
    if (e.key === 'ArrowRight') facing -= Math.PI / 4;
  });
  app.ticker.add((t) => {
    const dt = t.deltaMS / 1000;
    const eye: V3 = [target[0] + dist * Math.cos(pitch) * Math.sin(az), target[1] + dist * Math.sin(pitch), target[2] + dist * Math.cos(pitch) * Math.cos(az)];
    view.camera.position.set(...eye);
    view.camera.lookAt({ x: target[0], y: target[1], z: target[2] });
    for (const f of figures) f.update(dt, { facing, moving: walking, eye, target });
  });
}
main();
