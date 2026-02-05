import type {WorkerTile} from './worker_tile';
import {type ExpiryData} from '../util/ajax';

export type FetchingState = {
    rawData: ArrayBufferLike;
    cacheControl?: ExpiryData;
    resourceTiming?: any;
};

export class WorkerTileState {
    fetching: Record<string, FetchingState> = {};
    loading: Record<string, WorkerTile> = {};
    loaded: Record<string, WorkerTile> = {};

    startLoading(uid: string | number, tile: WorkerTile): void {
        this.loading[uid] = tile;
    }

    finishLoading(uid: string | number): void {
        delete this.loading[uid];
    }

    abort(uid: string | number): void {
        const tile = this.loading[uid];
        if (!tile?.abort) return;
        tile.abort.abort();
        delete this.loading[uid];
    }

    setFetching(uid: string | number, state: FetchingState): void {
        this.fetching[uid] = state;
    }

    consumeFetching(uid: string | number): FetchingState | undefined {
        const state = this.fetching[uid];
        if (!state) return undefined;
        delete this.fetching[uid];
        return state;
    }

    clearFetching(uid: string | number): void {
        delete this.fetching[uid];
    }

    markLoaded(uid: string | number, tile: WorkerTile): void {
        this.loaded[uid] = tile;
    }

    getLoaded(uid: string | number): WorkerTile | undefined {
        const tile = this.loaded[uid];
        if (!tile) return undefined;
        return tile;
    }

    removeLoaded(uid: string | number): void {
        delete this.loaded[uid];
    }

    clearLoaded(): void {
        this.loaded = {};
    }
}
