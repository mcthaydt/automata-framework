/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Key_PickupInputs */

const en_key_pickup = /** @type {(inputs: Key_PickupInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Pick up`)
};

/**
* | output |
* | --- |
* | "Pick up" |
*
* @param {Key_PickupInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const key_pickup = /** @type {((inputs?: Key_PickupInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Key_PickupInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_key_pickup(inputs)
});