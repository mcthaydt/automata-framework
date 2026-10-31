/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} End_MenuInputs */

const en_end_menu = /** @type {(inputs: End_MenuInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Menu`)
};

/**
* | output |
* | --- |
* | "Menu" |
*
* @param {End_MenuInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const end_menu = /** @type {((inputs?: End_MenuInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<End_MenuInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_end_menu(inputs)
});