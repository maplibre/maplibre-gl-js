import fs from 'fs';
import glob from 'glob';

console.log('Generating shaders');

/**
 * This script is intended to copy the glsl file to the compilation output folder,
 * change their extension to .js and export the shaders as strings in javascript.
 * It will also minify them a bit if needed and change the extension to .js
 * After that it will create a combined typescript definition file and manipulate it a bit
 * It will also create a simple package.json file to allow importing this package in webpack
 */

glob('./src/shaders/*.glsl', null, (_err, files) => {
    for (const file of files) {
        const code = fs.readFileSync(file, 'utf8');
        const content = glslToTs(code);
        const fileName = `./src/shaders/${file.split('/').splice(-1)}.g.ts`;
        fs.writeFileSync(fileName, content);
    }
    console.log(`Finished converting ${files.length} glsl files`);
});

function glslToTs(code: string): string {
    code = code
        .trim() // strip whitespace at the start/end
        .replace(/\s*\/\/[^\n]*\n/g, '\n') // strip double-slash comments
        .replace(/\n+/g, '\n') // collapse multi line breaks
        .replace(/\n\s+/g, '\n') // strip identation
        .replace(/\s?([+-\/*=,])\s?/g, '$1') // strip whitespace around operators
        .replace(/([;\(\),\{\}])\n(?=[^#])/g, '$1'); // strip more line breaks

    return `// This file is generated. Edit build/generate-shaders.ts, then run \`npm run codegen\`.
export default ${JSON.stringify(code).replaceAll('"', '\'')};\n`;
}
