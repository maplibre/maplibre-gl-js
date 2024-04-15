import {createMap, beforeMapTest, createStyle} from '../../util/test/util';
import {EvaluationParameters} from '../../style/evaluation_parameters';
import {Style} from '../../style/style';
import {config} from '../../util/config';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

describe('#mapOptions', () => {
    test('maxTileCacheZoomLevels: Default value is set', () => {
        const map = createMap();
        expect(map._maxTileCacheZoomLevels).toBe(config.MAX_TILE_CACHE_ZOOM_LEVELS);
    });

    test('maxTileCacheZoomLevels: Value can be set via map options', () => {
        const map = createMap({maxTileCacheZoomLevels: 1});
        expect(map._maxTileCacheZoomLevels).toBe(1);
    });

    test('Style validation is enabled by default', () => {
        let validationOption = false;
        jest.spyOn(Style.prototype, 'loadJSON').mockImplementationOnce((styleJson, options) => {
            validationOption = options.validate;
        });
        createMap();
        expect(validationOption).toBeTruthy();
    });

    test('Style validation disabled using mapOptions', () => {
        let validationOption = true;
        jest.spyOn(Style.prototype, 'loadJSON').mockImplementationOnce((styleJson, options) => {
            validationOption = options.validate;
        });
        createMap({validateStyle: false});

        expect(validationOption).toBeFalsy();
    });

    test('fadeDuration is set after first idle event', async () => {
        let idleTriggered = false;
        const fadeDuration = 100;
        const spy = jest.spyOn(Style.prototype, 'update').mockImplementation((parameters: EvaluationParameters) => {
            if (!idleTriggered) {
                expect(parameters.fadeDuration).toBe(0);
            } else {
                expect(parameters.fadeDuration).toBe(fadeDuration);
            }
        });
        const style = createStyle();
        const map = createMap({style, fadeDuration});
        await map.once('idle');
        idleTriggered = true;
        map.zoomTo(0.5, {duration: 100});
        spy.mockRestore();
    });
});
