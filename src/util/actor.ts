import {isWorker} from './util';
import {serialize, deserialize, Serialized} from './web_worker_transfer';
import {ThrottledInvoker} from './throttled_invoker';

import type {Transferable} from '../types/transferable';
import type {Cancelable} from '../types/cancelable';
import type {WorkerSource} from '../source/worker_source';
import type {OverscaledTileID} from '../source/tile_id';
import type {Callback} from '../types/callback';
import type {StyleGlyph} from '../style/style_glyph';

export interface ActorTarget {
    addEventListener: typeof window.addEventListener;
    removeEventListener: typeof window.removeEventListener;
    postMessage: typeof window.postMessage;
    terminate?: () => void;
}

export interface WorkerSourceProvider {
    getWorkerSource(mapId: string | number, sourceType: string, sourceName: string): WorkerSource;
}

export interface GlyphsProvider {
    getGlyphs(mapId: string, params: {
        stacks: {[_: string]: Array<number>};
        source: string;
        tileID: OverscaledTileID;
        type: string;
    },
        callback: Callback<{[_: string]: {[_: number]: StyleGlyph}}>
    );
}

export type MessageType = '<response>' | '<cancel>' |
'geojson.getClusterExpansionZoom' | 'geojson.getClusterChildren' | 'geojson.getClusterLeaves' | 'geojson.loadData' |
'removeSource' | 'loadWorkerSource' | 'loadDEMTile' | 'removeDEMTile' |
'removeTile' | 'reloadTile' | 'abortTile' | 'loadTile' | 'getTile' |
'getGlyphs' | 'getImages' | 'setImages' |
'syncRTLPluginState' | 'setReferrer' | 'setLayers' | 'updateLayers';

export type MessageData = {
    id: string;
    type: MessageType;
    data?: Serialized;
    targetMapId?: string | number | null;
    mustQueue?: boolean;
    error?: Serialized | null;
    hasCallback?: boolean;
    sourceMapId: string | number | null;
}

export type Message = {
    data: MessageData;
}

/**
 * An implementation of the [Actor design pattern](http://en.wikipedia.org/wiki/Actor_model)
 * that maintains the relationship between asynchronous tasks and the objects
 * that spin them off - in this case, tasks like parsing parts of styles,
 * owned by the styles
 */
export class Actor {
    target: ActorTarget;
    parent: WorkerSourceProvider | GlyphsProvider;
    mapId: string | number | null;
    callbacks: { [x: number]: Function};
    name: string;
    tasks: { [x: number]: MessageData };
    taskQueue: Array<string>;
    cancelCallbacks: { [x: number]: () => void };
    invoker: ThrottledInvoker;
    globalScope: ActorTarget;

    /**
     * @param target - The target
     * @param parent - The parent
     * @param mapId - A unique identifier for the Map instance using this Actor.
     */
    constructor(target: ActorTarget, parent: WorkerSourceProvider | GlyphsProvider, mapId?: string | number) {
        this.target = target;
        this.parent = parent;
        this.mapId = mapId;
        this.callbacks = {};
        this.tasks = {};
        this.taskQueue = [];
        this.cancelCallbacks = {};
        this.invoker = new ThrottledInvoker(this.process);
        this.target.addEventListener('message', this.receive, false);
        this.globalScope = isWorker() ? target : window;
    }

    /**
     * Sends a message from a main-thread map to a Worker or from a Worker back to
     * a main-thread map instance.
     *
     * @param type - The name of the target method to invoke or '[source-type].[source-name].name' for a method on a WorkerSource.
     * @param targetMapId - A particular mapId to which to send this message.
     */
    send(
        type: MessageType,
        data: unknown,
        callback?: Function | null,
        targetMapId?: string | null,
        mustQueue: boolean = false
    ): Cancelable {
        // We're using a string ID instead of numbers because they are being used as object keys
        // anyway, and thus stringified implicitly. We use random IDs because an actor may receive
        // message from multiple other actors which could run in different execution context. A
        // linearly increasing ID could produce collisions.
        const id = Math.round((Math.random() * 1e18)).toString(36).substring(0, 10);
        if (callback) {
            this.callbacks[id] = callback;
        }
        const buffers: Array<Transferable> = [];
        const message: MessageData = {
            id,
            type,
            hasCallback: !!callback,
            targetMapId,
            mustQueue,
            sourceMapId: this.mapId,
            data: serialize(data, buffers)
        };

        this.target.postMessage(message, {transfer: buffers});
        return {
            cancel: () => {
                if (callback) {
                    // Set the callback to null so that it never fires after the request is aborted.
                    delete this.callbacks[id];
                }
                const cancelMessage: MessageData = {
                    id,
                    type: '<cancel>',
                    targetMapId,
                    sourceMapId: this.mapId
                };
                this.target.postMessage(cancelMessage);
            }
        };
    }

