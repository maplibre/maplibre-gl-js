import {beforeEach, test, expect, vi} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util.ts';
import {type StyleImageInterface} from '../../style/style_image.ts';
import {EvaluationParameters} from '../../style/evaluation_parameters.ts';
import {MessageType} from '../../util/actor_messages.ts';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

test('listImages', async () => {
    const map = createMap();

    await map.once('load');
    expect(map.listImages()).toHaveLength(0);

    map.addImage('img', {width: 1, height: 1, data: new Uint8Array(4)});

    const images = map.listImages();
    expect(images).toHaveLength(1);
    expect(images[0]).toBe('img');
});

test('listImages throws an error if called before "load"', () => {
    const map = createMap();
    expect(() => {
        map.listImages();
    }).toThrow(Error);
});

test('map fires `styleimagemissing` for missing icons without resolving the current request', async () => {
    const map = createMap();

    const id = 'missing-image';

    const sampleImage = {width: 2, height: 1, data: new Uint8Array(8)};

    let called: string;
    map.on('styleimagemissing', e => {
        map.addImage(e.id, sampleImage);
        called = e.id;
    });

    expect(map.hasImage(id)).toBeFalsy();

    const generatedImage = await map.style.imageManager.getImages([id]);
    expect(generatedImage[id]).toBeUndefined();
    expect(called).toBe(id);
    expect(map.hasImage(id)).toBeTruthy();
});

test('map resolves missing icons with an async missing style image resolver', async () => {
    const map = createMap();

    const id = 'missing-style-image-resolver';
    const sampleImage = {width: 2, height: 1, data: new Uint8Array(8)};
    const missingImageEventSpy = vi.fn();
    let called: string;

    map.on('styleimagemissing', missingImageEventSpy);
    map.setMissingStyleImageResolver(async (imageId) => {
        await Promise.resolve();
        called = imageId;
        map.addImage(imageId, sampleImage);
    });

    expect(map.hasImage(id)).toBeFalsy();

    const generatedImage = await map.style.imageManager.getImages([id]);
    expect(generatedImage[id].data.width).toEqual(sampleImage.width);
    expect(generatedImage[id].data.height).toEqual(sampleImage.height);
    expect(generatedImage[id].data.data).toEqual(sampleImage.data);
    expect(called).toBe(id);
    expect(map.hasImage(id)).toBeTruthy();
    expect(missingImageEventSpy).not.toHaveBeenCalled();
});

test('map fires `styleimagemissing` when missing style image resolver returns no image', async () => {
    const map = createMap();

    const id = 'missing-style-image-resolver-fallback';
    const resolver = vi.fn(async () => undefined);
    const missingImageEventSpy = vi.fn();

    map.setMissingStyleImageResolver(resolver);
    map.on('styleimagemissing', missingImageEventSpy);

    const generatedImage = await map.style.imageManager.getImages([id]);
    expect(resolver).toHaveBeenCalledWith(id);
    expect(generatedImage[id]).toBeUndefined();
    expect(missingImageEventSpy).toHaveBeenCalledTimes(1);
    expect(missingImageEventSpy.mock.calls[0][0].id).toBe(id);
    expect(map.hasImage(id)).toBeFalsy();
});

test('map preserves resolved images when missing style image resolver rejects another image', async () => {
    const map = createMap();

    const resolvedId = 'resolved-style-image';
    const rejectedId = 'rejected-style-image';
    const sampleImage = {width: 2, height: 1, data: new Uint8Array(8)};
    const missingImageEventSpy = vi.fn();

    map.setMissingStyleImageResolver(async (imageId) => {
        if (imageId === rejectedId) {
            throw new Error('Failed to resolve image');
        }
        map.addImage(imageId, sampleImage);
    });
    map.on('styleimagemissing', missingImageEventSpy);

    const generatedImages = await map.style.imageManager.getImages([resolvedId, rejectedId]);

    expect(generatedImages[resolvedId].data.width).toEqual(sampleImage.width);
    expect(generatedImages[rejectedId]).toBeUndefined();
    expect(missingImageEventSpy).toHaveBeenCalledTimes(1);
    expect(missingImageEventSpy.mock.calls[0][0].id).toBe(rejectedId);
    expect(map.hasImage(resolvedId)).toBeTruthy();
    expect(map.hasImage(rejectedId)).toBeFalsy();
});

