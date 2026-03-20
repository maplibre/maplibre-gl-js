import type {WorkerTile} from './worker_tile';
import {type ExpiryData} from '../util/ajax';

export type ParsingState = {
    rawData: ArrayBufferLike;
    cacheControl?: ExpiryData;
    resourceTiming?: any;
};

export class WorkerTileState {
    loading: Record<string, WorkerTile> = {};
    loaded: Record<string, WorkerTile> = {};
    parsing: Record<string, ParsingState> = {};

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

    setParsing(uid: string | number, state: ParsingState): void {
        this.parsing[uid] = state;
    }

    consumeParsing(uid: string | number): ParsingState | undefined {
        const state = this.parsing[uid];
        if (!state) return undefined;
        delete this.parsing[uid];
        return state;
    }

    clearParsing(uid: string | number): void {
        delete this.parsing[uid];
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