    receive = (message: Message) => {
        const data = message.data;
        const id = data.id;

        if (!id) {
            return;
        }

        if (data.targetMapId && this.mapId !== data.targetMapId) {
            return;
        }

        if (data.type === '<cancel>') {
            // Remove the original request from the queue. This is only possible if it
            // hasn't been kicked off yet. The id will remain in the queue, but because
            // there is no associated task, it will be dropped once it's time to execute it.
            delete this.tasks[id];
            const cancel = this.cancelCallbacks[id];
            delete this.cancelCallbacks[id];
            if (cancel) {
                cancel();
            }
        } else {
            if (isWorker() || data.mustQueue) {
                // In workers, store the tasks that we need to process before actually processing them. This
                // is necessary because we want to keep receiving messages, and in particular,
                // <cancel> messages. Some tasks may take a while in the worker thread, so before
                // executing the next task in our queue, postMessage preempts this and <cancel>
                // messages can be processed. We're using a MessageChannel object to get throttle the
                // process() flow to one at a time.
                this.tasks[id] = data;
                this.taskQueue.push(id);
                this.invoker.trigger();
            } else {
                // In the main thread, process messages immediately so that other work does not slip in
                // between getting partial data back from workers.
                this.processTask(id, data);
            }
        }
    };

    process = () => {
        if (!this.taskQueue.length) {
            return;
        }
        const id = this.taskQueue.shift();
        const task = this.tasks[id];
        delete this.tasks[id];
        // Schedule another process call if we know there's more to process _before_ invoking the
        // current task. This is necessary so that processing continues even if the current task
        // doesn't execute successfully.
        if (this.taskQueue.length) {
            this.invoker.trigger();
        }
        if (!task) {
            // If the task ID doesn't have associated task data anymore, it was canceled.
            return;
        }

        this.processTask(id, task);
    };

    processTask(id: string, task: MessageData) {
        if (task.type === '<response>') {
            // The done() function in the counterpart has been called, and we are now
            // firing the callback in the originating actor, if there is one.
            const callback = this.callbacks[id];
            delete this.callbacks[id];
            if (callback) {
                // If we get a response, but don't have a callback, the request was canceled.
                if (task.error) {
                    callback(deserialize(task.error));
                } else {
                    callback(null, deserialize(task.data));
                }
            }
        } else {
            let completed = false;
            const buffers: Array<Transferable> = [];
            const done = task.hasCallback ? (err: Error, data?: any) => {
                completed = true;
                delete this.cancelCallbacks[id];
                const responseMessage: MessageData = {
                    id,
                    type: '<response>',
                    sourceMapId: this.mapId,
                    error: err ? serialize(err) : null,
                    data: serialize(data, buffers)
                };
                this.target.postMessage(responseMessage, {transfer: buffers});
            } : (_) => {
                completed = true;
            };

            let callback: Cancelable = null;
            const params = deserialize(task.data);
            if (this.parent[task.type]) {
                // task.type == 'loadTile', 'removeTile', etc.
                callback = this.parent[task.type](task.sourceMapId, params, done);
            } else if ('getWorkerSource' in this.parent) {
                // task.type == sourcetype.method
                const keys = task.type.split('.');
                const scope = this.parent.getWorkerSource(task.sourceMapId, keys[0], (params as any).source);
                callback = scope[keys[1]](params, done);
            } else {
                // No function was found.
                done(new Error(`Could not find function ${task.type}`));
            }

            if (!completed && callback && callback.cancel) {
                // Allows canceling the task as long as it hasn't been completed yet.
                this.cancelCallbacks[id] = callback.cancel;
            }
        }
    }

    remove() {
        this.invoker.remove();
        this.target.removeEventListener('message', this.receive, false);
    }
}
