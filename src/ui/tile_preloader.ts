import {clamp} from '../util/util.ts';

import type {CameraMovement} from './camera_movement.ts';
import type {ITransform} from '../geo/transform_interface.ts';
import type {OverscaledTileID} from '../tile/tile_id.ts';
import type {Tile} from '../tile/tile.ts';
import type {TileManager} from '../tile/tile_manager.ts';
import type {Terrain} from '../render/terrain.ts';
import type {Map} from './map.ts';

/**
 * The part of a {@link Map} a preload reads: the style's tile managers, and nothing else. A map that is
 * still building has none of them, which is a preload with nothing to ask.
 */
type PreloaderStyle = Pick<Map, 'style'>;

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

/**
 * How many of the preload's requests may be in flight at once, across every source.
 *
 * A browser holds about six connections open to a tile service, and the render loop needs them for the
 * tiles the viewport is looking at right now. The preload is a guest in that pool, so it fills what
 * the render loop is not using rather than queueing ahead of it.
 *
 * Counted in tiles rather than in camera states, because one state's covering set is a whole viewport's
 * worth of them and would carry the preload straight past the limit.
 */
const MAX_TILES_IN_FLIGHT = 12;

/** The tiles a preload requests for one source, before and after the caller has had its say. */
const DEFAULT_MAX_TILE_COUNT_PER_SOURCE = 200;
const MAX_TILE_COUNT_PER_SOURCE = 2000;

/** One source's part of a preload. */
type SourcePlan = {
    tileManager: TileManager;
    terrain?: Terrain;
    /** The camera states along the path, in the order the camera reaches them. */
    frames: ITransform[];
    /**
     * The tiles this source still has to be asked for, in the order they are worth having. Grown a
     * camera state at a time as the camera reaches them.
     */
    queue: OverscaledTileID[];
    /** How far into {@link queue} the source has been asked. */
    cursor: number;
    /** How many of the movement's samples have been read into {@link queue}. */
    read: number;
    /** How many of this source's tiles the preload may still request. */
    budget: number;
    /** Every tile this preload has already accounted for, so that the overlap between states is asked for once. */
    seen: Set<string>;
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
     * The destination leads because it is what the camera arrives to find. A long movement spends most
     * of its time over ground it is only passing across, and reading that ground at the same rate as
     * the destination puts the destination last in a queue it has to be at the front of.
     */
    order: number[];
    /** How many of the movement's samples the camera has reached, which gates everything but the destination. */
    eligible: number;
    /** How many samples ahead of the camera to read, worked out from the movement's duration at the start. */
    lead: number;
    /** How many states the movement's path was sampled into. */
    frameCount: number;
    /** How many tiles the preload is waiting for across every source, which is what the window is counted against. */
    inFlight: number;
};

/**
 * Loads the tiles a camera movement will need, ahead of the movement reaching them.
 *
 * A camera movement hands this the path it is about to take and keeps handing it its progress while
 * it runs, so the tiles arrive while the camera is still travelling instead of being requested in a
 * burst at the start or, worse, after the camera has already got there.
 *
 * One preload runs at a time. A new movement, a gesture or a {@link Map.jumpTo} ends the one before it,
 * because the tiles it asked for belong to a path the camera has left.
 */
export class TilePreloader {

    private _map: PreloaderStyle;
    private _run: PreloadRun | null = null;

