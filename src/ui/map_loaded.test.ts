import {createMap, beforeMapTest, createStyle, createStyleSource} from '../util/test/util';
import {Tile} from '../source/tile';
import {OverscaledTileID} from '../source/tile_id';
import {MapSourceDataEvent} from './events';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

describe('#is_Loaded', () => {

    test('Map#isSourceLoaded', async () => {
        const style = createStyle();
        const map = createMap({style});

        await map.once('load');
        const promise = new Promise<void>((resolve) => {
            map.on('data', (e) => {
                let visibilityEventDetected = false;
                if (e.dataType === 'source' && e.sourceDataType === 'visibility') {
                    visibilityEventDetected = true;
                }
                if (e.dataType === 'source' && e.sourceDataType === 'idle') {
                    expect(visibilityEventDetected).toBe(false);
                    expect(map.isSourceLoaded('geojson')).toBe(true);
                    resolve();
                }
            });
        });
        map.addSource('geojson', createStyleSource());
        expect(map.isSourceLoaded('geojson')).toBe(false);
        await promise;
    });

    test('Map#isSourceLoaded (equivalent to event.isSourceLoaded)', async () => {
        const style = createStyle();
        const map = createMap({style});

        await map.once('load');
        const promise = new Promise<void>((resolve) => {
            map.on('data', (e: MapSourceDataEvent) => {
                if (e.dataType === 'source' && 'source' in e) {
                    expect(map.isSourceLoaded('geojson')).toBe(e.isSourceLoaded);
                    if (e.sourceDataType === 'idle') {
                        resolve();
                    }
                }
            });
        });
        map.addSource('geojson', createStyleSource());
        expect(map.isSourceLoaded('geojson')).toBe(false);
        await promise;
    });

    test('Map#isStyleLoaded', done => {
        const style = createStyle();
        const map = createMap({style});

        expect(map.isStyleLoaded()).toBe(false);
        map.on('load', () => {
            expect(map.isStyleLoaded()).toBe(true);
            done();
        });
    });

    test('Map#areTilesLoaded', done => {
        const style = createStyle();
        const map = createMap({style});
        expect(map.areTilesLoaded()).toBe(true);
        map.on('load', () => {
            const fakeTileId = new OverscaledTileID(0, 0, 0, 0, 0);
            map.addSource('geojson', createStyleSource());
            map.style.sourceCaches.geojson._tiles[fakeTileId.key] = new Tile(fakeTileId, undefined);
            expect(map.areTilesLoaded()).toBe(false);
            map.style.sourceCaches.geojson._tiles[fakeTileId.key].state = 'loaded';
            expect(map.areTilesLoaded()).toBe(true);
            done();
        });
    });
});
