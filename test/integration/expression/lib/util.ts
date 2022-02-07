import compactStringify from 'json-stringify-pretty-compact';

// we have to handle this edge case here because we have test fixtures for this
// edge case, and we don't want UPDATE=1 to mess with them
export function stringify(v) {
    let s = compactStringify(v);
    // http://timelessrepo.com/json-isnt-a-javascript-subset
    if (s.indexOf('\u2028') >= 0) {
        s = s.replace(/\u2028/g, '\\u2028');
    }
    if (s.indexOf('\u2029') >= 0) {
        s = s.replace(/\u2029/g, '\\u2029');
    }
    return s;
}

const decimalSigFigs = 6;

export function stripPrecision(x) {
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
    } else if (typeof x !== 'object') {
        return x;
    } else if (Array.isArray(x)) {
        return x.map(stripPrecision);
    } else {
        const stripped = {};
        for (const key of Object.keys(x)) {
            stripped[key] = stripPrecision(x[key]);
        }
        return stripped;
    }
}

export function deepEqual(a, b) {
    if (typeof a !== typeof b)
        return false;
    if (typeof a === 'number') {
        return stripPrecision(a) === stripPrecision(b);
    }
    if (a === null || b === null || typeof a !== 'object')
        return a === b;

    const ka = Object.keys(a);
    const kb = Object.keys(b);

    if (ka.length !== kb.length)
        return false;

    ka.sort();
    kb.sort();

    for (let i = 0; i < ka.length; i++)
        if (ka[i] !== kb[i] || !deepEqual(a[ka[i]], b[ka[i]]))
            return false;

    return true;
}
