/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Item_ShieldInputs */

const en_item_shield = /** @type {(inputs: Item_ShieldInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Shield`)
};

/**
* | output |
* | --- |
* | "Shield" |
*
* @param {Item_ShieldInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const item_shield = /** @type {((inputs?: Item_ShieldInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Item_ShieldInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_item_shield(inputs)
});