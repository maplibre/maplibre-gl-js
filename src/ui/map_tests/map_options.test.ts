import {describe, beforeEach, test, expect, vi} from 'vitest';
import {createMap, beforeMapTest, createStyle} from '../../util/test/util.ts';
import {Style} from '../../style/style.ts';
import {config} from '../../util/config.ts';
import {createNullGL} from '../../util/test/null_gl.ts';

import type {EvaluationParameters} from '../../style/evaluation_parameters.ts';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

describe('mapOptions', () => {
    test('maxTileCacheZoomLevels: Default value is set', () => {
        const map = createMap();
        expect(map._maxTileCacheZoomLevels).toBe(config.MAX_TILE_CACHE_ZOOM_LEVELS);
    });

    test('interactive: tabindex is set accordingly to the interactiveness', () => {
        expect(createMap({interactive: true}).getCanvas().getAttribute('tabindex')).toBe('0');
        expect(createMap({interactive: false}).getCanvas().getAttribute('tabindex')).toBe('-1');
        expect(createMap({locale: {'Map.Title': 'Alt label'}}).getCanvas().getAttribute('aria-label')).toBe('Alt label');
    });

    test('maxTileCacheZoomLevels: Value can be set via map options', () => {
        const map = createMap({maxTileCacheZoomLevels: 1});
        expect(map._maxTileCacheZoomLevels).toBe(1);
    });

    test('colorSpace: the map draws in sRGB by default', () => {
        const map = createMap();
        expect(map.painter.context.gl.drawingBufferColorSpace).toBe('srgb');
        expect(map.painter.context.displayP3).toBe(false);
    });

    test('colorSpace: display-p3 makes the map draw and upload images in Display P3', () => {
        const map = createMap({colorSpace: 'display-p3'});
        const {gl} = map.painter.context;
        expect(gl.drawingBufferColorSpace).toBe('display-p3');
        expect(gl.unpackColorSpace).toBe('display-p3');
        expect(map.painter.context.displayP3).toBe(true);
    });

    test('colorSpace: display-p3 draws in sRGB, with a warning, where the browser cannot draw WebGL in Display P3', () => {
        const gl = createNullGL();
        Reflect.deleteProperty(gl, 'drawingBufferColorSpace');
        Reflect.deleteProperty(gl, 'unpackColorSpace');
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const map = createMap({colorSpace: 'display-p3', deleteStyle: true});

        expect(map.painter.context.displayP3).toBe(false);
        expect(map._colorSpace).toBe('srgb');
        expect(warn).toHaveBeenCalledWith('This browser can\'t draw WebGL in Display P3, so the map draws in sRGB.');
    });

    test('Style validation is enabled by default', () => {
        let validationOption = false;
        vi.spyOn(Style.prototype, 'loadJSON').mockImplementationOnce((styleJson, options) => {
            validationOption = options.validate;
        });
        createMap();
        expect(validationOption).toBeTruthy();
    });

    test('Style validation disabled using mapOptions', () => {
        let validationOption = true;
        vi.spyOn(Style.prototype, 'loadJSON').mockImplementationOnce((styleJson, options) => {
            validationOption = options.validate;
        });
        createMap({validateStyle: false});

        expect(validationOption).toBeFalsy();
    });

    test('fadeDuration is set after first idle event', async () => {
        let idleTriggered = false;
        const fadeDuration = 100;
        const spy = vi.spyOn(Style.prototype, 'update').mockImplementation((parameters: EvaluationParameters) => {
            expect(parameters.fadeDuration).toBe(idleTriggered ? fadeDuration : 0);
        });
        const style = createStyle();
        const map = createMap({style, fadeDuration});
        await map.once('idle');
        idleTriggered = true;
        map.zoomTo(0.5, {duration: 100});
        spy.mockRestore();
    });
});
