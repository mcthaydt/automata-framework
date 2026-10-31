/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Items_Boss_KeyInputs */

const en_items_boss_key = /** @type {(inputs: Items_Boss_KeyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Boss key`)
};

/**
* | output |
* | --- |
* | "Boss key" |
*
* @param {Items_Boss_KeyInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const items_boss_key = /** @type {((inputs?: Items_Boss_KeyInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Items_Boss_KeyInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_items_boss_key(inputs)
});