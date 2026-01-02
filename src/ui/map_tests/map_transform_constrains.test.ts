import {beforeEach, test, expect, describe} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';
import {fixedLngLat, fixedNum} from '../../../test/unit/lib/fixed';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

test('Creating a map without style constrains invalid hash values to valid Mercator transform values', () => {
    const container = window.document.createElement('div');
    Object.defineProperty(container, 'offsetWidth', {value: 512});
    Object.defineProperty(container, 'offsetHeight', {value: 512});

    const map = createMap({container, center: [-180, -90], zoom: -2});

    expect(fixedLngLat(map.getCenter(), 4)).toEqual({lng: 180, lat: 0});
    expect(fixedNum(map.getZoom(), 3)).toBe(-0.771);
});

test('Creating a map without style keeps valid hash values as Mercator transform values', () => {
    const container = window.document.createElement('div');
    Object.defineProperty(container, 'offsetWidth', {value: 512});
    Object.defineProperty(container, 'offsetHeight', {value: 512});

    const map = createMap({container, center: [15, 30], zoom: 3});

    expect(fixedLngLat(map.getCenter(), 4)).toEqual({lng: 15, lat: 30});
    expect(fixedNum(map.getZoom(), 3)).toBe(3);
});

test('Creating a map with style but no projection uses Mercator transform constrains', () => {
    const container = window.document.createElement('div');
    Object.defineProperty(container, 'offsetWidth', {value: 512});
    Object.defineProperty(container, 'offsetHeight', {value: 512});

    const map = createMap({container, center: [-180, -90], zoom: -2, style: {version: 8, sources: {}, layers: []}});

    expect(fixedLngLat(map.getCenter(), 4)).toEqual({lng: 180, lat: 0});
    expect(fixedNum(map.getZoom(), 3)).toBe(-0.771);
});

test('Creating a map with style but no projection does not constrain valid values', () => {
    const container = window.document.createElement('div');
    Object.defineProperty(container, 'offsetWidth', {value: 512});
    Object.defineProperty(container, 'offsetHeight', {value: 512});

    const map = createMap({container, center: [15, 30], zoom: 3, style: {version: 8, sources: {}, layers: []}});

    expect(fixedLngLat(map.getCenter(), 4)).toEqual({lng: 15, lat: 30});
    expect(fixedNum(map.getZoom(), 3)).toBe(3);
});

test('Creating a map with style defining mercator projection uses Mercator transform constrains', () => {
    const container = window.document.createElement('div');
    Object.defineProperty(container, 'offsetWidth', {value: 512});
    Object.defineProperty(container, 'offsetHeight', {value: 512});

    const map = createMap({container, center: [-180, -90], zoom: -2, style: {version: 8, sources: {}, layers: [], projection: {type: 'mercator'}}});

    expect(fixedLngLat(map.getCenter(), 4)).toEqual({lng: 180, lat: 0});
    expect(fixedNum(map.getZoom(), 3)).toBe(-0.771);
});

test('Creating a map with style defining mercator projection does not constrain valid values', () => {
    const container = window.document.createElement('div');
    Object.defineProperty(container, 'offsetWidth', {value: 512});
    Object.defineProperty(container, 'offsetHeight', {value: 512});

    const map = createMap({container, center: [15, 30], zoom: 3, style: {version: 8, sources: {}, layers: [], projection: {type: 'mercator'}}});

    expect(fixedLngLat(map.getCenter(), 4)).toEqual({lng: 15, lat: 30});
    expect(fixedNum(map.getZoom(), 3)).toBe(3);
});

test('Creating a map with style defining globe projection uses Globe transform constrains', () => {
    const container = window.document.createElement('div');
    Object.defineProperty(container, 'offsetWidth', {value: 512});
    Object.defineProperty(container, 'offsetHeight', {value: 512});

    const map = createMap({container, center: [65.7, -38.2], zoom: -2, style: {version: 8, sources: {}, layers: [], projection: {type: 'globe'}}});

    expect(fixedLngLat(map.getCenter(), 4)).toEqual({lng: 65.7, lat: -38.2});
    expect(fixedNum(map.getZoom(), 3)).toBe(-2);
});

test('Changing a map projection to Mercator constrains the zoom and center to valid values', async () => {
    const map = createMap( {zoom: -2, center: [0, 90], style: {version: 8, sources: {}, layers: [], projection: {type: 'globe'}}});

    await map.once('style.load');
    map.setProjection({type: 'mercator'});

    expect(fixedNum(map.getZoom(), 3)).toBe(-1.356);
    expect(fixedLngLat(map.getCenter(), 4)).toEqual({lng: 0, lat: 0});
});

describe('transformConstrain', () => {

    test('Creating a single-copy map with an identity transform constrain allows the map to underzoom and overpan', () => {
        function customTransformConstrain(lngLat, zoom) {
            return {center: lngLat, zoom: zoom ?? 0};
        };

        const map = createMap({renderWorldCopies: false, zoom: -4, center: [360, 0], transformConstrain: customTransformConstrain});

        expect(fixedLngLat(map.getCenter(), 4)).toEqual({lng: 360, lat: 0});
        expect(fixedNum(map.getZoom(), 3)).toBe(-4);
    });

    test('Changing the transform constrain of a single-copy map to an identity allows the map to underzoom and overpan', () => {
        function customTransformConstrain(lngLat, zoom) {
            return {center: lngLat, zoom: zoom ?? 0};
        };

        const map = createMap({renderWorldCopies: false});

        map.setTransformConstrain(customTransformConstrain);

        map.setZoom(-4);
        map.setCenter({lng: 360, lat: 0});
        expect(fixedNum(map.getZoom(), 3)).toBe(-4);
        expect(fixedLngLat(map.getCenter(), 4)).toEqual({lng: 360, lat: 0});
    });

    test('Clearing the transform constrain of a single-copy map created with underzoom and overpan reconstrains it', () => {
        function customTransformConstrain(lngLat, zoom) {
            return {center: lngLat, zoom: zoom ?? 0};
        };

        const map = createMap({renderWorldCopies: false, zoom: -4, center: [360, 0], transformConstrain: customTransformConstrain});

        map.setTransformConstrain();
        expect(fixedNum(map.getZoom(), 3)).toBe(-1.356);
        expect(fixedLngLat(map.getCenter(), 4)).toEqual({lng: 0, lat: 0});
    });

    test('Switching the projection keeps the transform constrain', async () => {
        function customTransformConstrain(lngLat, zoom) {
            return {center: lngLat, zoom: zoom ?? 0};
        };

        const map = createMap( {renderWorldCopies: false, transformConstrain: customTransformConstrain, style: {version: 8, sources: {}, layers: [], projection: {type: 'globe'}}});

        await map.once('style.load');
        map.setProjection({type: 'mercator'});

        map.setZoom(-4);
        map.setCenter({lng: 360, lat: 0});
        expect(fixedNum(map.getZoom(), 3)).toBe(-4);
        expect(fixedLngLat(map.getCenter(), 4)).toEqual({lng: 360, lat: 0});
    });
});
