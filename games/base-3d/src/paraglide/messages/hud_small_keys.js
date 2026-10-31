/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Hud_Small_KeysInputs */

const en_hud_small_keys = /** @type {(inputs: Hud_Small_KeysInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Small keys ${i?.count}`)
};

/**
* | output |
* | --- |
* | "Small keys {count}" |
*
* @param {Hud_Small_KeysInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const hud_small_keys = /** @type {((inputs: Hud_Small_KeysInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Hud_Small_KeysInputs, { locale?: "en" }, {}>} */ ((inputs, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_hud_small_keys(inputs)
});