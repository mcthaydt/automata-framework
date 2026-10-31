/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Items_EmbersInputs */

const en_items_embers = /** @type {(inputs: Items_EmbersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Embers`)
};

/**
* | output |
* | --- |
* | "Embers" |
*
* @param {Items_EmbersInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const items_embers = /** @type {((inputs?: Items_EmbersInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Items_EmbersInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_items_embers(inputs)
});