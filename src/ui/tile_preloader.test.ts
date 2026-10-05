import {describe, expect, test} from 'vitest';
import {TilePreloader} from './tile_preloader.ts';
import {MercatorTransform} from '../geo/projection/mercator_transform.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {LngLat} from '../geo/lng_lat.ts';

import type {ITransform} from '../geo/transform_interface.ts';
import type {CameraMovement} from './camera_movement.ts';

/**
 * A tile manager that records what it was asked for, and nothing else. The tiles a camera state
 * covers are derived from the state itself, so the fake answers the way a real one does and a second
 * preload against it sees the same path again.
 */
function fakeTileManager(tilesPerState: number) {
    const asked: string[] = [];
    /** How many camera states the preload asked this source to cover, which is what `frameCount` buys. */
    const coverings = {count: 0};
    const listeners: Array<() => void> = [];
    const loading: Array<{landed: boolean; isSettled(): boolean}> = [];
    /** X coordinates the camera already holds, so asking for them is a no-op worth no budget. */
    const warmX = new Set<number>();
    /** Run by the fake as it answers a request, standing in for a `dataloading` listener on the app's side. */
    let whileAnswering: (() => void) | undefined;

    const abandoned = {count: 0};

    return {
        abandoned,
        asked,
        coverings,
        warmX,
        /** How many listeners the preload has attached and not yet let go of. */
        listening: () => listeners.length,
        /** Reports every tile the preload is waiting on as landed, the way a source reports a load. */
        landLoadedTiles: () => {
            for (const tile of loading) tile.landed = true;
            for (const listener of [...listeners]) listener();
        },
        /**
         * Reports every tile the preload is waiting on as settled without an event, the way a source
         * reports a request that errored or came back not-modified.
         */
        settleSilently: () => {
            for (const tile of loading) tile.landed = true;
        },
        onAnswering: (run: () => void) => { whileAnswering = run; },
        tileManager: {
            used: true,
            abandonPreloadedTiles: () => { abandoned.count++; },
            coveringTiles: (tr: ITransform) => {
                coverings.count++;
                const z = Math.floor(tr.zoom);
                // Laid out along x before moving up a row, so that a state wide enough to fill the
                // in-flight window still covers as many distinct tiles as the test asked for.
                const first = Math.floor(tr.center.lng) % 32;
                return Array.from({length: tilesPerState}, (_, i) =>
                    new OverscaledTileID(z, 0, z, (first + i) % 32, Math.floor(i / 32)));
            },
            preloadTiles: (tileIDs: OverscaledTileID[]) => {
                whileAnswering?.();
                // A tile the camera already has is skipped, the way `TileManager` skips one that is
                // already in view, and costs the preload nothing.
                const cold = tileIDs.filter((tileID) => !warmX.has(tileID.canonical.x));
                asked.push(...cold.map((tileID) => tileID.key));
                return cold.map(() => {
                    const tile = {
                        landed: false,
                        isSettled() { return this.landed; }
                    };
                    loading.push(tile);
                    return tile;
                }) as never[];
            },
            on: (type: string, listener: () => void) => {
                if (type === 'data') listeners.push(listener);
            },
            off: (type: string, listener: () => void) => {
                const at = listeners.indexOf(listener);
                if (at >= 0) listeners.splice(at, 1);
            }
        } as never
    };
}

/** A map whose style holds the given tile managers, and nothing else. */
function fakeMap(tileManagers: unknown[]): never {
    const style = {
        tileManagers: Object.fromEntries(tileManagers.map((tileManager, i) => [`source-${i}`, tileManager]))
    };
    return {style} as never;
}

function createTransform(): ITransform {
    const transform = new MercatorTransform();
    transform.resize(512, 512);
    transform.setZoom(5);
    transform.setCenter(new LngLat(20, 30));
    return transform;
}

/** A movement over a path the test supplies, in the shape the preload reads. */
function movement(step: (tr: ITransform, k: number) => void, transform: ITransform = createTransform(), duration = 2000): CameraMovement {
    return {
        transform,
        duration,
        easing: (k) => k,
        freezeElevation: false,
        elevationCenter: transform.center,
        at: (tr) => (k) => step(tr, k),
        applyElevation: () => {}
    };
}

/** A path that leaves the camera where it is, so that every sample covers the same tiles. */
function stillPath() {}

/** A path that carries the camera to a different part of the world, one sample at a time. */
function movingPath(tr: ITransform, k: number) {
    tr.setCenter(new LngLat(20 + k * 4, 30));
}

/**
 * A path that crosses enough ground between samples that each one covers tiles the last did not, which
 * is what makes a movement worth splitting into many samples. The longitudes stay inside the zoom 5
 * pyramid the fixtures work at.
 */
