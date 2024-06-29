import {getVideo} from '../util/ajax';
import {ResourceType} from '../util/request_manager';

import {ImageSource} from './image_source';
import rasterBoundsAttributes from '../data/raster_bounds_attributes';
import {SegmentVector} from '../data/segment';
import {Texture} from '../render/texture';
import {Event, ErrorEvent} from '../util/evented';
import {ValidationError} from '@maplibre/maplibre-gl-style-spec';

import type {Map} from '../ui/map';
import type {Dispatcher} from '../util/dispatcher';
import type {Evented} from '../util/evented';
import type {VideoSourceSpecification} from '@maplibre/maplibre-gl-style-spec';

/**
 * A data source containing video.
 * (See the [Style Specification](https://maplibre.org/maplibre-style-spec/#sources-video) for detailed documentation of options.)
 *
 * @group Sources
 *
 * @example
 * ```ts
 * // add to map
 * map.addSource('some id', {
 *    type: 'video',
 *    url: [
 *        'https://www.mapbox.com/blog/assets/baltimore-smoke.mp4',
 *        'https://www.mapbox.com/blog/assets/baltimore-smoke.webm'
 *    ],
 *    coordinates: [
 *        [-76.54, 39.18],
 *        [-76.52, 39.18],
 *        [-76.52, 39.17],
 *        [-76.54, 39.17]
 *    ]
 * });
 *
 * // update
 * let mySource = map.getSource('some id');
 * mySource.setCoordinates([
 *     [-76.54335737228394, 39.18579907229748],
 *     [-76.52803659439087, 39.1838364847587],
 *     [-76.5295386314392, 39.17683392507606],
 *     [-76.54520273208618, 39.17876344106642]
 * ]);
 *
 * map.removeSource('some id');  // remove
 * ```
 * @see [Add a video](https://maplibre.org/maplibre-gl-js/docs/examples/video-on-a-map/)
 *
 * Note that when rendered as a raster layer, the layer's `raster-fade-duration` property will cause the video to fade in.
 * This happens when playback is started, paused and resumed, or when the video's coordinates are updated. To avoid this behavior,
 * set the layer's `raster-fade-duration` property to `0`.
 */
export class VideoSource extends ImageSource {
    options: VideoSourceSpecification;
    urls: Array<string>;
    video: HTMLVideoElement;
    roundZoom: boolean;

    constructor(id: string, options: VideoSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super(id, options, dispatcher, eventedParent);
        this.roundZoom = true;
        this.type = 'video';
        this.options = options;
    }

    async load() {
        this._loaded = false;
        const options = this.options;

        this.urls = [];
        for (const url of options.urls) {
            this.urls.push(this.map._requestManager.transformRequest(url, ResourceType.Source).url);
        }
        try {
            const video = await getVideo(this.urls);
            this._loaded = true;
            if (!video) {
                return;
            }
            this.video = video;
            this.video.loop = true;

            // Start repainting when video starts playing. hasTransition() will then return
            // true to trigger additional frames as long as the videos continues playing.
            this.video.addEventListener('playing', () => {
                this.map.triggerRepaint();
            });

            if (this.map) {
                this.video.play();
            }

            this._finishLoading();
        } catch (err) {
            this.fire(new ErrorEvent(err));
        }
    }

    /**
     * Pauses the video.
     */
    pause() {
        if (this.video) {
            this.video.pause();
        }
    }

    /**
     * Plays the video.
     */
    play() {
        if (this.video) {
            this.video.play();
        }
    }

    /**
     * Sets playback to a timestamp, in seconds.
     */
    seek(seconds: number) {
        if (this.video) {
            const seekableRange = this.video.seekable;
            if (seconds < seekableRange.start(0) || seconds > seekableRange.end(0)) {
                this.fire(new ErrorEvent(new ValidationError(`sources.${this.id}`, null, `Playback for this video can be set only between the ${seekableRange.start(0)} and ${seekableRange.end(0)}-second mark.`)));
            } else this.video.currentTime = seconds;
        }
    }

    /**
     * Returns the HTML `video` element.
     *
     * @returns The HTML `video` element.
     */
    getVideo(): HTMLVideoElement {
        return this.video;
    }

    onAdd(map: Map) {
        if (this.map) return;
        this.map = map;
        this.load();
        if (this.video) {
            this.video.play();
            this.setCoordinates(this.coordinates);
        }
    }

    /**
     * Sets the video's coordinates and re-renders the map.
     */
    prepare(): this {
        if (Object.keys(this.tiles).length === 0 || this.video.readyState < 2) {
            return; // not enough data for current position
        }

        const context = this.map.painter.context;
        const gl = context.gl;

        if (!this.boundsBuffer) {
            this.boundsBuffer = context.createVertexBuffer(this._boundsArray, rasterBoundsAttributes.members);
        }

        if (!this.boundsSegments) {
            this.boundsSegments = SegmentVector.simpleSegment(0, 0, 4, 2);
        }

        if (!this.texture) {
            this.texture = new Texture(context, this.video, gl.RGBA);
            this.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
        } else if (!this.video.paused) {
            this.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.video);
        }

        let newTilesLoaded = false;
        for (const w in this.tiles) {
            const tile = this.tiles[w];
            if (tile.state !== 'loaded') {
                tile.state = 'loaded';
                tile.texture = this.texture;
                newTilesLoaded = true;
            }
        }

        if (newTilesLoaded) {
            this.fire(new Event('data', {dataType: 'source', sourceDataType: 'idle', sourceId: this.id}));
        }
    }

    serialize(): VideoSourceSpecification {
        return {
            type: 'video',
            urls: this.urls,
            coordinates: this.coordinates
        };
    }

    hasTransition() {
        return this.video && !this.video.paused;
    }
}
