import {describe, beforeEach, test, expect, vi, afterEach} from 'vitest';
import {Painter} from './painter.ts';
import {MercatorTransform} from '../geo/projection/mercator_transform.ts';
import {Style} from '../style/style.ts';
import {StubMap} from '../util/test/util.ts';
import {Texture} from '../webgl/texture.ts';
import {createNullGL} from '../util/test/null_gl.ts';

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
        const gl = createNullGL();
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
        const gl = createNullGL();
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

describe('translucent cache', () => {
    let painter: Painter;
    let gl: WebGL2RenderingContext;

    beforeEach(() => {
        gl = createNullGL();
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.resize(512, 512);
        painter = new Painter(gl, transform, true);
        painter.width = 512;
        painter.height = 512;
    });

    afterEach(() => {
        painter.destroy();
    });

    function createMockStyle(layerCount: number, unstableIndex?: number) {
        const mockLayers: Record<string, any> = {};
        const layerIds: string[] = [];
        for (let i = 0; i < layerCount; i++) {
            const id = `layer-${i}`;
            layerIds.push(id);
            mockLayers[id] = {
                id,
                type: 'fill',
                source: 'test',
                unchangedFrameCount: 10,
                isHidden: () => false,
                is3D: () => false,
                hasOffscreenPass: () => false,
                isTileClipped: () => false,
                hasActiveTransition: () => false,
            };
        }
        if (unstableIndex !== undefined) {
            mockLayers[`layer-${unstableIndex}`].unchangedFrameCount = 0;
        }
        return {
            _order: layerIds,
            _layers: mockLayers,
            tileManagers: {},
            map: {terrain: null},
            placement: {symbolFadeChange: () => 1},
            projection: null,
            sky: null,
            lineAtlas: null,
            imageManager: {beginFrame: vi.fn()},
            glyphManager: null,
        } as any;
    }

    const defaultRenderOptions = {
        fadeDuration: 0, moving: false, rotating: false, zooming: false,
        showOverdrawInspector: false, showPadding: false, showTileBoundaries: false,
        anisotropicFilterPitch: 20,
    };

    test('cache is reused when size matches and enough stable layers', () => {
        const manager = painter.staticBaseCache;
        manager.captureCache(painter.context, painter.width, painter.height, 5);

        const clearStencilSpy = vi.spyOn(painter, 'clearStencil').mockImplementation(() => {});
        const useProgramSpy = vi.spyOn(painter, 'useProgram').mockReturnValue({draw: vi.fn()} as any);

        painter.style = createMockStyle(7);

        manager.minLayers = 1;

        painter.render(painter.style, defaultRenderOptions);

        // Cache was blitted via the fullscreenTexture program
        expect(useProgramSpy).toHaveBeenCalledWith('fullscreenTexture', null, true);
        expect(clearStencilSpy).toHaveBeenCalled();
    });

    test('cache is not reused when width changes', () => {
        const manager = painter.staticBaseCache;
        manager.captureCache(painter.context, painter.width, painter.height, 3);

        painter.width = 1024;

        const useProgramSpy = vi.spyOn(painter, 'useProgram');

        painter.style = createMockStyle(0);

        painter.render(painter.style, defaultRenderOptions);

        // fullscreenTexture program should NOT have been used
        const calls = useProgramSpy.mock.calls.filter(c => c[0] === 'fullscreenTexture');
        expect(calls).toHaveLength(0);
    });

    test('cache is not reused when height changes', () => {
        const manager = painter.staticBaseCache;
        manager.captureCache(painter.context, painter.width, painter.height, 3);

        painter.height = 1024;

        const useProgramSpy = vi.spyOn(painter, 'useProgram');

        painter.style = createMockStyle(0);

        painter.render(painter.style, defaultRenderOptions);

        const calls = useProgramSpy.mock.calls.filter(c => c[0] === 'fullscreenTexture');
        expect(calls).toHaveLength(0);
    });

    test('cache is captured when stable layers exceed minimum', () => {
        const manager = painter.staticBaseCache;
        const captureSpy = vi.spyOn(manager, 'captureCache');

        painter.style = createMockStyle(6, 5); // layer-5 is unstable

        manager.minLayers = 1;

        painter.render(painter.style, defaultRenderOptions);

        expect(captureSpy).toHaveBeenCalledWith(painter.context, painter.width, painter.height, 5);
    });
});

describe('RTT pool', () => {
    let painter: Painter;

    beforeEach(() => {
        const gl = createNullGL();
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        painter = new Painter(gl, transform);
    });

    afterEach(() => {
        painter.destroy();
    });

    test('acquireRTT creates on miss, recycles on hit', () => {
        const a = painter.acquireRTT(256);
        expect(a.size).toBe(256);
        expect(a.texture).toBeTruthy();

        painter.releaseRTT(a);
        expect(painter.acquireRTT(256)).toBe(a);
    });

    test('acquireRTT resizes pooled textures when sizes differ', () => {
        const a = painter.acquireRTT(256);
        const texture = a.texture;
        painter.releaseRTT(a);

        const b = painter.acquireRTT(512);
        expect(b).toBe(a);
        expect(b.size).toBe(512);
        expect(b.texture).toBe(texture);
        expect(b.texture.size).toEqual([512, 512]);
    });

    test('bindRTT lazily creates shared FBO and binds texture', () => {
        expect(painter._rttSharedFbo).toBeNull();
        const obj = painter.acquireRTT(256);
        painter.bindRTT(obj);
        expect(painter._rttSharedFbo).toBeTruthy();
        expect(painter._rttSharedFbo.size).toBe(256);
    });

    test('bindRTT resizes shared depth-stencil when size changes', () => {
        const a = painter.acquireRTT(256);
        painter.bindRTT(a);
        expect(painter._rttSharedFbo.size).toBe(256);

        const b = painter.acquireRTT(512);
        painter.bindRTT(b);
        expect(painter._rttSharedFbo.size).toBe(512);
    });

    test('painter.destroy cleans up pooled RTT textures and shared FBO', () => {
        const objs = [];
        for (let i = 0; i < 10; i++) {
            const obj = painter.acquireRTT(128);
            vi.spyOn(obj.texture, 'destroy');
            objs.push(obj);
        }
        // Bind one to force shared FBO creation
        painter.bindRTT(objs[0]);
        for (const obj of objs) painter.releaseRTT(obj);

        painter.destroy();
        const destroyed = objs.filter(o => o.texture.destroy.mock.calls.length > 0).length;
        expect(destroyed).toBe(10);
        expect(painter._rttSharedFbo).toBeNull();
    });
});
