import {clamp} from '../util/util.ts';

import type {CameraMovement} from './camera_movement.ts';
import type {ITransform} from '../geo/transform_interface.ts';
import type {OverscaledTileID} from '../tile/tile_id.ts';
import type {Tile} from '../tile/tile.ts';
import type {TileManager} from '../tile/tile_manager.ts';
import type {Map} from './map.ts';
import type {Terrain} from '../render/terrain.ts';

/**
 * How far a camera movement's tile preload looks, and how much of it may request.
 */
export type PreloadTilesOptions = {
    /**
     * The most tiles the preload may request for one source, between 1 and 2000. Tiles are taken in
     * the order the camera meets them, so a movement gets what it needs first and the rest of the path
     * is left unloaded.
     * @defaultValue 200
     */
    maxTileCountPerSource?: number;

    /**
     * How many camera states along the movement's path to consider, between 2 and 16. Each state is a
     * full set of covering tiles, so a long {@link Map.flyTo} over several zoom levels covers far more
     * of them than a {@link Map.panTo} does, and a path that swings wide wants more samples than a
     * straight one.
     * @defaultValue one sample per 250ms of the movement's duration, held between 2 and 16
     */
    frameCount?: number;
};

/**
 * What a tile preload reports back about a camera movement.
 */
export type PreloadTilesResult = {
    /**
     * How many tiles the sampled path needed across every source, counting the ones that were already
     * loaded or being loaded when the preload began.
     */
    tileCount: number;

    /**
     * How many of those tiles the preload had to request.
     */
    requested: number;

    /**
     * Whether every tile the preload requested has settled, rather than the preload having been cut
     * short by a movement the camera has left.
     */
    completed: boolean;
};

/** What one second of movement is worth in samples, and the bounds that keep a long path's cost sane. */
const SAMPLES_PER_SECOND = 4;
const MIN_FRAME_COUNT = 2;
const MAX_FRAME_COUNT = 16;

/**
 * How far ahead of the camera the preload keeps the path read, and the floor on the number of samples
 * that works out to.
 *
 * The lead is counted in seconds rather than in samples because a sample is worth less time the more
 * of them a movement is divided into: a ten-second flight is sampled sixteen times, so two samples is
 * well over a second of warning, while a one-second flight is sampled four times and two of them is a
 * few tens of milliseconds — not enough for a viewport's worth of tiles to arrive in.
 */
const LEAD_SECONDS = 1;
const MIN_LEAD_FRAMES = 2;

/**
 * How many of the preload's requests may be in flight at once, across every source.
 *
 * A browser holds about six connections open to a tile service, and the render loop needs them for the
 * tiles the viewport is looking at right now. The preload is a guest in that pool, so it fills what
 * the render loop is not using rather than queueing ahead of it: asked without a limit, the tiles for
 * a movement's intermediate states reached the front of the queue before the tiles under the camera,
 * and the movement was slower for it.
 */
const MAX_TILES_IN_FLIGHT = 12;

/** The tiles a preload requests for one source, before and after the caller has had its say. */
const DEFAULT_MAX_TILE_COUNT_PER_SOURCE = 200;
const MAX_TILE_COUNT_PER_SOURCE = 2000;

/** One source's part of a preload: the tiles each sampled camera state needs, in the order it meets them. */
type SourcePlan = {
    tileManager: TileManager;
    terrain?: Terrain;
    /** The camera states along the path, in the order the camera reaches them. */
    frames: ITransform[];
    /** The tiles covering each camera state, worked out only once the camera is near enough to need them. */
    covering: OverscaledTileID[][];
    /** How many of this source's tiles the preload may still request. */
    budget: number;
    /** Every tile this preload has already accounted for, so that the overlap between states is asked for once. */
    seen: Set<string>;
    /** How far along the run's {@link PreloadRun.order} this source has read. */
    cursor: number;
    /** The tiles the preload requested and that have not settled yet. */
    outstanding: Set<Tile>;
    /** Releases the listener that reports the source's tiles landing. */
    stopListening: () => void;
};

