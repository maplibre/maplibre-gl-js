import {diffJson} from 'diff';

export function generateDiffLog(expected, actual) {
    return diffJson(expected, actual).map((hunk) => {
        if (hunk.added) {
            return `+ ${hunk.value}`;
        } else if (hunk.removed) {
            return `- ${hunk.value}`;
        } else {
            return `  ${hunk.value}`;
        }
    }).join('');
}

export function deepEqual(a, b, decimalSigFigs = 10): boolean {
    if (typeof a !== typeof b)
        return false;
    if (typeof a === 'number') {
        return stripPrecision(a, decimalSigFigs) === stripPrecision(b, decimalSigFigs);
    }
    if (a === null || typeof a !== 'object')
        return a === b;

    const ka = Object.keys(a);
    const kb = Object.keys(b);

    if (ka.length !== kb.length)
        return false;

    ka.sort();
    kb.sort();

    for (let i = 0; i < ka.length; i++)
        if (ka[i] !== kb[i] || !deepEqual(a[ka[i]], b[ka[i]], decimalSigFigs))
            return false;

    return true;
}

export function stripPrecision(x, decimalSigFigs = 10) {
    // Intended for test output serialization:
    // strips down to 6 decimal sigfigs but stops at decimal point
    if (typeof x === 'number') {
        if (x === 0) { return x; }

        const multiplier = Math.pow(10,
            Math.max(0,
                decimalSigFigs - Math.ceil(Math.log10(Math.abs(x)))));

        // We strip precision twice in a row here to avoid cases where
        // stripping an already stripped number will modify its value
        // due to bad floating point precision luck
        // eg `Math.floor(8.16598 * 100000) / 100000` -> 8.16597
        const firstStrip = Math.floor(x * multiplier) / multiplier;
        return Math.floor(firstStrip * multiplier) / multiplier;
    } else if (!x || typeof x !== 'object') {
        return x;
    } else if (Array.isArray(x)) {
        return x.map((v) => stripPrecision(v, decimalSigFigs));
    } else {
        const stripped = {};
        for (const key of Object.keys(x)) {
            stripped[key] = stripPrecision(x[key], decimalSigFigs);
        }
        return stripped;
    }
}
