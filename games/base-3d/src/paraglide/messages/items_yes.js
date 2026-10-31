/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Items_YesInputs */

const en_items_yes = /** @type {(inputs: Items_YesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Yes`)
};

/**
* | output |
* | --- |
* | "Yes" |
*
* @param {Items_YesInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const items_yes = /** @type {((inputs?: Items_YesInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Items_YesInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_items_yes(inputs)
});