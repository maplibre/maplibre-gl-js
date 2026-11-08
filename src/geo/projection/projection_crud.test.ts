import {afterEach, describe, test, expect} from 'vitest';
import {addProjection, getRegisteredProjection, removeProjection} from './projection_crud.ts';
import {identityCrs, type CRS} from './crs.ts';

function createCrs(name: string): CRS {
    return {
        name,
        projection: {forward: ([lng, lat]) => [lng, lat], inverse: ([x, y]) => [x, y]},
        tileMatrixSet: {origin: [-90, 90], extentAtZoom0: 180},
    };
}

afterEach(() => {
    removeProjection('test:crs');
});

describe('addProjection', () => {
    test('registers a CRS under its name', () => {
        const crs = createCrs('test:crs');
        addProjection(crs);
        expect(getRegisteredProjection('test:crs')).toBe(crs);
    });

    test('throws when the name is already registered', () => {
        addProjection(createCrs('test:crs'));
        expect(() => addProjection(createCrs('test:crs'))).toThrow('A projection called "test:crs" already exists.');
    });

    test('throws for a name without a colon, built in or not, and registers nothing', () => {
        const namesWithoutColon = ['mercator', 'globe', 'vertical-perspective', 'equal-earth'];
        for (const name of namesWithoutColon) {
            expect(() => addProjection(createCrs(name))).toThrow(`The projection name "${name}" needs a colon`);
            expect(getRegisteredProjection(name)).toBeUndefined();
        }
    });

    test('throws for a non-positive zoom 0 extent', () => {
        expect(() => addProjection({...createCrs('test:crs'), tileMatrixSet: {origin: [0, 0], extentAtZoom0: 0}})).toThrow(/extentAtZoom0/);
        expect(() => addProjection({...createCrs('test:crs'), tileMatrixSet: {origin: [0, 0], extentAtZoom0: -1}})).toThrow(/extentAtZoom0/);
        expect(getRegisteredProjection('test:crs')).toBeUndefined();
    });
});

describe('getRegisteredProjection', () => {
    test('finds the pre-registered identity projection', () => {
        expect(getRegisteredProjection('identity')).toBe(identityCrs);
    });

    test('returns undefined for a name nothing registered', () => {
        expect(getRegisteredProjection('test:crs')).toBeUndefined();
    });
});

describe('removeProjection', () => {
    test('throws for a name without a colon and keeps the built-in identity projection', () => {
        expect(() => removeProjection('identity')).toThrow('The projection name "identity" has no colon');
        expect(getRegisteredProjection('identity')).toBe(identityCrs);
    });

    test('removing a name lets it be registered again', () => {
        addProjection(createCrs('test:crs'));
        removeProjection('test:crs');
        expect(getRegisteredProjection('test:crs')).toBeUndefined();

        const replacement = createCrs('test:crs');
        addProjection(replacement);
        expect(getRegisteredProjection('test:crs')).toBe(replacement);
    });
});
