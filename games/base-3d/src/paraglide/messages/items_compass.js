/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Items_CompassInputs */

const en_items_compass = /** @type {(inputs: Items_CompassInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Compass`)
};

/**
* | output |
* | --- |
* | "Compass" |
*
* @param {Items_CompassInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const items_compass = /** @type {((inputs?: Items_CompassInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Items_CompassInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_items_compass(inputs)
});