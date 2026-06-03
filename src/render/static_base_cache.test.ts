import {describe, beforeEach, test, expect, vi, afterEach} from 'vitest';
import {Painter} from './painter.ts';
import {MercatorTransform} from '../geo/projection/mercator_transform.ts';
import {createNullGL} from '../util/test/null_gl.ts';

describe('StaticBaseCache', () => {
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

    test('captureCache creates texture and copies framebuffer', () => {
        const manager = painter.staticBaseCache;
        const cache = manager._cache;
        expect(cache._texture).toBeNull();
        expect(cache._cachedLayerCount).toBe(0);

        manager.captureCache(painter.context, painter.width, painter.height, 7);

        expect(cache._texture).toBeTruthy();
        expect(cache._width).toBe(512);
        expect(cache._height).toBe(512);
        expect(cache._cachedLayerCount).toBe(7);
        expect(gl.copyTexSubImage2D).toHaveBeenCalledWith(
            gl.TEXTURE_2D, 0, 0, 0, 0, 0, 512, 512
        );
    });

    test('captureCache reuses texture when size unchanged', () => {
        const manager = painter.staticBaseCache;
        const cache = manager._cache;
        manager.captureCache(painter.context, painter.width, painter.height, 3);
        const firstTexture = cache._texture;

        manager.captureCache(painter.context, painter.width, painter.height, 5);
        expect(cache._texture).toBe(firstTexture);
        expect(cache._cachedLayerCount).toBe(5);
    });

    test('captureCache recreates texture on resize', () => {
        const manager = painter.staticBaseCache;
        const cache = manager._cache;
        manager.captureCache(painter.context, painter.width, painter.height, 3);
        const firstTexture = cache._texture;
        const destroySpy = vi.spyOn(firstTexture, 'destroy');

        painter.width = 1024;
        painter.height = 768;
        manager.captureCache(painter.context, painter.width, painter.height, 4);

        expect(destroySpy).toHaveBeenCalled();
        expect(cache._texture).not.toBe(firstTexture);
        expect(cache._width).toBe(1024);
        expect(cache._height).toBe(768);
    });

    test('destroy cleans up cache texture', () => {
        const manager = painter.staticBaseCache;
        const cache = manager._cache;
        manager.captureCache(painter.context, painter.width, painter.height, 3);
        const destroySpy = vi.spyOn(cache._texture, 'destroy');

        painter.destroy();
        expect(destroySpy).toHaveBeenCalled();
    });

    test('_blitCacheToScreen binds texture and draws quad', () => {
        const manager = painter.staticBaseCache;
        const cache = manager._cache;
        manager.captureCache(painter.context, painter.width, painter.height, 5);

        const drawSpy = vi.fn();
        vi.spyOn(painter, 'useProgram').mockReturnValue({draw: drawSpy} as any);

        cache._blitCacheToScreen(painter);

        expect(gl.bindTexture).toHaveBeenCalledWith(
            gl.TEXTURE_2D, cache._texture.texture
        );
        expect(painter.useProgram).toHaveBeenCalledWith('fullscreenTexture', null, true);
        expect(drawSpy).toHaveBeenCalledTimes(1);

        const args = drawSpy.mock.calls[0];
        expect(args[0]).toBe(painter.context);
        expect(args[1]).toBe(gl.TRIANGLES);
        expect(args[9]).toBe('$fullscreenTexture');
        expect(args[10]).toBe(painter.viewportBuffer);
        expect(args[11]).toBe(painter.quadTriangleIndexBuffer);
        expect(args[12]).toBe(painter.viewportSegments);
    });
});
