import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

const packageJSONPath = join(dirname(fileURLToPath(import.meta.url)), '../package.json');
const packageJSON = JSON.parse(readFileSync(packageJSONPath, 'utf8'));

export default
`/**
 * MapLibre GL JS
 * @license 3-Clause BSD. Full text of license: https://github.com/maplibre/maplibre-gl-js/blob/v${packageJSON.version}/LICENSE.txt
 */`;