/** A preload in progress. */
type PreloadRun = {
    sources: SourcePlan[];
    /**
     * The camera states in the order they are worth having: where the movement ends, and then the way
     * there in the order the camera reaches it.
     *
     * The destination leads because it is what the camera arrives to find. A long movement spends
     * most of its time over ground it is only passing across, and reading that ground at the same rate
     * as the destination put the destination last in a queue it has to be at the front of: measured
     * over intercontinental flights, reading the path in camera order brought *not one* of the
     * destination's tiles in before the camera arrived, whereas asking for them at the start brings
     * all of them in while the camera is still on its way.
     */
    order: number[];
    /** How many of the movement's samples the camera has reached, which gates everything but the destination. */
    eligible: number;
    /** How many samples ahead of the camera to read, worked out from the movement's duration at the start. */
    lead: number;
    /** How many states the movement's path was sampled into. */
    frameCount: number;
    /** What the preload reports when it ends. Filled in as the preload goes, and handed to `resolve`. */
    result: PreloadTilesResult;
    resolve: (result: PreloadTilesResult) => void;
};

/**
 * Loads the tiles a camera movement will need, ahead of the movement reaching them.
 *
 * A camera movement hands this the path it is about to take and keeps handing it its progress while
 * it runs, so the tiles arrive while the camera is still travelling instead of being requested in a
 * burst at the start or, worse, after the camera has already got there.
 *
 * One preload runs at a time. A new movement, a gesture or a {@link Map.jumpTo} cancels the one
 * before it, because the tiles it asked for belong to a path the camera has left.
 */
export class TilePreloader {

    private _map: Map;
    private _run: PreloadRun | null = null;

    constructor(map: Map) {
        this._map = map;
    }

    /**
     * Starts loading the tiles along a camera movement's path.
     *
     * A camera movement does not wait on the result: it reads ahead as it goes and the tiles land
     * while it travels.
     *
     * @param movement - the movement to read ahead of, which the animation is about to run
     * @param options - how far along the path to look, and how much of it to request
     * @param terrain - the terrain the movement runs over
     * @returns the outcome of the preload
     */
    start(movement: CameraMovement, options: PreloadTilesOptions, terrain?: Terrain): Promise<PreloadTilesResult> {
        this.cancel();

        const result: PreloadTilesResult = {tileCount: 0, requested: 0, completed: true};
        // A movement that does not animate is already at its destination, and its tiles are the ones
        // the render loop is loading right now.
        if (movement.duration <= 0) return Promise.resolve(result);

        const frameCount = clamp(Math.round(orDefault(options.frameCount, movement.duration / 1000 * SAMPLES_PER_SECOND)), MIN_FRAME_COUNT, MAX_FRAME_COUNT);
        const frames = sampleCameraPath(movement, frameCount);
        const budget = clamp(Math.round(orDefault(options.maxTileCountPerSource, DEFAULT_MAX_TILE_COUNT_PER_SOURCE)), 1, MAX_TILE_COUNT_PER_SOURCE);

        return new Promise((resolve) => {
            this._run = {
                sources: this._sourcePlans(budget, frames, terrain),
                order: [frameCount - 1, ...Array.from({length: frameCount - 1}, (_, frame) => frame)],
                eligible: 1,
                lead: leadFrames(movement.duration, frameCount),
                frameCount,
                result,
                resolve
            };

            this._issueTiles(1);

            // With no source in use there is nothing to wait for. A source with nothing in flight is
            // not finished either: it will ask for the states the camera has yet to reach as it reaches
            // them, for as long as the movement runs.
            if (this._run.sources.length === 0) this.finish();
        });
    }

    /**
     * Tells the preload how far along its path the camera has come, so that it reads ahead of the
     * camera as the camera moves rather than reading the whole path at the start.
     *
     * @param k - the movement's progress as its frames report it, which is its *eased* progress. The
     *   samples are spaced in the same terms, so a raw time fraction would read ahead of the camera.
     */
    advance(k: number): void {
        const run = this._run;
        if (!run) return;

        // The sample the camera is in, and as many beyond it as a second of the path is worth.
        this._issueTiles(Math.min(run.frameCount, Math.floor(k * run.frameCount) + run.lead));
    }