function widePath(tr: ITransform, k: number) {
    tr.setCenter(new LngLat(3 + k * 20, 30));
}

describe('TilePreloader', () => {
    test('asks for nothing for a movement that does not animate', () => {
        const fake = fakeTileManager(4);
        const preloader = new TilePreloader(fakeMap([fake.tileManager]));

        preloader.start(movement(stillPath, createTransform(), 0), {});

        expect(fake.asked).toEqual([]);
        expect(fake.listening()).toBe(0);
    });

    test('asks for nothing for a movement that never ends', () => {
        const fake = fakeTileManager(4);
        const preloader = new TilePreloader(fakeMap([fake.tileManager]));

        // A flight paced from a speed of zero has no end, so its progress never leaves zero and there is
        // no point on its path the preload can read towards.
        preloader.start(movement(stillPath, createTransform(), Infinity), {});

        expect(fake.asked).toEqual([]);
        expect(fake.listening()).toBe(0);
    });

    test('asks for the destination before the ground the camera passes over', () => {
        const fake = fakeTileManager(1);
        const preloader = new TilePreloader(fakeMap([fake.tileManager]));

        preloader.start(movement(movingPath, createTransform(), 2000), {frameCount: 4});

        // A path ends where it is going, so its last sample is the destination, and that goes first
        // however far off it is. The state the camera is in follows it, and the two states between
        // them are read as the camera reaches them. Tile ids are base-36, so `o` is the x value 24 and
        // `l` the x value 21 at zoom 5.
        expect(fake.asked).toEqual(['o55', 'l55']);
    });

    test('asks only for the state ahead of the camera, and reads further as it moves', () => {
        const fake = fakeTileManager(1);
        const preloader = new TilePreloader(fakeMap([fake.tileManager]));

        preloader.start(movement(movingPath, createTransform(), 2000), {frameCount: 4});
        expect(fake.asked).toHaveLength(2);

        preloader.advance(0.5);
        expect(fake.asked).toHaveLength(4);

        // The path is four states long, so there is nothing further left to read.
        preloader.advance(1);
        expect(fake.asked).toHaveLength(4);
    });

    test('does not work out the camera states a cut-short movement never reached', () => {
        const fake = fakeTileManager(1);
        const preloader = new TilePreloader(fakeMap([fake.tileManager]));

        preloader.start(movement(movingPath, createTransform(), 2000), {frameCount: 16});
        preloader.cancel();

        // A state costs a pyramid traversal and, for a style with symbol layers, a scan of every
        // symbol layer against every tile in view. The movement is over, so the fourteen states the
        // camera never got to are nobody's problem. The two worth having are the destination and the
        // state the camera was in, being the only two it was ever going to need.
        expect(fake.coverings.count).toBe(2);
    });

    test('counts a tile once however many camera states cover it', () => {
        const fake = fakeTileManager(2);
        const preloader = new TilePreloader(fakeMap([fake.tileManager]));

        preloader.start(movement(stillPath, createTransform(), 2000), {frameCount: 4});
        preloader.advance(1);
        preloader.finish();

        // Four camera states over one place is one set of tiles.
        expect(fake.asked).toHaveLength(2);
    });

    test('stops asking at the source budget', () => {
        const fake = fakeTileManager(6);
        const preloader = new TilePreloader(fakeMap([fake.tileManager]));

        preloader.start(movement(movingPath, createTransform(), 2000), {frameCount: 4, maxTileCountPerSource: 3});
        preloader.advance(1);
        preloader.finish();

        expect(fake.asked).toHaveLength(3);
        // The budget ran out inside the first state, so the states past it are not read at all.
        expect(fake.coverings.count).toBe(1);
    });

    test('cancelling releases the tiles the preload held', () => {
        const fake = fakeTileManager(4);
        const preloader = new TilePreloader(fakeMap([fake.tileManager]));

        preloader.start(movement(movingPath, createTransform(), 2000), {frameCount: 4});
        preloader.cancel();

        expect(fake.listening()).toBe(0);
    });

    test('a newer movement cancels the one before it', () => {
        const fake = fakeTileManager(4);
        const preloader = new TilePreloader(fakeMap([fake.tileManager]));

        preloader.start(movement(movingPath, createTransform(), 2000), {frameCount: 4});
        expect(fake.listening()).toBe(1);

        preloader.start(movement(movingPath, createTransform(), 2000), {frameCount: 4});
        preloader.finish();

        // The movement that replaced it let the first one's source go, and then its own.
        expect(fake.listening()).toBe(0);
    });

    test('finishing after the camera arrives lets the source go', () => {
        const fake = fakeTileManager(4);
        const preloader = new TilePreloader(fakeMap([fake.tileManager]));

        preloader.start(movement(movingPath, createTransform(), 2000), {frameCount: 4});
        expect(fake.listening()).toBe(1);

        preloader.finish();

        expect(fake.listening()).toBe(0);
    });

    test('with nothing in progress, cancelling and finishing do nothing', () => {
        const fake = fakeTileManager(4);
        const preloader = new TilePreloader(fakeMap([fake.tileManager]));

        preloader.cancel();
        preloader.advance(0.5);
        preloader.finish();

        expect(fake.asked).toEqual([]);
    });

    test('landing tiles is not the movement finishing', () => {
        const fake = fakeTileManager(2);
        const preloader = new TilePreloader(fakeMap([fake.tileManager]));

        preloader.start(movement(movingPath, createTransform(), 2000), {frameCount: 4});
        expect(fake.listening()).toBe(1);

        fake.landLoadedTiles();

        // So the preload is still listening and reads the rest of the path as it goes.
        expect(fake.listening()).toBe(1);

        preloader.finish();

        // Nothing is outstanding, so the preload let the source go.
        expect(fake.listening()).toBe(0);
    });

    test('interrupting a movement gives up on the requests the preload had in flight', () => {
        const fake = fakeTileManager(4);
        const preloader = new TilePreloader(fakeMap([fake.tileManager]));

        preloader.start(movement(movingPath, createTransform(), 2000), {frameCount: 4});
        expect(fake.abandoned.count).toBe(0);

        preloader.cancel();

        // The camera has been redirected, and these requests are holding connections the tiles it is
        // heading for now need.
        expect(fake.abandoned.count).toBe(1);
    });

    test('arriving at the end of a movement lets its requests finish', () => {
        const fake = fakeTileManager(4);
        const preloader = new TilePreloader(fakeMap([fake.tileManager]));

        preloader.start(movement(movingPath, createTransform(), 2000), {frameCount: 4});
        preloader.finish();

        // These are the tiles the camera just crossed. Cancelling them throws away bytes already spent.
        expect(fake.abandoned.count).toBe(0);
    });

    test('a tile landing makes room for the next state the camera is heading into', () => {
        const fake = fakeTileManager(4);
        const preloader = new TilePreloader(fakeMap([fake.tileManager]));

        preloader.start(movement(widePath, createTransform(), 2000), {frameCount: 16});

        // The destination and the state the camera is in, four tiles each.
        expect(fake.asked).toHaveLength(8);

        // Halfway along, the rest of the path is worth reading, but the preload is a guest in the
        // render loop's connection pool: it reads until the window is full and then stops, leaving a
        // dozen requests in flight and none of them landed.
        preloader.advance(0.5);
        expect(fake.asked).toHaveLength(12);

        fake.landLoadedTiles();

        // Those dozen landing freed the whole window, so the preload reads as far ahead of the camera
        // as it can again rather than waiting to be asked.
        expect(fake.asked.length).toBeGreaterThan(12);
    });

    test('holds a camera state wider than the window to what fits in it', () => {
        const fake = fakeTileManager(60);
        const preloader = new TilePreloader(fakeMap([fake.tileManager]));

        preloader.start(movement(stillPath, createTransform(), 2000), {frameCount: 2});

        // One camera state covers a whole viewport's worth of tiles. Taking all of them would carry the
        // preload past its limit and put it in front of the tiles under the camera in the queue, which is
        // the thing the limit is there to prevent.
        expect(fake.asked).toHaveLength(12);

        // The rest of the state is still to ask for, so it goes out as the window drains rather than
        // being dropped with the state it belongs to.
        fake.landLoadedTiles();
        expect(fake.asked).toHaveLength(24);
    });

    test('a tile that settles without an event still frees its place in the window', () => {
        const fake = fakeTileManager(4);
        const preloader = new TilePreloader(fakeMap([fake.tileManager]));

        preloader.start(movement(widePath, createTransform(), 2000), {frameCount: 16});
        preloader.advance(0.5);
        expect(fake.asked).toHaveLength(12);

        // A request that errored, or that the source answered not-modified, settles the tile without
        // the source reporting a load. Nothing announces it, so the preload has to notice for itself.
        fake.settleSilently();
        preloader.advance(0.5);

        expect(fake.asked.length).toBeGreaterThan(12);
    });

    test('every source is asked before any of them is asked a second time', () => {
        const wide = fakeTileManager(60);
        const narrow = fakeTileManager(3);
        const preloader = new TilePreloader(fakeMap([wide.tileManager, narrow.tileManager]));

        preloader.start(movement(stillPath, createTransform(), 2000), {frameCount: 2});

        // Taken in turn, the wide source would spend the whole window before the narrow one had been
        // asked anything, and the camera would arrive at ground the second source never asked for.
        expect(wide.asked).toHaveLength(9);
        expect(narrow.asked).toHaveLength(3);
    });

    test('stops asking when the camera leaves while a request is being made', () => {
        const wide = fakeTileManager(6);
        const narrow = fakeTileManager(3);
        const preloader = new TilePreloader(fakeMap([wide.tileManager, narrow.tileManager]));

        // Standing in for an application handler on `sourcedataloading` that moves the camera, which is
        // what the preload asking for a tile reaching the app makes possible.
        wide.onAnswering(() => preloader.cancel());
        preloader.start(movement(stillPath, createTransform(), 2000), {frameCount: 2});

        // The request already handed to the wide source goes through, but nothing may go on asking
        // after it: the run has ended, so a second source's tiles would be asked for by a preload that
        // no longer exists.
        expect(wide.asked.length).toBeGreaterThan(0);
        expect(narrow.asked).toEqual([]);
        expect(wide.listening()).toBe(0);
        expect(narrow.listening()).toBe(0);
    });

    test('does not spend the budget on tiles the camera already has', () => {
        const fake = fakeTileManager(3);
        // Flying back over ground the map has already loaded: the western tile of the first camera
        // state needs nothing, and the states after it still have something to fetch.
        fake.warmX.add(21);
        const preloader = new TilePreloader(fakeMap([fake.tileManager]));

        preloader.start(movement(movingPath, createTransform(), 2000), {frameCount: 4, maxTileCountPerSource: 3});
        preloader.advance(1);
        preloader.finish();

        // The budget is three. The first state spends two of them, on the two tiles it offers that
        // the camera lacks, and the warm one costs it nothing — which leaves one for the next state,
        // whose eastern tile is new. A budget spent on the warm tile instead would leave none, and
        // the preload would stop having read anything past the first state.
        expect(fake.asked).toHaveLength(3);
    });

    test('falls back to the defaults when the caller asks for something that is not a number', () => {
        const fake = fakeTileManager(1);
        const preloader = new TilePreloader(fakeMap([fake.tileManager]));

        // A typo in a style or a config should cost the caller their defaults, not the whole preload.
        preloader.start(movement(movingPath, createTransform(), 2000), {frameCount: NaN, maxTileCountPerSource: Infinity});
        preloader.advance(1);
        preloader.finish();

        // Two thousand milliseconds of movement is eight samples at four a second.
        expect(fake.coverings.count).toBe(8);
    });

    test('preloads nothing for a style with no sources in use', () => {
        const coverings = {count: 0};
        const unused = {
            used: false,
            coveringTiles: () => { coverings.count++; return []; },
            preloadTiles: () => { throw new Error('a source the style is not using must not be asked for tiles'); },
            abandonPreloadedTiles: () => {},
            on: () => {},
            off: () => {}
        };
        const preloader = new TilePreloader(fakeMap([unused]));

        preloader.start(movement(movingPath, createTransform(), 2000), {frameCount: 4});
        preloader.advance(1);
        preloader.finish();

        expect(coverings.count).toBe(0);
    });

    test('reads the path through the movement easing, so a sample sits where the camera will be', () => {
        const fake = fakeTileManager(1);
        const preloader = new TilePreloader(fakeMap([fake.tileManager]));
        // The camera covers half the path at a fifth of the time, the way a movement that starts slow
        // and arrives quickly does.
        const rushed = {...movement(movingPath), easing: (t: number) => t * t};

        preloader.start(rushed, {frameCount: 4});
        preloader.advance(1);

        // The gaps between the samples grow, because the camera covers more ground later in the
        // movement. A path sampled evenly in time instead would give four equal gaps. Tile ids are
        // base-36, so `k`, `l`, `m`, `o` are the x values 20, 21, 22 and 24 at zoom 5.
        expect(fake.asked).toEqual(['o55', 'k55', 'l55', 'm55']);
    });

    test('clamps a caller asking for more camera states than the bounds allow', () => {
        const generous = fakeTileManager(1);
        const roomy = new TilePreloader(fakeMap([generous.tileManager]));
        roomy.start(movement(movingPath), {frameCount: 100000});
        roomy.advance(1);
        roomy.finish();

        expect(generous.coverings.count).toBe(16);

        const frugal = fakeTileManager(1);
        const thrifty = new TilePreloader(fakeMap([frugal.tileManager]));
        thrifty.start(movement(movingPath), {frameCount: 1});
        thrifty.advance(1);
        thrifty.finish();

        // Two states is the floor, so that there is always one to read ahead of.
        expect(frugal.coverings.count).toBe(2);
    });

    test('clamps a caller asking for no tiles at all', () => {
        const fake = fakeTileManager(4);
        const preloader = new TilePreloader(fakeMap([fake.tileManager]));

        preloader.start(movement(stillPath, createTransform(), 2000), {frameCount: 2, maxTileCountPerSource: 0});

        expect(fake.asked).toHaveLength(1);
    });
});
