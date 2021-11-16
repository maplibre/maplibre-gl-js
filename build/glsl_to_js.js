export default function glsl_to_js(code, minify) {
    if (minify) {
        code = code.trim() // strip whitespace at the start/end
            .replace(/\s*\/\/[^\n]*\n/g, '\n') // strip double-slash comments
            .replace(/\n+/g, '\n') // collapse multi line breaks
            .replace(/\n\s+/g, '\n') // strip identation
            .replace(/\s?([+-\/*=,])\s?/g, '$1') // strip whitespace around operators
            .replace(/([;\(\),\{\}])\n(?=[^#])/g, '$1'); // strip more line breaks

    }
    return `export default ${JSON.stringify(code)};`;
}
