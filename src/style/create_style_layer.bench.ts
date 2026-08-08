import {bench} from 'vitest';
import {derefLayers} from '@maplibre/maplibre-gl-style-spec';
import {createStyleLayer} from './create_style_layer.ts';
import brightV9 from '../../test/integration/assets/styles/bright-v9.json' with {type: 'json'};

import type {StyleSpecification} from '@maplibre/maplibre-gl-style-spec';

const style = brightV9 as unknown as StyleSpecification;
const layers = derefLayers(style.layers);

bench('createStyleLayer', () => {
    for (const layer of layers) {
        createStyleLayer(layer, {});
    }
});
