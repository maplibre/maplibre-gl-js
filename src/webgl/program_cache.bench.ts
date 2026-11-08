import {test} from 'vitest';
import {Context} from './context.ts';
import {ProgramCache} from './program_cache.ts';
import {shaders} from '../shaders/shaders.ts';
import {NullWebGL2RenderingContext} from '../util/test/null_gl.ts';

import type {ProgramConfiguration} from '../data/program_configuration.ts';

const paintProperties = ['icon-opacity', 'icon-color', 'icon-halo-color', 'icon-halo-width', 'icon-halo-blur', 'text-opacity', 'text-color', 'text-halo-color', 'text-halo-width', 'text-halo-blur'];
const names = ['symbolIcon', 'symbolSDF', 'fill', 'fillOutline', 'line', 'circle', 'clippingMask'] as const;

// One configuration per bucket, i.e. per tile and layer, each with its own copy of the cache key.
const configurations: ProgramConfiguration[] = [];
for (let i = 0; i < 300; i++) {
    const keys = paintProperties.slice(0, 4 + (i % 7)).map((property, j) => `/${(i + j) % 3 ? 'u' : 'a'}_${property}`);
    configurations.push({
        cacheKey: keys.sort().join(''),
        getBinderAttributes: () => [],
        getBinderUniforms: () => [],
        getUniforms: () => [],
        defines: () => []
    } as Partial<ProgramConfiguration> as ProgramConfiguration);
}

// The bench runs in node, without a document to create a canvas from.
const cache = new ProgramCache(new Context(new NullWebGL2RenderingContext(null) as unknown as WebGL2RenderingContext));

/** The lookups of a frame with 1 500 draw calls. The map builds a new projection variant every frame. */
function drawFrame() {
    const projectionShaderVariant = {name: 'mercator', define: '#define PROJECTION_MERCATOR', prelude: shaders.projectionMercator};
    for (let i = 0; i < 1500; i++) {
        cache.getProgram({
            name: names[i % names.length],
            programConfiguration: configurations[i % configurations.length],
            projectionShaderVariant,
            showOverdrawInspector: false,
            useTerrain: false,
            defines: []
        });
    }
}

drawFrame();

test('ProgramCache.getProgram', async ({bench}) => {
    await bench('1 500 lookups of cached programs', drawFrame).run();
});
