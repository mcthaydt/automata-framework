import { dressed } from '../draw';

/**
 * What the stage's tests share. The denim is the one tests/features/paint/fabric.test.ts dresses: a twill top and shorts
 * in the test fabric `fx-twill` (tests/features/paint/fabric-fixtures.ts, registered by `registerFixtures`). Base
 * registers no fabric, so a tiled cloth reaches the stage only through a fixture that lives under tests/.
 */
export const DENIM_DEF = dressed([{ top: 'fxtwill', sleeves: 'long' }, { shorts: 'fxtwill' }], { fxtwill: { ramp: 26, base: 3, fabric: 'fx-twill' } });
