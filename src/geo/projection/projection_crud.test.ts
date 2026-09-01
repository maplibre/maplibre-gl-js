import {afterEach, describe, test, expect} from 'vitest';
import {addProjection, getRegisteredProjection, removeProjection} from './projection_crud.ts';
import type {CrsDefinition} from './planar_projection.ts';

function createDefinition(name: string): CrsDefinition {
    return {
        name,
        project: (lng, lat) => [lng, lat],
        unproject: (x, y) => [x, y],
        tileMatrix: {origin: [-90, 90], extentAtZoom0: 180},
    };
}

afterEach(() => {
    removeProjection('test-crs');
});

describe('addProjection', () => {
    test('registers a definition under its name', () => {
        const def = createDefinition('test-crs');
        addProjection(def);
        expect(getRegisteredProjection('test-crs')).toBe(def);
    });

    test('pre-registers the simple projection', () => {
        expect(getRegisteredProjection('simple')?.name).toBe('simple');
    });

    test('throws when the name is already registered', () => {
        addProjection(createDefinition('test-crs'));
        expect(() => addProjection(createDefinition('test-crs'))).toThrow('A projection called "test-crs" already exists.');
    });

    test.each(['mercator', 'globe', 'vertical-perspective'])('throws for the built-in name %s', (name) => {
        expect(() => addProjection(createDefinition(name))).toThrow(`A projection called "${name}" is built in and cannot be replaced.`);
        expect(getRegisteredProjection(name)).toBeUndefined();
    });

    test('throws for a non-positive zoom 0 extent', () => {
        expect(() => addProjection({...createDefinition('test-crs'), tileMatrix: {origin: [0, 0], extentAtZoom0: 0}})).toThrow(/extentAtZoom0/);
        expect(() => addProjection({...createDefinition('test-crs'), tileMatrix: {origin: [0, 0], extentAtZoom0: -1}})).toThrow(/extentAtZoom0/);
        expect(getRegisteredProjection('test-crs')).toBeUndefined();
    });
});

describe('removeProjection', () => {
    test('removing a name lets it be registered again', () => {
        addProjection(createDefinition('test-crs'));
        removeProjection('test-crs');
        expect(getRegisteredProjection('test-crs')).toBeUndefined();

        const replacement = createDefinition('test-crs');
        addProjection(replacement);
        expect(getRegisteredProjection('test-crs')).toBe(replacement);
    });
});
