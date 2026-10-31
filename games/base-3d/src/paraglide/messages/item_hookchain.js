/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Item_HookchainInputs */

const en_item_hookchain = /** @type {(inputs: Item_HookchainInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Hookchain`)
};

/**
* | output |
* | --- |
* | "Hookchain" |
*
* @param {Item_HookchainInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const item_hookchain = /** @type {((inputs?: Item_HookchainInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Item_HookchainInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_item_hookchain(inputs)
});