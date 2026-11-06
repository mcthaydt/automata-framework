import { describe, expect, it } from 'vitest';
import { fabricOf, labelAt, registerFabric } from '../../../src/features/paint/fabric';
import { FIXTURES, registerFixtures } from './fabric-fixtures';

describe('the fabric registry (H5)', () => {
  it('rejects a deep motif', () => {
    expect(() => registerFabric('deep', { w: 2, h: 2, labels: [0, -2, 0, 0] })).toThrow(/motif/);
  });
  it('rejects a wrong number of labels', () => {
    expect(() => registerFabric('short', { w: 3, h: 3, labels: [0] })).toThrow(/labels/);
  });
  it('rejects a non-integer label', () => {
    expect(() => registerFabric('half', { w: 2, h: 1, labels: [0, -0.5] })).toThrow();
  });
  it('rejects a pattern label above +1', () => {
    expect(() => registerFabric('loud', { w: 8, h: 1, labels: [0, 2, 0, 0, 0, 0, 0, 0] })).toThrow();
  });
  it('accepts a pattern from -2 to +1, and returns it', () => {
    registerFabric('photo', { w: 8, h: 1, labels: [-2, -1, 0, 1, 0, 0, 0, 0] });
    expect(fabricOf('photo')!.labels).toEqual([-2, -1, 0, 1, 0, 0, 0, 0]);
  });
  it('rejects a taken name', () => {
    expect(() => registerFabric('photo', { w: 1, h: 1, labels: [0] })).toThrow(/registered/);
  });
  it('registers the fixtures twice without throwing, and the twill is one step deep', () => {
    registerFixtures(); registerFixtures();
    expect(new Set(fabricOf('fx-twill')!.labels)).toEqual(new Set([0, -1]));
    expect(FIXTURES.check.labels.length).toBe(64);
  });
  it('labelAt reads a texel-size tile, with positive mods', () => {
    expect(labelAt(FIXTURES.rib, 1.5 / 73.8, 0, 73.8)).toBe(-1);
    expect(labelAt(FIXTURES.rib, -0.5 / 73.8, 0, 73.8)).toBe(-1);
    expect(labelAt(FIXTURES.rib, 0.5 / 73.8, 0, 73.8)).toBe(0);
  });
  it('labelAt keeps a physical-size tile at its metres', () => {
    const f = { ...FIXTURES.rib, metres: 0.01 };
    expect(labelAt(f, 0.015, 0, 73.8)).toBe(-1);
    expect(labelAt(f, 0.015, 0, 147.6)).toBe(-1);
  });
});