    /**
     * Ends the preload in progress and reports it as cut short, which is what a movement whose tiles
     * the camera has left behind deserves. The tiles stay in the tile cache and the camera takes them
     * from there if it comes back.
     */
    cancel(): void {
        const run = this._run;
        if (!run) return;

        this._end(run, false);
    }

    /**
     * Ends the preload in progress, which is what reaching the end of a movement does, and reports
     * whether the tiles it asked for all settled. By then the movement's last camera state is the
     * viewport itself, so its tiles are retained by the render loop rather than by the preload.
     */
    finish(): void {
        const run = this._run;
        if (!run) return;

        this._end(run, run.sources.every((source) => source.outstanding.size === 0));
    }

    private _end(run: PreloadRun, completed: boolean): void {
        this._run = null;
        for (const source of run.sources) {
            source.stopListening();
            source.tileManager.releasePreloadedTiles();
            source.outstanding.clear();
        }
        run.result.completed = completed;
        run.resolve(run.result);
    }

    /**
     * Asks every source in use for the tiles of as much of the movement's path as is worth having now,
     * which is the destination and then as far ahead of the camera as a second's worth of samples.
     *
     * Reads from each source's cursor rather than from a mark of how far the last call got, so that a
     * frame held back by the in-flight limit is read when a tile lands rather than being skipped: the
     * states the camera is about to cross are the ones that go stale, not the ones already behind it.
     *
     * @param frames - how many of the movement's samples the camera has reached
     */
    private _issueTiles(frames: number): void {
        const run = this._run;
        if (!run) return;

        // A call that has caught up must not lower the mark, or a later settle would stop the preload
        // reading the path the camera is on its way across.
        run.eligible = Math.max(run.eligible, Math.min(frames, run.frameCount));

        for (const source of run.sources) {
            for (let i = source.cursor; i < run.order.length; i++) {
                const frame = run.order[i];
                // The destination is worth having however early it is asked for. The states on the way
                // there are worth having once the camera is on them.
                if (i > 0 && frame >= run.eligible) break;
                // A source that has spent its budget is left for a later movement: what it still has
                // to pass is not read at all, rather than counted and then dropped.
                if (source.budget <= 0) break;
                // The render loop's requests come first, and the preload takes what is left over.
                if (this._tilesInFlight(run) >= MAX_TILES_IN_FLIGHT) break;

                this._requestStateTiles(run, source, frame);
                source.cursor = i + 1;
            }
        }
    }

    /**
     * How many tiles the preload is waiting for across every source, which is what the limit on how much
     * it may have in flight is counted against.
     */
    private _tilesInFlight(run: PreloadRun): number {
        let inFlight = 0;
        for (const source of run.sources) inFlight += source.outstanding.size;
        return inFlight;
    }

    /**
     * Asks one source for the tiles of one camera state that it has not been accounted for before and
     * can still afford, and remembers what the request left waiting.
     *
     * The batch is capped at what the source has left, and the budget is then debited by what was
     * actually requested rather than by what was offered: a tile the camera already has, or one
     * already in the cache, is worth nothing to the source's budget and must not spend it.
     *
     * @param run - the preload the counters belong to
     * @param source - the source to ask
     * @param frame - which of the path's camera states to read
     */
    private _requestStateTiles(run: PreloadRun, source: SourcePlan, frame: number): void {
        const wanted: OverscaledTileID[] = [];
        for (const tileID of coveringTilesOf(source, frame)) {
            if (source.seen.has(tileID.key)) continue;
            source.seen.add(tileID.key);
            run.result.tileCount++;

            if (wanted.length < source.budget) wanted.push(tileID);
        }

        if (wanted.length === 0) return;
        const tiles = source.tileManager.preloadTiles(wanted);
        source.budget -= tiles.length;
        run.result.requested += tiles.length;
        for (const tile of tiles) {
            if (!tile.isSettled()) source.outstanding.add(tile);
        }
    }

