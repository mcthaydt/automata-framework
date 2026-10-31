/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Hud_ItemsInputs */

const en_hud_items = /** @type {(inputs: Hud_ItemsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Items`)
};

/**
* | output |
* | --- |
* | "Items" |
*
* @param {Hud_ItemsInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const hud_items = /** @type {((inputs?: Hud_ItemsInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Hud_ItemsInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_hud_items(inputs)
});