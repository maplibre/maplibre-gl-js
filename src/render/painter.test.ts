import {describe, beforeEach, test, expect, vi} from 'vitest';
import {Painter} from './painter';
import {MercatorTransform} from '../geo/projection/mercator_transform';
import {Style} from '../style/style';
import {StubMap} from '../util/test/util';
import {Texture} from '../webgl/texture';

describe('render', () => {
    let painter: Painter;
    let map: any;
    let style: Style;
    const renderOptions = {
        fadeDuration: 0,
        moving: false,
        rotating: false,
        showOverdrawInspector: false,
        showPadding: false,
        showTileBoundaries: false,
        zooming: false,
        anisotropicFilterPitch: 20,
    };

    beforeEach(() => {
        const gl = document.createElement('canvas').getContext('webgl');
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.resize(512, 512);
        painter = new Painter(gl, transform);
        map = new StubMap() as any;
        style = new Style(map);
        style._setProjectionInternal('mercator');
        style._updatePlacement(transform, false, 0, false);
    });

    test('must not fail with incompletely loaded style', () => {
        painter.render(style, renderOptions);
    });

    test('calls terrainDepth but not terrainCoords', () => {
        const terrainDepth = vi.spyOn(painter.drawFunctions, 'terrainDepth').mockImplementation(() => {});
        const terrainCoords = vi.spyOn(painter.drawFunctions, 'terrainCoords').mockImplementation(() => {});
        map.terrain = {tileManager: {anyTilesAfterTime: () => false}};

        painter.render(style, renderOptions);

        expect(terrainDepth).toHaveBeenCalled();
        expect(terrainCoords).not.toHaveBeenCalled();
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
