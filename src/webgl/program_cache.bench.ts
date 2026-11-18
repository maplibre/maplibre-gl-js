// @vitest-environment jsdom
// The null GL context needs a canvas.
import {test} from 'vitest';
import {Context} from './context.ts';
import {ProgramCache} from './program_cache.ts';
import {ProgramConfiguration} from '../data/program_configuration.ts';
import {createStyleLayer} from '../style/create_style_layer.ts';
import {shaders} from '../shaders/shaders.ts';
import {createNullGL} from '../util/test/null_gl.ts';

import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {TypedStyleLayer} from '../style/style_layer/typed_style_layer.ts';
import type {EvaluationParameters} from '../style/evaluation_parameters.ts';
import type {ZoomHistory} from '../style/zoom_history.ts';

const mercator = {name: 'mercator', define: '#define PROJECTION_MERCATOR', prelude: shaders.projectionMercator};

function programConfiguration(layerSpecification: LayerSpecification): ProgramConfiguration {
    const layer = createStyleLayer(layerSpecification, {}) as TypedStyleLayer;
    layer.recalculate({zoom: 14, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);
    return new ProgramConfiguration(layer, 14, () => true);
}

const variants = [
    {name: 'fill', layer: {id: 'fill', type: 'fill', source: 'source', paint: {'fill-color': ['get', 'color']}}},
    {name: 'fillOutline', layer: {id: 'outline', type: 'fill', source: 'source', paint: {'fill-outline-color': '#000'}}},
    {name: 'line', layer: {id: 'line', type: 'line', source: 'source', paint: {'line-width': ['get', 'width'], 'line-color': ['get', 'color']}}},
    {name: 'lineSDF', layer: {id: 'dashed', type: 'line', source: 'source', paint: {'line-dasharray': [2, 2]}}},
    {name: 'circle', layer: {id: 'circle', type: 'circle', source: 'source', paint: {'circle-radius': ['get', 'radius']}}},
    {name: 'fillExtrusion', layer: {id: 'extrusion', type: 'fill-extrusion', source: 'source', paint: {'fill-extrusion-height': ['get', 'height']}}},
].map(({name, layer}) => ({
    name,
    programConfiguration: programConfiguration(layer as LayerSpecification),
    projectionShaderVariant: mercator,
    showOverdrawInspector: false,
    useTerrain: false,
    defines: []
}));

const cache = new ProgramCache(new Context(createNullGL()));
for (const variant of variants) {
    cache.getProgram(variant);
}

test('ProgramCache', async ({bench}) => {
    await bench('getProgram', () => {
        for (const variant of variants) {
            cache.getProgram(variant);
        }
    }).run();
});
