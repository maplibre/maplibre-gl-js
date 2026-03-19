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

    test('saveTileTexture caps pool size and destroys excess', () => {
        const painter = createPainterWithPool();
        const cap = Painter.MAX_TEXTURE_POOL_SIZE_PER_BUCKET;

        const textures: Texture[] = [];
        for (let i = 0; i < cap + 100; i++) {
            const tex = createTexture(painter, 256);
            textures.push(tex);
            painter.saveTileTexture(tex);
        }

        let reused = 0;
        while (painter.getTileTexture(256)) reused++;
        expect(reused).toBe(cap);

        const destroyed = textures.filter(t => t.texture === null).length;
        expect(destroyed).toBe(100);

        painter.destroy();
    });
});
