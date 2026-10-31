/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Item_SwordInputs */

const en_item_sword = /** @type {(inputs: Item_SwordInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Sword`)
};

/**
* | output |
* | --- |
* | "Sword" |
*
* @param {Item_SwordInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const item_sword = /** @type {((inputs?: Item_SwordInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Item_SwordInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_item_sword(inputs)
});