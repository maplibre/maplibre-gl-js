
import fs from 'fs';
import childProcess from 'child_process';

if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
}

console.log('Starting bundling types');
let outputFile = './dist/maplibre-gl.d.ts';
childProcess.execSync(`dts-bundle-generator --umd-module-name=maplibregl -o ${outputFile} ./src/index.ts`);
let types = fs.readFileSync(outputFile, 'utf8');
// Classes are not exported but should be since this is exported as UMD - fixing...
types = types.replace(/declare class/g, 'export declare class');
fs.writeFileSync(outputFile, types);

console.log('Finifhed bundling types for maplibre-gl starting style-spec');

const outputPath = './dist/style-spec';
if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath);
}
outputFile = `${outputPath}/index.d.ts`;
childProcess.execSync(`dts-bundle-generator -o ${outputFile} ./src/style-spec/style-spec.ts`);

console.log('Finished bundling types');
