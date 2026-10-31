/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Items_Own_ButtonInputs */

const en_items_own_button = /** @type {(inputs: Items_Own_ButtonInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Own button`)
};

/**
* | output |
* | --- |
* | "Own button" |
*
* @param {Items_Own_ButtonInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const items_own_button = /** @type {((inputs?: Items_Own_ButtonInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Items_Own_ButtonInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_items_own_button(inputs)
});