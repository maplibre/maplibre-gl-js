import {VideoSource} from './video_source';
import {extend} from '../util/util';
import {getMockDispatcher} from '../util/test/util';

import type {Coordinates} from './image_source';
import {Tile} from './tile';
import {OverscaledTileID} from './tile_id';
import {Evented} from '../util/evented';
import {Transform} from '../geo/transform';
import {VertexBuffer} from '../gl/vertex_buffer';
import {SegmentVector} from '../data/segment';

class StubMap extends Evented {
    transform: Transform;
    style: any;
    painter: any;

    constructor() {
        super();
        this.transform = new Transform();
        this.style = {};
        this.painter = {
            context: {
                gl: {
                    texSubImage2D: () => {}
                }
            }
        };
    }
}

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

    test('fires idle event on prepare call when there is at least one not loaded tile', done => {
        const source = createSource({
            type: 'video',
            urls: [],
            video: {
                readyState: 2,
                play: () => {}
            },
            coordinates: [
                [-76.54, 39.18],
                [-76.52, 39.18],
                [-76.52, 39.17],
                [-76.54, 39.17]
            ]
        });
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 0, 0), 512);
        source.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'idle') {
                expect(tile.state).toBe('loaded');
                done();
            }
        });
        source.onAdd(new StubMap() as any);

        source.tiles[String(tile.tileID.wrap)] = tile;
        // assign dummies directly so we don't need to stub the gl things
        source.boundsBuffer = {} as VertexBuffer;
        source.boundsSegments = {} as SegmentVector;
        source.texture = {
            update: () => {},
            bind: () => {}
        } as any;
        source.prepare();
    });
});