test('map keeps missing style image resolver after replacing the style', async () => {
    const map = createMap();

    await map.once('load');

    const id = 'missing-style-image-resolver-after-set-style';
    const sampleImage = {width: 2, height: 1, data: new Uint8Array(8)};

    map.setMissingStyleImageResolver(async (imageId) => {
        map.addImage(imageId, sampleImage);
    });

    map.setStyle({
        version: 8,
        sources: {},
        layers: []
    });
    map.style.imageManager.setLoaded(true);

    const generatedImages = await map.style.imageManager.getImages([id]);
    expect(generatedImages[id].data.width).toEqual(sampleImage.width);
    expect(map.hasImage(id)).toBeTruthy();
});

test('map getImage matches addImage, uintArray', () => {
    const map = createMap();
    const id = 'add-get-uint';
    const inputImage = {width: 2, height: 1, data: new Uint8Array(8)};

    map.addImage(id, inputImage);
    expect(map.hasImage(id)).toBeTruthy();

    const gotImage = map.getImage(id);
    expect(gotImage.data.width).toEqual(inputImage.width);
    expect(gotImage.data.height).toEqual(inputImage.height);
    expect(gotImage.sdf).toBe(false);
});

test('map getImage matches addImage, uintClampedArray', () => {
    const map = createMap();
    const id = 'add-get-uint-clamped';
    const inputImage = {width: 1, height: 2, data: new Uint8ClampedArray(8)};

    map.addImage(id, inputImage);
    expect(map.hasImage(id)).toBeTruthy();

    const gotImage = map.getImage(id);
    expect(gotImage.data.width).toEqual(inputImage.width);
    expect(gotImage.data.height).toEqual(inputImage.height);
    expect(gotImage.sdf).toBe(false);
});

test('map getImage matches addImage, ImageData', () => {
    const map = createMap();
    const id = 'add-get-image-data';
    const inputImage = new ImageData(1, 3);

    map.addImage(id, inputImage);
    expect(map.hasImage(id)).toBeTruthy();

    const gotImage = map.getImage(id);
    expect(gotImage.data.width).toEqual(inputImage.width);
    expect(gotImage.data.height).toEqual(inputImage.height);
    expect(gotImage.sdf).toBe(false);
});

test('map getImage matches addImage, StyleImageInterface uint', () => {
    const map = createMap();
    const id = 'add-get-style-image-iface-uint';
    const inputImage: StyleImageInterface = {
        width: 3,
        height: 1,
        data: new Uint8Array(12)
    };

    map.addImage(id, inputImage);
    expect(map.hasImage(id)).toBeTruthy();

    const gotImage = map.getImage(id);
    expect(gotImage.data.width).toEqual(inputImage.width);
    expect(gotImage.data.height).toEqual(inputImage.height);
    expect(gotImage.sdf).toBe(false);
});

test('map getImage matches addImage, StyleImageInterface clamped', () => {
    const map = createMap();
    const id = 'add-get-style-image-iface-clamped';
    const inputImage: StyleImageInterface = {
        width: 4,
        height: 1,
        data: new Uint8ClampedArray(16)
    };

    map.addImage(id, inputImage);
    expect(map.hasImage(id)).toBeTruthy();

    const gotImage = map.getImage(id);
    expect(gotImage.data.width).toEqual(inputImage.width);
    expect(gotImage.data.height).toEqual(inputImage.height);
    expect(gotImage.sdf).toBe(false);
});

