
import fs from 'fs';
import childProcess from 'child_process';

console.log('Starting bundling types');

function generateGLTypes() {
    if (!fs.existsSync('dist')) {
        fs.mkdirSync('dist');
    }
    const outputFile = './dist/maplibre-gl.d.ts';
    childProcess.execSync(`dts-bundle-generator --no-check --umd-module-name=maplibregl -o ${outputFile} ./src/index.ts`);
    let types = fs.readFileSync(outputFile, 'utf8');
    // Classes are not exported but should be since this is exported as UMD - fixing...
    types = types.replace(/declare class/g, 'export declare class');
    fs.writeFileSync(outputFile, types);
    console.log('Finished building maplibre-gl');
}

function generateStyleSpecTypes() {
    const moduleBasePath = './src/style-spec';
    const outputPath = `${moduleBasePath}/dist`;
    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath);
    }
    const outputFile = `${outputPath}/index.d.ts`;
    childProcess.execSync(`dts-bundle-generator --no-check -o ${outputFile} ${moduleBasePath}/style-spec.ts`);
    console.log('Finished building style-spec');
}

generateGLTypes();
generateStyleSpecTypes();

console.log('Finished bundling types');
