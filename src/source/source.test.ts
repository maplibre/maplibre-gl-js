import {Dispatcher} from '../util/dispatcher';
import {SourceClass, addSourceType, create} from './source';

describe('addSourceType', () => {
    test('adds factory function without a worker url does not dispatch to worker', async () => {
        const sourceType = jest.fn().mockImplementation(function (id) { this.id = id; }) as SourceClass;

        // expect no call to load worker source
        const spy = jest.spyOn(Dispatcher.prototype, 'broadcast');

        await addSourceType('foo', sourceType);
        expect(spy).not.toHaveBeenCalled();

        create('id', {type: 'foo'} as any, null, null);
        expect(sourceType).toHaveBeenCalled();
    });

    test('create a custom source without an id throws', async () => {
        const sourceType = jest.fn() as SourceClass;

        // expect no call to load worker source
        const spy = jest.spyOn(Dispatcher.prototype, 'broadcast');

        await addSourceType('foo2', sourceType);
        expect(spy).not.toHaveBeenCalled();

        expect(() => create('id', {type: 'foo2'} as any, null, null)).toThrow();
        expect(sourceType).toHaveBeenCalled();
    });

    test('refuses to add new type over existing name', async () => {
        const sourceType = function () {} as any as SourceClass;
        await expect(addSourceType('canvas', sourceType)).rejects.toThrow();
        await expect(addSourceType('geojson', sourceType)).rejects.toThrow();
        await expect(addSourceType('image', sourceType)).rejects.toThrow();
        await expect(addSourceType('raster', sourceType)).rejects.toThrow();
        await expect(addSourceType('raster-dem', sourceType)).rejects.toThrow();
        await expect(addSourceType('vector', sourceType)).rejects.toThrow();
        await expect(addSourceType('video', sourceType)).rejects.toThrow();
    });
});
