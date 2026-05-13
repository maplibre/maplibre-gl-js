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
        painter = new Painter(gl, transform);
        painter.width = 512;
        painter.height = 512;
    });

    afterEach(() => {
        painter.destroy();
    });

    test('_snapshotTranslucentCache creates texture and copies framebuffer', () => {
        expect(painter._translucentCacheTexture).toBeNull();
        expect(painter._translucentCachedLayerCount).toBe(0);

        painter._snapshotTranslucentCache(7);

        expect(painter._translucentCacheTexture).toBeTruthy();
        expect(painter._translucentCacheWidth).toBe(512);
        expect(painter._translucentCacheHeight).toBe(512);
        expect(painter._translucentCachedLayerCount).toBe(7);
        expect(gl.copyTexSubImage2D).toHaveBeenCalledWith(
            gl.TEXTURE_2D, 0, 0, 0, 0, 0, 512, 512
        );
    });

    test('_snapshotTranslucentCache reuses texture when size unchanged', () => {
        painter._snapshotTranslucentCache(3);
        const firstTexture = painter._translucentCacheTexture;

        painter._snapshotTranslucentCache(5);
        expect(painter._translucentCacheTexture).toBe(firstTexture);
        expect(painter._translucentCachedLayerCount).toBe(5);
    });

    test('_snapshotTranslucentCache recreates texture on resize', () => {
        painter._snapshotTranslucentCache(3);
        const firstTexture = painter._translucentCacheTexture;
        const destroySpy = vi.spyOn(firstTexture, 'destroy');

        painter.width = 1024;
        painter.height = 768;
        painter._snapshotTranslucentCache(4);

        expect(destroySpy).toHaveBeenCalled();
        expect(painter._translucentCacheTexture).not.toBe(firstTexture);
        expect(painter._translucentCacheWidth).toBe(1024);
        expect(painter._translucentCacheHeight).toBe(768);
    });

    test('destroy cleans up cache texture', () => {
        painter._snapshotTranslucentCache(3);
        const destroySpy = vi.spyOn(painter._translucentCacheTexture, 'destroy');

        painter.destroy();
        expect(destroySpy).toHaveBeenCalled();
    });

    test('_drawTranslucentCacheTexture binds texture and draws quad', () => {
        // First create a cache texture via snapshot
        painter._snapshotTranslucentCache(5);

        const drawSpy = vi.fn();
        vi.spyOn(painter, 'useProgram').mockReturnValue({draw: drawSpy} as any);

        painter._drawTranslucentCacheTexture();

        expect(gl.bindTexture).toHaveBeenCalledWith(
            gl.TEXTURE_2D, painter._translucentCacheTexture.texture
        );
        expect(painter.useProgram).toHaveBeenCalledWith('translucentCache', null, true);
        expect(drawSpy).toHaveBeenCalledTimes(1);

        const args = drawSpy.mock.calls[0];
        // context
        expect(args[0]).toBe(painter.context);
        // gl.TRIANGLES
        expect(args[1]).toBe(gl.TRIANGLES);
        // layer name
        expect(args[9]).toBe('$translucentCache');
        // vertex buffer
        expect(args[10]).toBe(painter.viewportBuffer);
        // index buffer
        expect(args[11]).toBe(painter.quadTriangleIndexBuffer);
        // segments
        expect(args[12]).toBe(painter.viewportSegments);
    });

    test('cache is valid when size matches and enough stable layers', () => {
        // Simulate an existing cache
        painter._snapshotTranslucentCache(5);
        expect(painter._translucentCachedLayerCount).toBe(5);

        const drawCacheSpy = vi.spyOn(painter, '_drawTranslucentCacheTexture').mockImplementation(() => {});
        const clearStencilSpy = vi.spyOn(painter, 'clearStencil').mockImplementation(() => {});

        // Set up a mock style with stable layers
        const mockLayers: Record<string, any> = {};
        const layerIds: string[] = [];
        for (let i = 0; i < 7; i++) {
            const id = `layer-${i}`;
            layerIds.push(id);
            mockLayers[id] = {
                id,
                type: 'fill',
                source: 'test',
                _unchangedFrameCount: 10,
                isHidden: () => false,
                is3D: () => false,
                hasOffscreenPass: () => false,
                isTileClipped: () => false,
            };
        }

        painter.style = {
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
        painter.translucentCacheEnabled = true;
        painter.translucentCacheMinLayers = 1;

        painter.render(painter.style, {
            fadeDuration: 0, moving: false, rotating: false, zooming: false,
            showOverdrawInspector: false, showPadding: false, showTileBoundaries: false,
            anisotropicFilterPitch: 20,
        });

        // Cache should have been reused
        expect(drawCacheSpy).toHaveBeenCalled();
        expect(clearStencilSpy).toHaveBeenCalled();
    });

    test('cache is invalidated when width changes', () => {
        painter._snapshotTranslucentCache(3);
        expect(painter._translucentCachedLayerCount).toBe(3);

        // Change width — cache should become invalid
        painter.width = 1024;

        const drawCacheSpy = vi.spyOn(painter, '_drawTranslucentCacheTexture').mockImplementation(() => {});

        painter.style = {
            _order: [],
            _layers: {},
            tileManagers: {},
            map: {terrain: null},
            placement: {symbolFadeChange: () => 1},
            projection: null,
            sky: null,
            lineAtlas: null,
            imageManager: {beginFrame: vi.fn()},
            glyphManager: null,
        } as any;
        painter.translucentCacheEnabled = true;

        painter.render(painter.style, {
            fadeDuration: 0, moving: false, rotating: false, zooming: false,
            showOverdrawInspector: false, showPadding: false, showTileBoundaries: false,
            anisotropicFilterPitch: 20,
        });

        expect(drawCacheSpy).not.toHaveBeenCalled();
        expect(painter._translucentCachedLayerCount).toBe(0);
    });

    test('cache is invalidated when height changes', () => {
        painter._snapshotTranslucentCache(3);
        expect(painter._translucentCachedLayerCount).toBe(3);

        // Change height — cache should become invalid
        painter.height = 1024;

        const drawCacheSpy = vi.spyOn(painter, '_drawTranslucentCacheTexture').mockImplementation(() => {});

        painter.style = {
            _order: [],
            _layers: {},
            tileManagers: {},
            map: {terrain: null},
            placement: {symbolFadeChange: () => 1},
            projection: null,
            sky: null,
            lineAtlas: null,
            imageManager: {beginFrame: vi.fn()},
            glyphManager: null,
        } as any;
        painter.translucentCacheEnabled = true;

        painter.render(painter.style, {
            fadeDuration: 0, moving: false, rotating: false, zooming: false,
            showOverdrawInspector: false, showPadding: false, showTileBoundaries: false,
            anisotropicFilterPitch: 20,
        });

        expect(drawCacheSpy).not.toHaveBeenCalled();
        expect(painter._translucentCachedLayerCount).toBe(0);
    });

    test('snapshot is taken when stable layers exceed minimum', () => {
        const snapshotSpy = vi.spyOn(painter, '_snapshotTranslucentCache');

        const mockLayers: Record<string, any> = {};
        const layerIds: string[] = [];
        for (let i = 0; i < 6; i++) {
            const id = `layer-${i}`;
            layerIds.push(id);
            mockLayers[id] = {
                id,
                type: 'fill',
                source: 'test',
                _unchangedFrameCount: 10,
                isHidden: () => false,
                is3D: () => false,
                hasOffscreenPass: () => false,
                isTileClipped: () => false,
            };
        }
        // Last layer is unstable
        mockLayers['layer-5']._unchangedFrameCount = 0;

        painter.style = {
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
        painter.translucentCacheEnabled = true;
        painter.translucentCacheMinLayers = 1;

        painter.render(painter.style, {
            fadeDuration: 0, moving: false, rotating: false, zooming: false,
            showOverdrawInspector: false, showPadding: false, showTileBoundaries: false,
            anisotropicFilterPitch: 20,
        });

        // Should have snapshotted the first 5 stable layers
        expect(snapshotSpy).toHaveBeenCalledWith(5);
        expect(painter._translucentCachedLayerCount).toBe(5);
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
        expect(a.fbo).toBeTruthy();
        expect(a.texture).toBeTruthy();

        painter.releaseRTT(a);
        expect(painter.acquireRTT(256)).toBe(a);
    });

    test('acquireRTT resizes pooled objects when sizes differ', () => {
        const a = painter.acquireRTT(256);
        const fbo = a.fbo;
        const texture = a.texture;
        painter.releaseRTT(a);

        const b = painter.acquireRTT(512);
        expect(b).toBe(a);
        expect(b.size).toBe(512);
        expect(b.fbo).toBe(fbo);
        expect(b.fbo.width).toBe(512);
        expect(b.fbo.height).toBe(512);
        expect(b.texture).toBe(texture);
        expect(b.texture.size).toEqual([512, 512]);
    });

    test('painter.destroy cleans up pooled RTT slots', () => {
        const objs = [];
        for (let i = 0; i < 10; i++) {
            const obj = painter.acquireRTT(128);
            vi.spyOn(obj.texture, 'destroy');
            vi.spyOn(obj.fbo, 'destroy');
            objs.push(obj);
        }
        for (const obj of objs) painter.releaseRTT(obj);

        painter.destroy();
        const destroyed = objs.filter(o => o.texture.destroy.mock.calls.length > 0).length;
        expect(destroyed).toBe(10);
    });
});
