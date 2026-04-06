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

function glslToTs(code: string, isWgsl: boolean = false): string {
    if (!isWgsl) {
        code = code
            .trim() // strip whitespace at the start/end
            .replace(/\s*\/\/[^\n]*\n/g, '\n') // strip double-slash comments
            .replace(/\n+/g, '\n') // collapse multi line breaks
            .replace(/\n\s+/g, '\n') // strip indentation
            .replace(/\s?([+-\/*=,])\s?/g, '$1') // strip whitespace around operators
            .replace(/([;\(\),\{\}])\n(?=[^#])/g, '$1'); // strip more line breaks
    } else {
        code = code.trim().replace(/\s*\/\/[^\n]*\n/g, '\n');
        // For WGSL, be less aggressive with space stripping to avoid breaking parsers.
    }

    return `// This file is generated. Edit build/generate-shaders.ts, then run \`npm run codegen\`.
export default ${JSON.stringify(code).replaceAll('"', '\'')};\n`;
}

const shaderFiles = [...globSync('./src/shaders/*.glsl'), ...globSync('./src/shaders/wgsl/*.wgsl')];
for (const file of shaderFiles) {
    const shaderSource = fs.readFileSync(file, 'utf8');
    const isWgsl = file.endsWith('.wgsl');
    const tsSource = glslToTs(shaderSource, isWgsl);
    // Output WGSL .g.ts files into src/shaders/wgsl/, GLSL into src/shaders/
    const outDir = isWgsl ? path.join('.', 'src', 'shaders', 'wgsl') : path.join('.', 'src', 'shaders');
    const fileName = path.join(outDir, `${path.basename(file)}.g.ts`);
    fs.writeFileSync(fileName, tsSource);
}

console.log(`Finished converting ${shaderFiles.length} shaders`);
