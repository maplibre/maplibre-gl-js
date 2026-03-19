import {describe, test, expect} from 'vitest';
import {Painter} from './painter';
import {MercatorTransform} from '../geo/projection/mercator_transform';
import {Style} from '../style/style';
import {StubMap} from '../util/test/util';
import {Texture} from './texture';

const getStubMap = () => new StubMap() as any;

test('Render must not fail with incompletely loaded style', () => {
    const gl = document.createElement('canvas').getContext('webgl');
    const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
    const painter = new Painter(gl, transform);
    const map = getStubMap();
    const style = new Style(map);
    style._setProjectionInternal('mercator');
    style._updatePlacement(transform, false, 0, false);
    painter.render(style, {
        fadeDuration: 0,
        moving: false,
        rotating: false,
        showOverdrawInspector: false,
        showPadding: false,
        showTileBoundaries: false,
        zooming: false,
        anisotropicFilterPitch: 20,
    });
});

describe('tile texture pool', () => {
    function createPainterWithPool() {
        const gl = document.createElement('canvas').getContext('webgl');
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        return new Painter(gl, transform);
    }

    function createTexture(painter: Painter, size: number): Texture {
        const gl = painter.context.gl;
        const image = {width: size, height: size, data: new Uint8Array(size * size * 4)} as any;
        return new Texture(painter.context, image, gl.RGBA);
    }

    test('saveTileTexture should cap pool size and destroy excess textures', () => {
        // When a raster tile is unloaded, its GPU texture is saved to a
        // reuse pool via saveTileTexture(). During rapid zoom-out, many
        // high-zoom tiles are evicted simultaneously but only a few
        // low-zoom tiles load, so textures accumulate faster than they
        // are reused — causing unbounded VRAM growth.
        //
        // The pool should have a size cap. When exceeded, excess textures
        // should be destroyed to free GPU memory.

        const painter = createPainterWithPool();
        const cap = Painter.MAX_TEXTURE_POOL_SIZE_PER_BUCKET;

        // Fill the pool to capacity
        for (let i = 0; i < cap; i++) {
            painter.saveTileTexture(createTexture(painter, 256));
        }
        expect(painter._tileTextures[256].length).toBe(cap);

        // Save more textures beyond the cap — pool should stay bounded
        const excess: Texture[] = [];
        for (let i = 0; i < 100; i++) {
            const tex = createTexture(painter, 256);
            excess.push(tex);
            painter.saveTileTexture(tex);
        }

        expect(painter._tileTextures[256].length).toBe(cap);

        // Excess textures should have their GL resources freed
        const destroyedCount = excess.filter(t => t.texture === null).length;
        expect(destroyedCount).toBe(100);

        painter.destroy();
    });
});
