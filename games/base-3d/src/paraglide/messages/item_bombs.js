/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Item_BombsInputs */

const en_item_bombs = /** @type {(inputs: Item_BombsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Ember Bombs`)
};

/**
* | output |
* | --- |
* | "Ember Bombs" |
*
* @param {Item_BombsInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const item_bombs = /** @type {((inputs?: Item_BombsInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Item_BombsInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_item_bombs(inputs)
});