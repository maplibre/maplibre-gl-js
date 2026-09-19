import {describe, test, expect, vi} from 'vitest';
import {Dispatcher} from '../util/dispatcher.ts';
import {type SourceClass, addSourceType, create} from './source.ts';

describe('addSourceType', () => {
    test('adds factory function without a worker url does not dispatch to worker', async () => {
        const sourceType = vi.fn().mockImplementation(function (this: {id: string}, id: string) {
            this.id = id;
        }) as SourceClass;

        // expect no call to load worker source
        const spy = vi.spyOn(Dispatcher.prototype, 'broadcast');

        await addSourceType('foo', sourceType);
        expect(spy).not.toHaveBeenCalled();

        create('id', {type: 'foo'} as any, null, null);
        expect(sourceType).toHaveBeenCalled();
    });

    test('create a custom source without an id throws', async () => {
        const sourceType = vi.fn() as SourceClass;

        // expect no call to load worker source
        const spy = vi.spyOn(Dispatcher.prototype, 'broadcast');

        await addSourceType('foo2', sourceType);
        expect(spy).not.toHaveBeenCalled();

        expect(() => create('id', {type: 'foo2'} as any, null, null)).toThrow('Expected Source id to be id instead of undefined');
        expect(sourceType).toHaveBeenCalled();
    });

    test('refuses to add new type over existing name', async () => {
        const sourceType = function () {} as any as SourceClass;
        await expect(addSourceType('canvas', sourceType)).rejects.toThrow('A source type called "canvas" already exists.');
        await expect(addSourceType('geojson', sourceType)).rejects.toThrow('A source type called "geojson" already exists.');
        await expect(addSourceType('image', sourceType)).rejects.toThrow('A source type called "image" already exists.');
        await expect(addSourceType('raster', sourceType)).rejects.toThrow('A source type called "raster" already exists.');
        await expect(addSourceType('raster-dem', sourceType)).rejects.toThrow('A source type called "raster-dem" already exists.');
        await expect(addSourceType('vector', sourceType)).rejects.toThrow('A source type called "vector" already exists.');
        await expect(addSourceType('video', sourceType)).rejects.toThrow('A source type called "video" already exists.');
    });
});
