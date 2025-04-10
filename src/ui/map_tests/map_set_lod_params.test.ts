import {beforeEach, test, expect} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

test('set tile LOD params for a specific source', async () => {
    const map = createMap({interactive: false});
    await map.once('style.load');

    map.addSource('source-id1', {type: 'raster', url: ''});
    map.addSource('source-id2', {type: 'raster', url: ''});

    expect(map.getSource('source-id1').calculateTileZoom).toBeFalsy();
    map.setSourceTileLodParams(1, 1, 'source-id1');
    expect(map.getSource('source-id1').calculateTileZoom).toBeTruthy();
    expect(map.getSource('source-id2').calculateTileZoom).toBeFalsy();
});

test('set tile LOD params for all sources', async () => {
    const map = createMap({interactive: false});
    await map.once('style.load');

    map.addSource('source-id1', {type: 'raster', url: ''});
    map.addSource('source-id2', {type: 'raster', url: ''});

    expect(map.getSource('source-id1').calculateTileZoom).toBeFalsy();
    expect(map.getSource('source-id2').calculateTileZoom).toBeFalsy();
    map.setSourceTileLodParams(1, 1);
    expect(map.getSource('source-id1').calculateTileZoom).toBeTruthy();
    expect(map.getSource('source-id2').calculateTileZoom).toBeTruthy();
});

test('set tile LOD params for a non-existent source', async () => {
    const map = createMap({interactive: false});
    await map.once('style.load');

    map.addSource('source-id1', {type: 'raster', url: ''});
    map.addSource('source-id2', {type: 'raster', url: ''});

    expect(map.getSource('source-id1').calculateTileZoom).toBeFalsy();
    expect(map.getSource('source-id2').calculateTileZoom).toBeFalsy();
    expect(() => {map.setSourceTileLodParams(1, 1, 'non-existent-source-id');}).toThrowError();
    expect(map.getSource('source-id1').calculateTileZoom).toBeFalsy();
    expect(map.getSource('source-id2').calculateTileZoom).toBeFalsy();
});