test('map getImage matches addImage, StyleImageInterface SDF', () => {
    const map = createMap();
    const id = 'add-get-style-image-iface-sdf';
    const inputImage: StyleImageInterface = {
        width: 5,
        height: 1,
        data: new Uint8Array(20)
    };

    map.addImage(id, inputImage, {sdf: true});
    expect(map.hasImage(id)).toBeTruthy();

    const gotImage = map.getImage(id);
    expect(gotImage.data.width).toEqual(inputImage.width);
    expect(gotImage.data.height).toEqual(inputImage.height);
    expect(gotImage.sdf).toBe(true);
});

test('map addImage packs a placeholder for a WebGL image, which brings its own pixels', () => {
    const map = createMap();
    const id = 'add-get-webgl-style-image';
    const onAdd = vi.fn();
    const inputImage: StyleImageInterface = {width: 3, height: 2, data: {renderWithWebGL: vi.fn()}, onAdd};

    map.addImage(id, inputImage);

    const gotImage = map.getImage(id);
    expect(gotImage.data.width).toBe(3);
    expect(gotImage.data.height).toBe(2);
    expect([...gotImage.data.data]).toEqual(new Array(3 * 2 * 4).fill(0));
    expect(gotImage.isWebGLImage).toBe(true);
    expect(gotImage.userImage).toBe(inputImage);
    expect(onAdd).toHaveBeenCalledWith(map, id);
});

test('map updateImage swaps a WebGL image\'s renderWithWebGL callback instead of copying pixels', () => {
    const map = createMap();
    const replacement: StyleImageInterface = {width: 1, height: 1, data: {renderWithWebGL: vi.fn()}};

    map.addImage('webgl', {width: 1, height: 1, data: {renderWithWebGL: vi.fn()}});
    const version = map.getImage('webgl').version;
    map.updateImage('webgl', replacement);

    expect(map.getImage('webgl').userImage).toBe(replacement);
    expect(map.getImage('webgl').version).toBe(version + 1);
});

test('map does not fire `styleimagemissing` for empty icon values', async () => {
    const map = createMap();

    await map.once('load');

    map.addSource('foo', {
        type: 'geojson',
        data: {type: 'Point', coordinates: [0, 0]}
    });
    map.addLayer({
        id: 'foo',
        type: 'symbol',
        source: 'foo',
        layout: {
            'icon-image': ['case', true, '', '']
        }
    });

    const spy = vi.fn();
    map.on('styleimagemissing', spy);

    await map.once('idle');
    expect(spy).not.toHaveBeenCalled();
});

test('setImages broadcasts even when getImages is called between addImage and update', async () => {
    const map = createMap();

    await map.once('load');

    const broadcastSpy = vi.fn().mockResolvedValue({});
    map.style.dispatcher.broadcast = broadcastSpy;

    map.addImage('new-image', {width: 1, height: 1, data: new Uint8Array(4)});

    await map.style.getImages('0', {
        icons: ['some-other-image'],
        source: 'test-source',
        tileID: {key: 'test-tile'} as any,
        type: 'icons',
    });

    map.style.update(new EvaluationParameters(0));

    const setImagesCalls = broadcastSpy.mock.calls.filter(
        (c) => c[0] === MessageType.setImages
    );
    expect(setImagesCalls.length).toBeGreaterThanOrEqual(1);
    expect(setImagesCalls.flatMap((c) => c[1])).toContain('new-image');
});

test('setImages broadcasts after missing style image resolver adds an image', async () => {
    const map = createMap();

    await map.once('load');

    const broadcastSpy = vi.fn().mockResolvedValue({});
    map.style.dispatcher.broadcast = broadcastSpy;

    map.setMissingStyleImageResolver((id) => {
        map.addImage(id, {width: 1, height: 1, data: new Uint8Array(4)});
    });

    await map.style.getImages('0', {
        icons: ['missing-image'],
        source: 'test-source',
        tileID: {key: 'test-tile'} as any,
        type: 'icons',
    });

    map.style.update(new EvaluationParameters(0));

    const setImagesCalls = broadcastSpy.mock.calls.filter(
        (c) => c[0] === MessageType.setImages
    );
    expect(setImagesCalls.length).toBeGreaterThanOrEqual(1);
    expect(setImagesCalls.flatMap((c) => c[1])).toContain('missing-image');
});
