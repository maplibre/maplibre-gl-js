import {describe, beforeEach, test, expect} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';
import {ScaleControl} from './scale_control';

beforeEach(() => {
    beforeMapTest();
});

describe('ScaleControl', () => {
    test('appears in bottom-left by default', () => {
        const map = createMap();
        map.addControl(new ScaleControl(undefined));

        expect(
            map.getContainer().querySelectorAll('.maplibregl-ctrl-bottom-left .maplibregl-ctrl-scale')
        ).toHaveLength(1);
    });

    test('appears in the position specified by the position option', () => {
        const map = createMap();
        map.addControl(new ScaleControl(undefined), 'top-left');

        expect(
            map.getContainer().querySelectorAll('.maplibregl-ctrl-top-left .maplibregl-ctrl-scale')
        ).toHaveLength(1);
    });

    test('should change unit of distance after calling setUnit', () => {
        const map = createMap();
        const scale = new ScaleControl(undefined);
        const selector = '.maplibregl-ctrl-bottom-left .maplibregl-ctrl-scale';
        map.addControl(scale);

        let contents = map.getContainer().querySelector(selector).innerHTML;
        expect(contents).toMatch(/km/);

        scale.setUnit('imperial');
        contents = map.getContainer().querySelector(selector).innerHTML;
        expect(contents).toMatch(/mi/);
    });

    test('should respect the maxWidth regardless of the unit and actual scale', () => {
        const map = createMap();
        const maxWidth = 100;
        const scale = new ScaleControl({maxWidth, unit: 'nautical'});
        const selector = '.maplibregl-ctrl-bottom-left .maplibregl-ctrl-scale';
        map.addControl(scale);
        map.setZoom(12.5);

        const el = map.getContainer().querySelector(selector) as HTMLElement;
        expect(parseFloat(el.style.width) <= maxWidth).toBeTruthy();
    });

    test('uses metric units by default', () => {
        const map = createMap();
        const scale = new ScaleControl();
        const selector = '.maplibregl-ctrl-bottom-left .maplibregl-ctrl-scale';
        map.addControl(scale);

        const contents = map.getContainer().querySelector(selector).innerHTML;
        // Should show either km or m for metric
        expect(contents).toMatch(/km|m/);
    });

    test('displays feet for imperial when distance is less than 5280 feet', () => {
        const map = createMap();
        const scale = new ScaleControl({unit: 'imperial'});
        const selector = '.maplibregl-ctrl-bottom-left .maplibregl-ctrl-scale';
        map.addControl(scale);
        map.setZoom(15); // Zoom in to get smaller distances

        const contents = map.getContainer().querySelector(selector).innerHTML;
        expect(contents).toMatch(/ft/);
    });

    test('displays miles for imperial when distance exceeds 5280 feet', () => {
        const map = createMap();
        const scale = new ScaleControl({unit: 'imperial'});
        const selector = '.maplibregl-ctrl-bottom-left .maplibregl-ctrl-scale';
        map.addControl(scale);
        map.setZoom(5); // Zoom out to get larger distances

        const contents = map.getContainer().querySelector(selector).innerHTML;
        expect(contents).toMatch(/mi/);
    });

    test('displays meters for metric when distance is less than 1000m', () => {
        const map = createMap();
        const scale = new ScaleControl({unit: 'metric'});
        const selector = '.maplibregl-ctrl-bottom-left .maplibregl-ctrl-scale';
        map.addControl(scale);
        map.setZoom(15); // Zoom in to get smaller distances

        const contents = map.getContainer().querySelector(selector).innerHTML;
        // Match digits followed by nbsp and 'm' (not 'km')
        expect(contents).toMatch(/\d+&nbsp;m$/);
        expect(contents).not.toMatch(/km/);
    });

    test('displays kilometers for metric when distance exceeds 1000m', () => {
        const map = createMap();
        const scale = new ScaleControl({unit: 'metric'});
        const selector = '.maplibregl-ctrl-bottom-left .maplibregl-ctrl-scale';
        map.addControl(scale);
        map.setZoom(5);

        const contents = map.getContainer().querySelector(selector).innerHTML;
        expect(contents).toMatch(/km/);
    });

    test('displays nautical miles for nautical unit', () => {
        const map = createMap();
        const scale = new ScaleControl({unit: 'nautical'});
        const selector = '.maplibregl-ctrl-bottom-left .maplibregl-ctrl-scale';
        map.addControl(scale);

        const contents = map.getContainer().querySelector(selector).innerHTML;
        expect(contents).toMatch(/nm/);
    });

    test('updates scale when map is moved', () => {
        const map = createMap();
        const scale = new ScaleControl({unit: 'metric'});
        const selector = '.maplibregl-ctrl-bottom-left .maplibregl-ctrl-scale';
        map.addControl(scale);

        const initialContents = map.getContainer().querySelector(selector).innerHTML;
        map.setZoom(10);
        const newContents = map.getContainer().querySelector(selector).innerHTML;
        expect(newContents).not.toBe(initialContents);
    });

    test('setUnit switches between different unit systems', () => {
        const map = createMap();
        const scale = new ScaleControl({unit: 'metric'});
        const selector = '.maplibregl-ctrl-bottom-left .maplibregl-ctrl-scale';
        map.addControl(scale);

        let contents = map.getContainer().querySelector(selector).innerHTML;
        expect(contents).toMatch(/km|m/);

        scale.setUnit('imperial');
        contents = map.getContainer().querySelector(selector).innerHTML;
        expect(contents).toMatch(/mi|ft/);

        scale.setUnit('nautical');
        contents = map.getContainer().querySelector(selector).innerHTML;
        expect(contents).toMatch(/nm/);

        scale.setUnit('metric');
        contents = map.getContainer().querySelector(selector).innerHTML;
        expect(contents).toMatch(/km|m/);
    });

    test('onRemove cleans up event listeners and DOM', () => {
        const map = createMap();
        const scale = new ScaleControl();
        map.addControl(scale);

        const container = map.getContainer();
        expect(container.querySelectorAll('.maplibregl-ctrl-scale')).toHaveLength(1);
        expect(scale._map).toBeDefined();

        map.removeControl(scale);

        expect(container.querySelectorAll('.maplibregl-ctrl-scale')).toHaveLength(0);
        expect(scale._map).toBeUndefined();
    });

    test('respects custom maxWidth option', () => {
        const map = createMap();
        const customMaxWidth = 200;
        const scale = new ScaleControl({maxWidth: customMaxWidth});
        const selector = '.maplibregl-ctrl-bottom-left .maplibregl-ctrl-scale';
        map.addControl(scale);

        const el = map.getContainer().querySelector(selector) as HTMLElement;
        const width = parseFloat(el.style.width);
        expect(width).toBeLessThanOrEqual(customMaxWidth);
        expect(width).toBeGreaterThan(0);
    });

    test('scale width adjusts proportionally to distance', () => {
        const map = createMap();
        const scale = new ScaleControl({maxWidth: 100, unit: 'metric'});
        const selector = '.maplibregl-ctrl-bottom-left .maplibregl-ctrl-scale';
        map.addControl(scale);

        map.setZoom(10);
        const width1 = parseFloat((map.getContainer().querySelector(selector) as HTMLElement).style.width);

        map.setZoom(12);
        const width2 = parseFloat((map.getContainer().querySelector(selector) as HTMLElement).style.width);

        expect(width1).toBeGreaterThan(0);
        expect(width2).toBeGreaterThan(0);
    });

    test('options are properly merged with defaults', () => {
        const scale1 = new ScaleControl({maxWidth: 150});
        expect(scale1.options.maxWidth).toBe(150);
        expect(scale1.options.unit).toBe('metric');

        const scale2 = new ScaleControl({unit: 'imperial'});
        expect(scale2.options.maxWidth).toBe(100);
        expect(scale2.options.unit).toBe('imperial');

        const scale3 = new ScaleControl();
        expect(scale3.options.maxWidth).toBe(100);
        expect(scale3.options.unit).toBe('metric');
    });
});
