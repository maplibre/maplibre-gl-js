import fs from 'fs';
import {globSync} from 'glob';
import path from 'path';

console.log('Generating shaders');

/**
 * This script is intended to copy the glsl file to the compilation output folder,
 * change their extension to .js and export the shaders as strings in javascript.
 * It will also minify them a bit if needed and change the extension to .js
 * After that it will create a combined typescript definition file and manipulate it a bit
 * It will also create a simple package.json file to allow importing this package in webpack
 */

const vertex = globSync('./src/shaders/*.vertex.glsl');
for (const file of vertex) {
    const code = fs.readFileSync(file, 'utf8');
    const content = glslToTs(code, 'vertex');
    const fileName = path.join('.', 'src', 'shaders', `${file.split(path.sep).splice(-1)}.g.ts`);
    fs.writeFileSync(fileName, content);
}

console.log(`Finished converting ${vertex.length} vertex shaders`);

const fragment = globSync('./src/shaders/*.fragment.glsl');
for (const file of fragment) {
    const code = fs.readFileSync(file, 'utf8');
    const content = glslToTs(code, 'fragment');
    const fileName = path.join('.', 'src', 'shaders', `${file.split(path.sep).splice(-1)}.g.ts`);
    fs.writeFileSync(fileName, content);
}

console.log(`Finished converting ${fragment.length} fragment shaders`);

function glslToTs(code: string, type: 'fragment'|'vertex'): string {
    code = code
        .trim(); // strip whitespace at the start/end

    // WebGL1 Compat -- Start

    if (type === 'fragment') {
        code = code
            .replace(/\bin\s/g, 'varying ') // For fragment shaders, replace "in " with "varying "
            .replace('out highp vec4 fragColor;', '');
    }

    if (type === 'vertex') {
        code = code
            .replace(/\bin\s/g, 'attribute ') // For vertex shaders, replace "in " with "attribute "
            .replace(/\bout\s/g, 'varying '); // For vertex shaders, replace "out " with "varying "
    }

    code = code
        .replace(/fragColor/g, 'gl_FragColor')
        .replace(/texture\(/g, 'texture2D(');

    // WebGL1 Compat -- End

    code = code
        .replace(/\s*\/\/[^\n]*\n/g, '\n') // strip double-slash comments
        .replace(/\n+/g, '\n') // collapse multi line breaks
        .replace(/\n\s+/g, '\n') // strip indentation
        .replace(/\s?([+-\/*=,])\s?/g, '$1') // strip whitespace around operators
        .replace(/([;\(\),\{\}])\n(?=[^#])/g, '$1'); // strip more line breaks

    return `// This file is generated. Edit build/generate-shaders.ts, then run \`npm run codegen\`.
export default ${JSON.stringify(code).replaceAll('"', '\'')};\n`;
}
