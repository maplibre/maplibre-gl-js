import packageJSON from '../package.json' with {type: 'json'};

export default
`/**
 * MapLibre GL JS
 * @license 3-Clause BSD. Full text of license: https://github.com/maplibre/maplibre-gl-js/blob/v${packageJSON.version}/LICENSE.txt
 */`;
