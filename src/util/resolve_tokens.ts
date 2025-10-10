import {FeatureTable} from "@maplibre/mlt";

/**
 * Replace tokens in a string template with values in an object
 *
 * @param properties - a key/value relationship between tokens and replacements
 * @param text - the template string
 * @returns the template with tokens replaced
 */
export function resolveTokens(
    properties: {
        readonly [x: string]: unknown;
    } | null,
    text: string
): string {
    return text.replace(/{([^{}]+)}/g, (match, key: string) => {
        return properties && key in properties ? String(properties[key]) : '';
    });
}
export function resolveTokensMlt(
    featureTable: FeatureTable,
    index: number,
    text: string
): string {
    return text.replace(/{([^{}]+)}/g, (match, key: string) => {
        const propertyVector = featureTable.getPropertyVector(key);
        const value = propertyVector?.getValue(index);
        return value? String(value) : '';
    });
}

