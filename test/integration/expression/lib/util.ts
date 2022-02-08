import compactStringify from 'json-stringify-pretty-compact';

// we have to handle this edge case here because we have test fixtures for this
// edge case, and we don't want UPDATE=1 to mess with them
export function stringify(v) {
    let s = compactStringify(v);

    if (s.indexOf('\u2028') >= 0) {
        s = s.replace(/\u2028/g, '\\u2028');
    }
    if (s.indexOf('\u2029') >= 0) {
        s = s.replace(/\u2029/g, '\\u2029');
    }
    return s;
}
