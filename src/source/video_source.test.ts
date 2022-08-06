import VideoSource from './video_source';
import {extend} from '../util/util';
import {getMockDispatcher} from '../util/test/util';

import type {Coordinates} from './image_source';

function createSource(options) {
    const c = options && options.video || window.document.createElement('video');

    options = extend({coordinates: [[0, 0], [1, 0], [1, 1], [0, 1]]}, options);

    const source = new VideoSource('id', options, getMockDispatcher(), options.eventedParent);

    source.video = c;
    return source;
}

describe('VideoSource', () => {
    // Attribution File:Volcano Lava Sample.webm: U.S. Geological Survey (USGS), Public domain, via Wikimedia Commons
    const source = createSource({
        type: 'video',
        urls: ['cropped.mp4', 'https://upload.wikimedia.org/wikipedia/commons/2/22/Volcano_Lava_Sample.webm'],
        coordinates: [
            [-76.54, 39.18],
            [-76.52, 39.18],
            [-76.52, 39.17],
            [-76.54, 39.17]
        ]
    });

    test('constructor', () => {
        expect(source.minzoom).toBe(0);
        expect(source.maxzoom).toBe(22);
        expect(source.tileSize).toBe(512);
    });

    test('sets coordinates', () => {
        const newCoordinates = [[0, 0], [-1, 0], [-1, -1], [0, -1]] as Coordinates;
        source.setCoordinates(newCoordinates);
        const serialized = source.serialize();

        expect(serialized.coordinates).toEqual(newCoordinates);

    });

    //test video retrieval by first supplying the video element directly
    test('gets video', () => {
        const el = window.document.createElement('video');
        // Attribution File:Volcano Lava Sample.webm: U.S. Geological Survey (USGS), Public domain, via Wikimedia Commons
        const source = createSource({
            type: 'video',
            video: el,
            urls: ['cropped.mp4', 'https://upload.wikimedia.org/wikipedia/commons/2/22/Volcano_Lava_Sample.webm'],
            coordinates: [
                [-76.54, 39.18],
                [-76.52, 39.18],
                [-76.52, 39.17],
                [-76.54, 39.17]
            ]
        });

        expect(source.getVideo()).toBe(el);
    });
});