    constructor(map: PreloaderStyle) {
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
     */
    start(movement: CameraMovement, options: PreloadTilesOptions, terrain?: Terrain): void {
        this.cancel();

        // A movement that does not animate is already at its destination, and its tiles are the ones
        // the render loop is loading right now. Neither does a movement that has no end to read towards:
        // its progress stays at zero, so it would read its first sample for as long as it runs.
        if (!(movement.duration > 0) || !Number.isFinite(movement.duration)) return;

        const frameCount = clamp(Math.round(orDefault(options.frameCount, movement.duration / 1000 * SAMPLES_PER_SECOND)), MIN_FRAME_COUNT, MAX_FRAME_COUNT);
        const frames = sampleCameraPath(movement, frameCount);
        const budget = clamp(Math.round(orDefault(options.maxTileCountPerSource, DEFAULT_MAX_TILE_COUNT_PER_SOURCE)), 1, MAX_TILE_COUNT_PER_SOURCE);

        this._run = {
            sources: this._sourcePlans(budget, frames, terrain),
            order: [frameCount - 1, ...Array.from({length: frameCount - 1}, (_, frame) => frame)],
            eligible: 1,
            lead: clamp(Math.round(LEAD_SECONDS * frameCount / (movement.duration / 1000)), MIN_FRAME_COUNT, frameCount),
            frameCount,
            inFlight: 0
        };

        this._issueTiles(1);
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
     * Ends the preload in progress and gives up on the tiles it is still loading, which is what a
     * movement whose path the camera has been redirected away from deserves. The requests stop so the
     * tiles the camera is heading for now get the connections.
     */
    cancel(): void {
        const run = this._run;
        if (!run) return;

        this._end(run, true);
    }

    /**
     * Ends the preload in progress, which is what reaching the end of a movement does. The tiles it asked
     * for are the ground the camera has just crossed, so the ones still loading are left to finish and
     * cache themselves rather than cancelled for ground nobody is going back to.
     */
    finish(): void {
        const run = this._run;
        if (!run) return;

        this._end(run, false);
    }

    private _end(run: PreloadRun, abandoned: boolean): void {
        this._run = null;
        for (const source of run.sources) {
            source.stopListening();
            if (abandoned) source.tileManager.abandonPreloadedTiles();
            source.outstanding.clear();
        }
    }

    /**
     * Asks every source in use for as much of the movement's path as is worth having now and as much of
     * it as there is room for, which is the destination and then as far ahead of the camera as a
     * second's worth of samples.
     *
     * Reads from each source's own position rather than from a mark of how far the last call got, so
     * that tiles held back by the in-flight limit are read when a tile settles rather than being
     * skipped: the states the camera is about to cross are the ones that go stale, not the ones already
     * behind it.
     *
     * @param frames - how many of the movement's samples the camera has reached
     */
    private _issueTiles(frames: number): void {
        const run = this._run;
        if (!run) return;

        // A call that has caught up must not lower the mark, or a later settle would stop the preload
        // reading the path the camera is on its way across.
        run.eligible = Math.max(run.eligible, Math.min(frames, run.frameCount));

        // Settled tiles leave the count on every call rather than only when one lands, because a tile
        // settles without an event whenever its request errors or the source answers not-modified. A
        // tile left in the count is a slot the preload does not use again for the rest of the movement.
        for (const source of run.sources) {
            for (const tile of source.outstanding) {
                if (!tile.isSettled()) continue;
                source.outstanding.delete(tile);
                run.inFlight--;
            }
        }

        // Every source reads the states it is allowed to before any of them asks for a tile, so that
        // each can be given a share of what is left of the window. Read one at a time, a source whose
        // covering set is wide fills the window on its first state and the next one is never asked.
        let asked = true;
        while (asked) {
            asked = false;
            const pending: SourcePlan[] = [];
            for (const source of run.sources) {
                if (this._readNextStates(run, source)) pending.push(source);
            }
            if (pending.length === 0) break;

            const share = Math.ceil((MAX_TILES_IN_FLIGHT - run.inFlight) / pending.length);
            for (const source of pending) {
                // A `dataloading` listener can move the camera, which ends this run. Nothing below may
                // run against a run that has ended, or it retains tiles nothing is left to release.
                if (this._run !== run) return;
                asked = this._requestTiles(run, source, share) || asked;
            }
        }
    }

    /**
     * Asks one source for up to `share` of the tiles on its queue, so long as the in-flight window has
     * room for them.
     *
     * The batch is capped at what the source has left, and the budget is then debited by what was
     * actually requested rather than by what was offered: a tile the camera already has, or one
     * already in the cache, is worth nothing to the source's budget and must not spend it.
     *
     * @param run - the preload the counters belong to
     * @param source - the source to ask
     * @param share - the most tiles this turn may put in flight, being an equal share of the window
     * @returns whether it asked for anything, which is what tells a turn over the sources to stop
     */
    private _requestTiles(run: PreloadRun, source: SourcePlan, share: number): boolean {
        const room = Math.min(share, source.budget, MAX_TILES_IN_FLIGHT - run.inFlight);
        if (room <= 0) return false;

        const end = Math.min(source.cursor + room, source.queue.length);
        const tiles = source.tileManager.preloadTiles(source.queue.slice(source.cursor, end));
        source.cursor = end;
        source.budget -= tiles.length;
        for (const tile of tiles) {
            if (!tile.isSettled()) {
                source.outstanding.add(tile);
                run.inFlight++;
            }
        }
        return true;
    }

    /**
     * Reads the camera states the camera has reached into the source's queue, skipping the tiles the
     * preload has already accounted for.
     *
     * A state is read whole before any of it is asked for, so a state the in-flight window runs out on
     * is finished rather than skipped: what is left of it is still on the queue for the next settle.
     *
     * @param run - the preload whose path is being read
     * @param source - the source to read for
     * @returns whether the source has anything left to be asked for
     */
    private _readNextStates(run: PreloadRun, source: SourcePlan): boolean {
        while (source.cursor >= source.queue.length && source.read < run.order.length) {
            const index = source.read;
            const frame = run.order[index];
            // The destination is worth having however early it is asked for. The states on the way there
            // are worth having once the camera is on them.
            if (index > 0 && frame >= run.eligible) break;
            // A source that has spent its budget is left for a later movement: what it still has to pass
            // is not read at all, rather than counted and then dropped.
            if (source.budget <= 0) break;
            source.read++;

            for (const tileID of source.tileManager.coveringTiles(source.frames[frame], source.terrain)) {
                if (source.seen.has(tileID.key)) continue;
                source.seen.add(tileID.key);
                source.queue.push(tileID);
            }
        }
        return source.cursor < source.queue.length;
    }

    private _sourcePlans(budget: number, frames: ITransform[], terrain: Terrain | undefined): SourcePlan[] {
        const tileManagers = this._map.style?.tileManagers;
        if (!tileManagers || frames.length === 0) return [];

        const sources: SourcePlan[] = [];
        for (const id in tileManagers) {
            const tileManager = tileManagers[id];
            // A source the style draws nothing from is one the render loop would not ask for either, but
            // one used only for terrain is asked for: it carries the elevation the camera flies over.
            if (!tileManager?.used && !tileManager?.usedForTerrain) continue;

            const outstanding = new Set<Tile>();
            // The listener is built before the run it belongs to exists, so it recognises its own run by
            // the set it is holding rather than by identity: an event already queued when `off()` ran
            // must not top up the movement that replaced this one.
            const onData = () => {
                const current = this._run;
                if (!current?.sources.some((source) => source.outstanding === outstanding)) return;
                // A tile landing frees room for the next one the camera will want. Running dry is not the
                // movement finishing: the states the camera has yet to cross still have to be asked for.
                this._issueTiles(current.eligible);
            };
            tileManager.on('data', onData);

            sources.push({
                tileManager,
                terrain,
                frames,
                queue: [],
                cursor: 0,
                read: 0,
                budget,
                seen: new Set(),
                outstanding,
                stopListening: () => tileManager.off('data', onData)
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
 * The samples carry the movement's elevation with them, since a camera's elevation decides which tiles
 * cover it. It is applied to the throwaway transform and reads the movement's own elevation state, so
 * the movement is left as it was found.
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
 * The caller's value, or the default, treating a value that is not a number as if it were absent.
 */
function orDefault(value: number | undefined, fallback: number): number {
    return value === undefined || !Number.isFinite(value) ? fallback : value;
}