    private _sourcePlans(budget: number, frames: ITransform[], terrain: Terrain | undefined): SourcePlan[] {
        const tileManagers = this._map.style?.tileManagers;
        if (!tileManagers || frames.length === 0) return [];

        const sources: SourcePlan[] = [];
        for (const id in tileManagers) {
            const tileManager = tileManagers[id];
            if (!tileManager?.used) continue;

            const outstanding = new Set<Tile>();
            const stopListening = () => tileManager.off('data', onData);
            // Removed as soon as the preload ends, so a listener only ever runs against the run it
            // was built for and prunes the set that run is waiting on. The listener is built before the
            // run it belongs to exists, so it recognises its own run by the set it is holding rather than
            // by identity: an event already queued when `off()` ran must not top up the movement that
            // replaced this one.
            const onData = () => {
                const current = this._run;
                if (!current?.sources.some((source) => source.outstanding === outstanding)) return;
                for (const tile of outstanding) {
                    if (tile.isSettled()) outstanding.delete(tile);
                }
                // A tile landing frees room for the next one the camera will want. Running dry is not the
                // movement finishing: it is the queue being empty for a moment, and the states the camera
                // has yet to cross still have to be asked for. Ending here left the rest of a long flight's
                // path unloaded as soon as the destination landed, which is most of it.
                this._issueTiles(current.eligible);
            };
            tileManager.on('data', onData);

            sources.push({
                tileManager,
                terrain,
                frames,
                covering: new Array(frames.length),
                budget,
                seen: new Set(),
                cursor: 0,
                outstanding,
                stopListening
            });
        }
        return sources;
    }
}

/**
 * Walks a throwaway transform along a camera movement's path, one step per sample, and hands back the
 * camera states it passes through in the order the camera reaches them.
 *
 * The samples are equally spaced in the movement's *eased* progress, which is the progress its frames
 * are reported with: a sample taken at raw time would not be where the camera is when it is meant to
 * be, and the movement would read the wrong tiles ahead of itself.
 *
 * The sampled states leave the center elevation where the camera has it. Elevation only lifts the
 * camera over terrain, which moves the covering tiles very little, and replaying it would read and
 * write the movement's own elevation state.
 */
function sampleCameraPath(movement: CameraMovement, frameCount: number): ITransform[] {
    const {transform, at, applyElevation, easing, freezeElevation} = movement;
    const tr = transform.clone();
    const step = at(tr);

    const path: ITransform[] = [];
    for (let frame = 1; frame <= frameCount; frame++) {
        const k = easing(frame / frameCount);
        step(k);
        if (!freezeElevation) applyElevation(tr, k);
        path.push(tr.clone());
    }
    return path;
}

/**
 * The tiles covering one of a movement's camera states, worked out the first time the camera is near
 * enough to need them and remembered after.
 *
 * Working a state out costs a pyramid traversal per source, and for a style with symbol layers a scan
 * of every symbol layer against every tile in view, so a movement that is cut short should not pay for
 * the states it never reaches.
 */
function coveringTilesOf(source: SourcePlan, frame: number): OverscaledTileID[] {
    source.covering[frame] ??= source.tileManager.coveringTiles(source.frames[frame], source.terrain);
    return source.covering[frame];
}

/**
 * How many samples ahead of the camera to read, which is a second's worth of the path however many
 * samples the movement was divided into.
 *
 * @param duration - how long the movement runs for, in milliseconds
 * @param frameCount - how many samples its path was divided into
 */
function leadFrames(duration: number, frameCount: number): number {
    if (duration <= 0) return MIN_LEAD_FRAMES;
    return clamp(Math.round(LEAD_SECONDS * frameCount / (duration / 1000)), MIN_LEAD_FRAMES, frameCount);
}

/**
 * The caller's value, or the default, treating a value that is not a number as if it were absent.
 */
function orDefault(value: number | undefined, fallback: number): number {
    return value === undefined || !isFinite(value) ? fallback : value;
}