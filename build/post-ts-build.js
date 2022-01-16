import fs from 'fs';
import glob from 'glob';
import child_process from 'child_process';
import glsl_to_js from './glsl_to_js.js';

let args = process.argv.slice(2);
let outputBaseDir = args[0];
let minify = args[1];

console.log(`Copying glsl files to ${outputBaseDir}, minify: ${minify}`);

/**
 * This script is intended to copy the glsl file to the compilation output folder,
 * change their extension to .js and export the shaders as strings in javascript.
 * It will also minify them a bit if needed and change the extension to .js
 * After that it will create a combined typescript definition file and manipulate it a bit
 * It will also create a simple package.json file to allow importing this package in webpack
 */

glob("./src/**/*.glsl", null, (err, files) => {
    for (let file of files) {
        let code = fs.readFileSync(file, 'utf8');
        let content = glsl_to_js(code, minify);
        let fileName = outputBaseDir + '/' + file.split('/').splice(-1) + ".js";
        fs.writeFileSync(fileName, content);
    }
    console.log(`Finished converting ${files.length} glsl files`);
});

if (!fs.existsSync("dist")) {
    fs.mkdirSync("dist");
}

console.log(`Starting bundling types`);
const outputFile = "./dist/maplibre-gl.d.ts";
child_process.execSync(`dts-bundle-generator --no-check --umd-module-name=maplibregl -o ${outputFile} ./src/index.ts`);
let types = fs.readFileSync(outputFile, 'utf8');
types = types.replace(/declare class/g, "export declare class");
fs.writeFileSync(outputFile, types);
console.log(`Finished bundling types`);

fs.writeFileSync("./dist/package.json", '{ "type": "commonjs" }');