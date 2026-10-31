/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Items_NoInputs */

const en_items_no = /** @type {(inputs: Items_NoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No`)
};

/**
* | output |
* | --- |
* | "No" |
*
* @param {Items_NoInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const items_no = /** @type {((inputs?: Items_NoInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Items_NoInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_items_no(inputs)
});